import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { SchedulerProfile, ExecutionRecord, ExecutionStatus } from '../types/scheduler.types';

const execAsync = promisify(exec);

export class SchedulerExecutor {
    private profileId: string;
    private profile: SchedulerProfile | null = null;
    private dataDir: string;
    private executionRecord: ExecutionRecord;

    constructor(profileId: string) {
        this.profileId = profileId;
        this.dataDir = path.join(process.cwd(), 'data');
        this.executionRecord = this.createExecutionRecord();
    }
    // Verifica permisos
    private async checkWritePermissions(): Promise<void> {
        const testFile = path.join(this.dataDir, 'test-write.txt');
        try {
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log('✅ [DEBUG] Write permissions OK');
        } catch (error) {
            console.error('❌ [DEBUG] No write permissions:', error);
        }
    }
    async execute(): Promise<void> {
        await this.debugCommandExecution();
        await this.checkWritePermissions();
        console.log(`🔍 [DEBUG] Starting execution for profile: ${this.profileId}`);
        console.log(`🔍 [DEBUG] Working directory: ${process.cwd()}`);
        console.log(`🔍 [DEBUG] Node path: ${process.execPath}`);
        console.log(`Starting scheduled execution for profile: ${this.profileId}`);

        try {
            await this.loadProfile();
            await this.updateHeartbeat();

            const startTime = Date.now();
            this.executionRecord.startTime = new Date(startTime);
            this.executionRecord.status = 'running' as any;

            // Ejecutar tests
            const testResult = await this.runPlaywrightTests();

            const endTime = Date.now();
            this.executionRecord.endTime = new Date(endTime);
            this.executionRecord.duration = endTime - startTime;
            this.executionRecord.status = testResult.success ? 'success' : 'failed';

            if (testResult.error) {
                this.executionRecord.errors = [{
                    type: 'test_failure',
                    message: testResult.error,
                    timestamp: new Date()
                }];
            }

            // Guardar resultado
            await this.saveExecutionRecord();
            await this.updateSchedulerStatus();

            console.log(`Execution completed. Status: ${this.executionRecord.status}`);
            console.log(`Duration: ${(this.executionRecord.duration / 1000).toFixed(2)}s`);

        } catch (error) {
            console.error('Execution failed:', error);
            this.executionRecord.status = 'failed';
            this.executionRecord.errors = [{
                type: 'system',
                message: error instanceof Error ? error.message : String(error),
                timestamp: new Date()
            }];
            await this.saveExecutionRecord();
        }
    }

    private async loadProfile(): Promise<void> {
        const profilesFile = path.join(this.dataDir, 'scheduler-profiles.json');
        console.log(`🔍 [DEBUG] Looking for profiles file: ${profilesFile}`);

        if (!fs.existsSync(profilesFile)) {
            console.error(`❌ [DEBUG] Profiles file NOT FOUND: ${profilesFile}`);
            throw new Error('Profiles file not found');
        }

        const profilesData = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'));
        this.profile = profilesData.profiles.find((p: SchedulerProfile) => p.id === this.profileId);
        console.log(`🔍 [DEBUG] Profiles data: ${JSON.stringify(profilesData, null, 2)}`);

        if (!this.profile) {
            console.error(`❌ [DEBUG] Profile ${this.profileId} NOT FOUND in profiles file`);
            throw new Error(`Profile ${this.profileId} not found`);
        }

        console.log(`Loaded profile: ${this.profile.name}`);
    }

    // Agrega esta función de debug
    private async debugCommandExecution(): Promise<void> {
        console.log(`🔍 [DEBUG] Testing basic command execution...`);

        // Test 1: Node version
        try {
            const nodeResult = await execAsync('node --version');
            console.log(`✅ [DEBUG] Node version: ${nodeResult.stdout.trim()}`);
        } catch (error) {
            console.error(`❌ [DEBUG] Node not available: ${error}`);
        }

        // Test 2: Playwright version
        try {
            const pwResult = await execAsync('npx playwright --version');
            console.log(`✅ [DEBUG] Playwright version: ${pwResult.stdout.trim()}`);
        } catch (error) {
            console.error(`❌ [DEBUG] Playwright not available: ${error}`);
        }

        // Test 3: Directory listing
        try {
            const dirResult = await execAsync('dir');
            console.log(`✅ [DEBUG] Current directory contents available`);
        } catch (error) {
            console.error(`❌ [DEBUG] Cannot list directory: ${error}`);
        }
    }


    private async runPlaywrightTests(): Promise<{ success: boolean; error?: string }> {
        if (!this.profile) {
            return { success: false, error: 'Profile not loaded' };
        }

        try {
            
            // Construir comando de Playwright
            const testFiles = this.profile.tests.testFiles.join(' ');
            const command = `npx playwright test ${testFiles}`;

            console.log(`Running command: ${command}`);

            // Ejecutar con timeout
            const timeoutMs = (this.profile.tests.timeoutMinutes || 30) * 60 * 1000;

            const { stdout, stderr } = await Promise.race([
                execAsync(command, {
                    cwd: process.cwd(),
                    maxBuffer: 1024 * 1024 * 10 // 10MB buffer
                }),
                new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('Test execution timeout')), timeoutMs)
                )
            ]);

            // Procesar resultados de Playwright
            const results = this.parsePlaywrightResults(stdout);

            return { success: results.success };

        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error('Test execution error:', errorMsg);
            return { success: false, error: errorMsg };
        }
    }

    private parsePlaywrightResults(stdout: string): { success: boolean; results?: any } {
        try {
            // Playwright JSON reporter output
            const results = JSON.parse(stdout);

            const hasFailures = results.suites?.some((suite: any) =>
                suite.specs?.some((spec: any) =>
                    spec.tests?.some((test: any) =>
                        test.results?.some((result: any) => result.status === 'failed')
                    )
                )
            );

            return {
                success: !hasFailures,
                results: results
            };
        } catch {
            // Si no se puede parsear JSON, verificar por texto
            const success = !stdout.includes('failed') && !stdout.includes('error');
            return { success };
        }
    }

    private createExecutionRecord(): ExecutionRecord {
        return {
            id: `exec_${this.profileId}_${Date.now()}`,
            profileId: this.profileId,
            timestamp: new Date(),
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            status: 'failed' as ExecutionStatus,
            metadata: {
                schedulerVersion: '1.0.0',
                playwrightVersion: this.getPlaywrightVersion(),
                nodeVersion: process.version,
                systemInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    totalMemory: require('os').totalmem(),
                    freeMemory: require('os').freemem(),
                    cpuUsage: 0
                },
                networkInfo: {}
            }
        };
    }

    private getPlaywrightVersion(): string {
        try {
            const packageJson = JSON.parse(
                fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf-8')
            );
            return packageJson.dependencies?.['@playwright/test'] || 'unknown';
        } catch {
            return 'unknown';
        }
    }

    private async saveExecutionRecord(): Promise<void> {
        const historyFile = this.getHistoryFile();

        let history: { executions: ExecutionRecord[] } = { executions: [] };

        if (fs.existsSync(historyFile)) {
            history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
        }

        history.executions.push(this.executionRecord);

        // Mantener solo últimas 1000 ejecuciones por mes
        if (history.executions.length > 1000) {
            history.executions = history.executions.slice(-1000);
        }

        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
        console.log(`Execution record saved to: ${historyFile}`);
    }

    private getHistoryFile(): string {
        const now = new Date();
        const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const fileName = `execution-history-${yearMonth}.json`;

        const historyDir = path.join(this.dataDir, 'history');
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }

        return path.join(historyDir, fileName);
    }

    private async updateHeartbeat(): Promise<void> {
        const statusFile = path.join(this.dataDir, 'scheduler-status.json');

        if (fs.existsSync(statusFile)) {
            const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
            status.lastHeartbeat = new Date();
            fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
        }
    }

    private async updateSchedulerStatus(): Promise<void> {
        const statusFile = path.join(this.dataDir, 'scheduler-status.json');

        if (fs.existsSync(statusFile)) {
            const status = JSON.parse(fs.readFileSync(statusFile, 'utf-8'));
            status.lastExecution = this.executionRecord;
            status.lastHeartbeat = new Date();

            // Actualizar estadísticas
            if (!status.statistics) {
                status.statistics = {
                    totalExecutions: 0,
                    successfulExecutions: 0,
                    failedExecutions: 0,
                    averageExecutionTime: 0,
                    uptimePercentage: 100,
                    lastResetDate: new Date()
                };
            }

            status.statistics.totalExecutions++;
            if (this.executionRecord.status === 'success') {
                status.statistics.successfulExecutions++;
            } else {
                status.statistics.failedExecutions++;
            }

            // Calcular tiempo promedio
            const totalTime = (status.statistics.averageExecutionTime * (status.statistics.totalExecutions - 1)) +
                (this.executionRecord.duration / 1000);
            status.statistics.averageExecutionTime = totalTime / status.statistics.totalExecutions;

            // Calcular uptime
            status.statistics.uptimePercentage =
                (status.statistics.successfulExecutions / status.statistics.totalExecutions) * 100;

            fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
        }
    }
}

// Punto de entrada para ejecución desde línea de comandos
async function main() {
    const args = process.argv.slice(2);
    const profileArg = args.find(arg => arg.startsWith('--profile='));

    if (!profileArg) {
        console.error('Usage: node SchedulerExecutor.js --profile=PROFILE_ID');
        process.exit(1);
    }

    const profileId = profileArg.split('=')[1];

    if (!profileId) {
        console.error('Invalid profile ID');
        process.exit(1);
    }

    const executor = new SchedulerExecutor(profileId);

    try {
        await executor.execute();
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
    main();
}
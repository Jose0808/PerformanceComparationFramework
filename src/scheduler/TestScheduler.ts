import * as cron from 'node-cron';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { runPlaywright } from '../../electron/commands';

export interface ScheduleConfig {
  id: string;
  name: string;
  cronExpression: string;
  testPattern?: string; // patrón para filtrar tests específicos
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runHistory: ScheduleRun[];
  options?: {
    timeout?: number;
    retries?: number;
    browsers?: string[];
  };
}

export interface ScheduleRun {
  id: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  output?: string;
  error?: string;
  testsRun: number;
  testsPassed: number;
  testsFailed: number;
}

export class TestScheduler extends EventEmitter {
  private schedules: Map<string, ScheduleConfig> = new Map();
  private runningJobs: Map<string, cron.ScheduledTask> = new Map();
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private configPath: string;
  private projectPath: string;
  private isElectronMode: boolean;

  constructor(projectPath: string, isElectronMode: boolean = false) {
    super();
    this.projectPath = projectPath;
    this.isElectronMode = isElectronMode;
    this.configPath = path.join(projectPath, 'scheduler-config.json');
    this.loadSchedules();
  }

  // Cargar configuración desde archivo
  private loadSchedules(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const configs: ScheduleConfig[] = JSON.parse(data);

        configs.forEach(config => {
          // Convertir strings a Date objects
          if (config.lastRun) config.lastRun = new Date(config.lastRun);
          if (config.nextRun) config.nextRun = new Date(config.nextRun);

          config.runHistory = config.runHistory.map(run => ({
            ...run,
            startTime: new Date(run.startTime),
            endTime: run.endTime ? new Date(run.endTime) : undefined
          }));

          this.schedules.set(config.id, config);

          // Reiniciar jobs activos si están habilitados
          if (config.enabled) {
            this.startSchedule(config.id);
          }
        });

        console.log(`Loaded ${configs.length} schedules`);
      }
    } catch (error) {
      console.error('Error loading schedules:', error);
    }
  }

  // Guardar configuración a archivo
  private saveSchedules(): void {
    try {
      const configs = Array.from(this.schedules.values());
      fs.writeFileSync(this.configPath, JSON.stringify(configs, null, 2));
    } catch (error) {
      console.error('Error saving schedules:', error);
    }
  }

  // Crear nuevo schedule
  createSchedule(config: Omit<ScheduleConfig, 'id' | 'runHistory' | 'lastRun' | 'nextRun'>): string {
    const id = `schedule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newSchedule: ScheduleConfig = {
      ...config,
      id,
      runHistory: [],
      lastRun: undefined,
      nextRun: undefined
    };

    // Validar expresión cron
    if (!cron.validate(config.cronExpression)) {
      throw new Error(`Invalid cron expression: ${config.cronExpression}`);
    }

    this.schedules.set(id, newSchedule);
    this.saveSchedules();

    if (config.enabled) {
      this.startSchedule(id);
    }

    this.emit('schedule-created', newSchedule);
    return id;
  }

  // Iniciar un schedule específico
  startSchedule(scheduleId: string): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      console.error(`Schedule not found: ${scheduleId}`);
      return false;
    }

    // Detener job existente si está corriendo
    this.stopSchedule(scheduleId);

    try {
      const task = cron.schedule(schedule.cronExpression, async () => {
        await this.executeScheduledTest(schedule);
      }, {
        scheduled: false,
        timezone: 'America/Bogota' // Ajustar según tu zona horaria
      } as any);

      task.start();
      this.runningJobs.set(scheduleId, task);

      // Actualizar próxima ejecución
      schedule.enabled = true;
      schedule.nextRun = this.getNextRunDate(schedule.cronExpression);
      this.saveSchedules();

      console.log(`Schedule started: ${schedule.name} (${schedule.cronExpression})`);
      this.emit('schedule-started', schedule);
      return true;
    } catch (error) {
      console.error(`Error starting schedule ${scheduleId}:`, error);
      return false;
    }
  }

  // Detener un schedule específico
  stopSchedule(scheduleId: string): boolean {
    const job = this.runningJobs.get(scheduleId);
    const schedule = this.schedules.get(scheduleId);

    if (job) {
      job.stop();
      job.destroy();
      this.runningJobs.delete(scheduleId);
    }

    // Detener proceso activo si existe
    const process = this.activeProcesses.get(scheduleId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      this.activeProcesses.delete(scheduleId);
    }

    if (schedule) {
      schedule.enabled = false;
      schedule.nextRun = undefined;
      this.saveSchedules();
      this.emit('schedule-stopped', schedule);
    }

    return true;
  }

  // Ejecutar test programado
  private async executeScheduledTest(schedule: ScheduleConfig): Promise<void> {
    const runId = `run_${Date.now()}`;
    const run: ScheduleRun = {
      id: runId,
      startTime: new Date(),
      success: false,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0
    };

    schedule.runHistory.push(run);
    schedule.lastRun = run.startTime;
    schedule.nextRun = this.getNextRunDate(schedule.cronExpression);

    this.emit('test-run-started', { schedule, run });

    try {
      const args: string[] = ['test'];


      // Agregar patrón de test si está especificado
      if (schedule.testPattern) {
        args.push(schedule.testPattern);
      }
      console.log(`Executing scheduled test: ${args.join(' ')}`);

      // Ejecutar usando commands.ts
      const result = await runPlaywright(args, {
        onData: 'test-output',
      });

      // Parsear resultados del output
      const testResults = this.parsePlaywrightOutput(result.output);

      run.endTime = new Date();
      run.success = result.success;
      run.output = result.output;
      run.error = result.error;
      run.testsRun = testResults.total;
      run.testsPassed = testResults.passed;
      run.testsFailed = testResults.failed;

      console.log(`Test execution completed for ${schedule.name}:`, {
        success: result.success,
        testsRun: run.testsRun,
        testsPassed: run.testsPassed,
        testsFailed: run.testsFailed
      });

    } catch (error) {
      run.endTime = new Date();
      run.success = false;
      run.error = error instanceof Error ? error.message : String(error);
      console.error(`Error executing scheduled test ${schedule.name}:`, error);
    }

    // Limpiar historial (mantener solo los últimos 50 runs)
    if (schedule.runHistory.length > 50) {
      schedule.runHistory = schedule.runHistory.slice(-50);
    }

    this.saveSchedules();
    this.emit('test-run-completed', { schedule, run });
  }

  // Parsear output de Playwright para extraer estadísticas
  private parsePlaywrightOutput(output: string): { total: number; passed: number; failed: number } {
    let total = 0, passed = 0, failed = 0;

    // Buscar líneas de resumen típicas de Playwright
    const lines = output.split('\n');
    for (const line of lines) {
      // Formato: "  5 passed (1.2s)"
      const passedMatch = line.match(/(\d+)\s+passed/);
      if (passedMatch) {
        passed = parseInt(passedMatch[1]);
      }

      // Formato: "  2 failed"
      const failedMatch = line.match(/(\d+)\s+failed/);
      if (failedMatch) {
        failed = parseInt(failedMatch[1]);
      }

      // Formato: "Ran 7 tests"
      const totalMatch = line.match(/Ran\s+(\d+)\s+tests/);
      if (totalMatch) {
        total = parseInt(totalMatch[1]);
      }
    }

    // Si no encontramos total, calcularlo
    if (total === 0) {
      total = passed + failed;
    }

    return { total, passed, failed };
  }

  // Calcular próxima fecha de ejecución
  private getNextRunDate(cronExpression: string): Date {
    // Esta es una implementación simplificada
    // En producción, usar una librería como 'node-cron' o 'cron-parser'
    try {
      const task = cron.schedule(cronExpression, () => { }, { scheduled: false } as any);
      // node-cron no expone directamente la próxima fecha
      // Implementación simplificada que suma tiempo basado en patrón común
      const now = new Date();

      // Para patrones simples, estimar próxima ejecución
      if (cronExpression.includes('* * * * *')) { // cada minuto
        return new Date(now.getTime() + 60000);
      } else if (cronExpression.match(/^\d+ \* \* \* \*$/)) { // cada hora en minuto específico
        const minute = parseInt(cronExpression.split(' ')[0]);
        const next = new Date(now);
        next.setMinutes(minute, 0, 0);
        if (next <= now) {
          next.setHours(next.getHours() + 1);
        }
        return next;
      } else if (cronExpression.match(/^\d+ \d+ \* \* \*$/)) { // diario
        const [minute, hour] = cronExpression.split(' ').map(Number);
        const next = new Date(now);
        next.setHours(hour, minute, 0, 0);
        if (next <= now) {
          next.setDate(next.getDate() + 1);
        }
        return next;
      }

      // Fallback: próxima hora
      return new Date(now.getTime() + 3600000);
    } catch {
      return new Date(Date.now() + 3600000); // 1 hora
    }
  }

  // Obtener todos los schedules
  getAllSchedules(): ScheduleConfig[] {
    return Array.from(this.schedules.values());
  }

  // Obtener schedule por ID
  getSchedule(scheduleId: string): ScheduleConfig | undefined {
    return this.schedules.get(scheduleId);
  }

  // Actualizar schedule
  updateSchedule(scheduleId: string, updates: Partial<ScheduleConfig>): boolean {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    // Detener si está corriendo y va a cambiar la expresión cron
    if (updates.cronExpression && updates.cronExpression !== schedule.cronExpression) {
      this.stopSchedule(scheduleId);
    }

    // Aplicar actualizaciones
    Object.assign(schedule, updates);

    // Validar nueva expresión cron si cambió
    if (updates.cronExpression && !cron.validate(schedule.cronExpression)) {
      throw new Error(`Invalid cron expression: ${schedule.cronExpression}`);
    }

    this.saveSchedules();

    // Reiniciar si está habilitado
    if (schedule.enabled) {
      this.startSchedule(scheduleId);
    }

    this.emit('schedule-updated', schedule);
    return true;
  }

  // Eliminar schedule
  deleteSchedule(scheduleId: string): boolean {
    this.stopSchedule(scheduleId);
    const deleted = this.schedules.delete(scheduleId);
    if (deleted) {
      this.saveSchedules();
      this.emit('schedule-deleted', scheduleId);
    }
    return deleted;
  }

  // Ejecutar schedule manualmente
  async runScheduleNow(scheduleId: string): Promise<boolean> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) return false;

    try {
      await this.executeScheduledTest(schedule);
      return true;
    } catch (error) {
      console.error(`Error running schedule manually:`, error);
      return false;
    }
  }

  // Cleanup al cerrar
  shutdown(): void {
    console.log('Shutting down scheduler...');

    // Detener todos los jobs
    this.runningJobs.forEach((job, id) => {
      this.stopSchedule(id);
    });

    // Matar procesos activos
    this.activeProcesses.forEach((process, id) => {
      if (!process.killed) {
        console.log(`Killing active process for schedule: ${id}`);
        process.kill('SIGTERM');
      }
    });

    this.saveSchedules();
    this.emit('shutdown');
  }

  // Obtener estado general
  getStatus() {
    const schedules = this.getAllSchedules();
    return {
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.enabled).length,
      runningJobs: this.runningJobs.size,
      activeProcesses: this.activeProcesses.size,
      recentRuns: schedules
        .flatMap(s => s.runHistory.slice(-5))
        .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
        .slice(0, 10)
    };
  }
}
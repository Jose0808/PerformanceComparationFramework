import { spawn } from 'child_process';
import path from 'path';
import { ProjectPaths, CommandOptions, CommandResult } from './types';
import { app } from 'electron';

// Ejecutar comandos genéricos
export function executeCommand(
    command: string,
    args: string[],
    options: CommandOptions = {}
): Promise<CommandResult> {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';

        let finalCommand = command;
        let finalArgs = args;
        const paths = getProjectPaths();


        console.log(`Ejecutando: ${finalCommand} ${finalArgs.join(' ')}`);
        console.log(`Directorio de trabajo: ${paths.basePath}`);

        const childProcess = spawn(finalCommand, finalArgs, {
            cwd: paths.basePath,
            stdio: options.stdio || 'pipe',
            shell: isWindows,
            env: {
                ...process.env,
                PATH: process.env.PATH,
                PLAYWRIGHT_CONFIG: paths.configFile,
                NODE_PATH: paths.nodeModules
            },
            ...options
        } as any);

        let output = '';
        let errorOutput = '';

        const handleData = (data: Buffer) => {
            const dataStr = data.toString();
            output += dataStr;

            if (options.onData && options.mainWindow && !options.mainWindow.isDestroyed()) {
                options.mainWindow.webContents.send(options.onData, dataStr);
            }
        };

        childProcess.stdout?.on('data', handleData);
        childProcess.stderr?.on('data', handleData);

        childProcess.on('close', (code: number) => {
            resolve({
                success: code === 0,
                output: output + errorOutput,
                code
            });
        });

        childProcess.on('error', (error: Error) => {
            console.error('Error ejecutando comando:', error);
            resolve({
                success: false,
                output: error.message,
                error: error.message
            });
        });

        if (options.timeout) {
            setTimeout(() => {
                if (!childProcess.killed) {
                    childProcess.kill();
                    resolve({
                        success: false,
                        output: 'Timeout ejecutando comando',
                        code: -1
                    });
                }
            }, options.timeout);
        }
    });
}

// Función para ejecutar Playwright
export async function runPlaywright(
    args: string[],
    options: CommandOptions = {}
): Promise<CommandResult> {
    const paths = getProjectPaths();
    const playwrightBin = path.join(
        paths.nodeModules,
        '.bin',
        process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
    );

    return executeCommand(playwrightBin, args, { cwd: paths.basePath, ...options });
}


// Función para obtener la ruta base según el entorno
export function getBasePath(): string {
      const isPackaged = process.mainModule?.filename.indexOf('app.asar') !== -1;
    // console.log(app.isPackaged);
    if (isPackaged) {
        console.log(path.join(path.dirname(process.execPath), 'resources'));
        return path.join(path.dirname(process.execPath), 'resources');
    } else {
        console.log(path.join(__dirname, '..'));
        return path.join(__dirname, '..');
    }
}

// Función para obtener rutas de archivos críticos
export function getProjectPaths(): ProjectPaths {
    const basePath = getBasePath();
    console.log("BasePath: ", basePath);

    return {
        basePath,
        testsDir: path.join(basePath, 'src', 'tests'),
        dataDir: path.join(basePath, 'src', 'data-driven'),
        envFile: path.join(basePath, '.env'),
        configFile: path.join(basePath, process.env.ENVIROMENT !== 'pro' ? 'playwright.config.ts': 'playwright.config.js'),
        nodeModules: path.join(basePath, 'node_modules'),
        packageJson: path.join(basePath, 'package.json'),
        reportsDir: path.join(basePath, 'reports')
    };
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeCommand = executeCommand;
exports.runPlaywright = runPlaywright;
exports.getBasePath = getBasePath;
exports.getProjectPaths = getProjectPaths;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
// Ejecutar comandos genéricos
function executeCommand(command, args, options = {}) {
    return new Promise((resolve) => {
        const isWindows = process.platform === 'win32';
        let finalCommand = command;
        let finalArgs = args;
        const paths = getProjectPaths();
        console.log(`Ejecutando: ${finalCommand} ${finalArgs.join(' ')}`);
        console.log(`Directorio de trabajo: ${paths.basePath}`);
        const childProcess = (0, child_process_1.spawn)(finalCommand, finalArgs, {
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
        });
        
        childProcess.unref();
        
        let output = '';
        let errorOutput = '';
        const handleData = (data) => {
            const dataStr = data.toString();
            output += dataStr;
            if (options.onData && options.mainWindow && !options.mainWindow.isDestroyed()) {
                options.mainWindow.webContents.send(options.onData, dataStr);
            }
        };
        childProcess.stdout?.on('data', handleData);
        childProcess.stderr?.on('data', handleData);
        childProcess.on('close', (code) => {
            resolve({
                success: code === 0,
                output: output + errorOutput,
                code
            });
        });
        childProcess.on('error', (error) => {
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
async function runPlaywright(args, options = {}) {
    const paths = getProjectPaths();
    const playwrightBin = path_1.default.join(paths.nodeModules, '.bin', process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
    return executeCommand(playwrightBin, args, { cwd: paths.basePath, ...options });
}
// Función para obtener la ruta base según el entorno
function getBasePath() {
    const isPackaged = process.mainModule?.filename.indexOf('app.asar') !== -1;
    // console.log(app.isPackaged);
    if (isPackaged) {
        console.log(path_1.default.join(path_1.default.dirname(process.execPath), 'resources'));
        return path_1.default.join(path_1.default.dirname(process.execPath), 'resources');
    }
    else {
        console.log(path_1.default.join(__dirname, '..'));
        return path_1.default.join(__dirname, '..');
    }
}
// Función para obtener rutas de archivos críticos
function getProjectPaths() {
    const basePath = getBasePath();
    console.log("BasePath: ", basePath);
    return {
        basePath,
        testsDir: path_1.default.join(basePath, 'src', 'tests'),
        dataDir: path_1.default.join(basePath, 'src', 'data-driven'),
        envFile: path_1.default.join(basePath, '.env'),
        configFile: path_1.default.join(basePath, 'playwright.config.ts'),
        nodeModules: path_1.default.join(basePath, 'node_modules'),
        packageJson: path_1.default.join(basePath, 'package.json'),
        reportsDir: path_1.default.join(basePath, 'reports')
    };
}

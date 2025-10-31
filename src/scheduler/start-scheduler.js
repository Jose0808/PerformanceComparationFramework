#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Función para mostrar ayuda
function showHelp() {
    console.log(`
Playwright Scheduler Service
============================

Uso: node start-scheduler.ts [opciones] [ruta-proyecto]

Opciones:
  --port <número>     Puerto para el servicio (default: 3001)
  --log-level <nivel> Nivel de logging: debug, info, warn, error (default: info)
  --daemon           Ejecutar como daemon en segundo plano
  --stop             Detener el servicio en ejecución
  --status           Mostrar estado del servicio
  --help, -h         Mostrar esta ayuda

Ejemplos:
  node start-scheduler.js                    # Ejecutar en directorio actual
  node start-scheduler.js /ruta/proyecto     # Ejecutar en directorio específico
  node start-scheduler.js --daemon           # Ejecutar como daemon
  node start-scheduler.js --stop             # Detener servicio
  node start-scheduler.js --status           # Ver estado

Variables de entorno:
  SCHEDULER_PORT     Puerto del servicio (default: 3001)
  LOG_LEVEL         Nivel de logging (default: info)
`);
}

// Parsear argumentos de línea de comandos
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        port: process.env.SCHEDULER_PORT || 3001,
        logLevel: process.env.LOG_LEVEL || 'info',
        projectPath: "",
        daemon: false,
        stop: false,
        status: false,
        help: false
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        switch (arg) {
            case '--port':
                options.port = parseInt(args[++i]) || 3001;
                break;
            case '--log-level':
                options.logLevel = args[++i] || 'info';
                break;
            case '--daemon':
                options.daemon = true;
                break;
            case '--stop':
                options.stop = true;
                break;
            case '--status':
                options.status = true;
                break;
            case '--help':
            case '-h':
                options.help = true;
                break;
            default:
                if (!arg.startsWith('--') && !options.projectPath) {
                    options.projectPath = arg;
                }
        }
    }

    // Si no se especifica ruta, usar directorio actual
    if (!options.projectPath) {
        options.projectPath = process.cwd();
    }

    return options;
}

// Verificar si el proyecto es válido
function validateProject(projectPath) {
    const playwrightConfig = path.join(projectPath, process.env.ENVIROMENT !== 'pro' ? 'playwright.config.ts' : 'playwright.config.js');
    // const packageJson = path.join(projectPath, 'package.json');

    if (!fs.existsSync(playwrightConfig)) {
        console.error(`Error: No se encontró playwright.config.ts en ${projectPath}`);
        console.error('Asegúrese de estar en la raíz de un proyecto Playwright válido');
        return false;
    }

    // if (!fs.existsSync(packageJson)) {
    //     console.error(`Error: No se encontró package.json en ${projectPath}`);
    //     return false;
    // }

    return true;
}

// Obtener información del PID file
function getPidInfo(projectPath) {
    const pidFile = path.join(projectPath, 'scheduler.pid');

    if (!fs.existsSync(pidFile)) {
        return null;
    }

    try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));

        // Verificar si el proceso está corriendo
        try {
            process.kill(pid, 0); // No mata el proceso, solo verifica si existe
            return { pid, running: true };
        } catch (error) {
            // Proceso no existe, limpiar PID file
            fs.unlinkSync(pidFile);
            return { pid, running: false };
        }
    } catch (error) {
        return null;
    }
}

// Mostrar estado del servicio
function showStatus(projectPath) {
    console.log('Estado del Scheduler Service');
    console.log('============================');

    const pidInfo = getPidInfo(projectPath);

    if (!pidInfo) {
        console.log('Estado: No hay servicio registrado');
        return;
    }

    if (pidInfo.running) {
        console.log(`Estado: Ejecutándose (PID: ${pidInfo.pid})`);
        console.log(`Proyecto: ${projectPath}`);

        // Intentar obtener más información del servicio
        const http = require('http');
        const options = {
            hostname: '127.0.0.1',
            port: process.env.SCHEDULER_PORT || 3001,
            path: '/api/status',
            method: 'GET',
            timeout: 2000
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const status = JSON.parse(data);
                    console.log(`Puerto: ${options.port}`);
                    console.log(`Uptime: ${Math.floor(status.serviceInfo.uptime / 60)} minutos`);
                    console.log(`Schedules: ${status.totalSchedules} total, ${status.activeSchedules} activos`);
                    console.log(`Memoria: ${Math.round(status.serviceInfo.memoryUsage.heapUsed / 1024 / 1024)} MB`);
                } catch (error) {
                    console.log('No se pudo obtener información detallada del servicio');
                }
            });
        });

        req.on('error', () => {
            console.log('Servicio registrado pero no responde en el puerto esperado');
        });

        req.end();

    } else {
        console.log(`Estado: Detenido (último PID: ${pidInfo.pid})`);
    }
}

// Detener servicio
function stopService(projectPath) {
    const pidInfo = getPidInfo(projectPath);

    if (!pidInfo || !pidInfo.running) {
        console.log('No hay servicio ejecutándose');
        return false;
    }

    try {
        console.log(`Deteniendo servicio (PID: ${pidInfo.pid})...`);
        process.kill(pidInfo.pid, 'SIGTERM');

        // Esperar un momento y verificar
        setTimeout(() => {
            try {
                process.kill(pidInfo.pid, 0);
                console.log('Forzando detención...');
                process.kill(pidInfo.pid, 'SIGKILL');
            } catch (error) {
                console.log('Servicio detenido correctamente');
            }
        }, 3000);

        return true;
    } catch (error) {
        console.error('Error deteniendo el servicio:', error.message);
        return false;
    }
}

// Iniciar servicio
function startService(options) {
    // const servicePath = path.join(__dirname.replace("src","dist\\src"), 'SchedulerService.js');
    const servicePath = path.join(__dirname, 'SchedulerService.js');

    // Verificar que el archivo del servicio existe
    if (!fs.existsSync(servicePath)) {
        console.error(`Error: No se encontró el servicio en ${servicePath}`);
        console.error('Ejecute "npm run build" primero');
        return false;
    }

    // Verificar si ya hay un servicio corriendo
    const pidInfo = getPidInfo(options.projectPath);
    if (pidInfo && pidInfo.running) {
        console.log(`Ya hay un servicio ejecutándose (PID: ${pidInfo.pid})`);
        console.log('Use --stop para detenerlo primero');
        return false;
    }

    const env = {
        ...process.env,
        SCHEDULER_PORT: options.port.toString(),
        LOG_LEVEL: options.logLevel
    };

    if (options.daemon) {
        // Ejecutar como daemon
        const child = spawn(process.execPath, [servicePath, options.projectPath], {
            detached: true,
            stdio: 'ignore',
            env
        });

        child.unref();

        console.log(`Servicio iniciado como daemon (PID: ${child.pid})`);
        console.log(`Puerto: ${options.port}`);
        console.log(`Proyecto: ${options.projectPath}`);
        console.log(`Log level: ${options.logLevel}`);

    } else {
        // Ejecutar en primer plano
        console.log('Iniciando Scheduler Service...');
        console.log(`Puerto: ${options.port}`);
        console.log(`Proyecto: ${options.projectPath}`);
        console.log(`Log level: ${options.logLevel}`);
        console.log('Presione Ctrl+C para detener\n');

        const child = spawn(process.execPath, [servicePath, options.projectPath], {
            stdio: 'inherit',
            env
        });

        // Manejo de señales para shutdown limpio
        process.on('SIGINT', () => {
            console.log('\nDeteniendo servicio...');
            child.kill('SIGTERM');
        });

        child.on('close', (code) => {
            console.log(`Servicio terminado con código ${code}`);
            process.exit(code);
        });
    }

    return true;
}

// Función principal
function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    // Validar proyecto
    if (!validateProject(options.projectPath)) {
        process.exit(1);
    }

    if (options.status) {
        showStatus(options.projectPath);
        return;
    }

    if (options.stop) {
        const stopped = stopService(options.projectPath);
        process.exit(stopped ? 0 : 1);
    }

    // Iniciar servicio
    const started = startService(options);
    if (!started) {
        process.exit(1);
    }
}

// Ejecutar si es el módulo principal
if (require.main === module) {
    main();
}

module.exports = {
    parseArgs,
    validateProject,
    getPidInfo,
    showStatus,
    stopService,
    startService
};
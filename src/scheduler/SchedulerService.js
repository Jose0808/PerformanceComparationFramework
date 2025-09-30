#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
exports.runStandaloneScheduler = runStandaloneScheduler;
const TestScheduler_1 = require("./TestScheduler");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const http_1 = require("http");
const ws_1 = require("ws");
class SchedulerService {
    scheduler;
    config;
    httpServer;
    wsServer;
    isRunning = false;
    pidFile;
    constructor(config) {
        this.config = config;
        this.scheduler = new TestScheduler_1.TestScheduler(config.projectPath);
        this.pidFile = config.pidFile;
        this.setupSchedulerEvents();
        this.setupProcessHandlers();
    }
    setupSchedulerEvents() {
        this.scheduler.on('test-run-started', (data) => {
            this.log('info', `Test run started: ${data.schedule.name} (${data.run.id})`);
            this.broadcastToClients('test-run-started', data);
        });
        this.scheduler.on('test-run-completed', (data) => {
            const status = data.run.success ? 'SUCCESS' : 'FAILED';
            this.log('info', `Test run completed: ${data.schedule.name} - ${status} (${data.run.testsRun} tests)`);
            this.broadcastToClients('test-run-completed', data);
        });
        this.scheduler.on('test-output', (data) => {
            this.log('debug', `Test output: ${data.output.trim()}`);
            this.broadcastToClients('test-output', data);
        });
        this.scheduler.on('test-error', (data) => {
            this.log('warn', `Test error: ${data.error.trim()}`);
            this.broadcastToClients('test-error', data);
        });
        this.scheduler.on('schedule-started', (schedule) => {
            this.log('info', `Schedule started: ${schedule.name}`);
            this.broadcastToClients('schedule-started', schedule);
        });
        this.scheduler.on('schedule-stopped', (schedule) => {
            this.log('info', `Schedule stopped: ${schedule.name}`);
            this.broadcastToClients('schedule-stopped', schedule);
        });
    }
    setupProcessHandlers() {
        // Manejo de señales para shutdown graceful
        const gracefulShutdown = (signal) => {
            this.log('info', `Received ${signal}, shutting down gracefully...`);
            this.stop().then(() => {
                process.exit(0);
            }).catch((error) => {
                this.log('error', `Error during shutdown: ${error.message}`);
                process.exit(1);
            });
        };
        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
        // Manejo de errores no capturados
        process.on('uncaughtException', (error) => {
            this.log('error', `Uncaught exception: ${error.message}`);
            this.log('debug', error.stack || '');
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.log('error', `Unhandled rejection at: ${promise}, reason: ${reason}`);
        });
    }
    async start() {
        if (this.isRunning) {
            throw new Error('Scheduler service is already running');
        }
        try {
            // Escribir PID file
            if (this.pidFile) {
                fs.writeFileSync(this.pidFile, process.pid.toString());
                this.log('info', `PID file written: ${this.pidFile} (${process.pid})`);
            }
            // Iniciar servidor HTTP para API REST
            await this.startHttpServer();
            // Cargar y iniciar todos los schedules habilitados
            this.startAllEnabledSchedules();
            this.isRunning = true;
            this.log('info', `Scheduler service started on port ${this.config.port}`);
            this.log('info', `Project path: ${this.config.projectPath}`);
        }
        catch (error) {
            this.log('error', `Failed to start service: ${error}`);
            throw error;
        }
    }
    async stop() {
        if (!this.isRunning)
            return;
        this.log('info', 'Stopping scheduler service...');
        try {
            // Detener el scheduler
            this.scheduler.shutdown();
            // Cerrar servidores
            if (this.wsServer) {
                this.wsServer.close();
            }
            if (this.httpServer) {
                await new Promise((resolve) => {
                    this.httpServer.close(() => resolve());
                });
            }
            // Limpiar PID file
            if (this.pidFile && fs.existsSync(this.pidFile)) {
                fs.unlinkSync(this.pidFile);
                this.log('info', `PID file removed: ${this.pidFile}`);
            }
            this.isRunning = false;
            this.log('info', 'Scheduler service stopped');
        }
        catch (error) {
            this.log('error', `Error stopping service: ${error}`);
            throw error;
        }
    }
    async startHttpServer() {
        this.httpServer = (0, http_1.createServer)((req, res) => {
            this.handleHttpRequest(req, res);
        });
        // WebSocket server para comunicación en tiempo real
        this.wsServer = new ws_1.WebSocketServer({ server: this.httpServer });
        this.wsServer.on('connection', (ws) => {
            this.log('debug', 'WebSocket client connected');
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleWebSocketMessage(ws, data);
                }
                catch (error) {
                    this.log('warn', `Invalid WebSocket message: ${message}`);
                }
            });
            ws.on('close', () => {
                this.log('debug', 'WebSocket client disconnected');
            });
            // Enviar estado inicial
            ws.send(JSON.stringify({
                type: 'status',
                data: this.getStatus()
            }));
        });
        return new Promise((resolve, reject) => {
            this.httpServer.listen(this.config.port, '127.0.0.1', () => {
                resolve();
            }).on('error', reject);
        });
    }
    handleHttpRequest(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        const url = new URL(req.url, `http://localhost:${this.config.port}`);
        const method = req.method;
        const path = url.pathname;
        try {
            if (method === 'GET' && path === '/api/status') {
                this.sendJson(res, this.getStatus());
            }
            else if (method === 'GET' && path === '/api/schedules') {
                this.sendJson(res, this.scheduler.getAllSchedules());
            }
            else if (method === 'POST' && path === '/api/schedules') {
                this.handleCreateSchedule(req, res);
            }
            else if (method === 'PUT' && path.startsWith('/api/schedules/')) {
                const scheduleId = path.split('/').pop();
                this.handleUpdateSchedule(req, res, scheduleId);
            }
            else if (method === 'DELETE' && path.startsWith('/api/schedules/')) {
                const scheduleId = path.split('/').pop();
                this.handleDeleteSchedule(res, scheduleId);
            }
            else if (method === 'POST' && path.startsWith('/api/schedules/') && path.endsWith('/run')) {
                const scheduleId = path.split('/')[3];
                this.handleRunScheduleNow(res, scheduleId);
            }
            else if (method === 'POST' && path.startsWith('/api/schedules/') && path.endsWith('/start')) {
                const scheduleId = path.split('/')[3];
                this.handleStartSchedule(res, scheduleId);
            }
            else if (method === 'POST' && path.startsWith('/api/schedules/') && path.endsWith('/stop')) {
                const scheduleId = path.split('/')[3];
                this.handleStopSchedule(res, scheduleId);
            }
            else {
                this.sendError(res, 404, 'Not found');
            }
        }
        catch (error) {
            this.log('error', `HTTP request error: ${error}`);
            this.sendError(res, 500, 'Internal server error');
        }
    }
    handleCreateSchedule(req, res) {
        let body = '';
        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
            try {
                const scheduleData = JSON.parse(body);
                const scheduleId = this.scheduler.createSchedule(scheduleData);
                const schedule = this.scheduler.getSchedule(scheduleId);
                this.sendJson(res, { success: true, schedule });
            }
            catch (error) {
                this.sendError(res, 400, error.message);
            }
        });
    }
    handleUpdateSchedule(req, res, scheduleId) {
        let body = '';
        req.on('data', (chunk) => body += chunk);
        req.on('end', () => {
            try {
                const updates = JSON.parse(body);
                const success = this.scheduler.updateSchedule(scheduleId, updates);
                if (success) {
                    const schedule = this.scheduler.getSchedule(scheduleId);
                    this.sendJson(res, { success: true, schedule });
                }
                else {
                    this.sendError(res, 404, 'Schedule not found');
                }
            }
            catch (error) {
                this.sendError(res, 400, error.message);
            }
        });
    }
    handleDeleteSchedule(res, scheduleId) {
        const success = this.scheduler.deleteSchedule(scheduleId);
        if (success) {
            this.sendJson(res, { success: true });
        }
        else {
            this.sendError(res, 404, 'Schedule not found');
        }
    }
    async handleRunScheduleNow(res, scheduleId) {
        try {
            const success = await this.scheduler.runScheduleNow(scheduleId);
            this.sendJson(res, { success });
        }
        catch (error) {
            this.sendError(res, 500, error.message);
        }
    }
    handleStartSchedule(res, scheduleId) {
        const success = this.scheduler.startSchedule(scheduleId);
        this.sendJson(res, { success });
    }
    handleStopSchedule(res, scheduleId) {
        const success = this.scheduler.stopSchedule(scheduleId);
        this.sendJson(res, { success });
    }
    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'get-status':
                ws.send(JSON.stringify({
                    type: 'status',
                    data: this.getStatus()
                }));
                break;
            case 'get-schedules':
                ws.send(JSON.stringify({
                    type: 'schedules',
                    data: this.scheduler.getAllSchedules()
                }));
                break;
            default:
                this.log('warn', `Unknown WebSocket message type: ${data.type}`);
        }
    }
    sendJson(res, data) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(data));
    }
    sendError(res, status, message) {
        res.setHeader('Content-Type', 'application/json');
        res.writeHead(status);
        res.end(JSON.stringify({ error: message }));
    }
    broadcastToClients(type, data) {
        if (!this.wsServer)
            return;
        const message = JSON.stringify({ type, data });
        this.wsServer.clients.forEach((client) => {
            if (client.readyState === client.OPEN) {
                client.send(message);
            }
        });
    }
    startAllEnabledSchedules() {
        const schedules = this.scheduler.getAllSchedules();
        const enabledSchedules = schedules.filter(s => s.enabled);
        this.log('info', `Starting ${enabledSchedules.length} enabled schedules`);
        enabledSchedules.forEach(schedule => {
            try {
                this.scheduler.startSchedule(schedule.id);
                this.log('info', `Started schedule: ${schedule.name} (${schedule.cronExpression})`);
            }
            catch (error) {
                this.log('error', `Failed to start schedule ${schedule.name}: ${error}`);
            }
        });
    }
    getStatus() {
        return {
            ...this.scheduler.getStatus(),
            serviceInfo: {
                pid: process.pid,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                platform: process.platform,
                isRunning: this.isRunning,
                projectPath: this.config.projectPath,
                port: this.config.port
            }
        };
    }
    log(level, message) {
        if (this.shouldLog(level)) {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
        }
    }
    shouldLog(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        const currentLevel = levels[this.config.logLevel] || 1;
        const messageLevel = levels[level] || 1;
        return messageLevel >= currentLevel;
    }
}
exports.SchedulerService = SchedulerService;
// Función para ejecutar como servicio independiente
async function runStandaloneScheduler(projectPath) {
    const workingDir = projectPath || process.cwd();
    // Verificar que estamos en un proyecto Playwright válido
    const configPath = path.join(workingDir, 'playwright.config.ts');
    if (!fs.existsSync(configPath)) {
        console.error(`Error: No se encontró playwright.config.ts en ${workingDir}`);
        console.error('Asegúrese de estar en la raíz del proyecto Playwright');
        process.exit(1);
    }
    const config = {
        projectPath: workingDir,
        port: parseInt(process.env.SCHEDULER_PORT || '3001'),
        logLevel: process.env.LOG_LEVEL || 'info',
        pidFile: path.join(workingDir, 'scheduler.pid')
    };
    const service = new SchedulerService(config);
    try {
        await service.start();
        console.log('Scheduler service is running. Press Ctrl+C to stop.');
    }
    catch (error) {
        console.error('Failed to start scheduler service:', error);
        process.exit(1);
    }
}
// Si se ejecuta directamente (no importado)
if (require.main === module) {
    const projectPath = process.argv[2];
    runStandaloneScheduler(projectPath).catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

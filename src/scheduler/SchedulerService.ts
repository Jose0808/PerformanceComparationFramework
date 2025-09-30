#!/usr/bin/env node
import { TestScheduler } from './TestScheduler';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// // Para compatibilidad con CommonJS en el contexto de Electron
// const __filename = typeof window !== 'undefined' ? '' : 
//   import.meta?.url ? fileURLToPath(import.meta.url) : __filename;
// const __dirname = typeof window !== 'undefined' ? '' : 
//   __filename ? path.dirname(__filename) : __dirname;

interface SchedulerServiceConfig {
  projectPath: string;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  pidFile?: string;
}

export class SchedulerService {
  private scheduler: TestScheduler;
  private config: SchedulerServiceConfig;
  private httpServer?: any;
  private wsServer?: WebSocketServer;
  private isRunning: boolean = false;
  private pidFile?: string;

  constructor(config: SchedulerServiceConfig) {
    this.config = config;
    this.scheduler = new TestScheduler(config.projectPath);
    this.pidFile = config.pidFile;
    
    this.setupSchedulerEvents();
    this.setupProcessHandlers();
  }

  private setupSchedulerEvents(): void {
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

  private setupProcessHandlers(): void {
    // Manejo de señales para shutdown graceful
    const gracefulShutdown = (signal: string) => {
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

  async start(): Promise<void> {
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

    } catch (error) {
      this.log('error', `Failed to start service: ${error}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.log('info', 'Stopping scheduler service...');

    try {
      // Detener el scheduler
      this.scheduler.shutdown();

      // Cerrar servidores
      if (this.wsServer) {
        this.wsServer.close();
      }
      
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
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

    } catch (error) {
      this.log('error', `Error stopping service: ${error}`);
      throw error;
    }
  }

  private async startHttpServer(): Promise<void> {
    this.httpServer = createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // WebSocket server para comunicación en tiempo real
    this.wsServer = new WebSocketServer({ server: this.httpServer });
    this.wsServer.on('connection', (ws:any) => {
      this.log('debug', 'WebSocket client connected');
      
      ws.on('message', (message : any) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
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

    return new Promise<void>((resolve, reject) => {
      this.httpServer.listen(this.config.port, '127.0.0.1', () => {
        resolve();
      }).on('error', reject);
    });
  }

  private handleHttpRequest(req: any, res: any): void {
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
        this.handleUpdateSchedule(req, res, scheduleId!);
      }
      else if (method === 'DELETE' && path.startsWith('/api/schedules/')) {
        const scheduleId = path.split('/').pop();
        this.handleDeleteSchedule(res, scheduleId!);
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
    } catch (error) {
      this.log('error', `HTTP request error: ${error}`);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  private handleCreateSchedule(req: any, res: any): void {
    let body = '';
    req.on('data', (chunk: any) => body += chunk);
    req.on('end', () => {
      try {
        const scheduleData = JSON.parse(body);
        const scheduleId = this.scheduler.createSchedule(scheduleData);
        const schedule = this.scheduler.getSchedule(scheduleId);
        this.sendJson(res, { success: true, schedule });
      } catch (error: any) {
        this.sendError(res, 400, error.message);
      }
    });
  }

  private handleUpdateSchedule(req: any, res: any, scheduleId: string): void {
    let body = '';
    req.on('data', (chunk: any) => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const success = this.scheduler.updateSchedule(scheduleId, updates);
        if (success) {
          const schedule = this.scheduler.getSchedule(scheduleId);
          this.sendJson(res, { success: true, schedule });
        } else {
          this.sendError(res, 404, 'Schedule not found');
        }
      } catch (error: any) {
        this.sendError(res, 400, error.message);
      }
    });
  }

  private handleDeleteSchedule(res: any, scheduleId: string): void {
    const success = this.scheduler.deleteSchedule(scheduleId);
    if (success) {
      this.sendJson(res, { success: true });
    } else {
      this.sendError(res, 404, 'Schedule not found');
    }
  }

  private async handleRunScheduleNow(res: any, scheduleId: string): Promise<void> {
    try {
      const success = await this.scheduler.runScheduleNow(scheduleId);
      this.sendJson(res, { success });
    } catch (error: any) {
      this.sendError(res, 500, error.message);
    }
  }

  private handleStartSchedule(res: any, scheduleId: string): void {
    const success = this.scheduler.startSchedule(scheduleId);
    this.sendJson(res, { success });
  }

  private handleStopSchedule(res: any, scheduleId: string): void {
    const success = this.scheduler.stopSchedule(scheduleId);
    this.sendJson(res, { success });
  }

  private handleWebSocketMessage(ws: any, data: any): void {
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

  private sendJson(res: any, data: any): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify(data));
  }

  private sendError(res: any, status: number, message: string): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(status);
    res.end(JSON.stringify({ error: message }));
  }

  private broadcastToClients(type: string, data: any): void {
    if (!this.wsServer) return;

    const message = JSON.stringify({ type, data });
    this.wsServer.clients.forEach((client:any) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  private startAllEnabledSchedules(): void {
    const schedules = this.scheduler.getAllSchedules();
    const enabledSchedules = schedules.filter(s => s.enabled);
    
    this.log('info', `Starting ${enabledSchedules.length} enabled schedules`);
    
    enabledSchedules.forEach(schedule => {
      try {
        this.scheduler.startSchedule(schedule.id);
        this.log('info', `Started schedule: ${schedule.name} (${schedule.cronExpression})`);
      } catch (error) {
        this.log('error', `Failed to start schedule ${schedule.name}: ${error}`);
      }
    });
  }

  private getStatus() {
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

  private log(level: string, message: string): void {
    if (this.shouldLog(level)) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = { debug: 0, info: 1, warn: 2, error: 3 };
    const currentLevel = levels[this.config.logLevel as keyof typeof levels] || 1;
    const messageLevel = levels[level as keyof typeof levels] || 1;
    return messageLevel >= currentLevel;
  }
}

// Función para ejecutar como servicio independiente
export async function runStandaloneScheduler(projectPath?: string): Promise<void> {
  const workingDir = projectPath || process.cwd();
  
  // Verificar que estamos en un proyecto Playwright válido
  const configPath = path.join(workingDir, 'playwright.config.ts');
  if (!fs.existsSync(configPath)) {
    console.error(`Error: No se encontró playwright.config.ts en ${workingDir}`);
    console.error('Asegúrese de estar en la raíz del proyecto Playwright');
    process.exit(1);
  }

  const config: SchedulerServiceConfig = {
    projectPath: workingDir,
    port: parseInt(process.env.SCHEDULER_PORT || '3001'),
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    pidFile: path.join(workingDir, 'scheduler.pid')
  };

  const service = new SchedulerService(config);

  try {
    await service.start();
    console.log('Scheduler service is running. Press Ctrl+C to stop.');
  } catch (error) {
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
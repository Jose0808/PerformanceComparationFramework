import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

export interface SchedulerClientConfig {
  projectPath: string;
  servicePort: number;
  serviceHost: string;
}

export interface ScheduleCreateRequest {
  name: string;
  cronExpression: string;
  testPattern?: string;
  testFiles?: string[];
  enabled: boolean;
  options?: {
    timeout?: number;
    retries?: number;
    browsers?: string[];
  };
}

export class SchedulerClient extends EventEmitter {
  private config: SchedulerClientConfig;
  private ws: any;
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  constructor(config: SchedulerClientConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    try {
      await this.connectWebSocket();
    } catch (error) {
      console.log('Service not running, attempting to start...');
      await this.startServicePersistent();
      await new Promise(resolve => setTimeout(resolve, 3000));
      await this.connectWebSocket();
    }
  }

  // Iniciar servicio como proceso completamente independiente
  private async startServicePersistent(): Promise<void> {
    const servicePath = path.join(__dirname, 'SchedulerService.js');
    
    if (!fs.existsSync(servicePath)) {
      throw new Error(`Scheduler service not found: ${servicePath}`);
    }

    // Verificar si ya hay un servicio corriendo
    const pidFile = path.join(this.config.projectPath, 'scheduler.pid');
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
      try {
        process.kill(pid, 0);
        console.log(`Scheduler service already running (PID: ${pid})`);
        return;
      } catch (error) {
        fs.unlinkSync(pidFile);
      }
    }

    // Crear logs directory
    const logsDir = path.join(this.config.projectPath, 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const logFile = path.join(logsDir, 'scheduler-service.log');
    const errorLogFile = path.join(logsDir, 'scheduler-service-error.log');

    // Abrir archivos de log
    const outLog = fs.openSync(logFile, 'a');
    const errLog = fs.openSync(errorLogFile, 'a');

    try {
      // Iniciar proceso completamente desacoplado
      const serviceProcess = spawn(process.execPath, [
        servicePath,
        this.config.projectPath
      ], {
        detached: true,
        stdio: ['ignore', outLog, errLog],
        env: {
          ...process.env,
          SCHEDULER_PORT: this.config.servicePort.toString(),
          LOG_LEVEL: 'info',
          NODE_ENV: 'production'
        },
        cwd: this.config.projectPath
      });

      // Desreferenciar para permitir que el padre termine
      serviceProcess.unref();

      // Esperar a que se escriba el PID file
      await this.waitForPidFile(pidFile, 5000);

      console.log('Scheduler service started as independent process');
      this.emit('service-started');
      
    } catch (error) {
      fs.closeSync(outLog);
      fs.closeSync(errLog);
      throw error;
    } finally {
      // Cerrar descriptores de archivo
      setTimeout(() => {
        try {
          fs.closeSync(outLog);
          fs.closeSync(errLog);
        } catch (e) {
          // Ignorar errores al cerrar
        }
      }, 100);
    }
  }

  private async waitForPidFile(pidFile: string, timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (fs.existsSync(pidFile)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for service to start');
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const WebSocket = typeof window !== 'undefined' && window.WebSocket 
          ? window.WebSocket 
          : require('ws');

        this.ws = new WebSocket(`ws://${this.config.serviceHost}:${this.config.servicePort}`);

        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
          reject(new Error('Connection timeout'));
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('Connected to scheduler service');
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event: any) => {
          try {
            const message = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('Invalid message from service:', event.data);
          }
        };

        this.ws.onclose = () => {
          console.log('Disconnected from scheduler service');
          this.emit('disconnected');
          this.scheduleReconnect();
        };

        this.ws.onerror = (error: any) => {
          clearTimeout(timeout);
          console.error('WebSocket error:', error);
          this.emit('connection-error', error);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(message: any): void {
    switch (message.type) {
      case 'status':
        this.emit('status-update', message.data);
        break;
      case 'schedules':
        this.emit('schedules-update', message.data);
        break;
      case 'test-run-started':
        this.emit('test-run-started', message.data);
        break;
      case 'test-run-completed':
        this.emit('test-run-completed', message.data);
        break;
      case 'test-output':
        this.emit('test-output', message.data);
        break;
      case 'test-error':
        this.emit('test-error', message.data);
        break;
      case 'schedule-started':
        this.emit('schedule-started', message.data);
        break;
      case 'schedule-stopped':
        this.emit('schedule-stopped', message.data);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      this.emit('connection-failed');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connectWebSocket();
      } catch (error) {
        console.log('Reconnection failed:', error);
        this.scheduleReconnect();
      }
    }, delay);
  }

  // API Methods
  async getStatus(): Promise<any> {
    return this.httpRequest('GET', '/api/status');
  }

  async getSchedules(): Promise<any[]> {
    return this.httpRequest('GET', '/api/schedules');
  }

  async createSchedule(scheduleData: ScheduleCreateRequest): Promise<any> {
    return this.httpRequest('POST', '/api/schedules', scheduleData);
  }

  async updateSchedule(scheduleId: string, updates: Partial<ScheduleCreateRequest>): Promise<any> {
    return this.httpRequest('PUT', `/api/schedules/${scheduleId}`, updates);
  }

  async deleteSchedule(scheduleId: string): Promise<any> {
    return this.httpRequest('DELETE', `/api/schedules/${scheduleId}`);
  }

  async runScheduleNow(scheduleId: string): Promise<any> {
    return this.httpRequest('POST', `/api/schedules/${scheduleId}/run`);
  }

  async startSchedule(scheduleId: string): Promise<any> {
    return this.httpRequest('POST', `/api/schedules/${scheduleId}/start`);
  }

  async stopSchedule(scheduleId: string): Promise<any> {
    return this.httpRequest('POST', `/api/schedules/${scheduleId}/stop`);
  }

  // Nuevo: Obtener lista de tests disponibles
  async getAvailableTests(): Promise<string[]> {
    return this.httpRequest('GET', '/api/tests');
  }

  private async httpRequest(method: string, path: string, body?: any): Promise<any> {
    const url = `http://${this.config.serviceHost}:${this.config.servicePort}${path}`;
    
    const options: any = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = typeof fetch !== 'undefined' 
        ? await fetch(url, options)
        : await this.nodeFetch(url, options);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`HTTP request failed: ${method} ${path}`, error);
      throw error;
    }
  }

  private async nodeFetch(url: string, options: any): Promise<any> {
    const http = require('http');
    const urlParsed = new URL(url);

    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: urlParsed.hostname,
        port: urlParsed.port,
        path: urlParsed.pathname + urlParsed.search,
        method: options.method,
        headers: options.headers
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: any) => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            json: async () => JSON.parse(data)
          });
        });
      });

      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // NO detener el servicio al cerrar Electron - debe persistir
  async checkServiceStatus(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.serviceInfo.isRunning;
    } catch (error) {
      return false;
    }
  }
}
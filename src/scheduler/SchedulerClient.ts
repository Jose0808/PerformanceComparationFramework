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
  enabled: boolean;
  options?: {
    timeout?: number;
    retries?: number;
    browsers?: string[];
  };
}

export class SchedulerClient extends EventEmitter {
  private config: SchedulerClientConfig;
  private ws: any; // WebSocket
  private reconnectTimer?: NodeJS.Timeout;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private serviceProcess?: ChildProcess;
  private isServiceManaged: boolean = false;

  constructor(config: SchedulerClientConfig) {
    super();
    this.config = config;
  }

  // Conectar al servicio (o iniciarlo si no está corriendo)
  async connect(): Promise<void> {
    try {
      // Intentar conectar primero
      await this.connectWebSocket();
    } catch (error) {
      console.log('Service not running, attempting to start...');
      // Si falla, intentar iniciar el servicio
      await this.startService();
      // Esperar un poco y intentar conectar nuevamente
      await new Promise(resolve => setTimeout(resolve, 2000));
      await this.connectWebSocket();
    }
  }

  // Iniciar el servicio en segundo plano
  private async startService(): Promise<void> {    
    // const servicePath = path.join(__dirname.replace("src","dist\\src"), 'SchedulerService.js');
    const servicePath = path.join(__dirname, 'SchedulerService.js');
    
    if (!fs.existsSync(servicePath)) {
      throw new Error(`Scheduler service not found: ${servicePath}`);
    }

    try {
      // Verificar si ya hay un servicio corriendo
      const pidFile = path.join(this.config.projectPath, 'scheduler.pid');
      if (fs.existsSync(pidFile)) {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf8'));
        try {
          process.kill(pid, 0); // Verificar si el proceso existe
          console.log(`Scheduler service already running (PID: ${pid})`);
          return;
        } catch (error) {
          // Proceso no existe, limpiar PID file
          fs.unlinkSync(pidFile);
        }
      }

      // Iniciar nuevo proceso
      this.serviceProcess = spawn(process.execPath, [servicePath, this.config.projectPath], {
        detached: true,
        stdio: 'pipe',
        env: {
          ...process.env,
          SCHEDULER_PORT: this.config.servicePort.toString(),
          LOG_LEVEL: 'info'
        }
      });

      this.isServiceManaged = true;

      // Manejar output del servicio
      this.serviceProcess.stdout?.on('data', (data) => {
        console.log(`[Scheduler Service] ${data}`);
        this.emit('service-output', data.toString());
      });

      this.serviceProcess.stderr?.on('data', (data) => {
        console.error(`[Scheduler Service Error] ${data}`);
        this.emit('service-error', data.toString());
      });

      this.serviceProcess.on('close', (code) => {
        console.log(`Scheduler service exited with code ${code}`);
        this.emit('service-stopped', code);
        this.serviceProcess = undefined;
      });

      // Permitir que el proceso continúe en segundo plano
      this.serviceProcess.unref();

      console.log('Scheduler service started');
      this.emit('service-started');
      
    } catch (error) {
      console.error('Failed to start scheduler service:', error);
      throw error;
    }
  }

  // Conectar WebSocket
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // En el contexto de Electron, usar WebSocket nativo o una implementación compatible
        const WebSocket = typeof window !== 'undefined' && window.WebSocket 
          ? window.WebSocket 
          : require('ws');

        this.ws = new WebSocket(`ws://${this.config.serviceHost}:${this.config.servicePort}`);

        this.ws.onopen = () => {
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
          console.error('WebSocket error:', error);
          this.emit('connection-error', error);
          reject(error);
        };

        // Timeout para la conexión
        const timeout = setTimeout(() => {
          this.ws.close();
          reject(new Error('Connection timeout'));
        }, 5000);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          console.log('Connected to scheduler service');
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  // Manejar mensajes del servicio
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

  // Reconexión automática
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

  // API Methods para interactuar con el servicio

  // Obtener estado del servicio
  async getStatus(): Promise<any> {
    return this.httpRequest('GET', '/api/status');
  }

  // Obtener todos los schedules
  async getSchedules(): Promise<any[]> {
    return this.httpRequest('GET', '/api/schedules');
  }

  // Crear nuevo schedule
  async createSchedule(scheduleData: ScheduleCreateRequest): Promise<any> {
    return this.httpRequest('POST', '/api/schedules', scheduleData);
  }

  // Actualizar schedule
  async updateSchedule(scheduleId: string, updates: Partial<ScheduleCreateRequest>): Promise<any> {
    return this.httpRequest('PUT', `/api/schedules/${scheduleId}`, updates);
  }

  // Eliminar schedule
  async deleteSchedule(scheduleId: string): Promise<any> {
    return this.httpRequest('DELETE', `/api/schedules/${scheduleId}`);
  }

  // Ejecutar schedule manualmente
  async runScheduleNow(scheduleId: string): Promise<any> {
    return this.httpRequest('POST', `/api/schedules/${scheduleId}/run`);
  }

  // Iniciar schedule
  async startSchedule(scheduleId: string): Promise<any> {
    return this.httpRequest('POST', `/api/schedules/${scheduleId}/start`);
  }

  // Detener schedule
  async stopSchedule(scheduleId: string): Promise<any> {
    return this.httpRequest('POST', `/api/schedules/${scheduleId}/stop`);
  }

  // Realizar petición HTTP al servicio
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
      // En Electron, usar fetch o implementación compatible
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

  // Implementación de fetch para Node.js si no está disponible
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

  // Solicitar actualización de datos
  requestStatus(): void {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify({ type: 'get-status' }));
    }
  }

  requestSchedules(): void {
    if (this.ws && this.ws.readyState === this.ws.OPEN) {
      this.ws.send(JSON.stringify({ type: 'get-schedules' }));
    }
  }

  // Desconectar
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

  // Detener servicio si lo estamos manejando
  async stopService(): Promise<void> {
    if (this.serviceProcess && !this.serviceProcess.killed) {
      console.log('Stopping managed scheduler service...');
      
      return new Promise((resolve) => {
        this.serviceProcess!.on('close', () => {
          resolve();
        });
        
        this.serviceProcess!.kill('SIGTERM');
        
        // Forzar kill después de 10 segundos
        setTimeout(() => {
          if (this.serviceProcess && !this.serviceProcess.killed) {
            this.serviceProcess.kill('SIGKILL');
          }
          resolve();
        }, 10000);
      });
    }
  }

  // Obtener patrones de expresiones cron comunes
  static getCommonCronPatterns(): Array<{label: string, value: string, description: string}> {
    return [
      { label: 'Cada 5 minutos', value: '*/5 * * * *', description: 'Ejecutar cada 5 minutos' },
      { label: 'Cada 15 minutos', value: '*/15 * * * *', description: 'Ejecutar cada 15 minutos' },
      { label: 'Cada 30 minutos', value: '*/30 * * * *', description: 'Ejecutar cada 30 minutos' },
      { label: 'Cada hora', value: '0 * * * *', description: 'Ejecutar al inicio de cada hora' },
      { label: 'Cada 2 horas', value: '0 */2 * * *', description: 'Ejecutar cada 2 horas' },
      { label: 'Cada 6 horas', value: '0 */6 * * *', description: 'Ejecutar cada 6 horas' },
      { label: 'Diario a medianoche', value: '0 0 * * *', description: 'Ejecutar diariamente a las 00:00' },
      { label: 'Diario a las 9 AM', value: '0 9 * * *', description: 'Ejecutar diariamente a las 09:00' },
      { label: 'Diario a las 6 PM', value: '0 18 * * *', description: 'Ejecutar diariamente a las 18:00' },
      { label: 'Lunes a Viernes 9 AM', value: '0 9 * * 1-5', description: 'Ejecutar de lunes a viernes a las 09:00' },
      { label: 'Fines de semana', value: '0 10 * * 6,0', description: 'Ejecutar sábados y domingos a las 10:00' },
      { label: 'Semanal (Lunes)', value: '0 9 * * 1', description: 'Ejecutar todos los lunes a las 09:00' },
      { label: 'Mensual (día 1)', value: '0 9 1 * *', description: 'Ejecutar el día 1 de cada mes a las 09:00' }
    ];
  }
}
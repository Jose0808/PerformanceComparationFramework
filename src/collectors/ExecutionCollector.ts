import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ExecutionRun, ExecutionSession } from '../types/executionTypes';
import { TestExecution } from '../types/timer.types';

export class ExecutionCollector {
  private static instance: ExecutionCollector;
  private sessions: Map<string, ExecutionSession> = new Map();
  private currentSessionId: string | null = null;
  private storageDir: string;

  private constructor(storageDir: string = './performance-data') {
    this.storageDir = storageDir;
    this.ensureStorageDir();
    this.loadExistingSessions();
  }

  static getInstance(storageDir?: string): ExecutionCollector {
    if (!ExecutionCollector.instance) {
      ExecutionCollector.instance = new ExecutionCollector(storageDir);
    }
    return ExecutionCollector.instance;
  }

  // Iniciar nueva sesión de pruebas
  startSession(testSuiteName: string): string {
    const sessionId = `${testSuiteName}-${Date.now()}`;
    const session: ExecutionSession = {
      sessionId,
      testSuiteName,
      startTime: new Date(),
      runs: [],
      totalRuns: 0,
      completedRuns: 0
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    this.persistSession(session);

    return sessionId;
  }

  // Finalizar sesión actual
  endSession(): void {
    if (this.currentSessionId) {
      const session = this.sessions.get(this.currentSessionId);
      if (session) {
        session.endTime = new Date();
        this.persistSession(session);
      }
      this.currentSessionId = null;
    }
  }

  // Añadir ejecución a la sesión actual
  addExecution(
    appName: string,
    flowName: string,
    execution: TestExecution,
    iteration: number,
    metadata?: ExecutionRun['metadata']
  ): void {
    if (!this.currentSessionId) {
      throw new Error('No hay sesión activa. Llama startSession() primero.');
    }

    const session = this.sessions.get(this.currentSessionId);
    if (!session) {
      throw new Error(`Sesión ${this.currentSessionId} no encontrada.`);
    }

    const run: ExecutionRun = {
      appName,
      flowName,
      iteration,
      sessionId: this.currentSessionId,
      execution: {
        ...execution,
      },
      metadata
    };

    session.runs.push(run);
    session.completedRuns++;

    // Persistir inmediatamente para evitar pérdida de datos
    this.persistSession(session);
  }

  // Obtener datos de sesión específica
  getSession(sessionId: string): ExecutionSession | undefined {
    return this.sessions.get(sessionId);
  }

  // Obtener sesión actual
  getCurrentSession(): ExecutionSession | undefined {
    return this.currentSessionId ? this.sessions.get(this.currentSessionId) : undefined;
  }

  // Obtener todas las ejecuciones de una app específica
  getExecutionsByApp(appName: string, sessionId?: string): ExecutionRun[] {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return [];

    const session = this.sessions.get(targetSessionId);
    return session ? session.runs.filter(run => run.appName === appName) : [];
  }

  // Obtener todas las ejecuciones de un flujo específico
  getExecutionsByFlow(flowName: string, sessionId?: string): ExecutionRun[] {
    const targetSessionId = sessionId || this.currentSessionId;
    if (!targetSessionId) return [];

    const session = this.sessions.get(targetSessionId);
    return session ? session.runs.filter(run => run.flowName === flowName) : [];
  }

  // Obtener todas las ejecuciones agrupadas por app
  getExecutionsGroupedByApp(sessionId?: string): Map<string, ExecutionRun[]> {
    const targetSessionId = sessionId || this.currentSessionId;
    const grouped = new Map<string, ExecutionRun[]>();

    if (!targetSessionId) return grouped;

    const session = this.sessions.get(targetSessionId);
    if (!session) return grouped;

    session.runs.forEach(run => {
      if (!grouped.has(run.appName)) {
        grouped.set(run.appName, []);
      }
      grouped.get(run.appName)!.push(run);
    });

    return grouped;
  }

  // Limpiar datos antiguos (mantener solo últimas N sesiones)
  cleanup(keepLastNSessions: number = 10): void {
    const sessions = Array.from(this.sessions.entries())
      .sort(([, a], [, b]) => b.startTime.getTime() - a.startTime.getTime());

    if (sessions.length <= keepLastNSessions) return;

    const toDelete = sessions.slice(keepLastNSessions);
    toDelete.forEach(([sessionId]) => {
      this.sessions.delete(sessionId);
      this.deletePersistedSession(sessionId);
    });
  }

  // Exportar datos para análisis externo
  exportSession(sessionId: string, format: 'json' | 'csv' = 'json'): string {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Sesión ${sessionId} no encontrada.`);
    }

    if (format === 'json') {
      return JSON.stringify(session, null, 2);
    }

    // Formato CSV simple para análisis rápido
    const headers = ['appName', 'flowName', 'iteration', 'totalDuration', 'stepCount', 'timestamp'];
    const rows = session.runs.map(run => [
      run.appName,
      run.flowName,
      run.iteration,
      run.execution.totalDuration,
      run.execution.steps.length,
      run.execution.timestamp.toISOString()
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private ensureStorageDir(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getSessionFilePath(sessionId: string): string {
    return join(this.storageDir, `${sessionId}.json`);
  }

  private persistSession(session: ExecutionSession): void {
    try {
      const filePath = this.getSessionFilePath(session.sessionId);
      writeFileSync(filePath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.error(`Error persistiendo sesión ${session.sessionId}:`, error);
    }
  }

  private loadExistingSessions(): void {
    try {
      if (!existsSync(this.storageDir)) return;

      const files = require('fs').readdirSync(this.storageDir);
      const sessionFiles = files.filter((f: string) => f.endsWith('.json'));

      sessionFiles.forEach((file: string) => {
        try {
          const filePath = join(this.storageDir, file);
          const data = readFileSync(filePath, 'utf8');
          const session = JSON.parse(data) as ExecutionSession;

          // Convertir timestamps de string a Date
          session.startTime = new Date(session.startTime);
          if (session.endTime) {
            session.endTime = new Date(session.endTime);
          }
          session.runs.forEach(run => {
            run.execution.timestamp = new Date(run.execution.timestamp);
          });

          this.sessions.set(session.sessionId, session);
        } catch (error) {
          console.warn(`Error cargando sesión desde ${file}:`, error);
        }
      });
    } catch (error) {
      console.error('Error cargando sesiones existentes:', error);
    }
  }

  private deletePersistedSession(sessionId: string): void {
    try {
      const filePath = this.getSessionFilePath(sessionId);
      if (existsSync(filePath)) {
        require('fs').unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error eliminando archivo de sesión ${sessionId}:`, error);
    }
  }
}
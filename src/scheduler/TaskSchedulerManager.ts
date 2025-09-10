import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { SchedulerProfile, SchedulerStatus } from '../types/scheduler.types';

const execAsync = promisify(exec);

export class TaskSchedulerManager {
    private static instance: TaskSchedulerManager;
    private readonly taskPrefix = 'LatencyMonitor_';
    private readonly statusFile = path.join(process.cwd(), 'data', 'scheduler-status.json');
    private readonly profilesFile = path.join(process.cwd(), 'data', 'scheduler-profiles.json');

    private constructor() {
        this.ensureDataDirectory();
    }

    static getInstance(): TaskSchedulerManager {
        if (!TaskSchedulerManager.instance) {
            TaskSchedulerManager.instance = new TaskSchedulerManager();
        }
        return TaskSchedulerManager.instance;
    }

    private ensureDataDirectory(): void {
        const dataDir = path.dirname(this.statusFile);
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    /**
     * Crea o actualiza una tarea programada en Windows Task Scheduler
     */
    async createOrUpdateTask(profile: SchedulerProfile): Promise<{ success: boolean; message: string }> {
        try {
            const taskName = this.getTaskName(profile.id);

            // Primero eliminar la tarea si existe
            await this.deleteTaskIfExists(taskName);

            // Construir comando de ejecución
            const executorPath = path.join(process.cwd(), 'dist', 'scheduler', 'SchedulerExecutor.js');
            const nodePath = process.execPath;
            const taskCommand = `"${nodePath}" "${executorPath}" --profile="${profile.id}"`;

            // Construir comando schtasks
            const schtasksCommand = this.buildSchtasksCommand(taskName, taskCommand, profile);

            console.log('Creating scheduled task:', taskName);
            console.log('Command:', schtasksCommand);

            const { stdout, stderr } = await execAsync(schtasksCommand);

            if (stderr && !stderr.includes('SUCCESS')) {
                throw new Error(`Task creation failed: ${stderr}`);
            }

            // Actualizar estado
            await this.updateSchedulerStatus({
                isRunning: true,
                currentProfile: profile,
                nextExecution: this.calculateNextExecution(profile),
                taskSchedulerTaskName: taskName
            });

            console.log(`Task "${taskName}" created successfully`);
            return { success: true, message: `Tarea programada creada: ${taskName}` };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('Error creating scheduled task:', errorMessage);
            return { success: false, message: `Error al crear tarea: ${errorMessage}` };
        }
    }

    /**
     * Elimina una tarea programada
     */
    async deleteTask(profileId: string): Promise<{ success: boolean; message: string }> {
        try {
            const taskName = this.getTaskName(profileId);
            const result = await this.deleteTaskIfExists(taskName);

            if (result.deleted) {
                await this.updateSchedulerStatus({
                    isRunning: false,
                    currentProfile: undefined,
                    nextExecution: undefined,
                    taskSchedulerTaskName: undefined
                });

                return { success: true, message: `Tarea eliminada: ${taskName}` };
            } else {
                return { success: true, message: 'La tarea no existía' };
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Error al eliminar tarea: ${errorMessage}` };
        }
    }

    /**
     * Ejecuta una tarea inmediatamente
     */
    async runTaskNow(profileId: string): Promise<{ success: boolean; message: string }> {
        try {
            const taskName = this.getTaskName(profileId);

            // Verificar que la tarea existe
            const exists = await this.taskExists(taskName);
            if (!exists) {
                return { success: false, message: 'La tarea no existe' };
            }

            const command = `schtasks /run /tn "${taskName}"`;
            const { stdout, stderr } = await execAsync(command);

            if (stderr && !stderr.includes('SUCCESS')) {
                throw new Error(stderr);
            }

            return { success: true, message: 'Tarea ejecutada inmediatamente' };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Error al ejecutar tarea: ${errorMessage}` };
        }
    }

    /**
     * Obtiene el estado actual del scheduler
     */
    async getSchedulerStatus(): Promise<SchedulerStatus> {
        try {
            if (fs.existsSync(this.statusFile)) {
                const data = fs.readFileSync(this.statusFile, 'utf-8');
                const status = JSON.parse(data);

                // Verificar si la tarea sigue existiendo en Windows
                if (status.taskSchedulerTaskName) {
                    const exists = await this.taskExists(status.taskSchedulerTaskName);
                    if (!exists) {
                        status.isRunning = false;
                        status.taskSchedulerTaskName = undefined;
                        await this.updateSchedulerStatus(status);
                    }
                }

                return status;
            }
        } catch (error) {
            console.error('Error reading scheduler status:', error);
        }

        return {
            isRunning: false,
            statistics: undefined,
            currentProfile: undefined,
            nextExecution: undefined,
            lastExecution: undefined,
            taskSchedulerTaskName: undefined
        };
    }

    /**
     * Lista todas las tareas del scheduler activas
     */
    async listActiveTasks(): Promise<Array<{ taskName: string; status: string; nextRun: string }>> {
        try {
            const command = `schtasks /query /fo csv | findstr "${this.taskPrefix}"`;
            const { stdout } = await execAsync(command);

            const lines = stdout.trim().split('\n');
            const tasks = [];

            for (const line of lines) {
                if (line.includes(this.taskPrefix)) {
                    const columns = line.split(',').map(col => col.replace(/"/g, ''));
                    tasks.push({
                        taskName: columns[0] || '',
                        nextRun: columns[1] || '',
                        status: columns[2] || ''
                    });
                }
            }

            return tasks;

        } catch (error) {
            console.error('Error listing tasks:', error);
            return [];
        }
    }

    /**
     * Pausa todas las tareas del scheduler
     */
    async pauseAllTasks(): Promise<{ success: boolean; message: string }> {
        try {
            const activeTasks = await this.listActiveTasks();

            for (const task of activeTasks) {
                const command = `schtasks /change /tn "${task.taskName}" /disable`;
                await execAsync(command);
            }

            await this.updateSchedulerStatus({ isRunning: false });
            return { success: true, message: `${activeTasks.length} tareas pausadas` };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Error al pausar tareas: ${errorMessage}` };
        }
    }

    /**
     * Reanuda todas las tareas pausadas
     */
    async resumeAllTasks(): Promise<{ success: boolean; message: string }> {
        try {
            const activeTasks = await this.listActiveTasks();

            for (const task of activeTasks) {
                const command = `schtasks /change /tn "${task.taskName}" /enable`;
                await execAsync(command);
            }

            await this.updateSchedulerStatus({ isRunning: true });
            return { success: true, message: `${activeTasks.length} tareas reanudadas` };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return { success: false, message: `Error al reanudar tareas: ${errorMessage}` };
        }
    }

    // ============================================================================
    // MÉTODOS PRIVADOS
    // ============================================================================

    private getTaskName(profileId: string): string {
        return `${this.taskPrefix}${profileId}`;
    }

    private async taskExists(taskName: string): Promise<boolean> {
        try {
            const command = `schtasks /query /tn "${taskName}"`;
            await execAsync(command);
            return true;
        } catch {
            return false;
        }
    }

    private async deleteTaskIfExists(taskName: string): Promise<{ deleted: boolean }> {
        try {
            const exists = await this.taskExists(taskName);
            if (exists) {
                const command = `schtasks /delete /tn "${taskName}" /f`;
                await execAsync(command);
                console.log(`Task "${taskName}" deleted`);
                return { deleted: true };
            }
            return { deleted: false };
        } catch (error) {
            console.error(`Error deleting task ${taskName}:`, error);
            throw error;
        }
    }

    private buildSchtasksCommand(taskName: string, taskCommand: string, profile: SchedulerProfile): string {
        const { schedule } = profile;

        // Validar parámetros
        if (!schedule.intervalMinutes || schedule.intervalMinutes < 1) {
            throw new Error('El intervalo de minutos debe ser al menos 1');
        }

        // Convertir días de semana a formato Windows
        const daysMap: { [key: number]: string } = {
            0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED',
            4: 'THU', 5: 'FRI', 6: 'SAT'
        };

        const days = schedule.daysOfWeek.map(day => daysMap[day]).join(',');

        // Fechas de inicio y fin (1 año de duración por defecto)
        const startDate = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
        const endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            .toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

        let command = `schtasks /create /tn "${taskName}" /tr "${taskCommand}"`;

        // LÓGICA MEJORADA: Determinar el tipo de programación
        const hasSpecificDays = schedule.daysOfWeek.length > 0 && schedule.daysOfWeek.length < 7;

        if (hasSpecificDays) {
            // Programación semanal con días específicos
            command += ` /sc weekly /mo 1 /d ${days}`;

            // Para programación semanal, podemos usar intervalo en minutos dentro del día
            // usando startTime y endTime para limitar las horas de ejecución
            if (schedule.startTime) {
                command += ` /st ${schedule.startTime}`;
            }
            if (schedule.endTime) {
                command += ` /et ${schedule.endTime}`;
            }

        } else {
            // Programación por minutos (todos los días o sin días específicos)
            command += ` /sc minute /mo ${schedule.intervalMinutes}`;

            // Para programación por minutos, también podemos limitar las horas
            if (schedule.startTime) {
                command += ` /st ${schedule.startTime}`;
            }
            if (schedule.endTime) {
                command += ` /et ${schedule.endTime}`;
            }
        }

        // Añadir fechas de inicio y fin
        command += ` /sd ${startDate} /ed ${endDate}`;

        // Configuración adicional
        command += ' /f'; // Forzar creación si existe
        command += ' /ru SYSTEM'; // Ejecutar como SYSTEM

        console.log('Comando schtasks construido:', command);
        return command;
    }

    private calculateNextExecution(profile: SchedulerProfile): Date {
        const now = new Date();
        const { schedule } = profile;

        // Parsear horario de inicio
        const [startHour, startMinute] = schedule.startTime.split(':').map(Number);
        const [endHour, endMinute] = schedule.endTime.split(':').map(Number);

        // Calcular próxima ejecución
        const nextExecution = new Date(now);
        // nextExecution.setHours(startHour, startMinute, 0, 0);

        // Si ya pasó la hora de inicio de hoy, ir al siguiente día válido
        if (nextExecution <= now || now.getHours() > endHour ||
            (now.getHours() === endHour && now.getMinutes() > endMinute)) {
            nextExecution.setDate(nextExecution.getDate() + 1);
            nextExecution.setHours(startHour, startMinute, 0, 0);
        }

        // Ajustar al próximo día válido de la semana
        while (!schedule.daysOfWeek.includes(nextExecution.getDay())) {
            nextExecution.setDate(nextExecution.getDate() + 1);
        }

        return nextExecution;
    }

    private async updateSchedulerStatus(updates: Partial<SchedulerStatus>): Promise<void> {
        try {
            const currentStatus = await this.getSchedulerStatus();
            const newStatus = { ...currentStatus, ...updates };

            fs.writeFileSync(this.statusFile, JSON.stringify(newStatus, null, 2));
        } catch (error) {
            console.error('Error updating scheduler status:', error);
        }
    }

    /**
     * Método de utilidad para testing/debugging
     */
    async getTaskDetails(profileId: string): Promise<any> {
        try {
            const taskName = this.getTaskName(profileId);
            const command = `schtasks /query /tn "${taskName}" /fo list /v`;
            const { stdout } = await execAsync(command);
            return stdout;
        } catch (error) {
            return null;
        }
    }

    /**
     * Cleanup method - elimina todas las tareas del scheduler
     */
    async cleanupAllTasks(): Promise<{ success: boolean; message: string; deletedTasks: string[] }> {
        try {
            const activeTasks = await this.listActiveTasks();
            const deletedTasks: string[] = [];

            for (const task of activeTasks) {
                try {
                    const command = `schtasks /delete /tn "${task.taskName}" /f`;
                    await execAsync(command);
                    deletedTasks.push(task.taskName);
                } catch (error) {
                    console.error(`Error deleting task ${task.taskName}:`, error);
                }
            }

            // Limpiar estado
            await this.updateSchedulerStatus({
                isRunning: false,
                currentProfile: undefined,
                nextExecution: undefined,
                taskSchedulerTaskName: undefined
            });

            return {
                success: true,
                message: `${deletedTasks.length} tareas eliminadas`,
                deletedTasks
            };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Error en cleanup: ${errorMessage}`,
                deletedTasks: []
            };
        }
    }
}
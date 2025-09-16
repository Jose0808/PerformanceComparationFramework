import fs from 'fs';
import path from 'path';
import { Browser, BrowserContext } from '@playwright/test';
import { AppConfig } from '../types/config.types';

/**
 * Maneja la persistencia de sesiones por aplicación usando storageState.json
 * Permite cachear el login y reutilizarlo en múltiples flujos/iteraciones
 */
export class SessionCache {
  private static cacheDir = path.resolve('./cache');

  /**
   * Devuelve la ruta del archivo de storageState de una app
   */
  static getStatePath(appName: string): string {
    return path.join(this.cacheDir, `${appName}-state.json`);
  }

  /**
   * Carga un contexto de navegador con storageState cacheado si existe.
   * Si no existe, crea un contexto limpio.
   */
  static async loadContext(browser: Browser, appConfig: AppConfig): Promise<BrowserContext> {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const statePath = this.getStatePath(appConfig.name);

    const context = await browser.newContext({
      storageState: fs.existsSync(statePath) ? statePath : undefined
    });

    console.log(
      fs.existsSync(statePath)
        ? `📂 Sesión cacheada cargada para ${appConfig.name}`
        : `🆕 No había sesión cacheada, usando contexto limpio para ${appConfig.name}`
    );

    return context;
  }

  /**
   * Guarda el estado actual del contexto en un archivo storageState
   */
  static async saveContext(context: BrowserContext, appName: string): Promise<void> {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const statePath = this.getStatePath(appName);
    await context.storageState({ path: statePath });

    console.log(`💾 Sesión guardada en cache para ${appName}: ${statePath}`);
  }

  /**
   * Limpia el cache de una app específica
   */
  static clearCache(appName: string): void {
    const statePath = this.getStatePath(appName);
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
      console.log(`🧹 Cache eliminado para ${appName}`);
    }
  }

  /**
   * Limpia todos los caches guardados
   */
  static clearAll(): void {
    if (fs.existsSync(this.cacheDir)) {
      fs.rmSync(this.cacheDir, { recursive: true, force: true });
      console.log(`🧹 Todos los caches eliminados`);
    }
  }
}

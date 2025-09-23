import fs from 'fs';
import path from 'path';
import { Browser, BrowserContext, Page } from '@playwright/test';
import { AppConfig } from '../types/config.types';

/**
 * Maneja la persistencia avanzada de sesiones por aplicación
 * Incluye storageState, localStorage, sessionStorage, IndexedDB y más
 */
export class SessionCache {
  private static cacheDir = path.resolve('./cache');

  /**
   * Devuelve las rutas de archivos de cache de una app
   */
  static getCachePaths(appName: string) {
    return {
      storageState: path.join(this.cacheDir, `${appName}-state.json`),
      localStorage: path.join(this.cacheDir, `${appName}-localStorage.json`),
      sessionStorage: path.join(this.cacheDir, `${appName}-sessionStorage.json`),
      indexedDB: path.join(this.cacheDir, `${appName}-indexedDB.json`),
      authTokens: path.join(this.cacheDir, `${appName}-auth.json`),
      userProfile: path.join(this.cacheDir, `${appName}-profile.json`),
      appConfig: path.join(this.cacheDir, `${appName}-appConfig.json`),
      performance: path.join(this.cacheDir, `${appName}-performance.json`),
      metadata: path.join(this.cacheDir, `${appName}-metadata.json`),
      extensionStorage: path.join(this.cacheDir, `${appName}-extensionStorage.json`),
    };
  }

  /**
   * Carga un contexto con todos los datos cacheados disponibles
   */
  static async loadContext(browser: Browser, appConfig: AppConfig): Promise<{ context: BrowserContext, page: Page }> {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const paths = this.getCachePaths(appConfig.name);

    // Validar si el cache es válido antes de cargarlo
    const isValidCache = await this.validateCache(appConfig.name);

    if (!isValidCache) {
      console.log(`⚠️ Cache inválido o expirado para ${appConfig.name}, creando contexto limpio`);
      this.clearCache(appConfig.name);
      const context = await browser.newContext();
      const page = await context.newPage();
      return { context, page };
    }

    // Cargar contexto con storageState si existe
    const context = await browser.newContext({
      storageState: fs.existsSync(paths.storageState) ? paths.storageState : undefined,
    });

    // Abrir una página (si no hay ninguna)
    let page = context.pages()[0] || await context.newPage();

    if (page.url() === 'about:blank' && appConfig.baseUrl) {
      await page.goto(appConfig.baseUrl);
    }

    // Restaurar datos adicionales si el contexto tiene páginas
    if (fs.existsSync(paths.storageState)) {
      console.log(`📂 Sesión cacheada cargada para ${appConfig.name}`);
      await this.restoreAdditionalData(page, appConfig.name);

      console.log(`✨ Datos adicionales restaurados para ${appConfig.name}`);
    } else {
      console.log(`🆕 No había sesión cacheada, usando contexto limpio para ${appConfig.name}`);
    }

    return { context, page };
  }

  /**
   * Guarda el estado completo del contexto
   */
  static async saveContext(context: BrowserContext, appName: string): Promise<void> {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    const paths = this.getCachePaths(appName);

    // Guardar storageState básico (cookies, localStorage básico, sessionStorage básico)
    await context.storageState({ path: paths.storageState });

    // Obtener página activa para extraer datos adicionales
    const pages = context.pages();
    if (pages.length > 0) {
      const page = pages[0];
      try {
        // Extraer y guardar datos adicionales
        await Promise.all([
          this.saveLocalStorage(page, paths.localStorage),
          this.saveSessionStorage(page, paths.sessionStorage),
          this.saveIndexedDB(page, paths.indexedDB),
          this.saveAuthTokens(page, paths.authTokens),
          this.saveUserProfile(page, paths.userProfile),
          this.saveAppConfig(page, paths.appConfig),
          this.savePerformanceData(page, paths.performance),
          this.saveMetadata(appName, paths.metadata),
          this.saveExtensionStorage(page, paths.extensionStorage)
        ]);

        console.log(`💾 Sesión completa guardada para ${appName}`);
      } catch (error) {
        console.warn(`⚠️ Error guardando datos adicionales para ${appName}:`, error);
        // Aún así guardamos el storageState básico
        console.log(`💾 StorageState básico guardado para ${appName}`);
      }
    }
  }

  /**
   * Guarda localStorage extendido
   */
  private static async saveLocalStorage(page: Page, filePath: string): Promise<void> {
    const localStorage = await page.evaluate(() => {
      const storage: Record<string, any> = {};

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          try {
            // Intentar parsear como JSON para preservar tipos
            storage[key] = JSON.parse(value || '');
          } catch {
            // Si no es JSON, guardar como string
            storage[key] = value;
          }
        }
      }

      return storage;
    });

    fs.writeFileSync(filePath, JSON.stringify(localStorage, null, 2));
  }

  /**
 * Guarda chrome.storage.local de la extensión
 */
  private static async saveExtensionStorage(page: Page, filePath: string): Promise<void> {
    try {
      const extStorage = await page.evaluate(async () => {
        const chromeApi = (window as any).chrome;

        if (typeof chromeApi === 'undefined' || !chromeApi.storage) {
          return {
            isExtensionContext: false,
            message: 'Chrome extension APIs not available',
            timestamp: Date.now()
          } as any;
        }

        const data: any = {
          isExtensionContext: true,
          timestamp: Date.now(),
          extractionSuccess: true,
          storage: {
            local: {} as Record<string, any>,
            sync: {} as Record<string, any>,
            managed: {} as Record<string, any>,
            session: {} as Record<string, any>
          },
          manifest: null as any,
          runtime: {} as any,
          permissions: [] as string[],
          errors: [] as string[],
          stats: {
            totalItems: 0,
            totalSize: 0,
            storageTypes: [] as string[]
          }
        };

        // Helper para envolver chrome.storage.get en Promise tipada
        const getStorage = (area: any): Promise<Record<string, any>> => {
          return new Promise((resolve, reject) => {
            area.get(null, (items: Record<string, any>) => {
              if (chromeApi.runtime.lastError) {
                reject(chromeApi.runtime.lastError);
              } else {
                resolve(items || {});
              }
            });
          });
        };

        // chrome.storage.local
        try {
          data.storage.local = await getStorage(chromeApi.storage.local);
          const localKeys = Object.keys(data.storage.local);
          data.stats.totalItems += localKeys.length;
          data.stats.storageTypes.push(`local(${localKeys.length})`);
        } catch (err: any) {
          data.errors.push(`chrome.storage.local error: ${err?.message || err}`);
        }

        // chrome.storage.sync
        if (chromeApi.storage.sync) {
          try {
            data.storage.sync = await getStorage(chromeApi.storage.sync);
            const syncKeys = Object.keys(data.storage.sync);
            data.stats.totalItems += syncKeys.length;
            data.stats.storageTypes.push(`sync(${syncKeys.length})`);
          } catch (err: any) {
            data.errors.push(`chrome.storage.sync error: ${err?.message || err}`);
          }
        }

        // chrome.storage.managed
        if (chromeApi.storage.managed) {
          try {
            data.storage.managed = await getStorage(chromeApi.storage.managed);
            const managedKeys = Object.keys(data.storage.managed);
            data.stats.totalItems += managedKeys.length;
            data.stats.storageTypes.push(`managed(${managedKeys.length})`);
          } catch (err: any) {
            data.errors.push(`chrome.storage.managed error: ${err?.message || err}`);
          }
        }

        // chrome.storage.session (Chrome 102+)
        if (chromeApi.storage.session) {
          try {
            data.storage.session = await getStorage(chromeApi.storage.session);
            const sessionKeys = Object.keys(data.storage.session);
            data.stats.totalItems += sessionKeys.length;
            data.stats.storageTypes.push(`session(${sessionKeys.length})`);
          } catch (err: any) {
            data.errors.push(`chrome.storage.session error: ${err?.message || err}`);
          }
        }

        // Manifest
        try {
          if (chromeApi.runtime?.getManifest) {
            data.manifest = chromeApi.runtime.getManifest();
            data.permissions = data.manifest?.permissions || [];
          }
        } catch (err: any) {
          data.errors.push(`Manifest error: ${err?.message || err}`);
        }

        // Runtime
        try {
          if (chromeApi.runtime) {
            data.runtime = {
              id: chromeApi.runtime.id,
              version: data.manifest?.version,
              url: chromeApi.runtime.getURL ? chromeApi.runtime.getURL('') : null
            };
          }
        } catch (err: any) {
          data.errors.push(`Runtime error: ${err?.message || err}`);
        }

        // Stats
        try {
          const allData = JSON.stringify(data.storage);
          data.stats.totalSize = allData.length;
        } catch (err: any) {
          data.errors.push(`Stats calculation error: ${err?.message || err}`);
        }

        return data;
      });

      fs.writeFileSync(filePath, JSON.stringify(extStorage, null, 2));

      console.log(`💾 Extension storage guardado en ${filePath}`);

    } catch (err: any) {
      console.warn(`❌ Error guardando extension storage:`, err);
      const errorInfo = {
        isExtensionContext: false,
        error: err?.message || 'Unknown error',
        timestamp: Date.now(),
        stack: err?.stack
      };
      fs.writeFileSync(filePath, JSON.stringify(errorInfo, null, 2));
    }
  }


  /**
   * Guarda sessionStorage extendido
   */
  private static async saveSessionStorage(page: Page, filePath: string): Promise<void> {
    const sessionStorage = await page.evaluate(() => {
      const storage: Record<string, any> = {};

      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          try {
            storage[key] = JSON.parse(value || '');
          } catch {
            storage[key] = value;
          }
        }
      }

      return storage;
    });

    fs.writeFileSync(filePath, JSON.stringify(sessionStorage, null, 2));
  }

  /**
   * Guarda datos de IndexedDB
   */
  private static async saveIndexedDB(page: Page, filePath: string): Promise<void> {
    const indexedDBData = await page.evaluate(async () => {
      try {
        if (!('indexedDB' in window)) return null;

        const databases = await indexedDB.databases();
        const dbData: any[] = [];

        for (const dbInfo of databases) {
          if (!dbInfo.name) continue;

          const data = await new Promise((resolve, reject) => {
            const request = indexedDB.open(dbInfo.name!);

            request.onsuccess = () => {
              const db = request.result;
              const stores: Record<string, any[]> = {};

              // Obtener datos de cada store
              const storeNames = Array.from(db.objectStoreNames);
              let completedStores = 0;

              if (storeNames.length === 0) {
                db.close();
                resolve({ name: dbInfo.name, stores: {} });
                return;
              }

              for (const storeName of storeNames) {
                try {
                  const transaction = db.transaction(storeName, 'readonly');
                  const store = transaction.objectStore(storeName);
                  const getAllRequest = store.getAll();

                  getAllRequest.onsuccess = () => {
                    stores[storeName] = getAllRequest.result;
                    completedStores++;

                    if (completedStores === storeNames.length) {
                      db.close();
                      resolve({ name: dbInfo.name, stores });
                    }
                  };

                  getAllRequest.onerror = () => {
                    stores[storeName] = [];
                    completedStores++;

                    if (completedStores === storeNames.length) {
                      db.close();
                      resolve({ name: dbInfo.name, stores });
                    }
                  };
                } catch (error) {
                  console.warn(`Error accessing store ${storeName}:`, error);
                  stores[storeName] = [];
                  completedStores++;

                  if (completedStores === storeNames.length) {
                    db.close();
                    resolve({ name: dbInfo.name, stores });
                  }
                }
              }
            };

            request.onerror = () => reject(request.error);
          });

          dbData.push(data);
        }

        return dbData;
      } catch (error) {
        console.warn('Error extracting IndexedDB:', error);
        return null;
      }
    });

    if (indexedDBData) {
      fs.writeFileSync(filePath, JSON.stringify(indexedDBData, null, 2));
    }
  }

  /**
   * Guarda tokens de autenticación
   */
  private static async saveAuthTokens(page: Page, filePath: string): Promise<void> {
    const authTokens = await page.evaluate(() => {
      const tokens: Record<string, any> = {};
      const authKeys = ['token', 'jwt', 'auth', 'access_token', 'refresh_token', 'bearer'];

      // Buscar en localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && authKeys.some(authKey => key.toLowerCase().includes(authKey))) {
          const value = localStorage.getItem(key);
          try {
            tokens[`localStorage_${key}`] = JSON.parse(value || '');
          } catch {
            tokens[`localStorage_${key}`] = value;
          }
        }
      }

      // Buscar en sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && authKeys.some(authKey => key.toLowerCase().includes(authKey))) {
          const value = sessionStorage.getItem(key);
          try {
            tokens[`sessionStorage_${key}`] = JSON.parse(value || '');
          } catch {
            tokens[`sessionStorage_${key}`] = value;
          }
        }
      }

      return tokens;
    });

    if (Object.keys(authTokens).length > 0) {
      fs.writeFileSync(filePath, JSON.stringify(authTokens, null, 2));
    }
  }

  /**
   * Guarda perfil de usuario
   */
  private static async saveUserProfile(page: Page, filePath: string): Promise<void> {
    const userProfile = await page.evaluate(() => {
      const profileKeys = ['user', 'profile', 'userProfile', 'currentUser', 'userData'];
      const profile: Record<string, any> = {};

      for (const key of profileKeys) {
        const localValue = localStorage.getItem(key);
        const sessionValue = sessionStorage.getItem(key);

        if (localValue) {
          try {
            profile[`localStorage_${key}`] = JSON.parse(localValue);
          } catch {
            profile[`localStorage_${key}`] = localValue;
          }
        }

        if (sessionValue) {
          try {
            profile[`sessionStorage_${key}`] = JSON.parse(sessionValue);
          } catch {
            profile[`sessionStorage_${key}`] = sessionValue;
          }
        }
      }

      return profile;
    });

    if (Object.keys(userProfile).length > 0) {
      fs.writeFileSync(filePath, JSON.stringify(userProfile, null, 2));
    }
  }

  /**
   * Guarda configuración de aplicación
   */
  private static async saveAppConfig(page: Page, filePath: string): Promise<void> {
    const appConfig = await page.evaluate(() => {
      const configKeys = ['config', 'settings', 'preferences', 'options', 'features', 'flags'];
      const config: Record<string, any> = {};

      for (const key of configKeys) {
        const value = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (value) {
          try {
            config[key] = JSON.parse(value);
          } catch {
            config[key] = value;
          }
        }
      }

      return config;
    });

    if (Object.keys(appConfig).length > 0) {
      fs.writeFileSync(filePath, JSON.stringify(appConfig, null, 2));
    }
  }

  /**
   * Guarda datos de performance
   */
  private static async savePerformanceData(page: Page, filePath: string): Promise<void> {
    const performanceData = await page.evaluate(() => {
      return {
        navigation: performance.getEntriesByType('navigation'),
        resources: performance.getEntriesByType('resource').slice(-50), // Solo los últimos 50
        memory: (performance as any).memory ? {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
          jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
        } : null,
        timing: performance.timing,
        timeOrigin: performance.timeOrigin
      };
    });

    fs.writeFileSync(filePath, JSON.stringify(performanceData, null, 2));
  }

  /**
   * Guarda metadatos del cache
   */
  private static async saveMetadata(appName: string, filePath: string): Promise<void> {
    const metadata = {
      appName,
      timestamp: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 horas
      version: '1.0',
      userAgent: '', // Se llenará en la restauración
      environment: process.env.NODE_ENV || 'development'
    };

    fs.writeFileSync(filePath, JSON.stringify(metadata, null, 2));
  }

  private static async restoreLocalStorage(page: Page, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) return;

    const localStorageDump = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await page.evaluate((storage) => {
      for (const [key, value] of Object.entries(storage)) {
        localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    }, localStorageDump);

    console.log(`✅ LocalStorage restaurado (${Object.keys(localStorageDump).length} items)`);
  }

  private static async restoreSessionStorage(page: Page, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) return;

    const sessionStorageDump = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await page.evaluate((storage) => {
      for (const [key, value] of Object.entries(storage)) {
        sessionStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    }, sessionStorageDump);

    console.log(`✅ SessionStorage restaurado (${Object.keys(sessionStorageDump).length} items)`);
  }

  private static async restoreExtensionStorage(page: Page, filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) return;

    const extensionDump = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    await page.evaluate(async (dump) => {
      const chromeApi = (window as any).chrome;
      if (!chromeApi?.storage) {
        console.warn("⚠️ chrome.storage no disponible en este contexto");
        return;
      }

      // storage.local
      if (dump.storage?.local) {
        await new Promise<void>((resolve) => {
          chromeApi.storage.local.set(dump.storage.local, () => resolve());
        });
      }

      // storage.sync
      if (dump.storage?.sync) {
        await new Promise<void>((resolve) => {
          chromeApi.storage.sync.set(dump.storage.sync, () => resolve());
        });
      }

      // storage.session (Chrome 102+)
      if (dump.storage?.session) {
        await new Promise<void>((resolve) => {
          chromeApi.storage.session.set(dump.storage.session, () => resolve());
        });
      }

      // storage.managed es read-only
      if (dump.storage?.managed) {
        console.warn("⚠️ storage.managed es de solo lectura, no se restaura");
      }
    }, extensionDump);

    console.log(`✅ ExtensionStorage restaurado (tipos: ${extensionDump.stats?.storageTypes?.join(', ') || 'N/A'})`);
  }

  /**
   * Orquestador principal
   */
  private static async restoreAdditionalData(page: Page, appName: string): Promise<void> {
    const paths = this.getCachePaths(appName);

    try {
      await this.restoreLocalStorage(page, paths.localStorage);
      await this.restoreSessionStorage(page, paths.sessionStorage);
      await this.restoreExtensionStorage(page, paths.extensionStorage);

      console.log(`✨ Todos los datos adicionales restaurados para ${appName}`);
    } catch (error) {
      console.warn(`⚠️ Error restaurando datos adicionales para ${appName}:`, error);
    }
  }

  /**
   * Valida si el cache es válido y no ha expirado
   */
  private static async validateCache(appName: string): Promise<boolean> {
    const paths = this.getCachePaths(appName);

    try {
      // Verificar si existe el archivo principal
      if (!fs.existsSync(paths.storageState)) {
        return false;
      }

      // Verificar metadatos si existen
      if (fs.existsSync(paths.metadata)) {
        const metadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf8'));

        // Verificar expiración
        if (metadata.expiresAt && Date.now() > metadata.expiresAt) {
          console.log(`⏰ Cache expirado para ${appName}`);
          return false;
        }
      }

      // Verificar integridad del storageState
      const storageState = JSON.parse(fs.readFileSync(paths.storageState, 'utf8'));

      // Verificar cookies no expiradas
      if (storageState.cookies) {
        const now = Date.now();
        const validCookies = storageState.cookies.filter((cookie: any) =>
          !cookie.expires || cookie.expires * 1000 > now // expires está en segundos
        );

        if (validCookies.length === 0 && storageState.cookies.length > 0) {
          console.log(`🍪 Todas las cookies expiradas para ${appName}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(`❌ Error validando cache para ${appName}:`, error);
      return false;
    }
  }

  /**
   * Verifica si el contexto fue reutilizado (útil para métricas)
   */
  static wasContextReused(appName: string): boolean {
    const paths = this.getCachePaths(appName);
    return fs.existsSync(paths.storageState);
  }

  /**
   * Limpia el cache de una app específica
   */
  static clearCache(appName: string): void {
    const paths = this.getCachePaths(appName);

    Object.values(paths).forEach(filePath => {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    console.log(`🧹 Cache completo eliminado para ${appName}`);
  }

  /**
   * Limpia caches expirados automáticamente
   */
  static clearExpiredCaches(): void {
    if (!fs.existsSync(this.cacheDir)) return;

    const files = fs.readdirSync(this.cacheDir);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = path.join(this.cacheDir, file);
      const stats = fs.statSync(filePath);

      // Eliminar archivos más antiguos de 7 días
      if (now - stats.mtime.getTime() > 7 * 24 * 60 * 60 * 1000) {
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 ${deletedCount} archivos de cache expirados eliminados`);
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

  /**
   * Obtiene estadísticas del cache
   */
  static getCacheStats(): { [appName: string]: any } {
    if (!fs.existsSync(this.cacheDir)) return {};

    const files = fs.readdirSync(this.cacheDir);
    const stats: { [appName: string]: any } = {};

    // Agrupar archivos por app
    const appFiles: { [appName: string]: string[] } = {};

    files.forEach(file => {
      const appName = file.split('-')[0];
      if (!appFiles[appName]) appFiles[appName] = [];
      appFiles[appName].push(file);
    });

    // Calcular estadísticas por app
    Object.entries(appFiles).forEach(([appName, appFileList]) => {
      const paths = this.getCachePaths(appName);

      stats[appName] = {
        hasStorageState: fs.existsSync(paths.storageState),
        hasLocalStorage: fs.existsSync(paths.localStorage),
        hasSessionStorage: fs.existsSync(paths.sessionStorage),
        hasIndexedDB: fs.existsSync(paths.indexedDB),
        hasAuthTokens: fs.existsSync(paths.authTokens),
        hasUserProfile: fs.existsSync(paths.userProfile),
        hasAppConfig: fs.existsSync(paths.appConfig),
        hasPerformance: fs.existsSync(paths.performance),
        totalFiles: appFileList.length,
        lastModified: Math.max(
          ...appFileList.map(file =>
            fs.statSync(path.join(this.cacheDir, file)).mtime.getTime()
          )
        )
      };
    });

    return stats;
  }
}
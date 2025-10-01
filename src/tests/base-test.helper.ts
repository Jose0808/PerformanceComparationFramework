import { test, Page } from '@playwright/test';
import { ConfigManager } from '../config/ConfigManager';
import { TestTimer } from '../utils/timer.utils';
import { ExecutionCollector } from '../collectors/ExecutionCollector';
import { SessionCache } from '../utils/sessionCache.utils';
import { AppConfig } from '../types/config.types';

export class BaseTestHelper {
  public config = ConfigManager.getInstance();

  logTestStart(appName: string, iteration: number, flowName: string) {
    console.log(`🚀 ${appName} - ${flowName} - Ejecución ${iteration}`);
  }

  async takeScreenshotIfEnabled(page: any, appName: string, iteration: number, flowName: string) {
    if (this.config.reporting.generateScreenshots) {
      const filename = `success_${appName.replace(/\s+/g, '_')}_${flowName}_run_${iteration}`;
      await page.takeScreenshot(filename);
    }
  }

  handleTestError(error: unknown, appName: string, iteration: number, flowName: string): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${appName} - ${flowName} - Run ${iteration} failed:`, errorMessage);
    return errorMessage;
  }

  // Método actualizado para usar ExecutionCollector
  async storePerformanceData(
    appName: string,
    iteration: number,
    timer: TestTimer,
    metrics: any,
    flowName: string,
    testError?: string,
    metadata?: {
      browser?: string;
      viewport?: string;
      userAgent?: string;
      [key: string]: any;
    }
  ) {
    const executionData = timer.getExecution(appName, flowName);

    // Obtener collector y almacenar datos
    const collector = ExecutionCollector.getInstance();

    try {
      collector.addExecution(appName, flowName, executionData, iteration, {
        ...metadata,
        // error: testError,
        // failed: !!testError,
        // hasMetrics: !!metrics
      });

      console.log(`💾 Datos almacenados: ${appName} - ${flowName} - Iteración ${iteration}`);
    } catch (error) {
      console.error('❌ Error almacenando datos de performance:', error);

      // Fallback: usar annotations como respaldo
      // test.info().annotations.push({
      //   type: `performance-data-${appName}-${flowName}`,
      //   description: JSON.stringify({ 
      //     data: executionData, 
      //     iteration,
      //     error: 'Failed to store in collector'
      //   })
      // });
    }
  }

  async handleCooldownAndRestart(iteration: number, page?: Page) {
    const isLastIteration = iteration === this.config.test.iterations;
    const shouldCooldown = !isLastIteration && this.config.test.cooldownBetweenRuns > 0;
    const shouldRestart = iteration % this.config.test.browserRestartFrequency === 0 && !isLastIteration;

    if (shouldCooldown) {
      console.log(`⏳ Waiting ${this.config.test.cooldownBetweenRuns}ms...`);
      await new Promise(resolve => setTimeout(resolve, this.config.test.cooldownBetweenRuns));
    }

    if (shouldRestart) {
      console.log('🔄 Browser restart triggered');
    }
  }

  logConfiguration() {
    console.log('🔧 Test Configuration:');
    console.log(`Environment: ${this.config.test.environment}`);
    console.log(`Iterations: ${this.config.test.iterations}`);
    console.log(`Parallel: ${this.config.test.parallelInstances}`);
    console.log(`Apps: ${this.config.getAllApps().map(app => app.name).join(', ')}`);
  }

  async setupContextWithCache(browser: any, appConfig: AppConfig) {
    const context = await SessionCache.loadContext(browser, appConfig);
    console.log(`📂 Contexto inicializado con cache para ${appConfig.name}`);
    return context;
  }

  async setupContext(context: any) {
    if (this.config.test.clearCacheBetweenRuns) {
      console.log('⏳ Limpiando Caché');
      await Promise.all([
        context.clearCookies(),
        context.clearPermissions(),
      ]);
      console.log('✅ Caché borrado exitosamente');
    }
  }

  // Método auxiliar para obtener estadísticas rápidas de la sesión actual
  getSessionStats(): { totalRuns: number; apps: string[]; avgDuration: number } | null {
    try {
      const collector = ExecutionCollector.getInstance();
      const session = collector.getCurrentSession();

      if (!session || session.runs.length === 0) {
        return null;
      }

      const validRuns = session.runs.filter(r => r.execution.totalDuration > 0);
      const avgDuration = validRuns.length > 0
        ? validRuns.reduce((sum, r) => sum + r.execution.totalDuration, 0) / validRuns.length
        : 0;

      return {
        totalRuns: session.runs.length,
        apps: [...new Set(session.runs.map(r => r.appName))],
        avgDuration
      };
    } catch (error) {
      console.warn('Error obteniendo estadísticas de sesión:', error);
      return null;
    }
  }
}
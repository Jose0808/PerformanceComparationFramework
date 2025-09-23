import { test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { Vista360IndividualPage } from '../pages/vista360Individual.page';
import { BasicInfo } from '../pages/basicInfo.page';
import { ChangeNumber } from '../pages/changeNumber.page';
import { Checkout } from '../pages/checkout.page';
import { ICambioDeNumero } from '../types/cambioDeNumero';
import CambioDeNumero from '../data-driven/CambioDeNumero.json';
import { BaseTestHelper } from './base-test.helper';
import { TestTimer } from '../utils/timer.utils';
import { ExecutionCollector } from '../collectors/ExecutionCollector';
import { ReportGenerator } from '../reporters/report-generator';
import { ExecutionRun } from '../types/executionTypes';
import { HeaderPage } from '../pages/header.page';
import { SessionCache } from '../utils/sessionCache.utils'
import { config } from 'process';

class CambioNumeroTest extends BaseTestHelper {
  public pages: any = {};

  setupPages(page: any) {
    this.pages = {
      header: new HeaderPage(page),
      login: new LoginPage(page),
      dashboard: new DashboardPage(page),
      vista360: new Vista360IndividualPage(page),
      basicInfo: new BasicInfo(page),
      changeNumber: new ChangeNumber(page),
      checkout: new Checkout(page)
    };
  }

  async executeFlow(app: any, timer: any, testData: ICambioDeNumero) {

    await this.pages.login.login(app, timer, this.pages.dashboard);

    await this.pages.dashboard.selectOnDashboard(
      app,
      timer,
      "Operación Integrada (Nuevo)",
      "Vista 360° Individual"
    );

    await this.pages.vista360.searchCustomer(app, timer, testData.filters);
    await this.pages.basicInfo.selectSuscription(
      app,
      timer,
      testData.SuscriptionRow,
      "Cambio de número"
    );
    await this.pages.changeNumber.changeNumber(app, timer);
    // await this.pages.checkout.checkoutValidate(app, timer);
    // await this.pages.header.logout(app);
  }
}

// Variables globales para el collector
let collector: ExecutionCollector;
let sessionId: string;

test.describe('Cambio de Numero Performance Tests', () => {
  const testHelper = new CambioNumeroTest();
  const flowName = 'Cambio de Número';

  test.beforeAll(async () => {
    testHelper.logConfiguration();

    collector = ExecutionCollector.getInstance('./performance-data');
    sessionId = collector.startSession(
      `CambioNumero-Performance-${new Date().toISOString().split('T')[0]}`
    );
    console.log(`🔧 Sesión iniciada: ${sessionId}`);
  });

  for (const app of testHelper.config.getAllApps()) {
    test.describe(`${app.name}`, () => {
      for (let iteration = 1; iteration <= testHelper.config.test.iterations; iteration++) {
        test(`Latencia Ejecución ${iteration}`, async ({ browser, browserName }) => {
          testHelper.logTestStart(app.name, iteration, flowName);

          const { context, page } = await SessionCache.loadContext(browser, app);
          testHelper.setupPages(page);

          const timer = new TestTimer(page);
          const testData = CambioDeNumero as ICambioDeNumero;

          let metrics: any;
          let testError: string | undefined;

          try {
            await testHelper.executeFlow(app, timer, testData);

            metrics = await testHelper.pages.dashboard.collectPerformanceMetrics();

            testHelper.logResults(app.name, iteration, metrics, flowName);
            testHelper.validateThresholds(timer, metrics);

            await testHelper.takeScreenshotIfEnabled(
              testHelper.pages.login,
              app.name,
              iteration,
              flowName
            );

            await SessionCache.saveContext(context, app.name);

          } catch (error) {
            testError = testHelper.handleTestError(error, app.name, iteration, flowName);
            throw error;
          } finally {
            await testHelper.storePerformanceData(
              app.name,
              iteration,
              timer,
              metrics,
              flowName,
              testError,
              {
                browser: browserName,
                viewport: JSON.stringify(page.viewportSize()),
                userAgent: await page.evaluate(() => navigator.userAgent).catch(() => 'unknown')
              }
            );
            await testHelper.handleCooldownAndRestart(iteration, page);
            await context.close();
          }
        });
      }
    });
  }

  test.afterAll(async () => {
    // const session = collector.getSession(sessionId);
    // if (!session) return;
    collector.endSession();
  });

});

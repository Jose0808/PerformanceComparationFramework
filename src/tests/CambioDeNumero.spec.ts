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
import { ReportGenerator } from '../utils/report.utils';
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

          const context = await SessionCache.loadContext(browser, app);
          const page = await context.newPage();
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
            collector.endSession();
          }
        });
      }
    });
  }

  // test.afterAll(async () => {
  //   console.log(`After:`);
  //   const session = collector.getSession(sessionId);
  //   if (!session) return;

  //   console.log(`📊 Sesión completada:`);
  //   console.log(`   - Total runs: ${session.completedRuns}`);
  //   console.log(`   - Apps probadas: ${[...new Set(session.runs.map(r => r.appName))].join(', ')}`);
  //   console.log(`   - Duración: ${Math.round((new Date().getTime() - session.startTime.getTime()) / 1000)}s`);

  //   // const groupedByApp = new Map<string, ExecutionRun[]>();
  //   // session.runs.forEach(run => {
  //   //   if (run.flowName !== flowName) return;
  //   //   if (!groupedByApp.has(run.appName)) {
  //   //     groupedByApp.set(run.appName, []);
  //   //   }
  //   //   groupedByApp.get(run.appName)!.push(run);
  //   // });

  //   // let a = groupedByApp.get('OnPremise');
  //   // let b = groupedByApp.get('Cloud');
  //   // if (!a || !b) return;

  //   // let executiona = a[0].execution;
  //   // let executionb = b[0].execution;
  //   // const comparison = ReportGenerator.generateComparison(executiona, executionb);

  //   // const fechaActual = new Date();
  //   // const fechaFormateada = `${String(fechaActual.getDate()).padStart(2, '0')}-${String(
  //   //   fechaActual.getMonth() + 1
  //   // ).padStart(2, '0')}-${fechaActual.getFullYear()}-${String(
  //   //   fechaActual.getHours()
  //   // ).padStart(2, '0')}-${String(fechaActual.getMinutes()).padStart(2, '0')}`;

  //   // const fileName = `./reports/${comparison.testName.replace(/\s+/g, '_')}/Reporte_${fechaFormateada}`;
  //   // await ReportGenerator.generateHTMLReport(comparison, fileName);

  //   collector.endSession();
  //   console.log(`📊 Reporte generado y sesión finalizada`);
  // });

});

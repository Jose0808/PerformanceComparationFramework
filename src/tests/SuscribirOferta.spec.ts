import { BrowserContext, Page, test } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { Individual360ViewPage } from '../pages/vista360Individual.page';
import { BasicInfoPage } from '../pages/basicInfo.page';
import { CheckoutPage } from '../pages/checkout.page';
import SuscribirOferta from '../data-driven/SuscribirOferta.json';
import { BaseTestHelper } from './base-test.helper';
import { TestTimer } from '../utils/timer.utils';
import { ExecutionCollector } from '../collectors/ExecutionCollector';
import { HeaderPage } from '../pages/header.page';
import { SessionCache } from '../utils/sessionCache.utils'
import { ISuscribeOffer } from '../data-driven/types/suscribeOffer.types';
import { SuscribeOfferPage } from '../pages/suscribeOffer';

class SuscribeOfferTest extends BaseTestHelper {
  public pages: any = {};

  setupPages(page: any) {
    this.pages = {
      header: new HeaderPage(page),
      login: new LoginPage(page),
      dashboard: new DashboardPage(page),
      vista360: new Individual360ViewPage(page),
      basicInfo: new BasicInfoPage(page),
      suscribeOffer: new SuscribeOfferPage(page),
      checkout: new CheckoutPage(page)
    };
  }

  async executeFlow(app: any, timer: any, testData: ISuscribeOffer) {

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
      "Suscribir oferta"
    );
    await this.pages.suscribeOffer.suscribeOffer(app, timer, testData.offer);
    await this.pages.checkout.checkoutValidate(app, timer);
  }
}

// Variables globales para el collector
let collector: ExecutionCollector;
let sessionId: string;
const flowName = 'Suscribir Oferta';
const flowNameReplace = flowName.replace(/\s+/g, '');

test.describe(flowName + ' Performance Tests', () => {
  const testHelper = new SuscribeOfferTest();

  test.beforeAll(async () => {
    testHelper.logConfiguration();

    collector = ExecutionCollector.getInstance('./performance-data');
    sessionId = collector.startSession(
      `${flowNameReplace}-Performance-${new Date().toISOString().split('T')[0]}`
    );
    console.log(`🔧 Sesión iniciada: ${sessionId}`);
  });

  for (const app of testHelper.config.getAllApps()) {
    test.describe(`${app.name}`, () => {
      // test.describe.configure({ mode: 'parallel' });
      let sharedContext: BrowserContext;
      let sharedPage: Page;

      test.beforeAll(async ({ browser }) => {
        const { context, page } = await SessionCache.loadContext(browser, app);
        sharedContext = context;
        sharedPage = page;
      });

      test.afterAll(async () => {
        await SessionCache.saveContext(sharedContext, app.name);
        await sharedContext.close();
      });

      for (let iteration = 1; iteration <= testHelper.config.test.iterations; iteration++) {
        test(`Latencia Ejecución ${iteration}`, async ({ browserName }) => {
          testHelper.logTestStart(app.name, iteration, flowName);
          testHelper.setupPages(sharedPage);

          const timer = new TestTimer(sharedPage);
          const testData = SuscribirOferta as ISuscribeOffer;

          let metrics: any;
          let testError: string | undefined;

          try {
            await testHelper.executeFlow(app, timer, testData);

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
                viewport: JSON.stringify(sharedPage.viewportSize()),
                userAgent: await sharedPage.evaluate(() => navigator.userAgent).catch(() => 'unknown')
              }
            );
          }
        });
      }
    });
  }

  test.afterAll(async () => {
    collector.endSession();
  });

});

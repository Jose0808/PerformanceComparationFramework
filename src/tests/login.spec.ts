import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ConfigManager } from '../config/ConfigManager';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { PerformanceComparator } from '../utils/PerformanceComparator';
import { DashboardPage } from '../pages/dashboard.page';
import { Vista360IndividualPage } from '../pages/vista360Individual.page';
import { BasicInfo } from '../pages/basicInfo.page';
import { ChangeNumber } from '../pages/changeNumber.page';
import { Checkout } from '../pages/checkout.page';
import { TestTimer } from '../utils/timer.utils';

test.describe('Login Flow', () => {
  let config: ConfigManager = ConfigManager.getInstance();
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let vista360IndividualPage: Vista360IndividualPage;
  let basicInfo: BasicInfo;
  let changeNumber: ChangeNumber;
  let checkout: Checkout;

  test.beforeAll(() => {
    console.log('🔧 Test Configuration:');
    console.log(`Environment: ${config.test.environment}`);
    console.log(`Iterations: ${config.test.iterations}`);
    console.log(`Parallel instances: ${config.test.parallelInstances}`);
    console.log(`App1: ${config.app1.name} (${config.app1.technology})`);
    console.log(`App2: ${config.app2.name} (${config.app2.technology})`);
  });

  // Test setup for consistent browser configuration
  test.beforeEach(async ({ page, context }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    vista360IndividualPage = new Vista360IndividualPage(page);
    basicInfo = new BasicInfo(page);
    changeNumber = new ChangeNumber(page);
    checkout = new Checkout(page);
    // Apply network throttling if configured
    if (config.network.latency > 0) {
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: config.network.latency,
        downloadThroughput: config.network.downloadThroughput,
        uploadThroughput: config.network.uploadThroughput,
        connectionType: 'cellular4g'
      });
    }

    // Clear browser data between runs if configured
    if (config.test.clearCacheBetweenRuns) {
      await context.clearCookies();
    }
  });

  // Generate tests for each application dynamically
  for (const app of config.getAllApps()) {
    test.describe(`${app.name} Latency tests`, () => {
      // Generate multiple test runs based on iteration count
      for (let iteration = 1; iteration <= config.test.iterations; iteration++) {
        test(`Cambio de Numero Performance - ${app.name} - Run ${iteration}`, async ({ page }) => {
          console.log(`\n🚀 Starting ${app.name} - Run ${iteration}`);
          console.log(`URL: ${app.baseUrl}`);

          let metrics: any;
          let testError: string | undefined;

          try {
            // Enable network throttling
            await loginPage.enableNetworkThrottling();

            let timer = new TestTimer(page);

            await loginPage.login(app, timer);

            let data = timer.getExecution(app.name, 'Proceso completo de login');

            test.info().annotations.push({
              type: 'performance-data-' + app.name,
              description: JSON.stringify({
                data
              })
            });

            // Collect performance metrics
            metrics = await dashboardPage.collectPerformanceMetrics();

            console.log(`✅ ${app.name} - Run ${iteration} completed successfully`);
            console.log(`🏃 Cambio de número time: ${metrics.customMetrics.total_login_time}ms`);
            console.log(`📊 LCP: ${metrics.lcp}ms, FCP: ${metrics.fcp}ms, TTFB: ${metrics.ttfb}ms`);

            // Validate against thresholds
            const metricsCollector = new MetricsCollector(page);
            const thresholdCheck = metricsCollector.checkThresholds(metrics);

            if (!thresholdCheck.passed) {
              console.warn(`⚠️  Threshold violations detected:`);
              thresholdCheck.failures.forEach((failure: any) => console.warn(`  - ${failure}`));
            }

            // Take screenshot for successful run if configured
            if (config.reporting.generateScreenshots) {
              await loginPage.takeScreenshot(`success_${app.name.replace(/\s+/g, '_')}_run_${iteration}`);
            }

          } catch (error) {
            testError = error instanceof Error ? error.message : String(error);
            console.error(`❌ ${app.name} - Run ${iteration} failed:`, testError);
            throw error;

          } finally {
            // Store performance data in test annotation for reporter
            if (metrics) {
              test.info().annotations.push({
                type: 'performance-data',
                description: JSON.stringify({
                  appName: app.name,
                  metrics: metrics,
                  iteration: iteration,
                  error: testError
                })
              });
            }

            // Wait cooldown period between runs
            if (iteration < config.test.iterations && config.test.cooldownBetweenRuns > 0) {
              console.log(`⏳ Waiting ${config.test.cooldownBetweenRuns}ms before next run...`);
              await page.waitForTimeout(config.test.cooldownBetweenRuns);
            }

            // Restart browser if configured frequency is reached
            if (iteration % config.test.browserRestartFrequency === 0 && iteration < config.test.iterations) {
              console.log('🔄 Browser restart triggered by configuration');
              // Note: Browser restart is handled by Playwright's worker management
            }
          }
        });
      }
    });
  }
});
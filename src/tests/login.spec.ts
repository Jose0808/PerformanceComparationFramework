import { test, expect, Page, BrowserContext } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { ConfigManager } from '../config/ConfigManager';
import { MetricsCollector } from '../metrics/MetricsCollector';
import { PerformanceComparator } from '../utils/PerformanceComparator';

test.describe('Performance Comparison - Login Flow', () => {
  let config: ConfigManager;
  let performanceComparator: PerformanceComparator;
    config = ConfigManager.getInstance();

  test.beforeAll(() => {
    performanceComparator = new PerformanceComparator();
    
    console.log('🔧 Test Configuration:');
    console.log(`Environment: ${config.test.environment}`);
    console.log(`Iterations: ${config.test.iterations}`);
    console.log(`Parallel instances: ${config.test.parallelInstances}`);
    console.log(`App1: ${config.app1.name} (${config.app1.technology})`);
    console.log(`App2: ${config.app2.name} (${config.app2.technology})`);
  });

  // Test setup for consistent browser configuration
  test.beforeEach(async ({ page, context }) => {
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
    test.describe(`${app.name} Performance Tests`, () => {
      
      // Generate multiple test runs based on iteration count
      for (let iteration = 1; iteration <= config.test.iterations; iteration++) {
        test(`Login Performance - ${app.name} - Run ${iteration}`, async ({ page }) => {
          const testStartTime = Date.now();
          
          console.log(`\n🚀 Starting ${app.name} - Run ${iteration}`);
          console.log(`URL: ${app.baseUrl}`);
          
          let loginPage: LoginPage;
          let metrics: any;
          let testError: string | undefined;

          try {           

            // Initialize page object
            loginPage = new LoginPage(page);

            // Enable network throttling
            await loginPage.enableNetworkThrottling();

            // Execute login flow with performance tracking
            const loginStartTime = Date.now();
            await loginPage.login(app);
            const loginEndTime = Date.now();

            // Collect performance metrics
            metrics = await loginPage.collectPerformanceMetrics();
            
            // Add test execution time
            metrics.customMetrics.test_execution_time = loginEndTime - loginStartTime;
            metrics.customMetrics.total_test_time = Date.now() - testStartTime;

            console.log(`✅ ${app.name} - Run ${iteration} completed successfully`);
            console.log(`🏃 Login time: ${metrics.customMetrics.total_login_time}ms`);
            console.log(`📊 LCP: ${metrics.lcp}ms, FCP: ${metrics.fcp}ms, TTFB: ${metrics.ttfb}ms`);

            // Validate against thresholds
            const metricsCollector = new MetricsCollector(page);
            const thresholdCheck = metricsCollector.checkThresholds(metrics);
            
            if (!thresholdCheck.passed) {
              console.warn(`⚠️  Threshold violations detected:`);
              thresholdCheck.failures.forEach(failure => console.warn(`  - ${failure}`));
            }

            // Take screenshot for successful run if configured
            if (config.reporting.generateScreenshots) {
              await loginPage.takeScreenshot(`success_${app.name.replace(/\s+/g, '_')}_run_${iteration}`);
            }

          } catch (error) {
            testError = error instanceof Error ? error.message : String(error);
            console.error(`❌ ${app.name} - Run ${iteration} failed:`, testError);

            // // Take screenshot for failed run
            // if (loginPage) {
            //   await loginPage.takeScreenshot(`failure_${app.name.replace(/\s+/g, '_')}_run_${iteration}`);
            // }

            // // Still try to collect partial metrics
            // try {
            //   if (loginPage) {
            //     metrics = await loginPage.collectPerformanceMetrics();
            //     metrics.customMetrics.test_execution_time = Date.now() - testStartTime;
            //     metrics.customMetrics.failed_test = 1;
            //   }
            // } catch (metricsError) {
            //   console.error('Failed to collect metrics after error:', metricsError);
            //   // Create minimal metrics object
            //   metrics = {
            //     customMetrics: {
            //       test_execution_time: Date.now() - testStartTime,
            //       failed_test: 1
            //     },
            //     jsErrors: [],
            //     consoleErrors: []
            //   };
            // }

            // Re-throw error to mark test as failed
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

  // Summary test that runs after all individual tests
  test.describe('Performance Analysis', () => {
    test('Generate Performance Comparison Report', async () => {
      test.setTimeout(60000); // Extended timeout for report generation
      
      console.log('\n📊 Generating performance comparison report...');
      
      // This test will be executed after all individual tests
      // The actual comparison and report generation is handled by the custom reporter
      // This test serves as a placeholder and summary point
      
      console.log('✅ Performance testing completed');
      console.log(`📁 Reports available at: ${config.reporting.outputPath}`);
      
      // Add summary information
      test.info().annotations.push({
        type: 'test-summary',
        description: JSON.stringify({
          totalApps: config.getAllApps().length,
          iterationsPerApp: config.test.iterations,
          environment: config.test.environment,
          networkConditions: config.test.networkConditions,
          timestamp: new Date().toISOString()
        })
      });
    });
  });
});

/**
 * Parametrized test generator for parallel execution
 */
function generateParametrizedTests() {
  const config = ConfigManager.getInstance();
  const testCases = [];

  for (const app of config.getAllApps()) {
    for (let iteration = 1; iteration <= config.test.iterations; iteration++) {
      testCases.push({
        appName: app.name,
        appConfig: app,
        iteration: iteration,
        testId: `${app.name}_iteration_${iteration}`.replace(/\s+/g, '_').toLowerCase()
      });
    }
  }

  return testCases;
}

// Export test cases for potential use in custom runners
export { generateParametrizedTests };
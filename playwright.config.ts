import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
config();

const resourcesPathFromProcess = (process as any).resourcesPath || '';
const packagedResourcesBase = process.env.PACKAGED_RESOURCES || (resourcesPathFromProcess ? path.join(resourcesPathFromProcess, 'resources') : '');
const resolvePlaywrightResource = (sub: string) => packagedResourcesBase ? path.join(packagedResourcesBase, sub) : path.join(__dirname, sub);

const {
  // Browser & Device Configuration
  BROWSER_TYPE = 'chromium',
  HEADLESS_MODE = 'true',
  VIEWPORT_WIDTH = '1920',
  VIEWPORT_HEIGHT = '1080',
  DEVICE_TYPE = 'desktop',
  DISABLE_IMAGES = 'false',
  DISABLE_JAVASCRIPT = 'false',

  // Test Execution Strategy
  WORKER_COUNT = '1',
  RUN_PARALLEL = 'true',
  ITERATION_COUNT = '1',
  RETRY_COUNT = '1',
  CONTINUE_ON_FAILURE = 'true',
  MAX_CONSECUTIVE_FAILURES = '1',

  // Timeouts
  LOAD_TIMEOUT = '15000',
  SCENARIO_TIMEOUT_MULTIPLIER = '1.5',

  // Output & Reporting
  OUTPUT_PATH = './reports',
  GENERATE_SCREENSHOTS = 'true',
  GENERATE_VIDEO_RECORDING = 'true',
  GENERATE_TRACE_FILES = 'true',
  REPORT_FORMAT = 'html,json',

  // Environment
  ENVIRONMENT = 'pre',
  PARALLEL_INSTANCES = '2',
  ITERATIONS = '3',

  // Logging
  LOG_LEVEL = 'info',

  // Failure Handling
  FAILURE_SCREENSHOT = 'true',
} = process.env;

/* Detectar si Electron instalado */
const resourcesBrowsersPath = path.join(process.resourcesPath || '', 'browsers');
if (fs.existsSync(resourcesBrowsersPath)) {
  process.env.PLAYWRIGHT_BROWSERS_PATH = resourcesBrowsersPath;
  console.log(`Usando navegadores empaquetados en: ${resourcesBrowsersPath}`);
} else {
  console.log(`Usando navegadores Playwright por defecto (node_modules)`);
}

// Parse boolean values
const isHeadless = HEADLESS_MODE === 'true';
const isParallel = RUN_PARALLEL === 'true';
const generateScreenshots = GENERATE_SCREENSHOTS === 'true';
const generateVideo = GENERATE_VIDEO_RECORDING === 'true';
const generateTrace = GENERATE_TRACE_FILES === 'true';
const failureScreenshot = FAILURE_SCREENSHOT === 'true';

// Parse numeric values
const viewportWidth = parseInt(VIEWPORT_WIDTH);
const viewportHeight = parseInt(VIEWPORT_HEIGHT);
const workerCount = parseInt(WORKER_COUNT);
const retries = parseInt(RETRY_COUNT);
const maxConsecutiveFailures = parseInt(MAX_CONSECUTIVE_FAILURES);
const loadTimeout = parseInt(LOAD_TIMEOUT);
const scenarioTimeoutMultiplier = parseFloat(SCENARIO_TIMEOUT_MULTIPLIER);

// Configure reporters based on FORMAT
const reporters: any = [];
if (REPORT_FORMAT.includes('html')) {
  reporters.push(['html', {
    outputFolder: path.join(OUTPUT_PATH, 'playwright-report'),
    open: 'never'
  }]);
}
if (REPORT_FORMAT.includes('json')) {
  reporters.push(['json', {
    outputFile: path.join(OUTPUT_PATH, 'test-results.json')
  }]);
}
if (REPORT_FORMAT.includes('junit')) {
  reporters.push(['junit', {
    outputFile: path.join(OUTPUT_PATH, 'junit-results.xml')
  }]);
}


const isDev = ENVIRONMENT !== 'pro';

// Add custom performance reporter
reporters.push([isDev ? './src/reporters/performance-reporter.ts' : './src/reporters/performance-reporter.js']);

export default defineConfig({
  testDir: resolvePlaywrightResource('src/tests'),
  outputDir: path.join(resolvePlaywrightResource('reports'), 'test-results'),

  /* Reporter configuration */
  reporter: reporters,

  /* Test configuration */
  timeout: loadTimeout * scenarioTimeoutMultiplier,
  expect: {
    timeout: loadTimeout
  },

  fullyParallel: isParallel,
  forbidOnly: !!process.env.CI,
  retries: retries,
  workers: process.env.CI ? 1 : workerCount,
  maxFailures: maxConsecutiveFailures,

  /* Global test setup */
  globalSetup: isDev ? './src/setup/GlobalSetup.ts' : './src/setup/GlobalSetup.js',
  globalTeardown: isDev ? './src/setup/GlobalTeardown.ts' : './src/setup/GlobalTeardown.js',

  /* Shared settings for all projects */
  use: {
    actionTimeout: loadTimeout,
    navigationTimeout: loadTimeout,

    /* Capture options */
    screenshot: generateScreenshots ? (failureScreenshot ? 'only-on-failure' : 'on') : 'off',
    video: generateVideo ? 'on' : 'off',
    trace: generateTrace ? 'on' : 'off',

    /* Viewport */
    viewport: {
      width: viewportWidth,
      height: viewportHeight
    },

    // No usar storage state global por defecto
    storageState: undefined,

    /* Ignore HTTPS errors */
    ignoreHTTPSErrors: true,

    /* Custom context options */
    extraHTTPHeaders: {
      'X-Test-Environment': ENVIRONMENT,
      'X-Test-Browser': BROWSER_TYPE
    }
  },

  /* Configure projects for different browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices[DEVICE_TYPE === 'desktop' ? 'Desktop Chrome' : 'Desktop Chrome HiDPI'],
        headless: isHeadless,
        channel: BROWSER_TYPE === 'chrome' ? 'chrome' : undefined
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: isHeadless
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        headless: isHeadless
      },
    }
  ].filter(project =>
    BROWSER_TYPE === 'all' ||
    project.name === BROWSER_TYPE ||
    (BROWSER_TYPE === 'chrome' && project.name === 'chromium')
  ),

  /* Global environment metadata */
  metadata: {
    environment: ENVIRONMENT,
    browserType: BROWSER_TYPE,
    viewport: `${viewportWidth}x${viewportHeight}`,
    parallel: isParallel,
    iterations: ITERATION_COUNT,
    parallelInstances: PARALLEL_INSTANCES,
    logLevel: LOG_LEVEL
  },

  /* Global test options */
  globalTimeout: loadTimeout * parseInt(ITERATIONS) * 2,

  /* Report output configuration */
  reportSlowTests: null,
  preserveOutput: 'always'
});

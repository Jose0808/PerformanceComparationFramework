import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

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
  ITERATION_COUNT = '5',
  RETRY_COUNT = '2',
  CONTINUE_ON_FAILURE = 'true',
  MAX_CONSECUTIVE_FAILURES = '3',

  // Timeouts
  LOAD_TIMEOUT = '15000',
  SCENARIO_TIMEOUT_MULTIPLIER = '1.5',

  // Output & Reporting
  OUTPUT_PATH = './reports',
  GENERATE_SCREENSHOTS = 'true',
  GENERATE_VIDEO_RECORDING = 'false',
  GENERATE_TRACE_FILES = 'true',
  REPORT_FORMAT = 'html,json',

  // Environment
  ENVIRONMENT = 'pre',
  NETWORK_CONDITIONS = '4g',
  PARALLEL_INSTANCES = '1',
  ITERATIONS = '3',

  // Logging
  LOG_LEVEL = 'info',

  // Resource Monitoring
  MEMORY_THRESHOLD_MB = '2048',
  CPU_THRESHOLD_PERCENTAGE = '80',

  // Failure Handling
  FAILURE_SCREENSHOT = 'true',

  // Network Throttling
  NETWORK_DOWNLOAD_THROUGHPUT = '1500000',
  NETWORK_UPLOAD_THROUGHPUT = '750000',
  NETWORK_LATENCY = '20',
  NETWORK_PACKET_LOSS = '0'
} = process.env;

// Parse boolean values
const isHeadless = HEADLESS_MODE === 'true';
const isParallel = RUN_PARALLEL === 'true';
const continueOnFailure = CONTINUE_ON_FAILURE === 'true';
const disableImages = DISABLE_IMAGES === 'true';
const disableJavaScript = DISABLE_JAVASCRIPT === 'true';
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
const memoryThreshold = parseInt(MEMORY_THRESHOLD_MB);
const cpuThreshold = parseInt(CPU_THRESHOLD_PERCENTAGE);
const downloadThroughput = parseInt(NETWORK_DOWNLOAD_THROUGHPUT);
const uploadThroughput = parseInt(NETWORK_UPLOAD_THROUGHPUT);
const latency = parseInt(NETWORK_LATENCY);
const packetLoss = parseInt(NETWORK_PACKET_LOSS);

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

// Add custom performance reporter
reporters.push(['./src/reporters/PerformanceReporter.ts']);

export default defineConfig({
  testDir: './src/tests',
  outputDir: path.join(OUTPUT_PATH, 'test-results'),

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
  globalSetup: './src/setup/GlobalSetup.ts',
  globalTeardown: './src/setup/GlobalTeardown.ts',

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

    /* Network conditions */
    ...(NETWORK_CONDITIONS !== 'none' && {
      launchOptions: {
        args: [
          `--disable-images=${disableImages}`,
          `--disable-javascript=${disableJavaScript}`,
          `--network-throughput=${downloadThroughput},${uploadThroughput}`,
          `--network-latency=${latency}`,
          `--network-packet-loss=${packetLoss}`
        ]
      }
    }),

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
    networkConditions: NETWORK_CONDITIONS,
    parallel: isParallel,
    iterations: ITERATION_COUNT,
    parallelInstances: PARALLEL_INSTANCES,
    memoryThreshold: `${memoryThreshold}MB`,
    cpuThreshold: `${cpuThreshold}%`,
    logLevel: LOG_LEVEL
  },

  /* Global test options */
  globalTimeout: loadTimeout * parseInt(ITERATIONS) * 2,

  /* Report output configuration */
  reportSlowTests: null,
  preserveOutput: 'always'
});
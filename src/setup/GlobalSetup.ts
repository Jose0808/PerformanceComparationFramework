import { FullConfig } from '@playwright/test';
import { ConfigManager } from '../config/ConfigManager';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Global setup that runs once before all tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('\n🚀 Starting Global Setup...');
  
  const appConfig = ConfigManager.getInstance();
  
  try {
    // Create necessary directories
    await createDirectories(appConfig);
    
    // Validate configuration
    await validateConfiguration(appConfig);
    
    // Display test configuration
    displayTestConfiguration(appConfig, config);
    
    console.log('✅ Global Setup completed successfully\n');
    
  } catch (error) {
    console.error('❌ Global Setup failed:', error);
    throw error;
  }
}

/**
 * Create necessary directories for reports and artifacts
 */
async function createDirectories(config: ConfigManager): Promise<void> {
  console.log('📁 Creating directories...');
  
  const directories = [
    config.reporting.outputPath,
    // path.join(config.reporting.outputPath, 'screenshots'),
    // path.join(config.reporting.outputPath, 'videos'),
    // // path.join(config.reporting.outputPath, 'traces'),
    // // path.join(config.reporting.outputPath, 'raw-data'),
    // 'allure-results',
    // 'test-results'
  ];

  for (const dir of directories) {
    try {
      await fs.mkdir(dir, { recursive: true });
      console.log(`  ✅ Created: ${dir}`);
    } catch (error) {
      console.error(`  ❌ Failed to create ${dir}:`, error);
      throw error;
    }
  }
}

/**
 * Validate test configuration and environment variables
 */
async function validateConfiguration(config: ConfigManager): Promise<void> {
  console.log('🔧 Validating configuration...');
  
  const validations = [
    {
      name: 'App1 Configuration',
      check: () => config.app1.name && config.app1.baseUrl && config.app1.username && config.app1.password
    },
    {
      name: 'App2 Configuration', 
      check: () => config.app2.name && config.app2.baseUrl && config.app2.username && config.app2.password
    },
    {
      name: 'Test Parameters',
      check: () => config.test.iterations > 0 && config.test.parallelInstances > 0
    },
    {
      name: 'Output Directory',
      check: () => config.reporting.outputPath && config.reporting.outputPath.length > 0
    },
    {
      name: 'Network Configuration',
      check: () => config.network.downloadThroughput > 0 && config.network.uploadThroughput > 0
    }
  ];

  for (const validation of validations) {
    try {
      if (validation.check()) {
        console.log(`  ✅ ${validation.name}: Valid`);
      } else {
        console.error(`  ❌ ${validation.name}: Invalid`);
        throw new Error(`Configuration validation failed: ${validation.name}`);
      }
    } catch (error) {
      console.error(`  ❌ ${validation.name}: Error -`, error);
      throw error;
    }
  }

  // Validate URLs are accessible
  await validateUrlsAccessibility(config);
}

/**
 * Validate that application URLs are accessible
 */
async function validateUrlsAccessibility(config: ConfigManager): Promise<void> {
  console.log('🌐 Validating URL accessibility...');
  
  const urls = [
    { name: config.app1.name, url: config.app1.baseUrl },
    { name: config.app2.name, url: config.app2.baseUrl }
  ];

  for (const { name, url } of urls) {
    try {
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      });
      
      if (response.ok) {
        console.log(`  ✅ ${name} (${url}): Accessible`);
      } else {
        console.warn(`  ⚠️  ${name} (${url}): HTTP ${response.status}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  ${name} (${url}): ${error}`);
      console.warn('    Note: URL validation failed, but tests will continue');
    }
  }
}

/**
 * Display test configuration summary
 */
function displayTestConfiguration(appConfig: ConfigManager, playwrightConfig: FullConfig): void {
  console.log('\n📋 Test Configuration Summary:');
  console.log('=' .repeat(60));
  
  // Application Configuration
  console.log('\n🎯 Applications:');
  console.log(`  App 1: ${appConfig.app1.name} (${appConfig.app1.technology})`);
  console.log(`    URL: ${appConfig.app1.baseUrl}`);
  console.log(`    Account: ${appConfig.app1.accountType}`);
  
  console.log(`  App 2: ${appConfig.app2.name} (${appConfig.app2.technology})`);
  console.log(`    URL: ${appConfig.app2.baseUrl}`);
  console.log(`    Account: ${appConfig.app2.accountType}`);
  
  // Test Configuration
  console.log('\n⚙️  Test Settings:');
  console.log(`  Environment: ${appConfig.test.environment}`);
  console.log(`  Timeout: ${appConfig.test.timeout}`);
  console.log(`  Iterations per app: ${appConfig.test.iterations}`);
  console.log(`  Parallel instances: ${appConfig.test.parallelInstances}`);
  console.log(`  Cooldown between runs: ${appConfig.test.cooldownBetweenRuns}ms`);
  console.log(`  Browser restart frequency: every ${appConfig.test.browserRestartFrequency} runs`);
  
  // Network Configuration
  console.log('\n🌐 Network Settings:');
  console.log(`  Conditions: ${appConfig.test.networkConditions}`);
  console.log(`  Download: ${(appConfig.network.downloadThroughput / 1000000).toFixed(1)} Mbps`);
  console.log(`  Upload: ${(appConfig.network.uploadThroughput / 1000000).toFixed(1)} Mbps`);
  console.log(`  Latency: ${appConfig.network.latency}ms`);
  
  // Monitoring Configuration
  console.log('\n📊 Monitoring:');
  console.log(`  Web Vitals: ${appConfig.monitoring.captureWebVitals ? '✅' : '❌'}`);
  console.log(`  Network Metrics: ${appConfig.monitoring.captureNetworkMetrics ? '✅' : '❌'}`);
  console.log(`  Custom Metrics: ${appConfig.monitoring.captureCustomMetrics ? '✅' : '❌'}`);
  console.log(`  Memory Usage: ${appConfig.monitoring.monitorMemoryUsage ? '✅' : '❌'}`);
  console.log(`  Console Logs: ${appConfig.monitoring.captureConsoleLogs ? '✅' : '❌'}`);
  
  // Reporting Configuration
  console.log('\n📄 Reporting:');
  console.log(`  Output Path: ${appConfig.reporting.outputPath}`);
  console.log(`  Formats: ${appConfig.reporting.reportFormat.join(', ')}`);
  console.log(`  Screenshots: ${appConfig.reporting.generateScreenshots ? '✅' : '❌'}`);
  console.log(`  Videos: ${appConfig.reporting.generateVideoRecording ? '✅' : '❌'}`);
  
  // Playwright Configuration
  console.log('\n🎭 Playwright Settings:');
  console.log(`  Workers: ${playwrightConfig.workers}`);
  console.log(`  Retries: ${playwrightConfig.projects[0].retries}`);
  console.log(`  Timeout: ${playwrightConfig.projects[0].timeout}ms`);
  console.log(`  Fully Parallel: ${playwrightConfig.fullyParallel ? '✅' : '❌'}`);
  
  // Performance Thresholds
  console.log('\n🎯 Performance Thresholds:');
  console.log(`  LCP: ${appConfig.thresholds.lcp}ms`);
  console.log(`  FID: ${appConfig.thresholds.fid}ms`);
  console.log(`  CLS: ${appConfig.thresholds.cls}`);
  console.log(`  TTFB: ${appConfig.thresholds.ttfb}ms`);
  console.log(`  Login Time: ${appConfig.thresholds.loginTime}ms`);
  
  console.log('\n' + '='.repeat(60));
}

export default globalSetup;
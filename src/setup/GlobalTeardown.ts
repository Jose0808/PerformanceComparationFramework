import { FullConfig } from '@playwright/test';
import type { FullResult } from '@playwright/test/reporter';
import { ConfigManager } from '../config/ConfigManager';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Global teardown that runs once after all tests complete
 */
async function globalTeardown(config: FullConfig, result: FullResult): Promise<void> {
  console.log('\n🏁 Starting Global Teardown...');

  const appConfig = ConfigManager.getInstance();

  try {
    // Update performance tracking
    //await updatePerformanceTracking(result);

    // Generate final summary
    //await generateFinalSummary(appConfig, result);

    // Cleanup temporary files
    await cleanupTempFiles(appConfig);

    // Archive results if configured
    //await archiveResults(appConfig);

    // Send notifications if configured
    await sendNotifications(appConfig, result);

    console.log('✅ Global Teardown completed successfully');
    console.log(`📊 Final reports available at: ${appConfig.reporting.outputPath}`);

  } catch (error) {
    console.error('❌ Global Teardown failed:', error);
    // Don't throw error - teardown failures shouldn't affect test results
  }
}


/**
 * Generate human-readable summary
 */
async function generateSummary(config: ConfigManager, summary: any): Promise<void> {
  const summaryLines = [
    '='.repeat(60),
    'Latency test EXECUTION SUMMARY',
    '='.repeat(60),
    '',
    `Test Date: ${new Date(summary.metadata.timestamp).toLocaleString()}`,
    `Environment: ${summary.metadata.environment.toUpperCase()}`,
    `Duration: ${Math.round(summary.testExecution.duration / 1000)}s`,
    '',
    'APPLICATIONS TESTED:',
    `-${summary.metadata.applications.app1.name} (${summary.metadata.applications.app1.technology})`,
    `  URL: ${summary.metadata.applications.app1.baseUrl}`,
    `-${summary.metadata.applications.app2.name} (${summary.metadata.applications.app2.technology})`,
    `  URL: ${summary.metadata.applications.app2.baseUrl}`,
    '',
    'TEST RESULTS:',
    `Total Tests: ${summary.testExecution.totalTests}`,
    `✅ Passed: ${summary.testExecution.passedTests}`,
    `❌ Failed: ${summary.testExecution.failedTests}`,
    `⏭️ Skipped: ${summary.testExecution.skippedTests}`,
    `Success Rate: ${summary.testExecution.totalTests > 0 ?
      Math.round(summary.testExecution.passedTests / summary.testExecution.totalTests * 100) : 0}%`,
    '',
    'CONFIGURATION:',
    `Iterations per app: ${summary.metadata.testConfiguration.iterations}`,
    `Parallel instances: ${summary.metadata.testConfiguration.parallelInstances}`,
    `Network conditions: ${summary.metadata.testConfiguration.networkConditions}`,
    '',
    'ARTIFACTS GENERATED:',
    `📄 Reports: ${summary.artifacts.reportsGenerated.join(', ')}`,
    `📸 Screenshots: ${summary.artifacts.screenshotsCount}`,
    `🎥 Videos: ${summary.artifacts.videosCount}`,
    '',
    'NEXT STEPS:',
    '1. Review the detailed performance comparison report',
    '2. Check individual application reports for specific metrics',
    '3. Examine dashboard for visual performance trends',
    `4. All reports available at: ${config.reporting.outputPath}`,
    '',
    '='.repeat(60)
  ];

  const summaryText = summaryLines.join('\n');
  const summaryTextFile = path.join(config.reporting.outputPath, 'SUMMARY.txt');

  await fs.writeFile(summaryTextFile, summaryText);

  // Also log to console
  console.log('\n' + summaryText);
}


/**
 * Cleanup temporary files
 */
async function cleanupTempFiles(config: ConfigManager): Promise<void> {
  console.log('🧹 Cleaning up temporary files...');

  const tempDirectories = [
    'temp',
    '.temp',
    'tmp'
  ];

  for (const dir of tempDirectories) {
    try {
      await fs.rm(dir, { recursive: true });
      console.log(`  ✅ Cleaned up: ${dir}`);
    } catch {
      // Directory doesn't exist or can't be removed - ignore
    }
  }
}

/**
 * Archive results if configured
 */
async function archiveResults(config: ConfigManager): Promise<void> {
  // This could be extended to create ZIP archives, upload to cloud storage, etc.
  console.log('📦 Archiving results...');

  try {
    // Create archive timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveInfo = {
      timestamp,
      environment: config.test.environment,
      applications: [config.app1.name, config.app2.name],
      totalIterations: config.test.iterations * 2
    };

    const archiveInfoFile = path.join(config.reporting.outputPath, 'archive-info.json');
    await fs.writeFile(archiveInfoFile, JSON.stringify(archiveInfo, null, 2));

    console.log('  ✅ Archive information created');

  } catch (error) {
    console.error('  ❌ Archiving failed:', error);
  }
}

/**
 * Send notifications if configured
 */
async function sendNotifications(config: ConfigManager, result: FullResult): Promise<void> {
  console.log('📧 Checking notification configuration...');

  // Check for Slack webhook
  if (process.env.SLACK_WEBHOOK_URL) {
    await sendSlackNotification(config, result);
  }

  // Check for email recipients
  if (process.env.EMAIL_RECIPIENTS) {
    console.log('  ℹ️  Email notification configured but not implemented');
  }

  if (!process.env.SLACK_WEBHOOK_URL && !process.env.EMAIL_RECIPIENTS) {
    console.log('  ℹ️  No notification channels configured');
  }
}

/**
 * Send Slack notification
 */
async function sendSlackNotification(config: ConfigManager, result: FullResult): Promise<void> {
  try {
    const testResults = await getTestResultsFromArtifacts();

    const webhookUrl = process.env.SLACK_WEBHOOK_URL!;

    const passedTests = testResults.expected;
    const totalTests = testResults.total;
    const successRate = totalTests > 0 ? Math.round(passedTests / totalTests * 100) : 0;

    const status = result.status === 'passed' ? '✅' : '❌';
    const statusColor = result.status === 'passed' ? 'good' : 'danger';

    const message = {
      text: `Latency test Results - ${config.test.environment.toUpperCase()}`,
      attachments: [{
        color: statusColor,
        fields: [
          {
            title: 'Test Status',
            value: `${status} ${result.status.toUpperCase()}`,
            short: true
          },
          {
            title: 'Success Rate',
            value: `${successRate}% (${passedTests}/${totalTests})`,
            short: true
          },
          {
            title: 'Applications',
            value: `${config.app1.name} vs ${config.app2.name}`,
            short: true
          },
          {
            title: 'Duration',
            value: `${Math.round((result.duration || 0) / 1000)}s`,
            short: true
          },
          {
            title: 'Reports',
            value: `Available at: ${config.reporting.outputPath}`,
            short: false
          }
        ],
        footer: 'Latency testing Automation',
        ts: Math.floor(Date.now() / 1000)
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message)
    });

    if (response.ok) {
      console.log('  ✅ Slack notification sent');
    } else {
      console.error(`  ❌ Slack notification failed: ${response.status}`);
    }

  } catch (error) {
    console.error('  ❌ Slack notification error:', error);
  }
}

/**
 * Lee los resultados de los tests desde los artefactos generados
 */
async function getTestResultsFromArtifacts() {
  try {
    const resultsPath = path.join('test-results', 'results.json');
    const data = await fs.readFile(resultsPath, 'utf-8');
    const results = JSON.parse(data);

    return {
      total: results.length,
      passed: results.filter((r: any) => r.status === 'passed').length,
      expected: results.filter((r: any) => r.status === 'expected').length,
      failed: results.filter((r: any) => r.status === 'failed').length,
      skipped: results.filter((r: any) => r.status === 'skipped').length
    };
  } catch (error) {
    console.warn('Could not read test results:', error);
    return { total: 0, passed: 0, failed: 0, skipped: 0 };
  }
}

export default globalTeardown;
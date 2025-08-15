#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Performance Test Runner Script
 * Executes performance tests and generates reports
 */

// Configuration
const config = {
  environment: process.env.TEST_ENVIRONMENT || 'pre',
  parallel: process.env.RUN_PARALLEL !== 'false',
  workers: process.env.WORKER_COUNT || '3',
  iterations: process.env.ITERATION_COUNT || '5',
  headed: process.env.HEADED === 'true',
  debug: process.env.DEBUG === 'true'
};

console.log('🚀 Performance Test Runner');
console.log('=' .repeat(40));
console.log(`Environment: ${config.environment}`);
console.log(`Parallel: ${config.parallel}`);
console.log(`Workers: ${config.workers}`);
console.log(`Iterations: ${config.iterations}`);
console.log(`Headed: ${config.headed}`);
console.log(`Debug: ${config.debug}`);
console.log('=' .repeat(40));

async function main() {
  try {
    // Ensure required directories exist
    ensureDirectories();
    
    // Clean previous results
    if (!config.debug) {
      cleanPreviousResults();
    }
    
    // Build the test command
    const testCommand = buildTestCommand();
    
    console.log('\n📊 Starting performance tests...');
    console.log(`Command: ${testCommand}\n`);
    
    // Execute tests
    execSync(testCommand, { 
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_ENVIRONMENT: config.environment,
        RUN_PARALLEL: config.parallel.toString(),
        WORKER_COUNT: config.workers,
        ITERATION_COUNT: config.iterations
      }
    });
    
    console.log('\n✅ Tests completed successfully!');
    
    // Generate reports
    await generateReports();
    
  } catch (error) {
    console.error('\n❌ Tests failed:', error.message);
    process.exit(1);
  }
}

function ensureDirectories() {
  const dirs = [
    'reports',
    'reports/screenshots',
    'allure-results',
    'allure-report'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

function cleanPreviousResults() {
  console.log('🧹 Cleaning previous results...');
  
  const dirsToClean = [
    'allure-results',
    'reports/screenshots',
    'test-results'
  ];
  
  dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

function buildTestCommand() {
  let command = 'npx playwright test src/tests/performance-comparison.spec.ts';
  
  // Add reporters
  command += ' --reporter=html,allure-playwright';
  
  // Add workers configuration
  if (config.parallel) {
    command += ` --workers=${config.workers}`;
  } else {
    command += ' --workers=1';
  }
  
  // Add headed mode
  if (config.headed) {
    command += ' --headed';
  }
  
  // Add debug mode
  if (config.debug) {
    command += ' --debug';
  }
  
  // Add timeout
  command += ' --timeout=60000';
  
  return command;
}

async function generateReports() {
  console.log('\n📊 Generating reports...');
  
  try {
    // Generate Allure report
    console.log('📈 Generating Allure report...');
    execSync('npx allure generate allure-results --clean -o allure-report', { stdio: 'pipe' });
    console.log('✅ Allure report generated');
    
    // Generate custom summary report
    generateSummaryReport();
    
    console.log('\n📋 Reports generated:');
    console.log('  📄 HTML Report: test-results/index.html');
    console.log('  📊 Allure Report: allure-report/index.html');
    console.log('  📝 Summary Report: reports/summary.json');
    
    console.log('\n🔍 To view reports:');
    console.log('  npm run report        # Playwright HTML report');
    console.log('  npm run report:allure  # Allure interactive report');
    
  } catch (error) {
    console.warn('⚠️  Report generation failed:', error.message);
  }
}

function generateSummaryReport() {
  const summaryPath = path.join('reports', 'summary.json');
  const timestamp = new Date().toISOString();
  
  const summary = {
    timestamp,
    environment: config.environment,
    configuration: config,
    testExecution: {
      status: 'completed',
      duration: 'See detailed reports for timing',
      iterations: config.iterations,
      workers: config.workers
    },
    reports: {
      htmlReport: 'test-results/index.html',
      allureReport: 'allure-report/index.html',
      detailedResults: 'allure-results/'
    }
  };
  
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('📝 Summary report generated');
}

// Handle process interruption
process.on('SIGINT', () => {
  console.log('\n🛑 Test execution interrupted');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test execution terminated');
  process.exit(1);
});

// Execute main function
if (require.main === module) {
  main();
}

module.exports = {
  config,
  main,
  buildTestCommand,
  generateReports
};
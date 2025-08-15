import { test, expect } from '@playwright/test';
import { MetricsResult, ComparisonResult } from '../types';
import { ScenarioRunner } from '../utils/scenario-runner';
import { PerformanceAnalyzer } from '../utils/performance-analyzer';
import { testConfig, getCurrentEnvironment, getIterationCount } from '../config/environments';

// Test results storage
let app1Results: MetricsResult[] = [];
let app2Results: MetricsResult[] = [];
let comparisonResults: ComparisonResult[] = [];

test.describe('Performance Comparison Tests', () => {
  const environment = getCurrentEnvironment();
  const iterationCount = getIterationCount();
  const scenarios = testConfig.execution.scenarios;
  test.beforeAll(async () => {
    console.log(`\n🚀 Starting Performance Comparison Tests`);
    console.log(`📊 Environment: ${environment}`);
    console.log(`🔄 Iterations per scenario: ${iterationCount}`);
    console.log(`📝 Scenarios: ${scenarios.join(', ')}\n`);
  });

  // Test each scenario for both applications
  for (const scenarioName of scenarios) {
    test.describe(`Scenario: ${scenarioName}`, () => {
      
      // Test Application 1 (Legacy)
      test(`${scenarioName} - ${testConfig.applications.app1.name}`, async ({ page, context }) => {
        const appConfig = testConfig.applications.app1;
        const scenarioRunner = new ScenarioRunner(page, appConfig);
        
        // Set network conditions if specified
        const envConfig = testConfig.environments[environment];
        if (envConfig.networkConditions) {
          await context.route('**/*', async route => {
            await route.continue();
          });
        }

        const scenarioResults: MetricsResult[] = [];

        // Run multiple iterations
        for (let iteration = 1; iteration <= iterationCount; iteration++) {
          console.log(`\n📱 ${appConfig.name} - ${scenarioName} - Iteration ${iteration}/${iterationCount}`);
          
          try {
            const result = await scenarioRunner.runScenarioWithAuth(
              scenarioName,
              environment,
              iteration,
              scenarioName !== 'login' // Don't require login for login scenario
            );

            scenarioResults.push(result);
            console.log(`✅ Completed in ${result.performanceMetrics.totalPageLoadTime}ms`);
            
            // Add delay between iterations
            await page.waitForTimeout(2000);
            
          } catch (error) {
            console.error(`❌ Iteration ${iteration} failed:`, error);
            throw error;
          }
        }

        // Store results for comparison
        app1Results.push(...scenarioResults);
        
        // Basic assertions
        const avgLoadTime = scenarioResults.reduce((sum, r) => sum + r.performanceMetrics.totalPageLoadTime, 0) / scenarioResults.length;
        const expectedThreshold = testConfig.execution.thresholds.totalLoadTime;
        
        console.log(`📊 Average load time: ${Math.round(avgLoadTime)}ms (threshold: ${expectedThreshold}ms)`);
        
        // Soft assertion - don't fail test if threshold exceeded
        if (avgLoadTime > expectedThreshold) {
          console.warn(`⚠️  Average load time exceeds threshold by ${Math.round(avgLoadTime - expectedThreshold)}ms`);
        }

        await scenarioRunner.cleanup();
      });

      // Test Application 2 (New)
      test(`${scenarioName} - ${testConfig.applications.app2.name}`, async ({ page, context }) => {
        const appConfig = testConfig.applications.app2;
        const scenarioRunner = new ScenarioRunner(page, appConfig);
        
        // Set network conditions if specified
        const envConfig = testConfig.environments[environment];
        if (envConfig.networkConditions) {
          await context.route('**/*', async route => {
            await route.continue();
          });
        }

        const scenarioResults: MetricsResult[] = [];

        // Run multiple iterations
        for (let iteration = 1; iteration <= iterationCount; iteration++) {
          console.log(`\n🆕 ${appConfig.name} - ${scenarioName} - Iteration ${iteration}/${iterationCount}`);
          
          try {
            const result = await scenarioRunner.runScenarioWithAuth(
              scenarioName,
              environment,
              iteration,
              scenarioName !== 'login' // Don't require login for login scenario
            );

            scenarioResults.push(result);
            console.log(`✅ Completed in ${result.performanceMetrics.totalPageLoadTime}ms`);
            
            // Add delay between iterations
            await page.waitForTimeout(2000);
            
          } catch (error) {
            console.error(`❌ Iteration ${iteration} failed:`, error);
            throw error;
          }
        }

        // Store results for comparison
        app2Results.push(...scenarioResults);
        
        // Basic assertions
        const avgLoadTime = scenarioResults.reduce((sum, r) => sum + r.performanceMetrics.totalPageLoadTime, 0) / scenarioResults.length;
        const expectedThreshold = testConfig.execution.thresholds.totalLoadTime;
        
        console.log(`📊 Average load time: ${Math.round(avgLoadTime)}ms (threshold: ${expectedThreshold}ms)`);
        
        // Soft assertion
        if (avgLoadTime > expectedThreshold) {
          console.warn(`⚠️  Average load time exceeds threshold by ${Math.round(avgLoadTime - expectedThreshold)}ms`);
        }

        await scenarioRunner.cleanup();
      });
    });
  }

  test.afterAll(async () => {
    console.log('\n🔍 Analyzing Results...\n');
    
    // Perform comparison analysis
    for (const scenarioName of scenarios) {
      const app1ScenarioResults = app1Results.filter(r => r.scenario === scenarioName);
      const app2ScenarioResults = app2Results.filter(r => r.scenario === scenarioName);
      
      if (app1ScenarioResults.length > 0 && app2ScenarioResults.length > 0) {
        const comparison = PerformanceAnalyzer.compareApplications(
          app1ScenarioResults,
          app2ScenarioResults,
          scenarioName
        );
        
        comparisonResults.push(...comparison);
        
        // Log comparison results
        console.log(`\n📊 ${scenarioName.toUpperCase()} COMPARISON RESULTS:`);
        console.log('=' .repeat(50));
        
        for (const comp of comparison) {
          const winner = comp.winner === 'app1' ? testConfig.applications.app1.name : 
                        comp.winner === 'app2' ? testConfig.applications.app2.name : 'TIE';
          
          const improvement = comp.improvement > 0 ? `${comp.improvement}% faster` : 
                            comp.improvement < 0 ? `${Math.abs(comp.improvement)}% slower` : 'no change';
          
          console.log(`${comp.metric.toUpperCase()}:`);
          console.log(`  ${testConfig.applications.app1.name}: ${comp.app1.mean}ms (±${comp.app1.standardDeviation}ms)`);
          console.log(`  ${testConfig.applications.app2.name}: ${comp.app2.mean}ms (±${comp.app2.standardDeviation}ms)`);
          console.log(`  Winner: ${winner} (${improvement})`);
          console.log(`  Significant: ${comp.significantDifference ? 'Yes' : 'No'}\n`);
        }
      }
    }

    // Generate overall summary
    generateOverallSummary();
    
    // Check for regressions
    checkForRegressions();
    
    // Generate recommendations
    generateRecommendations();
  });
});

/**
 * Generate overall performance summary
 */
function generateOverallSummary(): void {
  console.log('\n🎯 OVERALL PERFORMANCE SUMMARY');
  console.log('=' .repeat(50));
  
  let app1Wins = 0;
  let app2Wins = 0;
  let ties = 0;
  
  for (const comp of comparisonResults) {
    if (comp.winner === 'app1') app1Wins++;
    else if (comp.winner === 'app2') app2Wins++;
    else ties++;
  }
  
  const total = comparisonResults.length;
  const app1WinRate = (app1Wins / total * 100).toFixed(1);
  const app2WinRate = (app2Wins / total * 100).toFixed(1);
  
  console.log(`📱 ${testConfig.applications.app1.name}: ${app1Wins}/${total} wins (${app1WinRate}%)`);
  console.log(`🆕 ${testConfig.applications.app2.name}: ${app2Wins}/${total} wins (${app2WinRate}%)`);
  console.log(`🤝 Ties: ${ties}/${total} (${(ties / total * 100).toFixed(1)}%)`);
  
  const overallWinner = app1Wins > app2Wins ? testConfig.applications.app1.name :
                       app2Wins > app1Wins ? testConfig.applications.app2.name : 'TIE';
  
  console.log(`\n🏆 Overall Winner: ${overallWinner}`);
}

/**
 * Check for performance regressions
 */
function checkForRegressions(): void {
  const regressions = PerformanceAnalyzer.detectRegressions(comparisonResults, 15);
  
  if (regressions.length > 0) {
    console.log('\n⚠️  PERFORMANCE REGRESSIONS DETECTED');
    console.log('=' .repeat(50));
    
    for (const regression of regressions) {
      console.log(`❌ ${regression.scenario} - ${regression.metric}: ${Math.abs(regression.improvement)}% slower`);
    }
  } else {
    console.log('\n✅ No significant performance regressions detected');
  }
}

/**
 * Generate performance recommendations
 */
function generateRecommendations(): void {
  const recommendations = PerformanceAnalyzer.generateRecommendations(comparisonResults);
  
  if (recommendations.length > 0) {
    console.log('\n💡 PERFORMANCE RECOMMENDATIONS');
    console.log('=' .repeat(50));
    
    for (const recommendation of recommendations) {
      console.log(recommendation);
    }
  }
  
  console.log('\n📄 Detailed reports will be generated in the reports/ directory');
  console.log('🔍 Run "npm run report:allure" to view interactive reports');
}
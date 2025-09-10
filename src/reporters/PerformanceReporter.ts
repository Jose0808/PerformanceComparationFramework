import { Reporter, TestCase, TestResult, FullResult, Suite } from '@playwright/test/reporter';
import { ComparisonResult } from '../utils/PerformanceComparator';
import { MetricsCollector, PerformanceMetrics } from '../metrics/MetricsCollector';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ConfigManager } from '../config/ConfigManager';
import { networkInterfaces } from 'os';
import { ReportGenerator } from '../utils/report.utils';
import { TestExecution } from '../types/timer.types';

interface TestData {
  appName: string;
  metrics: PerformanceMetrics;
  duration: number;
  status: string;
  error?: string;
  networkLogs?: any[];
}

export default class PerformanceReporter implements Reporter {
  private testResults: TestData[] = [];
  private TimeResults: TestExecution[] = [];
  private onPremiseResult: TestExecution = {
    environment: '',
    testName: '',
    totalDuration: 0,
    steps: [],
    timestamp: new Date()
  };
  private cloudResult: TestExecution = {
    environment: '',
    testName: '',
    totalDuration: 0,
    steps: [],
    timestamp: new Date()
  };
  private config: ConfigManager;
  private outputDir: string;

  constructor() {
    this.config = ConfigManager.getInstance();
    this.outputDir = this.config.reporting.outputPath;
  }

  onBegin(config: any, suite: Suite) {
    console.log(`🚀 Starting performance comparison tests...`);
    console.log(`📊 Output directory: ${this.outputDir}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Extract performance data from test annotations
    const performanceData = test.annotations.find(a => a.type === 'performance-data');

    const res1 = test.annotations.find(a => a.type === 'performance-data-Cloud');
    const res2 = test.annotations.find(a => a.type === 'performance-data-OnPremise');
    if (res1 && res1.description) {
      this.cloudResult = JSON.parse(res1.description).data as TestExecution;
    }
    if (res2 && res2.description) {
      this.onPremiseResult = JSON.parse(res2.description).data as TestExecution;
    }

    if (performanceData && performanceData.description) {
      try {
        const data = JSON.parse(performanceData.description);
        this.testResults.push({
          appName: data.appName,
          metrics: data.metrics,
          duration: result.duration,
          status: result.status,
          error: result.error?.message,
          networkLogs: data.networkLogs
        });

      } catch (error) {
        console.error('Error parsing performance data:', error);
      }
    }
  }

  async onEnd(result: FullResult) {
    console.log(`🏁 Test execution completed. Status: ${result.status}`);

    if (this.testResults.length === 0) {
      console.log('❌ No performance data collected');
      return;
    }

    const comparison = ReportGenerator.generateComparison(this.onPremiseResult, this.cloudResult);

    // Mostrar reporte en consola
    ReportGenerator.generateConsoleReport(comparison);

    // Generar reporte HTML
    ReportGenerator.generateHTMLReport(comparison);

    // await this.generateReports();

  }

  private async generateReports() {
    try {
      // Ensure output directory exists
      await fs.mkdir(this.outputDir, { recursive: true });

      // Group results by app
      const groupedResults = this.groupResultsByApp();

      // Generate individual app reports
      await this.generateAppReports(groupedResults);

      // Generate comparison report if we have data for both apps
      const app1Results = groupedResults[this.config.app1.name];
      const app2Results = groupedResults[this.config.app2.name];

      if (app1Results && app2Results) {
        await this.generateComparisonReport(app1Results, app2Results);
      }

      // Generate summary dashboard
      await this.generateSummaryDashboard(groupedResults);

      console.log('📊 Performance reports generated successfully!');

    } catch (error) {
      console.error('❌ Error generating reports:', error);
    }
  }

  private groupResultsByApp(): Record<string, TestData[]> {
    const grouped: Record<string, TestData[]> = {};

    for (const result of this.testResults) {
      if (!grouped[result.appName]) {
        grouped[result.appName] = [];
      }
      grouped[result.appName].push(result);
    }

    return grouped;
  }

  private async generateAppReports(groupedResults: Record<string, TestData[]>) {
    for (const [appName, results] of Object.entries(groupedResults)) {
      const report = this.createAppReport(appName, results);
      const fileName = `${appName.replace(/\s+/g, '_').toLowerCase()}_report.html`;
      const filePath = path.join(this.outputDir, fileName);

      await fs.writeFile(filePath, report);
      console.log(`📄 Generated report for ${appName}: ${filePath}`);
    }
  }

  private createAppReport(appName: string, results: TestData[]): string {
    const successfulRuns = results.filter(r => r.status === 'passed');
    const failedRuns = results.filter(r => r.status !== 'passed');

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Report - ${appName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e0e0e0;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        .metric-title {
            font-weight: 600;
            color: #333;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: 700;
            color: #007bff;
        }
        .metric-unit {
            font-size: 14px;
            color: #666;
        }
        .runs-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .runs-table th, .runs-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        .runs-table th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .chart-container {
            margin: 20px 0;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 6px;
        }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Performance Report</h1>
            <h2>${appName}</h2>
            <p>Generated on ${new Date().toLocaleString()}</p>
            <p>Successful runs: ${successfulRuns.length} | Failed runs: ${failedRuns.length}</p>
        </div>

        ${this.generateMetricsSection(successfulRuns)}
        ${this.generateRunsTable(results)}
        ${this.generateChartsSection(successfulRuns)}
    </div>
</body>
</html>`;

    return html;
  }

  private generateMetricsSection(results: TestData[]): string {
    if (results.length === 0) {
      return '<div class="alert">No successful runs to display metrics</div>';
    }

    // Calculate average metrics
    const avgMetrics = this.calculateAverageMetrics(results);

    return `
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-title">Total Login Time</div>
                <div class="metric-value">${avgMetrics.total_login_time?.toFixed(0) || 'N/A'}</div>
                <div class="metric-unit">milliseconds</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Largest Contentful Paint</div>
                <div class="metric-value">${avgMetrics.lcp?.toFixed(0) || 'N/A'}</div>
                <div class="metric-unit">milliseconds</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">First Contentful Paint</div>
                <div class="metric-value">${avgMetrics.fcp?.toFixed(0) || 'N/A'}</div>
                <div class="metric-unit">milliseconds</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Time to First Byte</div>
                <div class="metric-value">${avgMetrics.ttfb?.toFixed(0) || 'N/A'}</div>
                <div class="metric-unit">milliseconds</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Total Load Time</div>
                <div class="metric-value">${avgMetrics.totalLoadTime?.toFixed(0) || 'N/A'}</div>
                <div class="metric-unit">milliseconds</div>
            </div>
            <div class="metric-card">
                <div class="metric-title">Network Requests</div>
                <div class="metric-value">${avgMetrics.requestCount?.toFixed(0) || 'N/A'}</div>
                <div class="metric-unit">requests</div>
            </div>
        </div>`;
  }

  private generateRunsTable(results: TestData[]): string {
    const rows = results.map((result, index) => `
        <tr>
            <td>${index + 1}</td>
            <td class="status-${result.status}">${result.status}</td>
            <td>${result.duration}ms</td>
            <td>${result.metrics.customMetrics.total_login_time?.toFixed(0) || 'N/A'}ms</td>
            <td>${result.metrics.lcp?.toFixed(0) || 'N/A'}ms</td>
            <td>${result.metrics.fcp?.toFixed(0) || 'N/A'}ms</td>
            <td>${result.metrics.jsErrors.length}</td>
            <td>${result.error || '-'}</td> 
        </tr>
    `).join('');

    return `
        <table class="runs-table">
            <thead>
                <tr>
                    <th>Run #</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Login Time</th>
                    <th>LCP</th>
                    <th>FCP</th>
                    <th>JS Errors</th>
                    <th>Error Message</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>`;
  }

  private generateChartsSection(results: TestData[]): string {
    if (results.length < 2) {
      return '';
    }

    return `
        <div class="chart-container">
            <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>
        <script>
            const ctx = document.getElementById('performanceChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: [${results.map((_, i) => `'Run ${i + 1}'`).join(',')}],
                    datasets: [{
                        label: 'Total Login Time (ms)',
                        data: [${results.map(r => r.metrics.customMetrics.total_login_time || 0).join(',')}],
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }, {
                        label: 'LCP (ms)',
                        data: [${results.map(r => r.metrics.lcp || 0).join(',')}],
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        </script>`;
  }

  private calculateAverageMetrics(results: TestData[]): Record<string, number> {
    const avgMetrics: Record<string, number> = {};

    if (results.length === 0) return avgMetrics;

    const metricSums: Record<string, number> = {};
    const metricCounts: Record<string, number> = {};

    for (const result of results) {
      // Process standard metrics
      for (const [key, value] of Object.entries(result.metrics)) {
        if (typeof value === 'number' && !isNaN(value)) {
          metricSums[key] = (metricSums[key] || 0) + value;
          metricCounts[key] = (metricCounts[key] || 0) + 1;
        }
      }

      // Process custom metrics
      for (const [key, value] of Object.entries(result.metrics.customMetrics)) {
        if (typeof value === 'number' && !isNaN(value)) {
          metricSums[key] = (metricSums[key] || 0) + value;
          metricCounts[key] = (metricCounts[key] || 0) + 1;
        }
      }


      // // Process custom metrics
      // result.metrics.networkLogs.forEach(element => {
      //   if (element.type === "response") {
      //     let partes = element.url.split("/");
      //     let key = partes[partes.length - 1];
      //     metricSums[key] = (metricSums[key] || 0) + element.duration;
      //     metricCounts[key] = (metricCounts[key] || 0) + 1;
      //   }
      // });
    }

    // Calculate averages
    for (const [key, sum] of Object.entries(metricSums)) {
      avgMetrics[key] = sum / metricCounts[key];
    }

    return avgMetrics;
  }

  private async generateComparisonReport(app1Results: TestData[], app2Results: TestData[]) {
    // This would integrate with the PerformanceComparator
    // For now, generate a simple comparison
    const app1Avg = this.calculateAverageMetrics(app1Results);
    const app2Avg = this.calculateAverageMetrics(app2Results);

    const comparisonHtml = this.createComparisonReport(app1Avg, app2Avg);
    const filePath = path.join(this.outputDir, 'comparison_report.html');

    await fs.writeFile(filePath, comparisonHtml);
    console.log(`📊 Generated comparison report: ${filePath}`);
  }

  private createComparisonReport(app1Metrics: Record<string, number>, app2Metrics: Record<string, number>): string {
    const comparisons = this.generateComparisons(app1Metrics, app2Metrics);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Comparison Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
        .comparison-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .comparison-table th, .comparison-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .comparison-table th { background-color: #f8f9fa; font-weight: 600; }
        .winner { background-color: #d4edda; font-weight: bold; }
        .loser { background-color: #f8d7da; }
        .tie { background-color: #fff3cd; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Reporte de comparación</h1>
            <h2>${this.config.app1.name} vs ${this.config.app2.name}</h2>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Metrica</th>
                    <th>${this.config.app1.name}</th>
                    <th>${this.config.app2.name}</th>
                    <th>Diferencia</th>
                    <th>Ganador</th>
                </tr>
            </thead>
            <tbody>
                ${comparisons}
            </tbody>
        </table>        
    </div>
</body>
</html>`;
  }

  private generateComparisons(app1Metrics: Record<string, number>, app2Metrics: Record<string, number>): string {
    const metrics = new Set([...Object.keys(app1Metrics), ...Object.keys(app2Metrics)]);
    const rows: string[] = [];

    for (const metric of metrics) {
      const app1Value = app1Metrics[metric] || 0;
      const app2Value = app2Metrics[metric] || 0;

      if (app1Value === 0 && app2Value === 0) continue;

      const difference = ((app2Value - app1Value) / app1Value * 100).toFixed(1);
      let winner = 'tie';
      let winnerClass = 'tie';

      if (Math.abs(parseFloat(difference)) > 5) {
        if (this.isLowerBetter(metric)) {
          winner = app1Value < app2Value ? this.config.app1.name : this.config.app2.name;
          winnerClass = app1Value < app2Value ? 'winner' : 'loser';
        } else {
          winner = app1Value > app2Value ? this.config.app1.name : this.config.app2.name;
          winnerClass = app1Value > app2Value ? 'winner' : 'loser';
        }
      }

      rows.push(`
        <tr>
          <td class= "metricName">${metric}</td>
          <td class="${winner === this.config.app1.name ? 'winner' : (winner === 'tie' ? 'tie' : 'loser')}">${app1Value.toFixed(1)}</td>
          <td class="${winner === this.config.app2.name ? 'winner' : (winner === 'tie' ? 'tie' : 'loser')}">${app2Value.toFixed(1)}</td>
          <td>${difference}%</td>
          <td class="${winnerClass}">${winner === 'tie' ? 'Empate' : winner}</td>
        </tr>
      `);
    }

    return rows.join('');
  }

  private isLowerBetter(metric: string): boolean {
    const lowerBetterMetrics = [
      'lcp', 'fid', 'cls', 'ttfb', 'fcp', 'totalLoadTime', 'domLoadTime',
      'networkTime', 'jsLoadTime', 'cssLoadTime', 'imageLoadTime', 'memoryUsage'
    ];

    return lowerBetterMetrics.includes(metric);
  }

  private async generateSummaryDashboard(groupedResults: Record<string, TestData[]>) {
    const dashboardHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Latencytest Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            min-height: 100vh;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .header h1 {
            font-size: 3rem;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .stat-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 25px;
            text-align: center;
            border: 1px solid rgba(255,255,255,0.2);
            transition: transform 0.3s ease;
        }
        .stat-card:hover {
            transform: translateY(-5px);
        }
        .stat-value {
            font-size: 3rem;
            font-weight: 700;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #fff, #f0f0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .stat-label {
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .apps-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 30px;
        }
        .app-card {
            background: rgba(255,255,255,0.1);
            backdrop-filter: blur(10px);
            border-radius: 15px;
            padding: 30px;
            border: 1px solid rgba(255,255,255,0.2);
        }
        .app-title {
            font-size: 1.8rem;
            margin-bottom: 20px;
            text-align: center;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        .metric-row:last-child {
            border-bottom: none;
        }
        .success { color: #4ade80; }
        .error { color: #f87171; }
        .warning { color: #fbbf24; }        
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Latencytest Dashboard</h1>
            <p>Application Performance Comparison Results</p>
            <p>${new Date().toLocaleString()}</p>
        </div>

        <div class="stats-grid">
            ${this.generateOverallStats(groupedResults)}
        </div>

        <div class="apps-grid">
            ${this.generateAppCards(groupedResults)}
        </div>
    </div>
</body>
</html>`;

    const filePath = path.join(this.outputDir, 'dashboard.html');
    await fs.writeFile(filePath, dashboardHtml);
    console.log(`🎯 Generated dashboard: ${filePath}`);
  }

  private generateOverallStats(groupedResults: Record<string, TestData[]>): string {
    const totalRuns = Object.values(groupedResults).flat().length;
    const successfulRuns = Object.values(groupedResults).flat().filter(r => r.status === 'passed').length;
    const failedRuns = totalRuns - successfulRuns;
    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns * 100).toFixed(1) : '0';

    return `
      <div class="stat-card">
        <div class="stat-value">${totalRuns}</div>
        <div class="stat-label">Total Test Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value success">${successfulRuns}</div>
        <div class="stat-label">Successful Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value error">${failedRuns}</div>
        <div class="stat-label">Failed Runs</div>
      </div>
      <div class="stat-card">
        <div class="stat-value ${parseFloat(successRate) >= 90 ? 'success' : parseFloat(successRate) >= 70 ? 'warning' : 'error'}">${successRate}%</div>
        <div class="stat-label">Success Rate</div>
      </div>
    `;
  }

  private generateAppCards(groupedResults: Record<string, TestData[]>): string {
    return Object.entries(groupedResults).map(([appName, results]) => {
      const successfulRuns = results.filter(r => r.status === 'passed');
      const avgMetrics = this.calculateAverageMetrics(successfulRuns);

      return `
        <div class="app-card">
          <h3 class="app-title">${appName}</h3>
          <div class="metric-row">
            <span>Total Runs:</span>
            <span>${results.length}</span>
          </div>
          <div class="metric-row">
            <span>Success Rate:</span>
            <span class="${successfulRuns.length === results.length ? 'success' : 'warning'}">${(successfulRuns.length / results.length * 100).toFixed(1)}%</span>
          </div>
          <div class="metric-row">
            <span>Avg Login Time:</span>
            <span>${avgMetrics.total_login_time?.toFixed(0) || 'N/A'}ms</span>
          </div>
          <div class="metric-row">
            <span>Avg LCP:</span>
            <span>${avgMetrics.lcp?.toFixed(0) || 'N/A'}ms</span>
          </div>
          <div class="metric-row">
            <span>Avg FCP:</span>
            <span>${avgMetrics.fcp?.toFixed(0) || 'N/A'}ms</span>
          </div>
          <div class="metric-row">
            <span>Avg TTFB:</span>
            <span>${avgMetrics.ttfb?.toFixed(0) || 'N/A'}ms</span>
          </div>
          <div class="metric-row">
            <span>JS Errors:</span>
            <span class="${results.some(r => r.metrics.jsErrors.length > 0) ? 'error' : 'success'}">${results.reduce((sum, r) => sum + r.metrics.jsErrors.length, 0)}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}
import { PerformanceMetrics } from '../metrics/MetricsCollector';
import { ConfigManager } from '../config/ConfigManager';
import * as stats from 'simple-statistics';

export interface ComparisonResult {
  app1Name: string;
  app2Name: string;
  app1Metrics: StatisticalMetrics;
  app2Metrics: StatisticalMetrics;
  comparison: MetricComparison[];
  winner: string;
  winnerByCategory: Record<string, string>;
  summary: ComparisonSummary;
  timestamp: string;
}

export interface StatisticalMetrics {
  runs: PerformanceMetrics[];
  statistics: {
    mean: Record<string, number>;
    median: Record<string, number>;
    standardDeviation: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
    percentile95: Record<string, number>;
  };
}

export interface MetricComparison {
  metricName: string;
  app1Value: number;
  app2Value: number;
  difference: number;
  percentageDifference: number;
  winner: string;
  significance: 'significant' | 'moderate' | 'minimal';
  category: string;
}

export interface ComparisonSummary {
  totalMetrics: number;
  app1Wins: number;
  app2Wins: number;
  ties: number;
  overallWinner: string;
  significantDifferences: number;
  averageImprovementPercentage: number;
  regressionDetected: boolean;
  regressionPercentage: number;
}

export class PerformanceComparator {
  private readonly config: ConfigManager;

  constructor() {
    this.config = ConfigManager.getInstance();
  }

  /**
   * Compare performance between two applications
   */
  compare(
    app1Name: string,
    app1Runs: PerformanceMetrics[],
    app2Name: string,
    app2Runs: PerformanceMetrics[]
  ): ComparisonResult {
    console.log(`🔄 Comparing performance between ${app1Name} and ${app2Name}`);

    const app1Stats = this.calculateStatistics(app1Runs);
    const app2Stats = this.calculateStatistics(app2Runs);

    const comparisons = this.compareMetrics(app1Stats, app2Stats);
    const winnerByCategory = this.calculateWinnerByCategory(comparisons);
    const summary = this.generateSummary(comparisons, app1Name, app2Name);

    const result: ComparisonResult = {
      app1Name,
      app2Name,
      app1Metrics: {
        runs: app1Runs,
        statistics: app1Stats
      },
      app2Metrics: {
        runs: app2Runs,
        statistics: app2Stats
      },
      comparison: comparisons,
      winner: summary.overallWinner,
      winnerByCategory,
      summary,
      timestamp: new Date().toISOString()
    };

    console.log(`🏆 Overall winner: ${summary.overallWinner}`);
    console.log(`📊 ${app1Name} wins: ${summary.app1Wins}, ${app2Name} wins: ${summary.app2Wins}`);

    return result;
  }

  /**
   * Calculate statistical metrics for a set of performance runs
   */
  private calculateStatistics(runs: PerformanceMetrics[]): StatisticalMetrics['statistics'] {
    const metricNames = this.getAllMetricNames(runs);

    const statistics: StatisticalMetrics['statistics'] = {
      mean: {},
      median: {},
      standardDeviation: {},
      min: {},
      max: {},
      percentile95: {}
    };

    for (const metricName of metricNames) {
      const values = this.extractMetricValues(runs, metricName);

      if (values.length > 0) {
        statistics.mean[metricName] = stats.mean(values);
        statistics.median[metricName] = stats.median(values);
        statistics.standardDeviation[metricName] = values.length > 1 ? stats.standardDeviation(values) : 0;
        statistics.min[metricName] = stats.min(values);
        statistics.max[metricName] = stats.max(values);
        statistics.percentile95[metricName] = stats.quantile(values, 0.95);
      }
    }

    return statistics;
  }

  /**
   * Get all unique metric names from runs
   */
  private getAllMetricNames(runs: PerformanceMetrics[]): string[] {
    const metricNames = new Set<string>();

    for (const run of runs) {
      // Core metrics
      metricNames.add('lcp');
      metricNames.add('fid');
      metricNames.add('cls');
      metricNames.add('ttfb');
      metricNames.add('fcp');
      metricNames.add('totalLoadTime');
      metricNames.add('domLoadTime');
      metricNames.add('networkTime');
      metricNames.add('jsLoadTime');
      metricNames.add('cssLoadTime');
      metricNames.add('imageLoadTime');
      metricNames.add('requestCount');
      metricNames.add('transferSize');

      // Custom metrics
      for (const customMetricName of Object.keys(run.customMetrics)) {
        metricNames.add(customMetricName);
      }

      // Memory metrics
      if (run.memoryUsage !== undefined) {
        metricNames.add('memoryUsage');
      }
    }

    return Array.from(metricNames);
  }

  /**
   * Extract metric values from runs
   */
  private extractMetricValues(runs: PerformanceMetrics[], metricName: string): number[] {
    return runs
      .map(run => {
        // Check if it's a custom metric
        if (run.customMetrics[metricName] !== undefined) {
          return run.customMetrics[metricName];
        }

        // Check if it's a standard metric
        const value = (run as any)[metricName];
        return typeof value === 'number' ? value : null;
      })
      .filter(value => value !== null && value !== undefined && !isNaN(value)) as number[];
  }

  /**
   * Compare metrics between two applications
   */
  private compareMetrics(
    app1Stats: StatisticalMetrics['statistics'],
    app2Stats: StatisticalMetrics['statistics']
  ): MetricComparison[] {
    const comparisons: MetricComparison[] = [];
    const allMetrics = new Set([...Object.keys(app1Stats.mean), ...Object.keys(app2Stats.mean)]);

    for (const metricName of allMetrics) {
      const app1Value = app1Stats.mean[metricName] || 0;
      const app2Value = app2Stats.mean[metricName] || 0;

      if (app1Value === 0 && app2Value === 0) continue;

      const difference = app2Value - app1Value;
      const percentageDifference = app1Value > 0 ? (difference / app1Value) * 100 : 0;

      let winner: string;
      if (Math.abs(percentageDifference) < 5) {
        winner = 'tie';
      } else {
        // For most metrics, lower is better
        winner = this.isLowerBetter(metricName)
          ? (app1Value < app2Value ? this.config.app1.name : this.config.app2.name)
          : (app1Value > app2Value ? this.config.app1.name : this.config.app2.name);
      }

      const significance = this.calculateSignificance(Math.abs(percentageDifference));
      const category = this.getMetricCategory(metricName);

      comparisons.push({
        metricName,
        app1Value,
        app2Value,
        difference,
        percentageDifference,
        winner,
        significance,
        category
      });
    }

    return comparisons.sort((a, b) => Math.abs(b.percentageDifference) - Math.abs(a.percentageDifference));
  }

  /**
   * Determine if lower values are better for a metric
   */
  private isLowerBetter(metricName: string): boolean {
    const lowerBetterMetrics = [
      'lcp', 'fid', 'cls', 'ttfb', 'fcp', 'totalLoadTime', 'domLoadTime',
      'networkTime', 'jsLoadTime', 'cssLoadTime', 'imageLoadTime',
      'total_login_time', 'login_page_navigation_time', 'username_fill_time',
      'password_fill_time', 'login_button_click_time', 'memoryUsage'
    ];

    return lowerBetterMetrics.includes(metricName);
  }

  /**
   * Calculate significance level based on percentage difference
   */
  private calculateSignificance(percentageDifference: number): 'significant' | 'moderate' | 'minimal' {
    if (percentageDifference >= 20) return 'significant';
    if (percentageDifference >= 10) return 'moderate';
    return 'minimal';
  }

  /**
   * Get metric category for grouping
   */
  private getMetricCategory(metricName: string): string {
    const categories: Record<string, string[]> = {
      'Core Web Vitals': ['lcp', 'fid', 'cls', 'ttfb', 'fcp'],
      'Loading Performance': ['totalLoadTime', 'domLoadTime', 'networkTime'],
      'Resource Loading': ['jsLoadTime', 'cssLoadTime', 'imageLoadTime'],
      'Network Metrics': ['requestCount', 'transferSize', 'resourceSize'],
      'Login Performance': ['total_login_time', 'login_page_navigation_time', 'username_fill_time', 'password_fill_time', 'login_button_click_time'],
      'System Resources': ['memoryUsage'],
      'Custom Metrics': [] // Default for unmatched metrics
    };

    for (const [category, metrics] of Object.entries(categories)) {
      if (metrics.includes(metricName)) {
        return category;
      }
    }

    return 'Custom Metrics';
  }

  /**
   * Calculate winner by category
   */
  private calculateWinnerByCategory(comparisons: MetricComparison[]): Record<string, string> {
    const categoryScores: Record<string, Record<string, number>> = {};

    for (const comparison of comparisons) {
      const category = comparison.category;
      if (!categoryScores[category]) {
        categoryScores[category] = {
          [this.config.app1.name]: 0,
          [this.config.app2.name]: 0,
          'tie': 0
        };
      }

      categoryScores[category][comparison.winner]++;
    }

    const winnerByCategory: Record<string, string> = {};
    for (const [category, scores] of Object.entries(categoryScores)) {
      const app1Score = scores[this.config.app1.name] || 0;
      const app2Score = scores[this.config.app2.name] || 0;

      if (app1Score > app2Score) {
        winnerByCategory[category] = this.config.app1.name;
      } else if (app2Score > app1Score) {
        winnerByCategory[category] = this.config.app2.name;
      } else {
        winnerByCategory[category] = 'tie';
      }
    }

    return winnerByCategory;
  }

  /**
   * Generate comparison summary
   */
  private generateSummary(
    comparisons: MetricComparison[],
    app1Name: string,
    app2Name: string
  ): ComparisonSummary {
    const app1Wins = comparisons.filter(c => c.winner === app1Name).length;
    const app2Wins = comparisons.filter(c => c.winner === app2Name).length;
    const ties = comparisons.filter(c => c.winner === 'tie').length;

    const overallWinner = app1Wins > app2Wins ? app1Name :
      app2Wins > app1Wins ? app2Name : 'tie';

    const significantDifferences = comparisons.filter(c => c.significance === 'significant').length;

    const improvementPercentages = comparisons
      .filter(c => c.winner !== 'tie')
      .map(c => Math.abs(c.percentageDifference));

    const averageImprovementPercentage = improvementPercentages.length > 0
      ? stats.mean(improvementPercentages) : 0;

    // Check for regression (app2 performing worse than app1 by more than threshold)
    const regressionThreshold = this.config.test.regressionThresholdPercentage;
    const regressions = comparisons.filter(c =>
      c.winner === app1Name && Math.abs(c.percentageDifference) > regressionThreshold
    );

    const regressionDetected = regressions.length > 0;
    const regressionPercentage = regressionDetected
      ? Math.max(...regressions.map(r => Math.abs(r.percentageDifference))) : 0;

    return {
      totalMetrics: comparisons.length,
      app1Wins,
      app2Wins,
      ties,
      overallWinner,
      significantDifferences,
      averageImprovementPercentage: Math.round(averageImprovementPercentage * 100) / 100,
      regressionDetected,
      regressionPercentage: Math.round(regressionPercentage * 100) / 100
    };
  }

  /**
   * Generate readable comparison report
   */
  generateReport(result: ComparisonResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(80));
    lines.push('PERFORMANCE COMPARISON REPORT');
    lines.push('='.repeat(80));
    lines.push('');

    lines.push(`Application 1: ${result.app1Name} (${this.config.app1.technology})`);
    lines.push(`Application 2: ${result.app2Name} (${this.config.app2.technology})`);
    lines.push(`Environment: ${this.config.test.environment.toUpperCase()}`);
    lines.push(`Test Date: ${new Date(result.timestamp).toLocaleString()}`);
    lines.push('');

    // Summary
    lines.push('SUMMARY');
    lines.push('-'.repeat(40));
    lines.push(`Overall Winner: ${result.summary.overallWinner}`);
    lines.push(`${result.app1Name} wins: ${result.summary.app1Wins}`);
    lines.push(`${result.app2Name} wins: ${result.summary.app2Wins}`);
    lines.push(`Ties: ${result.summary.ties}`);
    lines.push(`Average improvement: ${result.summary.averageImprovementPercentage}%`);

    if (result.summary.regressionDetected) {
      lines.push(`⚠️  REGRESSION DETECTED: ${result.summary.regressionPercentage}%`);
    }
    lines.push('');

    // Winner by category
    lines.push('WINNER BY CATEGORY');
    lines.push('-'.repeat(40));
    for (const [category, winner] of Object.entries(result.winnerByCategory)) {
      lines.push(`${category}: ${winner}`);
    }
    lines.push('');

    // Top improvements
    const topImprovements = result.comparison
      .filter(c => c.significance === 'significant')
      .slice(0, 10);

    if (topImprovements.length > 0) {
      lines.push('TOP PERFORMANCE DIFFERENCES');
      lines.push('-'.repeat(40));
      for (const metric of topImprovements) {
        const symbol = metric.percentageDifference > 0 ? '📈' : '📉';
        lines.push(`${symbol} ${metric.metricName}: ${metric.app1Value.toFixed(1)}ms vs ${metric.app2Value.toFixed(1)}ms (${metric.percentageDifference.toFixed(1)}%) - Winner: ${metric.winner}`);
      }
    }

    return lines.join('\n');
  }
}
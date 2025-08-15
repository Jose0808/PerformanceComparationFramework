import { 
  MetricsResult, 
  StatisticalSummary, 
  ComparisonResult, 
  PerformanceThresholds 
} from '../types';

export class PerformanceAnalyzer {
  
  /**
   * Calculate statistical summary for a set of values
   */
  static calculateStatistics(values: number[]): StatisticalSummary {
    if (values.length === 0) {
      throw new Error('Cannot calculate statistics for empty array');
    }

    const sortedValues = [...values].sort((a, b) => a - b);
    const n = values.length;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const median = this.calculatePercentile(sortedValues, 50);
    const p95 = this.calculatePercentile(sortedValues, 95);
    const p99 = this.calculatePercentile(sortedValues, 99);
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    return {
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      standardDeviation: Math.round(standardDeviation * 100) / 100,
      variance: Math.round(variance * 100) / 100
    };
  }

  /**
   * Calculate percentile value
   */
  private static calculatePercentile(sortedValues: number[], percentile: number): number {
    const index = (percentile / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (upper >= sortedValues.length) return sortedValues[sortedValues.length - 1];
    if (lower < 0) return sortedValues[0];

    return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
  }

  /**
   * Compare performance metrics between two applications
   */
  static compareApplications(
    app1Results: MetricsResult[], 
    app2Results: MetricsResult[], 
    scenario: string
  ): ComparisonResult[] {
    const comparisons: ComparisonResult[] = [];
    const metrics = [
      'lcp', 'fid', 'inp', 'cls', 'ttfb', 'fcp', 'tti', 
      'totalPageLoadTime', 'domContentLoaded'
    ];

    for (const metric of metrics) {
      const app1Values = this.extractMetricValues(app1Results, metric);
      const app2Values = this.extractMetricValues(app2Results, metric);

      if (app1Values.length === 0 || app2Values.length === 0) continue;

      const app1Stats = this.calculateStatistics(app1Values);
      const app2Stats = this.calculateStatistics(app2Values);
      
      const improvement = this.calculateImprovement(app1Stats.mean, app2Stats.mean);
      const significantDifference = this.isSignificantDifference(app1Values, app2Values);
      const winner = this.determineWinner(app1Stats.mean, app2Stats.mean, metric);

      comparisons.push({
        scenario,
        metric,
        app1: app1Stats,
        app2: app2Stats,
        improvement,
        significantDifference,
        winner
      });
    }

    return comparisons;
  }

  /**
   * Extract metric values from results array
   */
  private static extractMetricValues(results: MetricsResult[], metric: string): number[] {
    return results.map(result => {
      switch (metric) {
        case 'lcp': return result.coreWebVitals.lcp;
        case 'fid': return result.coreWebVitals.fid || 0;
        case 'inp': return result.coreWebVitals.inp || 0;
        case 'cls': return result.coreWebVitals.cls;
        case 'ttfb': return result.performanceMetrics.ttfb;
        case 'fcp': return result.performanceMetrics.fcp;
        case 'tti': return result.performanceMetrics.tti;
        case 'totalPageLoadTime': return result.performanceMetrics.totalPageLoadTime;
        case 'domContentLoaded': return result.performanceMetrics.domContentLoaded;
        default: return 0;
      }
    }).filter(value => value > 0);
  }

  /**
   * Calculate improvement percentage
   */
  private static calculateImprovement(baseline: number, comparison: number): number {
    if (baseline === 0) return 0;
    return Math.round(((baseline - comparison) / baseline) * 100 * 100) / 100;
  }

  /**
   * Determine if difference is statistically significant using t-test
   */
  private static isSignificantDifference(values1: number[], values2: number[]): boolean {
    if (values1.length < 2 || values2.length < 2) return false;
    
    const stats1 = this.calculateStatistics(values1);
    const stats2 = this.calculateStatistics(values2);
    
    const pooledVariance = ((values1.length - 1) * stats1.variance + (values2.length - 1) * stats2.variance) / 
                          (values1.length + values2.length - 2);
    
    const standardError = Math.sqrt(pooledVariance * (1/values1.length + 1/values2.length));
    const tScore = Math.abs(stats1.mean - stats2.mean) / standardError;
    
    // Simple t-test with significance level of 0.05 (approximate)
    const criticalValue = 2.0; // Simplified critical value
    
    return tScore > criticalValue;
  }

  /**
   * Determine winner based on metric type
   */
  private static determineWinner(value1: number, value2: number, metric: string): 'app1' | 'app2' | 'tie' {
    const threshold = 0.05; // 5% threshold for tie
    const difference = Math.abs(value1 - value2);
    const average = (value1 + value2) / 2;
    
    if (difference / average < threshold) return 'tie';
    
    // For most metrics, lower is better
    const lowerIsBetter = ['lcp', 'fid', 'inp', 'cls', 'ttfb', 'fcp', 'tti', 'totalPageLoadTime', 'domContentLoaded'];
    
    if (lowerIsBetter.includes(metric)) {
      return value1 < value2 ? 'app1' : 'app2';
    } else {
      return value1 > value2 ? 'app1' : 'app2';
    }
  }

  /**
   * Check if metrics meet performance thresholds
   */
  static checkThresholds(results: MetricsResult[], thresholds: PerformanceThresholds): {
    passed: boolean;
    failures: string[];
  } {
    const failures: string[] = [];
    
    for (const result of results) {
      if (result.coreWebVitals.lcp > thresholds.lcp) {
        failures.push(`LCP ${result.coreWebVitals.lcp}ms exceeds threshold ${thresholds.lcp}ms`);
      }
      
      if ((result.coreWebVitals.fid || 0) > thresholds.fid) {
        failures.push(`FID ${result.coreWebVitals.fid}ms exceeds threshold ${thresholds.fid}ms`);
      }
      
      if (result.coreWebVitals.cls > thresholds.cls) {
        failures.push(`CLS ${result.coreWebVitals.cls} exceeds threshold ${thresholds.cls}`);
      }
      
      if (result.performanceMetrics.ttfb > thresholds.ttfb) {
        failures.push(`TTFB ${result.performanceMetrics.ttfb}ms exceeds threshold ${thresholds.ttfb}ms`);
      }
      
      if (result.performanceMetrics.totalPageLoadTime > thresholds.totalLoadTime) {
        failures.push(`Total Load Time ${result.performanceMetrics.totalPageLoadTime}ms exceeds threshold ${thresholds.totalLoadTime}ms`);
      }
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }

  /**
   * Generate performance insights and recommendations
   */
  static generateRecommendations(comparisons: ComparisonResult[]): string[] {
    const recommendations: string[] = [];
    
    for (const comparison of comparisons) {
      const { metric, improvement, winner, app1, app2 } = comparison;
      
      if (winner === 'app2' && improvement > 10) {
        recommendations.push(
          `✅ ${metric.toUpperCase()}: Nueva aplicación es ${Math.abs(improvement)}% más rápida (${app2.mean}ms vs ${app1.mean}ms)`
        );
      } else if (winner === 'app1' && improvement < -10) {
        recommendations.push(
          `⚠️ ${metric.toUpperCase()}: Nueva aplicación es ${Math.abs(improvement)}% más lenta (${app2.mean}ms vs ${app1.mean}ms)`
        );
      }
      
      // Specific recommendations based on metric
      if (metric === 'lcp' && app2.mean > 2500) {
        recommendations.push('🎯 Optimizar LCP: Considerar lazy loading de imágenes y optimización del servidor');
      }
      
      if (metric === 'cls' && app2.mean > 0.1) {
        recommendations.push('🎯 Reducir CLS: Definir dimensiones de imágenes y reservar espacio para contenido dinámico');
      }
      
      if (metric === 'ttfb' && app2.mean > 600) {
        recommendations.push('🎯 Mejorar TTFB: Optimizar respuesta del servidor y considerar CDN');
      }
    }
    
    return recommendations;
  }

  /**
   * Detect performance regressions
   */
  static detectRegressions(
    comparisons: ComparisonResult[], 
    regressionThreshold: number = 10
  ): ComparisonResult[] {
    return comparisons.filter(comparison => 
      comparison.winner === 'app1' && 
      Math.abs(comparison.improvement) > regressionThreshold &&
      comparison.significantDifference
    );
  }

  /**
   * Calculate overall performance score
   */
  static calculatePerformanceScore(results: MetricsResult[]): number {
    const weights = {
      lcp: 0.3,
      fid: 0.2,
      cls: 0.2,
      ttfb: 0.15,
      tti: 0.15
    };
    
    let totalScore = 0;
    let totalWeight = 0;
    
    for (const result of results) {
      let score = 0;
      
      // LCP scoring (0-100, lower is better)
      score += weights.lcp * Math.max(0, 100 - (result.coreWebVitals.lcp / 25));
      
      // FID scoring
      score += weights.fid * Math.max(0, 100 - ((result.coreWebVitals.fid || 0) / 1));
      
      // CLS scoring
      score += weights.cls * Math.max(0, 100 - (result.coreWebVitals.cls * 1000));
      
      // TTFB scoring
      score += weights.ttfb * Math.max(0, 100 - (result.performanceMetrics.ttfb / 6));
      
      // TTI scoring
      score += weights.tti * Math.max(0, 100 - (result.performanceMetrics.tti / 35));
      
      totalScore += score;
      totalWeight += Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    }
    
    return Math.round((totalScore / results.length) * 100) / 100;
  }
}
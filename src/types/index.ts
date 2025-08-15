// Core Web Vitals
export interface CoreWebVitals {
  lcp: number; // Largest Contentful Paint
  fid?: number; // First Input Delay (deprecated)
  inp?: number; // Interaction to Next Paint (new)
  cls: number; // Cumulative Layout Shift
}

// Performance Metrics
export interface PerformanceMetrics {
  ttfb: number; // Time to First Byte
  fcp: number; // First Contentful Paint
  tti: number; // Time to Interactive
  dnsTime: number; // DNS Resolution Time
  sslTime: number; // SSL Handshake Time
  resourceLoadTimes: ResourceTiming[];
  totalPageLoadTime: number;
  domContentLoaded: number;
  loadComplete: number;
}

// Resource Timing
export interface ResourceTiming {
  name: string;
  type: 'script' | 'stylesheet' | 'image' | 'font' | 'other';
  duration: number;
  size: number;
  transferSize: number;
}

// Custom Application Metrics
export interface ApplicationMetrics {
  loginTime?: number;
  dashboardLoadTime?: number;
  navigationTimes: { [key: string]: number };
  apiResponseTimes: { [endpoint: string]: number };
  formProcessingTimes: { [formName: string]: number };
}

// Combined Metrics Result
export interface MetricsResult {
  timestamp: string;
  url: string;
  environment: 'pre' | 'pro';
  application: string;
  scenario: string;
  iteration: number;
  coreWebVitals: CoreWebVitals;
  performanceMetrics: PerformanceMetrics;
  applicationMetrics: ApplicationMetrics;
  userAgent: string;
  networkCondition?: string;
}

// Test Configuration
export interface TestConfig {
  applications: {
    app1: ApplicationConfig;
    app2: ApplicationConfig;
  };
  environments: {
    pre: EnvironmentConfig;
    pro: EnvironmentConfig;
  };
  execution: ExecutionConfig;
}

export interface ApplicationConfig {
  name: string;
  baseUrl: string;
  technology: string;
  credentials?: {
    accountType: string;
    username: string;
    password: string;
  };
}

export interface EnvironmentConfig {
  name: string;
  networkConditions?: NetworkConditions;
  parallelInstances: number;
  iterations: number;
}

export interface ExecutionConfig {
  scenarios: string[];
  outputPath: string;
  reportFormat: ('allure' | 'html' | 'json')[];
  thresholds: PerformanceThresholds;
}

export interface NetworkConditions {
  offline: boolean;
  downloadThroughput: number;
  uploadThroughput: number;
  latency: number;
}

export interface PerformanceThresholds {
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  totalLoadTime: number;
}

// Statistical Analysis
export interface StatisticalSummary {
  mean: number;
  median: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  standardDeviation: number;
  variance: number;
}

export interface ComparisonResult {
  scenario: string;
  metric: string;
  app1: StatisticalSummary;
  app2: StatisticalSummary;
  improvement: number; // percentage improvement (negative means regression)
  significantDifference: boolean;
  winner: 'app1' | 'app2' | 'tie';
}

// Test Scenario
export interface TestScenario {
  name: string;
  description: string;
  steps: TestStep[];
  expectedMetrics: Partial<PerformanceThresholds>;
}

export interface TestStep {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'custom';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
  customFunction?: string;
}

// Report Interfaces
export interface PerformanceReport {
  summary: ReportSummary;
  comparisons: ComparisonResult[];
  detailedResults: MetricsResult[];
  recommendations: string[];
  generatedAt: string;
}

export interface ReportSummary {
  totalScenarios: number;
  totalIterations: number;
  executionTime: number;
  environment: string;
  applications: {
    app1: string;
    app2: string;
  };
  overallWinner: 'app1' | 'app2' | 'tie';
}
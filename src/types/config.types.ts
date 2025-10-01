export interface AppConfig {
  name: string;
  baseUrl: string;
  technology: string;
  accountType: string;
  username: string;
  password: string;
}

export interface PerformanceThresholds {
  // Core Web Vitals
  lcp: number;
  fid: number;
  inp: number;
  cls: number;
  
  // Performance Metrics
  ttfb: number;
  fcp: number;
  tti: number;
  dnsResolution: number;
  sslHandshake: number;
  jsLoadTime: number;
  cssLoadTime: number;
  imgLoadTime: number;
  totalLoadTime: number;
  
  // Custom Application Metrics
  loginTime: number;
  dashboardLoadTime: number;
  formProcessingTime: number;
  moduleNavigationTime: number;
}

export interface TestConfig {
  timeout: number;
  environment: string;
  networkConditions: string;
  parallelInstances: number;
  iterations: number;
  cooldownBetweenRuns: number;
  browserRestartFrequency: number;
  clearCacheBetweenRuns: boolean;
  clearCookiesBetweenRuns: boolean;
  continueOnFailure: boolean;
  maxConsecutiveFailures: number;
  storePath: string;
}

export interface NetworkConfig {
  downloadThroughput: number;
  uploadThroughput: number;
  latency: number;
  packetLoss: number;
}

export interface MonitoringConfig {
  captureWebVitals: boolean;
  captureNetworkMetrics: boolean;
  captureCustomMetrics: boolean;
  monitorMemoryUsage: boolean;
  monitorCpuUsage: boolean;
  captureConsoleLogs: boolean;
  captureNetworkLogs: boolean;
  memoryThresholdMb: number;
  cpuThresholdPercentage: number;
}

export interface ReportingConfig {
  outputPath: string;
  reportFormat: string[];
  generateScreenshots: boolean;
  generateVideoRecording: boolean;
}
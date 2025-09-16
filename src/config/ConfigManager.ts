import { AppConfig, TestConfig, PerformanceThresholds, NetworkConfig, MonitoringConfig, ReportingConfig } from "../types/config.types";

export class ConfigManager {
  private static instance: ConfigManager;
  
  public readonly app1: AppConfig;
  public readonly app2: AppConfig;
  public readonly test: TestConfig;
  public readonly thresholds: PerformanceThresholds;
  public readonly network: NetworkConfig;
  public readonly monitoring: MonitoringConfig;
  public readonly reporting: ReportingConfig;

  private constructor() {
    this.app1 = this.loadAppConfig('APP1');
    this.app2 = this.loadAppConfig('APP2');
    this.test = this.loadTestConfig();
    this.thresholds = this.loadThresholds();
    this.network = this.loadNetworkConfig();
    this.monitoring = this.loadMonitoringConfig();
    this.reporting = this.loadReportingConfig();
  }

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  private loadAppConfig(prefix: string): AppConfig {
    return {
      name: this.getEnv(`${prefix}_NAME`),
      baseUrl: this.getEnv(`${prefix}_BASE_URL`),
      technology: this.getEnv(`${prefix}_TECHNOLOGY`),
      accountType: this.getEnv(`${prefix}_ACCOUNT_TYPE`),
      username: this.getEnv(`${prefix}_USERNAME`),
      password: this.getEnv(`${prefix}_PASSWORD`)
    };
  }

  private loadTestConfig(): TestConfig {
    return {
      timeout: parseInt(this.getEnv('LOAD_TIMEOUT', '10000')),
      environment: this.getEnv('ENVIRONMENT', 'pre'),
      networkConditions: this.getEnv('NETWORK_CONDITIONS', 'none'),
      parallelInstances: parseInt(this.getEnv('PARALLEL_INSTANCES', '1')),
      iterations: parseInt(this.getEnv('ITERATIONS', '3')),
      cooldownBetweenRuns: parseInt(this.getEnv('COOLDOWN_BETWEEN_RUNS', '5000')),
      browserRestartFrequency: parseInt(this.getEnv('BROWSER_RESTART_FREQUENCY', '10')),
      clearCacheBetweenRuns: this.getBooleanEnv('CLEAR_CACHE_BETWEEN_RUNS', false),
      clearCookiesBetweenRuns: this.getBooleanEnv('CLEAR_COOKIES_BETWEEN_RUNS', true),
      continueOnFailure: this.getBooleanEnv('CONTINUE_ON_FAILURE', true),
      maxConsecutiveFailures: parseInt(this.getEnv('MAX_CONSECUTIVE_FAILURES', '3')),
      regressionThresholdPercentage: parseInt(this.getEnv('REGRESSION_THRESHOLD_PERCENTAGE', '10')),
      storePath: this.getEnv('STORE_PATH', './store'),
    };
  }


  ///despues
  private loadThresholds(): PerformanceThresholds {
    return {
      // Core Web Vitals
      lcp: parseInt(this.getEnv('THRESHOLD_LCP', '2500')),
      fid: parseInt(this.getEnv('THRESHOLD_FID', '100')),
      inp: parseInt(this.getEnv('THRESHOLD_INP', '200')),
      cls: parseFloat(this.getEnv('THRESHOLD_CLS', '0.1')),
      
      // Performance Metrics
      ttfb: parseInt(this.getEnv('THRESHOLD_TTFB', '500')),
      fcp: parseInt(this.getEnv('THRESHOLD_FCP', '1500')),
      tti: parseInt(this.getEnv('THRESHOLD_TTI', '3000')),
      dnsResolution: parseInt(this.getEnv('THRESHOLD_DNS_RESOLUTION', '200')),
      sslHandshake: parseInt(this.getEnv('THRESHOLD_SSL_HANDSHAKE', '300')),
      jsLoadTime: parseInt(this.getEnv('THRESHOLD_JS_LOAD_TIME', '1000')),
      cssLoadTime: parseInt(this.getEnv('THRESHOLD_CSS_LOAD_TIME', '800')),
      imgLoadTime: parseInt(this.getEnv('THRESHOLD_IMG_LOAD_TIME', '1200')),
      totalLoadTime: parseInt(this.getEnv('THRESHOLD_TOTAL_LOAD_TIME', '5000')),
      
      // Custom Application Metrics
      loginTime: parseInt(this.getEnv('THRESHOLD_LOGIN_TIME', '2000')),
      dashboardLoadTime: parseInt(this.getEnv('THRESHOLD_DASHBOARD_LOAD_TIME', '3000')),
      formProcessingTime: parseInt(this.getEnv('THRESHOLD_FORM_PROCESSING_TIME', '1000')),
      moduleNavigationTime: parseInt(this.getEnv('THRESHOLD_MODULE_NAVIGATION_TIME', '1500'))
    };
  }

  private loadNetworkConfig(): NetworkConfig {
    return {
      downloadThroughput: parseInt(this.getEnv('NETWORK_DOWNLOAD_THROUGHPUT', '1500000')),
      uploadThroughput: parseInt(this.getEnv('NETWORK_UPLOAD_THROUGHPUT', '750000')),
      latency: parseInt(this.getEnv('NETWORK_LATENCY', '20')),
      packetLoss: parseInt(this.getEnv('NETWORK_PACKET_LOSS', '0'))
    };
  }

  private loadMonitoringConfig(): MonitoringConfig {
    return {
      captureWebVitals: this.getBooleanEnv('CAPTURE_WEB_VITALS', true),
      captureNetworkMetrics: this.getBooleanEnv('CAPTURE_NETWORK_METRICS', true),
      captureCustomMetrics: this.getBooleanEnv('CAPTURE_CUSTOM_METRICS', true),
      monitorMemoryUsage: this.getBooleanEnv('MONITOR_MEMORY_USAGE', true),
      monitorCpuUsage: this.getBooleanEnv('MONITOR_CPU_USAGE', true),
      captureConsoleLogs: this.getBooleanEnv('CAPTURE_CONSOLE_LOGS', true),
      captureNetworkLogs: this.getBooleanEnv('CAPTURE_NETWORK_LOGS', true),
      memoryThresholdMb: parseInt(this.getEnv('MEMORY_THRESHOLD_MB', '2048')),
      cpuThresholdPercentage: parseInt(this.getEnv('CPU_THRESHOLD_PERCENTAGE', '80'))
    };
  }

  private loadReportingConfig(): ReportingConfig {
    return {
      outputPath: this.getEnv('OUTPUT_PATH', './reports'),
      reportFormat: this.getEnv('REPORT_FORMAT', 'html,json').split(','),
      generateScreenshots: this.getBooleanEnv('GENERATE_SCREENSHOTS', true),
      generateVideoRecording: this.getBooleanEnv('GENERATE_VIDEO_RECORDING', false),
    };
  }

  private getEnv(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined && defaultValue === undefined) {
      throw new Error(`Environment variable ${key} is required but not set`);
    }
    return value || defaultValue!;
  }

  private getBooleanEnv(key: string, defaultValue: boolean): boolean {
    const value = process.env[key];
    if (value === undefined) return defaultValue;
    return value.toLowerCase() === 'true';
  }

  public getAppByName(name: string): AppConfig {
    if (this.app1.name === name) return this.app1;
    if (this.app2.name === name) return this.app2;
    throw new Error(`Application with name ${name} not found`);
  }

  public getAllApps(): AppConfig[] {
    return [this.app1, this.app2];
  }
}
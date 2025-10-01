import { AppConfig, TestConfig, ReportingConfig } from "../types/config.types";

export class ConfigManager {
  private static instance: ConfigManager;
  
  public readonly app1: AppConfig;
  public readonly app2: AppConfig;
  public readonly test: TestConfig;
  public readonly reporting: ReportingConfig;

  private constructor() {
    this.app1 = this.loadAppConfig('APP1');
    this.app2 = this.loadAppConfig('APP2');
    this.test = this.loadTestConfig();
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
      storePath: this.getEnv('STORE_PATH', './store'),
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
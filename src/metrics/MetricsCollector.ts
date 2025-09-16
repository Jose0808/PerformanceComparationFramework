import { Page } from '@playwright/test';
import { ConfigManager } from '../config/ConfigManager';

export interface NetworkLog {
  url: string;
  urlName: string;
  method: string;
  headers: Record<string, string>;
  requestTimestamp: number;
  status?: number;
  duration?: number;
  curl?: string;
}


export interface PerformanceMetrics {
  // Navigation Timing
  navigationStart: number;
  loadEventEnd: number;
  domContentLoadedEventEnd: number;

  // Core Web Vitals
  lcp: number;
  fid: number;
  cls: number;
  ttfb: number;
  fcp: number;
  inp?: number;

  // Custom Timing
  totalLoadTime: number;
  domLoadTime: number;
  networkTime: number;

  // Resource Loading
  jsLoadTime: number;
  cssLoadTime: number;
  imageLoadTime: number;
  fontLoadTime: number;

  // Network Metrics
  requestCount: number;
  transferSize: number;
  resourceSize: number;

  // Custom Application Metrics
  customMetrics: Record<string, number>;

  // Memory and CPU
  memoryUsage?: number;

  //Network
  networkLogs: NetworkLog[];

  // Errors
  jsErrors: string[];
  consoleErrors: string[];
}

export class MetricsCollector {
  private readonly page: Page;
  private readonly config: ConfigManager;
  private customMetrics: Record<string, number> = {};
  private consoleLogs: string[] = [];
  private networkLogs: NetworkLog[] = [];
  private jsErrors: string[] = [];


  constructor(page: Page) {
    this.page = page;
    this.config = ConfigManager.getInstance();
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for console and network monitoring
   */
  private setupEventListeners(): void {
    // Console monitoring
    if (this.config.monitoring.captureConsoleLogs) {
      this.page.on('console', (msg) => {
        const logEntry = `[${msg.type()}] ${msg.text()}`;
        this.consoleLogs.push(logEntry);

        if (msg.type() === 'error') {
          this.jsErrors.push(logEntry);
        }
      });
    }

    // Network monitoring
    if (this.config.monitoring.captureNetworkLogs) {
      const requestMap = new Map<string, NetworkLog>();

      this.page.on('request', (request) => {
        const now = performance.now();
        const key = `${request.url()}_${now}`;

        const log: NetworkLog = {
          url: request.url(),
          urlName: this.normalizeUrlName(request.url()),
          method: request.method(),
          headers: request.headers(),
          requestTimestamp: now,
        };

        requestMap.set(key, log);
        (request as any)._key = key;
      });

      this.page.on('response', async (response) => {
        const request = response.request();
        const key = (request as any)._key;

        if (!key || !requestMap.has(key)) return;

        const log = requestMap.get(key)!;
        try {
          await response.body();
        } catch (e) {
          // falló la descarga
        }

        const endTime = performance.now();

        log.status = response.status();
        // log.duration = endTime - log.requestTimestamp;
        log.duration = request.timing().responseEnd - request.timing().requestStart;
        log.curl = this.toCurl(log, await request.postData());

        this.networkLogs.push(log);
        requestMap.delete(key);
      });
    }

    // JavaScript errors
    this.page.on('pageerror', (error) => {
      const errorMsg = `JavaScript Error: ${error.message}`;
      this.jsErrors.push(errorMsg);
      console.error('Page Error:', error);
    });
  }

  private normalizeUrlName(url: string): string {
    const filename = url.split("/").pop()?.split("?")[0] || url;
    // Reemplaza ".min" justo antes de la extensión
    return filename.replace(/\.min(?=\.\w+$)/, "");
  }

  //create curl
  private toCurl(log: NetworkLog, body?: string | null): string {
    let curl = `curl -X ${log.method} '${log.url}'`;

    for (const [key, value] of Object.entries(log.headers)) {
      curl += ` -H '${key}: ${value}'`;
    }

    if (body) {
      curl += ` --data '${body}'`;
    }

    return curl;
  }


  /**
   * Record custom metric
   */
  async recordCustomMetric(name: string, value: number): Promise<void> {
    this.customMetrics[name] = value;
    console.log(`📊 Custom metric recorded: ${name} = ${value}ms`);
  }

  /**
   * Collect Web Vitals using JavaScript evaluation
   */
  async collectWebVitals(): Promise<Partial<PerformanceMetrics>> {
    if (!this.config.monitoring.captureWebVitals) {
      return {};
    }

    try {
      const webVitals: Partial<PerformanceMetrics> = await this.page.evaluate(() => {
        return new Promise((resolve) => {
          // Function to collect performance metrics
          const collectMetrics = () => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');

            const fcp = paint.find(entry => entry.name === 'first-contentful-paint')?.startTime || 0;
            const ttfb = navigation ? navigation.responseStart - navigation.fetchStart : 0;

            return {
              navigationStart: navigation?.fetchStart || 0,
              loadEventEnd: navigation?.loadEventEnd || 0,
              domContentLoadedEventEnd: navigation?.domContentLoadedEventEnd || 0,
              ttfb: ttfb,
              fcp: fcp,
              totalLoadTime: navigation ? navigation.loadEventEnd - navigation.fetchStart : 0,
              domLoadTime: navigation ? navigation.domContentLoadedEventEnd - navigation.fetchStart : 0,
              networkTime: navigation ? navigation.responseEnd - navigation.fetchStart : 0
            };
          };

          // Try to collect LCP using PerformanceObserver
          let lcp = 0;
          let cls = 0;
          let fid = 0;

          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              const lastEntry = entries[entries.length - 1];
              if (lastEntry) {
                lcp = lastEntry.startTime;
              }
            });
            observer.observe({ type: 'largest-contentful-paint', buffered: true });
          } catch (e) {
            console.log('LCP not supported');
          }

          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                if (!entry.hadRecentInput) {
                  cls += entry.value;
                }
              });
            });
            observer.observe({ type: 'layout-shift', buffered: true });
          } catch (e) {
            console.log('CLS not supported');
          }

          try {
            const observer = new PerformanceObserver((list) => {
              const entries = list.getEntries();
              entries.forEach((entry: any) => {
                fid = entry.processingStart - entry.startTime;
              });
            });
            observer.observe({ type: 'first-input', buffered: true });
          } catch (e) {
            console.log('FID not supported');
          }

          // Wait a bit for observers to collect data
          setTimeout(() => {
            const basicMetrics = collectMetrics();
            resolve({
              ...basicMetrics,
              lcp,
              cls,
              fid
            });
          }, 100);
        });
      });

      return webVitals;
    } catch (error) {
      console.error('Error collecting web vitals:', error);
      return {};
    }
  }

  /**
   * Collect resource loading metrics
   */
  async collectResourceMetrics(): Promise<Partial<PerformanceMetrics>> {
    if (!this.config.monitoring.captureNetworkMetrics) {
      return {};
    }

    try {
      const resourceMetrics = await this.page.evaluate(() => {
        const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

        let jsLoadTime = 0;
        let cssLoadTime = 0;
        let imageLoadTime = 0;
        let fontLoadTime = 0;
        let requestCount = 0;
        let transferSize = 0;
        let resourceSize = 0;

        resources.forEach((resource) => {
          const duration = resource.responseEnd - resource.startTime;
          requestCount++;
          transferSize += resource.transferSize || 0;
          resourceSize += resource.decodedBodySize || 0;

          if (resource.name.includes('.js')) {
            jsLoadTime += duration;
          } else if (resource.name.includes('.css')) {
            cssLoadTime += duration;
          } else if (resource.name.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
            imageLoadTime += duration;
          } else if (resource.name.match(/\.(woff|woff2|ttf|otf)$/i)) {
            fontLoadTime += duration;
          }
        });

        return {
          jsLoadTime,
          cssLoadTime,
          imageLoadTime,
          fontLoadTime,
          requestCount,
          transferSize,
          resourceSize
        };
      });

      return resourceMetrics;
    } catch (error) {
      console.error('Error collecting resource metrics:', error);
      return {};
    }
  }

  /**
   * Collect memory usage metrics
   */
  async collectMemoryMetrics(): Promise<Partial<PerformanceMetrics>> {
    if (!this.config.monitoring.monitorMemoryUsage) {
      return {};
    }

    try {
      const memoryMetrics = await this.page.evaluate(() => {
        if ('memory' in performance) {
          const memory = (performance as any).memory;
          return {
            memoryUsage: memory.usedJSHeapSize
          };
        }
        return {};
      });

      return memoryMetrics;
    } catch (error) {
      console.error('Error collecting memory metrics:', error);
      return {};
    }
  }

  /**
   * Collect all performance metrics
   */
  async collectAllMetrics(): Promise<PerformanceMetrics> {
    console.log('📊 Collecting all performance metrics...');

    const webVitals = await this.collectWebVitals();
    const resourceMetrics = await this.collectResourceMetrics();
    const memoryMetrics = await this.collectMemoryMetrics();

    const allMetrics: PerformanceMetrics = {
      // Default values
      navigationStart: 0,
      loadEventEnd: 0,
      domContentLoadedEventEnd: 0,
      lcp: 0,
      fid: 0,
      cls: 0,
      ttfb: 0,
      fcp: 0,
      totalLoadTime: 0,
      domLoadTime: 0,
      networkTime: 0,
      jsLoadTime: 0,
      cssLoadTime: 0,
      imageLoadTime: 0,
      fontLoadTime: 0,
      requestCount: 0,
      transferSize: 0,
      resourceSize: 0,
      customMetrics: { ...this.customMetrics },
      jsErrors: [...this.jsErrors],
      consoleErrors: this.consoleLogs.filter(log => log.includes('[error]')),
      networkLogs: [...this.networkLogs],

      // Merge collected metrics
      ...webVitals,
      ...resourceMetrics,
      ...memoryMetrics
    };

    console.log('📊 Metrics collection completed:', {
      totalLoadTime: allMetrics.totalLoadTime,
      lcp: allMetrics.lcp,
      fcp: allMetrics.fcp,
      customMetricsCount: Object.keys(allMetrics.customMetrics).length,
      jsErrorsCount: allMetrics.jsErrors.length
    });

    return allMetrics;
  }

  /**
   * Get console logs
   */
  getConsoleLogs(): string[] {
    return [...this.consoleLogs];
  }

  /**
   * Get network logs
   */
  getNetworkLogs(): any[] {
    return [...this.networkLogs];
  }

  /**
   * Get JavaScript errors
   */
  getJSErrors(): string[] {
    return [...this.jsErrors];
  }

  /**
   * Reset metrics for new measurement
   */
  resetMetrics(): void {
    this.customMetrics = {};
    this.consoleLogs = [];
    this.networkLogs = [];
    this.jsErrors = [];
  }

  /**
   * Check if metrics meet thresholds
   */
  checkThresholds(metrics: PerformanceMetrics): { passed: boolean; failures: string[] } {
    const failures: string[] = [];
    const thresholds = this.config.thresholds;

    // Check Core Web Vitals
    if (metrics.lcp > thresholds.lcp) {
      failures.push(`LCP: ${metrics.lcp}ms > ${thresholds.lcp}ms`);
    }
    if (metrics.fid > thresholds.fid) {
      failures.push(`FID: ${metrics.fid}ms > ${thresholds.fid}ms`);
    }
    if (metrics.cls > thresholds.cls) {
      failures.push(`CLS: ${metrics.cls} > ${thresholds.cls}`);
    }

    // Check performance metrics
    if (metrics.ttfb > thresholds.ttfb) {
      failures.push(`TTFB: ${metrics.ttfb}ms > ${thresholds.ttfb}ms`);
    }
    if (metrics.fcp > thresholds.fcp) {
      failures.push(`FCP: ${metrics.fcp}ms > ${thresholds.fcp}ms`);
    }

    // Check custom metrics
    if (metrics.customMetrics.total_login_time > thresholds.loginTime) {
      failures.push(`Login Time: ${metrics.customMetrics.total_login_time}ms > ${thresholds.loginTime}ms`);
    }

    return {
      passed: failures.length === 0,
      failures
    };
  }
}
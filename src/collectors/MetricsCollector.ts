import { Page } from '@playwright/test';
import { ConfigManager } from '../config/ConfigManager';

export interface NetworkLog {
  order: number;
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
  private consoleLogs: string[] = [];
  private networkLogs: NetworkLog[] = [];
  private jsErrors: string[] = [];
  private requestCounter = 0;



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
    this.page.on('console', (msg) => {
      const logEntry = `[${msg.type()}] ${msg.text()}`;
      this.consoleLogs.push(logEntry);

      if (msg.type() === 'error') {
        this.jsErrors.push(logEntry);
      }
    });


    // Network monitoring
    const requestMap = new Map<string, NetworkLog>();

    this.page.on('request', (request) => {
      const now = performance.now();
      const key = `${request.url()}_${now}`;
      this.requestCounter++;

      const log: NetworkLog = {
        order: this.requestCounter,
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

      log.status = response.status();
      log.duration = request.timing().responseEnd - request.timing().requestStart;
      log.curl = this.toCurl(log, await request.postData());

      this.networkLogs.push(log);
      requestMap.delete(key);
    });


    // JavaScript errors
    this.page.on('pageerror', (error) => {
      const errorMsg = `JavaScript Error: ${error.message}`;
      this.jsErrors.push(errorMsg);
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
    this.consoleLogs = [];
    this.networkLogs = [];
    this.jsErrors = [];
  }
}
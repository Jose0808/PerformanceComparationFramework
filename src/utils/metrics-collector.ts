import { Page } from '@playwright/test';
import { 
  MetricsResult, 
  CoreWebVitals, 
  PerformanceMetrics, 
  ApplicationMetrics, 
  ResourceTiming 
} from '../types';

export class MetricsCollector {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Collect all performance metrics for the current page
   */
  async collectAllMetrics(
    url: string,
    environment: 'pre' | 'pro',
    application: string,
    scenario: string,
    iteration: number
  ): Promise<MetricsResult> {
    const timestamp = new Date().toISOString();
    const userAgent = await this.page.evaluate(() => navigator.userAgent);

    const [
      coreWebVitals,
      performanceMetrics,
      applicationMetrics
    ] = await Promise.all([
      this.collectCoreWebVitals(),
      this.collectPerformanceMetrics(),
      this.collectApplicationMetrics()
    ]);

    return {
      timestamp,
      url,
      environment,
      application,
      scenario,
      iteration,
      coreWebVitals,
      performanceMetrics,
      applicationMetrics,
      userAgent
    };
  }

  /**
   * Collect Core Web Vitals using Web Vitals API
   */
  private async collectCoreWebVitals(): Promise<CoreWebVitals> {
    return await this.page.evaluate(() => {
      return new Promise<CoreWebVitals>((resolve) => {
        const vitals: Partial<CoreWebVitals> = {};
        
        // Web Vitals library would be injected here in a real scenario
        // For now, we'll use Performance API approximations
        
        // LCP - Largest Contentful Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          if (lastEntry) {
            vitals.lcp = lastEntry.startTime;
          }
        }).observe({ type: 'largest-contentful-paint', buffered: true });

        // CLS - Cumulative Layout Shift
        let clsValue = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries() as any[]) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          vitals.cls = clsValue;
        }).observe({ type: 'layout-shift', buffered: true });

        // FID/INP - First Input Delay / Interaction to Next Paint
        new PerformanceObserver((list) => {
          const entries = list.getEntries() as any[];
          if (entries.length > 0) {
            vitals.fid = entries[0].processingStart - entries[0].startTime;
            // INP is more complex to calculate, simplified here
            vitals.inp = entries[entries.length - 1].duration;
          }
        }).observe({ type: 'first-input', buffered: true });

        // Fallback values and resolve after a short delay
        setTimeout(() => {
          resolve({
            lcp: vitals.lcp || 0,
            fid: vitals.fid || 0,
            inp: vitals.inp || 0,
            cls: vitals.cls || 0
          });
        }, 1000);
      });
    });
  }

  /**
   * Collect detailed performance metrics
   */
  private async collectPerformanceMetrics(): Promise<PerformanceMetrics> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      // Navigation Timing metrics
      const ttfb = navigation.responseStart - navigation.fetchStart;
      const dnsTime = navigation.domainLookupEnd - navigation.domainLookupStart;
      const sslTime = navigation.connectEnd - navigation.secureConnectionStart;
      const domContentLoaded = navigation.domContentLoadedEventEnd - navigation.fetchStart;
      const loadComplete = navigation.loadEventEnd - navigation.fetchStart;
      const totalPageLoadTime = navigation.loadEventEnd - navigation.fetchStart;

      // Paint Timing metrics
      const fcpEntry = paint.find(entry => entry.name === 'first-contentful-paint');
      const fcp = fcpEntry ? fcpEntry.startTime : 0;

      // TTI approximation (simplified)
      const tti = navigation.domInteractive - navigation.fetchStart;

      // Resource Timing
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const resourceLoadTimes: ResourceTiming[] = resources.map(resource => ({
        name: resource.name,
        type: getResourceType(resource.name),
        duration: resource.responseEnd - resource.startTime,
        size: resource.decodedBodySize || 0,
        transferSize: resource.transferSize || 0
      }));

      function getResourceType(url: string): 'script' | 'stylesheet' | 'image' | 'font' | 'other' {
        if (url.includes('.js')) return 'script';
        if (url.includes('.css')) return 'stylesheet';
        if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) return 'image';
        if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'font';
        return 'other';
      }

      return {
        ttfb,
        fcp,
        tti,
        dnsTime,
        sslTime,
        resourceLoadTimes,
        totalPageLoadTime,
        domContentLoaded,
        loadComplete
      };
    });
  }

  /**
   * Collect application-specific metrics
   */
  private async collectApplicationMetrics(): Promise<ApplicationMetrics> {
    // This will be extended based on specific application needs
    return {
      navigationTimes: {},
      apiResponseTimes: {},
      formProcessingTimes: {}
    };
  }

  /**
   * Wait for page to be fully loaded before collecting metrics
   */
  async waitForPageLoad(timeout: number = 30000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
    
    // Additional wait for dynamic content
    await this.page.waitForFunction(() => {
      return document.readyState === 'complete';
    }, { timeout });

    // Wait for any pending animations or transitions
    await this.page.waitForTimeout(1000);
  }

  /**
   * Measure time for a custom action
   */
  async measureActionTime(action: () => Promise<void>): Promise<number> {
    const startTime = Date.now();
    await action();
    return Date.now() - startTime;
  }

  /**
   * Measure API response time
   */
  async measureApiResponseTime(url: string): Promise<number> {
    return await this.page.evaluate((apiUrl) => {
      const startTime = performance.now();
      return fetch(apiUrl)
        .then(() => performance.now() - startTime)
        .catch(() => -1);
    }, url);
  }

  /**
   * Set custom application metrics
   */
  setApplicationMetric(category: keyof ApplicationMetrics, key: string, value: number): void {
    // This will be implemented to store custom metrics during test execution
  }

  /**
   * Inject Web Vitals library for more accurate measurements
   */
  async injectWebVitalsLibrary(): Promise<void> {
    await this.page.addScriptTag({
      url: 'https://unpkg.com/web-vitals@3/dist/web-vitals.iife.js'
    });
  }

  /**
   * Setup performance observers for real-time monitoring
   */
  async setupPerformanceObservers(): Promise<void> {
    await this.page.evaluate(() => {
      // Store metrics in window object for later retrieval
      (window as any).performanceMetrics = {
        lcp: null,
        fid: null,
        cls: null,
        customTimings: {}
      };

      // LCP Observer
      if ('PerformanceObserver' in window) {
        try {
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1] as any;
            (window as any).performanceMetrics.lcp = lastEntry.startTime;
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {
          console.warn('LCP observer not supported');
        }
      }
    });
  }

  /**
   * Take performance snapshot at specific moment
   */
  async takePerformanceSnapshot(label: string): Promise<void> {
    await this.page.evaluate((snapshotLabel) => {
      if ((window as any).performanceMetrics) {
        (window as any).performanceMetrics.customTimings[snapshotLabel] = performance.now();
      }
    }, label);
  }
}
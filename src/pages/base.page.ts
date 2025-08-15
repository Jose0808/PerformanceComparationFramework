import { Page, Locator, expect } from '@playwright/test';
import { MetricsCollector } from '../utils/metrics-collector';
import { ApplicationConfig } from '../types';

export abstract class BasePage {
  protected page: Page;
  protected metricsCollector: MetricsCollector;
  protected appConfig: ApplicationConfig;
  protected customMetrics: { [key: string]: number } = {};

  constructor(page: Page, appConfig: ApplicationConfig) {
    this.page = page;
    this.appConfig = appConfig;
    this.metricsCollector = new MetricsCollector(page);
  }

  /**
   * Navigate to a specific URL and wait for load
   */
  async navigateTo(url: string, waitForLoad: boolean = true): Promise<number> {
    const startTime = Date.now();
    
    await this.page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    if (waitForLoad) {
      await this.metricsCollector.waitForPageLoad();
    }
    
    const navigationTime = Date.now() - startTime;
    this.customMetrics['navigationTime'] = navigationTime;
    
    return navigationTime;
  }

  /**
   * Navigate to base URL
   */
  async navigateToHome(): Promise<number> {
    return await this.navigateTo(this.appConfig.baseUrl);
  }

  /**
   * Wait for element to be visible with timeout
   */
  async waitForElement(selector: string, timeout: number = 10000): Promise<Locator> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    return element;
  }

  /**
   * Click element and measure time
   */
  async clickAndMeasure(selector: string, description?: string): Promise<number> {
    const element = await this.waitForElement(selector);
    
    const clickTime = await this.metricsCollector.measureActionTime(async () => {
      await element.click();
      await this.page.waitForLoadState('domcontentloaded');
    });
    
    if (description) {
      this.customMetrics[`click_${description}`] = clickTime;
    }
    
    return clickTime;
  }

  /**
   * Fill form field and measure time
   */
  async fillAndMeasure(selector: string, value: string, description?: string): Promise<number> {
    const element = await this.waitForElement(selector);
    
    const fillTime = await this.metricsCollector.measureActionTime(async () => {
      await element.clear();
      await element.fill(value);
    });
    
    if (description) {
      this.customMetrics[`fill_${description}`] = fillTime;
    }
    
    return fillTime;
  }

  /**
   * Submit form and measure time
   */
  async submitFormAndMeasure(formSelector: string, description?: string): Promise<number> {
    const form = await this.waitForElement(formSelector);
    
    const submitTime = await this.metricsCollector.measureActionTime(async () => {
      await form.click();
      await this.page.waitForLoadState('networkidle');
    });
    
    if (description) {
      this.customMetrics[`submit_${description}`] = submitTime;
    }
    
    return submitTime;
  }

  /**
   * Wait for API response and measure time
   */
  async waitForApiResponse(urlPattern: string | RegExp, timeout: number = 10000): Promise<number> {
    const startTime = Date.now();
    
    await this.page.waitForResponse(response => {
      const url = response.url();
      if (typeof urlPattern === 'string') {
        return url.includes(urlPattern);
      }
      return urlPattern.test(url);
    }, { timeout });
    
    return Date.now() - startTime;
  }

  /**
   * Measure time to load specific content
   */
  async measureContentLoad(selector: string, description: string): Promise<number> {
    const startTime = Date.now();
    await this.waitForElement(selector);
    const loadTime = Date.now() - startTime;
    
    this.customMetrics[`content_${description}`] = loadTime;
    return loadTime;
  }

  /**
   * Take performance snapshot
   */
  async takeSnapshot(label: string): Promise<void> {
    await this.metricsCollector.takePerformanceSnapshot(label);
  }

  /**
   * Set custom metric
   */
  setCustomMetric(key: string, value: number): void {
    this.customMetrics[key] = value;
  }

  /**
   * Get all custom metrics
   */
  getCustomMetrics(): { [key: string]: number } {
    return { ...this.customMetrics };
  }

  /**
   * Verify page loaded correctly
   */
  async verifyPageLoaded(expectedUrl?: string): Promise<void> {
    if (expectedUrl) {
      await expect(this.page).toHaveURL(new RegExp(expectedUrl));
    }
    
    // Wait for page to be stable
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(1000);
  }

  /**
   * Handle common errors (alerts, popups, etc.)
   */
  async handleCommonInterruptions(): Promise<void> {
    // Handle alerts
    this.page.on('dialog', async dialog => {
      console.log(`Dialog appeared: ${dialog.message()}`);
      await dialog.accept();
    });

    // Handle potential popups
    const popup = this.page.locator('[data-testid="popup"], .modal, .overlay');
    if (await popup.isVisible({ timeout: 2000 })) {
      const closeButton = popup.locator('button[aria-label*="close"], .close, [data-testid="close"]').first();
      if (await closeButton.isVisible({ timeout: 1000 })) {
        await closeButton.click();
      }
    }
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(timeout: number = 30000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Check if element exists without throwing error
   */
  async elementExists(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await this.page.locator(selector).waitFor({ state: 'visible', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get page title for verification
   */
  async getPageTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  /**
   * Take screenshot for debugging
   */
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `reports/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }

  /**
   * Setup performance monitoring
   */
  async setupPerformanceMonitoring(): Promise<void> {
    await this.metricsCollector.setupPerformanceObservers();
    await this.metricsCollector.injectWebVitalsLibrary();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    this.customMetrics = {};
    // Any other cleanup needed
  }
}
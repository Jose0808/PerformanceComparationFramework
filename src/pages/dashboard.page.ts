import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { FrameOptionsByRole } from '../types/frameOptions';

export class DashboardPage extends BasePage {
  [x: string]: any;
  // Generic selectors that should work for most login forms
  private readonly successIndicators = '#sitemap';
  private readonly siteMap = '#sitemap';

  private readonly currentFrame = "div:nth-child(3) > iframe";
  private readonly integratedOperation: FrameOptionsByRole = { role: "listitem", options: { name: "Operación Integrada (Nuevo)" } };
  private readonly individual360View: FrameOptionsByRole = { role: "link", options: { name: "Vista 360° Individual" } };

  constructor(page: Page) {
    super(page);
  }

  /**
   * Select option left menu
   */
  async selectLeftMenu(menu: string): Promise<void> {
    const StartTime = Date.now();
    console.log(`Starting select menu`);

    try {
      // Submit form
      await this.clickElement(this.siteMap, "Menu_Button");
      const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
      await frameSelector.getByRole(this.integratedOperation.role, { name: menu }).waitFor({
        state: 'visible',
        timeout: this.config.test.timeout
      });

      const EndTime = Date.now();
      const totalTime = EndTime - StartTime;

      await this.metricsCollector.recordCustomMetric('total_select_menu_time', totalTime);
      console.log(`✅ Select menu completed successfully in ${totalTime}ms`);

      // Collect final performance metrics
      await this.collectPerformanceMetrics();

    } catch (error) {
      const EndTime = Date.now();
      const totalTime = EndTime - StartTime;
      await this.metricsCollector.recordCustomMetric('failed_select_menu_time', totalTime);
      console.error(`❌ Select Menu failed for after ${totalTime}ms:`, error);

      throw error;
    }
  }

  /**
   * Select option left menu Map Site
   */
  async selectMenuMapSite(menu: string, subMenu: string): Promise<void> {
    const StartTime = Date.now();
    console.log(`Starting select menu map site`);

    try {
      const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
      await frameSelector.getByRole(this.integratedOperation.role, { name: menu }).click();
      await frameSelector.getByRole(this.individual360View.role, { name: subMenu }).click();

      const EndTime = Date.now();
      const totalTime = EndTime - StartTime;

      await this.metricsCollector.recordCustomMetric('total_select_menu_map_site_time', totalTime);
      console.log(`✅ Select menu map site completed successfully in ${totalTime}ms`);

      // Collect final performance metrics
      await this.collectPerformanceMetrics();

    } catch (error) {
      const EndTime = Date.now();
      const totalTime = EndTime - StartTime;
      await this.metricsCollector.recordCustomMetric('failed_select_menu_map_site_time', totalTime);
      console.error(`❌ Select Menu map site failed for after ${totalTime}ms:`, error);

      throw error;
    }
  }

  /**
   * Wait for successful login indicators
   */
  async waitForSuccessfulLogin(): Promise<void> {
    const startTime = Date.now();
    console.log('Waiting for successful login indicators');

    try {
      const exists = await this.elementExists(this.successIndicators);
      if (!exists) {
        throw new Error(`Login may have failed - still seeing login elements: ${this.successIndicators}`);
      }
      console.log(`Login success detected with indicator: ${this.successIndicators}`);
    } catch {
      throw new Error('Login success not found');
    }
    await this.waitFoLoad();

    const endTime = Date.now();
    const waitTime = endTime - startTime;

    await this.metricsCollector.recordCustomMetric('login_success_wait_time', waitTime);
    console.log(`Login success verification completed in ${waitTime}ms`);
  }

}
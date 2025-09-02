import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { FrameOptionsByRole } from '../types/frameOptions';
import { TestTimer } from '../utils/timer.utils';

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
   * Select option left menu Map Site
   */
  async selectOnDashboard(appConfig: AppConfig, timer: TestTimer, menu: string, subMenu: string): Promise<void> {

    timer.startStep(appConfig.name, 'Seleccionar menús Dashboard');
    await this.selectLeftMenu(timer, menu);
    await this.selectMenuMapSite(timer, menu, subMenu);
    timer.endStep();
  }


  /**
   * Select option left menu dashboard
   */
  async selectLeftMenu(timer: TestTimer, menu: string): Promise<void> {
    console.log(`Starting select menu`);
    try {

      timer.startSubStep('Click en menú: Mapa de sitio ');
      // Submit form
      await this.clickElement(this.siteMap);
      timer.endSubStep();

      timer.startSubStep('Espera visibilidad de el menú: ' + menu) ;
      const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
      const element = frameSelector.getByRole(this.integratedOperation.role, { name: menu });
      await this.waitForElementLocator(element, "Pantalla Menú " + menu);
      timer.endSubStep();


      // await frameSelector.getByRole(this.integratedOperation.role, { name: menu }).waitFor({
      //   state: 'visible',
      //   timeout: this.config.test.timeout
      // });
      console.log(`✅ Select menu completed successfully`);

    } catch (error) {
      console.error(`❌ Select Menu failed`, error);

      throw error;
    }
  }

  /**
   * Select option left menu Map Site
   */
  async selectMenuMapSite(timer: TestTimer, menu: string, subMenu: string): Promise<void> {
    const StartTime = Date.now();
    console.log(`Starting select menu map site`);

    try {      
      timer.startSubStep('Click menú: ' + menu) ;
      const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
      await frameSelector.getByRole(this.integratedOperation.role, { name: menu }).click();
      timer.endSubStep();
      timer.startSubStep('Click en submenú: ' + subMenu) ;
      await frameSelector.getByRole(this.individual360View.role, { name: subMenu }).click();
      timer.endSubStep();

      console.log(`✅ Select menu map site completed successfully`);
    } catch (error) {
      console.error(`❌ Select Menu map site failed`, error);

      throw error;
    }
  }

  /**
   * Wait for successful login indicators
   */
  async waitForSuccessfulLogin(): Promise<void> {
    console.log('Waiting for successful login indicators');

    try {
      const exists = await this.waitForElement(this.successIndicators, "Pantalla dashboard");
      if (!exists) {
        throw new Error(`Login may have failed - still seeing login elements: ${this.successIndicators}`);
      }
      console.log(`Login success detected with indicator: ${this.successIndicators}`);
    } catch {
      throw new Error('Login success not found');
    }
    await this.waitFoLoad();
    console.log(`Login success verification completed`);
  }

}
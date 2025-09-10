

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { DashboardPage } from './dashboard.page';
import { TestTimer } from '../utils/timer.utils';

export class LoginPage extends BasePage {
  [x: string]: any;
  // Generic selectors that should work for most login forms
  private readonly accountTypeInput = '#accountTypeSelect';
  private readonly usernameInput = '#ipt_name';
  private readonly passwordInput = '#ipt_pwd';
  private readonly loginButton = '#loginBtn';
  private dashboardPage: DashboardPage;


  constructor(page: Page) {
    super(page);
    this.dashboardPage = new DashboardPage(page);
  }


  /**
   * Complete login flow with performance tracking
   */
  async login(appConfig: AppConfig, timer: TestTimer): Promise<void> {

    // PASO 1: LOGIN
    timer.startStep(appConfig.name, 'Login');
    console.log(`Starting login flow for ${appConfig.name}`);

    try {
      // Navigate to login page
      timer.startSubStep('Navegar a la pagina');
      await this.goto(appConfig.baseUrl);
      timer.endSubStep();

      // Fill credentials
      timer.startSubStep('Ingresar credenciales');
      await this.fillDropdown(this.accountTypeInput, appConfig.accountType);
      await this.fillInput(this.usernameInput, appConfig.username);
      await this.fillInput(this.passwordInput, appConfig.password);

      // Submit form
      await this.clickElement(this.loginButton);
      timer.endSubStep();

      // Wait for successful login
      timer.startSubStep('Espera de login exitoso');
      await this.dashboardPage.waitForSuccessfulLogin();
      timer.endSubStep();
      timer.endStep();

      console.log(`✅ Login completed successfully in for ${appConfig.name}`);

    } catch (error) {
      console.error(`❌ Login failed for ${appConfig.name}`, error);

      // Take screenshot for debugging
      await this.takeScreenshot(`login_failed_${appConfig.name}`);

      throw error;
    }
  }

}
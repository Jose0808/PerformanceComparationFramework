

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { DashboardPage } from './dashboard.page';

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
  async login(appConfig: AppConfig): Promise<void> {
    const loginStartTime = Date.now();
    console.log(`Starting login flow for ${appConfig.name}`);

    try {
      // Navigate to login page
      await this.goto(appConfig.baseUrl);

      // Fill credentials
      await this.fillDropdown(this.accountTypeInput, appConfig.accountType, "Account_Type");
      await this.fillInput(this.usernameInput, appConfig.username, "Username");
      await this.fillInput(this.passwordInput, appConfig.password, "Password");

      // Submit form
      await this.clickElementAndWait(this.loginButton, "Login_Button");

      // Wait for successful login
      await this.dashboardPage.waitForSuccessfulLogin();

      const loginEndTime = Date.now();
      const totalLoginTime = loginEndTime - loginStartTime;

      await this.metricsCollector.recordCustomMetric('total_login_time', totalLoginTime);
      console.log(`✅ Login completed successfully in ${totalLoginTime}ms for ${appConfig.name}`);

      // Collect final performance metrics
      await this.collectPerformanceMetrics();

    } catch (error) {
      const loginEndTime = Date.now();
      const totalLoginTime = loginEndTime - loginStartTime;

      await this.metricsCollector.recordCustomMetric('failed_login_time', totalLoginTime);
      console.error(`❌ Login failed for ${appConfig.name} after ${totalLoginTime}ms:`, error);

      // Take screenshot for debugging
      await this.takeScreenshot(`login_failed_${appConfig.name}`);

      throw error;
    }
  }

}
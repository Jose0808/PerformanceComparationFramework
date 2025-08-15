import { Page, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { ApplicationConfig } from '../types';

export class LoginPage extends BasePage {
  // Selectors - These should be customized for your applications
  private selectors = {
    usernameField: '[data-testid="username"], #username, input[name="username"], input[type="email"]',
    passwordField: '[data-testid="password"], #password, input[name="password"], input[type="password"]',
    loginButton: '[data-testid="login"], #login, button[type="submit"], input[type="submit"]',
    errorMessage: '[data-testid="error"], .error, .alert-error, .login-error',
    loadingSpinner: '[data-testid="loading"], .loading, .spinner',
    successMessage: '[data-testid="success"], .success, .alert-success'
  };

  constructor(page: Page, appConfig: ApplicationConfig) {
    super(page, appConfig);
  }

  /**
   * Navigate to login page and measure load time
   */
  async navigateToLogin(): Promise<number> {
    const loginUrl = `${this.appConfig.baseUrl}/login`;
    const navigationTime = await this.navigateTo(loginUrl);
    
    await this.verifyLoginPageLoaded();
    return navigationTime;
  }

  /**
   * Perform login process and measure individual steps
   */
  async performLogin(username?: string, password?: string): Promise<{
    totalLoginTime: number;
    usernameFieldTime: number;
    passwordFieldTime: number;
    submitTime: number;
    redirectTime: number;
  }> {
    const startTime = Date.now();
    
    // Use provided credentials or default from config
    const loginUsername = username || this.appConfig.credentials?.username || '';
    const loginPassword = password || this.appConfig.credentials?.password || '';

    // Measure username field interaction
    const usernameFieldTime = await this.fillAndMeasure(
      this.selectors.usernameField, 
      loginUsername, 
      'username_field'
    );

    // Measure password field interaction
    const passwordFieldTime = await this.fillAndMeasure(
      this.selectors.passwordField, 
      loginPassword, 
      'password_field'
    );

    // Measure form submission
    const submitStartTime = Date.now();
    await this.clickAndMeasure(this.selectors.loginButton, 'login_submit');
    
    // Wait for login to complete (either success redirect or error)
    await this.waitForLoginCompletion();
    const submitTime = Date.now() - submitStartTime;

    // Measure redirect time if successful
    const redirectStartTime = Date.now();
    const isLoginSuccessful = await this.isLoginSuccessful();
    const redirectTime = isLoginSuccessful ? Date.now() - redirectStartTime : 0;

    const totalLoginTime = Date.now() - startTime;

    // Store custom metrics
    this.setCustomMetric('login_total_time', totalLoginTime);
    this.setCustomMetric('login_username_time', usernameFieldTime);
    this.setCustomMetric('login_password_time', passwordFieldTime);
    this.setCustomMetric('login_submit_time', submitTime);
    this.setCustomMetric('login_redirect_time', redirectTime);

    return {
      totalLoginTime,
      usernameFieldTime,
      passwordFieldTime,
      submitTime,
      redirectTime
    };
  }

  /**
   * Wait for login completion (success or error)
   */
  private async waitForLoginCompletion(): Promise<void> {
    try {
      // Wait for either success (URL change) or error message
      await Promise.race([
        this.page.waitForURL(url => !url.href.includes('/login'), { timeout: 10000 }),
        this.waitForElement(this.selectors.errorMessage, 10000),
        this.waitForElement(this.selectors.successMessage, 10000)
      ]);
    } catch (error) {
      console.warn('Login completion timeout, proceeding with verification');
    }

    // Additional wait for any animations or redirects
    await this.page.waitForTimeout(1000);
  }

  /**
   * Check if login was successful
   */
  async isLoginSuccessful(): Promise<boolean> {
    const currentUrl = this.getCurrentUrl();
    const hasErrorMessage = await this.elementExists(this.selectors.errorMessage, 2000);
    
    return !currentUrl.includes('/login') && !hasErrorMessage;
  }

  /**
   * Verify login page loaded correctly
   */
  async verifyLoginPageLoaded(): Promise<void> {
    await this.verifyPageLoaded('/login');
    
    // Verify essential login elements are present
    await this.waitForElement(this.selectors.usernameField);
    await this.waitForElement(this.selectors.passwordField);
    await this.waitForElement(this.selectors.loginButton);
  }

  /**
   * Get login error message if present
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.elementExists(this.selectors.errorMessage, 2000)) {
      return await this.page.locator(this.selectors.errorMessage).textContent();
    }
    return null;
  }

  /**
   * Measure login form rendering time
   */
  async measureFormRenderTime(): Promise<number> {
    const startTime = Date.now();
    
    await Promise.all([
      this.waitForElement(this.selectors.usernameField),
      this.waitForElement(this.selectors.passwordField),
      this.waitForElement(this.selectors.loginButton)
    ]);
    
    const renderTime = Date.now() - startTime;
    this.setCustomMetric('login_form_render_time', renderTime);
    
    return renderTime;
  }

  /**
   * Check if login button is enabled
   */
  async isLoginButtonEnabled(): Promise<boolean> {
    const loginButton = this.page.locator(this.selectors.loginButton);
    return await loginButton.isEnabled();
  }

  /**
   * Measure time to enable login button (if it starts disabled)
   */
  async measureButtonEnableTime(): Promise<number> {
    const startTime = Date.now();
    const loginButton = this.page.locator(this.selectors.loginButton);
    
    if (await loginButton.isEnabled()) {
      return 0; // Already enabled
    }
    
    await loginButton.waitFor({ state: 'attached' });
    await expect(loginButton).toBeEnabled({ timeout: 10000 });
    
    const enableTime = Date.now() - startTime;
    this.setCustomMetric('login_button_enable_time', enableTime);
    
    return enableTime;
  }

  /**
   * Test invalid login and measure error response time
   */
  async testInvalidLogin(): Promise<number> {
    const startTime = Date.now();
    
    await this.fillAndMeasure(this.selectors.usernameField, 'invalid@email.com');
    await this.fillAndMeasure(this.selectors.passwordField, 'wrongpassword');
    await this.clickAndMeasure(this.selectors.loginButton, 'invalid_login_submit');
    
    // Wait for error message
    await this.waitForElement(this.selectors.errorMessage);
    
    const errorResponseTime = Date.now() - startTime;
    this.setCustomMetric('login_error_response_time', errorResponseTime);
    
    return errorResponseTime;
  }

  /**
   * Clear login form
   */
  async clearForm(): Promise<void> {
    await this.page.locator(this.selectors.usernameField).clear();
    await this.page.locator(this.selectors.passwordField).clear();
  }

  /**
   * Check for loading indicators during login
   */
  async measureLoadingIndicatorTime(): Promise<number> {
    let loadingTime = 0;
    
    if (await this.elementExists(this.selectors.loadingSpinner, 1000)) {
      const startTime = Date.now();
      
      // Wait for loading to disappear
      await this.page.locator(this.selectors.loadingSpinner).waitFor({ 
        state: 'detached', 
        timeout: 10000 
      });
      
      loadingTime = Date.now() - startTime;
      this.setCustomMetric('login_loading_time', loadingTime);
    }
    
    return loadingTime;
  }

  /**
   * Perform complete login flow with detailed metrics
   */
  async performDetailedLoginFlow(username?: string, password?: string): Promise<{
    navigationTime: number;
    formRenderTime: number;
    loginMetrics: any;
    loadingTime: number;
    isSuccessful: boolean;
    errorMessage?: string | null;
  }> {
    // Navigate to login page
    const navigationTime = await this.navigateToLogin();
    
    // Measure form render time
    const formRenderTime = await this.measureFormRenderTime();
    
    // Perform login
    const loginMetrics = await this.performLogin(username, password);
    
    // Measure loading indicators
    const loadingTime = await this.measureLoadingIndicatorTime();
    
    // Check results
    const isSuccessful = await this.isLoginSuccessful();
    const errorMessage = isSuccessful ? undefined : await this.getErrorMessage();
    
    return {
      navigationTime,
      formRenderTime,
      loginMetrics,
      loadingTime,
      isSuccessful,
      errorMessage,
    };
  }
}
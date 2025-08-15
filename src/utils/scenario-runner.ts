import { Page } from '@playwright/test';
import { TestScenario, TestStep, ApplicationConfig, MetricsResult } from '../types';
import { MetricsCollector } from './metrics-collector';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import * as fs from 'fs';
import * as path from 'path';

export class ScenarioRunner {
  private page: Page;
  private appConfig: ApplicationConfig;
  private metricsCollector: MetricsCollector;
  private loginPage: LoginPage;
  private dashboardPage: DashboardPage;
  private testData: any;

  constructor(page: Page, appConfig: ApplicationConfig) {
    this.page = page;
    this.appConfig = appConfig;
    this.metricsCollector = new MetricsCollector(page);
    this.loginPage = new LoginPage(page, appConfig);
    this.dashboardPage = new DashboardPage(page, appConfig);
    this.loadTestData();
  }

  /**
   * Load test data from JSON file
   */
  private loadTestData(): void {
    try {
      const dataPath = path.join(process.cwd(), 'data', 'test-scenarios.json');
      const rawData = fs.readFileSync(dataPath, 'utf8');
      this.testData = JSON.parse(rawData);
    } catch (error) {
      console.error('Failed to load test data:', error);
      this.testData = {};
    }
  }

  /**
   * Run a specific scenario
   */
  async runScenario(
    scenarioName: string,
    environment: 'pre' | 'pro',
    iteration: number
  ): Promise<MetricsResult> {
    const scenario = this.getScenario(scenarioName);
    if (!scenario) {
      throw new Error(`Scenario '${scenarioName}' not found`);
    }

    console.log(`Running scenario: ${scenarioName} (iteration ${iteration})`);

    // Setup performance monitoring
    await this.metricsCollector.setupPerformanceObservers();
    await this.metricsCollector.injectWebVitalsLibrary();

    const startTime = Date.now();
    let currentUrl = this.appConfig.baseUrl;

    try {
      // Execute scenario steps
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        console.log(`  Executing step ${i + 1}: ${step.action}`);
        
        await this.executeStep(step, scenarioName);
        currentUrl = this.page.url();
      }

      // Wait for page to stabilize
      await this.metricsCollector.waitForPageLoad();

      // Collect all metrics
      const metrics = await this.metricsCollector.collectAllMetrics(
        currentUrl,
        environment,
        this.appConfig.name,
        scenarioName,
        iteration
      );

      console.log(`  Scenario completed in ${Date.now() - startTime}ms`);
      return metrics;

    } catch (error) {
      console.error(`  Scenario failed: ${error}`);
      throw error;
    }
  }

  /**
   * Execute individual test step
   */
  private async executeStep(step: TestStep, scenarioName: string): Promise<void> {
    const timeout = step.timeout || 10000;

    switch (step.action) {
      case 'navigate':
        await this.executeNavigateStep(step);
        break;

      case 'click':
        await this.executeClickStep(step, timeout);
        break;

      case 'fill':
        await this.executeFillStep(step);
        break;

      case 'wait':
        await this.executeWaitStep(step, timeout);
        break;

      case 'custom':
        await this.executeCustomStep(step, scenarioName);
        break;

      default:
        console.warn(`Unknown step action: ${step.action}`);
    }
  }

  /**
   * Execute navigation step
   */
  private async executeNavigateStep(step: TestStep): Promise<void> {
    const url = step.url?.startsWith('http') 
      ? step.url 
      : `${this.appConfig.baseUrl}${step.url}`;
    
    await this.page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: step.timeout || 30000
    });
  }

  /**
   * Execute click step
   */
  private async executeClickStep(step: TestStep, timeout: number): Promise<void> {
    if (!step.selector) {
      throw new Error('Click step requires selector');
    }

    const element = this.page.locator(step.selector);
    await element.waitFor({ state: 'visible', timeout });
    await element.click();
    
    // Wait for potential navigation or content changes
    await this.page.waitForTimeout(1000);
  }

  /**
   * Execute fill step
   */
  private async executeFillStep(step: TestStep): Promise<void> {
    if (!step.selector || step.value === undefined) {
      throw new Error('Fill step requires selector and value');
    }

    const element = this.page.locator(step.selector);
    await element.waitFor({ state: 'visible', timeout: 5000 });
    
    // Process value with test data substitution
    const value = this.processValue(step.value);
    
    await element.clear();
    await element.fill(value);
  }

  /**
   * Execute wait step
   */
  private async executeWaitStep(step: TestStep, timeout: number): Promise<void> {
    if (step.selector) {
      // Wait for element
      const element = this.page.locator(step.selector);
      await element.waitFor({ state: 'visible', timeout });
    } else {
      // Simple timeout wait
      await this.page.waitForTimeout(Math.min(timeout, 10000));
    }
  }

  /**
   * Execute custom step
   */
  private async executeCustomStep(step: TestStep, scenarioName: string): Promise<void> {
    if (!step.customFunction) {
      throw new Error('Custom step requires customFunction');
    }

    switch (step.customFunction) {
      case 'measureDashboardWidgets':
        await this.dashboardPage.measureDashboardLoad();
        break;

      case 'uploadTestFile':
        await this.executeFileUpload();
        break;

      case 'measureApiResponseTime':
        await this.measureApiResponses();
        break;

      case 'simulateUserInteractions':
        await this.simulateUserInteractions(scenarioName);
        break;

      default:
        console.warn(`Unknown custom function: ${step.customFunction}`);
    }
  }

  /**
   * Process value with test data substitution
   */
  private processValue(value: string): string {
    if (!value.includes('${')) {
      return value;
    }

    let processedValue = value;

    // Replace username
    if (processedValue.includes('${username}')) {
      const user = this.getRandomUser();
      processedValue = processedValue.replace('${username}', user.username);
    }

    // Replace password
    if (processedValue.includes('${password}')) {
      const user = this.getRandomUser();
      processedValue = processedValue.replace('${password}', user.password);
    }

    // Replace other test data
    processedValue = processedValue.replace(/\$\{(\w+)\}/g, (match, key) => {
      return this.getTestDataValue(key) || match;
    });

    return processedValue;
  }

  /**
   * Get random user from test data
   */
  private getRandomUser(): any {
    const users = this.testData.testData?.users || [
      { username: 'testuser@example.com', password: 'testpass' }
    ];
    return users[Math.floor(Math.random() * users.length)];
  }

  /**
   * Get test data value by key
   */
  private getTestDataValue(key: string): string {
    const testData = this.testData.testData || {};
    
    // Handle nested keys like formData.basic.title
    const keys = key.split('.');
    let value = testData;
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return typeof value === 'string' ? value : '';
  }

  /**
   * Get scenario by name
   */
  private getScenario(name: string): TestScenario | null {
    const scenarios = this.testData.scenarios || [];
    return scenarios.find((s: any) => s.name === name) || null;
  }

  /**
   * Execute file upload
   */
  private async executeFileUpload(): Promise<void> {
    try {
      // Create a test file for upload
      const testFilePath = path.join(process.cwd(), 'temp-test-file.txt');
      fs.writeFileSync(testFilePath, 'This is a test file for performance testing.');

      const fileInput = this.page.locator('input[type="file"]');
      await fileInput.setInputFiles(testFilePath);

      // Clean up
      fs.unlinkSync(testFilePath);
    } catch (error) {
      console.warn('File upload test failed:', error);
    }
  }

  /**
   * Measure API response times
   */
  private async measureApiResponses(): Promise<void> {
    const commonEndpoints = ['/api/data', '/api/user', '/api/dashboard'];
    
    for (const endpoint of commonEndpoints) {
      try {
        const responseTime = await this.metricsCollector.measureApiResponseTime(
          `${this.appConfig.baseUrl}${endpoint}`
        );
        
        if (responseTime > 0) {
          this.metricsCollector.setApplicationMetric('apiResponseTimes', endpoint, responseTime);
        }
      } catch (error) {
        // Endpoint might not exist
      }
    }
  }

  /**
   * Simulate realistic user interactions
   */
  private async simulateUserInteractions(scenarioName: string): Promise<void> {
    // Add realistic delays between actions
    await this.page.waitForTimeout(500 + Math.random() * 1000);

    // Simulate mouse movements
    await this.page.mouse.move(100, 100);
    await this.page.waitForTimeout(200);
    await this.page.mouse.move(300, 200);

    // Scroll if the page is long enough
    const pageHeight = await this.page.evaluate(() => document.body.scrollHeight);
    if (pageHeight > 800) {
      await this.page.mouse.wheel(0, 300);
      await this.page.waitForTimeout(500);
      await this.page.mouse.wheel(0, -150);
    }

    // Focus and blur events
    const inputs = this.page.locator('input, textarea');
    const inputCount = await inputs.count();
    if (inputCount > 0) {
      const randomInput = inputs.nth(Math.floor(Math.random() * inputCount));
      await randomInput.focus();
      await this.page.waitForTimeout(200);
      await randomInput.blur();
    }
  }

  /**
   * Run scenario with authentication
   */
  async runScenarioWithAuth(
    scenarioName: string,
    environment: 'pre' | 'pro',
    iteration: number,
    requiresLogin: boolean = true
  ): Promise<MetricsResult> {
    if (requiresLogin) {
      console.log('  Performing login...');
      await this.loginPage.navigateToLogin();
      await this.loginPage.performLogin();
      
      const isLoggedIn = await this.loginPage.isLoginSuccessful();
      if (!isLoggedIn) {
        throw new Error('Login failed before running scenario');
      }
    }

    return await this.runScenario(scenarioName, environment, iteration);
  }

  /**
   * Get available scenarios
   */
  getAvailableScenarios(): string[] {
    const scenarios = this.testData.scenarios || [];
    return scenarios.map((s: any) => s.name);
  }

  /**
   * Validate scenario exists
   */
  isValidScenario(scenarioName: string): boolean {
    return this.getAvailableScenarios().includes(scenarioName);
  }

  /**
   * Get scenario expected metrics
   */
  getScenarioExpectedMetrics(scenarioName: string): any {
    const scenario = this.getScenario(scenarioName);
    return scenario?.expectedMetrics || {};
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.loginPage.cleanup();
    await this.dashboardPage.cleanup();
  }
}
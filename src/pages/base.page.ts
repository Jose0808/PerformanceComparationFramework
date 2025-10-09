import { Page, Locator, expect, FrameLocator } from '@playwright/test';
import { ConfigManager } from '../config/ConfigManager';
import { MetricsCollector } from '../collectors/MetricsCollector';
import { TestTimer } from '../utils/timer.utils';

/**
 * Abstract base class for all page objects in the test framework.
 * Provides common functionality for page navigation, element interaction,
 * performance monitoring, and utility methods.
 */
export abstract class BasePage {
  protected readonly page: Page;
  protected readonly config: ConfigManager;
  protected readonly metricsCollector: MetricsCollector;

  constructor(page: Page) {
    this.page = page;
    this.config = ConfigManager.getInstance();
    this.metricsCollector = new MetricsCollector(page);
  }

  // =============================================
  // NAVIGATION METHODS
  // =============================================

  /**
   * Navigate to a specific URL with performance tracking and comprehensive wait strategies
   * @param url - Target URL to navigate to
   * @param options - Additional navigation options
   */
  async goto(url: string, timer: TestTimer,
    options?: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
      timeout?: number;
      referer?: string;
    }): Promise<void> {
    timer.startSubStep('Navegar a la URL');
    try {
      console.log(`⏳ Navegando a la URL: ${url}`);
      await this.page.goto(url, {
        waitUntil: options?.waitUntil || 'networkidle',
        timeout: options?.timeout || (this.config.test.timeout * 1000),
        referer: options?.referer
      });
      await this.waitForPageLoad();
      console.log(`✅ Navegación finalizada`);
      timer.endSubStep();
    } catch (error) {
      throw new Error(`❌ Error en la navegación URL: ${url}: ${error}`);
    }
  }

  /**
   * Refresh the current page with performance tracking
   */
  async refresh(): Promise<void> {
    await this.page.reload({ waitUntil: 'networkidle' });
    await this.waitForPageLoad();
  }

  /**
   * Navigate back in browser history
   */
  async goBack(): Promise<void> {
    await this.page.goBack({ waitUntil: 'networkidle' });
    await this.waitForPageLoad();
  }

  /**
   * Navigate forward in browser history
   */
  async goForward(): Promise<void> {
    await this.page.goForward({ waitUntil: 'networkidle' });
    await this.waitForPageLoad();
  }

  // =============================================
  // ELEMENT INTERACTION METHODS
  // =============================================

  /**
   * Wait for element to be visible with enhanced error handling
   * @param selector - Element selector
   * @param timeout - Optional timeout override
   * @returns Promise<Locator>
   */
  async waitForElement(selector: string, description: string, frame?: FrameLocator): Promise<Locator> {
    try {
      console.log(`⏳ Esperando elemento: ${selector}`);
      let element = frame ? frame.locator(selector) : this.page.locator(selector);

      await element.waitFor({
        state: 'visible',
        timeout: this.config.test.timeout
      });
      console.log(`✅ Elemento encontrado`);

      return element;

    } catch (error) {
      throw new Error(`❌ Error al esperar el elemento: ${selector}. ${error}`);
    }
  }

  /**
   * Wait for element to be visible with enhanced error handling
   * @param selector - Element selector
   * @param timeout - Optional timeout override
   * @returns Promise<Locator>
   */
  async waitForElementLocator(selector: Locator, description: string): Promise<void> {
    console.log(`⏳ Esperando elemento`);
    try {
      await selector.waitFor({
        state: 'visible',
        timeout: this.config.test.timeout
      });
      console.log(`✅ Elemento encontrado`);
    } catch (error) {
      throw new Error(`❌ Error al esperar el elemento: ${selector}. ${error}`);
    }
  }

  /**
   * Wait for element to be attached to DOM
   * @param selector - Element selector
   * @param timeout - Optional timeout override
   * @returns Promise<Locator>
   */
  async waitForElementAttached(selector: string, timeout?: number): Promise<Locator> {
    console.log(`⏳ Esperando elemento: ${selector}`);
    try {
      const element = this.page.locator(selector);
      await element.waitFor({
        state: 'attached',
        timeout: timeout || this.config.test.timeout
      });
      console.log(`✅ Finalizado: Esperar elemento`);
      return element;
    } catch (error) {
      throw new Error(`❌ Error al esperar el elemento: ${selector}. ${error}`);
    }
  }

  /**
   * Click element with enhanced error handling and performance tracking
   * @param selector - Element selector
   * @param description - Optional description for metrics
   * @param options - Click options
   */
  async clickElement(
    selector: string,
    options?: {
      force?: boolean;
      timeout?: number;
      position?: { x: number; y: number };
      modifiers?: ('Alt' | 'Control' | 'Meta' | 'Shift')[];
    },
    frame?: FrameLocator
  ): Promise<void> {
    try {
      console.log(`⏳ Haciendo clic en el campo: ${selector}`);
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      await element.click({
        force: options?.force,
        timeout: options?.timeout || this.config.test.timeout,
        position: options?.position,
        modifiers: options?.modifiers
      });
      console.log(`✅ Finalizado: Hacer clic`);
    } catch (error) {
      throw new Error(`❌ Error al hacer clic en el campo: ${selector}. ${error}`);
    }
  }

  /**
   * Double-click element with performance tracking
   * @param selector - Element selector
   * @param description - Optional description for metrics
   */
  async doubleClickElement(selector: string, frame?: FrameLocator): Promise<void> {
    try {
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      await element.dblclick();
    } catch (error) {
      throw new Error(`❌ Failed to double-click element: ${selector}. ${error}`);
    }
  }

  /**
   * Right-click element with performance tracking
   * @param selector - Element selector
   * @param description - Optional description for metrics
   */
  async rightClickElement(selector: string, frame?: FrameLocator): Promise<void> {
    try {
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      await element.click({ button: 'right' });
    } catch (error) {
      throw new Error(`❌ Failed to right-click element: ${selector}. ${error}`);
    }
  }

  /**
   * Fill input field with enhanced validation and performance tracking
   * @param selector - Input field selector
   * @param value - Value to fill
   * @param description - Optional description for metrics
   * @param options - Fill options
   */
  async fillInput(
    selector: string,
    value: string,
    frame?: FrameLocator,
  ): Promise<void> {
    try {
      console.log(`⏳ Escribiendo: ${value} en el campo: ${selector}`);

      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      // Clear existing content
      await element.clear();

      // Fill with new value
      await element.fill(value);

      // Verify the value was set correctly
      const actualValue = await element.inputValue();
      if (actualValue !== value) {
        console.warn(`⚠️ Se esperaba el valor: "${value}" pero se obtuvo: "${actualValue}" para el selector: ${selector}`);
      }
      console.log(`✅ Valor escrito en el campo`);

    } catch (error) {
      throw new Error(`❌ Error al ingresar valor en el campo: ${selector} y el valor: ${value}. ${error}`);
    }
  }

  /**
   * Type text with realistic typing simulation
   * @param selector - Element selector
   * @param text - Text to type
   * @param delay - Delay between keystrokes (ms)
   */
  async typeText(selector: string, text: string, delay: number = 100, description: string, frame?: FrameLocator): Promise<void> {
    try {
      const element = await this.waitForElement(selector, description, frame);
      await element.type(text, { delay });
    } catch (error) {
      throw new Error(`❌ Failed to type text in element: ${selector}. ${error}`);
    }
  }

  /**
   * Fill dropdown/select element with performance tracking
   * @param selector - Dropdown selector
   * @param value - Value or option text to select
   * @param description - Optional description for metrics
   */
  async fillDropdown(selector: string, value: string, frame?: FrameLocator): Promise<void> {
    try {
      console.log(`⏳ Eligiendo opción menú desplegable`);
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      await element.selectOption({ value });
      console.log(`✅ Finalizado: Elegir opción menú desplegable`);
    } catch (error) {
      throw new Error(`❌ Error al seleccionar la opción: "${value}" en el menú desplegable: ${selector}. ${error}`);
    }
  }


  /**
   * Fill dropdown/select element with performance tracking
   * @param selector - Dropdown selector
   * @param value - Value or option text to select
   * @param description - Optional description for metrics
   */
  async fillDropdownLabel(selector: string, value: string = ''): Promise<void> {
    try {
      const element = this.page.locator(selector);
      await element.waitFor({
        state: 'visible',
        timeout: this.config.test.timeout
      });
      await element.selectOption({ label: value });
    } catch (error) {
      throw new Error(`❌ Failed to select option "${value}" in dropdown: ${selector}. ${error}`);
    }
  }

  /**
   * Check/uncheck checkbox or radio button
   * @param selector - Element selector
   * @param checked - Whether to check or uncheck
   */
  async setCheckbox(selector: string, checked: boolean, frame?: FrameLocator): Promise<void> {
    try {
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      await element.setChecked(checked);
    } catch (error) {
      throw new Error(`❌ Failed to ${checked ? 'check' : 'uncheck'} element: ${selector}. ${error}`);
    }
  }

  /**
   * Upload file to input element
   * @param selector - File input selector
   * @param filePaths - Array of file paths to upload
   */
  async uploadFiles(selector: string, filePaths: string[], description: string, frame?: FrameLocator): Promise<void> {
    try {
      const element = await this.waitForElement(selector, description, frame);
      await element.setInputFiles(filePaths);
    } catch (error) {
      throw new Error(`❌ Failed to upload files to element: ${selector}. ${error}`);
    }
  }

  // =============================================
  // WAIT AND TIMING METHODS
  // =============================================

  /**
   * Wait for network to be idle with configurable timeout
   * @param timeout - Timeout in milliseconds
   */
  async waitForNetworkIdle(timeout?: number): Promise<void> {
    await this.page.waitForLoadState('networkidle', {
      timeout: timeout || this.config.test.timeout * 1000
    });
  }

  /**
   * Wait for specific text to be visible on the page
   * @param text - Text to wait for
   * @param timeout - Optional timeout override
   */
  async waitForText(text: string, timeout?: number): Promise<void> {
    try {
      await this.page.waitForSelector(`text=${text}`, {
        timeout: timeout || this.config.test.timeout
      });
    } catch (error) {
      throw new Error(`❌ Text "${text}" not found within timeout. ${error}`);
    }
  }

  /**
   * Wait for URL to match pattern
   * @param pattern - URL pattern (string or RegExp)
   * @param timeout - Optional timeout override
   */
  async waitForUrl(pattern: string | RegExp, timeout?: number): Promise<void> {
    await this.page.waitForURL(pattern, {
      timeout: timeout || this.config.test.timeout
    });
  }

  /**
   * Wait for page to load completely with multiple strategies
   */
  async waitForPageLoad(): Promise<void> {
    await Promise.all([
      this.page.waitForLoadState('domcontentloaded', { timeout: this.config.test.timeout }),
      this.page.waitForLoadState('networkidle', { timeout: this.config.test.timeout })
    ]);
  }

  /**
   * Wait for page to load completely with multiple strategies
   */
  async waitFoLoad(): Promise<void> {
    console.log(`⏳ Esperando cargue de la pagina`);
    await this.page.waitForLoadState('domcontentloaded', { timeout: this.config.test.timeout });
      console.log(`✅ Pagina cargada completamente`);

  }


  // =============================================
  // VALIDATION AND ASSERTION METHODS
  // =============================================

  /**
   * Check if element exists without throwing error
   * @param selector - Element selector
   * @param timeout - Optional timeout for check
   * @returns Promise<boolean>
   */
  async elementExists(selector: string, timeout?: number): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout: (timeout || this.config.test.timeout) });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if element is visible
   * @param selector - Element selector
   * @returns Promise<boolean>
   */
  async isElementVisible(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isVisible();
    } catch {
      return false;
    }
  }

  /**
   * Check if element is enabled
   * @param selector - Element selector
   * @returns Promise<boolean>
   */
  async isElementEnabled(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isEnabled();
    } catch {
      return false;
    }
  }

  /**
   * Check if checkbox/radio is checked
   * @param selector - Element selector
   * @returns Promise<boolean>
   */
  async isElementChecked(selector: string): Promise<boolean> {
    try {
      const element = this.page.locator(selector);
      return await element.isChecked();
    } catch {
      return false;
    }
  }

  // =============================================
  // DATA EXTRACTION METHODS
  // =============================================

  /**
   * Get element text content with error handling
   * @param selector - Element selector
   * @returns Promise<string>
   */
  async getElementText(selector: string, frame?: FrameLocator): Promise<string> {
    try {
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      return await element.textContent() || '';
    } catch (error) {
      throw new Error(`❌ Failed to get text from element: ${selector}. ${error}`);
    }
  }

  /**
   * Get element inner text (visible text only)
   * @param selector - Element selector
   * @returns Promise<string>
   */
  async getElementInnerText(selector: string, frame?: FrameLocator): Promise<string> {
    try {
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      return await element.innerText();
    } catch (error) {
      throw new Error(`❌ Failed to get inner text from element: ${selector}. ${error}`);
    }
  }

  /**
   * Get input field value
   * @param selector - Input element selector
   * @returns Promise<string>
   */
  async getInputValue(selector: string, frame?: FrameLocator): Promise<string> {
    try {
      let element = frame ? frame.locator(selector) : this.page.locator(selector);
      return await element.inputValue();
    } catch (error) {
      throw new Error(`❌ Failed to get input value from element: ${selector}. ${error}`);
    }
  }

  /**
   * Get element attribute value
   * @param selector - Element selector
   * @param attribute - Attribute name
   * @returns Promise<string | null>
   */
  async getElementAttribute(selector: string, attribute: string, description: string, frame?: FrameLocator): Promise<string | null> {
    try {
      const element = await this.waitForElement(selector, description, frame);
      return await element.getAttribute(attribute);
    } catch (error) {
      throw new Error(`❌ Failed to get attribute "${attribute}" from element: ${selector}. ${error}`);
    }
  }

  /**
   * Get all elements matching selector
   * @param selector - Element selector
   * @returns Promise<Locator[]>
   */
  async getAllElements(selector: string): Promise<Locator[]> {
    const elements = this.page.locator(selector);
    const count = await elements.count();
    const locators: Locator[] = [];

    for (let i = 0; i < count; i++) {
      locators.push(elements.nth(i));
    }

    return locators;
  }

  /**
   * Get page title
   * @returns Promise<string>
   */
  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  /**
   * Get current URL
   * @returns string
   */
  getCurrentUrl(): string {
    return this.page.url();
  }

  // =============================================
  // UTILITY AND TESTING METHODS
  // =============================================

  /**
   * Take screenshot with timestamp and custom naming
   * @param name - Screenshot name
   * @param options - Screenshot options
   * @returns Promise<string> - Path to screenshot
   */
  async takeScreenshot(name: string, options?: {
    fullPage?: boolean;
    path?: string;
    quality?: number;
    type?: 'png' | 'jpeg';
  }): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = options?.path || `screenshots/${name}_${timestamp}.${options?.type || 'png'}`;

    await this.page.screenshot({
      path: screenshotPath,
      fullPage: options?.fullPage !== false,
      quality: options?.quality,
      type: options?.type
    });

    console.log(`Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
  }


  /**
   * Scroll to element
   * @param selector - Element selector
   */
  async scrollToElement(selector: string, description: string, frame?: FrameLocator): Promise<void> {
    try {
      const element = await this.waitForElement(selector, description, frame);
      await element.scrollIntoViewIfNeeded();
    } catch (error) {
      throw new Error(`❌ Failed to scroll to element: ${selector}. ${error}`);
    }
  }


  // =============================================
  // MONITORING AND METRICS METHODS
  // =============================================

  /**
   * Get console logs from the page
   * @returns string[]
   */
  getConsoleLogs(): string[] {
    return this.metricsCollector.getConsoleLogs();
  }

  /**
   * Get network request logs
   * @returns any[]
   */
  getNetworkLogs(): any[] {
    return this.metricsCollector.getNetworkLogs();
  }

}
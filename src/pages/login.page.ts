

import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';

export class LoginPage extends BasePage {
  // Generic selectors that should work for most login forms
  private readonly accountTypeInput = '#accountTypeSelect';
  private readonly usernameInput = '#ipt_name';
  private readonly passwordInput = '#ipt_pwd';
  private readonly loginButton = '#loginBtn';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Complete login flow with performance tracking
   */
  async login(appConfig: AppConfig, timer: TestTimer): Promise<void> {

    // PASO 1: LOGIN
    console.log(`⏳ Iniciando flujo inicio de sesión para ${appConfig.name}`);
    timer.startStep(appConfig.name, 'Inicio de sesión');

    try {

      await this.goto(appConfig.baseUrl, timer);

      if (!await this.isLoggedIn()) {
        const loginurl = "login-colombia.html"
        const loguedurl = "operator_ctz.html"

        // Navigate to login page
        await this.goto(appConfig.baseUrl.replace(loguedurl, loginurl), timer);

        // Fill credentials
        timer.startSubStep('Ingresar credenciales');
        await this.fillDropdown(this.accountTypeInput, appConfig.accountType);
        await this.fillInput(this.usernameInput, appConfig.username);
        await this.fillInput(this.passwordInput, appConfig.password);
        // Submit form
        await this.clickElement(this.loginButton);
        timer.endSubStep();

        // Wait for successful login
        timer.startSubStep('Espera de inicio de sesión exitoso');
        await this.waitForUrl(/.*\/operator_ctz\.html.*/, 50000);
        if (! await this.isLoggedIn()) {
          this.detectError();
        }
        timer.endSubStep();
      }
      timer.endStep();
      console.log(`✅ Inicio de sesión completado exitosamente para ${appConfig.name}`);
    } catch (error) {
      throw new Error(`❌ Inicio de sesión fallido para ${appConfig.name} - Error: ${error}`);
    }
  }

  async isLoggedIn(): Promise<boolean> {
    const url = this.page.url();
    return url.includes('/operator_ctz.html');
  }

  async detectError(): Promise<void> {
    const errorDiv = this.page.locator('#div_error');
    try {
      await errorDiv.waitFor({ state: 'visible', timeout: 5000 });
      const txt = await errorDiv.innerText();
      console.log('❌ Error detectado en la aplicación - Error: ' + txt);

      if (txt.trim().length > 0) {
        throw new Error(`❌ Inicio de sesión fallido - Error: "${txt}"`);
      }
    } catch (err: any) {
      if (err.name === 'TimeoutError') {
        console.log('✅ No se detectó div de error');
        return;
      }
      throw err;
    }
  }
}
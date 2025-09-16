

import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';

export class HeaderPage extends BasePage {
  // Generic selectors that should work for most login forms
  private readonly singOutDropList = '.ao-droplist';
  private readonly disconnectButton = '#bes_sm_portal_exit_pic';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Complete login flow with performance tracking
   */
  async logout(appConfig: AppConfig): Promise<void> {

    // PASO 1: LOGIN
    console.log(`⏳ Iniciando flujo cerrar sesión ${appConfig.name}`);

    try {
      await this.clickElement(this.singOutDropList);
      await this.clickElement(this.disconnectButton);      
      console.log(`✅ Sesión cerrada exitosamente`);
    } catch (error) {
      throw new Error(`❌ Cerrar sesión fallido para ${appConfig.name} - Error: ${error}`);
    }
  }

}


import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';

export class HeaderPage extends BasePage {
  private readonly singOutDropList = '.ao-droplist';
  private readonly disconnectButton = '#bes_sm_portal_exit_pic';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Complete 
   */
  async logout(appConfig: AppConfig): Promise<void> {
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
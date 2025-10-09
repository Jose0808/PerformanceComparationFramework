import { Page, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';


export class RechargePage extends BasePage {

    private readonly currentFrame = "div:nth-child(5) > iframe";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async Recharge(appConfig: AppConfig, timer: TestTimer, rechargeAmount: string): Promise<void> {
        console.log(`⏳ Iniciando flujo Recarga`);
        try {
            timer.startStep(appConfig.name, 'Recarga');
            timer.startSubStep('Espera cargue pantalla: Recarga');
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.locator("#servicenum").waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();

            timer.startSubStep('Busqueda de MSISDN');
            await frameSelector.locator("#QryBtn").click();

            const firstNameField = await frameSelector.locator("[ng-bind='$Gadget.firstName']").first();
            const lastNameField = await frameSelector.locator("[ng-bind='$Gadget.lastName']").first();
            await Promise.all([
                expect(firstNameField).not.toBeEmpty(),
                expect(lastNameField).not.toBeEmpty(),
            ]);
            timer.endSubStep();

            await this.fillInput("#rechargeamount", rechargeAmount, frameSelector);
            await this.clickElement("#btn_openAccBuy", undefined, frameSelector);

            await this.clickElement("#winmsg0 .msgbox-ok-text", undefined, frameSelector);

            timer.endStep();
            console.log(`✅ Recarga finalizado exitosamente`);
        } catch (error) {
            console.error(`❌ Recarga fallido - Error:`, error);
            throw error;
        }
    }


}
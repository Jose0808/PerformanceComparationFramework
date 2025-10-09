import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';


export class CheckoutPage extends BasePage {

    private readonly currentFrame = "iframe";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async checkoutValidate(appConfig: AppConfig, timer: TestTimer): Promise<void> {
        console.log(`Starting check out validate`);
        try {
            timer.startStep(appConfig.name, 'Checkout');
            timer.startSubStep('Espera cargue pantalla: Checkout detalle de pago');

            const frameSelector = await this.page.locator(this.currentFrame).last().contentFrame();

            await frameSelector.locator("#checkoutPaymentContentDetail").waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();

            timer.endStep();

            console.log(`✅ Checkout Validate completed successfully`);

        } catch (error) {
            console.error(`❌ Checkout Validate failed`, error);

            throw error;
        }
    }


}
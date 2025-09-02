import { Page, Locator, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { ICambioDeNumero } from '../types/cambioDeNumero';
import { FrameOptionsByRole } from '../types/frameOptions';
import { TestTimer } from '../utils/timer.utils';


export class ChangeNumber extends BasePage {
    [x: string]: any;
    // Generic selectors that should work for most login forms

    private readonly currentFrame = "div:nth-child(5) > iframe";

    private readonly suscriptions = "Suscripciones";
    private readonly suscriptionsWait = "Información de la Suscripción";

    private readonly rowSuscription: FrameOptionsByRole = { role: "row", options: { name: "Vista 360° Individual" } };;

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async changeNumber(appConfig: AppConfig, timer: TestTimer): Promise<void> {
        console.log(`Starting change number`);

        try {
            timer.startStep(appConfig.name, 'Cambio de Numero');
            timer.startSubStep('Espera cargue pantalla: Cambiar el numero');
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.getByText("Cambiar el numero").waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();

            timer.startSubStep('Espera cargue de datos');
            const [firstControl, secondControl] = [
                frameSelector.locator('.form_control.ng-binding').nth(0),
                frameSelector.locator('.form_control.ng-binding').nth(1)
            ];

            await Promise.all([
                expect(firstControl).not.toBeEmpty(),
                expect(secondControl).not.toBeEmpty(),
            ]);
            timer.endSubStep();

            timer.startSubStep('Espera del loader');
            await frameSelector.locator("#loadingcover").waitFor({
                state: 'hidden'
            })
            timer.endSubStep();

            await this.page.waitForTimeout(3000);
            timer.startSubStep('Click en botón Aleatorio');
            await frameSelector.getByText("Aleatorio").click();
            timer.endSubStep();

            timer.startSubStep('Espera del loader');
            await frameSelector.locator("#loadingcover").waitFor({
                state: 'hidden'
            });
            timer.endSubStep();
            timer.startSubStep('Espera de input con el nuevo número');
            await expect(frameSelector.locator('#input_selPhoneNum'))
                .not.toBeEmpty();
            timer.endSubStep();

            // timer.startSubStep('Click en Enviar');
            // await this.page.waitForTimeout(3000);
            // await frameSelector.locator(".submitWrap").getByText("Enviar").click();
            // timer.endSubStep();

            timer.endStep();
            console.log(`✅ Change Number completed successfully`);
        } catch (error) {
            console.error(`❌ Change Number failed:`, error);
            throw error;
        }
    }


}
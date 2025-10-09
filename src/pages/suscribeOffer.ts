import { Page, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';


export class SuscribeOfferPage extends BasePage {

    private readonly currentFrame = "div:nth-child(5) > iframe";
    private readonly suscriberFrame = "div:nth-child(6) > iframe";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async suscribeOffer(appConfig: AppConfig, timer: TestTimer, offer: string): Promise<void> {
        console.log(`⏳ Iniciando flujo Suscribir oferta`);
        try {
            timer.startStep(appConfig.name, 'Suscribir oferta');
            timer.startSubStep('Espera cargue pantalla: Suscribir oferta');
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.getByText("Usuario", { exact: true }).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            await frameSelector.getByText("Siguiente").click();
            await frameSelector.locator(".title").getByText("Suscripción de la Oferta", { exact: true }).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();

            timer.startSubStep('Buscar oferta');
            await this.offerSelect(offer, frameSelector);
            timer.endSubStep();
            timer.startSubStep('Suscribir oferta');
            await this.suscribe(offer);
            timer.endSubStep();


            timer.endStep();
            console.log(`✅ Suscribir oferta finalizado exitosamente`);
        } catch (error) {
            console.error(`❌ Suscribir oferta fallido - Error:`, error);
            throw error;
        }
    }

    async offerSelect(offer: string, frameSelector: FrameLocator) {
        await this.fillInput("#inputquerystring", offer, frameSelector);
        await this.clickElement("#productquerybtn", undefined, frameSelector);
        await this.clickElement("p[title*='Nombre de la Oferta" + offer + "']", undefined, frameSelector);
        await this.clickElement("#groupproduct_btn_sure", undefined, frameSelector);
    }

    async suscribe(offer: string) {
        const frameSelector = await this.page.locator(this.suscriberFrame).contentFrame();

        await Promise.all([
            frameSelector.getByText("Oferta complementaria", { exact: true }).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            }),
            frameSelector.locator("[id^='AdditionalOffering']").waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            })
        ]);

        await this.clickElement("#suppofferchangesubscribe", undefined, frameSelector);
    }


}
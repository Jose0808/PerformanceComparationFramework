import { Page, Locator, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';
import { CustomerData, IMobileSale } from '../data-driven/types/mobileSale.types';


export class NewSalePage extends BasePage {

    private readonly currentFrame = "div:nth-child(4) > iframe";
    private readonly suscriberFrame = "div:nth-child(5) > iframe";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async newSale(appConfig: AppConfig, timer: TestTimer, offer: IMobileSale): Promise<void> {
        console.log(`⏳ Iniciando flujo Venta nueva`);
        try {
            timer.startStep(appConfig.name, 'Venta nueva');
            timer.startSubStep('Espera cargue pantalla: Venta nueva');
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
            await this.offerSelect(offer.offerName, frameSelector);
            timer.endSubStep();
            timer.startSubStep('Suscribir oferta');
            await this.suscribe(offer.customerData);
            timer.endSubStep();





            timer.endStep();
            console.log(`✅ Venta nueva finalizado exitosamente`);
        } catch (error) {
            console.error(`❌ Venta nueva fallido - Error:`, error);
            throw error;
        }
    }


    async offerSelect(offer: string, frameSelector: FrameLocator) {
        await this.fillInput("#inputquerystring", offer, frameSelector);
        await this.clickElement("#productquerybtn", undefined, frameSelector);
        await this.clickElement("p[title*='Nombre de la Oferta" + offer + "']", undefined, frameSelector);
        await this.clickElement("#groupproduct_btn_sure", undefined, frameSelector);
    }

    async suscribe(customerData: CustomerData) {
        const frameSelector = await this.page.locator(this.suscriberFrame).contentFrame();

        await this.fillCustomerInformation(customerData, frameSelector);

        await this.clickElement("#suppofferchangesubscribe", undefined, frameSelector);
    }

    async fillCustomerInformation(customerData: CustomerData, frameSelector: FrameLocator) {
        this.fillInput("#idTypeInput input", customerData.idType, frameSelector);
        this.fillInput("#uee-001", customerData.idNumber, frameSelector);
        this.fillInput("#idIssueDateInput1", customerData.idExpiredDate, frameSelector);
    }



}
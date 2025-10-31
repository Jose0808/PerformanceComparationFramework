import { Page, Locator, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';
import { CustomerData, IMobileSale } from '../data-driven/types/mobileSale.types';
import { parse } from 'path';


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

            await Promise.all([
                frameSelector.getByText("Usuario", { exact: true }).waitFor({
                    state: 'visible',
                    timeout: this.config.test.timeout
                }),
                expect(frameSelector.locator("#seller")).not.toBeEmpty(),
            ]);
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
            await this.suscribe(timer, offer);
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
        const locator = "p[title*='Nombre de la Oferta" + offer + "']";
        await expect(frameSelector.locator(locator)).toHaveCount(1);
        await this.clickElement(locator, undefined, frameSelector);
        await this.clickElement("#groupproduct_btn_sure", undefined, frameSelector);
    }

    async suscribe(timer: TestTimer, offer: IMobileSale) {
        const frameSelector = await this.page.locator(this.suscriberFrame).contentFrame();

        timer.startSubStep('Consultar cliente');
        await this.fillCustomerInformation(offer.customerData, frameSelector);
        timer.endSubStep();

        timer.startSubStep('Espera de cargue de información cliente');
        await frameSelector.locator("#loadingcover").waitFor({
            state: 'hidden'
        });
        await Promise.all([
            expect(frameSelector.locator("#idTypechoosed")).not.toBeEmpty(),
            expect(frameSelector.locator("#idNumberchoosed")).not.toBeEmpty(),
        ]);
        timer.endSubStep();

        ///=====funcion

        await this.clickElement(".btn_normal >> text=Preferencias de Contacto del Cliente", undefined, frameSelector);
        await frameSelector.locator("#win0").waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });
        await this.clickElement("#dndpreferences_submit", undefined, frameSelector);

        await this.clickElement("div >> text=Validar Cero Papel", undefined, frameSelector);
        await this.clickElement("#winmsg0 >> text=OK", undefined, frameSelector);

        await this.clickElement(`#openViceCardSelectadditionalprodinfoGadget >> text=${offer.deviceType}`, undefined, frameSelector);
        await this.clickElement("#btn_validatepco", undefined, frameSelector);
        await this.clickElement("#winmsg1 .msgbox-ok-text", undefined, frameSelector);
        ///=====end

        await this.fillInput("#imei", offer.IMEI, frameSelector);
        await this.clickElement("#imei_valid", undefined, frameSelector);
        await this.clickElement("#winmsg2 .msgbox-ok-text", undefined, frameSelector);

        //recurso
        await this.clickElement("text=Seleccionar / Cambiar recurso", undefined, frameSelector);

        await this.clickElement("#simTypeInput [id^='ocTriggeroc_select'][id*='udrop']", undefined, frameSelector);
        await this.clickElement(`li >> text=${offer.resource.simCard}`, undefined, frameSelector);

        await this.clickElement("#deviceTypeLotInput", undefined, frameSelector);
        const locator = `#agentdesktopudrop00032${offer.resource.lotDeviceType.toUpperCase()}`
        const dropdown = await frameSelector.locator(locator);
        await dropdown.waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });
        await this.clickElement(locator, undefined, frameSelector);

        await this.clickElement("#simCardTypeLotInput", undefined, frameSelector);
        const locator2 = `#agentdesktopudrop00033${offer.resource.lotSimCardType.toUpperCase()}`;
        const dropdown2 = await frameSelector.locator(locator2);
        await dropdown2.waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });
        await this.clickElement(locator2, undefined, frameSelector);

        await this.clickElement(".btn_normal >> text=Verificar disponibilidad", undefined, frameSelector);

        await this.clickElement("#w1sim1", undefined, frameSelector);

        await this.clickElement(".btn_positive >> text=Reserva", undefined, frameSelector);
        //reserva fin

        await this.clickElement("#span_selPhoneNumRandom", undefined, frameSelector);

        await expect(frameSelector.locator("#input_selPhoneNum")).not.toBeEmpty();

        //Configuraciones personales - usuario - personalizar cuenta

        await this.clickElement("#a_openAccSYZ", undefined, frameSelector);

        await expect(frameSelector.locator("#uee-00A")).not.toBeEmpty();
        await this.clickElement("#btn_actualUserConfirm", undefined, frameSelector);

        //Configuraciones personales - informacion de la cuenta - personalizar cuenta

        await this.clickElement("#a_openAccDZZH", undefined, frameSelector);

        await this.clickElement("#selectaccount:has-text('Seleccione una cuenta existente') .uIcon", undefined, frameSelector);
        await frameSelector.locator('#accountCustomizationContent tr td .radio').first().click();

        await this.clickElement("#win4 #btn_customizedAccountConfirm_new", undefined, frameSelector);

        await this.clickElement("#win3 #btn_customizedAccountConfirm_new", undefined, frameSelector);

        await this.clickElement("#validateFiberCoverage", undefined, frameSelector);
        await this.clickElement(".msgbox-ok-text", undefined, frameSelector);

        await this.clickElement("#btn_openAccBuyNoGold", undefined, frameSelector);


    }

    async fillCustomerInformation(customerData: CustomerData, frameSelector: FrameLocator) {
        await this.clickElement("#idTypeInput input", undefined, frameSelector);
        await this.clickElement("li >> text=" + customerData.idType, undefined, frameSelector);
        await this.fillInput("input#uee-001", customerData.idNumber, frameSelector);
        await this.fillCalendar(customerData, frameSelector);
        await this.clickElement(".btn_normal_green >> text=Consulta", undefined, frameSelector);
    }

    async fillCalendar(customerData: CustomerData, frameSelector: FrameLocator) {
        const date = customerData.idExpiredDate.split("/");
        const year = date[2];
        const dropDownSelector = ".datetimepicker_newYear";

        await this.clickElement("#queryCustomerInfo .oc-date [title='...']", undefined, frameSelector);
        const option = await frameSelector.locator(dropDownSelector + " option").first();
        const lastNumber = await option.innerText();
        if (Number(year) < Number(lastNumber)) {
            await this.fillDropdown(dropDownSelector, lastNumber, frameSelector);
        }
        await this.fillDropdown(".datetimepicker_newYear", year, frameSelector);
        await this.fillDropdown(".datetimepicker_newMonth", String(Number(date[1]) - 1), frameSelector);
        await this.clickElement(`td[title='${customerData.idExpiredDate}']`, undefined, frameSelector);
    }



}
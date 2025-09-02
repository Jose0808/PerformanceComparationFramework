import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { ICambioDeNumero } from '../types/cambioDeNumero';
import { TestTimer } from '../utils/timer.utils';


export class Vista360IndividualPage extends BasePage {
    [x: string]: any;
    // Generic selectors that should work for most login forms

    private readonly currentFrame = "div:nth-child(4) > iframe";
    private readonly searchCustomerText = "Búsqueda de clientes";
    // private readonly serviceNo: FrameOptions = { frame: this.currentFrame, selector: "#serviceNO" };
    private readonly serviceNo = "#serviceNO";
    private readonly idNumber = "#idNumber" //{ frame: this.currentFrame, selector: "#idNumber" };
    private readonly accountCode = "#accountCode";
    private readonly idType = "#ocTriggeridTypeDroplistSelectudrop00001";
    private readonly Historic = "#isShowHis > ins";
    private readonly imei = "#imei";
    private readonly search = "#searchBasicInfo";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async searchCustomer(appConfig: AppConfig, timer: TestTimer, filters: ICambioDeNumero["filters"]): Promise<void> {
        console.log(`Starting search customer`);

        try {

            timer.startStep(appConfig.name, 'Buscar cliente');
            timer.startSubStep('Espera de pantalla: Búsqueda de clientes');
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await this.waitForElementLocator(frameSelector.getByText(this.searchCustomerText), "Pantalla Busqueda de clientes");
            timer.endSubStep();

            // await frameSelector.getByText(this.searchCustomerText).waitFor({
            //     state: 'visible',
            //     timeout: this.config.test.timeout
            // });

            //set filters
            if (filters.idType) {

                timer.startSubStep('Seleccionar tipo de identificación: ' + filters.idType);
                await frameSelector.locator(this.idType).click();
                const dropdown = await frameSelector.getByText(filters.idType);
                await dropdown.waitFor({
                    state: 'visible',
                    timeout: this.config.test.timeout
                });
                await dropdown.click();
                timer.endSubStep();

            }

            if (filters.idNumber) {
                timer.startSubStep('Digitar identificación: ' + filters.idNumber);
                this.fillInput(this.idNumber, filters.idNumber, frameSelector);
                timer.endSubStep();
            }

            if (filters.serviceNo) {
                timer.startSubStep('Digitar número de servicio: ' + filters.serviceNo);
                this.fillInput(this.serviceNo, filters.serviceNo, frameSelector);
                timer.endSubStep();
            }
            if (filters.accountCode) {
                timer.startSubStep('Digitar codigo de cuenta: ' + filters.accountCode);
                this.fillInput(this.accountCode, filters.accountCode, frameSelector);
                timer.endSubStep();
            }
            if (filters.Historic) {
                timer.startSubStep('Ckeckear historico: ' + filters.Historic);
                this.setCheckbox(this.Historic, filters.Historic, frameSelector);
                timer.endSubStep();
            }
            if (filters.imei) {
                timer.startSubStep('Digitar imei: ' + filters.imei);
                this.fillInput(this.imei, filters.imei, frameSelector);
                timer.endSubStep();
            }
            timer.startSubStep('Click en buscar');
            await this.clickElement(this.search, undefined, frameSelector);
            timer.endSubStep();
            timer.endStep();
            console.log(`✅ Search customer completed successfully`);
        } catch (error) {
            console.error(`❌ Search customer failed`, error);
            throw error;
        }
    }


}
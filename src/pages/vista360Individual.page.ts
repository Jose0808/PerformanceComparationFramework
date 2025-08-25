import { Page, Locator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { ICambioDeNumero } from '../types/CambioDeNumero';


export class Vista360IndividualPage extends BasePage {
    [x: string]: any;
    // Generic selectors that should work for most login forms

    private readonly currentFrame = "div:nth-child(4) > iframe";
    private readonly searchCustomerText = "Búsqueda de clientes";
    // private readonly serviceNo: FrameOptions = { frame: this.currentFrame, selector: "#serviceNO" };
    private readonly serviceNo = "#serviceNO" ;
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
    async searchCustomer(filters: ICambioDeNumero["filters"]): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting search customer`);

        try {
            //set filters
            // if (filters.serviceNo) this.fillInput(this.serviceNo, filters.serviceNo, "No. de servicio:");
            // if (filters.idNumber) this.fillInput(this.idNumber, filters.idNumber, "No de identificación:");
            // if (filters.accountCode) this.fillInput(this.accountCode, filters.accountCode, "Código de cuenta:");
            // if (filters.idType) this.fillDropdownLabel(this.idType, filters.idType, "Tipo de documento:");
            // if (filters.Historic) this.setCheckbox(this.Historic, filters.Historic);
            // if (filters.imei) this.fillInput(this.imei, filters.imei, "Imei:");

            if (!filters.idNumber || !filters.idType) return;

            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.getByText(this.searchCustomerText).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            await frameSelector.locator(this.idType).click();
            const dropdown = await frameSelector.getByText(filters.idType);
            await dropdown.waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            await dropdown.click();
            await frameSelector.locator(this.idNumber).fill(filters.idNumber);

            await frameSelector.locator(this.search).click();

            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;

            await this.metricsCollector.recordCustomMetric('total_search_customer_time', totalTime);
            console.log(`✅ Search customer completed successfully in ${totalTime}ms`);

            // Collect final performance metrics
            await this.collectPerformanceMetrics();

        } catch (error) {
            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;
            await this.metricsCollector.recordCustomMetric('failed_search_customer_time', totalTime);
            console.error(`❌ Search customer failed for after ${totalTime}ms:`, error);

            throw error;
        }
    }


}
import { Page, Locator, FrameLocator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { ICambioDeNumero } from '../types/cambioDeNumero';
import { FrameOptionsByRole } from '../types/frameOptions';


export class BasicInfo extends BasePage {
    [x: string]: any;
    // Generic selectors that should work for most login forms

    private readonly currentFrame = "div:nth-child(4) > iframe";

    private readonly suscriptions = "Suscripciones";
    private readonly suscriptionsWait = "Información de la Suscripción";

    private readonly rowSuscription: FrameOptionsByRole = { role: "row", options: { name: "Vista 360° Individual" } };;

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async selectSuscription(suscriptionRow: ICambioDeNumero["SuscriptionRow"]): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting select suscription`);

        try {
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.getByText(this.suscriptions).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });

            await this.selectMenu(frameSelector, this.suscriptions, this.suscriptionsWait);

            await this.tableSelect(frameSelector, suscriptionRow);


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

    /**
     * Select option top menu
     */
    async selectMenu(frame: FrameLocator, elementClick: string, elementWait: string): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting select menu`);

        try {
            await frame.getByText(elementClick).click();
            await frame.getByText(elementWait).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });

            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;

            await this.metricsCollector.recordCustomMetric('total_select_menu_time', totalTime);
            console.log(`✅ Select menu completed successfully in ${totalTime}ms`);

            // Collect final performance metrics
            await this.collectPerformanceMetrics();

        } catch (error) {
            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;
            await this.metricsCollector.recordCustomMetric('failed_select_menu_time', totalTime);
            console.error(`❌ Select Menu failed for after ${totalTime}ms:`, error);

            throw error;
        }
    }


    /**
     * Select option top menu
     */
    async tableSelect(frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"]): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting table select`);

        try {
            if (suscriptionRow.PhoneNumber) {
                const element = await frame.getByRole(this.rowSuscription.role, { name: suscriptionRow.PhoneNumber }).getByRole('insertion');
                element.waitFor({
                    state: 'visible',
                    timeout: this.config.test.timeout
                });
                element.click();
            }
            if (suscriptionRow.SuscriptorNumber) {
                const element = await frame.getByRole(this.rowSuscription.role, { name: suscriptionRow.SuscriptorNumber }).getByRole('insertion');
                element.waitFor({
                    state: 'visible',
                    timeout: this.config.test.timeout
                });
                element.click();
            }


            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;

            await this.metricsCollector.recordCustomMetric('total_table_select_time', totalTime);
            console.log(`✅ Table select completed successfully in ${totalTime}ms`);

            // Collect final performance metrics
            await this.collectPerformanceMetrics();

        } catch (error) {
            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;
            await this.metricsCollector.recordCustomMetric('failed_table_select_time', totalTime);
            console.error(`❌ Table select failed for after ${totalTime}ms:`, error);

            throw error;
        }
    }

}
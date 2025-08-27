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
    private readonly suscriptionsWait = ".next";

    private readonly rowSuscription: FrameOptionsByRole = { role: "row", options: { name: "Vista 360° Individual" } };;

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async selectSuscription(suscriptionRow: ICambioDeNumero["SuscriptionRow"], menuSuscription: string): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting select suscription`);

        try {
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.getByText(this.suscriptions).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });

            await this.selectMenu(frameSelector, this.suscriptions, this.suscriptionsWait);

            await this.tableSelect(frameSelector, suscriptionRow, menuSuscription);


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
            await frame.locator(elementWait).waitFor({
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
    async selectMenuBottom(frame: FrameLocator, elementClick: string, elementWait: string): Promise<void> {
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
    async tableSelect(frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"], menuSuscription: string): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting table select`);

        try {

            await this.findRow(frame, suscriptionRow);

            const changeNumber = await frame.getByText(menuSuscription, { exact: true })
            await changeNumber.waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            await changeNumber.scrollIntoViewIfNeeded();
            await changeNumber.click();

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


    /**
     * Select option top menu
     */
    async findRow(frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"]): Promise<void> {
        let currentPage = 1;
        const nextPage = await frame.locator('.next');
        const maxPages = await frame.locator('.uPage').count();

        let count = await frame.locator('.uPage').count();

        console.log("max pages:" + maxPages)
        while (currentPage <= maxPages) {
            console.log(`Buscando en página ${currentPage}...`);
            // Buscar en la página actual
            const found = await this.searchInCurrentPage(frame, suscriptionRow);

            if (found) {
                console.log('Registro encontrado y procesado');
                break;
            }

            await nextPage.click();
            await frame.locator("#loadingcover").waitFor({
                state: 'hidden',
                timeout: this.config.test.timeout
            });
            currentPage++;
        }
    }

    /**
     * Select option top menu
     */
    private async searchInCurrentPage(frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"]): Promise<boolean> {
        try {
            // Buscar la fila que coincida con los datos            
            const row = frame.getByRole('row', { name: suscriptionRow.PhoneNumber || suscriptionRow.SuscriptorNumber }).getByRole('insertion');

            if (await row.count() > 0) {
                console.log('Registro encontrado en la página actual');
                await this.processRow(row);
                return true;
            }

            return false;

        } catch (error: any) {
            console.log('Error buscando en página actual:', error.message);
            return false;
        }
    }

    private async processRow(row: Locator): Promise<void> {
        try {
            await row.click();
            await row.locator("../ancestor::tr").locator(".btn_normal").click();

        } catch (error: any) {
            console.log('Error:', error.message);
        }
    }


}
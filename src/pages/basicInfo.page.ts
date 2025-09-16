import { Page, Locator, FrameLocator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { ICambioDeNumero } from '../types/cambioDeNumero';
import { TestTimer } from '../utils/timer.utils';


export class BasicInfo extends BasePage {

    // Generic selectors that should work for most login forms
    private readonly currentFrame = "div:nth-child(4) > iframe";
    private readonly suscriptions = "Suscripciones";
    private readonly suscriptionsWait = ".next";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async selectSuscription(appConfig: AppConfig, timer: TestTimer, suscriptionRow: ICambioDeNumero["SuscriptionRow"], menuSuscription: string): Promise<void> {
        console.log(`Starting select suscription`);
        try {
            timer.startStep(appConfig.name, 'Informacion Básica');

            timer.startSubStep('Espera cargue pantalla: Informacion Básica - Suscripciones');
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await this.waitForElementLocator(frameSelector.getByText(this.suscriptions), "Espera menú suscripciones");
            timer.endSubStep();
            // await frameSelector.getByText(this.suscriptions).waitFor({
            //     state: 'visible',
            //     timeout: this.config.test.timeout
            // });

            await this.selectMenu(timer, frameSelector, this.suscriptions, this.suscriptionsWait);

            await this.tableSelect(timer, frameSelector, suscriptionRow, menuSuscription);

            timer.endStep();

            console.log(`✅ Search customer completed successfully`);

        } catch (error) {
            console.error(`❌ Search customer failed`, error);

            throw error;
        }
    }

    /**
     * Select option top menu
     */
    async selectMenu(timer: TestTimer, frame: FrameLocator, elementClick: string, elementWait: string): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting select menu`);

        try {

            timer.startSubStep('Click menú: ' + elementClick);
            await frame.getByText(elementClick).click();
            timer.endSubStep();

            timer.startSubStep('Espera cargue tabla - Suscripciones');
            await this.waitForElementLocator(frame.locator(elementWait), "Espera menú superior información basica" + elementWait);
            timer.endSubStep();

            // await frame.locator(elementWait).waitFor({
            //     state: 'visible',
            //     timeout: this.config.test.timeout
            // });
            console.log(`✅ Select menu completed successfully`);

        } catch (error) {
            console.error(`❌ Select Menu failed`, error);

            throw error;
        }
    }

    /**
     * Select option top menu
     */
    async tableSelect(timer: TestTimer, frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"], menuSuscription: string): Promise<void> {
        console.log(`Starting table select`);

        try {

            await this.findRow(timer, frame, suscriptionRow);

            timer.startSubStep('Espera de menú: ' + menuSuscription);
            const changeNumber = await frame.getByText(menuSuscription, { exact: true })
            await changeNumber.waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();
            timer.startSubStep('Scroll al menú: ' + menuSuscription);
            await changeNumber.scrollIntoViewIfNeeded();
            timer.endSubStep();
            timer.startSubStep('Click menú: ' + menuSuscription);
            await changeNumber.click();
            timer.endSubStep();

            console.log(`✅ Table select completed successfully`);
        } catch (error) {
            console.error(`❌ Table select failed`, error);
            throw error;
        }
    }


    /**
     * Select option top menu
     */
    async findRow(timer: TestTimer, frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"]): Promise<void> {
        let currentPage = 1;
        const nextPage = await frame.locator('.next');
        const maxPages = await frame.locator('.uPage').count();

        console.log("max pages: " + maxPages)
        while (currentPage <= maxPages) {
            console.log(`Buscando en página ${currentPage}...`);
            // Buscar en la página actual
            const found = await this.searchInCurrentPage(timer, frame, suscriptionRow);

            if (found) {
                console.log('Registro encontrado y procesado');
                break;
            }

            timer.startSubStep('Click siguiente pagina de la tabla, pagina: ' + (currentPage + 1));
            await nextPage.click();
            timer.endSubStep();

            timer.startSubStep('Espera cargue de la tabla con nueva informacion');
            await frame.locator("#loadingcover").waitFor({
                state: 'hidden',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();
            currentPage++;
        }
    }

    /**
     * Select option top menu
     */
    private async searchInCurrentPage(timer: TestTimer, frame: FrameLocator, suscriptionRow: ICambioDeNumero["SuscriptionRow"]): Promise<boolean> {
        try {
            // Buscar la fila que coincida con los datos            
            const row = frame.getByRole('row', { name: suscriptionRow.PhoneNumber || suscriptionRow.SuscriptorNumber }).getByRole('insertion');

            if (await row.count() > 0) {
                console.log('Registro encontrado en la página actual');
                await this.handleServerError(frame);

                await this.processRow(timer, row);
                return true;
            }

            return false;

        } catch (error: any) {
            console.log('Error buscando en página actual:', error.message);
            return false;
        }
    }

    async handleServerError(frame: FrameLocator) {
        const errorDiv = frame.locator('#win0');
        if (await errorDiv.isVisible({ timeout: 5000 })) {
            console.log('❌ Error detectado en la aplicación');
            const closeBtn = errorDiv.getByRole('button', { name: 'Cerrar' });
            const details = await errorDiv.innerText();
            console.log('📄 Detalles del error:\n', details);
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
                console.log('✅ Modal de error cerrado');
            }
        }
    }

    private async processRow(timer: TestTimer, row: Locator): Promise<void> {
        try {
            timer.startSubStep('Click checkbox de la fila');
            await row.click();
            timer.endSubStep();
            timer.startSubStep('Click en Tramites de la fila');
            await row.locator("../ancestor::tr").locator(".btn_normal").click();
            timer.endSubStep();

        } catch (error: any) {
            console.log('Error:', error.message);
        }
    }


}
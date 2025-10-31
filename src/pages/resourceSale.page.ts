import { Page, Locator, FrameLocator, expect } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../types/config.types';
import { TestTimer } from '../utils/timer.utils';
import { ResourceSelect } from '../data-driven/types/resourceSale.types';


export class ResourceSalePage extends BasePage {

    private readonly currentFrame = "div:nth-child(5) > iframe";
    private readonly saleFrame = "div:nth-child(6) > iframe";
    private readonly productFeaturesFrame = "div:nth-child(7) > iframe";

    private readonly idselectReasonForSale = "#selectReasonForSale";
    private readonly idselectLotValueForSale = "#selectLotValueForSale";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async ventaRecurso(appConfig: AppConfig, timer: TestTimer, resource: ResourceSelect): Promise<void> {
        console.log(`⏳ Iniciando flujo Venta de recurso`);
        try {
            timer.startStep(appConfig.name, 'Venta de recurso');
            timer.startSubStep('Espera cargue pantalla: Venta de recurso');
            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();

            await Promise.all([
                frameSelector.getByText("Usuario", { exact: true }).waitFor({
                    state: 'visible',
                    timeout: this.config.test.timeout
                }),
                expect(frameSelector.locator("#seller")).not.toBeEmpty(),
            ]);
            
            await frameSelector.getByText("Siguiente").click();
            await frameSelector.locator(".pl_title").getByText("Seleccionar Recurso", { exact: true }).waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });
            timer.endSubStep();
            timer.startSubStep('Seleccionar Razon de la venta: ' + resource.reasonForSale);
            await this.fillInput(this.idselectReasonForSale, resource.reasonForSale, frameSelector)
            timer.endSubStep();

            timer.startSubStep('Tipo de lote: ' + resource.lotType);
            await this.fillInput(this.idselectLotValueForSale, resource.lotType, frameSelector)
            timer.endSubStep();

            timer.startSubStep('Seleccionar recurso: ' + resource.resource.offerName);
            await frameSelector.getByText("Añadir recurso").click();
            await this.resourceSelect(resource)
            timer.endSubStep();

            timer.startSubStep('Seleccionar caracteristicas del recurso');
            await this.detailResourceSelect(resource)
            timer.endSubStep();

            timer.startSubStep('Disponibilidad de recurso');
            await this.saleFinish(resource)
            timer.endSubStep();


            timer.endStep();
            console.log(`✅ Venta de recurso finalizado exitosamente`);
        } catch (error) {
            console.error(`❌ Venta de recurso fallido - Error:`, error);
            throw error;
        }
    }

    async fillInputDropDown(frameSelector: FrameLocator, locator: string, input: string) {
        await frameSelector.locator(locator).click();
        const dropdown = await frameSelector.getByText(input);
        await dropdown.waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });
        await dropdown.click();
    }

    async resourceSelect(resource: ResourceSelect) {
        const frameSelector = this.page.locator(this.saleFrame).contentFrame();
        await frameSelector.getByText("Lista de ofertas").waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });

        await frameSelector.getByText(resource.resource.offerCategory, { exact: true }).click();
        await this.fillInput("#inputquerystring", resource.resource.offerName, frameSelector);
        await this.clickElement("#productquerybtn", undefined, frameSelector);

        const locator = "p[title*='Nombre de la Oferta" + resource.resource.offerName + "']";
        await expect(frameSelector.locator(locator)).toHaveCount(1);
        await this.clickElement(locator, undefined, frameSelector);
        await this.clickElement("#groupproduct_btn_sure", undefined, frameSelector);

    }

    async detailResourceSelect(resource: ResourceSelect) {
        const frameSelector = this.page.locator(this.productFeaturesFrame).contentFrame();
        await frameSelector.locator("#offerDetail").waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });
        await frameSelector.getByText(resource.resource.offerName).waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });

        for (const value of Object.values(resource.resource.features)) {
            const locator = frameSelector.getByText(value as string, { exact: true });
            await locator.waitFor({
                state: 'visible',
            });
            await locator.click();
        }

        await frameSelector.locator("#btn_order").click();

    }

    async saleFinish(resource: ResourceSelect) {
        const frameSelector = this.page.locator(this.currentFrame).contentFrame();
        const check = await frameSelector.getByText(resource.resource.offerName);

        check.waitFor({
            state: 'visible',
            timeout: this.config.test.timeout
        });
        await check.click();

        await frameSelector.getByText("Contado").click();

        await frameSelector.getByText("Validación con PCO").click();

        await frameSelector.locator("#loadingcover").waitFor({
            state: 'hidden'
        });

        const availability = await frameSelector.getByText("Consultar disponibilidad");
        availability.click();

        await frameSelector.getByText("Siguiente").click();

    }


}
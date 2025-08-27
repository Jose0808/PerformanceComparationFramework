import { Page, Locator, FrameLocator } from '@playwright/test';
import { BasePage } from './base.page';
import { AppConfig } from '../config/ConfigManager';
import { ICambioDeNumero } from '../types/cambioDeNumero';
import { FrameOptionsByRole } from '../types/frameOptions';


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
    async changeNumber(): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting change number`);

        try {

            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            await frameSelector.getByText("Cambiar el numero").waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });

            await frameSelector.getByText("Aleatorio").click();

            await frameSelector.locator("#loadingcover").waitFor({
                state: 'hidden',
                timeout: this.config.test.timeout
            });

            await frameSelector.locator(".submitWrap").getByText("Enviar").click();

            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;

            await this.metricsCollector.recordCustomMetric('total_change_number_time', totalTime);
            console.log(`✅ Change Number completed successfully in ${totalTime}ms`);

            // Collect final performance metrics
            await this.collectPerformanceMetrics();

        } catch (error) {
            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;
            await this.metricsCollector.recordCustomMetric('failed_change_number_time', totalTime);
            console.error(`❌ Change Number failed for after ${totalTime}ms:`, error);

            throw error;
        }
    }


}
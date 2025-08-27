import { Page } from '@playwright/test';
import { BasePage } from './base.page';
import { FrameOptionsByRole } from '../types/frameOptions';


export class Checkout extends BasePage {
    [x: string]: any;
    // Generic selectors that should work for most login forms

    private readonly currentFrame = "div:nth-child(5) > iframe";

    constructor(page: Page) {
        super(page);
    }

    /**
     * Busqueda de clientes
     */
    async checkoutValidate(): Promise<void> {
        const StartTime = Date.now();
        console.log(`Starting check out validate`);

        try {

            const frameSelector = await this.page.locator(this.currentFrame).contentFrame();
            
            await frameSelector.locator("#checkoutPaymentContentDetail").waitFor({
                state: 'visible',
                timeout: this.config.test.timeout
            });

            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;

            await this.metricsCollector.recordCustomMetric('total_checkout_validate_time', totalTime);
            console.log(`✅ Checkout Validate completed successfully in ${totalTime}ms`);

            // Collect final performance metrics
            await this.collectPerformanceMetrics();

        } catch (error) {
            const EndTime = Date.now();
            const totalTime = EndTime - StartTime;
            await this.metricsCollector.recordCustomMetric('failed_checkout_validate_time', totalTime);
            console.error(`❌ Checkout Validate failed for after ${totalTime}ms:`, error);

            throw error;
        }
    }


}
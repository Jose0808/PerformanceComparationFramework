import path from "path";
import { HTMLRenderer } from "../renders/html-renderer";
import { ComparisonReport } from "../types/report.types";
import { TestExecution } from "../types/timer.types";
import { ComparisonService } from "../utils/comparison.utils";
import { DateFormatter } from "../utils/date-formatter.utils";
import { FileManager } from "../utils/file-manager.utils";
import { ReportingConfig } from "../types/config.types";

export class ReportGenerator {
    private htmlRenderer: HTMLRenderer;

    constructor() {
        this.htmlRenderer = new HTMLRenderer();
    }

    async generateComparison(onpremise: TestExecution, cloud: TestExecution): Promise<ComparisonReport> {
        return ComparisonService.generateComparison(onpremise, cloud);
    }

    async generateHTMLReport(
        comparison: ComparisonReport,
        config: any = {
            outputPath: './reports'
        }
    ): Promise<void> {
        try {
            FileManager.ensureDirectoryExists(config.outputPath);

            const htmlContent = this.htmlRenderer.render(comparison);

            const timestamp = DateFormatter.formatForFilename();
            const fileName = FileManager.generateFilename(comparison.testName, timestamp);
            const filePath = path.join(config.outputPath, fileName);

            FileManager.writeFile(filePath, htmlContent);
            console.log(`\n📄 Reporte HTML generado: ${filePath}`);
            await FileManager.openFile(filePath);

        } catch (error) {
            console.error('Error al generar reporte HTML:', error);
            throw new Error(`Error al generar reporte HTML: ${error}`);
        }
    }
}
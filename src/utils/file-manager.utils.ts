import * as fs from 'fs';
import * as path from 'path';
import open from 'open'

export class FileManager {
    static ensureDirectoryExists(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    static writeFile(filePath: string, content: string): void {
        fs.writeFileSync(filePath, content);
    }

    static async openFile(filePath: string): Promise<void> {
        try {
            // await open(filePath, { wait: false });
            console.log('✅ Reporte abierto en el navegador predeterminado');
        } catch (error) {
            console.warn('⚠️ No se pudo abrir el reporte automáticamente:', error);
        }
    }

    static generateFilename(testName: string, timestamp: string): string {
        return `${testName.replace(/\s+/g, '_')}_${timestamp}.html`;
    }
}
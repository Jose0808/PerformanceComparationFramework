import * as fs from 'fs';
import * as path from 'path';
import { FullResult, Reporter } from '@playwright/test/reporter';
import { ReportGenerator } from '../utils/report.utils';

export default class PerformanceReporter implements Reporter {
  private performanceDataDir: string;

  constructor() {
    this.performanceDataDir = './performance-data';
  }

  async onEnd(result: FullResult) {
    console.log(`🏁 Test execution completed. Status: ${result.status}`);
    console.log('📂 Leyendo datos de performance desde carpeta...');

    try {
      // Esperar un poco para asegurar que todos los archivos se escribieron
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Leer todos los archivos de performance de la sesión actual
      const performanceData = this.readAllPerformanceFiles();
      
      if (performanceData.length === 0) {
        console.log('⚠️ No se encontraron datos de performance');
        return;
      }

      console.log(`📊 Total de runs encontrados: ${performanceData.length}`);
      
      // Agrupar por aplicación
      const groupedData = this.groupDataByApplication(performanceData);
      
      // Generar comparación
      const comparison = this.generateComparisonFromFiles(groupedData);
      
      if (comparison) {
        // Mostrar reporte en consola
        ReportGenerator.generateConsoleReport(comparison);
        
        // Generar reporte HTML con timestamp
        const fechaActual = new Date();
        const fechaFormateada = `${String(fechaActual.getDate()).padStart(2, '0')}-${String(
          fechaActual.getMonth() + 1
        ).padStart(2, '0')}-${fechaActual.getFullYear()}-${String(
          fechaActual.getHours()
        ).padStart(2, '0')}-${String(fechaActual.getMinutes()).padStart(2, '0')}`;

        const fileName = `./reports/${comparison.testName.replace(/\s+/g, '_')}/Reporte_Auto_${fechaFormateada}`;
        
        await ReportGenerator.generateHTMLReport(comparison, fileName);
        
        console.log(`✅ Reporte generado exitosamente: ${fileName}.html`);
      } else {
        console.log('⚠️ No se pudo generar comparación - datos insuficientes');
      }

      // Limpiar archivos antiguos (opcional)
      await this.cleanupOldFiles();
      
    } catch (error:any) {
      console.error('❌ Error generando reporte desde archivos:', error);
      console.error('Stack:', error.stack);
    }
  }

  private readAllPerformanceFiles(): any[] {
    const allData: any[] = [];
    
    try {
      if (!fs.existsSync(this.performanceDataDir)) {
        console.log('📂 Directorio de performance no existe');
        return allData;
      }

      const files = fs.readdirSync(this.performanceDataDir);
      const today = new Date().toISOString().split('T')[0];
      
      // Filtrar solo archivos de hoy y del test actual
      const relevantFiles = files.filter(file => 
        file.includes('Performance') && 
        file.includes(today) &&
        file.endsWith('.json')
      );

      console.log(`📄 Archivos relevantes encontrados: ${relevantFiles.length}`);
      relevantFiles.forEach(file => console.log(`   - ${file}`));

      for (const file of relevantFiles) {
        try {
          const filePath = path.join(this.performanceDataDir, file);
          const fileContent = fs.readFileSync(filePath, 'utf8');
          const data = JSON.parse(fileContent);
          
          console.log(`📖 Leyendo ${file}:`);
          console.log(`   - Runs: ${data.runs?.length || 0}`);
          console.log(`   - Completed: ${data.completedRuns || 0}`);
          
          if (data.runs && data.runs.length > 0) {
            allData.push(...data.runs);
          }
        } catch (parseError:any) {
          console.error(`❌ Error leyendo archivo ${file}:`, parseError.message);
        }
      }

    } catch (error) {
      console.error('❌ Error accediendo al directorio de performance:', error);
    }

    console.log(`📊 Total runs recopilados: ${allData.length}`);
    return allData;
  }

  private groupDataByApplication(performanceData: any[]): Map<string, any[]> {
    const grouped = new Map<string, any[]>();

    performanceData.forEach((run, index) => {
      console.log(`🔍 Procesando run ${index + 1}:`, {
        appName: run.appName,
        flowName: run.flowName,
        iteration: run.iterationNumber,
        hasExecution: !!run.execution
      });

      if (!run.appName || !run.execution) {
        console.log(`⚠️ Run ${index + 1} inválido - falta appName o execution`);
        return;
      }

      if (!grouped.has(run.appName)) {
        grouped.set(run.appName, []);
      }
      grouped.get(run.appName)!.push(run);
    });

    console.log('📊 Datos agrupados por aplicación:');
    grouped.forEach((runs, appName) => {
      console.log(`   ${appName}: ${runs.length} runs`);
      runs.forEach((run, idx) => {
        console.log(`     [${idx + 1}] Iteration: ${run.iterationNumber}, Flow: ${run.flowName}`);
      });
    });

    return grouped;
  }

  private generateComparisonFromFiles(groupedData: Map<string, any[]>): any | null {
    const onPremiseRuns = groupedData.get('OnPremise');
    const cloudRuns = groupedData.get('Cloud');

    console.log('🔍 Validando datos para comparación:');
    console.log(`   OnPremise: ${onPremiseRuns ? onPremiseRuns.length : 0} runs`);
    console.log(`   Cloud: ${cloudRuns ? cloudRuns.length : 0} runs`);

    if (!onPremiseRuns || !cloudRuns) {
      console.log('⚠️ No se encontraron datos para ambas aplicaciones');
      
      // Generar reporte individual si solo hay una app
      const availableRuns = onPremiseRuns || cloudRuns;
      if (availableRuns && availableRuns.length > 0) {
        console.log(`📊 Generando reporte individual para ${availableRuns[0].appName}`);
        return this.generateIndividualReport(availableRuns[0]);
      }
      
      return null;
    }

    // Tomar el mejor run de cada aplicación (o el primero si solo hay uno)
    const bestOnPremise = this.selectBestRun(onPremiseRuns);
    const bestCloud = this.selectBestRun(cloudRuns);

    console.log('🔄 Generando comparación con:');
    console.log(`   OnPremise: Run ${bestOnPremise.iterationNumber || 'N/A'}`);
    console.log(`   Cloud: Run ${bestCloud.iterationNumber || 'N/A'}`);

    if (!bestOnPremise.execution || !bestCloud.execution) {
      console.error('❌ Executions faltantes en los mejores runs');
      return null;
    }

    return ReportGenerator.generateComparison(
      bestOnPremise.execution, 
      bestCloud.execution
    );
  }

  private selectBestRun(runs: any[]): any {
    if (runs.length === 1) {
      console.log(`   Solo 1 run disponible para ${runs[0].appName}`);
      return runs[0];
    }
    
    // Seleccionar el run con mejor performance (menor duración total)
    const bestRun = runs.reduce((best, current) => {
      const bestDuration = best.execution?.duration || Infinity;
      const currentDuration = current.execution?.duration || Infinity;
      
      console.log(`   Comparando runs: ${best.iterationNumber}(${bestDuration}ms) vs ${current.iterationNumber}(${currentDuration}ms)`);
      
      return currentDuration < bestDuration ? current : best;
    });

    console.log(`   Mejor run seleccionado: Iteration ${bestRun.iterationNumber} con ${bestRun.execution?.duration || 'N/A'}ms`);
    return bestRun;
  }

  private generateIndividualReport(run: any): any {
    return {
      testName: `${run.flowName} - ${run.appName} Individual`,
      environment1: {
        name: run.appName,
        execution: run.execution
      },
      environment2: null,
      isIndividualReport: true
    };
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.performanceDataDir);
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      let cleanedCount = 0;
      for (const file of files) {
        const filePath = path.join(this.performanceDataDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < oneDayAgo) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`🗑️ ${cleanedCount} archivos antiguos eliminados`);
      }
    } catch (error:any) {
      console.log('⚠️ Error limpiando archivos antiguos:', error.message);
    }
  }
}
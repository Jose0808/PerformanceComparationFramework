import * as fs from 'fs';
import * as path from 'path';
import { FullResult, Reporter } from '@playwright/test/reporter';
import { ConsoleReporter } from './console-reporter';
import { DateFormatter } from '../utils/date-formatter.utils';
import { TestExecution } from '../types/timer.types';
import { ReportGenerator } from './report-generator';
import { ConfigManager } from '../config/ConfigManager';

interface PerformanceRun {
  appName: string;
  flowName: string;
  iterationNumber: number;
  execution: TestExecution;
}

interface GroupedData {
  [key: string]: PerformanceRun[];
}

export default class PerformanceReporter implements Reporter {
  private performanceDataDir: string;
  private readonly config: ConfigManager;

  constructor() {
    this.performanceDataDir = './performance-data';
    this.config = ConfigManager.getInstance();
  }

  async onEnd(result: FullResult): Promise<void> {
    console.log(`🏁 Test execution completed. Status: ${result.status}`);
    console.log('📂 Reading performance data from directory...');

    try {
      // Wait for files to be written
      await this.waitForFileWriteCompletion();

      const performanceData = this.readAllPerformanceFiles();

      if (performanceData.length === 0) {
        console.log('⚠️ No performance data found');
        return;
      }

      console.log(`📊 Total runs found: ${performanceData.length}`);

      const groupedData = this.groupDataByApplication(performanceData);
      await this.generateReports(groupedData);

    } catch (error: any) {
      console.error('❌ Error generating report from files:', error);
      console.error('Stack:', error.stack);
    } finally {
      await this.cleanupOldFiles();
    }
  }

  private async waitForFileWriteCompletion(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 3000));
  }

  private readAllPerformanceFiles(): PerformanceRun[] {
    const allData: PerformanceRun[] = [];

    try {
      if (!fs.existsSync(this.performanceDataDir)) {
        console.log('📂 Performance directory does not exist');
        return allData;
      }

      const files = this.getRelevantFiles();
      console.log(`📄 Relevant files found: ${files.length}`);

      files.forEach(file => console.log(`   - ${file}`));

      for (const file of files) {
        const runs = this.readPerformanceFile(file);
        allData.push(...runs);
      }

    } catch (error) {
      console.error('❌ Error accessing performance directory:', error);
    }

    console.log(`📊 Total runs collected: ${allData.length}`);
    return allData;
  }

  private getRelevantFiles(): string[] {
    const files = fs.readdirSync(this.performanceDataDir);
    const today = new Date().toISOString().split('T')[0];

    return files.filter(file =>
      file.includes('Performance') &&
      file.includes(today) &&
      file.endsWith('.json')
    );
  }

  private readPerformanceFile(filename: string): PerformanceRun[] {
    const runs: PerformanceRun[] = [];

    try {
      const filePath = path.join(this.performanceDataDir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(fileContent);

      console.log(`📖 Reading ${filename}:`);
      console.log(`   - Runs: ${data.runs?.length || 0}`);
      console.log(`   - Completed: ${data.completedRuns || 0}`);

      if (data.runs && Array.isArray(data.runs)) {
        runs.push(...data.runs.filter((run: any) => this.isValidRun(run)));
      }

    } catch (parseError: any) {
      console.error(`❌ Error reading file ${filename}:`, parseError.message);
    }

    return runs;
  }

  private isValidRun(run: any): boolean {
    return run && run.appName && run.execution && typeof run.appName === 'string';
  }

  private groupDataByApplication(performanceData: PerformanceRun[]): GroupedData {
    const grouped: GroupedData = {};

    performanceData.forEach((run, index) => {
      console.log(`🔍 Processing run ${index + 1}:`, {
        appName: run.appName,
        flowName: run.flowName,
        iteration: run.iterationNumber,
        hasExecution: !!run.execution
      });

      if (!this.isValidRun(run)) {
        console.log(`⚠️ Run ${index + 1} invalid - missing appName or execution`);
        return;
      }

      if (!grouped[run.appName]) {
        grouped[run.appName] = [];
      }
      grouped[run.appName].push(run);
    });

    this.logGroupedData(grouped);
    return grouped;
  }

  private logGroupedData(grouped: GroupedData): void {
    console.log('📊 Data grouped by application:');
    Object.entries(grouped).forEach(([appName, runs]) => {
      console.log(`   ${appName}: ${runs.length} runs`);
      runs.forEach((run, idx) => {
        console.log(`     [${idx + 1}] Iteration: ${run.iterationNumber}, Flow: ${run.flowName}`);
      });
    });
  }

  private async generateReports(groupedData: GroupedData): Promise<void> {
    const comparison = await this.generateComparisonFromFiles(groupedData);

    if (!comparison) {
      console.log('⚠️ Could not generate comparison - insufficient data');
      return;
    }

    await ConsoleReporter.generate(comparison);


    // Generate HTML report
    await this.generateHTMLReport(comparison);
  }

  private generateComparisonFromFiles(groupedData: GroupedData): any | null {
    const onPremiseRuns = groupedData['OnPremise'];
    const cloudRuns = groupedData['Cloud'];

    console.log('🔍 Validating data for comparison:');
    console.log(`   OnPremise: ${onPremiseRuns ? onPremiseRuns.length : 0} runs`);
    console.log(`   Cloud: ${cloudRuns ? cloudRuns.length : 0} runs`);

    if (!onPremiseRuns || !cloudRuns) {
      return this.handleSingleEnvironmentReport(onPremiseRuns || cloudRuns);
    }

    return this.generateComparisonReport(onPremiseRuns, cloudRuns);
  }

  private handleSingleEnvironmentReport(availableRuns: PerformanceRun[] | undefined): any | null {
    if (!availableRuns || availableRuns.length === 0) {
      console.log('⚠️ No data found for any application');
      return null;
    }
}

  private generateComparisonReport(onPremiseRuns: PerformanceRun[], cloudRuns: PerformanceRun[]): any {
    const bestOnPremise = this.selectBestRun(onPremiseRuns);
    const bestCloud = this.selectBestRun(cloudRuns);

    console.log('🔄 Generating comparison with:');
    console.log(`   OnPremise: Run ${bestOnPremise.iterationNumber || 'N/A'}`);
    console.log(`   Cloud: Run ${bestCloud.iterationNumber || 'N/A'}`);

    if (!bestOnPremise.execution || !bestCloud.execution) {
      console.error('❌ Missing executions in best runs');
      return null;
    }

    return new ReportGenerator().generateComparison(
      bestOnPremise.execution,
      bestCloud.execution
    );
  }

  private selectBestRun(runs: PerformanceRun[]): PerformanceRun {
    if (runs.length === 1) {
      console.log(`   Only 1 run available for ${runs[0].appName}`);
      return runs[0];
    }

    const bestRun = runs.reduce((best, current) => {
      const bestDuration = best.execution?.totalDuration || Infinity;
      const currentDuration = current.execution?.totalDuration || Infinity;

      console.log(`   Comparing runs: ${best.iterationNumber}(${bestDuration}ms) vs ${current.iterationNumber}(${currentDuration}ms)`);

      return currentDuration < bestDuration ? current : best;
    });

    console.log(`   Best run selected: Iteration ${bestRun.iterationNumber} with ${bestRun.execution?.totalDuration || 'N/A'}ms`);
    return bestRun;
  }


  private createEmptyExecution(): TestExecution {
    return {
      environment: "pre",
      testName: 'No Data',
      totalDuration: 0,
      steps: [],
      timestamp: new Date()
    };
  }

  private async generateHTMLReport(comparison: any): Promise<void> {
    try {
      const timestamp = DateFormatter.formatForFilename();
      const reportDir = `${this.config.reporting.outputPath}/${comparison.testName.replace(/\s+/g, '_')}`;
      const fileName = `Reporte_Auto_${timestamp}.html`;
      const fullPath = path.join(reportDir, fileName);

      const reportConfig: any = {
        ...this.config.reporting,
        outputPath: reportDir
      };

      const generator = new ReportGenerator();
      await generator.generateHTMLReport(comparison, reportConfig);


      console.log(`✅ Report generated successfully: ${fullPath}`);

    } catch (error) {
      console.error('❌ Error generating HTML report:', error);
    }
  }

  private async cleanupOldFiles(): Promise<void> {
    try {
      if (!fs.existsSync(this.performanceDataDir)) {
        return;
      }

      const files = fs.readdirSync(this.performanceDataDir);
      let cleanedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.performanceDataDir, file);

        fs.unlinkSync(filePath);
        cleanedCount++;

      }

      if (cleanedCount > 0) {
        console.log(`🗑️ ${cleanedCount} old files cleaned up`);
      }

    } catch (error: any) {
      console.log('⚠️ Error cleaning up old files:', error.message);
    }
  }

  private shouldCleanupFile(filePath: string): boolean {
    try {
      const stats = fs.statSync(filePath);
      // Clean up files older than 1 day (optional logic)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return stats.mtime < oneDayAgo;
    } catch {
      return true; // If we can't read stats, clean it up
    }
  }
}
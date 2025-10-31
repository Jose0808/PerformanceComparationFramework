import { NetworkLog } from '../collectors/MetricsCollector';
import { ComparisonReport, ComparisonData, StepComparison, NetworkComparison } from '../types/report.types';
import { TestExecution } from '../types/timer.types';

export class ComparisonService {
    static generateComparison(onpremise: TestExecution, cloud: TestExecution): ComparisonReport {
        const totalDifference = Math.abs(onpremise.totalDuration - cloud.totalDuration);
        const fasterEnvironment = onpremise.totalDuration < cloud.totalDuration ? 'onpremise' : 'cloud';

        const stepComparisons = this.compareSteps(onpremise.steps, cloud.steps);

        const comparison: ComparisonData = {
            totalDifference,
            fasterEnvironment,
            stepComparisons
        };

        return {
            testName: onpremise.testName || cloud.testName,
            onpremise,
            cloud,
            comparison
        };
    }

    private static compareSteps(onpremiseSteps: any[], cloudSteps: any[]): StepComparison[] {
        return onpremiseSteps.map((onpremiseStep) => {
            const cloudStep = cloudSteps.find(s => s.name === onpremiseStep.name);
            const cloudDuration = cloudStep?.duration || 0;
            const difference = Math.abs(onpremiseStep.duration - cloudDuration);
            const fasterEnvironment = onpremiseStep.duration < cloudDuration ? 'onpremise' : 'cloud';

            return {
                stepName: onpremiseStep.name,
                onpremiseDuration: onpremiseStep.duration,
                cloudDuration,
                difference,
                fasterEnvironment
            };
        });
    }

    static compareNetworkRequests(onpremiseNetworkLogs: NetworkLog[], cloudNetworkLogs: NetworkLog[]): NetworkComparison[] {
        const comparisons: NetworkComparison[] = [];
        
        const cloudMap = new Map<string, NetworkLog>();
        cloudNetworkLogs.forEach(log => {
            const key = `${log.urlName}_${log.order}`;
            cloudMap.set(key, log);
        });

        const onpremiseMap = new Map<string, NetworkLog>();
        onpremiseNetworkLogs.forEach(log => {
            const key = `${log.urlName}_${log.order}`;
            onpremiseMap.set(key, log);
        });

        const allKeys = new Set<string>();
        onpremiseNetworkLogs.forEach(log => allKeys.add(`${log.urlName}_${log.order}`));
        cloudNetworkLogs.forEach(log => allKeys.add(`${log.urlName}_${log.order}`));

        allKeys.forEach(key => {
            const onpremiseLog = onpremiseMap.get(key);
            const cloudLog = cloudMap.get(key);

            const baseLog = onpremiseLog || cloudLog!;

            comparisons.push({
                url: baseLog.url,
                urlName: baseLog.urlName,
                method: baseLog.method,
                order: baseLog.order,
                onpremise: onpremiseLog || null,
                cloud: cloudLog || null
            });
        });

        // Ordenar por el campo order
        return comparisons.sort((a, b) => (a.order || 0) - (b.order || 0));
    }
}

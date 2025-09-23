import { NetworkLog } from '../metrics/MetricsCollector';
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
            testName: onpremise.testName,
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
        const urlComparisons = new Map<string, NetworkComparison>();

        // Process onpremise requests
        onpremiseNetworkLogs.forEach(request => {
            if (!urlComparisons.has(request.urlName)) {
                urlComparisons.set(request.urlName, {
                    url: request.url,
                    urlName: request.urlName,
                    method: request.method,
                    onpremise: request,
                    cloud: null
                });
            }
        });

        // Process cloud requests
        cloudNetworkLogs.forEach(request => {
            if (urlComparisons.has(request.urlName)) {
                const existing = urlComparisons.get(request.urlName)!;
                existing.cloud = request;
            } else {
                urlComparisons.set(request.urlName, {
                    url: request.url,
                    urlName: request.urlName,
                    method: request.method,
                    onpremise: null,
                    cloud: request
                });
            }
        });

        return Array.from(urlComparisons.values());
    }
}

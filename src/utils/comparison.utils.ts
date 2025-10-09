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

        const result = Array.from(urlComparisons.values()).sort((a, b) => {
            if (a.onpremise && b.onpremise) {
                // Ambos tienen onpremise → ordena por order
                return a.onpremise.order - b.onpremise.order;
            }
            if (a.onpremise && !b.onpremise) {
                // a tiene onpremise, b no → a primero
                return -1;
            }
            if (!a.onpremise && b.onpremise) {
                // b tiene onpremise, a no → b primero
                return 1;
            }
            // Ninguno tiene onpremise → se quedan igual
            return 0;
        });
        
        const result2 = Array.from(urlComparisons.values()).sort((a, b) => {
            if (a.cloud && b.cloud) {
                // Ambos tienen onpremise → ordena por order
                return a.cloud.order - b.cloud.order;
            }
            if (a.cloud && !b.cloud) {
                // a tiene onpremise, b no → a primero
                return -1;
            }
            if (!a.cloud && b.cloud) {
                // b tiene onpremise, a no → b primero
                return 1;
            }
            // Ninguno tiene onpremise → se quedan igual
            return 0;
        });

        return Array.from(urlComparisons.values());
    }
}

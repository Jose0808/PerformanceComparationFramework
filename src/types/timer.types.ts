import { NetworkLog } from "../metrics/MetricsCollector";

export interface SubStep {
    name: string;
    duration: number;
    startTime: number;
    endTime: number;
    networkLogs: NetworkLog[];
    jsErrors: string[]
    consoleLogs: string[]
}

export interface Step {
    appName: string;
    name: string;
    duration: number;
    startTime: number;
    endTime: number;
    subSteps: SubStep[];
}

export interface TestExecution {
    environment: string;
    testName: string;
    totalDuration: number;
    steps: Step[];
    timestamp: Date;
}

export interface ComparisonReport {
    testName: string;
    onpremise: TestExecution;
    cloud: TestExecution;
    comparison: {
        totalDifference: number;
        fasterEnvironment: string;
        stepComparisons: Array<{
            stepName: string;
            onpremiseDuration: number;
            cloudDuration: number;
            difference: number;
            fasterEnvironment: string;
        }>;
    };
}
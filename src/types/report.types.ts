import { NetworkLog } from "../collectors/MetricsCollector";
import { TestExecution } from "./timer.types";

export interface ComparisonReport {
    testName: string;
    onpremise: TestExecution;
    cloud: TestExecution;
    comparison: ComparisonData;
}

export interface ComparisonData {
    totalDifference: number;
    fasterEnvironment: 'onpremise' | 'cloud';
    stepComparisons: StepComparison[];
}

export interface StepComparison {
    stepName: string;
    onpremiseDuration: number;
    cloudDuration: number;
    difference: number;
    fasterEnvironment: 'onpremise' | 'cloud';
}

export interface NetworkComparison {
    url: string;
    urlName: string;
    method: string;
    onpremise: NetworkLog | null;
    cloud: NetworkLog | null;
}
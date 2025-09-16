import { ExecutionSession, ExecutionRun } from '../types/executionTypes';

interface IterationStats {
  iteration: number;
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
}

interface AppStats {
  appName: string;
  overallAvg: number;
  overallMin: number;
  overallMax: number;
  overallSuccessRate: number;
  perIteration: IterationStats[];
}

interface ComparisonReport {
  flowName: string;
  apps: AppStats[];
  fastestApp?: string;
  slowestApp?: string;
}

export class StatsAggregator {
  static generateComparisonReport(session: ExecutionSession, flowName: string): ComparisonReport {
    const groupedByApp = new Map<string, ExecutionRun[]>();

    // agrupar por app
    session.runs.forEach(run => {
      if (run.flowName !== flowName) return;
      if (!groupedByApp.has(run.appName)) {
        groupedByApp.set(run.appName, []);
      }
      groupedByApp.get(run.appName)!.push(run);
    });

    const apps: AppStats[] = [];

    groupedByApp.forEach((runs, appName) => {

      // Agrupar runs por iteración
      const runsByIteration = new Map<number, ExecutionRun[]>();
      runs.forEach(run => {
        if (!runsByIteration.has(run.iteration)) {
          runsByIteration.set(run.iteration, []);
        }
        runsByIteration.get(run.iteration)!.push(run);
      });

      const perIteration: IterationStats[] = [];
      let allDurations: number[] = [];
      let allSuccessCount = 0;

      runsByIteration.forEach((iterRuns, iteration) => {
        const durations = iterRuns.map(r => r.execution.totalDuration);
        const errors = 0;

        const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
        const min = Math.min(...durations);
        const max = Math.max(...durations);
        const successRate = ((durations.length - errors) / durations.length) * 100;

        perIteration.push({
          iteration,
          avgDuration: avg,
          minDuration: min,
          maxDuration: max,
          successRate
        });

        allDurations.push(...durations);
        allSuccessCount += durations.length - errors;
      });

      const overallAvg = allDurations.reduce((a, b) => a + b, 0) / allDurations.length;
      const overallMin = Math.min(...allDurations);
      const overallMax = Math.max(...allDurations);
      const overallSuccessRate = (allSuccessCount / allDurations.length) * 100;

      apps.push({
        appName,
        overallAvg,
        overallMin,
        overallMax,
        overallSuccessRate,
        perIteration
      });
    });

    // determinar fastest/slowest app
    const sorted = [...apps].sort((a, b) => a.overallAvg - b.overallAvg);
    const fastestApp = sorted[0]?.appName;
    const slowestApp = sorted[sorted.length - 1]?.appName;

    return {
      flowName,
      apps,
      fastestApp,
      slowestApp
    };
  }
}

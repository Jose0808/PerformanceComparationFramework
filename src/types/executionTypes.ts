import { TestExecution } from "./timer.types";

export interface ExecutionRun {
  appName: string;
  flowName: string;
  iteration: number;
  sessionId: string;
  execution: TestExecution;
  metadata?: {
    browser?: string;
    viewport?: string;
    userAgent?: string;
  };
}

export interface ExecutionSession {
  sessionId: string;
  testSuiteName: string;
  startTime: Date;
  endTime?: Date;
  runs: ExecutionRun[];
  totalRuns: number;
  completedRuns: number;
}
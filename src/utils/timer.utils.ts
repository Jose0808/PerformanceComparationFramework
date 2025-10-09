import { MetricsCollector } from "../collectors/MetricsCollector";
import { Step, SubStep, TestExecution } from "../types/timer.types";

export class TestTimer extends MetricsCollector {
  private currentStep: Step | null = null;
  private currentSubStep: SubStep | null = null;
  private steps: Step[] = [];
  private testStartTime: number = 0;

  startTest(): void {
    this.testStartTime = performance.now();
    this.steps = [];
  }

  startStep(appName: string, stepName: string): void {
    console.log('⏳ Inicio paso: ' + stepName);
    // Finalizar paso anterior si existe
    if (this.currentStep) {
      this.endStep();
    }

    this.currentStep = {
      appName,
      name: stepName,
      duration: 0,
      startTime: performance.now(),
      endTime: 0,
      subSteps: []
    };
  }

  startSubStep(subStepName: string): void {
    console.log('⏳ Inicio sub-paso: ' + subStepName);

    if (!this.currentStep) {
      throw new Error('No hay un paso activo. Inicia un paso primero.');
    }

    // Finalizar subpaso anterior si existe
    if (this.currentSubStep) {
      this.endSubStep();
    }

    this.currentSubStep = {
      name: subStepName,
      duration: 0,
      startTime: performance.now(),
      endTime: 0,
      networkLogs: [],
      jsErrors: [],
      consoleLogs: [],
    };
  }

  endSubStep(): void {
    if (!this.currentSubStep || !this.currentStep) {
      return;
    }

    this.currentSubStep.endTime = performance.now();
    this.currentSubStep.duration = (this.currentSubStep.endTime - this.currentSubStep.startTime) / 1000;
    this.currentSubStep.networkLogs = this.getNetworkLogs();
    this.currentSubStep.consoleLogs = this.getConsoleLogs();
    this.currentSubStep.jsErrors = this.getJSErrors();
    this.resetMetrics();

    console.log(`📊 Tiempo registrado: ${this.currentSubStep.name} = ${this.currentSubStep.duration}ms`);

    this.currentStep.subSteps.push(this.currentSubStep);
    this.currentSubStep = null;
  }

  endStep(): void {
    if (!this.currentStep) {
      return;
    }

    // Finalizar subpaso actual si existe
    if (this.currentSubStep) {
      this.endSubStep();
    }

    this.currentStep.endTime = performance.now();
    this.currentStep.duration = (this.currentStep.endTime - this.currentStep.startTime) / 1000;

    console.log(`📊 Tiempo registrado: ${this.currentStep.name} = ${this.currentStep.duration}ms`);

    this.steps.push(this.currentStep);
    this.currentStep = null;
  }

  getExecution(environment: string, testName: string): TestExecution {
    // Finalizar paso actual si existe
    if (this.currentStep) {
      this.endStep();
    }

    const totalDuration = (performance.now() - this.testStartTime) / 1000;

    return {
      environment,
      testName,
      totalDuration,
      steps: [...this.steps],
      timestamp: new Date()
    };
  }

  reset(): void {
    this.currentStep = null;
    this.currentSubStep = null;
    this.steps = [];
    this.testStartTime = 0;
  }
}
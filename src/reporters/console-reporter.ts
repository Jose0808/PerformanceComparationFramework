import { ComparisonReport } from '../types/report.types';
import { DataFormatter } from '../formatters/data-formatter';

export class ConsoleReporter {
    static generate(comparison: ComparisonReport): void {
        console.log('\n' + '='.repeat(80));
        console.log(`📊 REPORTE DE COMPARACIÓN: ${comparison.testName}`);
        console.log('='.repeat(80));

        this.printSummary(comparison);
        this.printStepsDetail(comparison);

        console.log('\n' + '='.repeat(80));
    }

    private static printSummary(comparison: ComparisonReport): void {
        console.log(`\n🕐 TIEMPO TOTAL:`);
        console.log(`   On-Premise: ${DataFormatter.formatDuration(comparison.onpremise.totalDuration)}`);
        console.log(`   Cloud:      ${DataFormatter.formatDuration(comparison.cloud.totalDuration)}`);
        console.log(`   Diferencia: ${DataFormatter.formatDuration(comparison.comparison.totalDifference)}`);
        console.log(`   🏆 Más rápido: ${comparison.comparison.fasterEnvironment.toUpperCase()}`);
    }

    private static printStepsDetail(comparison: ComparisonReport): void {
        console.log(`\n📋 DETALLE POR PASOS:`);

        comparison.onpremise.steps.forEach((step: any) => {
            const cloudStep = comparison.cloud.steps.find((s: any) => s.name === step.name);
            const stepComparison = comparison.comparison.stepComparisons.find((s: any) => s.stepName === step.name);

            console.log(`\n📌 ${step.name}:`);
            console.log(`   On-Premise: ${DataFormatter.formatDuration(step.duration)} | Cloud: ${cloudStep ? DataFormatter.formatDuration(cloudStep.duration) : '0.00s'}`);
            
            if (stepComparison) {
                console.log(`   🏆 Más rápido: ${stepComparison.fasterEnvironment.toUpperCase()} (diferencia: ${DataFormatter.formatDuration(stepComparison.difference)})`);
            }

            // Mostrar subpasos
            step.subSteps.forEach((subStep: any) => {
                const cloudSubStep = cloudStep?.subSteps.find((s: any) => s.name === subStep.name);
                console.log(`      ├─ ${subStep.name}:`);
                console.log(`      │  On-Premise: ${DataFormatter.formatDuration(subStep.duration)} | Cloud: ${cloudSubStep ? DataFormatter.formatDuration(cloudSubStep.duration) : '0.00s'}`);
            });
        });
    }
}
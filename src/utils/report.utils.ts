import * as fs from 'fs';
import * as path from 'path';
// import open from 'open';
import { TestExecution, ComparisonReport } from '../types/timer.types';

export class ReportGenerator {
    static generateComparison(onpremise: TestExecution, cloud: TestExecution): ComparisonReport {
        const totalDifference = Math.abs(onpremise.totalDuration - cloud.totalDuration);
        const fasterEnvironment = onpremise.totalDuration < cloud.totalDuration ? 'onpremise' : 'cloud';

        const stepComparisons = onpremise.steps.map((onpremiseStep: any) => {
            const cloudStep = cloud.steps.find((s: any) => s.name === onpremiseStep.name);
            const cloudDuration = cloudStep?.duration || 0;
            const difference = Math.abs(onpremiseStep.duration - cloudDuration);
            const stepFaster = onpremiseStep.duration < cloudDuration ? 'onpremise' : 'cloud';

            return {
                stepName: onpremiseStep.name,
                onpremiseDuration: onpremiseStep.duration,
                cloudDuration,
                difference,
                fasterEnvironment: stepFaster
            };
        });

        return {
            testName: onpremise.testName,
            onpremise,
            cloud,
            comparison: {
                totalDifference,
                fasterEnvironment,
                stepComparisons
            }
        };
    }

    static generateConsoleReport(comparison: ComparisonReport): void {
        console.log('\n' + '='.repeat(80));
        console.log(`📊 REPORTE DE COMPARACIÓN: ${comparison.testName}`);
        console.log('='.repeat(80));

        console.log(`\n🕐 TIEMPO TOTAL:`);
        console.log(`   On-Premise: ${comparison.onpremise.totalDuration.toFixed(2)}s`);
        console.log(`   Cloud:      ${comparison.cloud.totalDuration.toFixed(2)}s`);
        console.log(`   Diferencia: ${comparison.comparison.totalDifference.toFixed(2)}s`);
        console.log(`   🏆 Más rápido: ${comparison.comparison.fasterEnvironment.toUpperCase()}`);

        console.log(`\n📋 DETALLE POR PASOS:`);

        comparison.onpremise.steps.forEach((step: any) => {
            const cloudStep = comparison.cloud.steps.find((s: any) => s.name === step.name);
            const stepComparison = comparison.comparison.stepComparisons.find((s: any) => s.stepName === step.name);

            console.log(`\n📌 ${step.name}:`);
            console.log(`   On-Premise: ${step.duration.toFixed(2)}s | Cloud: ${cloudStep?.duration.toFixed(2) || '0.00'}s`);
            if (stepComparison) {
                console.log(`   🏆 Más rápido: ${stepComparison.fasterEnvironment.toUpperCase()} (diferencia: ${stepComparison.difference.toFixed(2)}s)`);
            }

            // Mostrar subpasos
            step.subSteps.forEach((subStep: any) => {
                const cloudSubStep = cloudStep?.subSteps.find((s: any) => s.name === subStep.name);
                console.log(`      ├─ ${subStep.name}:`);
                console.log(`      │  On-Premise: ${subStep.duration.toFixed(2)}s | Cloud: ${cloudSubStep?.duration.toFixed(2) || '0.00'}s`);
            });
        });

        console.log('\n' + '='.repeat(80));
    }

    static async generateHTMLReport(comparison: ComparisonReport, outputPath: string = './reports'): Promise<void> {
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
        }

        const htmlContent = this.generateHTMLContent(comparison);
        const fileName = `${comparison.testName.replace(/\s+/g, '_')}_${Date.now()}.html`;
        const filePath = path.join(outputPath, fileName);

        fs.writeFileSync(filePath, htmlContent);

        console.log(`\n📄 Reporte HTML generado: ${filePath}`);

        // Abrir automáticamente con el navegador predeterminado
        try {
            const open = await import('open');
            await open.default(filePath, { wait: false });
            console.log('✅ Reporte abierto en el navegador predeterminado');
        } catch (error) {
            console.warn('⚠️ No se pudo abrir el reporte automáticamente:', error);
        }
    }

    // Función auxiliar para comparar peticiones de red por URL
    private static compareNetworkRequests(onpremiseNetworkLogs: any[], cloudNetworkLogs: any[]) {
        const urlComparisons = new Map();

        // Procesar peticiones onpremise
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

        // Procesar peticiones cloud
        cloudNetworkLogs.forEach(request => {
            if (urlComparisons.has(request.urlName)) {
                urlComparisons.get(request.urlName).cloud = request;
            } else {
                urlComparisons.set(request.url, {
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

    private static generateHTMLContent(comparison: ComparisonReport): string {
        const onpremiseFaster = comparison.comparison.fasterEnvironment === 'onpremise';
        const safeOnpremise = comparison.onpremise || { steps: [], totalDuration: 0, consoleLogs: [], jsErrors: [], networkLogs: [] };
        const safeCloud = comparison.cloud || { steps: [], totalDuration: 0, consoleLogs: [], jsErrors: [], networkLogs: [] };

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reporte de Comparación - ${comparison.testName}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/lucide@latest/dist/umd/lucide.js"></script>
    <style>
        :root {
            --primary: #6366f1;
            --primary-dark: #4f46e5;
            --secondary: #8b5cf6;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
            --surface: #ffffff;
            --surface-alt: #f8fafc;
            --surface-dark: #1e293b;
            --text: #0f172a;
            --text-muted: #64748b;
            --border: #e2e8f0;
            --shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            --radius: 12px;
            --radius-lg: 16px;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            color: var(--text);
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: var(--surface);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-lg);
            overflow: hidden;
            backdrop-filter: blur(10px);
        }

        .header {
            background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            color: white;
            padding: 40px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .header::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></pattern></defs><rect width="100" height="100" fill="url(%23grid)"/></svg>');
            opacity: 0.3;
        }

        .header > * {
            position: relative;
            z-index: 1;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
        }

        .header h2 {
            font-size: 1.5rem;
            font-weight: 500;
            opacity: 0.95;
            margin-bottom: 0.5rem;
        }

        .header p {
            opacity: 0.8;
            font-size: 1rem;
        }

        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 30px;
            padding: 40px;
            background: var(--surface-alt);
        }

        .summary-card {
            background: var(--surface);
            padding: 30px;
            border-radius: var(--radius);
            text-align: center;
            box-shadow: var(--shadow);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            border: 2px solid transparent;
            position: relative;
            overflow: hidden;
        }

        .summary-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg, var(--primary), var(--secondary));
            border-radius: var(--radius) var(--radius) 0 0;
        }

        .summary-card:hover {
            transform: translateY(-4px);
            box-shadow: var(--shadow-lg);
        }

        .summary-card.winner {
            border-color: var(--success);
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%);
        }

        .summary-card.winner::before {
            background: var(--success);
        }

        .summary-card.error {
            border-color: var(--error);
            background: linear-gradient(135deg, rgba(239, 68, 68, 0.05) 0%, rgba(239, 68, 68, 0.02) 100%);
        }

        .summary-card.error::before {
            background: var(--error);
        }

        .summary-card h3 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .duration {
            font-size: 3rem;
            font-weight: 800;
            margin: 1rem 0;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .error-message {
            font-size: 1rem;
            color: var(--error);
            background: rgba(239, 68, 68, 0.1);
            padding: 12px;
            border-radius: 8px;
            margin: 1rem 0;
            border-left: 4px solid var(--error);
        }

        .winner-badge {
            background: linear-gradient(135deg, var(--success), #059669);
            color: white;
            padding: 8px 16px;
            border-radius: 50px;
            font-size: 0.875rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 40px;
            background: var(--surface);
        }

        .metric-card {
            background: var(--surface-alt);
            padding: 24px;
            border-radius: var(--radius);
            text-align: center;
            border: 1px solid var(--border);
            transition: all 0.3s ease;
        }

        .metric-card:hover {
            border-color: var(--primary);
            transform: translateY(-2px);
            box-shadow: var(--shadow);
        }

        .metric-value {
            font-size: 2rem;
            font-weight: 700;
            color: var(--primary);
            margin-bottom: 0.5rem;
        }

        .metric-label {
            color: var(--text-muted);
            font-size: 0.875rem;
            font-weight: 500;
        }

        .chart-container {
            padding: 40px;
            background: var(--surface);
        }

        .chart-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .chart-header h3 {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 0.5rem;
        }

        .chart-header p {
            color: var(--text-muted);
            font-size: 1rem;
        }

        .chart-wrapper {
            background: var(--surface-alt);
            padding: 30px;
            border-radius: var(--radius);
            border: 1px solid var(--border);
            position: relative;
            overflow: hidden;
        }

        .steps-detail {
            padding: 40px;
            background: var(--surface-alt);
        }

        .steps-header {
            text-align: center;
            margin-bottom: 30px;
        }

        .steps-header h3 {
            font-size: 1.75rem;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 0.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.75rem;
        }

        .step-item {
            margin-bottom: 24px;
            background: var(--surface);
            border-radius: var(--radius);
            overflow: hidden;
            border: 1px solid var(--border);
            transition: all 0.3s ease;
        }

        .step-item:hover {
            box-shadow: var(--shadow);
            border-color: var(--primary);
        }

        .step-header {
            background: linear-gradient(135deg, var(--surface-alt), #f1f5f9);
            padding: 20px 24px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
        }

        .step-name {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            font-size: 1.125rem;
        }

        .step-metrics {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .duration-badge {
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 0.875rem;
            font-weight: 600;
        }

        .onpremise {
            background: rgba(59, 130, 246, 0.1);
            color: #1d4ed8;
        }

        .cloud {
            background: rgba(245, 158, 11, 0.1);
            color: #d97706;
        }

        .substeps {
            padding: 0;
        }

        .substep-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            border-bottom: 1px solid var(--border);
            transition: background-color 0.2s ease;
        }

        .substep-network-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            transition: background-color 0.2s ease;
        }

        .substep-header:hover {
            background: var(--surface-alt);
        }

        .substep-name {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 500;
        }

        .substep-durations {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .network-request-item {
            padding: 12px 24px;
            border-bottom: 1px solid var(--border);
            transition: background-color 0.2s ease;
        }

        .network-request-subItem {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .network-request-item:hover {
            background: var(--surface-alt);
        }

        .network-url {
            flex: 1;
            font-family: monospace;
            font-size: 0.875rem;
            color: var(--primary);
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .network-metrics {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        .method-badge {
            background: var(--primary);
            color: white;
            padding: 4px 8px;
            border-radius: 16px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-badge {
            padding: 4px 8px;
            border-radius: 16px;
            font-size: 0.75rem;
            font-weight: 600;
        }

        .status-200 { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-300 { background: rgba(59, 130, 246, 0.1); color: #1d4ed8; }
        .status-400 { background: rgba(245, 158, 11, 0.1); color: var(--warning); }
        .status-500 { background: rgba(239, 68, 68, 0.1); color: var(--error); }
        .status-0 { background: rgba(239, 68, 68, 0.1); color: var(--error); }

        .performance-indicator {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .faster {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
        }

        .slower {
            background: rgba(239, 68, 68, 0.1);
            color: var(--error);
        }

        .footer {
            background: var(--surface-dark);
            color: white;
            padding: 30px;
            text-align: center;
        }

        .footer p {
            opacity: 0.8;
        }

        /* Responsive Design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }

            .header {
                padding: 30px 20px;
            }

            .header h1 {
                font-size: 2rem;
            }

            .summary,
            .metrics-grid,
            .chart-container,
            .steps-detail {
                padding: 20px;
            }

            .summary {
                grid-template-columns: 1fr;
                gap: 20px;
            }

            .duration {
                font-size: 2.5rem;
            }

            .step-header {
                flex-direction: column;
                align-items: stretch;
                gap: 16px;
            }

            .step-metrics {
                justify-content: center;
            }

            .network-request-item {
                flex-direction: column;
                align-items: stretch;
                gap: 12px;
            }

            .network-url {
                max-width: 100%;
                text-align: center;
            }

            .network-metrics {
                justify-content: center;
            }

            .chart-wrapper {
                padding: 15px;
            }
        }

        @media (max-width: 480px) {
            .metrics-grid {
                grid-template-columns: 1fr;
            }

            .substep-durations {
                flex-direction: column;
                gap: 8px;
            }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
            :root {
                --surface: #0f172a;
                --surface-alt: #1e293b;
                --surface-dark: #020617;
                --text: #f8fafc;
                --text-muted: #94a3b8;
                --border: #334155;
            }

            body {
                background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            }
        }

        /* Animation for loading */
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .step-item {
            animation: fadeInUp 0.6s ease forwards;
        }

        .summary-card {
            animation: fadeInUp 0.8s ease forwards;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>
                <span>📊</span>
                Reporte de Comparación de Performance
            </h1>
            <h2>${comparison.testName}</h2>
            <p>Generado el: ${new Date().toLocaleString('es-ES', {
            dateStyle: 'full',
            timeStyle: 'medium'
        })}</p>
        </div>

        <div class="summary">
            <div class="summary-card ${onpremiseFaster && comparison.onpremise.totalDuration > 0 ? 'winner' : ''} ${comparison.onpremise.totalDuration === 0 ? 'error' : ''}">
                <h3>🏢 On-Premise</h3>
                ${comparison.onpremise.totalDuration > 0
                ? `<div class="duration">${comparison.onpremise.totalDuration.toFixed(2)}s</div>`
                : `<div class="error-message">❌ Falló la ejecución</div>`
            }
                ${onpremiseFaster && comparison.onpremise.totalDuration > 0 ? '<div class="winner-badge"><span>🏆</span> MÁS RÁPIDO</div>' : ''}
            </div>
            <div class="summary-card ${!onpremiseFaster && comparison.cloud.totalDuration > 0 ? 'winner' : ''} ${comparison.cloud.totalDuration === 0 ? 'error' : ''}">
                <h3>☁️ Cloud</h3>
                ${comparison.cloud.totalDuration > 0
                ? `<div class="duration">${comparison.cloud.totalDuration.toFixed(2)}s</div>`
                : `<div class="error-message">❌ Falló la ejecución</div>`
            }
                ${!onpremiseFaster && comparison.cloud.totalDuration > 0 ? '<div class="winner-badge"><span>🏆</span> MÁS RÁPIDO</div>' : ''}
            </div>
        </div>

        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value">${comparison.comparison.totalDifference.toFixed(2)}s</div>
                <div class="metric-label">Diferencia Total</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.max(comparison.onpremise.steps.length, comparison.cloud.steps.length)}</div>
                <div class="metric-label">Pasos Ejecutados</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${(comparison.onpremise.totalDuration > 0 && comparison.cloud.totalDuration > 0)
                ? ((comparison.comparison.totalDifference / Math.max(comparison.onpremise.totalDuration, comparison.cloud.totalDuration)) * 100).toFixed(1)
                : '0'}%</div>
                <div class="metric-label">Mejora de Performance</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${comparison.onpremise.steps.reduce((acc: number, step: any) => acc + (step.subSteps?.length || 0), 0) +
            comparison.cloud.steps.reduce((acc: number, step: any) => acc + (step.subSteps?.length || 0), 0)}</div>
                <div class="metric-label">Sub-pasos Totales</div>
            </div>
        </div>

        ${(comparison.onpremise.totalDuration > 0 || comparison.cloud.totalDuration > 0) ? `
        <div class="chart-container">
            <div class="chart-header">
                <h3>Comparación Visual por Pasos</h3>
                <p>Tiempo de ejecución en segundos para cada paso del proceso</p>
            </div>
            <div class="chart-wrapper">
                <canvas id="comparisonChart" height="120"></canvas>
            </div>
        </div>
        ` : ''}

        <div class="steps-detail">
            <div class="steps-header">
                <h3>📋 Detalle por Pasos</h3>
            </div>
            ${[...comparison.onpremise.steps, ...comparison.cloud.steps.filter(cloudStep =>
                !comparison.onpremise.steps.find(onpremiseStep => onpremiseStep.name === cloudStep.name)
            )].map((step: any) => {
                const isFromOnpremise = comparison.onpremise.steps.includes(step);
                const counterpartStep = isFromOnpremise
                    ? comparison.cloud.steps.find((s: any) => s.name === step.name)
                    : comparison.onpremise.steps.find((s: any) => s.name === step.name);

                const stepComparison = comparison.comparison.stepComparisons.find((s: any) => s.stepName === step.name);

                return `
                <details class="step-item">
                    <summary class="step-header">
                        <div class="step-name">
                            📌 ${step.name}
                        </div>
                        <div class="step-metrics">
                            <span class="duration-badge onpremise" title="On-Premise">On-Premise: ${isFromOnpremise ? step.duration?.toFixed(2) || '0.00' : counterpartStep?.duration?.toFixed(2) || '❌'
                    }s</span>
                            <span class="duration-badge cloud" title="Cloud">Cloud: ${!isFromOnpremise ? step.duration?.toFixed(2) || '0.00' : counterpartStep?.duration?.toFixed(2) || '❌'
                    }s</span>
                            ${stepComparison ? `
                                <div class="performance-indicator ${stepComparison.fasterEnvironment === 'onpremise' ? 'faster' : 'slower'}">
                                    ${stepComparison.fasterEnvironment === 'onpremise' ? '⚡ Más Rápido' : '🐌 Más Lento'}
                                </div>
                                <span class="winner-badge">🏆 ${stepComparison.fasterEnvironment.toUpperCase()}</span>
                            ` : ''}
                        </div>
                    </summary>
                    <div class="substeps">
                        ${(step.subSteps || []).map((subStep: any) => {
                        const cloudSubStep = counterpartStep?.subSteps?.find((s: any) => s.name === subStep.name);
                        const isSubStepFaster = cloudSubStep && subStep.duration < cloudSubStep.duration;

                        return `
                            <div class="substep-item">
                                <div class="substep-header">
                                    <div class="substep-name">
                                        └─ ${subStep.name}
                                    </div>
                                    <div class="substep-durations">
                                        <span class="duration-badge onpremise" title="On-Premise">${isFromOnpremise ? (subStep.duration?.toFixed(2) || "❌") : (cloudSubStep?.duration?.toFixed(2) || "❌")
                            }s</span>
                                        <span class="duration-badge cloud" title="Cloud">${!isFromOnpremise ? (subStep.duration?.toFixed(2) || "❌") : (cloudSubStep?.duration?.toFixed(2) || "❌")
                            }s</span>
                                        ${cloudSubStep ? `
                                            <div class="performance-indicator ${isSubStepFaster ? 'faster' : 'slower'}">
                                                ${isSubStepFaster ? '⚡' : '🐌'}
                                            </div>
                                        ` : ''}
                                    </div>
                                </div>

                                <!-- Console Logs -->
                                <details class="network-request-item">
                                    <summary class="substep-network-header">
                                    <div class="substep-name">
                                    └─ 📜 Console Logs
                                    </div>
                                    <div class="substep-durations">
<span class="duration-badge onpremise" title="On-Premise">${isFromOnpremise ? (subStep.consoleLogs?.length || "❌") : (cloudSubStep?.consoleLogs?.length || "❌")
                            }</span>
                                        <span class="duration-badge cloud" title="Cloud">${!isFromOnpremise ? (subStep.consoleLogs?.length || "❌") : (cloudSubStep?.consoleLogs?.length || "❌")
                            }</span>
                                    </div>
                                    </summary>
                                    <div class="substeps">
                                        ${subStep.consoleLogs && subStep.consoleLogs.length > 0
                                ? `
                                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 16px;">
                                                    <div>
                                                        <h4 style="margin-bottom: 8px; color: var(--primary);">OnPremise (${subStep.consoleLogs.length || 0})</h4>
                                                        <pre style="background: var(--surface-alt); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto;">${subStep.consoleLogs.join("\\n") || "❌"}</pre>
                                                    </div>
                                                    <div>
                                                        <h4 style="margin-bottom: 8px; color: var(--warning);">Cloud (${cloudSubStep?.consoleLogs?.length || 0})</h4>
                                                        <pre style="background: var(--surface-alt); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto;">${cloudSubStep?.consoleLogs?.join("\\n") || "❌"}</pre>
                                                    </div>
                                                </div>
                                            `
                                : `<div style="padding: 16px; text-align: center; color: var(--success);">✅ No se registraron console logs</div>`
                            }
                                    </div>
                                </details>

                                <!-- JS Errors -->
                                <details class="network-request-item">
                                    <summary class="substep-network-header">                                    
                                    <div class="substep-name">
                                    └─ ❌ Errores de Consola
                                    </div>
                                    <div class="substep-durations">
<span class="duration-badge onpremise" title="On-Premise">${isFromOnpremise ? (subStep.jsErrors?.length || "❌") : (cloudSubStep?.jsErrors?.length || "❌")
                            }</span>
                                        <span class="duration-badge cloud" title="Cloud">${!isFromOnpremise ? (subStep.jsErrors?.length || "❌") : (cloudSubStep?.jsErrors?.length || "❌")
                            }</span>
                                    </div>
                                    </summary>
                                    <div class="substeps">
                                        ${subStep.jsErrors && subStep.jsErrors.length > 0
                                ? `
                                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 16px;">
                                                    <div>
                                                        <h4 style="margin-bottom: 8px; color: var(--primary);">OnPremise (${subStep.jsErrors.length})</h4>
                                                        <pre style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; color: var(--error);">${subStep.jsErrors.join("\\n") || "❌"}</pre>
                                                    </div>
                                                    <div>
                                                        <h4 style="margin-bottom: 8px; color: var(--warning);">Cloud (${cloudSubStep?.jsErrors?.length || 0})</h4>
                                                        <pre style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; color: var(--error);">${cloudSubStep?.jsErrors?.join("\\n") || "❌"}</pre>
                                                    </div>
                                                </div>
                                            `
                                : `<div style="padding: 16px; text-align: center; color: var(--success);">✅ No se detectaron errores de consola</div>`
                            }
                                    </div>
                                </details>

                                <!-- Network Requests Comparison -->
                                <details class="network-request-item">
                                    <summary class="substep-network-header">
                                        <div style="substep-name">
                                            └─ 🌐 Network Requests                                            
                                        </div>
                                            <div class="substep-durations">
                                                <span class="duration-badge onpremise" title="On-Premise">${isFromOnpremise ? (subStep.networkLogs?.length || "❌") : (cloudSubStep?.networkLogs?.length || "❌")}</span>
                                                <span class="duration-badge cloud" title="Cloud">${!isFromOnpremise ? (subStep.networkLogs?.length || "❌") : (cloudSubStep?.networkLogs?.length || "❌")}</span>
                                            </div>
                                    </summary>
                                    <div class="substeps">
                                        ${(() => {
                                const networkComparisons = this.compareNetworkRequests(
                                    subStep.networkLogs || [],
                                    cloudSubStep?.networkLogs || []
                                );

                                if (networkComparisons.length === 0) {
                                    return '<div style="padding: 16px; text-align: center; color: var(--success);">✅ No se realizaron peticiones de red</div>';
                                }

                                return networkComparisons.map(comparison => {
                                    const onpremiseReq = comparison.onpremise;
                                    const cloudReq = comparison.cloud;
                                    const hasOnpremise = !!onpremiseReq;
                                    const hasCloud = !!cloudReq;

                                    return `
                                                <div class="network-request-subItem">
                                                    <div class="network-url" title="${comparison.url}">
                                                        <span class="method-badge">${comparison.method}</span>
                                                        ${comparison.urlName}
                                                    </div>
                                                    <div class="network-metrics">
                                                        <div style="display: flex; flex-direction: column; gap: 4px; text-align: center;">
                                                            <span style="font-size: 0.75rem; color: var(--text-muted);">Duración</span>
                                                            <div style="display: flex; gap: 8px;">
                                                                <span class="duration-badge onpremise" title="On-Premise">${hasOnpremise ? `${onpremiseReq.duration.toFixed(2) || 0}ms` : '❌'}</span>
                                                                <span class="duration-badge cloud" title="Cloud">${hasCloud ? `${cloudReq.duration.toFixed(2) || 0}ms` : '❌'}</span>
                                                            </div>
                                                        </div>
                                                        <div style="display: flex; flex-direction: column; gap: 4px; text-align: center;">
                                                            <span style="font-size: 0.75rem; color: var(--text-muted);">Status</span>
                                                            <div style="display: flex; gap: 8px;">
                                                                <span class="status-badge status-${Math.floor((onpremiseReq?.status || 0) / 100) * 100}" title="On-Premise">
                                                                    ${hasOnpremise ? (onpremiseReq.status || '—') : '❌'}
                                                                </span>
                                                                <span class="status-badge status-${Math.floor((cloudReq?.status || 0) / 100) * 100}" title="Cloud">
                                                                    ${hasCloud ? (cloudReq.status || '—') : '❌'}
                                                                </span>
                                                            </div>
                                                        </div>                                                                                                            
                                                        ${hasOnpremise && hasCloud ? `
                                                            <div class="performance-indicator ${(onpremiseReq.duration || 0) < (cloudReq.duration || 0) ? 'faster' : 'slower'}">
                                                                ${(onpremiseReq.duration || 0) < (cloudReq.duration || 0) ? '⚡ On-Premise' : '⚡ Cloud'}
                                                            </div>
                                                        ` : ''}
                                                    </div>
                                                </div>
                                                `;
                                }).join('');
                            })()}
                                    </div>
                                </details>
                            </div>
                            `;
                    }).join('')}
                    </div>
                </details>
                `;
            }).join('')}
        </div>

        <div class="footer">
            <p>Reporte generado automáticamente por el Sistema de Análisis de Performance</p>
        </div>
    </div>

    ${(comparison.onpremise.totalDuration > 0 || comparison.cloud.totalDuration > 0) ? `
    <script>
        const ctx = document.getElementById('comparisonChart')?.getContext('2d');
        
        if (ctx) {
            const stepNames = ${JSON.stringify([...new Set([
                ...comparison.onpremise.steps.map((s: any) => s.name),
                ...comparison.cloud.steps.map((s: any) => s.name)
            ])])};
            
            const onpremiseData = stepNames.map(name => {
                const step = ${JSON.stringify(comparison.onpremise.steps)}.find(s => s.name === name);
                return step ? step.duration : 0;
            });
            
            const cloudData = stepNames.map(name => {
                const step = ${JSON.stringify(comparison.cloud.steps)}.find(s => s.name === name);
                return step ? step.duration : 0;
            });

            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: stepNames,
                    datasets: [
                        {
                            label: '🏢 On-Premise',
                            data: onpremiseData,
                            backgroundColor: 'rgba(59, 130, 246, 0.8)',
                            borderColor: 'rgba(59, 130, 246, 1)',
                            borderWidth: 2,
                            borderRadius: 8,
                            borderSkipped: false,
                        },
                        {
                            label: '☁️ Cloud',
                            data: cloudData,
                            backgroundColor: 'rgba(245, 158, 11, 0.8)',
                            borderColor: 'rgba(245, 158, 11, 1)',
                            borderWidth: 2,
                            borderRadius: 8,
                            borderSkipped: false,
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false,
                    },
                    plugins: {
                        title: {
                            display: false
                        },
                        legend: {
                            display: true,
                            position: 'top',
                            labels: {
                                usePointStyle: true,
                                pointStyle: 'rect',
                                padding: 20,
                                font: {
                                    size: 14,
                                    weight: '600'
                                }
                            }
                        },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.9)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            borderColor: '#6366f1',
                            borderWidth: 1,
                            cornerRadius: 8,
                            displayColors: true,
                            callbacks: {
                                label: function(context) {
                                    return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + 's';
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: 'Tiempo (segundos)',
                                font: {
                                    size: 14,
                                    weight: '600'
                                }
                            },
                            grid: {
                                color: 'rgba(148, 163, 184, 0.2)',
                            },
                            ticks: {
                                callback: function(value) {
                                    return value.toFixed(1) + 's';
                                }
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Pasos del Proceso',
                                font: {
                                    size: 14,
                                    weight: '600'
                                }
                            },
                            grid: {
                                display: false
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 0
                            }
                        }
                    },
                    animation: {
                        duration: 1500,
                        easing: 'easeInOutQuart'
                    }
                }
            });
        }

        // Añadir efectos de scroll suave
        document.addEventListener('DOMContentLoaded', function() {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            });

            document.querySelectorAll('.step-item, .summary-card, .metric-card').forEach((el) => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(20px)';
                el.style.transition = 'all 0.6s ease';
                observer.observe(el);
            });
        });
    </script>
    ` : ''}
</body>
</html>`;
    }
}
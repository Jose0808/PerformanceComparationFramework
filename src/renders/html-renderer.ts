import { DataFormatter } from "../formatters/data-formatter";
import { HTMLTemplates } from "../templates/html-templates";
import { TemplateEngine } from "../templates/template-engine";
import { ComparisonReport } from "../types/report.types";
import { ComparisonService } from "../utils/comparison.utils";
import { DateFormatter } from "../utils/date-formatter.utils";
import { CSSRenderer } from "./css-renderer";
import { JSRenderer } from "./js-renderer";

export class HTMLRenderer {
    constructor() {
        this.registerTemplates();
    }

    private registerTemplates(): void {
        TemplateEngine.registerTemplate('base', HTMLTemplates.BASE_TEMPLATE);
        TemplateEngine.registerTemplate('header', HTMLTemplates.HEADER_TEMPLATE);
        TemplateEngine.registerTemplate('summaryCard', HTMLTemplates.SUMMARY_CARD_TEMPLATE);
        TemplateEngine.registerTemplate('metricCard', HTMLTemplates.METRIC_CARD_TEMPLATE);
        TemplateEngine.registerTemplate('step', HTMLTemplates.STEP_TEMPLATE);
        TemplateEngine.registerTemplate('substep', HTMLTemplates.SUBSTEP_TEMPLATE);
        TemplateEngine.registerTemplate('networkRequest', HTMLTemplates.NETWORK_REQUEST_TEMPLATE);

        // Register new templates
        TemplateEngine.registerTemplate('consoleLogs', HTMLTemplates.CONSOLE_LOGS_TEMPLATE);
        TemplateEngine.registerTemplate('consoleErrors', HTMLTemplates.CONSOLE_ERRORS_TEMPLATE);
        TemplateEngine.registerTemplate('networkRequests', HTMLTemplates.NETWORK_REQUESTS_TEMPLATE);
        TemplateEngine.registerTemplate('emptySection', HTMLTemplates.EMPTY_SECTION_TEMPLATE);
        TemplateEngine.registerTemplate('logsContent', HTMLTemplates.LOGS_CONTENT_TEMPLATE);
        TemplateEngine.registerTemplate('errorsContent', HTMLTemplates.ERRORS_CONTENT_TEMPLATE);

    }

    render(comparison: ComparisonReport): string {
        const data = this.prepareData(comparison);

        return TemplateEngine.render('base', {
            title: `Reporte de Comparación - ${comparison.testName}`,
            styles: CSSRenderer.render(),
            header: this.renderHeader(comparison),
            summary: this.renderSummary(comparison),
            metrics: this.renderMetrics(comparison),
            chart: this.renderChart(comparison),
            details: this.renderDetails(comparison),
            footer: this.renderFooter(),
            scripts: JSRenderer.render(comparison)
        });
    }

    private prepareData(comparison: ComparisonReport): any {
        return {
            ...comparison,
            timestamp: DateFormatter.formatForDisplay(),
            performanceImprovement: DataFormatter.calculatePerformanceImprovement(
                comparison.onpremise.totalDuration,
                comparison.cloud.totalDuration
            )
        };
    }

    private renderHeader(comparison: ComparisonReport): string {
        return TemplateEngine.render('header', {
            testName: comparison.testName,
            timestamp: DateFormatter.formatForDisplay()
        });
    }

    private renderSummary(comparison: ComparisonReport): string {
        const onpremiseFaster = comparison.comparison.fasterEnvironment === 'onpremise';

        const onpremiseCard = TemplateEngine.render('summaryCard', {
            icon: '🏢',
            environment: 'On-Premise',
            cardClass: this.getSummaryCardClass('onpremise', comparison),
            content: this.getSummaryCardContent(comparison.onpremise.totalDuration),
            winnerBadge: onpremiseFaster && comparison.onpremise.totalDuration > 0
                ? '<div class="winner-badge"><span>🏆</span> MÁS RÁPIDO</div>' : ''
        });

        const cloudCard = TemplateEngine.render('summaryCard', {
            icon: '☁️',
            environment: 'Cloud',
            cardClass: this.getSummaryCardClass('cloud', comparison),
            content: this.getSummaryCardContent(comparison.cloud.totalDuration),
            winnerBadge: !onpremiseFaster && comparison.cloud.totalDuration > 0
                ? '<div class="winner-badge"><span>🏆</span> MÁS RÁPIDO</div>' : ''
        });

        return `<div class="summary">${onpremiseCard}${cloudCard}</div>`;
    }

    private getSummaryCardClass(environment: 'onpremise' | 'cloud', comparison: ComparisonReport): string {
        const duration = environment === 'onpremise'
            ? comparison.onpremise.totalDuration
            : comparison.cloud.totalDuration;

        if (duration === 0) return 'error';
        if (comparison.comparison.fasterEnvironment === environment) return 'winner';
        return '';
    }

    private getSummaryCardContent(duration: number): string {
        if (duration > 0) {
            return `<div class="duration">${DataFormatter.formatDuration(duration)}</div>`;
        }
        return '<div class="error-message">❌ Falló la ejecución</div>';
    }

    private renderMetrics(comparison: ComparisonReport): string {
        const metrics = [
            {
                value: DataFormatter.formatDuration(comparison.comparison.totalDifference),
                label: 'Diferencia Total'
            },
            {
                value: DataFormatter.formatCount(Math.max(comparison.onpremise.steps.length, comparison.cloud.steps.length)),
                label: 'Pasos Ejecutados'
            },
            {
                value: DataFormatter.formatPercentage(
                    DataFormatter.calculatePerformanceImprovement(
                        comparison.onpremise.totalDuration,
                        comparison.cloud.totalDuration
                    )
                ),
                label: 'Mejora de Performance'
            },
            {
                value: DataFormatter.formatCount(this.getTotalSubSteps(comparison)),
                label: 'Sub-pasos Totales'
            }
        ];

        const metricsHTML = metrics.map(metric =>
            TemplateEngine.render('metricCard', metric)
        ).join('');

        return `<div class="metrics-grid">${metricsHTML}</div>`;
    }

    private getTotalSubSteps(comparison: ComparisonReport): number {
        return comparison.onpremise.steps.reduce((acc, step) => acc + (step.subSteps?.length || 0), 0) +
            comparison.cloud.steps.reduce((acc, step) => acc + (step.subSteps?.length || 0), 0);
    }

    private renderChart(comparison: ComparisonReport): string {
        if (comparison.onpremise.totalDuration === 0 && comparison.cloud.totalDuration === 0) {
            return '';
        }

        return `
        <div class="chart-container">
            <div class="chart-header">
                <h3>Comparación Visual por Pasos</h3>
                <p>Tiempo de ejecución en segundos para cada paso del proceso</p>
            </div>
            <div class="chart-wrapper">
                <canvas id="comparisonChart" height="120"></canvas>
            </div>
        </div>`;
    }

    private renderDetails(comparison: ComparisonReport): string {
        const allSteps = [...comparison.onpremise.steps, ...comparison.cloud.steps.filter(cloudStep =>
            !comparison.onpremise.steps.find(onpremiseStep => onpremiseStep.name === cloudStep.name)
        )];

        const stepsHTML = allSteps.map(step => this.renderStep(step, comparison)).join('');

        return `
        <div class="steps-detail">
            <div class="steps-header">
                <h3>📋 Detalle por Pasos</h3>
            </div>
            ${stepsHTML}
        </div>`;
    }

    private renderStep(step: any, comparison: ComparisonReport): string {
        const isFromOnpremise = comparison.onpremise.steps.includes(step);
        const counterpartStep = isFromOnpremise
            ? comparison.cloud.steps.find(s => s.name === step.name)
            : comparison.onpremise.steps.find(s => s.name === step.name);

        const stepComparison = comparison.comparison.stepComparisons.find(s => s.stepName === step.name);

        const subStepsHTML = (step.subSteps || []).map((subStep: any) =>
            this.renderSubStep(subStep, counterpartStep, isFromOnpremise)
        ).join('');

        return TemplateEngine.render('step', {
            stepName: step.name,
            onpremiseDuration: isFromOnpremise
                ? DataFormatter.formatDuration(step.duration)
                : counterpartStep ? DataFormatter.formatDuration(counterpartStep.duration) : '❌',
            cloudDuration: !isFromOnpremise
                ? DataFormatter.formatDuration(step.duration)
                : counterpartStep ? DataFormatter.formatDuration(counterpartStep.duration) : '❌',
            performanceIndicator: stepComparison ? this.renderPerformanceIndicator(stepComparison.fasterEnvironment) : '',
            subSteps: subStepsHTML
        });
    }

    private renderSubStep(subStep: any, counterpartStep: any, isFromOnpremise: boolean): string {
        const cloudSubStep = counterpartStep?.subSteps?.find((s: { name: any; }) => s.name === subStep.name);

        return TemplateEngine.render('substep', {
            subStepName: subStep.name,
            onpremiseDuration: isFromOnpremise
                ? DataFormatter.formatDuration(subStep.duration)
                : cloudSubStep ? DataFormatter.formatDuration(cloudSubStep.duration) : '❌',
            cloudDuration: !isFromOnpremise
                ? DataFormatter.formatDuration(subStep.duration)
                : cloudSubStep ? DataFormatter.formatDuration(cloudSubStep.duration) : '❌',
            performanceIndicator: cloudSubStep ? this.renderSubStepPerformanceIndicator(subStep, cloudSubStep, isFromOnpremise) : '',
            logsSections: this.renderLogsSections(subStep, cloudSubStep, isFromOnpremise)
        });
    }

    private renderPerformanceIndicator(fasterEnvironment: string): string {
        return `
        <div class="performance-indicator ${fasterEnvironment === 'onpremise' ? 'faster' : 'slower'}">
            ${fasterEnvironment === 'onpremise' ? '⚡ Más Rápido' : '🐌 Más Lento'}
        </div>
        <span class="winner-badge">🏆 ${fasterEnvironment.toUpperCase()}</span>`;
    }

    private renderSubStepPerformanceIndicator(subStep: any, cloudSubStep: any, isFromOnpremise: boolean): string {
        const isSubStepFaster = cloudSubStep && subStep.duration < cloudSubStep.duration;
        return `<div class="performance-indicator ${isSubStepFaster ? 'faster' : 'slower'}">${isSubStepFaster ? '⚡' : '🐌'}</div>`;
    }

    private renderLogsSections(subStep: any, cloudSubStep: any, isFromOnpremise: boolean): string {
        const consoleLogs = this.renderConsoleLogsSection(subStep, cloudSubStep, isFromOnpremise);
        const jsErrors = this.renderJSErrorsSection(subStep, cloudSubStep, isFromOnpremise);
        const networkRequests = this.renderNetworkRequestsSection(subStep, cloudSubStep, isFromOnpremise);

        return consoleLogs + jsErrors + networkRequests;
    }

    private renderConsoleLogsSection(subStep: any, cloudSubStep: any, isFromOnpremise: boolean): string {
        const onpremiseCount = isFromOnpremise ? (subStep.consoleLogs?.length || 0) : (cloudSubStep?.consoleLogs?.length || 0);
        const cloudCount = !isFromOnpremise ? (subStep.consoleLogs?.length || 0) : (cloudSubStep?.consoleLogs?.length || 0);

        let content: string;
        if (subStep.consoleLogs && subStep.consoleLogs.length > 0) {
            content = TemplateEngine.render('logsContent', {
                onpremiseCount: isFromOnpremise ? subStep.consoleLogs.length : (cloudSubStep?.consoleLogs?.length || 0),
                cloudCount: !isFromOnpremise ? subStep.consoleLogs.length : (cloudSubStep?.consoleLogs?.length || 0),
                onpremiseContent: DataFormatter.sanitizeForHTML(
                    isFromOnpremise
                        ? subStep.consoleLogs.join('\n')
                        : (cloudSubStep?.consoleLogs?.join('\n') || 'No data')
                ),
                cloudContent: DataFormatter.sanitizeForHTML(
                    !isFromOnpremise
                        ? subStep.consoleLogs.join('\n')
                        : (cloudSubStep?.consoleLogs?.join('\n') || 'No data')
                )
            });
        } else {
            content = TemplateEngine.render('emptySection', {
                message: 'No se registraron console logs'
            });
        }

        return TemplateEngine.render('consoleLogs', {
            onpremiseCount,
            cloudCount,
            content
        });
    }

    private renderJSErrorsSection(subStep: any, cloudSubStep: any, isFromOnpremise: boolean): string {
        const onpremiseCount = isFromOnpremise ? (subStep.jsErrors?.length || 0) : (cloudSubStep?.jsErrors?.length || 0);
        const cloudCount = !isFromOnpremise ? (subStep.jsErrors?.length || 0) : (cloudSubStep?.jsErrors?.length || 0);

        let content: string;
        if (subStep.jsErrors && subStep.jsErrors.length > 0) {
            content = TemplateEngine.render('errorsContent', {
                onpremiseCount: isFromOnpremise ? subStep.jsErrors.length : (cloudSubStep?.jsErrors?.length || 0),
                cloudCount: !isFromOnpremise ? subStep.jsErrors.length : (cloudSubStep?.jsErrors?.length || 0),
                onpremiseContent: DataFormatter.sanitizeForHTML(
                    isFromOnpremise
                        ? subStep.jsErrors.join('\n')
                        : (cloudSubStep?.jsErrors?.join('\n') || 'No errors')
                ),
                cloudContent: DataFormatter.sanitizeForHTML(
                    !isFromOnpremise
                        ? subStep.jsErrors.join('\n')
                        : (cloudSubStep?.jsErrors?.join('\n') || 'No errors')
                )
            });
        } else {
            content = TemplateEngine.render('emptySection', {
                message: 'No se detectaron errores de consola'
            });
        }

        return TemplateEngine.render('consoleErrors', {
            onpremiseCount,
            cloudCount,
            content
        });
    }

    private renderNetworkRequestsSection(subStep: any, cloudSubStep: any, isFromOnpremise: boolean): string {
        const onpremiseCount = isFromOnpremise ? (subStep.networkLogs?.length || 0) : (cloudSubStep?.networkLogs?.length || 0);
        const cloudCount = !isFromOnpremise ? (subStep.networkLogs?.length || 0) : (cloudSubStep?.networkLogs?.length || 0);
        const containerId = subStep.name.replaceAll(" ", "_");
        const context = isFromOnpremise ? 'onpremise' : 'cloud';

        let networkComparisons = ComparisonService.compareNetworkRequests(
            subStep.networkLogs || [],
            cloudSubStep?.networkLogs || []
        );

        // Sort by duration (ascending by default, prioritizing current context)
        networkComparisons = this.sortNetworkRequests(networkComparisons, 'asc', context);

        let content: string;
        let sortingControls: string = '';

        if (networkComparisons.length === 0) {
            content = TemplateEngine.render('emptySection', {
                message: 'No se realizaron peticiones de red'
            });
        } else {
            sortingControls = this.renderSortingControls(subStep.name);
            content = networkComparisons.map(comparison => this.renderNetworkRequest(comparison)).join('');
        }

        return TemplateEngine.render('networkRequests', {
            onpremiseCount,
            cloudCount,
            containerId,
            context,
            sortingControls,
            content
        });
    }
    
    // Función auxiliar para ordenar con más opciones
    private sortNetworkRequests(
        comparisons: any[],
        order: 'asc' | 'desc' | 'original' = 'asc',
        prioritySource: 'onpremise' | 'cloud' | 'fastest' | 'slowest' = 'onpremise'
    ): any[] {
        // Orden original según el atributo "order"
        if (order === 'original') {
            return [...comparisons].sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        // Ordenamiento por duración según la fuente
        return [...comparisons].sort((a, b) => {
            const getDuration = (comparison: any, source: string): number => {
                switch (source) {
                    case 'onpremise':
                        return comparison.onpremise?.duration || 0;
                    case 'cloud':
                        return comparison.cloud?.duration || 0;
                    case 'fastest':
                        const onpremA = comparison.onpremise?.duration || Infinity;
                        const cloudA = comparison.cloud?.duration || Infinity;
                        return Math.min(onpremA, cloudA);
                    case 'slowest':
                        const onpremB = comparison.onpremise?.duration || 0;
                        const cloudB = comparison.cloud?.duration || 0;
                        return Math.max(onpremB, cloudB);
                    default:
                        return comparison.onpremise?.duration || comparison.cloud?.duration || 0;
                }
            };

            const durationA = getDuration(a, prioritySource);
            const durationB = getDuration(b, prioritySource);

            return order === 'asc' ? durationA - durationB : durationB - durationA;
        });
    }

    // Controles de ordenamiento
    private renderSortingControls(name: string): string {
        const idName = name.replaceAll(" ", "_");
        return `
    <div class="sorting-controls">
        <label class="sorting-label">
            <div class="sort-group">
                <span class="sorting-icon">📊</span>
                <span>Ordenar peticiones:</span>
            </div>
            <select id="duration-sort-select-${idName}" class="sort-select" onchange="sortNetworkByDuration(this.value,'${idName}')">
                <optgroup label="📋 Otros">
                    <option value="original">📋 Orden original</option>
                </optgroup>
                <optgroup label="🚀 Por velocidad general">
                    <option value="asc-fastest">⚡ Más rápidas primero (cualquier app)</option>
                    <option value="desc-slowest">🐌 Más lentas primero (cualquier app)</option>
                </optgroup>
                <optgroup label="🏢 Por aplicación OnPremise">
                    <option value="asc-onpremise">⚡ OnPremise: Más rápidas primero</option>
                    <option value="desc-onpremise">🐌 OnPremise: Más lentas primero</option>
                </optgroup>
                <optgroup label="☁️ Por aplicación Cloud">
                    <option value="asc-cloud">⚡ Cloud: Más rápidas primero</option>
                    <option value="desc-cloud">🐌 Cloud: Más lentas primero</option>
                </optgroup>
            </select>
        </label>
    </div>`;
    }

    private renderNetworkRequest(comparison: any): string {
        const onpremiseReq = comparison.onpremise;
        const cloudReq = comparison.cloud;
        const hasOnpremise = !!onpremiseReq;
        const hasCloud = !!cloudReq;

        return TemplateEngine.render('networkRequest', {
            url: comparison.url,
            method: comparison.method,
            urlName: comparison.urlName || 'NA',
            copyButtons: this.renderCopyButtons(onpremiseReq, cloudReq),
            onpremiseDuration: hasOnpremise ? `${onpremiseReq.duration.toFixed(2)}ms` : '❌',
            cloudDuration: hasCloud ? `${cloudReq.duration.toFixed(2)}ms` : '❌',
            onpremiseStatus: hasOnpremise ? (onpremiseReq.status || '—') : '❌',
            cloudStatus: hasCloud ? (cloudReq.status || '—') : '❌',
            onpremiseStatusClass: `status-badge ${DataFormatter.getStatusBadgeClass(onpremiseReq?.status || 0)}`,
            cloudStatusClass: `status-badge ${DataFormatter.getStatusBadgeClass(cloudReq?.status || 0)}`,
            performanceIndicator: hasOnpremise && hasCloud ? this.renderNetworkPerformanceIndicator(onpremiseReq, cloudReq) : ''
        });
    }

    private renderCopyButtons(onpremiseReq: any, cloudReq: any): string {
        let buttons = '';
        if (onpremiseReq?.urlName) {
            buttons += `
                <span style="display:none;" id="OnPremise-${onpremiseReq.urlName}">${DataFormatter.sanitizeForHTML(onpremiseReq.curl)}</span>
                <button class="copy-button onpremise" title="On-Premise" onclick="copiarAlPortapapeles('OnPremise-${onpremiseReq.urlName}')">📋</button>`;
        }
        if (cloudReq?.urlName) {
            buttons += `
                <span style="display:none;" id="Cloud-${cloudReq.urlName}">${DataFormatter.sanitizeForHTML(cloudReq.curl)}</span>
                <button class="copy-button cloud" title="Cloud" onclick="copiarAlPortapapeles('Cloud-${cloudReq.urlName}')">📋</button>`;
        }
        return buttons;
    }

    private renderNetworkPerformanceIndicator(onpremiseReq: any, cloudReq: any): string {
        const isFaster = (onpremiseReq.duration || 0) < (cloudReq.duration || 0);
        return `
        <div class="performance-indicator ${isFaster ? 'faster' : 'slower'}">
            ${isFaster ? '⚡ On-Premise' : '⚡ Cloud'}
        </div>`;
    }

    private renderLogsContent(onpremiseLogs: string[], cloudLogs: string[], title: string): string {
        if (onpremiseLogs && onpremiseLogs.length > 0) {
            return `
            <div style="display: grid; grid-template-columns: 1fr; gap: 20px; padding: 16px;">
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--primary);">OnPremise (${onpremiseLogs.length || 0})</h4>
                    <pre style="background: var(--surface-alt); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto;">${DataFormatter.sanitizeForHTML(onpremiseLogs.join('\n'))}</pre>
                </div>
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--warning);">Cloud (${cloudLogs?.length || 0})</h4>
                    <pre style="background: var(--surface-alt); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto;">${DataFormatter.sanitizeForHTML(cloudLogs?.join('\n') || 'No data')}</pre>
                </div>
            </div>`;
        }
        return `<div style="padding: 16px; text-align: center; color: var(--success);">✅ No se registraron ${title.toLowerCase()}</div>`;
    }

    private renderErrorsContent(onpremiseErrors: string[], cloudErrors: string[]): string {
        if (onpremiseErrors && onpremiseErrors.length > 0) {
            return `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 16px;">
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--primary);">OnPremise (${onpremiseErrors.length})</h4>
                    <pre style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; color: var(--error);">${DataFormatter.sanitizeForHTML(onpremiseErrors.join('\n'))}</pre>
                </div>
                <div>
                    <h4 style="margin-bottom: 8px; color: var(--warning);">Cloud (${cloudErrors?.length || 0})</h4>
                    <pre style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; color: var(--error);">${DataFormatter.sanitizeForHTML(cloudErrors?.join('\n') || 'No errors')}</pre>
                </div>
            </div>`;
        }
        return `<div style="padding: 16px; text-align: center; color: var(--success);">✅ No se detectaron errores de consola</div>`;
    }

    private renderFooter(): string {
        return `
        <div class="footer">
            <p>Reporte generado automáticamente por el Sistema de Análisis de Performance</p>
        </div>`;
    }
}

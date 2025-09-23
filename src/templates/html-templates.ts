export class HTMLTemplates {
    static readonly BASE_TEMPLATE = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{title}}</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>{{styles}}</style>
</head>
<body>
    <div class="container">
        {{header}}
        {{summary}}
        {{metrics}}
        {{chart}}
        {{details}}
        {{footer}}
    </div>
    {{scripts}}
</body>
</html>`;

    static readonly HEADER_TEMPLATE = `
<div class="header">
    <h1><span>📊</span>Reporte de Comparación de Performance</h1>
    <h2>{{testName}}</h2>
    <p>Generado el: {{timestamp}}</p>
</div>`;

    static readonly SUMMARY_CARD_TEMPLATE = `
<div class="summary-card {{cardClass}}">
    <h3>{{icon}} {{environment}}</h3>
    {{content}}
    {{winnerBadge}}
</div>`;

    static readonly METRIC_CARD_TEMPLATE = `
<div class="metric-card">
    <div class="metric-value">{{value}}</div>
    <div class="metric-label">{{label}}</div>
</div>`;

    static readonly STEP_TEMPLATE = `
<details class="step-item">
    <summary class="step-header">
        <div class="step-name">
            <span class="step-icon">📌</span>
            {{stepName}}
        </div>
        <div class="step-metrics">
            <span class="duration-badge onpremise">On-Premise: {{onpremiseDuration}}</span>
            <span class="duration-badge cloud">Cloud: {{cloudDuration}}</span>
            {{performanceIndicator}}
        </div>
    </summary>
    <div class="substeps detail-content">{{subSteps}}</div>
</details>`;

    static readonly SUBSTEP_TEMPLATE = `
<details class="substep-item">
    <summary class="substep-header">
        <div class="substep-name">
            <span class="substep-icon">🔹</span>
            {{subStepName}}
        </div>
        <div class="substep-durations">
            <span class="duration-badge onpremise">{{onpremiseDuration}}</span>
            <span class="duration-badge cloud">{{cloudDuration}}</span>
            {{performanceIndicator}}
        </div>
    </summary>
    {{logsSections}}
</details>`;

    // Template for Console Logs section
    static readonly CONSOLE_LOGS_TEMPLATE = `
<details class="network-request-item console-logs">
    <summary class="substep-network-header">
        <div class="substep-name">
            <span class="network-icon">📜</span>
            Console Logs
        </div>
        <div class="substep-durations">
            <span class="duration-badge onpremise">{{onpremiseCount}}</span>
            <span class="duration-badge cloud">{{cloudCount}}</span>
        </div>
    </summary>
    <div class="substeps detail-content">
        {{content}}
    </div>
</details>`;

    // Template for Console Errors section
    static readonly CONSOLE_ERRORS_TEMPLATE = `
<details class="network-request-item console-errors">
    <summary class="substep-network-header">
        <div class="substep-name">
            <span class="network-icon">❌</span>
            Errores de Consola
        </div>
        <div class="substep-durations">
            <span class="duration-badge onpremise">{{onpremiseCount}}</span>
            <span class="duration-badge cloud">{{cloudCount}}</span>
        </div>
    </summary>
    <div class="substeps detail-content">
        {{content}}
    </div>
</details>`;

    // Template for Network Requests section
    static readonly NETWORK_REQUESTS_TEMPLATE = `
<details class="network-request-item network-requests">
    <summary class="substep-network-header">
        <div class="substep-name">
            <span class="network-icon">🌐</span>
            Network Requests
        </div>
        <div class="substep-durations">
            <span class="duration-badge onpremise">{{onpremiseCount}}</span>
            <span class="duration-badge cloud">{{cloudCount}}</span>
        </div>
    </summary>
    <div class="substeps detail-content" id="network-requests-container-{{containerId}}" data-context="{{context}}">
        {{sortingControls}}
        {{content}}
    </div>
</details>`;

    static readonly NETWORK_REQUEST_TEMPLATE = `
<div class="network-request-subItem">
    <div class="network-url" title="{{url}}">
        <span class="method-badge">{{method}}</span>
        {{urlName}}
        {{copyButtons}}
    </div>
    <div class="network-metrics">
        <div style="display: flex; flex-direction: column; gap: 4px; text-align: center;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Duración</span>
            <div style="display: flex; gap: 8px;">
                <span class="duration-badge onpremise" title="OnPremise">{{onpremiseDuration}}</span>
                <span class="duration-badge cloud" title="Cloud">{{cloudDuration}}</span>
            </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px; text-align: center;">
            <span style="font-size: 0.75rem; color: var(--text-muted);">Status</span>
            <div style="display: flex; gap: 8px;">
                <span class="{{onpremiseStatusClass}}">{{onpremiseStatus}}</span>
                <span class="{{cloudStatusClass}}">{{cloudStatus}}</span>
            </div>
        </div>
        {{performanceIndicator}}
    </div>
</div>`;

    // Template for empty content sections
    static readonly EMPTY_SECTION_TEMPLATE = `
<div style="padding: 16px; text-align: center; color: var(--success); background: rgba(16, 185, 129, 0.05); border-radius: 8px; margin: 8px;">
    ✅ {{message}}
</div>`;

    // Template for logs content
    static readonly LOGS_CONTENT_TEMPLATE = `
<div style="display: flex; flex-direction: column; gap: 20px; padding: 16px; background: white; border-radius: 8px; margin: 8px;">
    <div>
        <h4 style="margin-bottom: 8px; color: var(--primary); display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: var(--primary); border-radius: 50%;"></span>
            OnPremise ({{onpremiseCount}})
        </h4>
        <pre style="background: var(--surface-alt); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; border-left: 3px solid var(--primary);">{{onpremiseContent}}</pre>
    </div>
    <div>
        <h4 style="margin-bottom: 8px; color: var(--warning); display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: var(--warning); border-radius: 50%;"></span>
            Cloud ({{cloudCount}})
        </h4>
        <pre style="background: var(--surface-alt); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; border-left: 3px solid var(--warning);">{{cloudContent}}</pre>
    </div>
</div>`;

    // Template for error content
    static readonly ERRORS_CONTENT_TEMPLATE = `
<div style="display: flex; flex-direction: column; gap: 20px; padding: 16px; background: white; border-radius: 8px; margin: 8px;">
    <div>
        <h4 style="margin-bottom: 8px; color: var(--error); display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: var(--error); border-radius: 50%;"></span>
            OnPremise ({{onpremiseCount}})
        </h4>
        <pre style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; color: var(--error); border-left: 3px solid var(--error);">{{onpremiseContent}}</pre>
    </div>
    <div>
        <h4 style="margin-bottom: 8px; color: var(--error); display: flex; align-items: center; gap: 8px;">
            <span style="width: 8px; height: 8px; background: var(--error); border-radius: 50%;"></span>
            Cloud ({{cloudCount}})
        </h4>
        <pre style="background: rgba(239, 68, 68, 0.1); padding: 12px; border-radius: 8px; font-size: 0.875rem; max-height: 200px; overflow-y: auto; color: var(--error); border-left: 3px solid var(--error);">{{cloudContent}}</pre>
    </div>
</div>`;
}
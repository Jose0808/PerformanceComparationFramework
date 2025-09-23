export class CSSRenderer {
    static render(): string {
        return `
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

        /* Step level (Level 1) - Primary containers */
        .step-item {
            margin-bottom: 24px;
            background: var(--surface);
            border-radius: var(--radius);
            overflow: hidden;
            border-left: 4px solid var(--primary);
            box-shadow: var(--shadow);
            transition: all 0.3s ease;
        }

        .step-item:hover {
            border-left-color: var(--primary-dark);
            box-shadow: var(--shadow-lg);
            transform: translateX(4px);
        }

        .step-header {
            background: linear-gradient(135deg, #f8fafc, #e2e8f0);
            padding: 20px 24px;
            font-weight: 600;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            border-bottom: 1px solid var(--border);
        }

        .step-name {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.125rem;
            color: var(--primary);
            font-weight: 700;
        }

        .step-name::before {
            content: '';
            width: 12px;
            height: 12px;
            background: var(--primary);
            border-radius: 50%;
            flex-shrink: 0;
        }

        .step-icon {
            font-size: 1.25rem;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
        }

        .step-metrics {
            display: flex;
            align-items: center;
            gap: 12px;
            flex-wrap: wrap;
        }

        /* Substep level (Level 2) - Secondary containers */
        .substep-item {
            background: #fbfcfd;
            border-bottom: 1px solid #e5e7eb;
            margin-left: 20px;
            border-left: 3px solid var(--secondary);
            transition: all 0.2s ease;
            padding-bottom: 10px;
        }

        .substep-item:hover {
            background: #f1f5f9;
            border-left-color: var(--warning);
        }

        .substep-item:last-child {
            border-radius: 0px var(--radius);
        }

        .substep-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            transition: background-color 0.2s ease;
        }

        .substep-name {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            color: var(--secondary);
            font-size: 1rem;
            position: relative;
        }

        .substep-name::before {
            content: '';
            width: 8px;
            height: 8px;
            background: var(--secondary);
            border-radius: 50%;
            flex-shrink: 0;
        }

        .substep-icon {
            font-size: 1rem;
            opacity: 0.8;
        }

        .substep-durations {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        /* Logs section level (Level 3) - Tertiary containers */
        .network-request-item {
            margin-left: 40px;
            border-left: 2px solid #d1d5db;
            background: #f9fafb;
            border-radius: 6px;
            margin-bottom: 8px;
            transition: all 0.2s ease;
        }

        .network-request-item:hover {
            border-left-color: var(--warning);
            background: #f3f4f6;
        }

        .substep-network-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            transition: background-color 0.2s ease;
            cursor: pointer;
        }

        .network-request-item .substep-name {
            font-size: 0.875rem;
            font-weight: 500;
            color: var(--text-muted);
            gap: 8px;
        }

        .network-request-item .substep-name::before {
            width: 6px;
            height: 6px;
            background: var(--text-muted);
        }

        .network-icon {
            font-size: 0.875rem;
            opacity: 0.7;
        }

        /* Console Logs specific styling */
        .network-request-item.console-logs .substep-name {
            color: #059669;
        }

        .network-request-item.console-logs .substep-name::before {
            background: #059669;
        }

        .network-request-item.console-logs {
            border-left-color: #10b981;
        }

        /* Console Errors specific styling */
        .network-request-item.console-errors .substep-name {
            color: #dc2626;
        }

        .network-request-item.console-errors .substep-name::before {
            background: #dc2626;
        }

        .network-request-item.console-errors {
            border-left-color: #ef4444;
        }

        /* Network Requests specific styling */
        .network-request-item.network-requests .substep-name {
            color: #2563eb;
        }

        .network-request-item.network-requests .substep-name::before {
            background: #2563eb;
        }

        .network-request-item.network-requests {
            border-left-color: #3b82f6;
        }

        /* Enhanced visual hierarchy with proper indentation */
        .substeps {
            padding: 0;
            background: linear-gradient(135deg, #fafbfc, #f8fafc);
        }

        .consoleLogs{
        }

        /* Network request individual items (Level 4) */
        .network-request-subItem {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            border-left: 1px solid #e5e7eb;
            background: white;
            transition: all 0.2s ease;
            position: relative;
        }
            
        .network-request-subItem:last-child {
            border-radius: 0px var(--radius);
        }

        .network-request-subItem::before {
            content: '';
            position: absolute;
            left: -4px;
            top: 50%;
            transform: translateY(-50%);
            width: 6px;
            height: 1px;
            background: #d1d5db;
        }

        .network-request-subItem:hover {
            background: #f8fafc;
            border-left-color: var(--primary);
            margin-left: 20px;
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

        /* Improved duration badges with hierarchy-aware colors */
        .duration-badge {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            border: 1px solid transparent;
            transition: all 0.2s ease;
        }

        .step-header .duration-badge {
            padding: 6px 12px;
            font-size: 0.875rem;
        }

        .substep-header .duration-badge {
            padding: 4px 8px;
            font-size: 0.75rem;
        }

        .network-request-item .duration-badge {
            padding: 2px 6px;
            font-size: 0.7rem;
        }

        /* Enhanced onpremise and cloud colors */
        .onpremise {
            background: linear-gradient(135deg, #dbeafe, #bfdbfe);
            color: #1e40af;
            border-color: #3b82f6;
        }

        .cloud {
            background: linear-gradient(135deg, #fef3c7, #fde68a);
            color: #92400e;
            border-color: #f59e0b;
        }

        .onpremise:hover {
            background: linear-gradient(135deg, #bfdbfe, #93c5fd);
            transform: translateY(-1px);
        }

        .cloud:hover {
            background: linear-gradient(135deg, #fde68a, #fcd34d);
            transform: translateY(-1px);
        }

        .copy-button {
            padding: 10px 10px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }

        .copy-button:hover {
            background-color: rgb(140, 109, 77);
        }

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

        .sorting-controls {
            background: linear-gradient(135deg, var(--surface-alt, #f8f9fa), var(--surface, #ffffff));
            border: 1px solid var(--border, #e9ecef);
            border-radius: 8px;
            padding: 12px 16px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .sorting-label {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.875rem;
            color: var(--text-secondary, #6c757d);
            font-weight: 500;
        }
        
        .sorting-icon {
            font-size: 1.1rem;
        }
        
        .sort-select {
            padding: 6px 12px;
            border: 2px solid var(--border, #dee2e6);
            border-radius: 6px;
            background: var(--surface, #ffffff);
            color: var(--text, #212529);
            cursor: pointer;
            font-size: 0.875rem;
            transition: all 0.2s ease;
            min-width: 200px;
        }
        
        .sort-select:hover {
            border-color: var(--primary, #007bff);
            box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
        }
        
        .sort-select:focus {
            outline: none;
            border-color: var(--primary, #007bff);
            box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.2);
        }
        
        .sort-group {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
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

            .network-request-subItem {
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

            .substep-item {
                margin-left: 10px;
            }
            
            .network-request-item {
                margin-left: 20px;
            }
            
            .network-request-subItem {
                margin-left: 30px;
                flex-direction: column;
                align-items: stretch;
                gap: 10px;
            }
            
            .substep-name {
                font-size: 0.9rem;
            }
            
            .network-request-item .substep-name {
                font-size: 0.8rem;
            }

            .sorting-label {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            
            .sort-select {
                min-width: 100%;
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
        `;
    }
}
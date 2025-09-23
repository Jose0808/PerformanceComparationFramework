import { ComparisonReport } from '../types/report.types';

export class JSRenderer {
    static render(comparison: ComparisonReport): string {
        return `
        <script>
        function copiarAlPortapapeles(idElemento) {
            const textoACopiar = document.getElementById(idElemento).innerText;
            navigator.clipboard.writeText(textoACopiar)
            .then(() => {
                alert("¡Texto copiado al portapapeles!");
            })
            .catch(err => {
                console.error('Error al copiar texto: ', err);
                alert("Hubo un error al copiar el texto.");
            });
        }

        ${this.generateNetworkSorting()}
        ${this.generateChartScript(comparison)}
        ${this.generateAnimationScript()}
        </script>`;
    }


    private static generateNetworkSorting(): string {

        return `
        function sortNetworkByDuration(sortValue, subStepName) {
    const container = document.getElementById('network-requests-container-'+subStepName);
    if (!container) return;
    
    const sortingControls = container.querySelector('.sorting-controls');
    const requests = Array.from(container.children).filter(child => 
        !child.classList.contains('sorting-controls') && 
        (child.textContent.includes('ms') || child.querySelector('[class*="duration"]'))
    );
    
    if (sortValue === 'original') {
        location.reload();
        return;
    }
    
    // Parsear el valor de ordenamiento
    const [order, source] = sortValue.split('-');
    
    const requestsWithDuration = requests.map(request => {
        let onpremiseDuration = 0;
        let cloudDuration = 0;
        
        // Buscar duraciones específicas por contexto
        const onpremiseElements = request.querySelectorAll('.onpremise, [class*="onpremise"]');
        const cloudElements = request.querySelectorAll('.cloud, [class*="cloud"]');
        
        // Extraer duración OnPremise
        onpremiseElements.forEach(elem => {
            const text = elem.textContent.trim();
            if (text.includes('ms') && !text.includes('❌')) {
                const value = parseFloat(text.replace('ms', ''));
                if (!isNaN(value)) onpremiseDuration = Math.max(onpremiseDuration, value);
            }
        });
        
        // Extraer duración Cloud
        cloudElements.forEach(elem => {
            const text = elem.textContent.trim();
            if (text.includes('ms') && !text.includes('❌')) {
                const value = parseFloat(text.replace('ms', ''));
                if (!isNaN(value)) cloudDuration = Math.max(cloudDuration, value);
            }
        });
        
        // Si no encuentra en elementos específicos, buscar en todo el texto
        if (onpremiseDuration === 0 && cloudDuration === 0) {
            const allMatches = request.textContent.match(/(\d+\.?\d*)ms/g);
            if (allMatches && allMatches.length > 0) {
                onpremiseDuration = parseFloat(allMatches[0].replace('ms', ''));
                if (allMatches.length > 1) {
                    cloudDuration = parseFloat(allMatches[1].replace('ms', ''));
                }
            }
        }
        
        // Determinar duración a usar para ordenamiento
        let sortDuration = 0;
        switch (source) {
            case 'onpremise':
                sortDuration = onpremiseDuration || 0;
                break;
            case 'cloud':
                sortDuration = cloudDuration || 0;
                break;
            case 'fastest':
                sortDuration = Math.min(
                    onpremiseDuration || Infinity, 
                    cloudDuration || Infinity
                );
                if (sortDuration === Infinity) sortDuration = 0;
                break;
            case 'slowest':
                sortDuration = Math.max(onpremiseDuration || 0, cloudDuration || 0);
                break;
            default:
                sortDuration = onpremiseDuration || cloudDuration || 0;
        }
        
        return { 
            element: request, 
            duration: sortDuration,
            onpremiseDuration,
            cloudDuration,
            source
        };
    });
    
    // Ordenar según criterio
    requestsWithDuration.sort((a, b) => {
        const comparison = order === 'asc' ? a.duration - b.duration : b.duration - a.duration;
        
        // Si las duraciones son iguales, usar criterio secundario
        if (comparison === 0) {
            const secondaryA = Math.max(a.onpremiseDuration, a.cloudDuration);
            const secondaryB = Math.max(b.onpremiseDuration, b.cloudDuration);
            return order === 'asc' ? secondaryA - secondaryB : secondaryB - secondaryA;
        }
        
        return comparison;
    });
    
    // Reordenar en DOM
    container.innerHTML = '';
    if (sortingControls) container.appendChild(sortingControls);
    
    requestsWithDuration.forEach((item, index) => {
        // Agregar indicador visual del ordenamiento
        const indicator = document.createElement('div');
        indicator.style.cssText = 'position: absolute; top: 4px; right: 4px; background: var(--primary, #007bff); color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.75rem; font-weight: bold;';
        indicator.textContent = '#'+(index + 1);
        
        if (item.element.style.position !== 'relative') {
            item.element.style.position = 'relative';
        }
        
        // Remover indicador anterior si existe
        const oldIndicator = item.element.querySelector('[data-sort-indicator]');
        if (oldIndicator) oldIndicator.remove();
        
        indicator.setAttribute('data-sort-indicator', 'true');
        item.element.appendChild(indicator);
        
        container.appendChild(item.element);
    });
    }
        `;
    }

    private static generateChartScript(comparison: ComparisonReport): string {
        if (comparison.onpremise.totalDuration === 0 && comparison.cloud.totalDuration === 0) {
            return '';
        }

        const stepNames = [...new Set([
            ...comparison.onpremise.steps.map(s => s.name),
            ...comparison.cloud.steps.map(s => s.name)
        ])];

        const onpremiseData = stepNames.map(name => {
            const step = comparison.onpremise.steps.find(s => s.name === name);
            return step ? step.duration : 0;
        });

        const cloudData = stepNames.map(name => {
            const step = comparison.cloud.steps.find(s => s.name === name);
            return step ? step.duration : 0;
        });

        return `
        const ctx = document.getElementById('comparisonChart')?.getContext('2d');
        
        if (ctx) {
            const stepNames = ${JSON.stringify(stepNames)};
            const onpremiseData = ${JSON.stringify(onpremiseData)};
            const cloudData = ${JSON.stringify(cloudData)};

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
        }`;
    }

    private static generateAnimationScript(): string {
        return `
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
        });`;
    }
}
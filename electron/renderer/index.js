
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// Variables globales
let currentSection = 'home';
let currentDataFile = null;
let currentEnvData = {};
let projectPaths = {};
let isTestRunning = false;

// ======================== NAVEGACIÓN ========================
function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.add('hidden');
    });

    document.getElementById(sectionName + '-section').classList.remove('hidden');
    currentSection = sectionName;

    // Acciones específicas por sección
    if (sectionName === 'home') {
        verifyInstallation();
    } else if (sectionName === 'data-editor') {
        loadDataFiles();
    } else if (sectionName === 'env-editor') {
        loadEnvFile();
    } else if (sectionName === 'scheduler') {
        initSchedulerSection();
    }
}

// ======================== VERIFICACIÓN DEL SISTEMA ========================
async function verifyInstallation() {
    try {
        const result = await ipcRenderer.invoke('verify-installation');
        if (result.success) {
            updateSystemStatus(result.checks);
            updateProjectSummary(result.checks);
            updateTest(result.checks.testFiles);
            projectPaths = result.paths;
        } else {
            console.error('Verification failed:', result.error);
        }
    } catch (error) {
        console.error('Error during verification:', error);
    }
}

function updateSystemStatus(checks) {
    // Verificar Node.js
    updateStatus('node-status', checks.nodeCheck.installed,
        checks.nodeCheck.installed ? `Instalado ${checks.nodeCheck.version}` : 'No instalado');

    updateStatus('config-status', checks.playwrightConfig,
        checks.playwrightConfig ? 'Configurado' : 'Faltante');

    updateStatus('tests-status', checks.testsDirectory,
        checks.testsDirectory ? `${checks.testFilesCount || 0} archivos` : 'No encontrado');

    updateStatus('data-status', checks.dataDirectory,
        checks.dataDirectory ? `${checks.dataFilesCount || 0} archivos JSON` : 'No encontrado');

    updateStatus('env-status', checks.envFile,
        checks.envFile ? 'Configurado' : 'Faltante');

    updateStatus('deps-status', checks.nodeModules,
        checks.nodeModules ? 'Instaladas' : 'Faltantes');
}

function updateStatus(elementId, isOk, message) {
    const element = document.getElementById(elementId);
    if (element) {
        const statusClass = isOk ? 'status-ok' : 'status-error';
        element.innerHTML = `<span class="status-indicator ${statusClass}"></span>${message}`;
    }
}

function updateTest(tests) {
    const element = document.getElementById("testsContainer");
    if (element && tests) {
        let checks = "";
        tests.forEach(test => {
            checks += `<label><input name="tests" type="checkbox" value="${test}" checked>${test.replace(process.env.ENVIROMENT !== 'pro' ? ".spec.ts" : ".spec.js", "")}</label>`;
        });
        element.innerHTML = checks;
    }
}

function updateProjectSummary(checks) {
    const summaryDiv = document.getElementById('project-summary');
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">';

    html += `
                <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>🧪 Tests Disponibles</h4>
                    <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${checks.testFilesCount || 0}</div>
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>📄 Archivos de Datos</h4>
                    <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">${checks.dataFilesCount || 0}</div>
                </div>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                    <h4>✅ Sistema</h4>
                    <div style="font-size: 16px; font-weight: bold; color: #2e7d32;">
                        ${Object.values(checks).filter(c => c).length}/${Object.keys(checks).length} OK
                    </div>
                </div>
            `;

    html += '</div>';
    summaryDiv.innerHTML = html;
}

// ======================== EDITOR DE DATOS JSON ========================
async function loadDataFiles() {
    try {
        const result = await ipcRenderer.invoke('list-data-files');

        if (result.success) {
            displayDataFiles(result.files);
        } else {
            document.getElementById('data-files-list').innerHTML =
                `<div style="padding: 20px; color: #f44336;">Error: ${result.error}</div>`;
        }
    } catch (error) {
        console.error('Error loading data files:', error);
    }
}

function displayDataFiles(files) {
    const listDiv = document.getElementById('data-files-list');

    if (files.length === 0) {
        listDiv.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No hay archivos JSON en src/data-driven</div>';
        return;
    }

    let html = '';
    files.forEach((file, index) => {
        html += `
                    <div class="file-item" onclick="selectDataFile('${file.name}')" data-filename="${file.name}">
                        <div class="file-info">
                            <div class="file-name">📄 ${file.name}</div>
                            <div class="file-size">${(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                        
                    </div>
                `;
        // <button onclick="event.stopPropagation(); deleteDataFile('${file.name}')" 
        //         style="background: #f44336; color: white; border: none; padding: 4px 8px; border-radius: 3px; cursor: pointer;">🗑️</button>
    });

    listDiv.innerHTML = html;
}

async function selectDataFile(filename) {
    // Limpiar selección anterior
    document.querySelectorAll('.file-item').forEach(item => {
        item.classList.remove('selected');
    });

    // Seleccionar el nuevo
    document.querySelector(`[data-filename="${filename}"]`).classList.add('selected');

    try {
        const result = await ipcRenderer.invoke('read-data-file', filename);

        if (result.success) {
            currentDataFile = filename;
            const jsonEditor = document.getElementById('json-editor');
            jsonEditor.value = JSON.stringify(result.data, null, 2);
            document.getElementById('save-json-btn').disabled = false;

            // Mostrar información del archivo
            document.getElementById('json-status').innerHTML =
                `<span style="color: #4caf50;">✅ Archivo cargado: ${filename}</span>`;

            // Buscar tests relacionados
            findRelatedTests(filename);
        } else {
            showMessage('error', `Error al cargar ${filename}: ${result.error}`);
        }
    } catch (error) {
        console.error('Error selecting data file:', error);
    }
}

async function saveCurrentFile() {
    if (!currentDataFile) return;

    try {
        const jsonEditor = document.getElementById('json-editor');
        const jsonData = JSON.parse(jsonEditor.value);

        const result = await ipcRenderer.invoke('save-data-file', currentDataFile, jsonData);

        if (result.success) {
            showMessage('success', `✅ ${currentDataFile} guardado correctamente`);
        } else {
            showMessage('error', `❌ Error al guardar: ${result.error}`);
        }
    } catch (error) {
        showMessage('error', `❌ JSON inválido: ${error.message}`);
    }
}

function validateJson() {
    try {
        const jsonEditor = document.getElementById('json-editor');
        JSON.parse(jsonEditor.value);
        document.getElementById('json-status').innerHTML =
            '<span style="color: #4caf50;">✅ JSON válido</span>';
    } catch (error) {
        console.log(error.message);
        document.getElementById('json-status').innerHTML =
            `<span style="color: #f44336;">❌ Error: ${error.message}</span>`;
    }
}

function formatJson() {
    try {
        const jsonEditor = document.getElementById('json-editor');
        const parsed = JSON.parse(jsonEditor.value);
        jsonEditor.value = JSON.stringify(parsed, null, 2);
        document.getElementById('json-status').innerHTML =
            '<span style="color: #4caf50;">✅ JSON formateado</span>';
    } catch (error) {
        showMessage('error', `❌ No se puede formatear: ${error.message}`);
    }
}

async function createNewDataFile() {
    const filename = prompt('Nombre del nuevo archivo (sin .json):');
    if (!filename) return;

    const fullFilename = filename.endsWith('.json') ? filename : filename + '.json';

    const initialData = {
        "testName": filename.replace('.json', ''),
        "description": "Datos de prueba generados automáticamente",
        "testData": [
            {
                "id": 1,
                "name": "Caso de prueba 1",
                "url": "https://example.com",
                "expected": "resultado esperado"
            }
        ]
    };

    try {
        const result = await ipcRenderer.invoke('create-data-file', fullFilename, initialData);

        if (result.success) {
            showMessage('success', `✅ Archivo ${fullFilename} creado`);
            loadDataFiles();
        } else {
            console.log(error.message);
            showMessage('error', `❌ Error: ${result.error}`);
        }
    } catch (error) {
        showMessage('error', `❌ Error al crear archivo: ${error.message}`);
    }
}

async function findRelatedTests(dataFilename) {
    try {
        const result = await ipcRenderer.invoke('list-test-files');

        if (result.success) {
            const relatedTests = [];

            for (const testFile of result.testFiles) {
                const analysis = await ipcRenderer.invoke('analyze-test-file', testFile.fullPath);
                if (analysis.success) {
                    const isRelated = analysis.jsonReferences.some(ref => {
                        console.log(ref.file.includes(dataFilename));
                        console.log(dataFilename.includes(path.basename(ref.file)));
                        console.log(path.basename(ref.file));
                        console.log(ref.file.includes(dataFilename) || dataFilename.includes(path.basename(ref.file)));
                        return ref.file.includes(dataFilename) || dataFilename.includes(path.basename(ref.file))
                    }
                    );

                    if (isRelated) {
                        relatedTests.push(testFile.name);
                    }
                }
            }

            const relationDiv = document.getElementById('test-relation');
            const testsDiv = document.getElementById('related-tests');

            if (relatedTests.length > 0) {
                testsDiv.innerHTML = relatedTests.map(test => `• ${test}`).join('<br>');
                relationDiv.classList.remove('hidden');
            } else {
                testsDiv.innerHTML = 'No se encontraron tests relacionados';
                relationDiv.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error finding related tests:', error);
    }
}

// ======================== EDITOR DE .ENV ========================
async function loadEnvFile() {
    try {
        const result = await ipcRenderer.invoke('read-env-file');

        if (result.success) {
            currentEnvData = result.variables;
            displayEnvEditor(result.variables);
            showMessage('success', '✅ Archivo .env cargado correctamente');
        } else {
            showMessage('error', `❌ Error al cargar .env: ${result.error}`);
            // Crear un .env vacío para empezar
            currentEnvData = {};
            displayEnvEditor({});
        }
    } catch (error) {
        console.error('Error loading env file:', error);
        showMessage('error', 'Error inesperado al cargar el archivo .env');
    }
}

function displayEnvEditor(envVars) {
    const editorDiv = document.getElementById('env-editor');

    let html = '';

    Object.entries(envVars).forEach(([key, value]) => {
        html += `
                    <div class="env-var">
                        <input type="text" class="env-input" value="${key}" onchange="updateEnvKey(this, '${key}')" placeholder="VARIABLE_NAME" disabled>
                        <input type="text" class="env-input" value="${value}" onchange="updateEnvValue('${key}', this.value)" placeholder="valor">
                    </div>
                `;
        // <button onclick="removeEnvVar('${key}')" style="background: #f44336; color: white; border: none; padding: 6px; border-radius: 3px; cursor: pointer;">🗑️</button>

    });

    // Si no hay variables, mostrar mensaje
    if (Object.keys(envVars).length === 0) {
        html = `
                    <div style="text-align: center; padding: 30px; color: #666;">
                        <p>📝 No hay variables de entorno configuradas</p>
                        <p style="margin-top: 10px;">Haga clic en "Agregar Variable" para comenzar</p>
                    </div>
                `;
    }

    editorDiv.innerHTML = html;
}

function addEnvVariable() {
    const key = prompt('Nombre de la variable (ej: BASE_URL):');
    if (!key) return;

    const value = prompt('Valor de la variable:') || '';

    currentEnvData[key.toUpperCase()] = value;
    displayEnvEditor(currentEnvData);
}

function updateEnvKey(input, oldKey) {
    const newKey = input.value.toUpperCase();
    if (newKey !== oldKey) {
        currentEnvData[newKey] = currentEnvData[oldKey];
        delete currentEnvData[oldKey];
        displayEnvEditor(currentEnvData);
    }
}

function updateEnvValue(key, newValue) {
    currentEnvData[key] = newValue;
}

function removeEnvVar(key) {
    if (confirm(`¿Eliminar la variable ${key}?`)) {
        delete currentEnvData[key];
        displayEnvEditor(currentEnvData);
    }
}

async function saveEnvFile() {
    try {
        const result = await ipcRenderer.invoke('save-env-file', currentEnvData);

        if (result.success) {
            showMessage('success', '✅ Archivo .env guardado correctamente');
        } else {
            showMessage('error', `❌ Error al guardar .env: ${result.error}`);
        }
    } catch (error) {
        console.error('Error saving env file:', error);
        showMessage('error', 'Error inesperado al guardar el archivo .env');
    }
}

// ======================== EJECUCIÓN DE PRUEBAS ========================
async function runTestsUI() {
    const btn = document.getElementById('run-ui-btn');
    btn.disabled = true;
    btn.textContent = 'Abriendo UI...';

    try {
        const result = await ipcRenderer.invoke('run-tests-ui');

        if (result.success) {
            document.getElementById('ui-instructions').classList.remove('hidden');
            showMessage('success', '🎮 Playwright UI iniciado correctamente');
        } else {
            console.log(error.message);
            showMessage('error', `❌ Error: ${result.error || result.output}`);
        }
    } catch (error) {
        console.error('Error running UI tests:', error);
        showMessage('error', `❌ Error inesperado: ${error.message}`);
    }

    btn.disabled = false;
    btn.textContent = '🎮 Abrir Modo Interactivo';
}

async function runAllTests() {
    if (isTestRunning) return;

    const btn = document.getElementById('run-tests-btn');
    // const stopBtn = document.getElementById('stop-tests-btn');
    const console = document.getElementById('test-console');

    isTestRunning = true;
    btn.disabled = true;
    // stopBtn.disabled = false;
    btn.textContent = 'Ejecutando...';
    console.textContent = '';

    addTestConsoleText('🚀 Iniciando ejecución de todas las pruebas...\n');
    addTestConsoleText('⏳ Por favor espere, esto puede tomar varios minutos...\n\n');

    try {
        const result = await ipcRenderer.invoke('run-tests');

        addTestConsoleText('\n' + '='.repeat(50) + '\n');

        if (result.success) {
            addTestConsoleText('🎉 ¡PRUEBAS COMPLETADAS EXITOSAMENTE!\n\n');
            addTestConsoleText('📊 Resumen:\n');
            addTestConsoleText('   • Todas las pruebas pasaron\n');
            addTestConsoleText('   • Reportes generados correctamente\n');
            addTestConsoleText('   • Puede ver los detalles en "Ver Reportes"\n\n');
        } else {
            addTestConsoleText('⚠️ PRUEBAS COMPLETADAS CON ERRORES\n\n');
            addTestConsoleText('📊 Resumen:\n');
            addTestConsoleText('   • Algunas pruebas fallaron\n');
            addTestConsoleText('   • Revise el reporte HTML para detalles\n');
            addTestConsoleText('   • Capturas de pantalla disponibles\n\n');
        }

        addTestConsoleText('🔗 Próximos pasos:\n');
        addTestConsoleText('   1. Ir a "Ver Reportes" → "Abrir Reporte HTML"\n');
        addTestConsoleText('   2. Revisar capturas de pantalla y videos\n');
        addTestConsoleText('   3. Modificar datos si es necesario\n');

    } catch (error) {
        addTestConsoleText(`❌ ERROR CRÍTICO: ${error.message}\n`);
        addTestConsoleText('🔧 Posibles soluciones:\n');
        addTestConsoleText('   • Verificar que todas las dependencias estén instaladas\n');
        addTestConsoleText('   • Comprobar la configuración de Playwright\n');
        addTestConsoleText('   • Revisar los archivos de datos JSON\n');
    }

    isTestRunning = false;
    btn.disabled = false;
    // stopBtn.disabled = true;
    btn.textContent = '🚀 Ejecutar Todas las Pruebas';
}

function verifyBeforeRun() {
    verifyInstallation();
    showMessage('info', '🔍 Verificación completa. Revise el Dashboard para más detalles.');
}

function clearTestConsole() {
    document.getElementById('test-console').textContent = '';
}

function stopTests() {
    // Esta función requeriría implementación adicional en el main process
    showMessage('warning', '⚠️ Función de detener en desarrollo');
}

// ======================== REPORTES ========================
async function showHtmlReport() {
    try {
        const result = await ipcRenderer.invoke('show-report');

        if (!result.success) {
            showMessage('warning', '⚠️ No se encontraron reportes. Ejecute las pruebas primero.');
        }
    } catch (error) {
        showMessage('error', `❌ Error al abrir reportes: ${error.message}`);
    }
}

async function openReportsFolder() {
    try {
        await ipcRenderer.invoke('open-reports-folder');
    } catch (error) {
        showMessage('error', `❌ Error al abrir carpeta de reportes: ${error.message}`);
    }
}

async function openProjectFolder() {
    try {
        await ipcRenderer.invoke('open-project-folder');
    } catch (error) {
        showMessage('error', `❌ Error al abrir carpeta del proyecto: ${error.message}`);
    }
}

// ======================== UTILIDADES ========================
function refreshDataFiles() {
    loadDataFiles();
    showMessage('info', '🔄 Lista de archivos actualizada');
}

async function deleteDataFile(filename) {
    if (!confirm(`¿Está seguro de eliminar ${filename}?`)) return;

    // Esta función requiere implementación en el main process
    showMessage('warning', '🚧 Función de eliminar en desarrollo');
}

function showMessage(type, message) {
    // Crear elemento de mensaje temporal
    const messageDiv = document.createElement('div');
    messageDiv.className = type === 'success' ? 'success-message' :
        type === 'error' ? 'error-message' : 'warning-box';
    messageDiv.innerHTML = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.right = '20px';
    messageDiv.style.zIndex = '9999';
    messageDiv.style.maxWidth = '400px';

    document.body.appendChild(messageDiv);

    // Remover después de 3 segundos
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

function addTestConsoleText(text) {
    const console = document.getElementById('test-console');
    console.textContent += text;
    console.scrollTop = console.scrollHeight;
}

// ======================== EVENT LISTENERS ========================

// Escuchar progreso de tests
ipcRenderer.on('test-output', (event, data) => {
    addTestConsoleText(data);
});

// Escuchar cuando las rutas del proyecto estén listas
ipcRenderer.on('project-paths-ready', (event, paths) => {
    projectPaths = paths;
    console.log('Project paths received:', paths);
});

// Autoguardar en editor JSON cada 30 segundos
// setInterval(() => {
//     if (currentDataFile && document.getElementById('json-editor').value) {
//         const jsonEditor = document.getElementById('json-editor');
//         try {
//             JSON.parse(jsonEditor.value);
//             // Solo autoguardar si el JSON es válido
//             document.getElementById('json-status').innerHTML += ' 💾';
//         } catch (error) {
//             // No autoguardar si hay errores
//         }
//     }
// }, 30000);

// ======================== INICIALIZACIÓN ========================
window.addEventListener('DOMContentLoaded', () => {
    console.log('Application starting...');
    showSection('home');

    // Verificar estado inicial
    setTimeout(() => {
        verifyInstallation();
    }, 1000);
});

// Manejar errores globales
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showMessage('error', `❌ Error de aplicación: ${event.error.message}`);
});

// ======================== FUNCIONES ADICIONALES PARA DATOS ========================

function duplicateCurrentFile() {
    if (!currentDataFile) {
        showMessage('warning', '⚠️ Seleccione un archivo primero');
        return;
    }

    const newName = prompt(`Nuevo nombre para la copia de ${currentDataFile}:`);
    if (!newName) return;

    const fullNewName = newName.endsWith('.json') ? newName : newName + '.json';

    try {
        const jsonEditor = document.getElementById('json-editor');
        const currentData = JSON.parse(jsonEditor.value);

        // Modificar el nombre en los datos
        if (currentData.testName) {
            currentData.testName = fullNewName.replace('.json', '');
        }

        ipcRenderer.invoke('create-data-file', fullNewName, currentData)
            .then(result => {
                if (result.success) {
                    showMessage('success', `✅ Archivo duplicado: ${fullNewName}`);
                    loadDataFiles();
                } else {
                    console.log(error.message);
                    showMessage('error', `❌ Error: ${result.error}`);
                }
            });

    } catch (error) {
        showMessage('error', '❌ Error al duplicar: JSON inválido');
    }
}

// Función para exportar configuración completa
async function exportConfiguration() {
    try {
        const dataResult = await ipcRenderer.invoke('list-data-files');
        const envResult = await ipcRenderer.invoke('read-env-file');

        const config = {
            timestamp: new Date().toISOString(),
            dataFiles: dataResult.success ? dataResult.files.length : 0,
            envVariables: envResult.success ? Object.keys(envResult.variables).length : 0,
            environment: envResult.success ? envResult.variables : {}
        };

        console.log('Configuration export:', config);
        showMessage('info', '📋 Configuración exportada a consola del desarrollador');
    } catch (error) {
        showMessage('error', '❌ Error al exportar configuración');
    }
}

// ======================== TECLADO SHORTCUTS ========================
document.addEventListener('keydown', (event) => {
    // Ctrl+S para guardar
    if (event.ctrlKey && event.key === 's') {
        event.preventDefault();
        if (currentSection === 'data-editor' && currentDataFile) {
            saveCurrentFile();
        } else if (currentSection === 'env-editor') {
            saveEnvFile();
        }
    }

    // Ctrl+R para ejecutar pruebas
    if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        if (currentSection === 'run-auto') {
            runAllTests();
        }
    }
});


// ======================== PLANIFICADOR DE PRUEBAS ========================

let availableTests = [];

async function initSchedulerSection() {
    try {
        // Cargar patrones cron
        const patternsResult = await ipcRenderer.invoke('scheduler-get-cron-patterns');
        if (patternsResult.success) {
            cronPatterns = patternsResult.patterns;
            populateCronPresets();
        }

        // Cargar tests disponibles
        await loadAvailableTests();

        // Intentar conectar
        await schedulerInit();
    } catch (error) {
        console.error('Error initializing scheduler:', error);
        showMessage('error', `Error inicializando planificador: ${error.message}`);
    }
}

function populateCronPresets() {
    const select = document.getElementById('cron-preset');
    if (!select) return;
    select.innerHTML = '<option value="">Seleccionar patrón común...</option>';
    cronPatterns.forEach(pattern => {
        const option = document.createElement('option');
        option.value = pattern.value; option.textContent = `${pattern.label} - ${pattern.description}`;
        select.appendChild(option);
    });
}

// Establecer expresión cron desde preset 
function setCronFromPreset() {
    const preset = document.getElementById('cron-preset');
    const expression = document.getElementById('cron-expression');
    if (preset && expression && preset.value) {
        expression.value = preset.value;
    }
}

// Actualizar el estado del servicio 
function updateServiceStatus(status, message) {
    const statusElement = document.getElementById('service-status');
    const infoElement = document.getElementById('service-info');
    if (statusElement) {
        const statusClass = status === 'ok' ? 'status-ok' : status === 'error' ? 'status-error' : 'status-loading';
        statusElement.innerHTML = `<span class="status-indicator ${statusClass}"></span>${message}`;
    }
    if (infoElement) {
        infoElement.textContent = `Estado del servicio: ${message}`;
    }
}

// Cargar tests disponibles
async function loadAvailableTests() {
    try {
        const result = await ipcRenderer.invoke('list-test-files');
        if (result.success) {
            availableTests = result.testFiles.map(test => ({
                name: test.name,
                path: test.relativePath,
                fullPath: test.fullPath
            }));
            console.log('Loaded available tests:', availableTests);
        }
    } catch (error) {
        console.error('Error loading tests:', error);
        showMessage('error', 'Error cargando lista de tests');
    }
}

function showCreateScheduleForm() {
    editingScheduleId = null;
    document.getElementById('form-title').textContent = 'Nueva Programación';
    // clearScheduleForm();
    populateTestSelector();
    document.getElementById('schedule-form').classList.remove('hidden');
    document.getElementById('schedule-name').focus();
}

function editSchedule(scheduleId) {
    const schedule = currentSchedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    editingScheduleId = scheduleId;
    document.getElementById('form-title').textContent = 'Editar Programación';

    document.getElementById('schedule-name').value = schedule.name;
    document.getElementById('cron-expression').value = schedule.cronExpression;
    document.getElementById('schedule-enabled').checked = schedule.enabled;

    // Poblar selector de tests y marcar los seleccionados
    populateTestSelector(schedule.testFiles || []);

    document.getElementById('schedule-form').classList.remove('hidden');
    document.getElementById('schedule-name').focus();
}


function populateTestSelector(selectedTests = []) {
    const testSelectorDiv = document.getElementById('test-selector');
    if (!testSelectorDiv) return;

    if (availableTests.length === 0) {
        testSelectorDiv.innerHTML = '<p style="color: #666; font-size: 12px;">No hay tests disponibles</p>';
        return;
    }

    let html = '<div style="max-height: 200px; overflow-y: auto; border: 1px solid #ddd; border-radius: 4px; padding: 10px; background: white;">';

    // Opción para seleccionar todos
    html += `
        <label style="display: block; margin-bottom: 8px; padding: 5px; background: #f0f0f0; border-radius: 3px;">
            <input type="checkbox" id="select-all-tests" onchange="toggleAllTests(this.checked)" style="margin-right: 8px;">
            <strong>Seleccionar todos</strong>
        </label>
        <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;">
    `;

    availableTests.forEach((test, index) => {
        const isChecked = selectedTests.includes(test.name) || selectedTests.length === 0;
        html += `
            <label style="display: block; margin-bottom: 5px; padding: 3px; cursor: pointer;" 
                   onmouseover="this.style.background='#f5f5f5'" 
                   onmouseout="this.style.background='transparent'">
                <input type="checkbox" 
                       class="test-checkbox" 
                       value="${test.name}" 
                       ${isChecked ? 'checked' : ''}
                       onchange="updateSelectAllCheckbox()"
                       style="margin-right: 8px;">
                <span style="font-size: 13px;">${test.name.replace(process.env.ENVIROMENT !== 'pro' ? ".spec.ts" : ".spec.js", '')}</span>
            </label>
        `;
    });

    html += '</div>';
    html += `
        <div style="margin-top: 8px; font-size: 11px; color: #666;">
            <span id="selected-tests-count">0</span> test(s) seleccionado(s)
        </div>
    `;

    testSelectorDiv.innerHTML = html;
    updateSelectedTestsCount();
    updateSelectAllCheckbox();
}

function toggleAllTests(checked) {
    document.querySelectorAll('.test-checkbox').forEach(checkbox => {
        checkbox.checked = checked;
    });
    updateSelectedTestsCount();
}

function updateSelectAllCheckbox() {
    const allCheckboxes = document.querySelectorAll('.test-checkbox');
    const checkedCheckboxes = document.querySelectorAll('.test-checkbox:checked');
    const selectAllCheckbox = document.getElementById('select-all-tests');

    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allCheckboxes.length === checkedCheckboxes.length;
        selectAllCheckbox.indeterminate = checkedCheckboxes.length > 0 && checkedCheckboxes.length < allCheckboxes.length;
    }

    updateSelectedTestsCount();
}

function updateSelectedTestsCount() {
    const count = document.querySelectorAll('.test-checkbox:checked').length;
    const countElement = document.getElementById('selected-tests-count');
    if (countElement) {
        countElement.textContent = count;
    }
}

async function saveSchedule() {
    const name = document.getElementById('schedule-name').value.trim();
    const cronExpression = document.getElementById('cron-expression').value.trim();
    const enabled = document.getElementById('schedule-enabled').checked;

    if (!name) {
        showMessage('error', 'El nombre es requerido');
        return;
    }

    if (!cronExpression) {
        showMessage('error', 'La expresión cron es requerida');
        return;
    }

    // Obtener tests seleccionados
    const selectedTests = Array.from(document.querySelectorAll('.test-checkbox:checked'))
        .map(checkbox => checkbox.value);

    if (selectedTests.length === 0 && !testPattern) {
        const confirm = window.confirm('No ha seleccionado ningún test. ¿Desea ejecutar todos los tests?');
        if (!confirm) return;
    }

    const scheduleData = {
        name,
        cronExpression,
        testFiles: selectedTests.length > 0 ? selectedTests : undefined,
        enabled,
    };

    try {
        let result;
        if (editingScheduleId) {
            result = await ipcRenderer.invoke('scheduler-update-schedule', editingScheduleId, scheduleData);
        } else {
            result = await ipcRenderer.invoke('scheduler-create-schedule', scheduleData);
        }

        if (result.success) {
            showMessage('success', `Programación ${editingScheduleId ? 'actualizada' : 'creada'} correctamente`);
            cancelScheduleForm();
            await refreshSchedules();
        } else {
            showMessage('error', `Error: ${result.error}`);
        }
    } catch (error) {
        showMessage('error', `Error guardando: ${error.message}`);
    }
}

// Actualizar lista de programaciones 
async function refreshSchedules() {
    if (!schedulerConnected) {
        document.getElementById('schedules-list').innerHTML = '<div style="padding: 20px; color: #f44336;">No conectado al servicio</div>';
        return;
    } try {
        const result = await ipcRenderer.invoke('scheduler-get-schedules');
        if (result.success) {
            currentSchedules = result.schedules;
            displaySchedules(result.schedules);
            const statusResult = await ipcRenderer.invoke('scheduler-get-status');
            if (statusResult.success) {
                updateServiceInfo(statusResult.status);

            }
        } else {
            showMessage('error', `Error cargando programaciones: ${result.error}`);
        }
    } catch (error) {
        showMessage('error', `Error de conexión: ${error.message}`);
    }
}

// Eliminar schedule 
async function deleteSchedule(scheduleId) {
    const schedule = currentSchedules.find(s => s.id === scheduleId);
    const scheduleName = schedule ? schedule.name : 'esta programación';
    if (!confirm(`¿Está seguro de eliminar "${scheduleName}"?`)) { return; }
    try {
        const result = await ipcRenderer.invoke('scheduler-delete-schedule', scheduleId);
        if (result.success) {
            showMessage('success', 'Programación eliminada'); await refreshSchedules();
        }
        else {
            showMessage('error', `Error: ${result.error}`);
        }
    }
    catch (error) {
        showMessage('error', `Error eliminando: ${error.message}`);
    }
}

// Actualizar información del servicio 
function updateServiceInfo(status) {
    const infoElement = document.getElementById('service-info');
    if (!infoElement || !status.serviceInfo)
        return;
    const info = status.serviceInfo;
    const uptime = Math.floor(info.uptime / 60);
    const memory = Math.round(info.memoryUsage.heapUsed / 1024 / 1024);
    infoElement.innerHTML = ` <strong>Información del servicio:</strong><br> PID: ${info.pid} | Uptime: ${uptime} min | Memoria:${memory} MB<br> Horarios: ${status.totalSchedules} total, ${status.activeSchedules} activos<br> Proyecto: ${info.projectPath} `;
}

// Eliminar schedule 
async function stopSchedule(scheduleId) {
    try {
        const result = await ipcRenderer.invoke('scheduler-stop', scheduleId);
        if (result.success) {
            showMessage('success', 'Programación pausada');
            await refreshSchedules();
        } else {
            showMessage('error', `Error: ${result.error}`);
        }
    }
    catch (error) {
        showMessage('error', `Error pausando: ${error.message}`);
    }
}

// Iniciar schedule
async function startSchedule(scheduleId) {
    try {
        const result = await ipcRenderer.invoke('scheduler-start', scheduleId);
        if (result.success) {
            showMessage('success', 'Programación iniciada');
            await refreshSchedules();
        }
        else {
            showMessage('error', `Error: ${result.error}`);
        }
    } catch (error) {
        showMessage('error', `Error iniciando: ${error.message}`);
    }
}

// Cancelar formulario
function cancelScheduleForm() {
    document.getElementById('schedule-form').classList.add('hidden');
    editingScheduleId = null;
}

// Ejecutar schedule manualmente 
async function runScheduleNow(scheduleId) {
    try {
        const result = await ipcRenderer.invoke('scheduler-run-now', scheduleId);
        if (result.success) {
            showMessage('success', 'Ejecución iniciada');
            document.getElementById('schedule-monitor').classList.remove('hidden');
            addScheduleConsoleText('Ejecución manual iniciada...\n');
        }
        else {
            showMessage('error', `Error: ${result.error}`);
        }
    } catch (error) {
        showMessage('error', `Error ejecutar: ${error.message}`);
    }
}

// Conectar al servicio del planificador 
async function schedulerInit() {
    updateServiceStatus('loading', 'Conectando...');
    try {
        const result = await ipcRenderer.invoke('scheduler-init');
        if (result.success) {
            schedulerConnected = true;
            updateServiceStatus('ok', 'Conectado');
            await refreshSchedules();
            showMessage('success', 'Conectado al servicio de programación');
        }
        else {
            schedulerConnected = false;
            updateServiceStatus('error', `Error: ${result.error}`);
            showMessage('error', `Error conectando: ${result.error}`);
        }
    } catch (error) {
        schedulerConnected = false;
        updateServiceStatus('error', 'Desconectado');
        showMessage('error', `Error de conexión: ${error.message}`);
    }
}

function displaySchedules(schedules) {
    const container = document.getElementById('schedules-list');

    if (schedules.length === 0) {
        container.innerHTML = `
            <div style="padding: 20px; text-align: center; color: #666;">
                <p>No hay programaciones configuradas</p>
                <p>Haga clic en "Nueva Programación" para comenzar</p>
            </div>
        `;
        return;
    }

    let html = '';
    schedules.forEach(schedule => {
        const lastRun = schedule.lastRun ? new Date(schedule.lastRun).toLocaleString() : 'Nunca';
        const nextRun = schedule.nextRun ? new Date(schedule.nextRun).toLocaleString() : 'No programado';

        const statusIcon = schedule.enabled ? '🟢' : '🔴';
        const statusText = schedule.enabled ? 'Activo' : 'Detenido';

        // Información de tests
        let testsInfo = '';
        if (schedule.testFiles && schedule.testFiles.length > 0) {
            testsInfo = `<div><strong>Tests:</strong> ${schedule.testFiles.length} seleccionado(s)</div>`;
        } else if (schedule.testPattern) {
            testsInfo = `<div><strong>Patrón:</strong> ${schedule.testPattern}</div>`;
        } else {
            testsInfo = '<div><strong>Tests:</strong> Todos</div>';
        }

        html += `
            <div class="schedule-item" style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 10px 0; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 10px 0;">${statusIcon} ${schedule.name}</h4>
                        <div style="font-size: 12px; color: #666; line-height: 1.4;">
                            <div><strong>Programación:</strong> ${schedule.cronExpression}</div>
                            <div><strong>Estado:</strong> ${statusText}</div>
                            ${testsInfo}
                            <div><strong>Última ejecución:</strong> ${lastRun}</div>
                            <div><strong>Próxima ejecución:</strong> ${nextRun}</div>
                        </div>
                        ${schedule.testFiles && schedule.testFiles.length > 0 ? `
                            <div style="margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; font-size: 11px;">
                                <strong>Tests seleccionados:</strong><br>
                                ${schedule.testFiles.map(test => `• ${test.replace(process.env.ENVIROMENT !== 'pro' ? ".spec.ts" : ".spec.js", '')}`).join('<br>')}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 5px; margin-left: 15px;">
                        <button class="btn btn-sm" onclick="runScheduleNow('${schedule.id}')" style="font-size: 11px; padding: 4px 8px;">
                            ▶ Ejecutar
                        </button>
                        ${schedule.enabled ?
                `<button class="btn btn-sm btn-warning" onclick="stopSchedule('${schedule.id}')" style="font-size: 11px; padding: 4px 8px;">⏸ Pausar</button>` :
                `<button class="btn btn-sm btn-success" onclick="startSchedule('${schedule.id}')" style="font-size: 11px; padding: 4px 8px;">▶ Iniciar</button>`
            }
                        <button class="btn btn-sm btn-secondary" onclick="editSchedule('${schedule.id}')" style="font-size: 11px; padding: 4px 8px;">
                            ✏️ Editar
                        </button>
                        <button class="btn btn-sm" onclick="deleteSchedule('${schedule.id}')" style="font-size: 11px; padding: 4px 8px; background: #f44336; color: white;">
                            🗑️ Eliminar
                        </button>
                    </div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}
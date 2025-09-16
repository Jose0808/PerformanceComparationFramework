
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
    element.innerHTML = "";
    if (element && tests) {
        let checks = "";
        tests.forEach(test => {
            checks += `<label><input name="tests" type="checkbox" value="${test}" checked>${test.replace(".spec.ts", "")}</label>`;
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


//sheduler
// Variables globales del scheduler
let currentProfiles = [];
let schedulerStatus = null;
let editingProfileId = null;

// Inicializar cuando se carga la pestaña
async function initScheduler() {
    console.log('Inicializando Scheduler UI...');
    try {
        await refreshSchedulerStatus();
        await loadProfiles();
        await loadExecutionHistory();
        setupSchedulerEventListeners();

        // Auto-refresh cada 30 segundos
        setInterval(refreshSchedulerStatus, 30000);

        console.log('Scheduler UI inicializado correctamente');
    } catch (error) {
        console.error('Error inicializando scheduler:', error);
        showNotification('Error al inicializar el scheduler', 'error');
    }
}

// Event listeners
function setupSchedulerEventListeners() {
    // Botones principales
    document.getElementById('create-profile-btn')?.addEventListener('click', showCreateProfileModal);
    document.getElementById('pause-scheduler')?.addEventListener('click', pauseScheduler);
    document.getElementById('resume-scheduler')?.addEventListener('click', resumeScheduler);
    document.getElementById('refresh-status')?.addEventListener('click', refreshSchedulerStatus);
    document.getElementById('refresh-history')?.addEventListener('click', loadExecutionHistory);

    // Formulario
    // document.getElementById('profile-form')?.addEventListener('submit', saveProfile);
    // document.getElementById('submit-profile')?.addEventListener('click', saveProfile);
    document.getElementById('cancel-profile')?.addEventListener('click', hideProfileModal);

    // Modal close
    document.querySelector('#profile-modal .close')?.addEventListener('click', hideProfileModal);

    // Close modal clicking outside
    document.getElementById('profile-modal')?.addEventListener('click', (e) => {
        if (e.target.id === 'profile-modal') {
            hideProfileModal();
        }
    });

    // History days change
    document.getElementById('history-days')?.addEventListener('change', loadExecutionHistory);

    console.log('Event listeners configurados');
}

// API calls
async function refreshSchedulerStatus() {
    try {
        schedulerStatus = await ipcRenderer.invoke('scheduler:getStatus');
        updateStatusDisplay();
    } catch (error) {
        console.error('Error getting scheduler status:', error);
        showNotification('Error al obtener estado del scheduler', 'error');
    }
}

async function loadProfiles() {
    try {
        const result = await ipcRenderer.invoke('scheduler:getProfiles');
        currentProfiles = result.profiles || [];
        updateProfilesDisplay();
    } catch (error) {
        console.error('Error loading profiles:', error);
        showNotification('Error al cargar perfiles', 'error');
    }
}
async function chargeTests() {
    try {
        const result = await ipcRenderer.invoke('scheduler:getProfiles');
        currentProfiles = result.profiles || [];
        updateProfilesDisplay();
    } catch (error) {
        console.error('Error loading profiles:', error);
        showNotification('Error al cargar perfiles', 'error');
    }
}

async function loadExecutionHistory() {
    try {
        const days = document.getElementById('history-days')?.value || 7;
        const result = await ipcRenderer.invoke('scheduler:getHistory', parseInt(days));
        updateHistoryDisplay(result.executions || []);
    } catch (error) {
        console.error('Error loading history:', error);
        showNotification('Error al cargar historial', 'error');
    }
}

// Profile Management Functions
async function saveProfile() {
    // event.preventDefault();

    try {
        const formData = getProfileFormData();
        if (!validateProfileForm(formData)) {
            return;
        }

        const profile = {
            id: editingProfileId || generateProfileId(),
            name: formData.name,
            description: formData.description,
            schedule: {
                intervalMinutes: formData.intervalMinutes,
                startTime: formData.startTime,
                endTime: formData.endTime,
                daysOfWeek: formData.daysOfWeek
            },
            tests: formData.tests,
            enabled: true,
            createdAt: editingProfileId ? undefined : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        showLoading('Guardando perfil...');
        const result = await ipcRenderer.invoke('scheduler:createProfile', profile);
        hideLoading();

        if (result.success) {
            showNotification(`Perfil ${editingProfileId ? 'actualizado' : 'creado'} exitosamente`, 'success');
            hideProfileModal();
            await loadProfiles();
            await refreshSchedulerStatus();
        } else {
            showNotification(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error saving profile:', error);
        showNotification('Error al guardar el perfil', 'error');
    }
}

async function deleteProfile(profileId) {
    if (!confirm('¿Estás seguro de que quieres eliminar este perfil? Esta acción no se puede deshacer.')) {
        return;
    }

    try {
        showLoading('Eliminando perfil...');
        const result = await ipcRenderer.invoke('scheduler:deleteProfile', profileId);
        hideLoading();

        if (result.success) {
            showNotification('Perfil eliminado exitosamente', 'success');
            await loadProfiles();
            await refreshSchedulerStatus();
        } else {
            showNotification(`Error al eliminar: ${result.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error deleting profile:', error);
        showNotification('Error al eliminar el perfil', 'error');
    }
}

async function runProfileNow(profileId) {
    const profile = currentProfiles.find(p => p.id === profileId);
    if (!profile) {
        showNotification('Perfil no encontrado', 'error');
        return;
    }

    if (!confirm(`¿Ejecutar ahora el perfil "${profile.name}"?`)) {
        return;
    }

    try {
        showLoading('Ejecutando perfil...');
        const result = await ipcRenderer.invoke('scheduler:runNow', profileId);
        hideLoading();

        if (result.success) {
            showNotification('Perfil ejecutado exitosamente', 'success');
            setTimeout(() => loadExecutionHistory(), 2000); // Refresh history after 2s
        } else {
            showNotification(`Error en ejecución: ${result.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error running profile:', error);
        showNotification('Error al ejecutar el perfil', 'error');
    }
}

function editProfile(profileId) {
    const profile = currentProfiles.find(p => p.id === profileId);
    if (!profile) {
        showNotification('Perfil no encontrado', 'error');
        return;
    }

    editingProfileId = profileId;
    populateProfileForm(profile);
    showProfileModal('Editar Perfil');
}

// Scheduler Control Functions
async function pauseScheduler() {
    if (!confirm('¿Pausar todos los perfiles del scheduler?')) {
        return;
    }

    try {
        showLoading('Pausando scheduler...');
        const result = await ipcRenderer.invoke('scheduler:pauseAll');
        hideLoading();

        if (result.success) {
            showNotification('Scheduler pausado exitosamente', 'success');
            await refreshSchedulerStatus();
        } else {
            showNotification(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error pausing scheduler:', error);
        showNotification('Error al pausar el scheduler', 'error');
    }
}

async function resumeScheduler() {
    try {
        showLoading('Reanudando scheduler...');
        const result = await ipcRenderer.invoke('scheduler:resumeAll');
        hideLoading();

        if (result.success) {
            showNotification('Scheduler reanudado exitosamente', 'success');
            await refreshSchedulerStatus();
        } else {
            showNotification(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error resuming scheduler:', error);
        showNotification('Error al reanudar el scheduler', 'error');
    }
}

// UI Update Functions
function updateStatusDisplay() {
    const statusText = document.getElementById('status-text');
    const nextExecution = document.getElementById('next-execution');
    const lastExecution = document.getElementById('last-execution');
    if (!statusText) return;

    if (schedulerStatus?.isRunning) {
        statusText.textContent = 'Activo';
        statusText.className = 'status-active';

        // Update button states
        document.getElementById('pause-scheduler').disabled = false;
        document.getElementById('resume-scheduler').disabled = true;
    } else {
        statusText.textContent = 'Inactivo';
        statusText.className = 'status-inactive';

        // Update button states
        document.getElementById('pause-scheduler').disabled = true;
        document.getElementById('resume-scheduler').disabled = false;
    }
    if (nextExecution) {
        nextExecution.textContent = schedulerStatus?.nextExecution
            ? formatDateTime(schedulerStatus.nextExecution)
            : 'No programado';
    }

    if (lastExecution) {
        lastExecution.textContent = schedulerStatus?.lastExecution?.timestamp
            ? formatDateTime(schedulerStatus.lastExecution.timestamp)
            : 'Nunca ejecutado';
    }
}

function updateProfilesDisplay() {
    const container = document.getElementById('profiles-list');
    if (!container) return;

    container.innerHTML = '';

    if (currentProfiles.length === 0) {
        container.innerHTML = '<p class="no-profiles">No hay perfiles configurados. Crea tu primer perfil para comenzar.</p>';
        return;
    }

    currentProfiles.forEach(profile => {
        const div = document.createElement('div');
        div.className = `profile-item ${profile.enabled ? '' : 'disabled'}`;

        const daysText = getDaysText(profile.schedule.daysOfWeek);
        const testsText = profile.tests.join(', ');

        div.innerHTML = `
            <div class="profile-info">
                <h4>${escapeHtml(profile.name)} ${!profile.enabled ? '(Deshabilitado)' : ''}</h4>
                <p class="profile-description">${escapeHtml(profile.description || 'Sin descripción')}</p>
                <div class="profile-details">
                    <span class="detail-item">📅 ${daysText}</span>
                    <span class="detail-item">⏰ ${profile.schedule.startTime} - ${profile.schedule.endTime}</span>
                    <span class="detail-item">🔄 Cada ${profile.schedule.intervalMinutes} min</span>
                </div>
                <p class="profile-tests">🧪 Tests: ${escapeHtml(testsText)}</p>
            </div>
            <div class="profile-actions">
                <button onclick="runProfileNow('${profile.id}')" class="btn btn-success btn-sm" ${!profile.enabled ? 'disabled' : ''}>
                    ▶️ Ejecutar
                </button>
                <button onclick="editProfile('${profile.id}')" class="btn btn-secondary btn-sm">
                    ✏️ Editar
                </button>
                <button onclick="deleteProfile('${profile.id}')" class="btn btn-danger btn-sm">
                    🗑️ Eliminar
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function updateHistoryDisplay(executions) {
    const container = document.getElementById('execution-history');
    if (!container) return;

    container.innerHTML = '';

    if (executions.length === 0) {
        container.innerHTML = '<p class="no-history">No hay ejecuciones en el período seleccionado.</p>';
        return;
    }

    // Sort by timestamp descending
    const sortedExecutions = executions.sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    sortedExecutions.forEach(execution => {
        const div = document.createElement('div');
        div.className = `execution-item execution-${execution.status}`;

        const duration = execution.duration ? ` (${execution.duration}ms)` : '';
        const errorDetails = execution.error ? `<div class="error-details">❌ ${escapeHtml(execution.error)}</div>` : '';

        div.innerHTML = `
            <div class="execution-header">
                <span class="execution-profile">${escapeHtml(execution.profileName || execution.profileId)}</span>
                <span class="execution-time">${formatDateTime(execution.timestamp)}</span>
            </div>
            <div class="execution-details">
                <span class="execution-status">${getStatusIcon(execution.status)} ${getStatusText(execution.status)}</span>
                ${execution.testsRun ? `<span class="tests-info">🧪 ${execution.testsRun} tests${duration}</span>` : ''}
                ${errorDetails}
            </div>
        `;

        container.appendChild(div);
    });

    // Update history summary
    updateHistorySummary(sortedExecutions);
}

function updateHistorySummary(executions) {
    const summaryElement = document.getElementById('history-summary');
    if (!summaryElement || executions.length === 0) return;

    const total = executions.length;
    const successful = executions.filter(e => e.status === 'success').length;
    const failed = executions.filter(e => e.status === 'failed').length;
    const successRate = total > 0 ? Math.round((successful / total) * 100) : 0;

    summaryElement.innerHTML = `
        Total: ${total} | ✅ ${successful} | ❌ ${failed} | Éxito: ${successRate}%
    `;
    summaryElement.innerHTML += duration ? `<span>${duration}</span> ` : ''
    let div = `</div > ${errorDetails}            </div >    `;
    container.appendChild(div);
}


// Modal Functions
function showCreateProfileModal() {
    editingProfileId = null;
    clearProfileForm();
    showProfileModal('Crear Nuevo Perfil');
}

function showProfileModal(title) {
    document.querySelector('#profile-modal h3').textContent = title;
    document.getElementById('profile-modal').style.display = 'block';
    document.getElementById('profile-name').focus();
}

function hideProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
    editingProfileId = null;
    clearProfileForm();
}

// Form Functions
function getProfileFormData() {
    const daysCheckboxes = document.querySelectorAll('input[name="days"]:checked');
    const testsCheckboxes = document.querySelectorAll('input[name="tests"]:checked');

    return {
        name: document.getElementById('profile-name').value.trim(),
        description: document.getElementById('profile-description').value.trim(),
        intervalMinutes: parseInt(document.getElementById('interval-minutes').value),
        startTime: document.getElementById('start-time').value,
        endTime: document.getElementById('end-time').value,
        daysOfWeek: Array.from(daysCheckboxes).map(cb => parseInt(cb.value)),
        tests: Array.from(testsCheckboxes).map(cb => cb.value)
    };
}

function populateProfileForm(profile) {
    document.getElementById('profile-name').value = profile.name;
    document.getElementById('profile-description').value = profile.description || '';
    document.getElementById('interval-minutes').value = profile.schedule.intervalMinutes;
    document.getElementById('start-time').value = profile.schedule.startTime;
    document.getElementById('end-time').value = profile.schedule.endTime;

    // Clear all checkboxes first
    document.querySelectorAll('input[name="days"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="tests"]').forEach(cb => cb.checked = false);

    // Check selected days
    profile.schedule.daysOfWeek.forEach(day => {
        const checkbox = document.querySelector(`input[name = "days"][value = "${day}"]`);
        if (checkbox) checkbox.checked = true;
    });

    // Check selected tests
    profile.tests.forEach(test => {
        const checkbox = document.querySelector(`input[name = "tests"][value = "${test}"]`);
        if (checkbox) checkbox.checked = true;
    });
}

function clearProfileForm() {
    document.getElementById('profile-form').reset();
    // Set default values
    document.getElementById('interval-minutes').value = 15;
    document.getElementById('start-time').value = '08:00';
    document.getElementById('end-time').value = '18:00';

    // Check weekdays by default
    [1, 2, 3, 4, 5].forEach(day => {
        const checkbox = document.querySelector(`input[name = "days"][value = "${day}"]`);
        if (checkbox) checkbox.checked = true;
    });

    // Check default test
    const defaultTest = document.querySelector('input[name="tests"]');
    if (defaultTest) defaultTest.checked = true;
}

function validateProfileForm(formData) {
    const errors = [];

    if (!formData.name) {
        errors.push('El nombre del perfil es obligatorio');
    }

    if (formData.intervalMinutes < 5 || formData.intervalMinutes > 1440) {
        errors.push('El intervalo debe estar entre 5 y 1440 minutos');
    }

    if (formData.startTime >= formData.endTime) {
        errors.push('La hora de inicio debe ser menor que la hora de fin');
    }

    if (formData.daysOfWeek.length === 0) {
        errors.push('Debe seleccionar al menos un día de la semana');
    }

    if (formData.tests.length === 0) {
        errors.push('Debe seleccionar al menos un test para ejecutar');
    }

    // Check if profile name already exists (only for new profiles)
    if (!editingProfileId && currentProfiles.some(p => p.name === formData.name)) {
        errors.push('Ya existe un perfil con ese nombre');
    }

    if (errors.length > 0) {
        showNotification('Errores en el formulario:\n• ' + errors.join('\n• '), 'error');
        return false;
    }

    return true;
}

// Utility Functions
function generateProfileId() {
    return 'profile_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getDaysText(daysArray) {
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    if (daysArray.length === 7) return 'Todos los días';
    if (daysArray.length === 5 && daysArray.every(d => d >= 1 && d <= 5)) return 'Lun-Vie';
    if (daysArray.length === 2 && daysArray.includes(0) && daysArray.includes(6)) return 'Fines de semana';

    return daysArray.sort().map(day => dayNames[day]).join(', ');
}

function getStatusIcon(status) {
    switch (status) {
        case 'success': return '✅';
        case 'failed': return '❌';
        case 'partial': return '⚠️';
        case 'running': return '🔄';
        default: return '❓';
    }
}

function getStatusText(status) {
    switch (status) {
        case 'success': return 'Éxito';
        case 'failed': return 'Fallido';
        case 'partial': return 'Parcial';
        case 'running': return 'Ejecutando';
        default: return 'Desconocido';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notification and Loading Functions
function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification';
        notification.className = 'notification';
        document.body.appendChild(notification);
    }

    notification.className = `notification notification - ${type} show`;
    notification.textContent = message;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.className = 'notification';
    }, 5000);
}

function showLoading(message) {
    let loading = document.getElementById('loading');
    if (!loading) {
        loading = document.createElement('div');
        loading.id = 'loading';
        loading.className = 'loading-overlay';
        loading.innerHTML = '<div class="loading-content"><div class="spinner"></div><p></p></div>';
        document.body.appendChild(loading);
    }

    loading.querySelector('p').textContent = message;
    loading.style.display = 'flex';
}

function hideLoading() {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScheduler);
} else {
    initScheduler();
}

// Export functions for global access
window.schedulerUI = {
    initScheduler,
    refreshSchedulerStatus,
    loadProfiles,
    runProfileNow,
    editProfile,
    deleteProfile,
    pauseScheduler,
    resumeScheduler
};
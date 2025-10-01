import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { config } from 'process';
import { TestScheduler } from '../src/scheduler/TestScheduler';
import { CommandOptions, CommandResult, ProjectPaths } from './types';
import { executeCommand, getProjectPaths, runPlaywright } from './commands';
import { SchedulerClient } from '../src/scheduler/SchedulerClient';

app.disableHardwareAcceleration();


// Configurar switches para estabilidad
const stabilitySwitches = [
  { name: 'disable-gpu' },
  { name: 'disable-gpu-compositing' },
  { name: 'disable-gpu-rasterization' },
  { name: 'no-sandbox' },
  { name: 'disable-web-security' }
];

stabilitySwitches.forEach((switchConfig) => {
  if ((switchConfig as any).value) {
    app.commandLine.appendSwitch(switchConfig.name, (switchConfig as any).value);
  } else {
    app.commandLine.appendSwitch(switchConfig.name);
  }
});

let mainWindow: BrowserWindow | null = null;

function runNodeScript(scriptPath: string, args: string[] = []) {
  const nodeRuntime = process.execPath;
  return spawn(nodeRuntime, [scriptPath, ...args], {
    cwd: process.resourcesPath,
    stdio: "inherit",
    shell: false
  });
}

function createWindow(): void {

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    icon: path.join(process.resourcesPath, 'assets', 'icon.png'),
    title: 'Latency Test Runner',
    show: false,
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  const indexPath = app.isPackaged
    ? path.join(process.resourcesPath, 'renderer', 'index.html')
    : path.join(__dirname, 'renderer', 'index.html');

  mainWindow.loadFile(indexPath);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();

      // Inicializar rutas del proyecto
      const paths = getProjectPaths();
      mainWindow.webContents.send('project-paths-ready', paths);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (mainWindow) {
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ======================== IPC HANDLERS ========================

// Verificar estructura del proyecto
ipcMain.handle('check-project-structure', async (): Promise<any> => {
  const paths = getProjectPaths();
  const checks: any = {};
  debugger;
  const requiredItems = [
    // { key: 'package.json', path: paths.packageJson, type: 'file' },
    { key: 'playwright.config.ts', path: paths.configFile, type: 'file' },
    { key: 'src/tests', path: paths.testsDir, type: 'directory' },
    { key: 'src/data-driven', path: paths.dataDir, type: 'directory' },
    { key: '.env', path: paths.envFile, type: 'file' },
    { key: 'node_modules', path: paths.nodeModules, type: 'directory' }
  ];

  for (const item of requiredItems) {
    try {
      const exists = fs.existsSync(item.path);
      checks[item.key] = {
        exists,
        path: item.path,
        type: item.type
      };
      console.log(`${item.key}: ${exists ? 'EXISTS' : 'MISSING'} at ${item.path}`);
    } catch (error: any) {
      checks[item.key] = { exists: false, error: error.message };
    }
  }

  return { checks, paths };
});

// ======================== MANEJO DE ARCHIVOS DE DATA-DRIVEN ========================

// Listar archivos JSON en data-driven
ipcMain.handle('list-data-files', async (): Promise<any> => {
  const paths = getProjectPaths();

  try {
    if (!fs.existsSync(paths.dataDir)) {
      return { success: false, error: 'Directorio data-driven no encontrado' };
    }

    const files = fs.readdirSync(paths.dataDir)
      .filter(file => file.endsWith('.json'))
      .map(file => ({
        name: file,
        path: path.join(paths.dataDir, file),
        size: fs.statSync(path.join(paths.dataDir, file)).size
      }));

    return { success: true, files };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Leer archivo JSON específico
ipcMain.handle('read-data-file', async (event: any, filename: string): Promise<any> => {
  const paths = getProjectPaths();

  try {
    const filePath = path.join(paths.dataDir, filename);

    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Archivo no encontrado' };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(content);

    return {
      success: true,
      data: jsonData,
      filename,
      path: filePath
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Guardar archivo JSON
ipcMain.handle('save-data-file', async (event: any, filename: string, data: any): Promise<any> => {
  const paths = getProjectPaths();

  try {
    const filePath = path.join(paths.dataDir, filename);

    // Validar que es JSON válido
    const jsonString = JSON.stringify(data, null, 2);

    // Crear backup
    if (fs.existsSync(filePath)) {
      const backupPath = filePath + `.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
    }

    fs.writeFileSync(filePath, jsonString, 'utf8');

    return { success: true, message: 'Archivo guardado correctamente' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Crear nuevo archivo JSON
ipcMain.handle('create-data-file', async (event: any, filename: string, initialData: any = {}): Promise<any> => {
  const paths = getProjectPaths();

  try {
    const filePath = path.join(paths.dataDir, filename);

    if (fs.existsSync(filePath)) {
      return { success: false, error: 'El archivo ya existe' };
    }

    const jsonString = JSON.stringify(initialData, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');

    return { success: true, message: 'Archivo creado correctamente' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ======================== MANEJO DEL ARCHIVO .ENV ========================

// Leer archivo .env
ipcMain.handle('read-env-file', async (): Promise<any> => {
  const paths = getProjectPaths();

  try {
    if (!fs.existsSync(paths.envFile)) {
      return { success: false, error: 'Archivo .env no encontrado' };
    }

    const content = fs.readFileSync(paths.envFile, 'utf8');

    // Parsear las líneas del .env
    const envVars: any = {};
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key) {
          envVars[key.trim()] = valueParts.join('=').trim().replace(/['"]/g, '');
        }
      }
    });

    return {
      success: true,
      variables: envVars,
      rawContent: content,
      path: paths.envFile
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Guardar archivo .env
ipcMain.handle('save-env-file', async (event: any, envVariables: any): Promise<any> => {
  const paths = getProjectPaths();

  try {
    // Crear backup
    if (fs.existsSync(paths.envFile)) {
      const backupPath = paths.envFile + `.backup.${Date.now()}`;
      fs.copyFileSync(paths.envFile, backupPath);
    }

    // Generar contenido del .env
    let envContent = '# Variables de entorno para Playwright\n';
    envContent += '# Generado automáticamente\n\n';

    Object.entries(envVariables).forEach(([key, value]) => {
      envContent += `${key}=${value}\n`;
    });

    fs.writeFileSync(paths.envFile, envContent, 'utf8');

    return { success: true, message: 'Archivo .env guardado correctamente' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// ======================== EJECUCIÓN DE PLAYWRIGHT ========================

// Ejecutar tests con UI
ipcMain.handle('run-tests-ui', async (): Promise<any> => {
  return runPlaywright(['test', '--ui']);
});

// Ejecutar tests automáticamente
ipcMain.handle('run-tests', async (): Promise<any> => {
  if (mainWindow)
    return runPlaywright(['test'], { onData: 'test-output', mainWindow });
});

// Mostrar reporte
ipcMain.handle('show-report', async (): Promise<any> => {
  return runPlaywright(['show-report', 'reports/playwright-report']);
});

// ======================== UTILIDADES ========================

// Abrir carpeta del proyecto
ipcMain.handle('open-project-folder', async (): Promise<any> => {
  const paths = getProjectPaths();
  try {
    shell.openPath(paths.basePath);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Abrir carpeta de reportes
ipcMain.handle('open-reports-folder', async (): Promise<any> => {
  const paths = getProjectPaths();
  try {
    // Crear directorio de reportes si no existe
    if (!fs.existsSync(paths.reportsDir)) {
      fs.mkdirSync(paths.reportsDir, { recursive: true });
    }
    shell.openPath(paths.reportsDir);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Verificar que todo esté listo
ipcMain.handle('verify-installation', async (): Promise<any> => {
  const paths = getProjectPaths();
  const checks: any = {};

  try {
    // Verificar archivos críticos
    const result = await executeCommand('node', ['--version']);
    checks.nodeCheck = {}
    checks.nodeCheck.installed = result.success;
    checks.nodeCheck.version = result.success ? result.output.trim() : null;
    // checks.packageJson = fs.existsSync(paths.packageJson);
    checks.playwrightConfig = fs.existsSync(paths.configFile);
    checks.testsDirectory = fs.existsSync(paths.testsDir);
    checks.dataDirectory = fs.existsSync(paths.dataDir);
    checks.envFile = fs.existsSync(paths.envFile);
    checks.nodeModules = fs.existsSync(paths.nodeModules);

    // Verificar que playwright esté instalado
    const playwrightBin = path.join(paths.nodeModules, '.bin',
      process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
    checks.playwrightBinary = fs.existsSync(playwrightBin);

    // Verificar si browsers están instalados
    let browsersInstalled = false;
    if (checks.playwrightBinary) {
      const browserCheck = await executeCommand(playwrightBin, ['install', '--list']);
      browsersInstalled = browserCheck.success && browserCheck.output.includes('chromium');
    }
    checks.playwrightBrowsers = browsersInstalled;

    // Si no están, instalarlos automáticamente
    if (!browsersInstalled) {
      const browserInstall = await executeCommand(playwrightBin, ['install', '--with-deps']);
      checks.playwrightBrowsersInstalledNow = browserInstall.success;
    }

    // Contar archivos de test
    if (checks.testsDirectory) {
      const testFiles = fs.readdirSync(paths.testsDir)
        .filter(file => file.endsWith('.spec.ts'));
      checks.testFilesCount = testFiles.length;
      checks.testFiles = testFiles;
    }

    // Contar archivos de datos
    if (checks.dataDirectory) {
      const dataFiles = fs.readdirSync(paths.dataDir)
        .filter(file => file.endsWith('.json'));
      checks.dataFilesCount = dataFiles.length;
      checks.dataFiles = dataFiles;
    }

    const allReady = Object.values(checks).every(check =>
      typeof check === 'boolean' ? check : true
    );

    return {
      success: allReady,
      checks,
      paths: {
        basePath: paths.basePath,
        testsDir: paths.testsDir,
        dataDir: paths.dataDir
      }
    };

  } catch (error: any) {
    return { success: false, error: error.message, checks };
  }
});

// ======================== FUNCIONES AUXILIARES PARA DATA-DRIVEN ========================

// Obtener lista de archivos .spec.ts para vincular con datos
ipcMain.handle('list-test-files', async (): Promise<any> => {
  const paths = getProjectPaths();

  try {
    if (!fs.existsSync(paths.testsDir)) {
      return { success: false, error: 'Directorio de tests no encontrado' };
    }

    const testFiles: any[] = [];

    function scanDirectory(dir: string, relativePath: string = '') {
      const items = fs.readdirSync(dir);

      items.forEach(item => {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          scanDirectory(fullPath, path.join(relativePath, item));
        } else if (item.endsWith('.spec.ts')) {
          testFiles.push({
            name: item,
            relativePath: path.join(relativePath, item),
            fullPath: fullPath,
            size: stat.size,
            modified: stat.mtime
          });
        }
      });
    }

    scanDirectory(paths.testsDir);

    return { success: true, testFiles };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Leer contenido de un archivo de test para mostrar qué datos usa
ipcMain.handle('analyze-test-file', async (event: any, testFilePath: string): Promise<any> => {
  try {
    const content = fs.readFileSync(testFilePath, 'utf8');

    // Buscar referencias a archivos JSON (patrones comunes)
    const jsonReferences: any[] = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Buscar imports o requires de JSON
      const jsonMatches = line.match(/(?:import|require).*?['"`]([^'"`]*\.json)['"`]/g);
      if (jsonMatches) {
        jsonMatches.forEach(match => {
          const jsonFile = match.match(/['"`]([^'"`]*\.json)['"`]/)![1];
          jsonReferences.push({
            file: jsonFile,
            line: index + 1,
            context: line.trim()
          });
        });
      }
    });

    return {
      success: true,
      jsonReferences,
      fileName: path.basename(testFilePath)
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});



//======================== PROGRAMADOR ====================================
let schedulerClient: SchedulerClient | null = null;

// Inicializar cliente del scheduler
ipcMain.handle('scheduler-init', async (): Promise<any> => {
  const paths = getProjectPaths();
  
  try {
    if (!schedulerClient) {
      schedulerClient = new SchedulerClient({
        projectPath: paths.basePath,
        servicePort: 3001,
        serviceHost: '127.0.0.1'
      });

      // Configurar eventos del cliente
      schedulerClient.on('connected', () => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-connected');
        }
      });

      schedulerClient.on('disconnected', () => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-disconnected');
        }
      });

      schedulerClient.on('test-run-started', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-test-run-started', data);
        }
      });

      schedulerClient.on('test-run-completed', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-test-run-completed', data);
        }
      });

      schedulerClient.on('test-output', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-test-output', data);
        }
      });

      schedulerClient.on('status-update', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-status-update', data);
        }
      });

      schedulerClient.on('schedules-update', (data) => {
        if (mainWindow) {
          mainWindow.webContents.send('scheduler-schedules-update', data);
        }
      });
    }

    await schedulerClient.connect();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Obtener estado del scheduler
ipcMain.handle('scheduler-get-status', async (): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const status = await schedulerClient.getStatus();
    return { success: true, status };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Obtener schedules
ipcMain.handle('scheduler-get-schedules', async (): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const schedules = await schedulerClient.getSchedules();
    return { success: true, schedules };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Crear schedule
ipcMain.handle('scheduler-create-schedule', async (event: any, scheduleData: any): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const result = await schedulerClient.createSchedule(scheduleData);
    return { success: true, schedule: result.schedule };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Actualizar schedule
ipcMain.handle('scheduler-update-schedule', async (event: any, scheduleId: string, updates: any): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const result = await schedulerClient.updateSchedule(scheduleId, updates);
    return { success: true, schedule: result.schedule };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Eliminar schedule
ipcMain.handle('scheduler-delete-schedule', async (event: any, scheduleId: string): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    await schedulerClient.deleteSchedule(scheduleId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Ejecutar schedule ahora
ipcMain.handle('scheduler-run-now', async (event: any, scheduleId: string): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const result = await schedulerClient.runScheduleNow(scheduleId);
    return { success: result.success };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Iniciar schedule
ipcMain.handle('scheduler-start', async (event: any, scheduleId: string): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const result = await schedulerClient.startSchedule(scheduleId);
    return { success: result.success };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Detener schedule
ipcMain.handle('scheduler-stop', async (event: any, scheduleId: string): Promise<any> => {
  if (!schedulerClient) {
    return { success: false, error: 'Scheduler not initialized' };
  }

  try {
    const result = await schedulerClient.stopSchedule(scheduleId);
    return { success: result.success };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Obtener patrones cron comunes
ipcMain.handle('scheduler-get-cron-patterns', (): any => {
  return { 
    success: true, 
    patterns: [
      { label: 'Cada 5 minutos', value: '*/5 * * * *', description: 'Ejecutar cada 5 minutos' },
      { label: 'Cada 15 minutos', value: '*/15 * * * *', description: 'Ejecutar cada 15 minutos' },
      { label: 'Cada 30 minutos', value: '*/30 * * * *', description: 'Ejecutar cada 30 minutos' },
      { label: 'Cada hora', value: '0 * * * *', description: 'Ejecutar al inicio de cada hora' },
      { label: 'Cada 2 horas', value: '0 */2 * * *', description: 'Ejecutar cada 2 horas' },
      { label: 'Cada 6 horas', value: '0 */6 * * *', description: 'Ejecutar cada 6 horas' },
      { label: 'Diario a medianoche', value: '0 0 * * *', description: 'Ejecutar diariamente a las 00:00' },
      { label: 'Diario a las 9 AM', value: '0 9 * * *', description: 'Ejecutar diariamente a las 09:00' },
      { label: 'Diario a las 6 PM', value: '0 18 * * *', description: 'Ejecutar diariamente a las 18:00' },
      { label: 'Lunes a Viernes 9 AM', value: '0 9 * * 1-5', description: 'Ejecutar de lunes a viernes a las 09:00' },
      { label: 'Fines de semana', value: '0 10 * * 6,0', description: 'Ejecutar sábados y domingos a las 10:00' },
      { label: 'Semanal (Lunes)', value: '0 9 * * 1', description: 'Ejecutar todos los lunes a las 09:00' },
      { label: 'Mensual (día 1)', value: '0 9 1 * *', description: 'Ejecutar el día 1 de cada mes a las 09:00' }
    ]
  };
});

// Cleanup al cerrar la aplicación
// app.on('before-quit', async () => {
//   if (schedulerClient) {
//     await schedulerClient.stopService();
//     schedulerClient.disconnect();
//   }
// });
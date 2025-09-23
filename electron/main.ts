import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { config } from 'process';

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

// Interfaces para tipado
interface ProjectPaths {
  basePath: string;
  testsDir: string;
  dataDir: string;
  envFile: string;
  configFile: string;
  nodeModules: string;
  packageJson: string;
  reportsDir: string;
}

interface CommandResult {
  success: boolean;
  output: string;
  code?: number;
  error?: string;
}

interface CommandOptions {
  stdio?: any;
  onData?: string;
  timeout?: number;
  cwd?: string;
  detached?: boolean;
}

// Función para obtener la ruta base correcta según el entorno
function getBasePath(): string {
  console.log(app.isPackaged);
  if (app.isPackaged) {
    console.log(path.join(path.dirname(process.execPath), 'resources'));
    return path.join(path.dirname(process.execPath), 'resources');
  } else {
    console.log(path.join(__dirname, '..'));
    return path.join(__dirname, '..');
  }
}

// Función para obtener rutas de archivos críticos
function getProjectPaths(): ProjectPaths {
  const basePath = getBasePath();
  console.log("BasePath: ", basePath);

  return {
    basePath,
    testsDir: path.join(basePath, 'src', 'tests'),
    dataDir: path.join(basePath, 'src', 'data-driven'),
    envFile: path.join(basePath, '.env'),
    configFile: path.join(basePath, 'playwright.config.ts'),
    nodeModules: path.join(basePath, 'node_modules'),
    packageJson: path.join(basePath, 'package.json'),
    reportsDir: path.join(basePath, 'reports')
  };
}

function runNodeScript(scriptPath: string, args: string[] = []) {
  const nodeRuntime = process.execPath; 
  return spawn(nodeRuntime, [scriptPath, ...args], {
    cwd: process.resourcesPath,
    stdio: "inherit",
    shell: false
  });
}


// Función ejecutar comandos
function executeCommand(command: string, args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const paths = getProjectPaths();

    let finalCommand = command;
    let finalArgs = args;

    // En Windows, usar las versiones .cmd
    if (isWindows) {
      if (command === 'npx') {
        finalCommand = path.join(paths.nodeModules, '.bin', 'playwright.cmd');
        if (finalArgs[0] === 'playwright') {
          finalArgs = finalArgs.slice(1);
        }
      } else if (command === 'npm') {
        finalCommand = 'npm.cmd';
      }
    } else {
      if (command === 'npx') {
        finalCommand = path.join(paths.nodeModules, '.bin', 'playwright');
        if (finalArgs[0] === 'playwright') {
          finalArgs = finalArgs.slice(1);
        }
      }
    }

    console.log(`Ejecutando: ${finalCommand} ${finalArgs.join(' ')}`);
    console.log(`Directorio de trabajo: ${paths.basePath}`);

    const childProcess = spawn(finalCommand, finalArgs, {
      cwd: paths.basePath,
      stdio: options.stdio || 'pipe',
      shell: isWindows,
      env: {
        ...process.env,
        PATH: process.env.PATH,
        PLAYWRIGHT_CONFIG: paths.configFile,
        NODE_PATH: paths.nodeModules
      },
      ...options
    } as any);

    let output = '';
    let errorOutput = '';

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        output += dataStr;
        if (options.onData && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(options.onData, dataStr);
        }
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        const dataStr = data.toString();
        errorOutput += dataStr;
        if (options.onData && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(options.onData, dataStr);
        }
      });
    }

    childProcess.on('close', (code: number) => {
      resolve({
        success: code === 0,
        output: output + errorOutput,
        code
      });
    });

    childProcess.on('error', (error: Error) => {
      console.error('Error ejecutando comando:', error);
      resolve({
        success: false,
        output: error.message,
        error: error.message
      });
    });

    if (options.timeout) {
      setTimeout(() => {
        if (!childProcess.killed) {
          childProcess.kill();
          resolve({
            success: false,
            output: 'Timeout ejecutando comando',
            code: -1
          });
        }
      }, options.timeout);
    }
  });
}

async function runPlaywright(args: string[], options: CommandOptions = {}): Promise<CommandResult> {
  const paths = getProjectPaths();
  console.log(paths);
  const playwrightBin = path.join(
    paths.nodeModules,
    '.bin',
    process.platform === 'win32' ? 'playwright.cmd' : 'playwright'
  );
  console.log(playwrightBin);

  return executeCommand(playwrightBin, args, { cwd: paths.basePath, ...options });
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
  return runPlaywright(['test', '--ui'], { detached: true });
});

// Ejecutar tests automáticamente
ipcMain.handle('run-tests', async (): Promise<any> => {
  return runPlaywright(['test'], { onData: 'test-output' });
});

// Mostrar reporte
ipcMain.handle('show-report', async (): Promise<any> => {
  return runPlaywright(['show-report', 'reports/playwright-report'], { detached: true });
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

// ======================== NUEVO: FUNCIONES PARA EJECUTAR COMANDOS SIN DEPENDENCIAS ========================

// ======================== NUEVO: PLANIFICADOR ========================

// Funciones auxiliares para el scheduler
async function saveProfile(profile: any): Promise<any> {
  const profilesFile = path.join(__dirname, 'data', 'scheduler-profiles.json');
  let profiles: any = { profiles: [] };

  if (fs.existsSync(profilesFile)) {
    profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'));
  }

  const existingIndex = profiles.profiles.findIndex((p: any) => p.id === profile.id);
  if (existingIndex >= 0) {
    profiles.profiles[existingIndex] = profile;
  } else {
    profiles.profiles.push(profile);
  }

  // fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
  await fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2), 'utf8');
  return { success: true };
}

async function deleteProfile(profileId: string): Promise<void> {
  const profilesFile = path.join(__dirname, 'data', 'scheduler-profiles.json');
  if (fs.existsSync(profilesFile)) {
    const profiles = JSON.parse(fs.readFileSync(profilesFile, 'utf-8'));
    profiles.profiles = profiles.profiles.filter((p: any) => p.id !== profileId);
    fs.writeFileSync(profilesFile, JSON.stringify(profiles, null, 2));
  }
}

async function getProfiles(): Promise<any> {
  const profilesFile = path.join(__dirname, 'data', 'scheduler-profiles.json');
  if (fs.existsSync(profilesFile)) {
    return JSON.parse(fs.readFileSync(profilesFile, 'utf-8'));
  }
  return { profiles: [] };
}

async function getExecutionHistory(days: number): Promise<any> {
  const historyDir = path.join(__dirname, 'data', 'history');
  const history: any = { executions: [] };

  if (!fs.existsSync(historyDir)) return history;

  const files = fs.readdirSync(historyDir)
    .filter(f => f.startsWith('execution-history-') && f.endsWith('.json'))
    .sort()
    .slice(-3); // Últimos 3 meses

  for (const file of files) {
    const fileData = JSON.parse(fs.readFileSync(path.join(historyDir, file), 'utf-8'));
    history.executions.push(...fileData.executions);
  }

  // Filtrar por días
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  history.executions = history.executions.filter((e: any) =>
    new Date(e.timestamp) >= cutoffDate
  );

  return history;
}
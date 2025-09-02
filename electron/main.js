// main.js - VERSIÓN COMPLETA AUTOCONTENIDA
const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

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
  if (switchConfig.value) {
    app.commandLine.appendSwitch(switchConfig.name, switchConfig.value);
  } else {
    app.commandLine.appendSwitch(switchConfig.name);
  }
});

let mainWindow;

// Función para obtener la ruta base correcta según el entorno
function getBasePath() {
  if (app.isPackaged) {
    // En producción: usar el directorio donde está el ejecutable
    return path.join(path.dirname(process.execPath), 'resources');
  } else {
    // En desarrollo: usar el directorio actual del proyecto
    return process.cwd();
  }
}

// Función para obtener rutas de archivos críticos
function getProjectPaths() {
  const basePath = getBasePath();

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

// Función ejecutar comandos con manejo de rutas corregido
function executeCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const paths = getProjectPaths();

    let finalCommand = command;
    let finalArgs = args;

    // En Windows, usar las versiones .cmd
    if (isWindows) {
      if (command === 'npx') {
        finalCommand = path.join(paths.nodeModules, '.bin', 'playwright.cmd');
        // Remover 'playwright' del principio de args si está presente
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
    });

    let output = '';
    let errorOutput = '';

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
        if (options.onData && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(options.onData, dataStr);
        }
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        errorOutput += dataStr;
        if (options.onData && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(options.onData, dataStr);
        }
      });
    }

    childProcess.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output + errorOutput,
        code
      });
    });

    childProcess.on('error', (error) => {
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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    title: 'Playwright Test Runner - Editor de Datos',
    show: false,
    resizable: true,
    minimizable: true,
    maximizable: true
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Inicializar rutas del proyecto
    const paths = getProjectPaths();
    mainWindow.webContents.send('project-paths-ready', paths);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
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

// Verificar estructura del proyecto (MEJORADO)
ipcMain.handle('check-project-structure', async () => {
  const paths = getProjectPaths();
  const checks = {};

  const requiredItems = [
    { key: 'package.json', path: paths.packageJson, type: 'file' },
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
    } catch (error) {
      checks[item.key] = { exists: false, error: error.message };
    }
  }

  return { checks, paths };
});

// ======================== MANEJO DE ARCHIVOS DE DATA-DRIVEN ========================

// Listar archivos JSON en data-driven
ipcMain.handle('list-data-files', async () => {
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Leer archivo JSON específico
ipcMain.handle('read-data-file', async (event, filename) => {
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Guardar archivo JSON
ipcMain.handle('save-data-file', async (event, filename, data) => {
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Crear nuevo archivo JSON
ipcMain.handle('create-data-file', async (event, filename, initialData = {}) => {
  const paths = getProjectPaths();

  try {
    const filePath = path.join(paths.dataDir, filename);

    if (fs.existsSync(filePath)) {
      return { success: false, error: 'El archivo ya existe' };
    }

    const jsonString = JSON.stringify(initialData, null, 2);
    fs.writeFileSync(filePath, jsonString, 'utf8');

    return { success: true, message: 'Archivo creado correctamente' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ======================== MANEJO DEL ARCHIVO .ENV ========================

// Leer archivo .env
ipcMain.handle('read-env-file', async () => {
  const paths = getProjectPaths();

  try {
    if (!fs.existsSync(paths.envFile)) {
      return { success: false, error: 'Archivo .env no encontrado' };
    }

    const content = fs.readFileSync(paths.envFile, 'utf8');

    // Parsear las líneas del .env
    const envVars = {};
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Guardar archivo .env
ipcMain.handle('save-env-file', async (event, envVariables) => {
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ======================== EJECUCIÓN DE PLAYWRIGHT ========================

// Ejecutar tests con UI
ipcMain.handle('run-tests-ui', async () => {
  const paths = getProjectPaths();

  try {
    // Verificar que playwright esté instalado
    const playwrightBin = path.join(paths.nodeModules, '.bin',
      process.platform === 'win32' ? 'playwright.cmd' : 'playwright');

    if (!fs.existsSync(playwrightBin)) {
      return {
        success: false,
        error: 'Playwright no está instalado. Verifique las dependencias.'
      };
    }

    const result = await executeCommand('npx', ['playwright', 'test', '--ui'], {
      cwd: paths.basePath,
      stdio: 'inherit',
      detached: true,
      timeout: 10000
    });

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Ejecutar tests automáticamente
ipcMain.handle('run-tests', async () => {
  const paths = getProjectPaths();

  try {
    const result = await executeCommand('npx', ['playwright', 'test'], {
      cwd: paths.basePath,
      onData: 'test-output'      
    });

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Mostrar reporte
ipcMain.handle('show-report', async () => {
  const paths = getProjectPaths();

  try {
    const result = await executeCommand('npx', ['playwright', 'show-report'], {
      cwd: paths.basePath,
      stdio: 'inherit',
      detached: true
    });

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ======================== UTILIDADES ========================

// Abrir carpeta del proyecto
ipcMain.handle('open-project-folder', async () => {
  const paths = getProjectPaths();
  try {
    shell.openPath(paths.basePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Abrir carpeta de reportes
ipcMain.handle('open-reports-folder', async () => {
  const paths = getProjectPaths();
  try {
    // Crear directorio de reportes si no existe
    if (!fs.existsSync(paths.reportsDir)) {
      fs.mkdirSync(paths.reportsDir, { recursive: true });
    }
    shell.openPath(paths.reportsDir);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Verificar que todo esté listo
ipcMain.handle('verify-installation', async () => {
  const paths = getProjectPaths();
  const checks = {};

  try {
    // Verificar archivos críticos
    checks.packageJson = fs.existsSync(paths.packageJson);
    checks.playwrightConfig = fs.existsSync(paths.configFile);
    checks.testsDirectory = fs.existsSync(paths.testsDir);
    checks.dataDirectory = fs.existsSync(paths.dataDir);
    checks.envFile = fs.existsSync(paths.envFile);
    checks.nodeModules = fs.existsSync(paths.nodeModules);

    // Verificar que playwright esté instalado
    const playwrightBin = path.join(paths.nodeModules, '.bin',
      process.platform === 'win32' ? 'playwright.cmd' : 'playwright');
    checks.playwrightBinary = fs.existsSync(playwrightBin);

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

  } catch (error) {
    return { success: false, error: error.message, checks };
  }
});

// ======================== FUNCIONES AUXILIARES PARA DATA-DRIVEN ========================

// Obtener lista de archivos .spec.ts para vincular con datos
ipcMain.handle('list-test-files', async () => {
  const paths = getProjectPaths();

  try {
    if (!fs.existsSync(paths.testsDir)) {
      return { success: false, error: 'Directorio de tests no encontrado' };
    }

    const testFiles = [];

    function scanDirectory(dir, relativePath = '') {
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC Handlers - VERSIÓN SIMPLIFICADA Y SEGURA
ipcMain.handle('check-node', async () => {
  try {
    const result = await executeCommand('node', ['--version']);
    return {
      installed: result.success,
      version: result.success ? result.output.trim() : null
    };
  } catch (error) {
    return {
      installed: false,
      version: null,
      error: error.message
    };
  }
});

// Leer contenido de un archivo de test para mostrar qué datos usa
ipcMain.handle('analyze-test-file', async (event, testFilePath) => {
  try {
    const content = fs.readFileSync(testFilePath, 'utf8');

    // Buscar referencias a archivos JSON (patrones comunes)
    const jsonReferences = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      // Buscar imports o requires de JSON
      const jsonMatches = line.match(/(?:import|require).*?['"`]([^'"`]*\.json)['"`]/g);
      if (jsonMatches) {
        jsonMatches.forEach(match => {
          const jsonFile = match.match(/['"`]([^'"`]*\.json)['"`]/)[1];
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
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ======================== NUEVO: FUNCIONES PARA EJECUTAR COMANDOS SIN DEPENDENCIAS ========================

// Función mejorada para ejecutar comandos
function executeCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const paths = getProjectPaths();

    let finalCommand = command;
    let finalArgs = args;

    // Manejar comandos de Playwright directamente desde node_modules
    if (command === 'npx' && args[0] === 'playwright') {
      const playwrightBin = isWindows
        ? path.join(paths.nodeModules, '.bin', 'playwright.cmd')
        : path.join(paths.nodeModules, '.bin', 'playwright');

      finalCommand = playwrightBin;
      finalArgs = args.slice(1); // Remover 'playwright' de los argumentos
    }

    console.log(`Ejecutando: ${finalCommand} ${finalArgs.join(' ')}`);
    console.log(`Directorio: ${paths.basePath}`);

    const childProcess = spawn(finalCommand, finalArgs, {
      cwd: paths.basePath,
      stdio: options.stdio || 'pipe',
      shell: isWindows,
      env: {
        ...process.env,
        PATH: `${path.join(paths.nodeModules, '.bin')}${path.delimiter}${process.env.PATH}`,
        PLAYWRIGHT_CONFIG: paths.configFile
      },
      ...options
    });

    let output = '';
    let errorOutput = '';

    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
        if (options.onData && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(options.onData, dataStr);
        }
      });
    }

    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        errorOutput += dataStr;
        if (options.onData && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(options.onData, dataStr);
        }
      });
    }

    childProcess.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output + errorOutput,
        code
      });
    });

    childProcess.on('error', (error) => {
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
import { BrowserWindow } from "electron";

// Interfaces para tipado
export interface ProjectPaths {
  basePath: string;
  testsDir: string;
  dataDir: string;
  envFile: string;
  configFile: string;
  nodeModules: string;
  packageJson: string;
  reportsDir: string;
}

export interface CommandResult {
  success: boolean;
  output: string;
  code?: number;
  error?: string;
}

export interface CommandOptions {
  stdio?: any;
  onData?: string;
  timeout?: number;
  cwd?: string;
  detached?: boolean;
  mainWindow?: BrowserWindow;
}
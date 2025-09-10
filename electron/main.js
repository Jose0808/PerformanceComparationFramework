// electron/main.js - ARCHIVO LOADER
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    target: 'ES2018',
    module: 'CommonJS',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
});

// Cargar el archivo TypeScript principal
require('./main.ts');
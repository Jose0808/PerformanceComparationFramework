// src/scripts/copy-assets.js
const fs = require("fs-extra");
const path = require("path");

function copyAssets() {
  const source = path.resolve(__dirname, "../../electron/renderer");
  const destination = path.resolve(__dirname, "../../dist/electron/renderer");

  fs.copySync(source, destination, { overwrite: true });
  console.log("✅ Assets copiados a dist/electron/renderer");



  // Copiar solo archivos .js de src → dist/src
  const source2 = path.resolve(__dirname, "../../src");
  const destination2 = path.resolve(__dirname, "../../dist/src");

  fs.copySync(source2, destination2, {
    overwrite: true,
    filter: (src) => {
      // Permite carpetas y solo archivos .js
      return fs.statSync(src).isDirectory() || src.endsWith(".js");
    },
  });

  console.log("✅ Archivos .js copiados a dist/src");
}

copyAssets();

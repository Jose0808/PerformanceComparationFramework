// src/scripts/copy-assets.js
const fs = require("fs-extra");
const path = require("path");

function copyAssets() {
  const source = path.resolve(__dirname, "../../electron/renderer");
  const destination = path.resolve(__dirname, "../../dist/electron/renderer");

  fs.copySync(source, destination, { overwrite: true });
  console.log("✅ Assets copiados a dist/electron/renderer");
}

copyAssets();

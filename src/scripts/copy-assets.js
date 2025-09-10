const fs = require("fs");
const path = require("path");

function copyRecursive(src, dest, exts = []) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  for (const item of fs.readdirSync(src)) {
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
      copyRecursive(srcPath, destPath, exts);
    } else if (exts.length === 0 || exts.some(ext => srcPath.endsWith(ext))) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyRecursive("electron/renderer", "dist/electron/renderer", [".html", ".css", ".js"]);
fs.copyFileSync(".env", "dist/.env");
console.log("✅ Assets copiados a dist/");

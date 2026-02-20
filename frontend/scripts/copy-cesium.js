const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "cesium", "Build", "Cesium");
const dest = path.join(__dirname, "..", "public", "cesium");

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(src)) {
  console.log("cesium Build not found, skipping copy");
  process.exit(0);
}

const dirs = ["Assets", "Widgets", "Workers", "ThirdParty"];
for (const dir of dirs) {
  const from = path.join(src, dir);
  const to = path.join(dest, dir);
  if (fs.existsSync(from)) {
    copyDir(from, to);
    console.log(`copied cesium/${dir}`);
  }
}

console.log("cesium static assets ready");

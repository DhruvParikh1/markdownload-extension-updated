const fs = require("fs");
const path = require("path");

const SRC_DIR = path.resolve(__dirname, "..");
const BUILD_ROOT = path.join(SRC_DIR, ".build");
const CHROME_DIR = path.join(BUILD_ROOT, "chrome");
const FIREFOX_DIR = path.join(BUILD_ROOT, "firefox");

const EXCLUDED_NAMES = new Set([
  "node_modules",
  "tests",
  "web-ext-artifacts",
  ".build",
  ".gitignore",
  "package.json",
  "package-lock.json",
  "jest.config.js",
  "playwright.config.js",
  "scripts"
]);

function copyDirectory(sourceDir, targetDir) {
  fs.mkdirSync(targetDir, { recursive: true });
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (EXCLUDED_NAMES.has(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

function writeManifest(targetDir, manifest) {
  const manifestPath = path.join(targetDir, "manifest.json");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function main() {
  const sourceManifestPath = path.join(SRC_DIR, "manifest.json");
  const sourceManifest = JSON.parse(fs.readFileSync(sourceManifestPath, "utf8"));

  fs.rmSync(BUILD_ROOT, { recursive: true, force: true });

  copyDirectory(SRC_DIR, CHROME_DIR);
  copyDirectory(SRC_DIR, FIREFOX_DIR);

  const chromeManifest = JSON.parse(JSON.stringify(sourceManifest));
  chromeManifest.background = { service_worker: "service-worker.js" };
  delete chromeManifest.browser_specific_settings;

  const firefoxManifest = JSON.parse(JSON.stringify(sourceManifest));
  firefoxManifest.background = {
    scripts: [
      "browser-polyfill.min.js",
      "background/moment.min.js",
      "shared/default-options.js",
      "shared/context-menus.js",
      "service-worker.js"
    ]
  };
  // Remove Chrome-only permissions
  firefoxManifest.permissions = firefoxManifest.permissions.filter(
    p => p !== 'offscreen'
  );

  writeManifest(CHROME_DIR, chromeManifest);
  writeManifest(FIREFOX_DIR, firefoxManifest);

  console.log("Generated browser manifests:");
  console.log(`- Chrome:  ${path.relative(SRC_DIR, path.join(CHROME_DIR, "manifest.json"))}`);
  console.log(`- Firefox: ${path.relative(SRC_DIR, path.join(FIREFOX_DIR, "manifest.json"))}`);
}

main();

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..');
const ROOT_DIR = path.resolve(SRC_DIR, '..');
const MANIFEST_PATH = path.join(SRC_DIR, 'manifest.json');
const CHANGELOG_PATH = path.join(ROOT_DIR, 'CHANGELOG.md');
const OUTPUT_PATH = path.join(SRC_DIR, 'shared', 'release-highlights.json');
const USER_HIGHLIGHTS_HEADING = 'user highlights';

function normalizeBulletText(line) {
  return line
    .replace(/^\s*-\s+/, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractReleaseSections(changelogText) {
  const lines = changelogText.split(/\r?\n/);
  const versions = {};
  let currentVersion = null;
  let topLevelBullets = [];
  let userHighlights = [];
  let currentSubheading = null;

  function commitCurrentVersion() {
    if (!currentVersion) {
      return;
    }

    versions[currentVersion] = userHighlights.length > 0 ? userHighlights : topLevelBullets;
  }

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(\d+\.\d+\.\d+)\s*$/);
    if (headingMatch) {
      commitCurrentVersion();
      currentVersion = headingMatch[1];
      topLevelBullets = [];
      userHighlights = [];
      currentSubheading = null;
      continue;
    }

    if (!currentVersion) {
      continue;
    }

    const subheadingMatch = line.match(/^###\s+(.+?)\s*$/);
    if (subheadingMatch) {
      currentSubheading = subheadingMatch[1].trim().toLowerCase();
      continue;
    }

    if (/^\s*-\s+/.test(line)) {
      const normalizedBullet = normalizeBulletText(line);
      if (normalizedBullet) {
        if (currentSubheading === USER_HIGHLIGHTS_HEADING) {
          userHighlights.push(normalizedBullet);
        } else if (currentSubheading === null) {
          topLevelBullets.push(normalizedBullet);
        }
      }
    }
  }

  commitCurrentVersion();

  return versions;
}

function buildReleaseHighlightsAsset(changelogText, manifestVersion, maxHighlights = 5) {
  const versions = extractReleaseSections(changelogText);
  const currentHighlights = versions[manifestVersion];

  if (!Array.isArray(currentHighlights) || currentHighlights.length === 0) {
    throw new Error(`CHANGELOG.md is missing release highlights for manifest version ${manifestVersion}`);
  }

  const normalizedVersions = {};
  for (const [version, highlights] of Object.entries(versions)) {
    if (!Array.isArray(highlights) || highlights.length === 0) {
      continue;
    }
    normalizedVersions[version] = highlights.slice(0, maxHighlights);
  }

  return {
    generatedAt: new Date().toISOString(),
    source: 'CHANGELOG.md',
    versions: normalizedVersions
  };
}

function generateReleaseHighlights(options = {}) {
  const manifestPath = options.manifestPath || MANIFEST_PATH;
  const changelogPath = options.changelogPath || CHANGELOG_PATH;
  const outputPath = options.outputPath || OUTPUT_PATH;

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const changelog = fs.readFileSync(changelogPath, 'utf8');
  const asset = buildReleaseHighlightsAsset(changelog, manifest.version);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(asset, null, 2)}\n`, 'utf8');

  return asset;
}

if (require.main === module) {
  try {
    const asset = generateReleaseHighlights();
    console.log(
      `Generated release highlights for ${Object.keys(asset.versions).length} version(s): ${path.relative(SRC_DIR, OUTPUT_PATH)}`
    );
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  buildReleaseHighlightsAsset,
  extractReleaseSections,
  generateReleaseHighlights,
  normalizeBulletText
};

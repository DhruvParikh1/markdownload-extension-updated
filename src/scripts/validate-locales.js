const fs = require('fs');
const path = require('path');

const SRC_ROOT = path.resolve(__dirname, '..');
const LOCALES_ROOT = path.join(SRC_ROOT, '_locales');
const BUILD_ROOT = path.join(SRC_ROOT, '.build');
const REQUIRED_LOCALES = ['en', 'hi'];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function getLocaleFile(locale) {
  return path.join(LOCALES_ROOT, locale, 'messages.json');
}

function getPlaceholderNames(entry = {}) {
  if (!entry || typeof entry !== 'object' || !entry.placeholders || typeof entry.placeholders !== 'object') {
    return [];
  }

  return Object.keys(entry.placeholders).sort();
}

function getLocaleHealthChecks(locale) {
  if (locale !== 'hi') {
    return [];
  }

  return [
    {
      code: 'mojibake',
      test: /[\u0080-\u00FF]/,
      message: 'contains suspicious Latin-1 bytes that usually indicate mojibake'
    },
    {
      code: 'question-runs',
      test: /\?{3,}/,
      message: 'contains repeated question-mark runs that usually indicate lost Unicode text'
    }
  ];
}

function validateCatalogStructure(catalogs) {
  const errors = [];
  const canonicalKeys = Object.keys(catalogs.en).sort();

  REQUIRED_LOCALES.forEach((locale) => {
    const localeKeys = Object.keys(catalogs[locale]).sort();
    const missingKeys = canonicalKeys.filter((key) => !localeKeys.includes(key));
    const extraKeys = localeKeys.filter((key) => !canonicalKeys.includes(key));

    missingKeys.forEach((key) => {
      errors.push(`[${locale}] Missing key: ${key}`);
    });
    extraKeys.forEach((key) => {
      errors.push(`[${locale}] Extra key: ${key}`);
    });

    canonicalKeys.forEach((key) => {
      const canonicalPlaceholders = getPlaceholderNames(catalogs.en[key]);
      const localePlaceholders = getPlaceholderNames(catalogs[locale][key]);
      if (canonicalPlaceholders.join(',') !== localePlaceholders.join(',')) {
        errors.push(
          `[${locale}] Placeholder mismatch for ${key}: expected [${canonicalPlaceholders.join(', ')}], got [${localePlaceholders.join(', ')}]`
        );
      }
    });
  });

  return errors;
}

function validateLocaleMessageHealth(catalogs) {
  const errors = [];

  REQUIRED_LOCALES.forEach((locale) => {
    const checks = getLocaleHealthChecks(locale);
    if (checks.length === 0) {
      return;
    }

    Object.entries(catalogs[locale]).forEach(([key, entry]) => {
      const message = entry && entry.message;
      if (typeof message !== 'string') {
        return;
      }

      checks.forEach(({ message: errorMessage, test }) => {
        if (test.test(message)) {
          errors.push(`[${locale}] Suspicious message content for ${key}: ${errorMessage}`);
        }
      });
    });
  });

  return errors;
}

function loadCatalogs() {
  return Object.fromEntries(
    REQUIRED_LOCALES.map((locale) => [locale, readJson(getLocaleFile(locale))])
  );
}

function validateLocaleCatalogs(catalogs = loadCatalogs()) {
  return [
    ...validateCatalogStructure(catalogs),
    ...validateLocaleMessageHealth(catalogs)
  ];
}

function validateBuildLocaleCopies() {
  const errors = [];
  const targets = ['chrome', 'firefox'];

  targets.forEach((target) => {
    REQUIRED_LOCALES.forEach((locale) => {
      const filePath = path.join(BUILD_ROOT, target, '_locales', locale, 'messages.json');
      if (!fs.existsSync(filePath)) {
        errors.push(`[${target}] Missing copied locale catalog: ${path.relative(SRC_ROOT, filePath)}`);
      }
    });
  });

  return errors;
}

function run({ checkBuild = false } = {}) {
  const errors = [
    ...validateLocaleCatalogs(),
    ...(checkBuild ? validateBuildLocaleCopies() : [])
  ];

  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
}

if (require.main === module) {
  try {
    run({
      checkBuild: process.argv.includes('--check-build')
    });
    console.log('Locale validation passed.');
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

module.exports = {
  loadCatalogs,
  validateCatalogStructure,
  validateLocaleMessageHealth,
  validateLocaleCatalogs,
  validateBuildLocaleCopies,
  run
};

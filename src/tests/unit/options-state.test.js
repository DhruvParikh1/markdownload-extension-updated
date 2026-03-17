const optionsState = require('../../shared/options-state');

describe('options-state helpers', () => {
const defaultOptions = {
  contextMenus: true,
  includeTemplate: false,
  imagePrefix: '{pageTitle}/',
  tableFormatting: {
    stripLinks: true,
    stripFormatting: false,
    prettyPrint: true,
    centerText: true
  }
};

  test('buildExportFilename returns deterministic MarkSnip filename', () => {
    const filename = optionsState.buildExportFilename(new Date('2026-03-17T10:15:00Z'));
    expect(filename).toBe('MarkSnip-export-2026-03-17.json');
  });

  test('normalizeImportedOptions merges defaults and nested tableFormatting', () => {
    const importedOptions = {
      includeTemplate: true,
      tableFormatting: {
        stripLinks: false
      }
    };

    const normalized = optionsState.normalizeImportedOptions(importedOptions, defaultOptions);

    expect(normalized.includeTemplate).toBe(true);
    expect(normalized.imagePrefix).toBe('{pageTitle}/');
    expect(normalized.tableFormatting).toEqual({
      stripLinks: false,
      stripFormatting: false,
      prettyPrint: true,
      centerText: true
    });
  });

  test('normalizeImportedOptions does not mutate inputs', () => {
    const importedOptions = {
      tableFormatting: {
        stripFormatting: true
      }
    };
    const importedSnapshot = JSON.parse(JSON.stringify(importedOptions));
    const defaultsSnapshot = JSON.parse(JSON.stringify(defaultOptions));

    optionsState.normalizeImportedOptions(importedOptions, defaultOptions);

    expect(importedOptions).toEqual(importedSnapshot);
    expect(defaultOptions).toEqual(defaultsSnapshot);
  });

  test('resetOptionKeys resets top-level and tableFormatting keys', () => {
    const currentOptions = {
      ...defaultOptions,
      includeTemplate: true,
      tableFormatting: {
        stripLinks: false,
        stripFormatting: true,
        prettyPrint: false,
        centerText: false
      }
    };

    const result = optionsState.resetOptionKeys(currentOptions, defaultOptions, [
      'includeTemplate',
      'tableFormatting.stripFormatting'
    ]);

    expect(result.options.includeTemplate).toBe(false);
    expect(result.options.tableFormatting).toEqual({
      stripLinks: false,
      stripFormatting: false,
      prettyPrint: false,
      centerText: false
    });
    expect(result.contextMenuAction).toBe('none');
  });

  test('resetOptionKeys returns context menu transition when contextMenus changes', () => {
    const currentOptions = {
      ...defaultOptions,
      contextMenus: false
    };

    const result = optionsState.resetOptionKeys(currentOptions, defaultOptions, ['contextMenus']);
    expect(result.options.contextMenus).toBe(true);
    expect(result.contextMenuAction).toBe('create');
  });

  test('resetAllOptions returns cloned defaults and context menu transition', () => {
    const defaultsWithoutMenus = {
      ...defaultOptions,
      contextMenus: false
    };
    const currentOptions = {
      ...defaultOptions,
      contextMenus: true,
      includeTemplate: true
    };

    const result = optionsState.resetAllOptions(currentOptions, defaultsWithoutMenus);
    expect(result.options).toEqual(defaultsWithoutMenus);
  expect(result.contextMenuAction).toBe('remove');
});

test('normalizeImportedOptions ignores non-plain option inputs', () => {
  const normalized = optionsState.normalizeImportedOptions('text', 123);
  expect(normalized).toEqual({ tableFormatting: {} });
});

test('buildExportFilename handles invalid date values', () => {
  const filename = optionsState.buildExportFilename('invalid-date', 'Custom');
  expect(filename).toMatch(/^Custom-\d{4}-\d{2}-\d{2}\.json$/);
});

test('resetOptionKeys clears tableFormatting when defaults lack that object', () => {
  const defaults = {
    ...defaultOptions,
    tableFormatting: null
  };
  const current = {
    ...defaults,
    tableFormatting: { stripLinks: false, extra: true }
  };

  const result = optionsState.resetOptionKeys(current, defaults, ['tableFormatting.stripLinks']);

  expect(result.options.tableFormatting).toEqual({ extra: true });
});

test('resetAllOptions handles non-plain defaults without blowing up', () => {
  const result = optionsState.resetAllOptions({ contextMenus: true }, null);
  expect(result.options).toEqual({ tableFormatting: {} });
  expect(result.contextMenuAction).toBe('remove');
});

test('resetOptionKeys resets the entire tableFormatting object to defaults', () => {
  const currentOptions = {
    ...defaultOptions,
    tableFormatting: {
      stripLinks: false,
      stripFormatting: true,
      prettyPrint: false,
      centerText: false
    }
  };

  const result = optionsState.resetOptionKeys(currentOptions, defaultOptions, ['tableFormatting']);

  expect(result.options.tableFormatting).toEqual(defaultOptions.tableFormatting);
});

test('resetOptionKeys accepts a comma-delimited string and ignores empty entries', () => {
  const result = optionsState.resetOptionKeys(
    {
      ...defaultOptions,
      includeTemplate: true,
      tableFormatting: null
    },
    defaultOptions,
    'includeTemplate, tableFormatting.stripLinks, tableFormatting.'
  );

  expect(result.options.includeTemplate).toBe(false);
  expect(result.options.tableFormatting.stripLinks).toBe(true);
});

test('normalizeImportedOptions deep-clones array values from defaults', () => {
  const defaultsWithArray = {
    ...defaultOptions,
    allowedDomains: ['example.com']
  };

  const normalized = optionsState.normalizeImportedOptions({}, defaultsWithArray);
  normalized.allowedDomains.push('docs.example.com');

  expect(defaultsWithArray.allowedDomains).toEqual(['example.com']);
});

test('resetOptionKeys resets tableFormatting block when requested', () => {
  const defaults = {
    ...defaultOptions,
    tableFormatting: {
      stripLinks: true,
      extra: true
    }
  };
  const current = {
    ...defaults,
    tableFormatting: {
      stripLinks: false,
      extra: false
    }
  };

  const result = optionsState.resetOptionKeys(current, defaults, ['tableFormatting']);

  expect(result.options.tableFormatting).toEqual(defaults.tableFormatting);
});

test('resetOptionKeys handles comma-separated strings and ignores empty keys', () => {
  const current = {
    ...defaultOptions,
    includeTemplate: true
  };

  const result = optionsState.resetOptionKeys(current, defaultOptions, 'includeTemplate,,  ');

  expect(result.options.includeTemplate).toBe(false);
  expect(result.contextMenuAction).toBe('none');
});

test('resetOptionKeys ignores empty tableFormatting target entries', () => {
  const result = optionsState.resetOptionKeys(defaultOptions, defaultOptions, ['tableFormatting.']);

  expect(result.options.tableFormatting).toEqual(defaultOptions.tableFormatting);
});

test('normalizeImportedOptions clones array fields', () => {
  const defaults = {
    ...defaultOptions,
    list: [1, 2],
    tableFormatting: {}
  };

  const normalized = optionsState.normalizeImportedOptions({ list: [3, 4] }, defaults);

  expect(normalized.list).toEqual([3, 4]);
  normalized.list.push(5);
  expect(defaults.list).toEqual([1, 2]);
});
});

const searchCore = require('../../shared/search-core.js');

describe('search-core — normalizeSearchText', () => {
  const { normalizeSearchText } = searchCore;

  test('lowercases and removes diacritics', () => {
    expect(normalizeSearchText('Héllo Wörld')).toBe('hello world');
  });

  test('splits camelCase into words', () => {
    expect(normalizeSearchText('downloadImages')).toBe('download images');
  });

  test('replaces underscores, dots, slashes, hyphens with spaces', () => {
    expect(normalizeSearchText('front_matter/back.matter-title')).toBe('front matter back matter title');
  });

  test('returns empty string for null/undefined', () => {
    expect(normalizeSearchText(null)).toBe('');
    expect(normalizeSearchText(undefined)).toBe('');
  });

  test('collapses multiple spaces', () => {
    expect(normalizeSearchText('  hello   world  ')).toBe('hello world');
  });
});

describe('search-core — toWords / toCondensed / buildAcronym', () => {
  test('toWords splits normalized text', () => {
    expect(searchCore.toWords('Download Images')).toEqual(['download', 'images']);
  });

  test('toCondensed joins without spaces', () => {
    expect(searchCore.toCondensed('Download Images')).toBe('downloadimages');
  });

  test('buildAcronym takes first letters', () => {
    expect(searchCore.buildAcronym(['download', 'images'])).toBe('di');
    expect(searchCore.buildAcronym([])).toBe('');
  });
});

describe('search-core — createField', () => {
  test('creates a field object with normalized data', () => {
    const field = searchCore.createField('Download Images', { source: 'title', primary: true, qualifies: true });
    expect(field).not.toBeNull();
    expect(field.normalized).toBe('download images');
    expect(field.words).toEqual(['download', 'images']);
    expect(field.condensed).toBe('downloadimages');
    expect(field.acronym).toBe('di');
    expect(field.primary).toBe(true);
    expect(field.qualifies).toBe(true);
  });

  test('returns null for empty text', () => {
    expect(searchCore.createField('', { source: 'test' })).toBeNull();
    expect(searchCore.createField('   ', { source: 'test' })).toBeNull();
  });
});

describe('search-core — getSubsequenceSpan', () => {
  test('finds subsequence span', () => {
    // i=0, m=1, g=3 → span = (3-0)+1 = 4
    expect(searchCore.getSubsequenceSpan('img', 'images')).toBe(4);
  });

  test('returns 0 when subsequence not found', () => {
    expect(searchCore.getSubsequenceSpan('xyz', 'images')).toBe(0);
  });
});

describe('search-core — isSingleEditMatch', () => {
  test('detects substitution', () => {
    expect(searchCore.isSingleEditMatch('imags', 'image')).toBe(true);
  });

  test('detects insertion', () => {
    expect(searchCore.isSingleEditMatch('image', 'images')).toBe(true);
  });

  test('detects deletion', () => {
    expect(searchCore.isSingleEditMatch('images', 'image')).toBe(true);
  });

  test('rejects identical strings', () => {
    expect(searchCore.isSingleEditMatch('image', 'image')).toBe(false);
  });

  test('rejects strings differing by more than 1 edit', () => {
    expect(searchCore.isSingleEditMatch('abc', 'xyz')).toBe(false);
  });
});

describe('search-core — scoring functions', () => {
  function makeField(rawText, opts = {}) {
    return searchCore.createField(rawText, { source: 'test', primary: true, qualifies: true, ...opts });
  }

  test('exact match scores PRIMARY_EXACT', () => {
    const field = makeField('download');
    expect(searchCore.scorePrimaryField(field, 'download', 'download')).toBe(searchCore.SCORES.PRIMARY_EXACT);
  });

  test('alias exact match scores EXACT_ALIAS', () => {
    const field = makeField('dl', { isAlias: true });
    expect(searchCore.scorePrimaryField(field, 'dl', 'dl')).toBe(searchCore.SCORES.EXACT_ALIAS);
  });

  test('substring match scores PRIMARY_SUBSTRING', () => {
    const field = makeField('download images');
    expect(searchCore.scorePrimaryField(field, 'load', 'load')).toBe(searchCore.SCORES.PRIMARY_SUBSTRING);
  });

  test('acronym match scores ACRONYM', () => {
    const field = makeField('download images');
    expect(searchCore.scorePrimaryField(field, 'di', 'di')).toBe(searchCore.SCORES.ACRONYM);
  });

  test('secondary field scores correctly', () => {
    const field = makeField('some description text', { primary: false });
    expect(searchCore.scoreSecondaryField(field, 'some description text', 'somedescriptiontext')).toBe(searchCore.SCORES.SECONDARY_EXACT);
  });

  test('scoreField delegates based on primary flag', () => {
    const primary = makeField('test', { primary: true });
    const secondary = makeField('test', { primary: false });
    expect(searchCore.scoreField(primary, 'test')).toBe(searchCore.SCORES.PRIMARY_EXACT);
    expect(searchCore.scoreField(secondary, 'test')).toBe(searchCore.SCORES.SECONDARY_EXACT);
  });
});

describe('search-core — evaluateEntry & runSearch', () => {
  function makeEntry(titles, aliases = []) {
    const entry = { fields: [] };
    titles.forEach(t => {
      const f = searchCore.createField(t, { source: 'title', primary: true, qualifies: true });
      if (f) entry.fields.push(f);
    });
    aliases.forEach(a => {
      const f = searchCore.createField(a, { source: 'alias', primary: true, qualifies: true, isAlias: true, allowFuzzy: true });
      if (f) entry.fields.push(f);
    });
    return entry;
  }

  test('evaluateEntry matches when tokens hit qualifying fields', () => {
    const entry = makeEntry(['Download Images']);
    const result = searchCore.evaluateEntry(entry, ['download'], searchCore.STRICT_THRESHOLDS);
    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });

  test('evaluateEntry does not match irrelevant queries', () => {
    const entry = makeEntry(['Download Images']);
    const result = searchCore.evaluateEntry(entry, ['obsidian'], searchCore.STRICT_THRESHOLDS);
    expect(result.matches).toBe(false);
  });

  test('runSearch returns matching entries', () => {
    const index = [
      makeEntry(['Download Images']),
      makeEntry(['Obsidian Integration']),
      makeEntry(['Code Block Style'])
    ];
    const result = searchCore.runSearch(index, 'download', searchCore.STRICT_THRESHOLDS, 'strict');
    expect(result.matches.length).toBe(1);
    expect(result.matches[0].fields[0].rawText).toBe('Download Images');
  });

  test('FALLBACK_THRESHOLDS are weaker than STRICT_THRESHOLDS', () => {
    expect(searchCore.FALLBACK_THRESHOLDS.minAverageScore).toBeLessThan(searchCore.STRICT_THRESHOLDS.minAverageScore);
  });
});

const {
  buildReleaseHighlightsAsset,
  extractReleaseSections,
  normalizeBulletText
} = require('../../scripts/generate-release-highlights');

describe('release highlights generator', () => {
  const sampleChangelog = `
# Changelog

## 4.2.0

- **Selection Capture Fix**: Preserved selected HTML context.
- Added \`batch\` toggle support.
- [Docs](https://example.com) updated.
- Fourth bullet.
- Fifth bullet.
- Sixth bullet.

## 4.1.9

- Older fix.
`;

  test('normalizes markdown formatting inside changelog bullets', () => {
    expect(
      normalizeBulletText('- **Selection** with `code` and [Docs](https://example.com)')
    ).toBe('Selection with code and Docs');
  });

  test('extracts release sections by semantic version heading', () => {
    const sections = extractReleaseSections(sampleChangelog);

    expect(sections['4.2.0']).toHaveLength(6);
    expect(sections['4.1.9']).toEqual(['Older fix.']);
  });

  test('caps highlights to five bullets and keeps the manifest version', () => {
    const asset = buildReleaseHighlightsAsset(sampleChangelog, '4.2.0');

    expect(asset.versions['4.2.0']).toHaveLength(5);
    expect(asset.versions['4.2.0'][0]).toBe('Selection Capture Fix: Preserved selected HTML context.');
  });

  test('throws when the manifest version is missing from the changelog', () => {
    expect(() => buildReleaseHighlightsAsset(sampleChangelog, '9.9.9')).toThrow(
      /missing release highlights/i
    );
  });
});

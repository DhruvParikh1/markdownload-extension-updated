const {
  buildReleaseHighlightsAsset,
  extractReleaseSections,
  normalizeBulletText
} = require('../../scripts/generate-release-highlights');

describe('release highlights generator', () => {
  const sampleChangelog = `
# Changelog

## 4.2.0

### User Highlights

- **Selection Capture Fix**: Keeps selected content intact during clipping.
- Added \`batch\` toggle support.
- [Docs](https://example.com) updated.
- Fourth bullet.
- Fifth bullet.
- Sixth bullet.

### Technical Notes

- Added regression coverage.
- Internal parser cleanup.

## 4.1.9

- Older fix.
`;

  test('normalizes markdown formatting inside changelog bullets', () => {
    expect(
      normalizeBulletText('- **Selection** with `code` and [Docs](https://example.com)')
    ).toBe('Selection with code and Docs');
  });

  test('extracts user highlights when the subsection is present', () => {
    const sections = extractReleaseSections(sampleChangelog);

    expect(sections['4.2.0']).toHaveLength(6);
    expect(sections['4.1.9']).toEqual(['Older fix.']);
    expect(sections['4.2.0']).not.toContain('Added regression coverage.');
  });

  test('falls back to top-level bullets for legacy changelog entries', () => {
    const sections = extractReleaseSections(sampleChangelog);

    expect(sections['4.1.9']).toEqual(['Older fix.']);
  });

  test('caps highlights to five bullets and keeps the manifest version', () => {
    const asset = buildReleaseHighlightsAsset(sampleChangelog, '4.2.0');

    expect(asset.versions['4.2.0']).toHaveLength(5);
    expect(asset.versions['4.2.0'][0]).toBe('Selection Capture Fix: Keeps selected content intact during clipping.');
  });

  test('throws when the manifest version is missing from the changelog', () => {
    expect(() => buildReleaseHighlightsAsset(sampleChangelog, '9.9.9')).toThrow(
      /missing release highlights/i
    );
  });
});

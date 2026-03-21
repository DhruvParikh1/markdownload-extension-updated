const libraryExport = require('../../shared/library-export');

describe('library-export helpers', () => {
  test('creates a deterministic library ZIP filename', () => {
    const zipFilename = libraryExport.createLibraryExportZipFilename(
      new Date(2026, 2, 21, 9, 8, 7)
    );

    expect(zipFilename).toBe('MarkSnip-library-20260321-090807.zip');
  });

  test('builds unique sanitized markdown entries for library exports', () => {
    const files = libraryExport.createLibraryExportFiles([
      { title: 'Alpha/One?', markdown: '# First' },
      { title: 'Alpha/One?', markdown: '# Second' },
      { title: '   ', markdown: '# Third' },
      { title: '<>:', markdown: '# Fourth' },
      { title: 'Test [File]', markdown: '# Fifth' }
    ], {
      disallowedChars: '[]'
    });

    expect(files).toEqual([
      { filename: 'AlphaOne.md', content: '# First' },
      { filename: 'AlphaOne (2).md', content: '# Second' },
      { filename: 'Untitled.md', content: '# Third' },
      { filename: 'Untitled (2).md', content: '# Fourth' },
      { filename: 'Test File.md', content: '# Fifth' }
    ]);
  });

  test('normalizes duplicate filenames with markdown extensions', () => {
    const usedPaths = new Set();

    expect(libraryExport.ensureUniqueLibraryExportPath('Folder\\Clip', usedPaths)).toBe('Folder/Clip.md');
    expect(libraryExport.ensureUniqueLibraryExportPath('/Folder/Clip.md', usedPaths)).toBe('Folder/Clip (2).md');
    expect(libraryExport.ensureUniqueLibraryExportPath('Folder/Clip.md', usedPaths)).toBe('Folder/Clip (3).md');
  });
});

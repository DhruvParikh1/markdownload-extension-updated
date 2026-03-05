/**
 * Download Filename Conflict Tests
 * Tests for the fix that prevents conflicts with other extensions
 * and handles empty filenames properly
 */

describe('Download Filename Conflict Handling', () => {
  let markSnipDownloads;
  let markSnipUrls;
  let markSnipBlobUrls;
  let handleFilenameConflict;

  beforeEach(() => {
    markSnipDownloads = new Map();
    markSnipUrls = new Map();
    markSnipBlobUrls = new Set();

    handleFilenameConflict = (downloadItem, suggest) => {
      const trackedById = markSnipDownloads.has(downloadItem.id);
      const trackedByUrl = downloadItem.url && markSnipUrls.has(downloadItem.url);
      const isOurBlobUrl = downloadItem.url && markSnipBlobUrls.has(downloadItem.url);

      if (trackedById || trackedByUrl || isOurBlobUrl) {
        let filename = null;
        
        if (trackedById) {
          const downloadInfo = markSnipDownloads.get(downloadItem.id);
          filename = downloadInfo?.filename;
        } else if (trackedByUrl) {
          const urlInfo = markSnipUrls.get(downloadItem.url);
          filename = urlInfo?.filename;
        } else if (isOurBlobUrl) {
          const urlInfo = markSnipUrls.get(downloadItem.url);
          filename = urlInfo?.filename;
        }

        if (filename) {
          suggest({
            filename: filename,
            conflictAction: 'uniquify'
          });
          return true;
        }
      }

      return false;
    };
  });

  describe('handleFilenameConflict', () => {
    test('should suggest filename for download tracked by ID', () => {
      markSnipDownloads.set(123, { filename: 'folder/article.md' });
      
      const suggest = jest.fn();
      const downloadItem = { id: 123, url: 'blob:chrome-extension://test/abc' };
      
      const result = handleFilenameConflict(downloadItem, suggest);
      
      expect(result).toBe(true);
      expect(suggest).toHaveBeenCalledWith({
        filename: 'folder/article.md',
        conflictAction: 'uniquify'
      });
    });

    test('should suggest filename for download tracked by URL', () => {
      const blobUrl = 'blob:chrome-extension://test/abc123';
      markSnipUrls.set(blobUrl, { filename: 'downloads/note.md', isMarkdown: true });
      markSnipBlobUrls.add(blobUrl);
      
      const suggest = jest.fn();
      const downloadItem = { id: 456, url: blobUrl };
      
      const result = handleFilenameConflict(downloadItem, suggest);
      
      expect(result).toBe(true);
      expect(suggest).toHaveBeenCalledWith({
        filename: 'downloads/note.md',
        conflictAction: 'uniquify'
      });
    });

    test('should suggest filename for blob URL in tracking set', () => {
      const blobUrl = 'blob:chrome-extension://test/xyz789';
      markSnipBlobUrls.add(blobUrl);
      markSnipUrls.set(blobUrl, { filename: 'clip.md' });
      
      const suggest = jest.fn();
      const downloadItem = { id: 789, url: blobUrl };
      
      const result = handleFilenameConflict(downloadItem, suggest);
      
      expect(result).toBe(true);
      expect(suggest).toHaveBeenCalledWith({
        filename: 'clip.md',
        conflictAction: 'uniquify'
      });
    });

    test('should NOT call suggest for untracked downloads', () => {
      const suggest = jest.fn();
      const downloadItem = { id: 999, url: 'https://example.com/file.pdf' };
      
      const result = handleFilenameConflict(downloadItem, suggest);
      
      expect(result).toBe(false);
      expect(suggest).not.toHaveBeenCalled();
    });

    test('should NOT call suggest for blob URLs not in our tracking set', () => {
      const otherBlobUrl = 'blob:chrome-extension://other-extension/abc';
      
      const suggest = jest.fn();
      const downloadItem = { id: 111, url: otherBlobUrl };
      
      const result = handleFilenameConflict(downloadItem, suggest);
      
      expect(result).toBe(false);
      expect(suggest).not.toHaveBeenCalled();
    });

    test('should NOT call suggest when download is identified but filename is missing', () => {
      markSnipDownloads.set(123, { filename: null });
      
      const suggest = jest.fn();
      const downloadItem = { id: 123, url: 'blob:chrome-extension://test/abc' };
      
      const result = handleFilenameConflict(downloadItem, suggest);
      
      expect(result).toBe(false);
      expect(suggest).not.toHaveBeenCalled();
    });

    test('should prioritize ID tracking over URL tracking', () => {
      const blobUrl = 'blob:chrome-extension://test/abc';
      markSnipDownloads.set(123, { filename: 'from-id.md' });
      markSnipUrls.set(blobUrl, { filename: 'from-url.md' });
      
      const suggest = jest.fn();
      const downloadItem = { id: 123, url: blobUrl };
      
      handleFilenameConflict(downloadItem, suggest);
      
      expect(suggest).toHaveBeenCalledWith({
        filename: 'from-id.md',
        conflictAction: 'uniquify'
      });
    });
  });

  describe('Blob URL Tracking', () => {
    test('should track blob URL in both Map and Set', () => {
      const blobUrl = 'blob:chrome-extension://test/blob123';
      const filename = 'article.md';
      
      markSnipUrls.set(blobUrl, { filename, isMarkdown: true });
      markSnipBlobUrls.add(blobUrl);
      
      expect(markSnipUrls.has(blobUrl)).toBe(true);
      expect(markSnipBlobUrls.has(blobUrl)).toBe(true);
      expect(markSnipUrls.get(blobUrl).filename).toBe(filename);
    });

    test('should clean up tracking after download completes', () => {
      const blobUrl = 'blob:chrome-extension://test/blob456';
      const downloadId = 100;
      
      markSnipUrls.set(blobUrl, { filename: 'test.md' });
      markSnipBlobUrls.add(blobUrl);
      markSnipDownloads.set(downloadId, { filename: 'test.md', url: blobUrl });
      
      expect(markSnipDownloads.has(downloadId)).toBe(true);
      expect(markSnipUrls.has(blobUrl)).toBe(true);
      expect(markSnipBlobUrls.has(blobUrl)).toBe(true);
      
      markSnipDownloads.delete(downloadId);
      markSnipUrls.delete(blobUrl);
      markSnipBlobUrls.delete(blobUrl);
      
      expect(markSnipDownloads.has(downloadId)).toBe(false);
      expect(markSnipUrls.has(blobUrl)).toBe(false);
      expect(markSnipBlobUrls.has(blobUrl)).toBe(false);
    });

    test('should handle multiple concurrent downloads', () => {
      const urls = [
        'blob:chrome-extension://test/1',
        'blob:chrome-extension://test/2',
        'blob:chrome-extension://test/3'
      ];
      
      urls.forEach((url, index) => {
        markSnipUrls.set(url, { filename: `article-${index}.md` });
        markSnipBlobUrls.add(url);
      });
      
      expect(markSnipBlobUrls.size).toBe(3);
      expect(markSnipUrls.size).toBe(3);
      
      urls.forEach((url, index) => {
        const suggest = jest.fn();
        handleFilenameConflict({ id: index, url }, suggest);
        expect(suggest).toHaveBeenCalledWith({
          filename: `article-${index}.md`,
          conflictAction: 'uniquify'
        });
      });
    });
  });
});

describe('Empty Filename Handling', () => {
  const generateValidFileName = (title, disallowedChars = null) => {
    if (!title) return title;
    else title = title + '';
    
    var illegalRe = /[\/\?<>\\:\*\|":]/g;
    var name = title.replace(illegalRe, "").replace(new RegExp('\u00A0', 'g'), ' ');
    
    if (disallowedChars) {
      for (let c of disallowedChars) {
        if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
        name = name.replace(new RegExp(c, 'g'), '');
      }
    }
    
    return name;
  };

  const validateAndFixFilename = (title) => {
    if (!title || title.trim() === '') {
      return 'Untitled-' + Date.now();
    }
    return title;
  };

  describe('Title Validation', () => {
    test('should use fallback for empty title', () => {
      const result = validateAndFixFilename('');
      expect(result).toMatch(/^Untitled-\d+$/);
    });

    test('should use fallback for whitespace-only title', () => {
      const result = validateAndFixFilename('   ');
      expect(result).toMatch(/^Untitled-\d+$/);
    });

    test('should use fallback for null title', () => {
      const result = validateAndFixFilename(null);
      expect(result).toMatch(/^Untitled-\d+$/);
    });

    test('should use fallback for undefined title', () => {
      const result = validateAndFixFilename(undefined);
      expect(result).toMatch(/^Untitled-\d+$/);
    });

    test('should preserve valid title', () => {
      const result = validateAndFixFilename('My Article Title');
      expect(result).toBe('My Article Title');
    });

    test('should preserve title with special chars that are allowed', () => {
      const result = validateAndFixFilename('Article (2024) - Draft #2');
      expect(result).toBe('Article (2024) - Draft #2');
    });
  });

  describe('Filename Generation', () => {
    test('should remove illegal characters', () => {
      expect(generateValidFileName('Test/File:Name')).toBe('TestFileName');
      expect(generateValidFileName('Test<File>Name')).toBe('TestFileName');
      expect(generateValidFileName('Test*File?Name')).toBe('TestFileName');
      expect(generateValidFileName('Test|File"Name')).toBe('TestFileName');
    });

    test('should remove custom disallowed characters', () => {
      expect(generateValidFileName('Test [File]', '[]')).toBe('Test File');
      expect(generateValidFileName('Test#File^Name', '#^')).toBe('TestFileName');
    });

    test('should handle empty input', () => {
      expect(generateValidFileName('')).toBe('');
      expect(generateValidFileName(null)).toBeNull();
    });

    test('should replace non-breaking spaces', () => {
      expect(generateValidFileName('Test\u00A0File')).toBe('Test File');
    });
  });
});

describe('Article PageTitle Fallback', () => {
  const createArticleWithFallbacks = (dom, readabilityResult, pageUrl = null) => {
    const article = readabilityResult || { title: null };
    
    const baseUri = dom.baseURI || pageUrl || 'https://example.com';
    const resolvedUrl = pageUrl || baseUri;
    article.uriBase = baseUri;
    article.baseURI = baseUri;
    article.pageURL = resolvedUrl;
    article.tabURL = resolvedUrl;
    
    article.pageTitle = dom.title || article.title || 'Untitled';
    
    if (!article.title) {
      article.title = article.pageTitle;
    }
    
    return article;
  };

  test('should use dom.title for pageTitle when available', () => {
    const dom = { baseURI: 'https://example.com', title: 'DOM Title' };
    const readability = { title: 'Readability Title' };
    
    const article = createArticleWithFallbacks(dom, readability);
    
    expect(article.pageTitle).toBe('DOM Title');
    expect(article.title).toBe('Readability Title');
  });

  test('should use article.title as fallback when dom.title is empty', () => {
    const dom = { baseURI: 'https://example.com', title: '' };
    const readability = { title: 'Readability Title' };
    
    const article = createArticleWithFallbacks(dom, readability);
    
    expect(article.pageTitle).toBe('Readability Title');
    expect(article.title).toBe('Readability Title');
  });

  test('should use Untitled fallback when both titles are empty', () => {
    const dom = { baseURI: 'https://example.com', title: '' };
    const readability = { title: null };
    
    const article = createArticleWithFallbacks(dom, readability);
    
    expect(article.pageTitle).toBe('Untitled');
    expect(article.title).toBe('Untitled');
  });

  test('should use Untitled fallback when dom.title is null', () => {
    const dom = { baseURI: 'https://example.com', title: null };
    const readability = { title: undefined };
    
    const article = createArticleWithFallbacks(dom, readability);
    
    expect(article.pageTitle).toBe('Untitled');
    expect(article.title).toBe('Untitled');
  });

  test('should set article.title from pageTitle when missing', () => {
    const dom = { baseURI: 'https://example.com', title: 'Page Title' };
    const readability = { title: null };
    
    const article = createArticleWithFallbacks(dom, readability);
    
    expect(article.pageTitle).toBe('Page Title');
    expect(article.title).toBe('Page Title');
  });

  test('should handle pages with no title element', () => {
    const dom = { baseURI: 'https://example.com', title: undefined };
    const readability = {};
    
    const article = createArticleWithFallbacks(dom, readability);
    
    expect(article.pageTitle).toBe('Untitled');
    expect(article.title).toBe('Untitled');
  });

  test('should prefer explicit page URL over baseURI for SPA routes', () => {
    const dom = { baseURI: 'https://gemini.google.com/', title: 'Google Gemini' };
    const readability = { title: 'Google Gemini' };
    const pageUrl = 'https://gemini.google.com/app/19a994212aad751c';

    const article = createArticleWithFallbacks(dom, readability, pageUrl);

    expect(article.baseURI).toBe(dom.baseURI);
    expect(article.pageURL).toBe(pageUrl);
    expect(article.uriBase).toBe(dom.baseURI);
  });
});

describe('Download Full Filename Construction', () => {
  const buildFullFilename = (mdClipsFolder, title) => {
    if (!title || title.trim() === '') {
      title = 'Untitled-' + Date.now();
    }
    
    let folder = mdClipsFolder || '';
    if (folder && !folder.endsWith('/')) {
      folder += '/';
    }
    
    return folder + title + '.md';
  };

  test('should build filename with folder and title', () => {
    expect(buildFullFilename('downloads', 'My Article')).toBe('downloads/My Article.md');
  });

  test('should add trailing slash to folder if missing', () => {
    expect(buildFullFilename('downloads', 'Article')).toBe('downloads/Article.md');
    expect(buildFullFilename('downloads/', 'Article')).toBe('downloads/Article.md');
  });

  test('should handle empty folder', () => {
    expect(buildFullFilename('', 'Article')).toBe('Article.md');
    expect(buildFullFilename(null, 'Article')).toBe('Article.md');
  });

  test('should use fallback for empty title', () => {
    const result = buildFullFilename('downloads', '');
    expect(result).toMatch(/^downloads\/Untitled-\d+\.md$/);
  });

  test('should handle nested folder paths', () => {
    expect(buildFullFilename('downloads/articles/2024', 'My Post')).toBe('downloads/articles/2024/My Post.md');
  });

  test('should use fallback when title is only whitespace', () => {
    const result = buildFullFilename('clips', '   ');
    expect(result).toMatch(/^clips\/Untitled-\d+\.md$/);
  });
});

describe('Extension Conflict Prevention', () => {
  test('should not interfere with downloads from other extensions', () => {
    const markSnipDownloads = new Map();
    const markSnipUrls = new Map();
    const markSnipBlobUrls = new Set();

    const handleFilenameConflict = (downloadItem, suggest) => {
      const trackedById = markSnipDownloads.has(downloadItem.id);
      const trackedByUrl = downloadItem.url && markSnipUrls.has(downloadItem.url);
      const isOurBlobUrl = downloadItem.url && markSnipBlobUrls.has(downloadItem.url);

      if (trackedById || trackedByUrl || isOurBlobUrl) {
        let filename = null;
        if (trackedById) {
          filename = markSnipDownloads.get(downloadItem.id)?.filename;
        } else if (trackedByUrl) {
          filename = markSnipUrls.get(downloadItem.url)?.filename;
        }
        if (filename) {
          suggest({ filename, conflictAction: 'uniquify' });
          return true;
        }
      }
      return false;
    };

    const otherExtensionDownloads = [
      { id: 1, url: 'https://example.com/file.pdf' },
      { id: 2, url: 'blob:chrome-extension://other-ext-123/blob' },
      { id: 3, url: 'data:text/plain;base64,SGVsbG8=' }
    ];

    otherExtensionDownloads.forEach(downloadItem => {
      const suggest = jest.fn();
      const result = handleFilenameConflict(downloadItem, suggest);
      expect(result).toBe(false);
      expect(suggest).not.toHaveBeenCalled();
    });
  });

  test('should only handle MarkSnip downloads', () => {
    const markSnipDownloads = new Map();
    const markSnipUrls = new Map();
    const markSnipBlobUrls = new Set();

    const ourBlobUrl = 'blob:chrome-extension://test-ext/our-blob';
    markSnipUrls.set(ourBlobUrl, { filename: 'article.md' });
    markSnipBlobUrls.add(ourBlobUrl);

    const handleFilenameConflict = (downloadItem, suggest) => {
      const trackedById = markSnipDownloads.has(downloadItem.id);
      const trackedByUrl = downloadItem.url && markSnipUrls.has(downloadItem.url);
      const isOurBlobUrl = downloadItem.url && markSnipBlobUrls.has(downloadItem.url);

      if (trackedById || trackedByUrl || isOurBlobUrl) {
        let filename = null;
        if (trackedById) {
          filename = markSnipDownloads.get(downloadItem.id)?.filename;
        } else if (trackedByUrl) {
          filename = markSnipUrls.get(downloadItem.url)?.filename;
        }
        if (filename) {
          suggest({ filename, conflictAction: 'uniquify' });
          return true;
        }
      }
      return false;
    };

    const suggest = jest.fn();
    handleFilenameConflict({ id: 99, url: ourBlobUrl }, suggest);
    expect(suggest).toHaveBeenCalled();

    suggest.mockClear();
    handleFilenameConflict({ id: 100, url: 'blob:chrome-extension://other/blob' }, suggest);
    expect(suggest).not.toHaveBeenCalled();
  });
});

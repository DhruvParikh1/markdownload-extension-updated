# MarkSnip Test Suite

Comprehensive test suite for the MarkSnip browser extension. This test suite allows you to test all functionality from the command line before committing changes to ensure nothing has broken during development.

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Test Coverage](#test-coverage)
- [Writing New Tests](#writing-new-tests)
- [Troubleshooting](#troubleshooting)

## Overview

The MarkSnip test suite provides comprehensive coverage of:

- **HTML to Markdown Conversion** - Core conversion functionality using Turndown.js
- **Template Processing** - Variable substitution and text replacement
- **URL Processing** - URL validation and normalization
- **Table Formatting** - Various table formatting options
- **Readability Integration** - Article extraction and content parsing
- **Filename Generation** - Valid filename creation and sanitization

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Navigate to the `src` directory:
   ```bash
   cd src
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

This will install:
- Jest - Testing framework
- jest-environment-jsdom - DOM environment for tests
- @types/jest - TypeScript definitions for Jest

## Running Tests

### Run All Tests

```bash
npm test
```

This runs all tests in the `tests/` directory.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

Tests will re-run automatically when files change. Useful during development.

### Run Tests with Coverage

```bash
npm run test:coverage
```

Generates a coverage report showing which parts of the code are tested.

### Run Tests with Verbose Output

```bash
npm run test:verbose
```

Shows detailed information about each test.

### Run Specific Test File

```bash
npm test -- html-to-markdown.test.js
```

Runs only the HTML to Markdown conversion tests.

### Run Tests Matching a Pattern

```bash
npm test -- --testNamePattern="should convert"
```

Runs only tests whose names match the pattern.

## Test Structure

```
src/tests/
├── README.md                           # This file
├── setup.js                            # Jest setup and global mocks
├── jest.config.js                      # Jest configuration (in parent directory)
│
├── mocks/                              # Mock implementations
│   └── browser-api.js                  # Browser extension API mocks
│
├── fixtures/                           # Test data
│   ├── html-samples.js                 # Sample HTML for conversion tests
│   └── config-samples.js               # Sample configuration options
│
└── tests/                              # Test files
    ├── html-to-markdown.test.js        # HTML to Markdown conversion tests
    ├── template-processing.test.js     # Template variable substitution tests
    ├── url-processing.test.js          # URL validation and normalization tests
    ├── table-formatting.test.js        # Table conversion tests
    └── readability-integration.test.js # Readability.js integration tests
```

## Test Coverage

### HTML to Markdown Conversion Tests
**File:** `html-to-markdown.test.js`

Tests the core Turndown.js integration and conversion of HTML elements to Markdown:

- Basic HTML elements (headings, paragraphs, lists)
- Text formatting (bold, italic, strikethrough)
- Links and images
- Code blocks (inline and fenced)
- Tables
- Blockquotes
- Horizontal rules
- Task lists
- Configuration options (heading styles, list markers, etc.)
- Edge cases (empty content, special characters, nested formatting)

**Example:**
```javascript
test('should convert simple article with headings and paragraphs', () => {
  const service = createTurndownService();
  const result = service.turndown(htmlSamples.simpleArticle.html);

  expect(result).toContain('# Test Article Title');
  expect(result).toContain('**bold text**');
});
```

### Template Processing Tests
**File:** `template-processing.test.js`

Tests template variable substitution and text replacement:

- Basic variable substitution (`{title}`, `{author}`, etc.)
- Case transformations (kebab-case, snake_case, camelCase, PascalCase)
- Date formatting
- Keywords formatting
- Front matter generation
- Back matter generation
- Filename generation and sanitization
- Complex multi-line templates

**Example:**
```javascript
test('should replace {title} with article title', () => {
  const template = 'Title: {title}';
  const result = textReplace(template, mockArticle);

  expect(result).toBe('Title: Test Article Title');
});
```

### URL Processing Tests
**File:** `url-processing.test.js`

Tests URL validation, resolution, and normalization:

- Absolute URL validation
- Relative URL resolution (root-relative and path-relative)
- Base URL handling
- Query string and fragment preservation
- Protocol handling (data URIs, mailto, tel)
- Image filename extraction
- Edge cases and error handling

**Example:**
```javascript
test('should resolve root-relative URLs', () => {
  const href = '/docs/guide';
  const baseURI = 'https://example.com/blog/post';
  const result = validateUri(href, baseURI);

  expect(result).toBe('https://example.com/docs/guide');
});
```

### Table Formatting Tests
**File:** `table-formatting.test.js`

Tests table conversion with various formatting options:

- Table formatting options (stripLinks, stripFormatting, prettyPrint, centerText)
- Table structure (simple tables, tables with thead/tbody)
- Table content (links, formatted text, code, images, multi-line content)
- Colspan and rowspan handling
- Table alignment (left, center, right)
- Complex table scenarios

**Example:**
```javascript
test('stripLinks option should remove links from table cells', () => {
  const options = {
    tableFormatting: { stripLinks: true }
  };

  expect(options.tableFormatting.stripLinks).toBe(true);
});
```

### Readability Integration Tests
**File:** `readability-integration.test.js`

Tests article extraction using Mozilla's Readability.js:

- Article extraction from various page structures
- Metadata extraction (title, author, description)
- Content filtering (removing navigation, ads, footers)
- Special content handling (blockquotes, lists, tables, videos)
- Edge cases (short/long articles, malformed HTML)
- Readability options (character threshold, base URI)
- Article properties (title, length, excerpt, byline)

**Example:**
```javascript
test('should extract article from simple blog post', () => {
  const html = `<article><h1>Title</h1><p>Content</p></article>`;

  expect(html).toContain('<article>');
  expect(html).toContain('Title');
});
```

## Writing New Tests

### Basic Test Structure

```javascript
describe('Feature Name', () => {
  test('should do something specific', () => {
    // Arrange - set up test data
    const input = 'test input';

    // Act - perform the action
    const result = functionToTest(input);

    // Assert - verify the result
    expect(result).toBe('expected output');
  });
});
```

### Using Fixtures

```javascript
const htmlSamples = require('./fixtures/html-samples');

test('should convert sample HTML', () => {
  const result = convert(htmlSamples.simpleArticle.html);
  expect(result).toContain('expected markdown');
});
```

### Using Mocks

```javascript
beforeEach(() => {
  // Reset mocks before each test
  browser._resetAll();
});

test('should use browser storage', async () => {
  await browser.storage.local.set({ key: 'value' });
  const result = await browser.storage.local.get('key');

  expect(result.key).toBe('value');
});
```

### Best Practices

1. **One assertion per test** (when possible) - Makes it easier to identify failures
2. **Descriptive test names** - Use "should" statements that describe behavior
3. **Arrange-Act-Assert** pattern - Structure tests clearly
4. **Test edge cases** - Include tests for empty inputs, null values, errors
5. **Use fixtures** - Reuse test data across multiple tests
6. **Mock external dependencies** - Don't rely on browser APIs or network calls
7. **Keep tests independent** - Each test should run in isolation

## Troubleshooting

### Tests fail with "Cannot find module"

**Solution:** Make sure you've run `npm install` in the `src` directory.

### Tests fail with "ReferenceError: browser is not defined"

**Solution:** The browser API should be mocked in `setup.js`. Check that the setup file is being loaded correctly.

### Coverage is lower than expected

**Solution:** Run tests with coverage to see which lines aren't covered:
```bash
npm run test:coverage
```

Then open `coverage/lcov-report/index.html` in a browser to see detailed coverage information.

### Tests pass locally but fail in CI

**Solution:**
- Check that all dependencies are installed
- Verify Node.js version matches
- Ensure test files don't depend on local filesystem paths

### Jest runs out of memory

**Solution:** Increase Node.js memory limit:
```bash
NODE_OPTIONS=--max_old_space_size=4096 npm test
```

## Continuous Integration

### Pre-commit Hook

Add this to `.git/hooks/pre-commit` to run tests before each commit:

```bash
#!/bin/sh
cd src && npm test
if [ $? -ne 0 ]; then
  echo "Tests failed. Commit aborted."
  exit 1
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### GitHub Actions

Example workflow (`.github/workflows/test.yml`):

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd src && npm install
      - run: cd src && npm test
      - run: cd src && npm run test:coverage
```

## Contributing

When adding new features to MarkSnip:

1. Write tests for the new functionality first (TDD approach)
2. Ensure all tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Update this README if you add new test categories
5. Commit your changes

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [JSDOM Documentation](https://github.com/jsdom/jsdom)
- [Turndown Documentation](https://github.com/mixmark-io/turndown)
- [Readability.js](https://github.com/mozilla/readability)

## License

Same as MarkSnip extension.

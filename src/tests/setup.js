/**
 * Jest Setup File
 * Runs before each test file to set up the testing environment
 */

// Mock browser/chrome APIs globally
global.browser = require('./mocks/browser-api');
global.chrome = global.browser; // Chrome uses 'chrome' instead of 'browser'

// Mock DOMParser if not available
if (typeof DOMParser === 'undefined') {
  global.DOMParser = window.DOMParser;
}

// Mock console methods to reduce noise during tests (optional)
// Uncomment if you want to suppress console output during tests
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Set up fetch mock if needed
global.fetch = jest.fn();

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});

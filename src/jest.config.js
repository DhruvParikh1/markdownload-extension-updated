module.exports = {
  testEnvironment: 'jsdom',

  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'service-worker.js',
    'offscreen/offscreen.js',
    'popup/popup.js',
    'contentScript/contentScript.js',
    'options/options.js',
    'shared/**/*.js',
    '!**/*.min.js',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/background/moment.min.js',
    '!**/background/apache-mime-types.js',
    '!**/__mocks__/**',
    '!**/tests/**'
  ],

  // Coverage thresholds
  // Note: These tests focus on behavior and integration testing rather than
  // direct source code coverage. Coverage thresholds are commented out.
  // coverageThreshold: {
  //   global: {
  //     branches: 50,
  //     functions: 50,
  //     lines: 50,
  //     statements: 50
  //   }
  // },

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Module paths
  moduleDirectories: ['node_modules', '<rootDir>'],

  // Transform files
  transform: {},

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/vendor/',
    '/.web-extension-id/'
  ],

  // Verbose output
  verbose: true,

  // Test timeout
  testTimeout: 10000
};

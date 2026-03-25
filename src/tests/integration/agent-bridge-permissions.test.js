const fs = require('fs');
const path = require('path');

const manifestJson = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../manifest.json'),
  'utf8'
));

describe('Agent Bridge manifest permissions', () => {
  test('nativeMessaging is requested optionally instead of at install time', () => {
    expect(manifestJson.permissions || []).not.toContain('nativeMessaging');
    expect(manifestJson.optional_permissions || []).toContain('nativeMessaging');
  });
});

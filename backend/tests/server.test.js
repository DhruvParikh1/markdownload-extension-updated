const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ConnectionStore } = require('../lib/store');
const { buildPageProperties, normalizeDataSource } = require('../server');

test('ConnectionStore encrypts credentials and resolves connection tokens', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marksnip-notion-'));
  const store = new ConnectionStore({
    filePath: path.join(tempDir, 'connections.json'),
    secret: 'test-secret'
  });

  const { connectionToken, record } = store.upsertConnection({
    botId: 'bot-123',
    workspace: { id: 'ws', name: 'Workspace' },
    credentials: { access_token: 'access', refresh_token: 'refresh' }
  });

  assert.ok(connectionToken);
  assert.ok(record.encryptedCredentials.ciphertext);
  assert.equal(store.findByConnectionToken(connectionToken).botId, 'bot-123');
  assert.deepEqual(
    store.getDecryptedCredentials(store.findByConnectionToken(connectionToken)),
    { access_token: 'access', refresh_token: 'refresh' }
  );

  assert.equal(store.deleteConnection(connectionToken), true);
  assert.equal(store.findByConnectionToken(connectionToken), null);
});

test('buildPageProperties falls back to the schema title property', () => {
  const properties = buildPageProperties({
    destination: { kind: 'data_source' },
    schema: {
      properties: [
        { id: 'name', name: 'Name', type: 'title' },
        { id: 'source', name: 'Source', type: 'url' }
      ]
    },
    title: 'Example',
    mappedProperties: [
      { propertyId: 'source', value: 'https://example.com/post' }
    ]
  });

  assert.deepEqual(properties.Source, { url: 'https://example.com/post' });
  assert.deepEqual(properties.Name, {
    title: [{ type: 'text', text: { content: 'Example' } }]
  });
});

test('normalizeDataSource flattens schema properties for the extension', () => {
  assert.deepEqual(
    normalizeDataSource({
      id: 'ds_123',
      title: 'Clips',
      properties: {
        Name: { id: 'name', type: 'title' },
        Source: { id: 'source', type: 'url' }
      }
    }),
    {
      id: 'ds_123',
      kind: 'data_source',
      name: 'Clips',
      properties: [
        { id: 'name', name: 'Name', type: 'title' },
        { id: 'source', name: 'Source', type: 'url' }
      ]
    }
  );
});

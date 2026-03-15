const http = require('http');
const path = require('path');

const {
  buildNotionPropertyValue,
  splitMarkdownIntoChunks
} = require('../src/shared/notion-utils');
const { ConnectionStore } = require('./lib/store');

const NOTION_VERSION = '2026-03-11';
const NOTION_API_BASE_URL = 'https://api.notion.com/v1';
const NOTION_OAUTH_AUTHORIZE_URL = `${NOTION_API_BASE_URL}/oauth/authorize`;
const NOTION_OAUTH_TOKEN_URL = `${NOTION_API_BASE_URL}/oauth/token`;
const NOTION_OAUTH_REVOKE_URL = `${NOTION_API_BASE_URL}/oauth/revoke`;

function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 8787),
    clientId: env.NOTION_CLIENT_ID || '',
    clientSecret: env.NOTION_CLIENT_SECRET || '',
    notionApiBaseUrl: env.NOTION_API_BASE_URL || NOTION_API_BASE_URL,
    oauthAuthorizeUrl: env.NOTION_OAUTH_AUTHORIZE_URL || NOTION_OAUTH_AUTHORIZE_URL,
    oauthTokenUrl: env.NOTION_OAUTH_TOKEN_URL || NOTION_OAUTH_TOKEN_URL,
    oauthRevokeUrl: env.NOTION_OAUTH_REVOKE_URL || NOTION_OAUTH_REVOKE_URL,
    allowedRedirectUris: String(env.MARKSNIP_ALLOWED_REDIRECT_URIS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean),
    storeKey: env.MARKSNIP_NOTION_STORE_KEY || 'marksnip-dev-store-key',
    dataDir: env.MARKSNIP_DATA_DIR || path.join(__dirname, 'data')
  };
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function empty(res, statusCode = 204) {
  res.writeHead(statusCode, {
    'Cache-Control': 'no-store'
  });
  res.end();
}

function getBasicAuthHeader(config) {
  return `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function createApiError(code, message, status = 500) {
  const error = new Error(message || code);
  error.code = code;
  error.status = status;
  return error;
}

function ensureConfig(config) {
  if (!config.clientId || !config.clientSecret) {
    throw createApiError('backend_unavailable', 'NOTION_CLIENT_ID and NOTION_CLIENT_SECRET must be configured.', 503);
  }
}

function validateRedirectUri(config, redirectUri) {
  if (!config.allowedRedirectUris.length) {
    return;
  }

  if (!config.allowedRedirectUris.includes(redirectUri)) {
    throw createApiError('validation_error', 'Redirect URI is not allowed for this backend.', 400);
  }
}

function extractPlainText(items = []) {
  return (items || []).map(item => {
    if (typeof item?.plain_text === 'string') return item.plain_text;
    if (typeof item?.text?.content === 'string') return item.text.content;
    return '';
  }).join('').trim();
}

function extractPageTitle(page) {
  if (!page?.properties) return page?.url || 'Untitled';

  for (const property of Object.values(page.properties)) {
    if (property?.type === 'title') {
      return extractPlainText(property.title) || page.url || 'Untitled';
    }
  }

  return page?.url || 'Untitled';
}

function normalizeSearchResult(item) {
  if (!item?.id || !item?.object) return null;

  if (item.object === 'page') {
    return {
      id: item.id,
      kind: 'page',
      name: extractPageTitle(item)
    };
  }

  if (item.object === 'data_source') {
    return {
      id: item.id,
      kind: 'data_source',
      name: item.title || item.name || 'Untitled database'
    };
  }

  return null;
}

function normalizeDataSource(dataSource) {
  return {
    id: dataSource.id,
    kind: 'data_source',
    name: dataSource.title || dataSource.name || 'Untitled database',
    properties: Object.entries(dataSource.properties || {}).map(([name, property]) => ({
      id: property.id,
      name,
      type: property.type
    }))
  };
}

function mapNotionApiError(status, payload) {
  const message = payload?.message || payload?.error || `Notion API request failed with status ${status}`;
  const lowered = String(message).toLowerCase();

  if (status === 401) {
    return createApiError('not_connected', message, status);
  }

  if (status === 403 || status === 404) {
    return createApiError('destination_not_shared', message, status);
  }

  if (status === 429) {
    return createApiError('rate_limited', message, status);
  }

  if (status === 400 && lowered.includes('too large')) {
    return createApiError('payload_too_large', message, status);
  }

  if (status >= 400 && status < 500) {
    return createApiError('validation_error', message, status);
  }

  return createApiError('backend_unavailable', message, status);
}

async function notionFetch(config, url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : { message: await response.text() };

  if (!response.ok) {
    throw mapNotionApiError(response.status, payload);
  }

  return payload;
}

async function exchangeAuthorizationCode(config, code, redirectUri) {
  ensureConfig(config);
  validateRedirectUri(config, redirectUri);

  return notionFetch(config, config.oauthTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(config),
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri
    })
  });
}

async function refreshAccessToken(config, refreshToken) {
  ensureConfig(config);

  return notionFetch(config, config.oauthTokenUrl, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(config),
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
}

async function revokeToken(config, accessToken) {
  ensureConfig(config);

  return notionFetch(config, config.oauthRevokeUrl, {
    method: 'POST',
    headers: {
      Authorization: getBasicAuthHeader(config),
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION
    },
    body: JSON.stringify({
      token: accessToken
    })
  });
}

async function notionApiRequest(config, credentials, requestPath, options = {}) {
  const doRequest = async accessToken => {
    return notionFetch(config, `${config.notionApiBaseUrl}${requestPath}`, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${accessToken}`,
        'Notion-Version': NOTION_VERSION,
        Accept: 'application/json'
      }
    });
  };

  try {
    return {
      payload: await doRequest(credentials.access_token),
      credentials
    };
  } catch (error) {
    if (error.code !== 'not_connected' || !credentials.refresh_token) {
      throw error;
    }

    const refreshed = await refreshAccessToken(config, credentials.refresh_token);
    const nextCredentials = {
      ...credentials,
      ...refreshed
    };

    return {
      payload: await doRequest(nextCredentials.access_token),
      credentials: nextCredentials
    };
  }
}

async function getConnectionContext(req, context) {
  const connectionToken = getBearerToken(req);
  if (!connectionToken) {
    throw createApiError('not_connected', 'Missing MarkSnip connection token.', 401);
  }

  const record = context.store.findByConnectionToken(connectionToken);
  if (!record) {
    throw createApiError('not_connected', 'Notion connection not found.', 401);
  }

  return {
    connectionToken,
    record,
    credentials: context.store.getDecryptedCredentials(record)
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildPageProperties({ destination, schema, title, mappedProperties }) {
  if (destination.kind === 'page') {
    return {
      title: buildNotionPropertyValue('title', title)
    };
  }

  const properties = {};
  const schemaById = new Map((schema.properties || []).map(property => [property.id, property]));
  let titleMapped = false;

  for (const item of mappedProperties || []) {
    const property = schemaById.get(item.propertyId);
    if (!property) {
      throw createApiError('validation_error', `Unknown data source property: ${item.propertyId}`, 400);
    }

    const propertyValue = buildNotionPropertyValue(property.type, item.value);
    if (!propertyValue) {
      continue;
    }

    properties[property.name] = propertyValue[property.type] !== undefined
      ? { [property.type]: propertyValue[property.type] }
      : propertyValue;

    if (property.type === 'title') {
      titleMapped = true;
    }
  }

  if (!titleMapped) {
    const titleProperty = (schema.properties || []).find(property => property.type === 'title');
    if (titleProperty) {
      properties[titleProperty.name] = buildNotionPropertyValue('title', title);
    }
  }

  return properties;
}

async function createPageWithMarkdown(context, { destination, title, markdown, mappedProperties }) {
  let schema = destination.schema;
  if (destination.kind === 'data_source') {
    const dataSourceResponse = await notionApiRequest(
      context.config,
      context.credentials,
      `/data-sources/${encodeURIComponent(destination.id)}`
    );
    context.credentials = dataSourceResponse.credentials;
    schema = normalizeDataSource(dataSourceResponse.payload);
  }

  const chunks = splitMarkdownIntoChunks(markdown, 16000);
  const properties = buildPageProperties({
    destination,
    schema,
    title,
    mappedProperties
  });

  const createBody = {
    parent: destination.kind === 'page'
      ? { page_id: destination.id }
      : { data_source_id: destination.id },
    properties,
    markdown: chunks[0]
  };

  const createResponse = await notionApiRequest(
    context.config,
    context.credentials,
    '/pages',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(createBody)
    }
  );
  context.credentials = createResponse.credentials;

  const page = createResponse.payload;
  for (const chunk of chunks.slice(1)) {
    await sleep(350);
    const appendResponse = await notionApiRequest(
      context.config,
      context.credentials,
      `/pages/${encodeURIComponent(page.id)}/markdown`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          markdown: chunk
        })
      }
    );
    context.credentials = appendResponse.credentials;
  }

  context.store.updateCredentials(context.connectionToken, context.credentials);

  return {
    id: page.id,
    url: page.url
  };
}

async function handleRequest(req, res, context) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true });
    }

    if (req.method === 'GET' && url.pathname === '/notion/config') {
      ensureConfig(context.config);
      return json(res, 200, {
        clientId: context.config.clientId,
        authorizationUrl: context.config.oauthAuthorizeUrl
      });
    }

    if (req.method === 'POST' && url.pathname === '/notion/oauth/exchange') {
      const body = await readJsonBody(req);
      const oauthResponse = await exchangeAuthorizationCode(context.config, body.code, body.redirectUri);
      const workspace = {
        id: oauthResponse.workspace_id || '',
        name: oauthResponse.workspace_name || 'Notion Workspace',
        icon: oauthResponse.workspace_icon || '',
        botId: oauthResponse.bot_id || oauthResponse.owner?.bot_id || ''
      };

      const { connectionToken } = context.store.upsertConnection({
        botId: workspace.botId,
        workspace,
        credentials: oauthResponse,
        existingConnectionToken: body.existingConnectionToken
      });

      return json(res, 200, {
        connectionToken,
        workspace
      });
    }

    if (req.method === 'POST' && url.pathname === '/notion/search') {
      const body = await readJsonBody(req);
      const connection = await getConnectionContext(req, context);
      const searchResponse = await notionApiRequest(
        context.config,
        connection.credentials,
        '/search',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: body.query || '',
            filter: {
              property: 'object',
              value: body.kind === 'data_source' ? 'data_source' : 'page'
            },
            start_cursor: body.startCursor || undefined
          })
        }
      );

      context.store.updateCredentials(connection.connectionToken, searchResponse.credentials);

      return json(res, 200, {
        results: (searchResponse.payload.results || [])
          .map(normalizeSearchResult)
          .filter(Boolean),
        nextCursor: searchResponse.payload.next_cursor || null
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/notion/data-sources/')) {
      const id = decodeURIComponent(url.pathname.split('/').pop());
      const connection = await getConnectionContext(req, context);
      const response = await notionApiRequest(
        context.config,
        connection.credentials,
        `/data-sources/${encodeURIComponent(id)}`
      );
      context.store.updateCredentials(connection.connectionToken, response.credentials);
      const normalized = normalizeDataSource(response.payload);

      return json(res, 200, {
        id: normalized.id,
        kind: 'data_source',
        name: normalized.name,
        properties: normalized.properties
      });
    }

    if (req.method === 'POST' && url.pathname === '/notion/pages') {
      const body = await readJsonBody(req);
      const connection = await getConnectionContext(req, context);
      const page = await createPageWithMarkdown({
        ...connection,
        config: context.config,
        store: context.store
      }, body);

      return json(res, 200, { page });
    }

    if (req.method === 'POST' && url.pathname === '/notion/disconnect') {
      const connection = await getConnectionContext(req, context);
      await revokeToken(context.config, connection.credentials.access_token).catch(() => {});
      context.store.deleteConnection(connection.connectionToken);
      return empty(res, 204);
    }

    return json(res, 404, {
      error: {
        code: 'backend_unavailable',
        message: 'Route not found.'
      }
    });
  } catch (error) {
    const status = error?.status || 500;
    return json(res, status, {
      error: {
        code: error?.code || 'backend_unavailable',
        message: error?.message || 'Unexpected backend error'
      }
    });
  }
}

function createServer(customConfig = {}) {
  const config = {
    ...loadConfig(),
    ...customConfig
  };
  const store = customConfig.store || new ConnectionStore({
    filePath: path.join(config.dataDir, 'connections.json'),
    secret: config.storeKey
  });

  return http.createServer((req, res) => handleRequest(req, res, {
    config,
    store
  }));
}

if (require.main === module) {
  const server = createServer();
  const config = loadConfig();
  server.listen(config.port, () => {
    console.log(`MarkSnip Notion backend listening on http://localhost:${config.port}`);
  });
}

module.exports = {
  buildPageProperties,
  createServer,
  handleRequest,
  loadConfig,
  mapNotionApiError,
  normalizeDataSource,
  normalizeSearchResult
};

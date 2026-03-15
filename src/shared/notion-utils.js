(function(root) {
  const exportApi = root.markSnipExportUtils || (
    typeof require !== 'undefined' ? require('./export-utils') : null
  );

  const DEFAULT_NOTION_BACKEND_URL = 'http://localhost:8787';

  const DEFAULT_NOTION_STATE = Object.freeze({
    connected: false,
    connectionToken: '',
    workspace: null,
    defaultDestination: null,
    propertyMappings: {
      title: '',
      sourceUrl: '',
      clippedAt: '',
      tags: ''
    },
    alsoDownloadMd: false,
    backendBaseUrl: DEFAULT_NOTION_BACKEND_URL
  });

  const PROPERTY_TYPE_RULES = Object.freeze({
    title: ['title'],
    sourceUrl: ['url', 'rich_text'],
    clippedAt: ['date', 'rich_text'],
    tags: ['multi_select', 'rich_text']
  });

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function sanitizeBackendUrl(url) {
    const raw = typeof url === 'string' && url.trim()
      ? url.trim()
      : DEFAULT_NOTION_BACKEND_URL;

    return raw.replace(/\/+$/, '');
  }

  function normalizeWorkspace(workspace) {
    if (!workspace || typeof workspace !== 'object') {
      return null;
    }

    return {
      id: workspace.id || '',
      name: workspace.name || '',
      icon: workspace.icon || '',
      botId: workspace.botId || workspace.bot_id || ''
    };
  }

  function normalizeDestination(destination) {
    if (!destination || typeof destination !== 'object' || !destination.id) {
      return null;
    }

    return {
      id: String(destination.id),
      name: String(destination.name || destination.title || ''),
      kind: destination.kind === 'data_source' ? 'data_source' : 'page',
      schema: destination.schema && typeof destination.schema === 'object'
        ? {
            id: String(destination.schema.id || destination.id),
            properties: Array.isArray(destination.schema.properties)
              ? destination.schema.properties.map(normalizeProperty)
              : []
          }
        : null
    };
  }

  function normalizeProperty(property) {
    if (!property || typeof property !== 'object') {
      return null;
    }

    return {
      id: String(property.id || ''),
      name: String(property.name || ''),
      type: String(property.type || '')
    };
  }

  function normalizePropertyMappings(mappings) {
    const nextMappings = clone(DEFAULT_NOTION_STATE.propertyMappings);
    for (const key of Object.keys(nextMappings)) {
      if (mappings && typeof mappings[key] === 'string') {
        nextMappings[key] = mappings[key];
      }
    }
    return nextMappings;
  }

  function normalizeNotionState(raw = {}) {
    return {
      connected: Boolean(raw.connected && raw.connectionToken),
      connectionToken: typeof raw.connectionToken === 'string' ? raw.connectionToken : '',
      workspace: normalizeWorkspace(raw.workspace),
      defaultDestination: normalizeDestination(raw.defaultDestination),
      propertyMappings: normalizePropertyMappings(raw.propertyMappings),
      alsoDownloadMd: Boolean(raw.alsoDownloadMd),
      backendBaseUrl: sanitizeBackendUrl(raw.backendBaseUrl)
    };
  }

  function hasConnection(notionState = {}) {
    return Boolean(notionState.connected && notionState.connectionToken);
  }

  function hasDefaultDestination(notionState = {}) {
    return Boolean(notionState.defaultDestination?.id && notionState.defaultDestination?.kind);
  }

  function getNotionTransportOptions(options = {}) {
    const nextOptions = {
      ...options,
      includeTemplate: false,
      frontmatter: '',
      backmatter: '',
      downloadImages: false
    };

    if (nextOptions.imageStyle !== 'noImage') {
      nextOptions.imageStyle = 'markdown';
    }

    return nextOptions;
  }

  function buildRichTextArray(value, maxLength = 1800) {
    const text = String(value || '');
    if (!text) {
      return [];
    }

    const chunks = [];
    for (let index = 0; index < text.length; index += maxLength) {
      chunks.push({
        type: 'text',
        text: {
          content: text.slice(index, index + maxLength)
        }
      });
    }
    return chunks;
  }

  function buildNotionClipMetadata(article = {}, overrides = {}) {
    const clipTimestamp = overrides.clippedAt || new Date().toISOString();
    const rawTags = Array.isArray(article.keywords)
      ? article.keywords
      : typeof article.keywords === 'string'
        ? article.keywords.split(',').map(tag => tag.trim())
        : [];
    const overrideTags = Array.isArray(overrides.tags)
      ? overrides.tags.filter(Boolean)
      : [];

    return {
      title: String(overrides.title || article.title || article.pageTitle || 'Untitled'),
      sourceUrl: String(overrides.sourceUrl || article.pageURL || article.baseURI || ''),
      clippedAt: clipTimestamp,
      tags: overrideTags.length ? overrideTags : rawTags.filter(Boolean)
    };
  }

  function getEligiblePropertyTypes(mappingKey) {
    return PROPERTY_TYPE_RULES[mappingKey] || [];
  }

  function isEligibleProperty(mappingKey, property) {
    if (!property || !property.type) return false;
    return getEligiblePropertyTypes(mappingKey).includes(property.type);
  }

  function filterEligibleProperties(schemaProperties = [], mappingKey) {
    return (schemaProperties || []).filter(property => isEligibleProperty(mappingKey, property));
  }

  function buildPropertyDescriptor(propertyId, properties = []) {
    return (properties || []).find(property => property?.id === propertyId) || null;
  }

  function buildNotionPropertyValue(propertyType, value) {
    switch (propertyType) {
      case 'title':
        return { title: buildRichTextArray(value) };
      case 'url':
        return { url: value ? String(value) : null };
      case 'rich_text':
        return { rich_text: buildRichTextArray(value) };
      case 'date':
        return { date: value ? { start: String(value) } : null };
      case 'multi_select':
        return {
          multi_select: Array.isArray(value)
            ? value.filter(Boolean).map(name => ({ name: String(name) }))
            : []
        };
      default:
        return null;
    }
  }

  function buildMappedPropertyPayload({
    destination,
    propertyMappings,
    clipMeta,
    titleOverride
  }) {
    if (!destination || destination.kind !== 'data_source') {
      return [];
    }

    const normalizedDestination = normalizeDestination(destination);
    const mappings = normalizePropertyMappings(propertyMappings);
    const metadata = {
      ...buildNotionClipMetadata({}, clipMeta),
      title: String(titleOverride || clipMeta?.title || 'Untitled')
    };

    const mappingValues = {
      title: metadata.title,
      sourceUrl: metadata.sourceUrl,
      clippedAt: metadata.clippedAt,
      tags: metadata.tags
    };

    const results = [];
    for (const mappingKey of Object.keys(mappings)) {
      const propertyId = mappings[mappingKey];
      if (!propertyId) continue;

      const property = buildPropertyDescriptor(propertyId, normalizedDestination?.schema?.properties || []);
      if (!property || !isEligibleProperty(mappingKey, property)) continue;

      const propertyValue = buildNotionPropertyValue(property.type, mappingValues[mappingKey]);
      if (!propertyValue) continue;

      results.push({
        mappingKey,
        propertyId: property.id,
        propertyName: property.name,
        propertyType: property.type,
        value: mappingValues[mappingKey],
        propertyValue
      });
    }

    return results;
  }

  function splitMarkdownIntoChunks(markdown, maxChunkLength = 16000) {
    const text = String(markdown || '');
    if (!text) return [''];
    if (text.length <= maxChunkLength) return [text];

    const lines = text.split('\n');
    const chunks = [];
    let current = [];
    let currentLength = 0;
    let inFence = false;

    function pushChunk() {
      if (current.length === 0) return;
      chunks.push(current.join('\n'));
      current = [];
      currentLength = 0;
    }

    function pushLongLine(line) {
      let remaining = line;
      while (remaining.length > maxChunkLength) {
        chunks.push(remaining.slice(0, maxChunkLength));
        remaining = remaining.slice(maxChunkLength);
      }
      if (remaining) {
        current = [remaining];
        currentLength = remaining.length;
      }
    }

    for (const line of lines) {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
      }

      const lineLength = line.length + (current.length > 0 ? 1 : 0);
      const shouldSplit = currentLength > 0 && (currentLength + lineLength) > maxChunkLength && !inFence;

      if (shouldSplit) {
        pushChunk();
      }

      if (line.length > maxChunkLength) {
        pushChunk();
        pushLongLine(line);
        continue;
      }

      current.push(line);
      currentLength += lineLength;
    }

    pushChunk();
    return chunks.filter(chunk => chunk.length > 0);
  }

  function stripRenderedTemplate(markdown, renderedFrontmatter = '', renderedBackmatter = '') {
    return exportApi
      ? exportApi.stripRenderedWrappers(markdown, renderedFrontmatter, renderedBackmatter)
      : markdown;
  }

  const api = {
    DEFAULT_NOTION_BACKEND_URL,
    DEFAULT_NOTION_STATE,
    buildMappedPropertyPayload,
    buildNotionClipMetadata,
    buildNotionPropertyValue,
    buildRichTextArray,
    filterEligibleProperties,
    getEligiblePropertyTypes,
    getNotionTransportOptions,
    hasConnection,
    hasDefaultDestination,
    isEligibleProperty,
    normalizeDestination,
    normalizeNotionState,
    normalizeProperty,
    sanitizeBackendUrl,
    splitMarkdownIntoChunks,
    stripRenderedTemplate
  };

  root.markSnipNotion = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipWebhookUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  function getDefaultWebhookBodyTemplate() {
    if (typeof root.defaultOptions?.defaultWebhookBodyTemplate === 'string' && root.defaultOptions.defaultWebhookBodyTemplate.trim()) {
      return root.defaultOptions.defaultWebhookBodyTemplate;
    }

    if (typeof require === 'function') {
      try {
        const defaultsApi = require('./default-options');
        const template = defaultsApi?.defaultOptions?.defaultWebhookBodyTemplate;
        if (typeof template === 'string' && template.trim()) {
          return template;
        }
      } catch {}
    }

    throw new Error('Default webhook body template is unavailable');
  }

  function getTemplateUtils() {
    if (root.markSnipTemplateUtils) {
      return root.markSnipTemplateUtils;
    }

    if (typeof require === 'function') {
      try {
        return require('./template-utils');
      } catch {
        return {
          textReplace: (value) => String(value || '')
        };
      }
    }

    return {
      textReplace: (value) => String(value || '')
    };
  }

  function createContentSentinel(template, content) {
    let sentinel = '__MARKSNIP_WEBHOOK_CONTENT__';
    const templateText = String(template || '');
    const contentText = String(content || '');

    while (templateText.includes(sentinel) || contentText.includes(sentinel)) {
      sentinel += '_X';
    }

    return sentinel;
  }

  function normalizeWebhookKeywords(keywords) {
    if (!Array.isArray(keywords)) {
      return [];
    }

    return keywords.reduce((normalized, keyword) => {
      const value = String(keyword || '').trim();
      if (value) {
        normalized.push(value);
      }
      return normalized;
    }, []);
  }

  function buildWebhookSendMessage({ targetId, markdown, title, sourceUrl, clipState } = {}) {
    const content = String(markdown ?? clipState?.markdown ?? '');
    const resolvedTitle = String(title ?? clipState?.title ?? '').trim();
    const resolvedSourceUrl = String(sourceUrl ?? clipState?.pageUrl ?? '').trim();
    const article = {
      title: resolvedTitle,
      content,
      pageURL: resolvedSourceUrl,
      excerpt: String(clipState?.excerpt ?? ''),
      byline: String(clipState?.byline ?? ''),
      keywords: normalizeWebhookKeywords(clipState?.keywords),
      publishedTime: String(clipState?.publishedTime ?? '').trim()
    };

    return {
      type: 'webhook-send',
      targetId,
      markdown: content,
      title: resolvedTitle,
      sourceUrl: resolvedSourceUrl,
      article
    };
  }

  function buildWebhookArticleFromMessage(message = {}) {
    const messageArticle = message?.article && typeof message.article === 'object'
      ? message.article
      : {};

    return {
      title: String(messageArticle.title ?? message.title ?? '').trim(),
      content: String(messageArticle.content ?? message.markdown ?? ''),
      pageURL: String(messageArticle.pageURL ?? message.sourceUrl ?? '').trim(),
      excerpt: String(messageArticle.excerpt ?? ''),
      byline: String(messageArticle.byline ?? ''),
      keywords: normalizeWebhookKeywords(messageArticle.keywords),
      publishedTime: String(messageArticle.publishedTime ?? '').trim()
    };
  }

  function renderWebhookTemplateString(template, article) {
    if (typeof template !== 'string' || !template) {
      return template;
    }

    const templateUtils = getTemplateUtils();
    const content = String(article?.content || '');
    const sentinel = createContentSentinel(template, content);
    const preparedTemplate = template.replace(/\{content\}/g, sentinel);
    const renderedTemplate = typeof templateUtils.textReplace === 'function'
      ? templateUtils.textReplace(preparedTemplate, article || {})
      : preparedTemplate;

    return renderedTemplate.split(sentinel).join(content);
  }

  function renderWebhookJsonValue(value, article) {
    if (typeof value === 'string') {
      return renderWebhookTemplateString(value, article);
    }

    if (Array.isArray(value)) {
      return value.map((item) => renderWebhookJsonValue(item, article));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).reduce((result, [key, nestedValue]) => {
        result[renderWebhookTemplateString(key, article)] = renderWebhookJsonValue(nestedValue, article);
        return result;
      }, {});
    }

    return value;
  }

  function renderWebhookJsonBody(bodyTemplate, article) {
    const effectiveTemplate = String(bodyTemplate || getDefaultWebhookBodyTemplate()).trim();
    const parsedTemplate = JSON.parse(effectiveTemplate);
    const renderedPayload = renderWebhookJsonValue(parsedTemplate, article);
    return JSON.stringify(renderedPayload);
  }

  function buildWebhookHeaders(headers, article) {
    const renderedHeaders = {};

    if (Array.isArray(headers)) {
      headers.forEach((header) => {
        const key = renderWebhookTemplateString(String(header?.key || '').trim(), article);
        if (!key) {
          return;
        }

        renderedHeaders[key] = renderWebhookTemplateString(String(header?.value || ''), article);
      });
    }

    const hasContentTypeHeader = Object.keys(renderedHeaders)
      .some((key) => key.toLowerCase() === 'content-type');

    if (!hasContentTypeHeader) {
      renderedHeaders['Content-Type'] = 'application/json';
    }

    return renderedHeaders;
  }

  function compactWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ').trim();
  }

  function truncateWebhookMessage(value, maxLength = 160) {
    const text = compactWhitespace(value);
    if (!text) {
      return '';
    }

    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
  }

  function parseNestedWebhookValue(value) {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }

    if (!/^[\[{]/.test(trimmed)) {
      return trimmed;
    }

    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  function collectWebhookSummaryParts(value, parts = [], seen = new Set()) {
    if (parts.length >= 3 || value == null) {
      return parts;
    }

    if (typeof value === 'string') {
      const text = compactWhitespace(value);
      if (!text || text.toLowerCase() === 'null') {
        return parts;
      }

      if (text.includes(', ')) {
        text.split(', ').forEach((segment) => {
          if (parts.length < 3) {
            collectWebhookSummaryParts(segment, parts, seen);
          }
        });
        return parts;
      }

      if (!seen.has(text)) {
        seen.add(text);
        parts.push(text);
      }
      return parts;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (parts.length < 3) {
          collectWebhookSummaryParts(parseNestedWebhookValue(item), parts, seen);
        }
      });
      return parts;
    }

    if (typeof value === 'object') {
      const objectEntries = Object.entries(value);
      if (objectEntries.length === 1) {
        const [, onlyValue] = objectEntries[0];
        collectWebhookSummaryParts(parseNestedWebhookValue(onlyValue), parts, seen);
        return parts;
      }

      const beforePriorityCount = parts.length;
      ['message', 'error', 'details', 'detail', 'data'].forEach((key) => {
        if (parts.length < 3 && Object.prototype.hasOwnProperty.call(value, key)) {
          collectWebhookSummaryParts(parseNestedWebhookValue(value[key]), parts, seen);
        }
      });

      if (parts.length > beforePriorityCount || parts.length >= 3) {
        return parts;
      }

      objectEntries.forEach(([key, nestedValue]) => {
        if (parts.length >= 3 || ['message', 'error', 'details', 'detail', 'data'].includes(key)) {
          return;
        }

        const candidateParts = [];
        collectWebhookSummaryParts(parseNestedWebhookValue(nestedValue), candidateParts, new Set());
        if (!candidateParts.length) {
          return;
        }

        const entryText = compactWhitespace(`${key}: ${candidateParts.join(', ')}`);
        if (entryText && !seen.has(entryText)) {
          seen.add(entryText);
          parts.push(entryText);
        }
      });
    }

    return parts;
  }

  function summarizeWebhookResponseText(responseText, maxLength = 160) {
    const rawText = String(responseText || '').trim();
    if (!rawText) {
      return '';
    }

    let source = rawText;
    try {
      source = JSON.parse(rawText);
    } catch {}

    const parts = collectWebhookSummaryParts(parseNestedWebhookValue(source));
    const summary = parts.length > 1
      ? `${parts[0]}: ${parts.slice(1).join(', ')}`
      : (parts[0] || '');
    return truncateWebhookMessage(summary || rawText, maxLength);
  }

  function resolveWebhookSendErrorMessage(error, fallback = 'Failed to send to webhook target') {
    if (typeof error === 'string' && error.trim()) {
      return error.trim();
    }

    if (typeof error?.message === 'string' && error.message.trim()) {
      return error.message.trim();
    }

    return fallback;
  }

  function buildWebhookFetchRequest({ target, article } = {}) {
    return {
      url: renderWebhookTemplateString(String(target?.url || ''), article),
      method: String(target?.method || 'POST').trim().toUpperCase() || 'POST',
      headers: buildWebhookHeaders(target?.headers, article),
      body: renderWebhookJsonBody(target?.bodyTemplate, article)
    };
  }

  const api = {
    buildWebhookSendMessage,
    buildWebhookArticleFromMessage,
    normalizeWebhookKeywords,
    renderWebhookTemplateString,
    renderWebhookJsonBody,
    buildWebhookFetchRequest,
    summarizeWebhookResponseText,
    resolveWebhookSendErrorMessage
  };

  Object.defineProperty(api, 'DEFAULT_WEBHOOK_BODY_TEMPLATE', {
    enumerable: true,
    get: getDefaultWebhookBodyTemplate
  });

  return api;
});

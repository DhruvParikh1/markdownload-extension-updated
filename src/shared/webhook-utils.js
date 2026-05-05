(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(root);
    return;
  }

  root.markSnipWebhookUtils = factory(root);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  const DEFAULT_WEBHOOK_BODY_TEMPLATE = JSON.stringify({
    title: '{title}',
    content: '{content}',
    source: '{pageURL}',
    date: '{date:YYYY-MM-DD}'
  });

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
    const effectiveTemplate = String(bodyTemplate || DEFAULT_WEBHOOK_BODY_TEMPLATE).trim();
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

  function buildWebhookFetchRequest({ target, article } = {}) {
    return {
      url: renderWebhookTemplateString(String(target?.url || ''), article),
      method: String(target?.method || 'POST').trim().toUpperCase() || 'POST',
      headers: buildWebhookHeaders(target?.headers, article),
      body: renderWebhookJsonBody(target?.bodyTemplate, article)
    };
  }

  return {
    DEFAULT_WEBHOOK_BODY_TEMPLATE,
    renderWebhookTemplateString,
    renderWebhookJsonBody,
    buildWebhookFetchRequest
  };
});

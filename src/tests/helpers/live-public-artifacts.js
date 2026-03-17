const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex');
}

function sanitizePathSegment(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'case';
}

function createRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function normalizeText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getCaseId(liveCase) {
  if (liveCase?.id) {
    return sanitizePathSegment(liveCase.id);
  }

  try {
    const url = new URL(liveCase?.url || '');
    return sanitizePathSegment(`${url.hostname}${url.pathname}`);
  } catch {
    return sanitizePathSegment(liveCase?.name || 'live-public-case');
  }
}

function getCasePaths(rootDir, liveCase) {
  const caseId = getCaseId(liveCase);
  const caseDir = path.join(rootDir, caseId);

  return {
    caseId,
    caseDir,
    latestDir: path.join(caseDir, 'latest-success'),
    historyDir: path.join(caseDir, 'history')
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function writeText(filePath, content) {
  fs.writeFileSync(filePath, String(content || ''), 'utf8');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function diffLists(previousList = [], currentList = []) {
  const previous = new Set((previousList || []).filter(Boolean));
  const current = new Set((currentList || []).filter(Boolean));

  return {
    added: Array.from(current).filter(item => !previous.has(item)).slice(0, 12),
    removed: Array.from(previous).filter(item => !current.has(item)).slice(0, 12)
  };
}

function summarizePageCapture(liveCase, pageCapture = {}) {
  const html = String(pageCapture.html || '');
  const meta = pageCapture.meta || {};
  const textForHash = [
    meta.pageTitle,
    meta.finalUrl,
    meta.selectorText,
    ...(meta.headings || []),
    meta.mainTextExcerpt
  ].join('\n');

  return {
    requestedUrl: liveCase.url,
    finalUrl: meta.finalUrl || '',
    responseStatus: meta.responseStatus ?? null,
    pageTitle: meta.pageTitle || '',
    selector: liveCase.selector,
    selectorText: meta.selectorText || '',
    headings: meta.headings || [],
    mainTextExcerpt: meta.mainTextExcerpt || '',
    bodyTextExcerpt: meta.bodyTextExcerpt || '',
    htmlLength: html.length,
    htmlHash: sha256(html),
    textHash: sha256(textForHash)
  };
}

function summarizeClipCapture(liveCase, clipCapture = null) {
  if (!clipCapture) {
    return null;
  }

  const markdown = String(clipCapture.markdown || '').replace(/\r\n/g, '\n');

  return {
    clippedTitle: String(clipCapture.title || ''),
    markdownLength: markdown.length,
    markdownHash: sha256(markdown),
    markdownExcerpt: normalizeText(markdown).slice(0, 1200),
    titleMatchesExpected: liveCase.titleContains
      ? String(clipCapture.title || '').includes(liveCase.titleContains)
      : true,
    snippetChecks: (liveCase.snippets || []).map((snippet) => ({
      snippet,
      present: markdown.includes(snippet)
    }))
  };
}

function createSnapshotRecord(liveCase, pageCapture, clipCapture, options = {}) {
  return {
    caseId: getCaseId(liveCase),
    caseName: liveCase.name,
    runAt: options.runAt || new Date().toISOString(),
    status: options.status || 'unknown',
    failureMessage: options.failureMessage || null,
    page: summarizePageCapture(liveCase, pageCapture),
    clip: summarizeClipCapture(liveCase, clipCapture)
  };
}

function loadLatestSuccessfulRun(rootDir, liveCase) {
  const { latestDir } = getCasePaths(rootDir, liveCase);
  const summaryPath = path.join(latestDir, 'summary.json');
  const summary = readJsonIfExists(summaryPath);

  if (!summary) {
    return null;
  }

  return {
    summary,
    summaryPath,
    htmlPath: path.join(latestDir, 'page.html'),
    markdownPath: path.join(latestDir, 'clip.md')
  };
}

function buildComparison(previousRun, currentRecord) {
  if (!previousRun?.summary) {
    return {
      hasPreviousSuccess: false,
      note: 'No previous successful run recorded for this case.'
    };
  }

  const previous = previousRun.summary;
  const previousPage = previous.page || {};
  const currentPage = currentRecord.page || {};
  const previousClip = previous.clip || {};
  const currentClip = currentRecord.clip || {};
  const headingDiff = diffLists(previousPage.headings, currentPage.headings);

  return {
    hasPreviousSuccess: true,
    previousSuccessfulRunAt: previous.runAt || null,
    pageChanged: (
      previousPage.htmlHash !== currentPage.htmlHash ||
      previousPage.textHash !== currentPage.textHash ||
      previousPage.finalUrl !== currentPage.finalUrl ||
      previousPage.pageTitle !== currentPage.pageTitle
    ),
    clipChanged: Boolean(
      previousClip.markdownHash &&
      currentClip.markdownHash &&
      previousClip.markdownHash !== currentClip.markdownHash
    ),
    page: {
      titleChanged: previousPage.pageTitle !== currentPage.pageTitle,
      finalUrlChanged: previousPage.finalUrl !== currentPage.finalUrl,
      selectorTextChanged: previousPage.selectorText !== currentPage.selectorText,
      previousTitle: previousPage.pageTitle || '',
      currentTitle: currentPage.pageTitle || '',
      previousFinalUrl: previousPage.finalUrl || '',
      currentFinalUrl: currentPage.finalUrl || '',
      headingsAdded: headingDiff.added,
      headingsRemoved: headingDiff.removed
    },
    clip: currentRecord.clip ? {
      clippedTitleChanged: previousClip.clippedTitle !== currentClip.clippedTitle,
      markdownChanged: previousClip.markdownHash !== currentClip.markdownHash,
      previousClippedTitle: previousClip.clippedTitle || '',
      currentClippedTitle: currentClip.clippedTitle || '',
      previousSnippetChecks: previousClip.snippetChecks || [],
      currentSnippetChecks: currentClip.snippetChecks || []
    } : null
  };
}

function persistSnapshotRun(rootDir, liveCase, record, pageCapture, clipCapture, comparison) {
  const { historyDir, latestDir } = getCasePaths(rootDir, liveCase);
  const runDate = new Date(record.runAt || new Date().toISOString());
  const runDir = path.join(historyDir, `${createRunId(runDate)}-${record.status}`);

  ensureDir(runDir);
  writeJson(path.join(runDir, 'summary.json'), record);
  writeJson(path.join(runDir, 'comparison-to-latest.json'), comparison || {});

  if (pageCapture?.html) {
    writeText(path.join(runDir, 'page.html'), pageCapture.html);
  }

  if (clipCapture?.markdown != null) {
    writeText(path.join(runDir, 'clip.md'), clipCapture.markdown);
  }

  if (record.status === 'passed') {
    ensureDir(latestDir);
    writeJson(path.join(latestDir, 'summary.json'), record);
    writeJson(path.join(latestDir, 'comparison-to-latest.json'), comparison || {});

    if (pageCapture?.html) {
      writeText(path.join(latestDir, 'page.html'), pageCapture.html);
    }

    if (clipCapture?.markdown != null) {
      writeText(path.join(latestDir, 'clip.md'), clipCapture.markdown);
    }
  }

  return {
    runDir,
    summaryPath: path.join(runDir, 'summary.json'),
    comparisonPath: path.join(runDir, 'comparison-to-latest.json'),
    pagePath: path.join(runDir, 'page.html'),
    markdownPath: path.join(runDir, 'clip.md')
  };
}

function formatComparisonForFailure(comparison, persistedRunDir) {
  const lines = ['Live snapshot comparison against the previous successful run:'];

  if (!comparison?.hasPreviousSuccess) {
    lines.push('No previous successful snapshot exists for this case yet.');
  } else {
    lines.push(`Previous successful run: ${comparison.previousSuccessfulRunAt || 'unknown'}`);
    lines.push(`Page changed: ${comparison.pageChanged ? 'yes' : 'no'}`);
    lines.push(`Clip changed: ${comparison.clipChanged ? 'yes' : 'no'}`);
    lines.push(`Page title changed: ${comparison.page?.titleChanged ? 'yes' : 'no'}`);
    lines.push(`Final URL changed: ${comparison.page?.finalUrlChanged ? 'yes' : 'no'}`);
    lines.push(`Selector text changed: ${comparison.page?.selectorTextChanged ? 'yes' : 'no'}`);

    if (comparison.page?.headingsAdded?.length) {
      lines.push(`Headings added: ${comparison.page.headingsAdded.join(' | ')}`);
    }
    if (comparison.page?.headingsRemoved?.length) {
      lines.push(`Headings removed: ${comparison.page.headingsRemoved.join(' | ')}`);
    }
  }

  if (persistedRunDir) {
    lines.push(`Current run artifacts: ${persistedRunDir}`);
  }

  return lines.join('\n');
}

async function attachSnapshotArtifacts(testInfo, persistedArtifacts) {
  if (!testInfo || !persistedArtifacts) {
    return;
  }

  const attachments = [
    {
      name: 'live-public-summary',
      path: persistedArtifacts.summaryPath,
      contentType: 'application/json'
    },
    {
      name: 'live-public-comparison',
      path: persistedArtifacts.comparisonPath,
      contentType: 'application/json'
    }
  ];

  if (fs.existsSync(persistedArtifacts.markdownPath)) {
    attachments.push({
      name: 'live-public-markdown',
      path: persistedArtifacts.markdownPath,
      contentType: 'text/markdown'
    });
  }

  if (fs.existsSync(persistedArtifacts.pagePath)) {
    attachments.push({
      name: 'live-public-page-html',
      path: persistedArtifacts.pagePath,
      contentType: 'text/html'
    });
  }

  for (const attachment of attachments) {
    await testInfo.attach(attachment.name, {
      path: attachment.path,
      contentType: attachment.contentType
    });
  }
}

module.exports = {
  createSnapshotRecord,
  loadLatestSuccessfulRun,
  buildComparison,
  persistSnapshotRun,
  formatComparisonForFailure,
  attachSnapshotArtifacts
};

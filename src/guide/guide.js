/**
 * MarkSnip — User Guide Page
 *
 * Handles:
 *  - Theme + accent sync from stored settings
 *  - Section-level fuzzy search (via shared search-core.js)
 *  - TOC active-state tracking (IntersectionObserver)
 *  - Keyboard navigation (/, Escape, anchor focus management)
 *  - Open Settings action
 */
(function () {
  'use strict';

  const core = globalThis.markSnipSearchCore;
  const SPECIAL_THEME_CLASS_NAMES = ['special-theme-claude', 'special-theme-perplexity', 'special-theme-openai', 'special-theme-atla', 'special-theme-ben10', 'special-theme-colorblind'];
  const COLORBLIND_VARIANT_CLASS_NAMES = ['colorblind-theme-deuteranopia', 'colorblind-theme-protanopia', 'colorblind-theme-tritanopia'];
  const ACCENT_CLASS_NAMES = ['accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber'];

  function normalizeColorBlindTheme(value) {
    return ['deuteranopia', 'protanopia', 'tritanopia'].includes(value) ? value : 'deuteranopia';
  }

  /* ════════════════════════════════════════
     Theme & Accent
     ════════════════════════════════════════ */
  function applyThemeSettings(opts) {
    const root = document.documentElement;
    const specialTheme = opts.specialTheme || 'none';
    root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    root.classList.add('theme-' + (opts.popupTheme || 'system'));

    root.classList.remove(...SPECIAL_THEME_CLASS_NAMES);
    root.classList.remove(...COLORBLIND_VARIANT_CLASS_NAMES);
    if (specialTheme !== 'none') {
      root.classList.add('special-theme-' + specialTheme);
      if (specialTheme === 'colorblind') {
        root.classList.add('colorblind-theme-' + normalizeColorBlindTheme(opts.colorBlindTheme));
      }
    }

    root.classList.remove(...ACCENT_CLASS_NAMES);
    const accent = opts.popupAccent || 'sage';
    if (specialTheme === 'none' && accent !== 'sage') root.classList.add('accent-' + accent);
  }

  function loadSettings() {
    if (typeof browser === 'undefined' || !browser?.storage?.sync) return;
    browser.storage.sync.get(defaultOptions).then(opts => {
      applyThemeSettings(opts);
    }).catch(() => {});
  }

  /* ════════════════════════════════════════
     Search Index
     ════════════════════════════════════════ */
  function buildGuideSearchIndex() {
    const sections = document.querySelectorAll('[data-guide-section]');
    const index = [];

    sections.forEach(el => {
      const entry = {
        element: el,
        id: el.id,
        fields: [],
        fieldKeys: new Set()
      };

      // Title
      const title = el.getAttribute('data-guide-section');
      addGuideField(entry, title, { source: 'title', primary: true, qualifies: true });

      // Summary
      const summary = el.getAttribute('data-guide-summary');
      addGuideField(entry, summary, { source: 'summary', primary: true, qualifies: true });

      // Search keywords / aliases
      const keywords = el.getAttribute('data-search-keywords');
      if (keywords) {
        keywords.split(',').forEach(kw => {
          addGuideField(entry, kw.trim(), { source: 'alias', primary: true, qualifies: true, isAlias: true, allowFuzzy: true });
        });
      }

      // Parent section title (for subsections)
      const parentSection = el.closest('.guide-section');
      if (parentSection && parentSection !== el) {
        const parentTitle = parentSection.getAttribute('data-guide-section');
        addGuideField(entry, parentTitle, { source: 'parent-title', primary: false, qualifies: false, allowFuzzy: true });
      }

      delete entry.fieldKeys;
      index.push(entry);
    });

    return index;
  }

  function addGuideField(entry, rawText, options) {
    const field = core.createField(rawText, options);
    if (!field) return;
    const key = [
      field.primary ? 'p' : 's',
      field.isAlias ? 'a' : 'f',
      field.normalized
    ].join('|');
    if (entry.fieldKeys.has(key)) return;
    entry.fieldKeys.add(key);
    entry.fields.push(field);
  }

  function searchGuide(index, query) {
    const nq = core.normalizeSearchText(query);
    if (!nq) return { query: '', matches: [], stage: 'none' };

    const strict = core.runSearch(index, nq, core.STRICT_THRESHOLDS, 'strict');
    if (strict.matches.length > 0) return strict;
    return core.runSearch(index, nq, core.FALLBACK_THRESHOLDS, 'fallback');
  }

  /* ════════════════════════════════════════
     Search UI
     ════════════════════════════════════════ */
  let searchIndex = null;
  let searchTimeout = null;

  function initSearch() {
    searchIndex = buildGuideSearchIndex();

    const input        = document.getElementById('guide-search');
    const resultsWrap  = document.getElementById('search-results');
    const resultsList  = document.getElementById('search-results-list');
    const resultsCount = document.getElementById('search-results-count');
    const noResults    = document.getElementById('search-no-results');
    const noResultsQ   = document.getElementById('search-no-results-query');
    const clearBtn     = document.getElementById('search-clear');

    function showSearchResults(query) {
      const result = searchGuide(searchIndex, query);

      if (!query.trim()) {
        hideSearch();
        return;
      }

      document.body.classList.add('search-active');
      resultsWrap.style.display = '';

      if (result.matches.length === 0) {
        resultsList.innerHTML = '';
        resultsCount.textContent = '0 results';
        noResults.style.display = '';
        noResultsQ.textContent = query;
        return;
      }

      noResults.style.display = 'none';
      const sorted = result.matches.slice().sort((a, b) => b.score - a.score);

      resultsCount.textContent = sorted.length + ' result' + (sorted.length !== 1 ? 's' : '');

      resultsList.innerHTML = sorted.map(m => {
        const el = m.element;
        const title = el.getAttribute('data-guide-section');
        const summary = el.getAttribute('data-guide-summary') || '';
        const parentSection = el.closest('.guide-section');
        const parentTitle = (parentSection && parentSection !== el)
          ? parentSection.getAttribute('data-guide-section')
          : '';

        return `<li>
          <a href="#${el.id}" class="search-result-item" data-target="${el.id}">
            <div class="search-result-title">${escapeHtml(title)}${parentTitle ? `<span class="search-result-parent">${escapeHtml(parentTitle)}</span>` : ''}</div>
            ${summary ? `<div class="search-result-summary">${escapeHtml(summary)}</div>` : ''}
          </a>
        </li>`;
      }).join('');

      // Click handler for results
      resultsList.querySelectorAll('.search-result-item').forEach(link => {
        link.addEventListener('click', e => {
          e.preventDefault();
          const targetId = link.getAttribute('data-target');
          hideSearch();
          input.value = '';
          jumpToAnchor(targetId);
        });
      });
    }

    function hideSearch() {
      document.body.classList.remove('search-active');
      resultsWrap.style.display = 'none';
      resultsList.innerHTML = '';
      noResults.style.display = 'none';
    }

    input.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => showSearchResults(input.value), 150);
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      hideSearch();
      input.focus();
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ════════════════════════════════════════
     Anchor Jump + Focus Management
     ════════════════════════════════════════ */
  function jumpToAnchor(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Set focus after scroll for screen readers
    setTimeout(() => {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }, 400);
  }

  /* ════════════════════════════════════════
     TOC Active Tracking
     ════════════════════════════════════════ */
  function initTocTracking() {
    const sections = document.querySelectorAll('.guide-section, .guide-subsection');
    const tocLinks = document.querySelectorAll('.toc-link');

    if (!sections.length || !tocLinks.length || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        tocLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === '#' + id);
        });
      });
    }, {
      rootMargin: '-80px 0px -60% 0px',
      threshold: 0
    });

    sections.forEach(s => { if (s.id) observer.observe(s); });
  }

  /* ════════════════════════════════════════
     Keyboard Shortcuts
     ════════════════════════════════════════ */
  function initKeyboard() {
    const input = document.getElementById('guide-search');

    document.addEventListener('keydown', e => {
      // "/" to focus search (when not already in an input)
      if (e.key === '/' && document.activeElement !== input && !isInputLike(document.activeElement)) {
        e.preventDefault();
        input.focus();
        input.select();
        return;
      }

      // Escape to clear search / blur
      if (e.key === 'Escape') {
        if (document.activeElement === input) {
          if (input.value) {
            input.value = '';
            document.body.classList.remove('search-active');
            document.getElementById('search-results').style.display = 'none';
          }
          input.blur();
        }
      }
    });
  }

  function isInputLike(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  /* ════════════════════════════════════════
     Open Settings
     ════════════════════════════════════════ */
  function initSettingsButton() {
    const btn = document.getElementById('open-settings');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (typeof browser !== 'undefined' && browser.runtime?.openOptionsPage) {
        browser.runtime.openOptionsPage();
      } else {
        window.open('/options/options.html', '_blank');
      }
    });
  }

  /* ════════════════════════════════════════
     Welcome Banner (first-install onboarding)
     ════════════════════════════════════════ */
  function initWelcomeBanner() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') !== 'true') return;

    const banner = document.getElementById('welcome-banner');
    const dismissBtn = document.getElementById('welcome-banner-dismiss');
    if (!banner) return;

    banner.style.display = '';

    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        banner.style.display = 'none';
      });
    }
  }

  /* ════════════════════════════════════════
     Init
     ════════════════════════════════════════ */
  function init() {
    loadSettings();
    initWelcomeBanner();
    initSearch();
    initTocTracking();
    initKeyboard();
    initSettingsButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

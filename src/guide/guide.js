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
  const guideI18n = globalThis.markSnipI18n || null;
  const SPECIAL_THEME_CLASS_NAMES = ['special-theme-claude', 'special-theme-perplexity', 'special-theme-openai', 'special-theme-atla', 'special-theme-ben10', 'special-theme-colorblind'];
  const COLORBLIND_VARIANT_CLASS_NAMES = ['colorblind-theme-deuteranopia', 'colorblind-theme-protanopia', 'colorblind-theme-tritanopia'];
  const ACCENT_CLASS_NAMES = ['accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber'];

  function t(key, substitutions, fallback = null) {
    if (guideI18n?.t) {
      const value = guideI18n.t(key, substitutions);
      if (value !== key) {
        return value;
      }
    }
    return fallback ?? key;
  }

  function tp(keyBase, count, substitutions = {}, fallback = null) {
    if (guideI18n?.tp) {
      return guideI18n.tp(keyBase, count, substitutions);
    }
    return fallback ?? String(count);
  }

  function setInlineLabel(element, label) {
    if (!element) return;
    const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE);
    if (textNodes.length > 0) {
      textNodes[textNodes.length - 1].textContent = ` ${label}`;
      return;
    }
    element.appendChild(document.createTextNode(` ${label}`));
  }

  function setLocalizedInnerHtml(element, key) {
    if (!element) return;
    const fallback = element.innerHTML;
    const localizedHtml = t(key, null, fallback);
    if (localizedHtml && localizedHtml !== key) {
      element.innerHTML = localizedHtml;
    }
  }

  function applyGuideStaticLocalization() {
    document.title = t('guide_title', null, 'MarkSnip User Guide');

    setLocalizedInnerHtml(document.querySelector('.toc-list'), 'guide_toc_html');
    [
      ['quick-start', 'guide_section_quick_start_html'],
      ['using-the-popup', 'guide_section_using_the_popup_html'],
      ['batch-processing', 'guide_section_batch_processing_html'],
      ['context-menus', 'guide_section_context_menus_html'],
      ['settings', 'guide_section_settings_html'],
      ['obsidian-downloads', 'guide_section_obsidian_downloads_html'],
      ['permissions-privacy', 'guide_section_permissions_privacy_html'],
      ['troubleshooting', 'guide_section_troubleshooting_html'],
      ['text-substitutions', 'guide_section_text_substitutions_html']
    ].forEach(([id, key]) => {
      setLocalizedInnerHtml(document.getElementById(id), key);
    });

    guideI18n?.applyDefinitions?.([
      { selector: '.skip-link', textKey: 'guide_skip_to_content' },
      { selector: '#guide-search', placeholderKey: 'guide_search_placeholder', ariaLabelKey: 'guide_search_aria' },
      { selector: '#open-settings', titleKey: 'guide_open_settings' },
      { selector: '.guide-toc', ariaLabelKey: 'guide_toc_aria' },
      { selector: '#search-results', ariaLabelKey: 'guide_search_results_aria' },
      { selector: '#search-clear', textKey: 'guide_search_clear', ariaLabelKey: 'guide_search_clear' },
      {
        selector: '#quick-start',
        datasetKeys: {
          guideSection: 'guide_meta_quick_start_title',
          guideSummary: 'guide_meta_quick_start_summary',
          searchKeywords: 'guide_meta_quick_start_keywords'
        }
      },
      {
        selector: '#using-the-popup',
        datasetKeys: {
          guideSection: 'guide_meta_using_the_popup_title',
          guideSummary: 'guide_meta_using_the_popup_summary',
          searchKeywords: 'guide_meta_using_the_popup_keywords'
        }
      },
      {
        selector: '#batch-processing',
        datasetKeys: {
          guideSection: 'guide_meta_batch_processing_title',
          guideSummary: 'guide_meta_batch_processing_summary',
          searchKeywords: 'guide_meta_batch_processing_keywords'
        }
      },
      {
        selector: '#context-menus',
        datasetKeys: {
          guideSection: 'guide_meta_context_menus_title',
          guideSummary: 'guide_meta_context_menus_summary',
          searchKeywords: 'guide_meta_context_menus_keywords'
        }
      },
      {
        selector: '#settings',
        datasetKeys: {
          guideSection: 'guide_meta_settings_title',
          guideSummary: 'guide_meta_settings_summary',
          searchKeywords: 'guide_meta_settings_keywords'
        }
      },
      {
        selector: '#obsidian-downloads',
        datasetKeys: {
          guideSection: 'guide_meta_obsidian_downloads_title',
          guideSummary: 'guide_meta_obsidian_downloads_summary',
          searchKeywords: 'guide_meta_obsidian_downloads_keywords'
        }
      },
      {
        selector: '#permissions-privacy',
        datasetKeys: {
          guideSection: 'guide_meta_permissions_privacy_title',
          guideSummary: 'guide_meta_permissions_privacy_summary',
          searchKeywords: 'guide_meta_permissions_privacy_keywords'
        }
      },
      {
        selector: '#troubleshooting',
        datasetKeys: {
          guideSection: 'guide_meta_troubleshooting_title',
          guideSummary: 'guide_meta_troubleshooting_summary',
          searchKeywords: 'guide_meta_troubleshooting_keywords'
        }
      },
      {
        selector: '#text-substitutions',
        datasetKeys: {
          guideSection: 'guide_meta_text_substitutions_title',
          guideSummary: 'guide_meta_text_substitutions_summary',
          searchKeywords: 'guide_meta_text_substitutions_keywords'
        }
      },
      { selector: '.welcome-banner-title', textKey: 'guide_welcome_title' },
      { selector: '#welcome-banner-dismiss', ariaLabelKey: 'guide_welcome_dismiss' }
    ], document);

    const settingsButton = document.getElementById('open-settings');
    if (settingsButton) {
      settingsButton.title = t('guide_open_settings', null, 'Open Settings');
      setInlineLabel(settingsButton, t('guide_settings', null, 'Settings'));
    }
    const headerSubtitle = document.querySelector('.header-subtitle');
    if (headerSubtitle) {
      headerSubtitle.textContent = t('guide_subtitle', null, 'User Guide');
    }

    const noResultsText = document.querySelector('#search-no-results p:first-of-type');
    if (noResultsText) {
      noResultsText.innerHTML = `${t('guide_search_no_results', null, 'No results for')} "<span id="search-no-results-query"></span>"`;
    }
    const noResultsHint = document.querySelector('#search-no-results .no-results-hint');
    if (noResultsHint) {
      noResultsHint.textContent = t('guide_search_no_results_hint', null, 'Try different keywords or browse the table of contents.');
    }
    const welcomeParagraphs = document.querySelectorAll('#welcome-banner .welcome-banner-content p');
    if (welcomeParagraphs[0]) {
      welcomeParagraphs[0].textContent = t('guide_welcome_intro', null, 'Thanks for installing MarkSnip. This guide will help you get started with clipping web pages as clean Markdown.');
    }
    if (welcomeParagraphs[1]) {
      welcomeParagraphs[1].innerHTML = t('guide_welcome_followup', null, 'Start with the <strong>Quick Start</strong> section below, or browse the table of contents on the left.');
    }
  }

  async function bootstrapGuideI18n() {
    if (!guideI18n?.init) {
      return;
    }

    const stored = typeof browser !== 'undefined' && browser?.storage?.sync
      ? await browser.storage.sync.get({ uiLanguage: 'browser' }).catch(() => ({ uiLanguage: 'browser' }))
      : { uiLanguage: 'browser' };
    await guideI18n.init({ setting: stored?.uiLanguage || 'browser' });
    guideI18n.setDocumentLanguage?.(document.documentElement);
    applyGuideStaticLocalization();
  }

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
        resultsCount.textContent = tp('guide_search_results_count', 0, { count: 0 }, '0 results');
        noResults.style.display = '';
        noResultsQ.textContent = query;
        return;
      }

      noResults.style.display = 'none';
      const sorted = result.matches.slice().sort((a, b) => b.score - a.score);

      resultsCount.textContent = tp(
        'guide_search_results_count',
        sorted.length,
        { count: sorted.length },
        `${sorted.length} result${sorted.length !== 1 ? 's' : ''}`
      );

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
  async function init() {
    try {
      await bootstrapGuideI18n();
    } catch (error) {
      console.error('Failed to initialize guide i18n:', error);
    }
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

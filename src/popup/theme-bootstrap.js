(function () {
  const CACHE_KEY = 'marksnip-popup-theme-cache-v1';
  const root = document.documentElement;
  const specialThemeClassNames = ['special-theme-claude', 'special-theme-perplexity', 'special-theme-openai', 'special-theme-atla', 'special-theme-ben10', 'special-theme-colorblind'];
  const colorBlindVariantClassNames = ['colorblind-theme-deuteranopia', 'colorblind-theme-protanopia', 'colorblind-theme-tritanopia'];
  const accentClassNames = ['accent-sage', 'accent-ocean', 'accent-slate', 'accent-rose', 'accent-amber'];
  const editorThemeMap = {
    default: { dark: 'xq-dark', light: 'xq-light' },
    claude: { dark: 'claude-dark', light: 'claude-light' },
    perplexity: { dark: 'perplexity-dark', light: 'perplexity-light' },
    openai: { dark: 'openai-dark', light: 'openai-light' },
    atla: { dark: 'atla-dark', light: 'atla-light' },
    ben10: { dark: 'ben10-dark', light: 'ben10-light' },
    'colorblind-deuteranopia': { dark: 'colorblind-deuteranopia-dark', light: 'colorblind-deuteranopia-light' },
    'colorblind-protanopia': { dark: 'colorblind-protanopia-dark', light: 'colorblind-protanopia-light' },
    'colorblind-tritanopia': { dark: 'colorblind-tritanopia-dark', light: 'colorblind-tritanopia-light' },
    dracula: { dark: 'dracula', light: 'dracula' },
    material: { dark: 'material-darker', light: 'material' },
    monokai: { dark: 'monokai', light: 'xq-light' },
    nord: { dark: 'nord', light: 'xq-light' },
    solarized: { dark: 'solarized dark', light: 'solarized light' },
    twilight: { dark: 'twilight', light: 'xq-light' }
  };
  const editorThemeStylesheetMap = {
    'xq-dark': 'lib/xq-dark.css',
    'xq-light': 'lib/xq-light.css',
    'claude-dark': 'lib/claude-dark.css',
    'claude-light': 'lib/claude-light.css',
    'perplexity-dark': 'lib/perplexity-dark.css',
    'perplexity-light': 'lib/perplexity-light.css',
    'openai-dark': 'lib/openai-dark.css',
    'openai-light': 'lib/openai-light.css',
    'atla-dark': 'lib/atla-dark.css',
    'atla-light': 'lib/atla-light.css',
    'ben10-dark': 'lib/ben10-dark.css',
    'ben10-light': 'lib/ben10-light.css',
    'colorblind-deuteranopia-dark': 'lib/colorblind-deuteranopia-dark.css',
    'colorblind-deuteranopia-light': 'lib/colorblind-deuteranopia-light.css',
    'colorblind-protanopia-dark': 'lib/colorblind-protanopia-dark.css',
    'colorblind-protanopia-light': 'lib/colorblind-protanopia-light.css',
    'colorblind-tritanopia-dark': 'lib/colorblind-tritanopia-dark.css',
    'colorblind-tritanopia-light': 'lib/colorblind-tritanopia-light.css',
    dracula: 'lib/dracula.css',
    material: 'lib/material.css',
    'material-darker': 'lib/material-darker.css',
    monokai: 'lib/monokai.css',
    nord: 'lib/nord.css',
    'solarized dark': 'lib/solarized.css',
    'solarized light': 'lib/solarized.css',
    twilight: 'lib/twilight.css'
  };

  function normalizeColorBlindTheme(value) {
    return ['deuteranopia', 'protanopia', 'tritanopia'].includes(value) ? value : 'deuteranopia';
  }

  function getResolvedSpecialThemeKey(specialTheme, colorBlindTheme) {
    if (specialTheme === 'colorblind') {
      return `colorblind-${normalizeColorBlindTheme(colorBlindTheme)}`;
    }
    return specialTheme;
  }

  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const cached = raw ? JSON.parse(raw) : null;
    const popupTheme = typeof cached?.popupTheme === 'string' ? cached.popupTheme : 'system';
    const specialTheme = typeof cached?.specialTheme === 'string' ? cached.specialTheme : 'none';
    const colorBlindTheme = normalizeColorBlindTheme(cached?.colorBlindTheme);
    const popupAccent = typeof cached?.popupAccent === 'string' ? cached.popupAccent : 'sage';
    const editorTheme = typeof cached?.editorTheme === 'string' ? cached.editorTheme : 'default';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = popupTheme === 'dark' || (popupTheme !== 'light' && prefersDark);
    const resolvedSpecialTheme = getResolvedSpecialThemeKey(specialTheme, colorBlindTheme);
    const themeEntry = editorThemeMap[specialTheme !== 'none' ? resolvedSpecialTheme : editorTheme] || editorThemeMap.default;
    const themeName = isDark ? themeEntry.dark : themeEntry.light;
    const themeHref = editorThemeStylesheetMap[themeName];

    root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    root.classList.add('theme-' + popupTheme);

    root.classList.remove(...specialThemeClassNames);
    root.classList.remove(...colorBlindVariantClassNames);
    if (specialTheme !== 'none') {
      root.classList.add('special-theme-' + specialTheme);
      if (specialTheme === 'colorblind') {
        root.classList.add('colorblind-theme-' + colorBlindTheme);
      }
    }

    root.classList.toggle('hide-theme-icon', cached?.specialThemeIcon === false);
    root.classList.toggle('hide-popup-theme-toggle', cached?.showThemeToggleInPopup === false);

    root.classList.remove(...accentClassNames);
    if (specialTheme === 'none' && popupAccent !== 'sage') {
      root.classList.add('accent-' + popupAccent);
    }

    if (themeHref) {
      const link = document.createElement('link');
      link.id = 'cm-theme-stylesheet';
      link.rel = 'stylesheet';
      link.href = themeHref;
      link.setAttribute('data-theme-name', themeName);
      document.head.appendChild(link);
    }
  } catch {
    root.classList.remove('theme-light', 'theme-dark', 'theme-system');
    root.classList.add('theme-system');
  }
})();

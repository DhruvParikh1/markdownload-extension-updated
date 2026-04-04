(function (root) {
  const COMMAND_LABELS = {
    '_execute_action':                    'shortcut_open_popup',
    'download_tab_as_markdown':           'shortcut_download_tab',
    'copy_tab_as_markdown':               'shortcut_copy_tab',
    'copy_tab_as_markdown_link':          'shortcut_copy_tab_link',
    'copy_selection_as_markdown':         'shortcut_copy_selection',
    'copy_selected_tab_as_markdown_link': 'shortcut_copy_selected_tabs_links',
    'copy_selection_to_obsidian':         'shortcut_copy_selection_obsidian',
    'copy_tab_to_obsidian':               'shortcut_copy_tab_obsidian',
  };

  const COMMAND_ORDER = [
    '_execute_action', 'download_tab_as_markdown', 'copy_tab_as_markdown',
    'copy_tab_as_markdown_link', 'copy_selection_as_markdown',
    'copy_selected_tab_as_markdown_link', 'copy_selection_to_obsidian',
    'copy_tab_to_obsidian',
  ];

  // Returns ['Alt', 'Shift', 'M'] for 'Alt+Shift+M', [] for empty/falsy
  function splitShortcut(shortcut) {
    if (!shortcut) return [];
    return shortcut.split('+');
  }

  // Returns { withShortcut, withoutShortcut } ordered by COMMAND_ORDER
  // Unknown names (not in COMMAND_ORDER) are omitted
  function groupCommands(commands) {
    const byName = Object.fromEntries(commands.map(c => [c.name, c]));
    const withShortcut = [], withoutShortcut = [];
    for (const id of COMMAND_ORDER) {
      const cmd = byName[id];
      if (!cmd) continue;
      (cmd.shortcut ? withShortcut : withoutShortcut).push(cmd);
    }
    return { withShortcut, withoutShortcut };
  }

  function resolveLabel(commandName, translate) {
    const key = COMMAND_LABELS[commandName];
    if (typeof translate === 'function' && key) {
      return translate(key);
    }
    return key || commandName;
  }

  // Builds and returns a DocumentFragment using the provided document
  function buildShortcutsFragment(document, commands, options = {}) {
    const translate = typeof options.translate === 'function' ? options.translate : null;
    const { withShortcut, withoutShortcut } = groupCommands(commands);
    const frag = document.createDocumentFragment();

    function makeRow(cmd, hasKeys) {
      const tr = document.createElement('tr');
      const keyTd = document.createElement('td');
      if (hasKeys) {
        for (const key of splitShortcut(cmd.shortcut)) {
          const kbd = document.createElement('kbd');
          kbd.textContent = key;
          keyTd.appendChild(kbd);
        }
      } else {
        const span = document.createElement('span');
        span.className = 'shortcut-unset';
        span.textContent = '\u2014'; // em dash
        keyTd.appendChild(span);
      }
      const descTd = document.createElement('td');
      descTd.textContent = resolveLabel(cmd.name, translate) || cmd.description || cmd.name;
      tr.appendChild(keyTd);
      tr.appendChild(descTd);
      return tr;
    }

    const table1 = document.createElement('table');
    table1.className = 'shortcuts-table';
    for (const cmd of withShortcut) table1.appendChild(makeRow(cmd, true));
    frag.appendChild(table1);

    if (withoutShortcut.length) {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'shortcuts-section-label';
      label.dataset.action = 'open-shortcut-settings';
      const labelText = document.createElement('span');
      labelText.textContent = translate ? translate('shortcut_assign_in_browser') : 'Assign in browser shortcuts';
      const labelIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      labelIcon.setAttribute('width', '10');
      labelIcon.setAttribute('height', '10');
      labelIcon.setAttribute('viewBox', '0 0 24 24');
      labelIcon.setAttribute('fill', 'none');
      labelIcon.setAttribute('stroke', 'currentColor');
      labelIcon.setAttribute('stroke-width', '2.5');
      labelIcon.setAttribute('stroke-linecap', 'round');
      labelIcon.setAttribute('stroke-linejoin', 'round');
      labelIcon.setAttribute('aria-hidden', 'true');
      const iconPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      iconPath.setAttribute('d', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6');
      const iconPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      iconPoly.setAttribute('points', '15 3 21 3 21 9');
      const iconLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      iconLine.setAttribute('x1', '10'); iconLine.setAttribute('y1', '14');
      iconLine.setAttribute('x2', '21'); iconLine.setAttribute('y2', '3');
      labelIcon.appendChild(iconPath);
      labelIcon.appendChild(iconPoly);
      labelIcon.appendChild(iconLine);
      label.appendChild(labelText);
      label.appendChild(labelIcon);
      frag.appendChild(label);
      const table2 = document.createElement('table');
      table2.className = 'shortcuts-table';
      for (const cmd of withoutShortcut) table2.appendChild(makeRow(cmd, false));
      frag.appendChild(table2);
    }
    return frag;
  }

  const api = { COMMAND_LABELS, COMMAND_ORDER, splitShortcut, groupCommands, buildShortcutsFragment, resolveLabel };
  root.markSnipPopupShortcuts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);

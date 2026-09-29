// The command search: every command by category, with syntax, explanation and an example to try.

import { h } from './ui.js';
import { COMMANDS, CATEGORIES, searchCommands } from './commands.js';

export function commandPanel({ onInsert, onTry, onClose, hidden = new Set() }) {
  let query = '';
  let category = null;
  const search = h('input.search', { type: 'search', placeholder: 'Befehl suchen, z. B. Nullstellen, Normalverteilung …', autocomplete: 'off' });
  const chips = h('div.chips');
  const results = h('div.commands');

  const renderChips = () => {
    chips.replaceChildren(
      h('button', { 'aria-pressed': String(category === null), onclick: () => { category = null; render(); } }, 'Alle'),
      ...CATEGORIES.filter((c) => !hidden.has(c)).map((c) => h('button', { 'aria-pressed': String(category === c), onclick: () => { category = category === c ? null : c; render(); } }, c)),
    );
  };

  const render = () => {
    renderChips();
    const found = (query ? searchCommands(query) : COMMANDS).filter((c) => !hidden.has(c.cat) && (!category || c.cat === category));
    results.replaceChildren(
      ...found.map((c) => h('div.command', {},
        h('div.name', {}, c.name),
        h('div.syntax', {}, c.syntax),
        h('div.text', {}, c.text),
        h('div.example', {}, 'Beispiel: ' + c.example),
        h('div.buttons', {},
          h('button', { onclick: () => onInsert(c.name) }, 'Einfügen'),
          h('button', { onclick: () => onTry(c.example) }, 'Beispiel rechnen'),
        ),
      )),
      found.length ? null : h('p', { style: { color: 'var(--muted)' } }, 'Kein Befehl gefunden.'),
    );
  };

  search.addEventListener('input', () => {
    query = search.value;
    render();
  });
  render();

  return h('aside.panel', {},
    h('header', {}, h('h2', {}, 'Befehle'), h('button.icon-button', { onclick: onClose, 'aria-label': 'Schließen' }, '×')),
    search,
    chips,
    results,
  );
}

// The command search: every command by category, with syntax, explanation and an example to try.

import { h } from './ui.js';
import { COMMANDS, CATEGORIES, searchCommands } from './commands.js';

export function commandPanel({ onInsert, onTry, onClose, hidden = new Set(), favorites = new Set(), recent = [], onFavorite = () => {} }) {
  let query = '';
  // Favourites first when there are some, else everything
  let category = favorites.size ? '★' : null;
  const search = h('input.search', { type: 'search', placeholder: 'Befehl suchen …', autocomplete: 'off' });
  const chips = h('div.chips');
  const results = h('div.commands');

  const renderChips = () => {
    chips.replaceChildren(...[
      h('button', { 'aria-pressed': String(category === null), onclick: () => { category = null; render(); } }, 'Alle'),
      favorites.size ? h('button', { 'aria-pressed': String(category === '★'), onclick: () => { category = '★'; render(); } }, '★ Favoriten') : null,
      recent.length ? h('button', { 'aria-pressed': String(category === 'zuletzt'), onclick: () => { category = 'zuletzt'; render(); } }, 'Zuletzt') : null,
      ...CATEGORIES.filter((c) => !hidden.has(c)).map((c) => h('button', { 'aria-pressed': String(category === c), onclick: () => { category = category === c ? null : c; render(); } }, c)),
    ].filter(Boolean));
  };

  const render = () => {
    renderChips();
    const inCategory = (c) => !category || (category === '★' ? favorites.has(c.name) : category === 'zuletzt' ? recent.includes(c.name) : c.cat === category);
    let found = (query ? searchCommands(query) : COMMANDS).filter((c) => !hidden.has(c.cat) && inCategory(c));
    if (category === 'zuletzt' && !query) found = recent.map((name) => found.find((c) => c.name === name)).filter(Boolean);
    results.replaceChildren(...[
      ...found.map((c) => h('div.command', {},
        h('div.name', {}, c.name, h('button.star', {
          'aria-label': favorites.has(c.name) ? 'Aus den Favoriten nehmen' : 'Zu den Favoriten',
          'aria-pressed': String(favorites.has(c.name)),
          onclick: () => {
            if (favorites.has(c.name)) favorites.delete(c.name);
            else favorites.add(c.name);
            onFavorite(favorites);
            render();
          },
        }, favorites.has(c.name) ? '★' : '☆')),
        h('div.syntax', {}, c.syntax),
        h('div.text', {}, c.text),
        h('div.example', {}, 'Beispiel: ' + c.example),
        h('div.buttons', {},
          h('button', { onclick: () => onInsert(c.name) }, 'Einfügen'),
          h('button', { onclick: () => onTry(c.example) }, 'Beispiel rechnen'),
        ),
      )),
      found.length ? null : h('p', { style: { color: 'var(--muted)' } }, 'Kein Befehl gefunden.'),
    ].filter(Boolean));
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

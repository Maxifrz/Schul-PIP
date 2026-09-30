// The bar between the CAS column and the graphics: drag it to make the formula rows wider or narrower, tap its arrow
// to put the rows away altogether. Width and state are remembered.

import { h } from './ui.js';

const WIDTH_KEY = 'mathe.casWidth';
const HIDDEN_KEY = 'mathe.casHidden';
const MIN_CAS = 240;
const MIN_REST = 240;

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (e) {
    // not remembered
  }
}

export function createSplitter({ main, onResize = () => {} }) {
  const collapse = h('button.splitter-toggle', { type: 'button', 'aria-label': 'Formelzeilen ein- oder ausblenden', title: 'Formelzeilen ein- oder ausblenden' }, '‹');
  const el = h('div.splitter', { role: 'separator', 'aria-orientation': 'vertical', 'aria-label': 'Breite der Formelzeilen', tabindex: '0' }, h('span.splitter-grip'), collapse);
  let width = Number(read(WIDTH_KEY)) || null;
  let hidden = read(HIDDEN_KEY) === '1';

  // Before the page is laid out there is no width to measure: the saved value stands.
  const clamp = (value) => (main.clientWidth ? Math.round(Math.max(MIN_CAS, Math.min(value, main.clientWidth - MIN_REST))) : value);

  const apply = () => {
    if (width) main.style.setProperty('--cas-width', clamp(width) + 'px');
    else main.style.removeProperty('--cas-width');
    if (hidden) main.dataset.cas = 'hidden';
    else delete main.dataset.cas;
    collapse.textContent = hidden ? '›' : '‹';
    collapse.setAttribute('aria-pressed', String(hidden));
    onResize();
  };

  const setWidth = (value, save) => {
    width = clamp(value);
    if (save) write(WIDTH_KEY, String(width));
    apply();
  };

  let drag = null;
  el.addEventListener('pointerdown', (e) => {
    if (e.target === collapse || hidden) return;
    drag = { startX: e.clientX, startWidth: main.querySelector('.cas-pane').getBoundingClientRect().width };
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (drag) setWidth(drag.startWidth + e.clientX - drag.startX, false);
  });
  const end = (e) => {
    if (!drag) return;
    drag = null;
    el.classList.remove('dragging');
    if (width) write(WIDTH_KEY, String(width));
    if (e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  // A double tap goes back to the standard width
  el.addEventListener('dblclick', (e) => {
    if (e.target === collapse) return;
    width = null;
    write(WIDTH_KEY, null);
    apply();
  });
  el.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const current = main.querySelector('.cas-pane').getBoundingClientRect().width;
    setWidth(current + (e.key === 'ArrowRight' ? 24 : -24), true);
    e.preventDefault();
  });
  collapse.addEventListener('click', () => api.setHidden(!hidden));

  const api = {
    el,
    apply,
    get hidden() {
      return hidden;
    },
    setHidden(value) {
      hidden = value;
      write(HIDDEN_KEY, hidden ? '1' : '0');
      apply();
    },
    /** The rows must be in view: a command was inserted or an example run */
    reveal() {
      if (hidden) api.setHidden(false);
    },
  };
  apply();
  return api;
}

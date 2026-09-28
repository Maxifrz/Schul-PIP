// The calculator app: header with the views, the CAS view, the command search and the formula keyboard; projects
// are saved through the app around the web view.

import { MathfieldElement } from 'mathlive';
import { h, toast, sheet, prompt, confirmSheet, toggle } from './ui.js';
import { Engine } from './engine.js';
import { CasView } from './cas-view.js';
import { commandPanel } from './palette.js';
import { LAYOUTS } from './keyboard.js';
import { store, share, reply, notifyReady } from './native.js';

MathfieldElement.fontsDirectory = '.';
MathfieldElement.soundsDirectory = null;
MathfieldElement.decimalSeparator = '.';

const state = {
  engine: null,
  cas: null,
  project: { name: null, settings: { degrees: false } },
  panel: null,
  dirty: false,
};

// The engine does nothing until Giac is ready; rows typed before that are calculated then.
const engineProxy = {
  evaluate(input) {
    if (!state.engine) return { ok: false, error: 'Der Rechenkern lädt noch …' };
    return state.engine.evaluate(input);
  },
};

let saveTimer = null;

function changed() {
  state.dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autosave, 600);
}

function snapshot() {
  return JSON.stringify({ version: 1, name: state.project.name, settings: state.project.settings, cas: state.cas.serialize() });
}

function autosave() {
  store.set('current', snapshot());
}

function applySettings() {
  if (window.CAS && window.CAS.ready) window.CAS.setDegrees(state.project.settings.degrees);
}

function load(json) {
  let data;
  try {
    data = JSON.parse(json);
  } catch (e) {
    data = null;
  }
  if (!data) return;
  state.project = { name: data.name || null, settings: { degrees: false, ...(data.settings || {}) } };
  applySettings();
  if (state.engine) for (const def of state.engine.definitions) state.engine.forget(def.name);
  state.cas.load(data.cas || []);
  updateTitle();
}

// Header

const titleEl = h('span.caption');
const statusEl = h('span.status', {}, h('span.dot'), h('span', {}, 'Rechenkern lädt'));

function updateTitle() {
  titleEl.textContent = state.project.name || 'Neues Projekt';
}

function setStatus(kind, text) {
  statusEl.className = 'status ' + kind;
  statusEl.lastChild.textContent = text;
}

function togglePanel() {
  if (state.panel) {
    state.panel.remove();
    state.panel = null;
    return;
  }
  state.panel = commandPanel({
    onInsert: (name) => {
      state.cas.insertCommand(name);
      if (window.innerWidth <= 760) togglePanel();
    },
    onTry: (example) => {
      state.cas.tryExample(example);
      if (window.innerWidth <= 760) togglePanel();
    },
    onClose: togglePanel,
  });
  mainEl.append(state.panel);
}

async function newProject() {
  if (state.cas.serialize().length && !(await confirmSheet('Neues Projekt', 'Das aktuelle Projekt wird geschlossen. Nicht gespeicherte Zeilen bleiben nur, wenn du es vorher speicherst.', 'Neu anfangen'))) return;
  load(JSON.stringify({ cas: [] }));
  changed();
}

async function saveAs() {
  const name = await prompt('Projekt speichern', state.project.name || '', 'Speichern');
  if (!name) return;
  state.project.name = name;
  await store.set('project:' + name, snapshot());
  updateTitle();
  changed();
  toast('Gespeichert: ' + name);
}

async function openProject() {
  const keys = (await store.list('project:')).map((k) => k.replace(/^project:/, '')).sort((a, b) => a.localeCompare(b, 'de'));
  const chosen = await sheet((close) => [
    h('h2', {}, 'Projekt öffnen'),
    keys.length
      ? h('div.list', {}, ...keys.map((name) => h('button', { onclick: () => close(name) }, name, h('span', {}, 'öffnen'))))
      : h('p', { style: { color: 'var(--muted)' } }, 'Noch keine gespeicherten Projekte.'),
    h('div.actions', {}, h('button.pill', { onclick: () => close(null) }, 'Schließen')),
  ]);
  if (!chosen) return;
  const json = await store.get('project:' + chosen);
  if (json) {
    load(json);
    changed();
  }
}

function exportText() {
  const lines = state.cas.rows.filter((row) => !state.cas.isEmpty(row)).map((row, i) => {
    const input = row.mode === 'text' ? row.text : row.latex;
    const r = row.result;
    const output = !r ? '' : r.ok ? (r.kind === 'analysis' ? r.rows.map((x) => `  ${x.label}: ${x.latex}`).join('\n') : r.latex + (r.approxLatex ? '  ≈ ' + r.approxLatex : '')) : 'Fehler: ' + r.error;
    return `${i + 1}: ${input}\n   → ${output}`;
  });
  share((state.project.name || 'Rechnung') + '.txt', 'text/plain', lines.join('\n\n'));
}

function settings() {
  sheet((close) => [
    h('h2', {}, 'Einstellungen'),
    h('div.field', {}, 'Winkel', toggle([[false, 'Bogenmaß'], [true, 'Grad']], state.project.settings.degrees, (value) => {
      state.project.settings.degrees = value;
      applySettings();
      state.cas.recalculate(0);
      changed();
    })),
    h('div.actions', {}, h('button.pill.primary', { onclick: () => close() }, 'Fertig')),
  ]);
}

function menu() {
  sheet((close) => [
    h('h2', {}, 'Projekt'),
    h('div.list', {},
      h('button', { onclick: () => { close(); newProject(); } }, 'Neues Projekt'),
      h('button', { onclick: () => { close(); openProject(); } }, 'Öffnen …'),
      h('button', { onclick: () => { close(); saveAs(); } }, 'Speichern unter …'),
      h('button', { onclick: () => { close(); exportText(); } }, 'Als Text teilen'),
      h('button', { onclick: () => { close(); settings(); } }, 'Einstellungen'),
    ),
  ]);
}

const header = h('header.bar', {},
  h('span.pixel', {}, 'Rechner'),
  titleEl,
  h('span.spacer'),
  statusEl,
  h('button.pill', { onclick: togglePanel }, 'Befehle'),
  h('button.icon-button', { onclick: menu, 'aria-label': 'Projekt' }, '⋯'),
);
const mainEl = h('div.main');

function start() {
  const app = document.getElementById('app');
  state.cas = new CasView({ engine: engineProxy, onChange: changed });
  mainEl.append(state.cas.el);
  app.append(header, mainEl);
  updateTitle();

  window.mathVirtualKeyboard.layouts = LAYOUTS;
  window.mathVirtualKeyboard.editToolbar = 'none';
  window.mathVirtualKeyboard.container = document.body;
  // The rows end above the keyboard instead of behind it.
  window.mathVirtualKeyboard.addEventListener('geometrychange', () => {
    app.style.paddingBottom = window.mathVirtualKeyboard.visible ? window.mathVirtualKeyboard.boundingRect.height + 'px' : '0px';
  });

  store.get('current').then((json) => {
    if (json) load(json);
    else state.cas.load([]);
    if (window.__giacReady) giacReady();
    const last = state.cas.rows[state.cas.rows.length - 1];
    if (last) state.cas.focus(last);
  });
  notifyReady();
}

function giacReady() {
  if (state.engine) return;
  state.engine = new Engine(window.CAS);
  applySettings();
  setStatus('ready', 'Giac · exakt');
  state.cas.recalculate(0);
}

window.Mathe = {
  giacReady,
  reply,
  setTheme(theme) {
    document.documentElement.dataset.theme = theme;
  },
  // For tests and the app: the current state
  get state() {
    return state;
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

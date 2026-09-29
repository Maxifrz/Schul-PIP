// The calculator app: header with the views, the CAS view and the graphics, the command search and the formula
// keyboard; projects are saved through the app around the web view.

import { MathfieldElement } from 'mathlive';
import { h, toast, sheet, prompt, confirmSheet, toggle } from './ui.js';
import { Engine } from './engine.js';
import { CasView } from './cas-view.js';
import { commandPanel } from './palette.js';
import { LAYOUTS } from './keyboard.js';
import { store, share, reply, notifyReady, insertIntoDocument, hasApp } from './native.js';
import { toLatex, parsePlain } from './expr.js';
import { nextName } from './graph/tools.js';
import { Scene, styleOf, isVisible } from './graph/scene.js';
import { GraphView, DEFAULT_SETTINGS } from './graph/view.js';
import { Animator, sliderControl, checkboxControl, sliderSheet } from './graph/sliders.js';
import { styleSheet, settingsSheet, objectsSheet, exportSheet, scriptSheet } from './graph/sheets.js';
import { runScript } from './script.js';
import { SpaceView, DEFAULT_SETTINGS_3D } from './graph/view3d.js';
import { TableView } from './table-view.js';

MathfieldElement.fontsDirectory = '.';
MathfieldElement.soundsDirectory = null;
MathfieldElement.decimalSeparator = '.';

const WIDE = 980;

const state = {
  engine: null,
  cas: null,
  graph: null,
  scene: new Scene(),
  animator: null,
  project: { name: null, settings: { degrees: false }, graph: null },
  layout: null,
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
  return JSON.stringify({ version: 2, name: state.project.name, settings: state.project.settings, graph: state.graph.settings, space: state.space.settings, table: state.table.sheet.serialize(), cas: state.cas.serialize() });
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
  if (state.animator) for (const name of [...state.animator.playing.keys()]) state.animator.playing.delete(name);
  if (state.engine) for (const def of state.engine.definitions) state.engine.forget(def.name);
  state.scene.key = null;
  state.chartIds = null;
  state.graph.selected = null;
  state.graph.setSettings(data.graph || DEFAULT_SETTINGS);
  state.space.setSettings(data.space || DEFAULT_SETTINGS_3D);
  state.table.load(data.table || null);
  // The cells first: CAS rows may use them.
  recalcTable();
  state.cas.load(data.cas || []);
  updateTitle();
}

// The spreadsheet: its values live in Giac as A1, B2 …; formulas may use what the CAS defined.

function recalcTable() {
  if (!state.engine || !window.CAS) return;
  const toGiac = (text) => state.engine.giac(state.engine.parse({ text }));
  state.table.sheet.recalc(window.CAS, toGiac);
  state.table.refresh();
}

function tableChanged() {
  recalcTable();
  if (state.engine) state.cas.recalculate(0);
  changed();
}

/** A row from the table's tools; charts show in the graphics. */
function appendFromTable(text, chart) {
  // As text: cell names such as A1 stay as they are.
  const row = state.cas.append({ mode: 'text', text });
  if (row.result && !row.result.ok) toast(row.result.error);
  else if (chart) setLayout(window.innerWidth >= WIDE ? 'both' : 'graph');
  else toast('Im CAS: ' + text);
  changed();
}

// Objects: after every calculation the scene follows the rows

let sceneTimer = null;

function refreshScene() {
  clearTimeout(sceneTimer);
  sceneTimer = setTimeout(() => {
    sceneTimer = null;
    state.scene.update(state.cas.rows, state.engine);
    fitNewCharts();
    setTimeout(runChangeScripts, 0);
    emit('change', { rows: state.cas.rows.length });
    decorateRows();
    renderStrip();
    state.graph.special = state.graph.selected ? state.graph.computeSpecial() : [];
    state.graph.redraw();
    state.space.redraw();
  }, 0);
}

// Scripts: what tapping an object, pressing a button or a changed value sets off

const scripting = { running: false, signatures: new Map() };

function rowOf(name) {
  return state.cas.rows.find((r) => r.result && r.result.ok && r.result.assigns === name) || null;
}

function scriptValue(expr) {
  const text = String(expr).replace(/\bund\b/gi, ' and ').replace(/\boder\b/gi, ' or ').replace(/\bnicht\b/gi, ' not ').replace(/,/g, '.');
  const giac = state.engine.giac(state.engine.parse({ text }));
  const answer = window.CAS.raw(`evalf(${giac})`);
  if (answer.error) throw new Error(answer.error);
  if (answer.value === 'true') return 1;
  if (answer.value === 'false') return 0;
  const n = Number(answer.value);
  if (!Number.isFinite(n)) throw new Error(`„${expr}“ ergibt keine Zahl.`);
  return n;
}

const scriptApi = {
  value: scriptValue,
  test: (expr) => scriptValue(expr) !== 0,
  set(name, expr) {
    const value = scriptValue(expr);
    const row = rowOf(name);
    if (!row) {
      state.cas.append({ mode: 'text', text: `${name}=${numberText(value)}` });
      return;
    }
    const param = state.scene.params.get(name);
    if (param) param.value = value;
    writeParam(row, name, value);
    state.cas.recalculate(state.cas.rows.indexOf(row));
  },
  point(name, x, y) {
    const row = rowOf(name);
    if (!row) {
      state.cas.append({ mode: 'text', text: `${name}(${numberText(x)}|${numberText(y)})` });
      return;
    }
    writePoint(row, name, x, y);
    state.cas.recalculate(state.cas.rows.indexOf(row));
  },
  visible(name, show) {
    const object = state.scene.objects.find((o) => o.name === name);
    if (!object) throw new Error(`Es gibt kein Objekt ${name}.`);
    object.row.graph = object.row.graph || {};
    object.row.graph.visible = show;
    decorateRows();
    state.graph.redraw();
    state.space.redraw();
  },
  create(text) {
    const row = state.cas.append({ mode: 'text', text });
    if (row.result && !row.result.ok) throw new Error(row.result.error);
  },
  remove(name) {
    const row = rowOf(name);
    if (!row) throw new Error(`Es gibt keine Zeile für ${name}.`);
    state.cas.removeRow(row);
  },
  animate(name, play) {
    const names = name ? [name] : [...state.scene.params.entries()].filter(([, p]) => p.kind === 'slider').map(([n]) => n);
    for (const n of names) {
      if (!state.scene.params.get(n)) throw new Error(`${n} ist kein Schieberegler.`);
      if (play) state.animator.play(n);
      else state.animator.pause(n);
    }
    updatePlayAll();
  },
  reset() {
    state.animator.reset();
  },
  message: (text) => toast(text),
};

/** Runs one of a row's scripts; changes made by it do not set off change scripts again. */
function runRowScript(row, kind) {
  const text = row.graph && row.graph.scripts && row.graph.scripts[kind];
  if (!text || !state.engine || scripting.running) return;
  scripting.running = true;
  try {
    const failed = runScript(text, scriptApi);
    if (failed.length) toast(`Skript, Zeile ${failed[0].line}: ${failed[0].error}`);
  } finally {
    scripting.running = false;
    changed();
  }
  // What the script changed can set off change scripts in turn.
  setTimeout(runChangeScripts, 0);
}

function signatureOf(row) {
  const r = row.result;
  return r && r.ok ? (r.latex || '') + '|' + (r.approxLatex || '') : 'error';
}

/** Change scripts of rows whose value is new since the last look */
function runChangeScripts() {
  if (scripting.running || !state.engine) return;
  const due = [];
  for (const row of state.cas.rows) {
    if (!(row.graph && row.graph.scripts && row.graph.scripts.change)) continue;
    const now = signatureOf(row);
    const before = scripting.signatures.get(row.id);
    scripting.signatures.set(row.id, now);
    if (before !== undefined && before !== now) due.push(row);
  }
  // Scripts that keep changing each other stop after a few rounds a second.
  const now = Date.now();
  if (!scripting.window || now - scripting.window > 1000) {
    scripting.window = now;
    scripting.budget = 30;
  }
  for (const row of due) {
    if (scripting.budget-- <= 0) {
      toast('Skripte ändern sich gegenseitig immer wieder; sie wurden angehalten.');
      return;
    }
    runRowScript(row, 'change');
  }
}

function buttonControl(button) {
  const el = h('div.knopf', {},
    h('button.pill.primary', { onclick: () => runRowScript(button.row, 'click') }, button.label),
    h('button.gear', { 'aria-label': 'Skript des Knopfs', onclick: () => scriptSheet(button.row, { button: true, onChange: changed }) }, '⋯'));
  return el;
}

/** A chart typed just now fills the graphics; charts that were there when the project opened keep its view. */
function fitNewCharts() {
  if (!state.engine) return;
  const charts = state.scene.objects.filter((o) => o.type === 'chart');
  if (!state.chartIds) {
    state.chartIds = new Set(charts.map((o) => o.id));
    return;
  }
  const fresh = charts.filter((o) => !state.chartIds.has(o.id) && isVisible(o));
  for (const o of charts) state.chartIds.add(o.id);
  if (!fresh.length) return;
  const newest = fresh[fresh.length - 1];
  // Charts have scales of their own: the older ones step back (their dot in the row shows them again).
  for (const o of charts) {
    if (o === newest || !isVisible(o)) continue;
    o.row.graph = o.row.graph || {};
    o.row.graph.visible = false;
  }
  requestAnimationFrame(() => state.graph.fitChart(newest));
}

/** Dots, sliders and checkboxes in the CAS rows. */
function decorateRows() {
  const scene = state.scene;
  const objects = new Map(scene.objects.map((o) => [o.row.id, o]));
  const params = new Map([...scene.params].map(([name, p]) => [p.row.id, { name, ...p }]));
  for (const row of state.cas.rows) {
    const object = objects.get(row.id);
    const param = params.get(row.id);
    if (object) {
      const style = styleOf(object);
      const visible = isVisible(object);
      row.dotEl.hidden = false;
      row.dotEl.style.background = visible ? style.color : 'transparent';
      row.dotEl.style.borderColor = style.color;
      row.dotEl.onclick = () => toggleVisible(object);
      row.styleButton.hidden = false;
    } else {
      row.dotEl.hidden = true;
      row.styleButton.hidden = true;
    }
    const button = scene.buttons.get(row.id);
    const wanted = button ? 'knopf:' + button.label : param ? param.kind + ':' + param.name : '';
    if (row.extraEl.dataset.control !== wanted) {
      row.extraEl.dataset.control = wanted;
      if (button) row.extraEl.replaceChildren(buttonControl(button));
      else if (!param) row.extraEl.replaceChildren();
      else if (param.kind === 'slider') row.extraEl.replaceChildren(sliderControl(param.name, state.animator, { onSettings: openSliderSheet }));
      else row.extraEl.replaceChildren(checkboxControl(param.name, state.animator));
    }
    if (param && param.kind === 'slider') {
      row.graph = row.graph || {};
      if (!row.graph.slider || row.graph.slider.initial === undefined) row.graph.slider = { ...(row.graph.slider || {}), initial: param.value };
    }
    if (param && param.kind === 'checkbox') {
      row.graph = row.graph || {};
      if (!row.graph.checkbox) row.graph.checkbox = { initial: param.value };
    }
  }
  state.animator.prune();
  state.animator.refreshControls();
}

function toggleVisible(object) {
  object.row.graph = object.row.graph || {};
  object.row.graph.visible = !isVisible(object);
  if (!object.row.graph.visible && state.graph.selected === object.id) state.graph.select(null);
  decorateRows();
  state.graph.redraw();
  changed();
}

function openStyle(row) {
  const object = state.scene.objects.find((o) => o.row.id === row.id);
  if (!object) return;
  styleSheet(object, () => {
    decorateRows();
    state.graph.redraw();
    changed();
  });
}

function openSliderSheet(name) {
  const param = state.scene.params.get(name);
  if (!param) return;
  sliderSheet(param.row, name, param.value, () => {
    state.animator.refreshControls();
    changed();
  });
}

// Sliders, checkboxes and dragged points write their value back into their row.

function nameLatex(name) {
  return toLatex({ t: 'sym', v: name });
}

function numberText(value) {
  const rounded = Number(Number(value).toFixed(8));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function writeParam(row, name, value) {
  if (typeof value === 'boolean') {
    const word = value ? 'wahr' : 'falsch';
    state.cas.setInput(row, row.mode === 'text' ? { text: `${name}=${word}` } : { latex: `${nameLatex(name)}=\\mathrm{${word}}` });
  } else {
    state.cas.setInput(row, row.mode === 'text' ? { text: `${name}=${numberText(value)}` } : { latex: `${nameLatex(name)}=${numberText(value)}` });
  }
}

function writePoint(row, name, x, y) {
  const callForm = row.result && row.result.tree && row.result.tree.t === 'call';
  if (row.mode === 'text') state.cas.setInput(row, { text: `${name}${callForm ? '' : '='}(${numberText(x)}|${numberText(y)})` });
  else state.cas.setInput(row, { latex: `${nameLatex(name)}${callForm ? '' : '='}\\left(${numberText(x)}\\middle|${numberText(y)}\\right)` });
}

/** A point on an object moved: punktauf(g, 1.5) */
function writeGlider(row, name, t) {
  const tree = row.result && row.result.tree;
  const body = tree && (tree.t === 'rel' ? tree.b : null);
  if (!body || body.t !== 'call') return;
  const call = { t: 'call', f: body.f, args: [body.args[0], { t: 'num', v: numberText(t) }] };
  const text = `${name}=${body.f}(${plainOf(body.args[0])},${numberText(t)})`;
  if (row.mode === 'text') state.cas.setInput(row, { text });
  else state.cas.setInput(row, { latex: `${nameLatex(name)}=${toLatex(call)}` });
}

/** A tree as the text a student would type: points as (1|2) */
function plainOf(node) {
  if (node.t === 'list' && node.point) return '(' + node.items.map(plainOf).join('|') + ')';
  if (node.t === 'call') return `${node.f}(${node.args.map(plainOf).join(',')})`;
  if (node.t === 'sym' || node.t === 'num') return node.v;
  return toLatexFree(node);
}

function toLatexFree(node) {
  // Fallback for anything else: Giac-style text, which the text parser reads too
  return String(state.engine.giac(node));
}

// Constructions from the graphics become rows.

function takenNames() {
  const taken = new Set(state.engine ? state.engine.defined.keys() : []);
  for (const o of state.scene.objects) if (o.name) taken.add(o.name);
  for (const name of state.scene.params.keys()) taken.add(name);
  return taken;
}

function createPoint(x, y) {
  if (!state.engine) return null;
  const name = nextName('point', takenNames());
  state.cas.append({ latex: `${nameLatex(name)}\\left(${numberText(x)}\\middle|${numberText(y)}\\right)` });
  changed();
  return name;
}

function construct(tool, picks) {
  if (!state.engine) return;
  let kind = tool.kind;
  if (kind === 'same') {
    const first = state.scene.objects.find((o) => o.name === picks[0]);
    kind = first && first.type === 'point' ? 'point' : first && first.type === 'polygon' ? 'polygon' : 'object';
  }
  const name = nextName(kind, takenNames());
  const text = `${name}=${tool.build(picks)}`;
  let latex;
  try {
    latex = toLatex(parsePlain(text, { isFunction: (n) => state.engine.isFunction(n) }));
  } catch (e) {
    latex = null;
  }
  const row = state.cas.append(latex ? { latex } : { mode: 'text', text });
  if (row.result && !row.result.ok) toast(row.result.error);
  changed();
}

// While something moves, the rows follow a few times a second; how often depends on how long they take.
const live = { timer: null, index: Infinity, cost: 0, last: 0 };

function liveRecalculate(row) {
  const index = state.cas.rows.indexOf(row);
  if (index < 0) return;
  live.index = Math.min(live.index, index);
  if (live.timer) return;
  const wait = Math.max(0, Math.max(150, live.cost * 4) - (performance.now() - live.last));
  live.timer = setTimeout(runLive, wait);
}

function runLive() {
  live.timer = null;
  const index = live.index;
  live.index = Infinity;
  if (!state.engine || index === Infinity) return;
  const start = performance.now();
  for (const [name, param] of state.scene.params) if (param.dragging) writeParam(param.row, name, param.value);
  for (const [name, point] of state.scene.points) if (point.dragging) writePoint(point.row, name, point.x, point.y);
  for (const [name, glider] of state.scene.gliders) if (glider.dragging) writeGlider(glider.row, name, glider.t);
  state.cas.recalculate(index);
  live.last = performance.now();
  live.cost = live.last - start;
}

function settle(row) {
  clearTimeout(live.timer);
  live.timer = null;
  live.index = Infinity;
  const index = state.cas.rows.indexOf(row);
  if (index >= 0) state.cas.recalculate(index);
  changed();
}

// Header and layout

const titleEl = h('span.caption');
const statusEl = h('span.status', {}, h('span.dot'), h('span', {}, 'Rechenkern lädt'));
const layoutEl = h('div.segments', { role: 'tablist' });

function updateTitle() {
  titleEl.textContent = state.project.name || 'Neues Projekt';
}

function setStatus(kind, text) {
  statusEl.className = 'status ' + kind;
  statusEl.lastChild.textContent = text;
}

function layouts() {
  return window.innerWidth >= WIDE ? [['both', 'Beides'], ['cas', 'CAS'], ['graph', 'Grafik'], ['space', '3D'], ['table', 'Tabelle']] : [['cas', 'CAS'], ['graph', 'Grafik'], ['space', '3D'], ['table', 'Tabelle']];
}

function setLayout(layout) {
  const allowed = layouts().map(([key]) => key);
  state.layout = allowed.includes(layout) ? layout : allowed[0];
  mainEl.dataset.layout = state.layout;
  layoutEl.replaceChildren(...layouts().map(([key, label]) => h('button', { role: 'tab', 'aria-selected': String(key === state.layout), onclick: () => setLayout(key) }, label)));
  try {
    localStorage.setItem('mathe.layout', state.layout);
  } catch (e) {
    // no storage: the layout is not remembered
  }
  requestAnimationFrame(() => {
    if (state.graph) state.graph.resize();
    if (state.layout === 'space' && state.space && state.space.init()) {
      state.space.resize();
      state.space.redraw();
    }
  });
}

function togglePanel() {
  if (state.panel) {
    state.panel.remove();
    state.panel = null;
    return;
  }
  state.panel = commandPanel({
    onInsert: (name) => {
      if (state.layout === 'graph') setLayout(window.innerWidth >= WIDE ? 'both' : 'cas');
      state.cas.insertCommand(name);
      if (window.innerWidth <= 760) togglePanel();
    },
    onTry: (example) => {
      if (state.layout === 'graph') setLayout(window.innerWidth >= WIDE ? 'both' : 'cas');
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
    const table = (t) => (t ? [t.head.join(' | '), ...t.rows.map((cells) => cells.join(' | '))].map((line) => '  ' + line).join('\n') + '\n' : '');
    const output = !r ? '' : r.ok ? (r.kind === 'analysis' ? table(r.table) + r.rows.map((x) => `  ${x.label}: ${x.latex}`).join('\n') : r.latex + (r.approxLatex ? '  ≈ ' + r.approxLatex : '')) : 'Fehler: ' + r.error;
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
      h('button', { onclick: () => { close(); exportGraph(); } }, 'Grafik exportieren …'),
      h('button', { onclick: () => { close(); settings(); } }, 'Einstellungen'),
    ),
  ]);
}

// Graphics: tools, the strip of sliders and the input line

function exportGraph() {
  if (state.layout === 'cas') setLayout('graph');
  requestAnimationFrame(() => exportSheet({
    canInsert: hasApp(),
    onShare: () => share('Grafik.png', 'image/png', state.graph.png(2), true),
    onInsert: async () => {
      const answer = await insertIntoDocument(state.graph.png(2));
      if (answer) toast(answer);
    },
  }));
}

const playAllButton = h('button.tool', { 'aria-label': 'Alle Schieberegler abspielen', title: 'Abspielen', hidden: true, onclick: () => { state.animator.toggleAll(); updatePlayAll(); } }, '▶');
const resetButton = h('button.tool', { 'aria-label': 'Zurücksetzen', title: 'Alles auf Anfang', hidden: true, onclick: () => state.animator.reset() }, '⟲');

function updatePlayAll() {
  const any = [...state.scene.params.values()].some((p) => p.kind === 'slider');
  playAllButton.hidden = !any;
  resetButton.hidden = !state.scene.params.size;
  playAllButton.textContent = state.animator.anyPlaying ? '❚❚' : '▶';
}

function buildTools() {
  const g = state.graph;
  g.tools.replaceChildren(
    h('button.tool', { 'aria-label': 'Vergrößern', title: 'Vergrößern', onclick: () => { g.zoom(0.7); g.viewChanged(); } }, '+'),
    h('button.tool', { 'aria-label': 'Verkleinern', title: 'Verkleinern', onclick: () => { g.zoom(1 / 0.7); g.viewChanged(); } }, '−'),
    h('button.tool', { 'aria-label': 'Standardansicht', title: 'Standardansicht', onclick: () => g.standardView() }, '⌂'),
    playAllButton,
    resetButton,
    h('button.tool', { 'aria-label': 'Objekte', title: 'Objekte', onclick: () => objectsSheet(state.scene, {
      onToggle: toggleVisible,
      onSelect: (object) => g.select(object),
      onStyle: (object) => openStyle(object.row),
    }) }, '☰'),
    h('button.tool', { 'aria-label': 'Koordinatensystem', title: 'Koordinatensystem', onclick: () => settingsSheet(g, changed) }, '⚙'),
    h('button.tool', { 'aria-label': 'Exportieren', title: 'Exportieren', onclick: exportGraph }, '⤴'),
  );
}

/** Buttons of the 3D view */
function buildSpaceTools() {
  const v = state.space;
  const projection = h('button.tool', { 'aria-label': 'Perspektive oder Parallelprojektion', title: 'Perspektive / parallel', onclick: () => {
    v.settings.perspective = !v.settings.perspective;
    v.useCamera();
    projection.textContent = v.settings.perspective ? 'P' : 'O';
    v.redraw();
    changed();
  } }, 'P');
  v.tools.replaceChildren(
    h('button.tool', { 'aria-label': 'Vergrößern', title: 'Vergrößern', onclick: () => v.zoom(0.8) }, '+'),
    h('button.tool', { 'aria-label': 'Verkleinern', title: 'Verkleinern', onclick: () => v.zoom(1.25) }, '−'),
    h('button.tool', { 'aria-label': 'Standardansicht', title: 'Standardansicht', onclick: () => v.resetView() }, '⌂'),
    projection,
    h('button.tool', { 'aria-label': 'Koordinatensystem', title: 'Koordinatensystem', onclick: () => spaceSettings() }, '⚙'),
    h('button.tool', { 'aria-label': 'Exportieren', title: 'Exportieren', onclick: () => exportSheet({
      canInsert: hasApp(),
      onShare: () => share('Grafik-3D.png', 'image/png', v.png(), true),
      onInsert: async () => {
        const answer = await insertIntoDocument(v.png());
        if (answer) toast(answer);
      },
    }) }, '⤴'),
  );
}

function spaceSettings() {
  const v = state.space;
  const s = v.settings;
  const flag = (label, key) => h('div.field', {}, label, toggle([[true, 'an'], [false, 'aus']], s[key], (value) => {
    s[key] = value;
    if (key === 'perspective') v.useCamera();
    v.redraw();
    changed();
  }));
  sheet((close) => [
    h('h2', {}, '3D-Koordinatensystem'),
    h('div.field', {}, 'Bereich', toggle([[3, '±3'], [5, '±5'], [10, '±10'], [20, '±20']], s.range, (value) => {
      s.range = value;
      v.labelCache.clear();
      v.resetView();
      changed();
    })),
    flag('Achsen', 'axes'),
    flag('Gitter in der xy-Ebene', 'grid'),
    flag('Rahmen', 'box'),
    h('div.field', {}, 'Darstellung', toggle([[true, 'perspektivisch'], [false, 'parallel']], s.perspective, (value) => {
      s.perspective = value;
      v.useCamera();
      v.redraw();
      changed();
    })),
    h('div.actions', {}, h('button.pill.primary', { onclick: () => close() }, 'Fertig')),
  ]);
}

const stripEl = h('div.strip');

/** Sliders and checkboxes under the graphics, for working without the CAS in view. */
function renderStrip() {
  const names = [...state.scene.params.entries()];
  const buttons = [...state.scene.buttons.values()];
  const key = names.map(([name, p]) => p.kind + name).join(',') + buttons.map((b) => 'knopf' + b.row.id + b.label).join(',');
  if (stripEl.dataset.key !== key) {
    stripEl.dataset.key = key;
    stripEl.replaceChildren(
      ...names.map(([name, p]) => (p.kind === 'slider' ? sliderControl(name, state.animator, { onSettings: openSliderSheet, compact: true }) : checkboxControl(name, state.animator))),
      ...buttons.map(buttonControl),
    );
  }
  updatePlayAll();
}

function buildInputLine() {
  const field = document.createElement('math-field');
  const line = h('div.graph-input', {}, h('span.caption', {}, 'Eingabe'), field);
  field.mathVirtualKeyboardPolicy = 'manual';
  field.smartFence = true;
  field.addEventListener('focusin', () => window.mathVirtualKeyboard.show());
  field.addEventListener('change', () => {
    const latex = field.value.trim();
    if (!latex) return;
    const row = state.cas.append({ latex });
    field.value = '';
    if (row.result && !row.result.ok) toast(row.result.error);
    changed();
  });
  setTimeout(() => {
    try {
      field.menuItems = [];
    } catch (e) {
      // menu hidden by CSS anyway
    }
    field.placeholder = 'f(x) = … · A(1|2) · a = 1';
  }, 0);
  return line;
}

const header = h('header.bar', {},
  h('span.pixel', {}, 'Rechner'),
  titleEl,
  h('span.spacer'),
  statusEl,
  layoutEl,
  h('button.pill', { onclick: togglePanel }, 'Befehle'),
  h('button.icon-button', { onclick: menu, 'aria-label': 'Projekt' }, '⋯'),
);
const mainEl = h('div.main');

function start() {
  const app = document.getElementById('app');
  state.cas = new CasView({
    engine: engineProxy,
    onChange: changed,
    onResults: () => {
      // Formulas may use what the CAS defined; values-only sheets need nothing.
      if (state.table && state.table.sheet.hasFormulas) recalcTable();
      refreshScene();
    },
    onStyle: openStyle,
    onSubmitted: (row) => {
      // Typing a new value makes it the one a reset returns to.
      if (row.graph && row.graph.slider) delete row.graph.slider.initial;
      if (row.graph && row.graph.checkbox) delete row.graph.checkbox;
    },
  });
  state.graph = new GraphView({
    scene: state.scene,
    onViewChange: changed,
    onSelect: (row) => {
      if (row && state.layout !== 'graph') state.cas.reveal(row);
      if (row) runRowScript(row, 'click');
    },
    onCreatePoint: createPoint,
    onConstruct: construct,
    onGliderMove: (name, t, done) => {
      const glider = state.scene.gliders.get(name);
      if (!glider) return;
      if (done) {
        writeGlider(glider.row, name, t);
        settle(glider.row);
      } else {
        glider.dragging = true;
        liveRecalculate(glider.row);
      }
    },
    onPointMove: (name, x, y, done) => {
      const point = state.scene.points.get(name);
      if (!point) return;
      if (done) {
        writePoint(point.row, name, x, y);
        settle(point.row);
      } else {
        point.dragging = true;
        liveRecalculate(point.row);
      }
    },
  });
  state.space = new SpaceView({ scene: state.scene, onViewChange: changed });
  state.table = new TableView({
    onChange: tableChanged,
    onCas: (text) => appendFromTable(text, false),
    onChart: (text) => appendFromTable(text, true),
  });
  state.animator = new Animator({
    scene: state.scene,
    onFrame: () => {
      state.graph.redraw();
      state.space.redraw();
      updatePlayAll();
    },
    onLive: (row) => liveRecalculate(row),
    onSettle: (row, name, value) => {
      writeParam(row, name, value);
      settle(row);
      updatePlayAll();
    },
  });
  buildTools();
  buildSpaceTools();
  state.graph.bottom.append(stripEl, buildInputLine());
  state.cas.el.classList.add('cas-pane');
  state.graph.el.classList.add('graph-pane');
  state.space.el.classList.add('space-pane');
  state.table.el.classList.add('table-pane');
  mainEl.append(state.cas.el, state.graph.el, state.space.el, state.table.el);
  app.append(header, mainEl);
  let remembered = null;
  try {
    remembered = localStorage.getItem('mathe.layout');
  } catch (e) {
    remembered = null;
  }
  setLayout(remembered || (window.innerWidth >= WIDE ? 'both' : 'cas'));
  window.addEventListener('resize', () => setLayout(state.layout));
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
    else {
      state.graph.setSettings(DEFAULT_SETTINGS);
      state.space.setSettings(DEFAULT_SETTINGS_3D);
      state.cas.load([]);
    }
    if (window.__giacReady) giacReady();
    const last = state.cas.rows[state.cas.rows.length - 1];
    if (last && state.layout !== 'graph') state.cas.focus(last);
  });
  notifyReady();
}

function giacReady() {
  if (state.engine) return;
  state.engine = new Engine(window.CAS);
  state.engine.sheet = state.table.sheet;
  applySettings();
  setStatus('ready', 'Giac · exakt');
  recalcTable();
  state.cas.recalculate(0);
}

// The calculator for other code: a JavaScript API (window.Mathe.api) and the same calls by postMessage, so a web
// page that embeds mathe.html in an iframe can drive it and listen to it.
const listeners = new Map();

function emit(event, data) {
  for (const fn of listeners.get(event) || []) {
    try {
      fn(data);
    } catch (e) {
      // a listener's own error stays with the listener
    }
  }
  if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'mathe', event, data }, '*');
}

const api = {
  /** Calculates a line without adding it: { ok, latex, error } */
  evaluate(text) {
    if (!state.engine) return { ok: false, error: 'Der Rechenkern lädt noch.' };
    const r = state.engine.evaluate({ text: String(text) });
    return { ok: r.ok, latex: r.latex || null, approx: r.approxLatex || null, error: r.error || null };
  },
  /** Adds a row as if typed; returns its result */
  addRow(text) {
    const row = state.cas.append({ mode: 'text', text: String(text) });
    changed();
    return row.result ? { ok: row.result.ok, latex: row.result.latex || null, error: row.result.error || null } : null;
  },
  /** The number a name or term has now */
  getValue(expr) {
    return scriptValue(expr);
  },
  setValue(name, value) {
    scriptApi.set(name, String(value));
    changed();
  },
  /** Every object: name, type, visible, and for points their coordinates */
  objects() {
    return state.scene.objects.map((o) => ({ name: o.name, type: o.type, visible: isVisible(o), at: o.type === 'point' ? o.at() : undefined }));
  },
  rows() {
    return state.cas.rows.filter((r) => !state.cas.isEmpty(r)).map((r) => ({ input: r.mode === 'text' ? r.text : r.latex, ok: r.result ? r.result.ok : null, latex: r.result && r.result.latex, error: r.result && r.result.error }));
  },
  cell(ref) {
    return state.table.sheet.display(String(ref).toUpperCase());
  },
  setCell(ref, raw) {
    state.table.sheet.set(String(ref).toUpperCase(), raw);
    tableChanged();
  },
  runScript(text) {
    const failed = runScript(text, scriptApi);
    changed();
    return failed;
  },
  /** The graphics as a PNG data URL */
  png() {
    return state.graph.png(2);
  },
  /** on('change', fn): fn({ rows }) after every calculation; returns a function that stops listening */
  on(event, fn) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    return () => listeners.get(event).delete(fn);
  },
};

window.addEventListener('message', (e) => {
  const message = e.data;
  if (!message || message.target !== 'mathe' || typeof api[message.call] !== 'function' || message.call === 'on') return;
  let result;
  let error = null;
  try {
    result = api[message.call](...(message.args || []));
  } catch (err) {
    error = err.message || String(err);
  }
  if (e.source) e.source.postMessage({ source: 'mathe', id: message.id, result, error }, '*');
});

window.Mathe = {
  api,
  giacReady,
  reply,
  setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    if (state.graph) state.graph.redraw();
    if (state.space) state.space.redraw();
  },
  // For tests and the app: the current state
  get state() {
    return state;
  },
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();

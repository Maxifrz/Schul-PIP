// The CAS view: numbered rows with a formula editor each, the exact answer and its decimal value below. Enter
// calculates; a changed definition recalculates every row after it.

import { convertLatexToMarkup } from 'mathlive';
import { h, toast } from './ui.js';
import { commandTemplate } from './keyboard.js';
import { COMMANDS, searchCommands } from './commands.js';

let nextId = 1;

/** Typing a command's name turns it into an upright command name. */
function shortcuts() {
  const out = {};
  for (const c of COMMANDS) {
    for (const name of [c.name, ...(c.aliases || [])]) {
      if (name.length >= 4 && /^[a-z]+$/.test(name)) out[name] = `\\operatorname{${c.name}}`;
    }
  }
  // Words MathLive knows as something else
  delete out.sinh;
  delete out.cosh;
  return out;
}

/** Splits LaTeX at line breaks (\\\\) that are not inside an environment such as a matrix. */
function lines(latex) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < latex.length; i++) {
    if (latex.startsWith('\\begin{', i)) depth++;
    else if (latex.startsWith('\\end{', i)) depth--;
    else if (depth === 0 && latex.startsWith('\\\\', i)) {
      out.push(latex.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  out.push(latex.slice(start));
  return out.filter((line) => line.trim());
}

export class CasView {
  constructor({ engine, onChange, onResults, onSubmitted, onStyle }) {
    this.engine = engine;
    this.onChange = onChange;
    this.onResults = onResults || (() => {});
    this.onSubmitted = onSubmitted || (() => {});
    this.onStyle = onStyle || (() => {});
    this.rows = [];
    this.active = null;
    this.shortcuts = shortcuts();
    this.list = h('div.rows');
    this.suggestions = h('div.suggestions');
    this.el = h('section.view', {}, this.list, this.suggestions);
  }

  // Rows

  addRow(content = {}, after = null) {
    const row = { id: nextId++, mode: content.mode || 'math', latex: content.latex || '', text: content.text || '', result: null, graph: content.graph ? JSON.parse(JSON.stringify(content.graph)) : {} };
    row.el = h('div.row');
    row.numberEl = h('span');
    // The dot shows the colour of the row's object in the graphics; a tap shows or hides it.
    row.dotEl = h('button.object-dot', { 'aria-label': 'In der Grafik zeigen oder ausblenden', hidden: true });
    row.gutterEl = h('div.number', {}, row.numberEl, row.dotEl);
    row.inputEl = h('div.input');
    row.outputEl = h('div.output');
    row.extraEl = h('div.extra');
    row.styleButton = h('button', { title: 'Darstellung', 'aria-label': 'Darstellung', hidden: true, onclick: () => this.onStyle(row) }, '◐');
    row.actionsEl = h('div.actions', {},
      row.styleButton,
      h('button', { title: 'Ergebnis in neue Zeile', 'aria-label': 'Ergebnis übernehmen', onclick: () => this.reuse(row) }, '↳'),
      h('button', { title: 'Formel oder Text', 'aria-label': 'Eingabeart wechseln', onclick: () => this.switchMode(row) }, 'T'),
      h('button', { title: 'Zeile löschen', 'aria-label': 'Zeile löschen', onclick: () => this.removeRow(row) }, '×'),
    );
    row.el.append(row.gutterEl, row.inputEl, row.actionsEl, row.outputEl, row.extraEl);
    const index = after ? this.rows.indexOf(after) + 1 : this.rows.length;
    this.rows.splice(index, 0, row);
    const before = this.rows[index + 1];
    if (before) this.list.insertBefore(row.el, before.el);
    else this.list.append(row.el);
    // The formula editor takes its options only once it is in the page.
    this.buildInput(row);
    this.renumber();
    return row;
  }

  buildInput(row) {
    row.inputEl.replaceChildren();
    if (row.mode === 'text') {
      const area = h('textarea.text-input', { rows: 1, spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', placeholder: 'Text eingeben, z. B. löse(x^2=4, x)' });
      area.value = row.text;
      area.addEventListener('focus', () => this.activate(row));
      area.addEventListener('input', () => {
        row.text = area.value;
        area.style.height = 'auto';
        area.style.height = area.scrollHeight + 'px';
      });
      area.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submit(row);
        }
      });
      row.field = area;
      row.inputEl.append(area);
      return;
    }
    const field = document.createElement('math-field');
    row.inputEl.append(field);
    field.mathVirtualKeyboardPolicy = 'manual';
    field.smartFence = true;
    field.smartMode = false;
    field.letterShapeStyle = 'tex';
    try {
      field.menuItems = [];
    } catch (e) {
      // Older WebKit mounts the field a moment later; the menu is hidden by CSS anyway.
    }
    field.inlineShortcuts = { ...field.inlineShortcuts, ...this.shortcuts };
    field.value = row.latex;
    field.addEventListener('focusin', () => {
      this.activate(row);
      window.mathVirtualKeyboard.show();
    });
    field.addEventListener('input', () => {
      row.latex = field.value;
      this.suggest(row);
    });
    field.addEventListener('change', () => this.submit(row));
    field.addEventListener('move-out', (e) => {
      const index = this.rows.indexOf(row);
      const target = e.detail.direction === 'upward' || e.detail.direction === 'backward' ? this.rows[index - 1] : this.rows[index + 1];
      if (target) {
        e.preventDefault();
        this.focus(target);
      }
    });
    row.field = field;
  }

  switchMode(row) {
    if (row.mode === 'math') {
      row.text = row.result?.giacInput || row.text || '';
      row.mode = 'text';
    } else {
      row.mode = 'math';
    }
    this.buildInput(row);
    this.focus(row);
    this.onChange();
  }

  removeRow(row) {
    const index = this.rows.indexOf(row);
    if (index < 0) return;
    row.el.remove();
    this.rows.splice(index, 1);
    if (!this.rows.length) this.addRow();
    this.renumber();
    this.recalculate(index);
    this.onResults();
    this.onChange();
  }

  renumber() {
    this.rows.forEach((row, i) => {
      row.numberEl.textContent = String(i + 1);
    });
  }

  rowById(id) {
    return this.rows.find((row) => row.id === id) || null;
  }

  activate(row) {
    if (this.active === row) return;
    if (this.active) this.active.el.classList.remove('active');
    this.active = row;
    row.el.classList.add('active');
  }

  focus(row) {
    this.activate(row);
    setTimeout(() => {
      row.field.focus();
      row.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 0);
  }

  // Calculating

  inputOf(row) {
    return row.mode === 'text' ? { text: row.text } : { latex: row.latex };
  }

  isEmpty(row) {
    return row.mode === 'text' ? !row.text.trim() : !row.latex.trim();
  }

  submit(row, { focusNext = true } = {}) {
    this.suggestions.replaceChildren();
    if (this.isEmpty(row)) return;
    const wasDefinition = row.result && row.result.kind === 'definition';
    this.calculate(row);
    if (row.result?.kind === 'definition' || wasDefinition) this.recalculate(this.rows.indexOf(row) + 1);
    let next = this.rows[this.rows.indexOf(row) + 1];
    if (!next) next = this.addRow({ mode: row.mode });
    this.onSubmitted(row);
    this.onResults();
    if (focusNext) this.focus(next);
    this.onChange();
  }

  /** A new row from elsewhere (the input line of the graphics), calculated at once. */
  append(content) {
    let row = this.rows[this.rows.length - 1];
    if (!row || !this.isEmpty(row)) row = this.addRow(content);
    else {
      row.mode = content.mode || 'math';
      row.latex = content.latex || '';
      row.text = content.text || '';
      this.buildInput(row);
    }
    this.submit(row, { focusNext: false });
    return row;
  }

  /** Scrolls to a row and marks it, when its object was tapped in the graphics. */
  reveal(row) {
    this.activate(row);
    row.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** Sets a row's input from outside (a slider, a dragged point) without typing. */
  setInput(row, content) {
    if (content.latex !== undefined) row.latex = content.latex;
    if (content.text !== undefined) row.text = content.text;
    if (row.field) row.field.value = row.mode === 'text' ? row.text : row.latex;
  }

  calculate(row) {
    if (this.isEmpty(row)) {
      row.result = null;
      row.outputEl.replaceChildren();
      return;
    }
    let result;
    try {
      result = this.engine.evaluate(this.inputOf(row));
    } catch (e) {
      result = { ok: false, error: 'Das konnte nicht berechnet werden.' };
    }
    row.result = result;
    this.render(row);
  }

  /** Calculates every row from `index` on again, in order, so definitions reach the rows after them. */
  recalculate(index = 0) {
    for (const row of this.rows.slice(index)) if (!this.isEmpty(row)) this.calculate(row);
    this.onResults();
  }

  render(row) {
    const r = row.result;
    if (!r) {
      row.outputEl.replaceChildren();
      return;
    }
    if (!r.ok) {
      row.outputEl.replaceChildren(h('div.error', {}, r.error || 'Fehler'));
      return;
    }
    const math = (latex) => h('span', {}, ...lines(latex).map((line, i) => h('span', { style: { display: i ? 'block' : 'inline' }, html: convertLatexToMarkup(line) })));
    if (r.kind === 'analysis') {
      const grid = h('div.analysis', {}, h('div.title', {}, ...(r.function ? [r.title + ' von ', math('f\\left(x\\right)=' + r.function)] : [r.title])));
      if (r.table) {
        // A table of values: head row, then one row per value
        const table = h('table.stat-table', {}, h('thead', {}, h('tr', {}, ...r.table.head.map((cell) => h('th', {}, cell)))),
          h('tbody', {}, ...r.table.rows.map((cells) => h('tr', {}, ...cells.map((cell) => h('td', {}, math(cell)))))));
        grid.append(h('div.table-wrap', {}, table));
      }
      for (const item of r.rows) grid.append(h('div.label', {}, item.label), h('div', {}, math(item.latex)));
      row.outputEl.replaceChildren(grid);
      return;
    }
    row.outputEl.replaceChildren(...[
      h('div', {}, h('span.arrow', {}, '→'), math(r.latex)),
      r.approxLatex ? h('div.approx', {}, math('\\approx ' + r.approxLatex.replace(/^L=/, 'L\\approx'))) : null,
    ].filter(Boolean));
  }

  reuse(row) {
    const r = row.result;
    if (!r || !r.ok || !r.latex || r.kind === 'analysis') {
      toast('Diese Zeile hat kein Ergebnis zum Übernehmen.');
      return;
    }
    const latex = r.kind === 'definition' || r.kind === 'solutions' ? r.latex.replace(/^[^=]*=/, '') : r.latex;
    const next = this.addRow({ latex }, row);
    this.focus(next);
    this.onChange();
  }

  // Inserting from the keyboard, the command search and the suggestions

  insert(latex) {
    const row = this.active || this.rows[this.rows.length - 1];
    if (row.mode === 'text') {
      row.field.setRangeText(latex.replace(/\\operatorname\{([^}]*)\}\\left\(/g, '$1(').replace(/\\right\)/g, ')').replace(/#\?/g, ''), row.field.selectionStart, row.field.selectionEnd, 'end');
      row.text = row.field.value;
      row.field.focus();
      return;
    }
    row.field.executeCommand(['insert', latex, { insertionMode: 'replaceSelection', selectionMode: 'placeholder', format: 'latex' }]);
    row.field.focus();
    row.latex = row.field.value;
  }

  insertCommand(name) {
    this.insert(commandTemplate(name));
  }

  /** Suggestions for the word being typed: "null" → nullstellen, … */
  suggest(row) {
    const before = row.field.getValue ? row.field.getValue(0, row.field.position, 'latex') : '';
    const word = /([A-Za-zÄÖÜäöüß]{2,})$/.exec(before.replace(/\\operatorname\{[^}]*\}/g, ' '));
    if (!word) {
      this.suggestions.replaceChildren();
      return;
    }
    const prefix = word[1].toLowerCase();
    const found = searchCommands(prefix).filter((c) => [c.name, ...(c.aliases || [])].some((n) => n.startsWith(prefix))).slice(0, 6);
    this.suggestions.replaceChildren(...found.map((c) => h('button', {
      onclick: () => {
        for (let i = 0; i < word[1].length; i++) row.field.executeCommand('deleteBackward');
        this.insertCommand(c.name);
        this.suggestions.replaceChildren();
      },
    }, h('b', {}, c.name), h('span', {}, c.syntax.split(/ · | oder /)[0].replace(/^[^(]*/, '')))));
  }

  /** Runs an example from the command search in a new row. */
  tryExample(text) {
    let row = this.rows[this.rows.length - 1];
    if (!this.isEmpty(row)) row = this.addRow({ mode: 'text' });
    else if (row.mode !== 'text') {
      row.mode = 'text';
      this.buildInput(row);
    }
    row.text = text;
    row.field.value = text;
    this.submit(row);
  }

  // Saving

  serialize() {
    return this.rows.filter((row) => !this.isEmpty(row)).map((row) => {
      const out = row.mode === 'text' ? { mode: 'text', text: row.text } : { mode: 'math', latex: row.latex };
      if (row.graph && Object.keys(row.graph).length) out.graph = row.graph;
      return out;
    });
  }

  load(rows) {
    this.rows.forEach((row) => row.el.remove());
    this.rows = [];
    this.active = null;
    for (const content of rows || []) this.addRow(content);
    this.recalculate(0);
    this.addRow();
  }
}

// The spreadsheet on screen: a grid with column letters and row numbers, an input line for the active cell, and
// tools to fill, number, sort, filter, chart and hand ranges to the CAS.

import { h, sheet, toast, toggle } from './ui.js';
import { Sheet, COLUMNS, refName, colName, parseRef } from './table.js';

const MIN_ROWS = 60;

export class TableView {
  /**
   * onChange(): the cells changed (recalculate, save) · onCas(text): add a CAS row · onChart(text): add a chart row
   */
  constructor({ onChange, onCas, onChart }) {
    this.sheet = new Sheet();
    this.onChange = onChange || (() => {});
    this.onCas = onCas || (() => {});
    this.onChart = onChart || (() => {});
    this.active = [0, 0];
    this.anchor = [0, 0];
    this.rangeMode = false;
    this.clipboard = null;
    this.dragging = false;

    this.refEl = h('span.table-ref', {}, 'A1');
    this.input = h('input.table-input', { type: 'text', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', placeholder: 'Zahl, Text oder =Formel, z. B. =A1*2 oder =SUMME(A1:A10)' });
    this.input.addEventListener('keydown', (e) => this.inputKey(e));
    this.input.addEventListener('blur', () => this.commit(false));
    this.rangeButton = h('button.tool-pill', { 'aria-pressed': 'false', title: 'Tippen erweitert die Auswahl', onclick: () => this.toggleRange() }, 'Bereich');
    const tool = (label, title, onclick) => h('button.tool-pill', { title, onclick }, label);
    this.toolbar = h('div.table-tools', {},
      this.rangeButton,
      tool('↓ Füllen', 'Nach unten ausfüllen: Zahlenreihen fortsetzen, Formeln mit ihren Bezügen kopieren', () => this.fill('down')),
      tool('→ Füllen', 'Nach rechts ausfüllen', () => this.fill('right')),
      tool('Reihe …', 'Datenreihe: Startwert, Schrittweite, Anzahl', () => this.seriesSheet()),
      tool('Sortieren …', 'Den markierten Bereich nach einer Spalte sortieren', () => this.sortSheet()),
      tool('Filter …', 'Zeilen nach einer Bedingung ausblenden', () => this.filterSheet()),
      tool('Diagramm …', 'Aus dem markierten Bereich ein Diagramm zeichnen', () => this.chartSheet()),
      tool('In CAS …', 'Den Bereich als Liste, Kennzahlen oder Regression in den CAS', () => this.casSheet()),
      tool('Leeren', 'Die markierten Zellen leeren', () => this.clearSelection()),
    );
    this.grid = h('div.table-grid', { tabindex: '0' });
    this.grid.addEventListener('keydown', (e) => this.gridKey(e));
    this.grid.addEventListener('paste', (e) => this.pasteEvent(e));
    this.grid.addEventListener('copy', (e) => this.copyEvent(e));
    this.errorEl = h('div.table-error');
    this.el = h('section.table', {}, h('div.table-bar', {}, this.refEl, this.input), this.toolbar, this.errorEl, this.grid);
    window.addEventListener('pointerup', () => {
      this.dragging = false;
    });
    this.render();
  }

  load(data) {
    this.sheet.load(data);
    this.render();
  }

  // Selection

  get selection() {
    const [c0, r0] = this.anchor;
    const [c1, r1] = this.active;
    return [Math.min(c0, c1), Math.min(r0, r1), Math.max(c0, c1), Math.max(r0, r1)];
  }

  get selectionText() {
    const [c0, r0, c1, r1] = this.selection;
    return c0 === c1 && r0 === r1 ? refName(c0, r0) : `${refName(c0, r0)}:${refName(c1, r1)}`;
  }

  select(c, r, extend = false) {
    this.commit(false);
    c = Math.max(0, Math.min(COLUMNS - 1, c));
    r = Math.max(0, r);
    this.active = [c, r];
    if (!extend) this.anchor = [c, r];
    this.showActive();
  }

  toggleRange() {
    this.rangeMode = !this.rangeMode;
    this.rangeButton.setAttribute('aria-pressed', String(this.rangeMode));
  }

  showActive() {
    const ref = refName(...this.active);
    this.refEl.textContent = this.selectionText;
    this.input.value = this.sheet.get(ref);
    this.editing = false;
    const v = this.sheet.display(ref);
    this.errorEl.textContent = v.kind === 'error' ? v.error : '';
    this.errorEl.hidden = v.kind !== 'error';
    this.paintSelection();
  }

  paintSelection() {
    const [c0, r0, c1, r1] = this.selection;
    for (const td of this.grid.querySelectorAll('td.cell')) {
      const c = Number(td.dataset.c);
      const r = Number(td.dataset.r);
      td.classList.toggle('selected', c >= c0 && c <= c1 && r >= r0 && r <= r1);
      td.classList.toggle('active', c === this.active[0] && r === this.active[1]);
    }
    const active = this.grid.querySelector('td.active');
    if (active) active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Editing

  commit(move) {
    if (!this.editing) return;
    this.editing = false;
    const ref = refName(...this.active);
    const value = this.input.value;
    if (value !== this.sheet.get(ref)) {
      this.sheet.set(ref, value);
      this.onChange();
    }
    if (move) this.select(this.active[0] + move[0], this.active[1] + move[1]);
  }

  inputKey(e) {
    this.editing = true;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.commit(e.shiftKey ? [0, -1] : [0, 1]);
      if (!this.editing) this.input.focus();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      this.commit(e.shiftKey ? [-1, 0] : [1, 0]);
      this.input.focus();
    } else if (e.key === 'Escape') {
      this.editing = false;
      this.input.value = this.sheet.get(refName(...this.active));
      this.grid.focus();
    }
  }

  gridKey(e) {
    const moves = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Enter: [0, 1], Tab: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dc, dr] = e.key === 'Tab' && e.shiftKey ? [-1, 0] : moves[e.key];
      this.select(this.active[0] + dc, this.active[1] + dr, e.shiftKey && e.key.startsWith('Arrow'));
      this.grid.focus();
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.clearSelection();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      this.clipboard = { selection: this.selection, raws: this.rawBlock(this.selection) };
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      this.fill('down');
      return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Typing starts editing the active cell.
      e.preventDefault();
      this.input.value = e.key;
      this.editing = true;
      this.input.focus();
    }
  }

  rawBlock([c0, r0, c1, r1]) {
    const rows = [];
    for (let r = r0; r <= r1; r++) {
      const row = [];
      for (let c = c0; c <= c1; c++) row.push(this.sheet.get(refName(c, r)));
      rows.push(row);
    }
    return rows;
  }

  copyEvent(e) {
    this.clipboard = { selection: this.selection, raws: this.rawBlock(this.selection) };
    e.clipboardData.setData('text/plain', this.sheet.copyText(this.selection));
    e.preventDefault();
  }

  pasteEvent(e) {
    const text = e.clipboardData.getData('text/plain');
    e.preventDefault();
    const [c, r] = this.active;
    // Copied inside the table: formulas keep their relative references.
    if (this.clipboard && text === this.sheet.copyText(this.clipboard.selection)) {
      const [sc, sr] = this.clipboard.selection;
      this.clipboard.raws.forEach((row, i) => row.forEach((raw, j) => {
        if (c + j < COLUMNS) this.sheet.set(refName(c + j, r + i), Sheet.shift(raw, c - sc, r - sr));
      }));
    } else this.sheet.paste(refName(c, r), text);
    this.onChange();
  }

  clearSelection() {
    this.sheet.clear(this.selection);
    this.onChange();
  }

  fill(direction) {
    const [c0, r0, c1, r1] = this.selection;
    if ((direction === 'down' && r0 === r1) || (direction === 'right' && c0 === c1)) {
      toast(direction === 'down' ? 'Markiere zuerst die Zellen darunter mit (Bereich).' : 'Markiere zuerst die Zellen rechts daneben mit (Bereich).');
      return;
    }
    this.sheet.fill(this.selection, direction);
    this.onChange();
  }

  // Sheets for the tools

  async seriesSheet() {
    const field = (label, value) => {
      const input = h('input', { type: 'text', inputmode: 'decimal', value });
      return [h('div.field.stacked', {}, label, input), input];
    };
    const [startRow, start] = field('Startwert', '1');
    const [stepRow, step] = field('Schrittweite', '1');
    const [countRow, count] = field('Anzahl', '10');
    let direction = 'down';
    const ok = await sheet((close) => [
      h('h2', {}, `Datenreihe ab ${refName(...this.active)}`),
      startRow, stepRow, countRow,
      h('div.field', {}, 'Richtung', toggle([['down', 'nach unten'], ['right', 'nach rechts']], direction, (v) => {
        direction = v;
      })),
      h('div.actions', {}, h('button.pill', { onclick: () => close(false) }, 'Abbrechen'), h('button.pill.primary', { onclick: () => close(true) }, 'Ausfüllen')),
    ]);
    if (!ok) return;
    const n = (input) => Number(input.value.replace(',', '.'));
    if (![n(start), n(step), n(count)].every(Number.isFinite) || n(count) < 1) {
      toast('Bitte Zahlen eingeben.');
      return;
    }
    this.sheet.series(refName(...this.active), n(start), n(step), Math.min(1000, Math.round(n(count))), direction);
    this.onChange();
  }

  async sortSheet() {
    const [c0, r0, c1, r1] = this.selection;
    if (r0 === r1) {
      toast('Markiere zuerst die Zeilen, die sortiert werden sollen (Bereich).');
      return;
    }
    const choice = await sheet((close) => [
      h('h2', {}, `${this.selectionText} sortieren`),
      h('div.list', {}, ...[].concat(...Array.from({ length: c1 - c0 + 1 }, (_, i) => [
        h('button', { onclick: () => close([c0 + i, false]) }, `nach Spalte ${colName(c0 + i)}`, h('span', {}, 'aufsteigend')),
        h('button', { onclick: () => close([c0 + i, true]) }, `nach Spalte ${colName(c0 + i)}`, h('span', {}, 'absteigend')),
      ]))),
      h('div.actions', {}, h('button.pill', { onclick: () => close(null) }, 'Abbrechen')),
    ]);
    if (!choice) return;
    this.sheet.sort(this.selection, choice[0], choice[1]);
    this.onChange();
  }

  async filterSheet() {
    const c = this.active[0];
    const input = h('input', { type: 'text', value: this.sheet.filters[c] || '', placeholder: 'z. B. >5, <=2, <>0 oder ein Wort' });
    const answer = await sheet((close) => [
      h('h2', {}, `Filter für Spalte ${colName(c)}`),
      h('div.field.stacked', {}, 'Zeilen zeigen, deren Wert …', input),
      h('p.hint', {}, 'Vergleiche mit >, <, >=, <=, = oder <>. Ohne Zeichen: der Text enthält das Wort. Leer lassen hebt den Filter auf.'),
      h('div.actions', {}, h('button.pill', { onclick: () => close(null) }, 'Abbrechen'), h('button.pill', { onclick: () => close('') }, 'Aufheben'), h('button.pill.primary', { onclick: () => close(input.value.trim()) }, 'Filtern')),
    ]);
    if (answer === null) return;
    if (answer) this.sheet.filters[c] = answer;
    else delete this.sheet.filters[c];
    this.onChange();
  }

  /** The columns of the selection as CAS terms zellen(A1, A10) */
  columns() {
    const [c0, r0, c1, r1] = this.selection;
    const out = [];
    for (let c = c0; c <= c1; c++) out.push(`zellen(${refName(c, r0)},${refName(c, r1)})`);
    return out;
  }

  async chartSheet() {
    const cols = this.columns();
    const one = cols[0];
    const two = cols.length >= 2 ? cols.slice(0, 2).join(',') : null;
    const choices = [
      ['Boxplot', `boxplot(${one})`],
      ['Säulendiagramm (Werte zählen)', `balkendiagramm(${one})`],
      ...(two ? [['Säulendiagramm (Werte, Häufigkeiten)', `balkendiagramm(${two})`], ['Kreisdiagramm (Werte, Häufigkeiten)', `kreisdiagramm(${two})`], ['Streudiagramm (x, y)', `streudiagramm(${two})`], ['Residuen der linearen Regression', `residuenplot(${two},linear)`]] : [['Kreisdiagramm (Werte zählen)', `kreisdiagramm(${one})`]]),
      ['Histogramm (Klassenbreite 1)', `histogramm(${one},1)`],
    ];
    const chosen = await sheet((close) => [
      h('h2', {}, `Diagramm aus ${this.selectionText}`),
      h('p.hint', {}, two ? 'Erste markierte Spalte: x bzw. Werte, zweite: y bzw. Häufigkeiten.' : 'Markiere zwei Spalten für Streu- und Kreisdiagramme aus Wertepaaren.'),
      h('div.list', {}, ...choices.map(([label, text]) => h('button', { onclick: () => close(text) }, label))),
      h('div.actions', {}, h('button.pill', { onclick: () => close(null) }, 'Abbrechen')),
    ]);
    if (chosen) this.onChart(chosen);
  }

  async casSheet() {
    const cols = this.columns();
    const one = cols[0];
    const two = cols.length >= 2 ? cols.slice(0, 2).join(',') : null;
    const choices = [
      ['Als Liste L', `L=${one}`],
      ['Kennzahlen', `statistik(${one})`],
      ['Häufigkeitstabelle', `häufigkeitstabelle(${one})`],
      ...(two ? [['Regression: Modellvergleich', `regression(${two})`], ['Ausgleichsgerade', `regressionlinear(${two})`], ['Korrelation', `korrelation(${two})`]] : []),
      ...(cols.length >= 2 ? [['Als Matrix (Kreuztabelle)', `M=zellen(${this.selectionText.replace(':', ',')})`]] : []),
    ];
    const chosen = await sheet((close) => [
      h('h2', {}, `${this.selectionText} im CAS`),
      h('p.hint', {}, 'Im CAS heißen Zellen einfach A1, B2 …; zellen(A1, A10) ist ein Bereich als Liste.'),
      h('div.list', {}, ...choices.map(([label, text]) => h('button', { onclick: () => close(text) }, label, h('span', {}, text)))),
      h('div.actions', {}, h('button.pill', { onclick: () => close(null) }, 'Abbrechen')),
    ]);
    if (chosen) this.onCas(chosen);
  }

  // Drawing the grid

  render() {
    const { rows: used, cols: usedCols } = this.sheet.size;
    const rows = Math.max(MIN_ROWS, used + 20, this.active[1] + 10);
    const cols = COLUMNS;
    const table = h('table.sheet-grid');
    const head = h('tr', {}, h('th.corner', {}, ''), ...Array.from({ length: cols }, (_, c) => h('th', { class: this.sheet.filters[c] ? 'filtered' : null, title: this.sheet.filters[c] ? 'Filter: ' + this.sheet.filters[c] : null }, colName(c) + (this.sheet.filters[c] ? ' ⏷' : ''))));
    table.append(h('thead', {}, head));
    const body = h('tbody');
    for (let r = 0; r < rows; r++) {
      if (!this.sheet.rowVisible(r)) continue;
      const tr = h('tr', {}, h('th', {}, String(r + 1)));
      for (let c = 0; c < cols; c++) {
        const v = this.sheet.display(refName(c, r));
        const td = h('td.cell', { 'data-c': String(c), 'data-r': String(r) }, v.display);
        if (v.kind === 'number' || (v.kind === 'value' && v.number !== undefined)) td.classList.add('num');
        if (v.kind === 'error') td.classList.add('error');
        if (v.formula) td.classList.add('formula');
        tr.append(td);
      }
      body.append(tr);
    }
    table.append(body);
    table.addEventListener('pointerdown', (e) => {
      const td = e.target.closest('td.cell');
      if (!td) return;
      const c = Number(td.dataset.c);
      const r = Number(td.dataset.r);
      const extend = e.shiftKey || this.rangeMode;
      this.select(c, r, extend);
      if (e.pointerType === 'mouse') {
        this.dragging = true;
        e.preventDefault();
        this.grid.focus();
      }
    });
    table.addEventListener('pointerover', (e) => {
      if (!this.dragging) return;
      const td = e.target.closest('td.cell');
      if (td) this.select(Number(td.dataset.c), Number(td.dataset.r), true);
    });
    table.addEventListener('dblclick', () => {
      this.editing = true;
      this.input.focus();
    });
    this.grid.replaceChildren(table);
    this.usedCols = usedCols;
    this.showActive();
  }

  /** After a recalculation: new values in place, without losing the scroll position */
  refresh() {
    const top = this.grid.scrollTop;
    const left = this.grid.scrollLeft;
    this.render();
    this.grid.scrollTop = top;
    this.grid.scrollLeft = left;
  }
}

export { parseRef };

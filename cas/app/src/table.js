// The spreadsheet: cells hold numbers, text or formulas (=A1*2, =SUMME(A1:A10), =ableiten(x^2)). Formulas are CAS
// terms, with German spreadsheet names (SUMME, MITTELWERT, WENN …) and ranges; references are relative (A1) or
// absolute ($A$1) for filling and copying. Every value also lives in Giac as a variable A1, B2 …, so CAS rows can
// use cells and zellen(A1, A10), and formulas can use what the CAS defined.

export const COLUMNS = 26;

const REF = /(^|[^A-Za-z0-9_$.])(\$?)([A-Za-z])(\$?)([1-9]\d{0,3})(?![A-Za-z0-9_(])/g;
const RANGE = /(^|[^A-Za-z0-9_$.])\$?([A-Za-z])\$?([1-9]\d{0,3}):\$?([A-Za-z])\$?([1-9]\d{0,3})(?![A-Za-z0-9_(])/g;

export const colName = (c) => String.fromCharCode(65 + c);
export const refName = (c, r) => colName(c) + (r + 1);

/** 'B3' → [1, 2] (column, row from 0), or null */
export function parseRef(text) {
  const m = /^\$?([A-Za-z])\$?([1-9]\d{0,3})$/.exec(String(text).trim());
  return m ? [m[1].toUpperCase().charCodeAt(0) - 65, Number(m[2]) - 1] : null;
}

/** Every cell of a rectangle, row by row */
export function cellsOf(c0, r0, c1, r1) {
  const out = [];
  for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) out.push([c, r]);
  return out;
}

/** German spreadsheet functions and what the CAS calls them */
export const FUNCTIONS = {
  SUMME: 'sum', PRODUKT: 'product', MITTELWERT: 'mittelwert', ANZAHL: 'anzahl', ANZAHL2: 'anzahl', MIN: 'minimum', MAX: 'maximum',
  MEDIAN: 'median', MODUS: 'modus', 'MODUS.EINF': 'modus', STABW: 'stichprobenstandardabweichung', 'STABW.S': 'stichprobenstandardabweichung',
  STABWN: 'standardabweichung', 'STABW.N': 'standardabweichung', VARIANZ: 'stichprobenvarianz', 'VAR.S': 'stichprobenvarianz',
  VARIANZEN: 'varianz', 'VAR.P': 'varianz', QUARTILE: 'quartile', KORREL: 'korrelation', KOVAR: 'kovarianz',
  WURZEL: 'sqrt', ABS: 'abs', RUNDEN: 'round', GANZZAHL: 'floor', KÜRZEN: 'trunc', REST: 'irem', POTENZ: 'pow', EXP: 'exp',
  LN: 'ln', LOG10: 'log10', SIN: 'sin', COS: 'cos', TAN: 'tan', ARCSIN: 'asin', ARCCOS: 'acos', ARCTAN: 'atan', PI: 'pi',
  WENN: 'when', ZUFALLSZAHL: 'rand', ZUFALLSBEREICH: 'randint', FAKULTÄT: 'factorial', KOMBINATIONEN: 'comb', GGT: 'gcd', KGV: 'lcm',
  'BINOM.VERT': 'binomialpdf', 'NORM.VERT': 'normalcdf',
};

export class Sheet {
  constructor() {
    /** 'A1' → what was typed */
    this.cells = new Map();
    /** 'A1' → { kind: 'number' | 'text' | 'value' | 'error' | 'empty', exact, display, number } */
    this.values = new Map();
    /** column → condition text, e.g. '>5' */
    this.filters = {};
    this.widths = {};
    /** Giac variables the sheet made */
    this.assigned = new Set();
  }

  get(ref) {
    return this.cells.get(ref) || '';
  }

  set(ref, raw) {
    const text = String(raw ?? '');
    if (text.trim() === '') this.cells.delete(ref);
    else this.cells.set(ref, text);
  }

  serialize() {
    return { cells: Object.fromEntries(this.cells), filters: this.filters, widths: this.widths };
  }

  load(data) {
    this.cells = new Map(Object.entries((data && data.cells) || {}));
    this.filters = (data && data.filters) || {};
    this.widths = (data && data.widths) || {};
    this.values = new Map();
  }

  get hasFormulas() {
    for (const raw of this.cells.values()) if (raw.startsWith('=')) return true;
    return false;
  }

  get size() {
    let rows = 0;
    let cols = 0;
    for (const ref of this.cells.keys()) {
      const [c, r] = parseRef(ref);
      rows = Math.max(rows, r + 1);
      cols = Math.max(cols, c + 1);
    }
    return { rows, cols };
  }

  /** The cells a formula reads, ranges spelled out */
  references(raw) {
    if (!String(raw).startsWith('=')) return [];
    const out = new Set();
    const body = String(raw).slice(1);
    body.replace(RANGE, (all, pre, c0, r0, c1, r1) => {
      for (const [c, r] of cellsOf(c0.toUpperCase().charCodeAt(0) - 65, Number(r0) - 1, c1.toUpperCase().charCodeAt(0) - 65, Number(r1) - 1)) out.add(refName(c, r));
      return all;
    });
    body.replace(RANGE, ' ').replace(REF, (all, pre, d1, c, d2, r) => {
      out.add(c.toUpperCase() + r);
      return all;
    });
    return [...out];
  }

  /**
   * Works every cell out, in the order of their references, and writes the values into Giac.
   * `cas` has raw(text); `toGiac(text)` turns CAS text (German commands) into Giac text.
   */
  recalc(cas, toGiac) {
    const values = new Map();
    const state = new Map();
    const order = [];
    const visit = (ref, stack) => {
      if (state.get(ref) === 'done') return;
      if (state.get(ref) === 'busy') {
        for (const r of stack.slice(stack.indexOf(ref))) values.set(r, { kind: 'error', display: '#ZIRKEL', error: 'Zirkelbezug: die Zelle hängt von sich selbst ab.' });
        return;
      }
      state.set(ref, 'busy');
      for (const dep of this.references(this.get(ref))) if (this.cells.has(dep)) visit(dep, [...stack, ref]);
      state.set(ref, 'done');
      order.push(ref);
    };
    for (const ref of this.cells.keys()) visit(ref, []);
    for (const ref of order) {
      if (values.has(ref)) continue;
      values.set(ref, this.evaluate(ref, values, cas, toGiac));
    }
    this.values = values;
    // The values as Giac variables; cells emptied since are forgotten.
    const now = new Set();
    for (const [ref, v] of values) {
      if (v.exact === undefined) continue;
      const answer = cas.raw(`${ref}:=(${v.exact})`);
      if (!answer.error) now.add(ref);
    }
    for (const ref of this.assigned) if (!now.has(ref)) cas.raw(`purge(${ref})`);
    this.assigned = now;
  }

  evaluate(ref, values, cas, toGiac) {
    const raw = this.get(ref).trim();
    if (!raw.startsWith('=')) {
      const number = parseNumber(raw);
      if (number !== null) return { kind: 'number', exact: number.exact, number: number.value, display: formatNumber(number.value) };
      return { kind: 'text', display: raw.replace(/^'/, '') };
    }
    let giac;
    try {
      const body = this.substitute(raw.slice(1), values);
      giac = toGiac(body);
    } catch (e) {
      return { kind: 'error', display: '#FEHLER', error: e.message || 'Die Formel ist nicht lesbar.' };
    }
    const answer = cas.raw(giac);
    if (answer.error) return { kind: 'error', display: '#FEHLER', error: answer.error };
    const exact = String(answer.value);
    if (/^"/.test(exact)) return { kind: 'text', display: exact.replace(/^"|"$/g, '') };
    if (exact === 'true' || exact === 'false') return { kind: 'value', exact: exact === 'true' ? '1' : '0', number: exact === 'true' ? 1 : 0, display: exact === 'true' ? 'WAHR' : 'FALSCH', formula: true };
    const approx = cas.raw(`evalf(${exact})`);
    const number = approx.error ? NaN : Number(approx.value);
    if (Number.isFinite(number)) return { kind: 'value', exact, number, display: formatNumber(number), formula: true };
    return { kind: 'value', exact, display: exact.replace(/\blist\[/g, '[').replace(/\*/g, '·'), formula: true };
  }

  /** The formula with every reference replaced by its value; ranges become lists */
  substitute(body, values) {
    // Semicolons separate arguments as in German spreadsheets; then a comma between digits is a decimal comma.
    let text = body;
    if (text.includes(';')) text = text.replace(/(\d),(\d)/g, '$1.$2').replace(/;/g, ',');
    const valueOf = (ref, inRange) => {
      const v = values.get(ref);
      if (!v || v.kind === 'empty') return inRange ? null : '0';
      if (v.kind === 'error') throw new Error(`${ref} enthält einen Fehler.`);
      if (v.kind === 'text') {
        if (inRange) return null;
        throw new Error(`${ref} enthält Text, keine Zahl.`);
      }
      return '(' + v.exact + ')';
    };
    text = text.replace(RANGE, (all, pre, c0, r0, c1, r1) => {
      const cells = cellsOf(c0.toUpperCase().charCodeAt(0) - 65, Number(r0) - 1, c1.toUpperCase().charCodeAt(0) - 65, Number(r1) - 1);
      const items = cells.map(([c, r]) => valueOf(refName(c, r), true)).filter((v) => v !== null);
      return pre + '[' + items.join(',') + ']';
    });
    text = text.replace(REF, (all, pre, d1, c, d2, r) => pre + valueOf(c.toUpperCase() + r, false));
    // SUMME(…) → sum(…); ZUFALLSZAHL() → rand(0,1)
    text = text.replace(/([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9.]*)\s*\(/g, (all, name) => {
      const mapped = FUNCTIONS[name.toUpperCase()];
      if (!mapped || (name !== name.toUpperCase() && !['Summe', 'Mittelwert', 'Wenn', 'Anzahl'].includes(name))) return all;
      return mapped + '(';
    });
    text = text.replace(/\brand\(\s*\)/g, 'rand(0,1)').replace(/\bpi\(\s*\)/g, 'pi');
    // WENN(A1>3; …): one equals sign compares, as in spreadsheets; <> is "not equal"
    text = text.replace(/<>/g, '!=').replace(/([^<>=!:])=([^=])/g, '$1==$2');
    // =A1>3 on its own answers WAHR or FALSCH
    let depth = 0;
    let comparison = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (depth === 0 && /[<>]|==|!=/.test(text.slice(i, i + 2))) comparison = true;
    }
    if (comparison) text = `when(${text},wahr,falsch)`;
    return text;
  }

  /** What a cell shows, and whether it is hidden by a filter */
  display(ref) {
    const v = this.values.get(ref);
    return v ? v : { kind: 'empty', display: '' };
  }

  rowVisible(r) {
    for (const [col, condition] of Object.entries(this.filters)) {
      if (!condition) continue;
      const v = this.display(colName(Number(col)) + (r + 1));
      if (!matches(v, condition)) return false;
    }
    return true;
  }

  // Editing whole ranges

  /** Copies a cell's content to another place; relative references move along, $-references stay. */
  static shift(raw, dc, dr) {
    if (!String(raw).startsWith('=')) return raw;
    return String(raw).replace(REF, (all, pre, d1, c, d2, r) => {
      const col = d1 ? c.toUpperCase().charCodeAt(0) - 65 : c.toUpperCase().charCodeAt(0) - 65 + dc;
      const row = d2 ? Number(r) : Number(r) + dr;
      if (col < 0 || col >= COLUMNS || row < 1) return pre + '#BEZUG';
      return pre + d1 + colName(col) + d2 + row;
    });
  }

  /**
   * Fills a range from its first row (down) or first column (right). Two or more numbers at the start continue as a
   * series; formulas are copied with their references moving; anything else is copied.
   */
  fill([c0, r0, c1, r1], direction) {
    const [cl, cr] = [Math.min(c0, c1), Math.max(c0, c1)];
    const [rt, rb] = [Math.min(r0, r1), Math.max(r0, r1)];
    const lines = direction === 'down' ? range(cl, cr) : range(rt, rb);
    for (const line of lines) {
      const at = (k) => (direction === 'down' ? refName(line, k) : refName(k, line));
      const [start, end] = direction === 'down' ? [rt, rb] : [cl, cr];
      // The pattern: the filled cells at the start
      const pattern = [];
      for (let k = start; k <= end && this.cells.has(at(k)); k++) pattern.push(k);
      if (!pattern.length) continue;
      const numbers = pattern.map((k) => parseNumber(this.get(at(k))));
      const series = pattern.length >= 2 && numbers.every((n) => n !== null);
      const step = series ? numbers[1].value - numbers[0].value : 0;
      for (let k = start + pattern.length; k <= end; k++) {
        if (series) {
          this.set(at(k), formatPlain(numbers[0].value + step * (k - start)));
        } else {
          const from = pattern[(k - start) % pattern.length];
          const d = k - from;
          this.set(at(k), Sheet.shift(this.get(at(from)), direction === 'down' ? 0 : d, direction === 'down' ? d : 0));
        }
      }
    }
  }

  /** start, start + step, … downwards from a cell, `count` values */
  series(ref, start, step, count, direction = 'down') {
    const [c, r] = parseRef(ref);
    for (let k = 0; k < count; k++) this.set(direction === 'down' ? refName(c, r + k) : refName(c + k, r), formatPlain(start + step * k));
  }

  /** Sorts the rows of a range by one of its columns; numbers first, then text */
  sort([c0, r0, c1, r1], keyCol, descending) {
    const [cl, cr] = [Math.min(c0, c1), Math.max(c0, c1)];
    const [rt, rb] = [Math.min(r0, r1), Math.max(r0, r1)];
    const rows = range(rt, rb).map((r) => ({ r, raws: range(cl, cr).map((c) => this.get(refName(c, r))), key: this.display(refName(keyCol, r)) }));
    const rank = (v) => (v.number !== undefined && Number.isFinite(v.number) ? 0 : v.kind === 'empty' ? 2 : 1);
    rows.sort((a, b) => {
      const ra = rank(a.key);
      const rb2 = rank(b.key);
      if (ra !== rb2) return ra - rb2;
      if (ra === 2) return 0;
      const d = ra === 0 ? a.key.number - b.key.number : String(a.key.display).localeCompare(String(b.key.display), 'de');
      return descending ? -d : d;
    });
    rows.forEach((row, i) => {
      const target = rt + i;
      range(cl, cr).forEach((c, j) => this.set(refName(c, target), Sheet.shift(row.raws[j], 0, target - row.r)));
    });
  }

  clear([c0, r0, c1, r1]) {
    for (const [c, r] of cellsOf(c0, r0, c1, r1)) this.cells.delete(refName(c, r));
  }

  /** Tab- or semicolon-separated text (from a spreadsheet or a CSV file) into the cells from `ref` on */
  paste(ref, text) {
    const [c, r] = parseRef(ref);
    const lines = String(text).replace(/\r/g, '').split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    const separator = lines.some((l) => l.includes('\t')) ? '\t' : lines.some((l) => l.includes(';')) ? ';' : ',';
    lines.forEach((line, i) => line.split(separator).forEach((cell, j) => {
      if (c + j < COLUMNS) this.set(refName(c + j, r + i), cell.trim());
    }));
    return { rows: lines.length, cols: Math.max(0, ...lines.map((l) => l.split(separator).length)) };
  }

  /** The values of a range as tab-separated text */
  copyText([c0, r0, c1, r1]) {
    const lines = [];
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) {
      const cells = [];
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) cells.push(this.display(refName(c, r)).display);
      lines.push(cells.join('\t'));
    }
    return lines.join('\n');
  }
}

function range(a, b) {
  const out = [];
  for (let k = a; k <= b; k++) out.push(k);
  return out;
}

/** 3, -1.5, 1,5 (German), 2/3, 1e5 → { value, exact } or null */
export function parseNumber(text) {
  const t = String(text).trim().replace(/\s/g, '');
  if (/^-?\d+([.,]\d+)?([eE][-+]?\d+)?$/.test(t)) {
    const value = Number(t.replace(',', '.'));
    return { value, exact: t.replace(',', '.') };
  }
  const fraction = /^(-?\d+)\/(\d+)$/.exec(t);
  if (fraction && Number(fraction[2]) !== 0) return { value: Number(fraction[1]) / Number(fraction[2]), exact: t };
  return null;
}

export function formatNumber(v) {
  if (!Number.isFinite(v)) return String(v);
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
  const text = Math.abs(v) >= 1e12 || (v !== 0 && Math.abs(v) < 1e-6) ? v.toExponential(6) : String(Number(v.toPrecision(10)));
  return text.replace('.', ',');
}

function formatPlain(v) {
  return String(Number(v.toPrecision(12)));
}

/** A filter condition such as >5, <=2, <>0, =rot or a word the text contains */
export function matches(value, condition) {
  const m = /^\s*(<=|>=|<>|!=|<|>|=)?\s*(.*?)\s*$/.exec(condition);
  const op = m[1] || '';
  const target = m[2];
  const number = parseNumber(target);
  const v = value.number;
  if (number !== null && Number.isFinite(v) && op) {
    const t = number.value;
    return { '<': v < t, '>': v > t, '<=': v <= t, '>=': v >= t, '=': Math.abs(v - t) < 1e-12, '<>': Math.abs(v - t) >= 1e-12, '!=': Math.abs(v - t) >= 1e-12 }[op];
  }
  const shown = String(value.display || '').toLowerCase();
  const want = target.toLowerCase();
  if (op === '=') return shown === want;
  if (op === '<>' || op === '!=') return shown !== want;
  if (op) return false;
  return shown.includes(want);
}

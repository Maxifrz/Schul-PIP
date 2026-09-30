// The chemical formula parser. "Al2(SO4)3", "CuSO4·5H2O", "SO4^2-", "Fe3+", "13C", "[Fe(CN)6]3-", "H₂SO₄", "NaCl(aq)":
// brackets (nested), indices, charges, hydrates, isotopes and phase tags. The result is
//   { atoms: { Al: 2, S: 3, O: 12 }, charge: 0, isotopes: { '13C': 1 }, hydrate: [{ n: 5, atoms: … }], phase, ast, … }
// and can be written again as plain text, Unicode or LaTeX.

import { isElementSymbol, findElement } from './elements.js';
import isotopeData from './data/isotopes.json' with { type: 'json' };
import { fail } from './errors.js';

export const ISOTOPE_MASSES = isotopeData.masses;
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-' };
const PHASES = { s: 'fest', l: 'flüssig', g: 'gasförmig', aq: 'gelöst' };

/** Unicode indices, superscripts, dashes and dots to plain ASCII conventions */
export function normalize(text) {
  let s = String(text).normalize('NFC');
  s = s.replace(/[₀-₉]/g, (c) => String(SUB.indexOf(c)));
  // A run of superscripts becomes ^…
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, (run) => '^' + [...run].map((c) => SUP[c]).join(''));
  s = s.replace(/[−–—‒]/g, '-').replace(/[⁄]/g, '/');
  s = s.replace(/[•∙⋅·]/g, '·');
  return s.trim();
}

function isotopeOk(symbol, mass) {
  const z = findElement(symbol).atomicNumber;
  if (z === 1) return mass >= 1 && mass <= 3;
  return mass >= z && mass <= Math.round(2.6 * z) + 3;
}

/** Splits off a trailing phase tag: "NaCl(aq)" → ["NaCl", "aq"] */
function splitPhase(s) {
  const m = /^(.*?)\s*\((s|l|g|aq)\)$/.exec(s);
  return m && m[1] ? [m[1], m[2]] : [s, null];
}

/** Splits off the charge and says what is left. See the README for the rules that decide "Fe3+" versus "NH4+". */
export function splitCharge(input) {
  const s = input.replace(/\s+/g, ' ').trim();
  const invalid = (why) => fail('CHEM_INVALID_CHARGE', `Ungültige Ladung in „${input}“: ${why}`);
  // Explicit: ^2-, ^-, ^{2-}, ^{-2}, ^+
  let m = /^(.*?)\s*\^\s*\{?\s*(\d*)\s*([+-])\s*\}?$/.exec(s) || null;
  if (m) return { body: m[1].trim(), charge: (m[3] === '+' ? 1 : -1) * (m[2] === '' ? 1 : Number(m[2])) };
  m = /^(.*?)\s*\^\s*\{?\s*([+-])\s*(\d+)\s*\}?$/.exec(s);
  if (m) return { body: m[1].trim(), charge: (m[2] === '+' ? 1 : -1) * Number(m[3]) };
  if (/\^/.test(s)) {
    if (/\^\s*\{?\s*[+-]?\d*[+-]{2,}/.test(s)) invalid('mehr als ein Vorzeichen');
    fail('CHEM_INVALID_CHARGE', `Ungültige Ladung in „${input}“.`);
  }
  // A space before the charge: "SO4 2-"
  m = /^(.*\S)\s+(\d*)([+-])$/.exec(s);
  if (m) return { body: m[1].trim(), charge: (m[3] === '+' ? 1 : -1) * (m[2] === '' ? 1 : Number(m[2])) };
  // Plain: Na+, Cl-, O--, Fe3+, NH4+, SO42-
  m = /^(.*?)(\d*)([+-]+)$/.exec(s);
  if (!m) return { body: s, charge: 0 };
  const [, base, digits, signs] = m;
  const sign = signs[0] === '+' ? 1 : -1;
  if (signs.length > 1) {
    if (!signs.split('').every((c) => c === signs[0])) invalid('gemischte Vorzeichen');
    if (digits) invalid('eine Zahl und mehrere Vorzeichen');
    return { body: base, charge: sign * signs.length };
  }
  if (!base) invalid('nur ein Vorzeichen');
  if (!digits) return { body: base, charge: sign };
  if (/^[A-Z][a-z]?$/.test(base) && digits.length === 1) return { body: base, charge: sign * Number(digits) }; // Fe3+
  if (base.endsWith(']')) return { body: base, charge: sign * Number(digits) }; // [Fe(CN)6]3-
  if (digits.length >= 2) return { body: base + digits.slice(0, -1), charge: sign * Number(digits.slice(-1)) }; // SO42-
  return { body: base + digits, charge: sign }; // NH4+, H3O+
}

class Scanner {
  constructor(text, source) {
    this.s = text;
    this.i = 0;
    this.source = source;
  }

  get done() {
    return this.i >= this.s.length;
  }

  peek() {
    return this.s[this.i];
  }

  number() {
    const m = /^\d+/.exec(this.s.slice(this.i));
    if (!m) return null;
    this.i += m[0].length;
    return Number(m[0]);
  }

  error(message) {
    fail('CHEM_FORMULA_INVALID', `„${this.source}“: ${message}`, { position: this.i });
  }
}

/** A sequence of groups up to `close` (or the end). Returns AST items. */
function parseSequence(sc, close) {
  const items = [];
  while (!sc.done && sc.peek() !== close) {
    const c = sc.peek();
    if (c === '(' || c === '[') {
      const closing = c === '(' ? ')' : ']';
      sc.i++;
      const inner = parseSequence(sc, closing);
      if (sc.peek() !== closing) sc.error(`die Klammer „${c}“ wird nicht geschlossen.`);
      sc.i++;
      if (!inner.length) sc.error('leere Klammer.');
      const n = sc.number();
      if (n === 0) sc.error('ein Index darf nicht 0 sein.');
      items.push({ type: 'group', bracket: c, items: inner, n: n === null ? 1 : n });
    } else if (c === ')' || c === ']') {
      sc.error(`die Klammer „${c}“ wurde nie geöffnet.`);
    } else if (/[0-9]/.test(c) || /[A-Z]/.test(c)) {
      // An isotope's mass number: digits directly before an element symbol at the start of a group
      let mass = null;
      if (/[0-9]/.test(c)) {
        const start = sc.i;
        const value = sc.number();
        if (sc.done || !/[A-Z]/.test(sc.peek())) {
          sc.i = start;
          sc.error(items.length ? `eine Zahl steht an der falschen Stelle („${value}“).` : `die Zahl „${value}“ steht vor keinem Element. Koeffizienten gehören in eine Reaktionsgleichung, nicht in eine Formel.`);
        }
        mass = value;
        if (items.length) {
          sc.i = start;
          sc.error(`eine Zahl steht an der falschen Stelle („${value}“).`);
        }
      }
      const rest = sc.s.slice(sc.i);
      const two = /^[A-Z][a-z]/.exec(rest);
      let symbol = null;
      if (two && isElementSymbol(two[0])) symbol = two[0];
      else if (isElementSymbol(rest[0])) symbol = rest[0];
      if (!symbol) {
        const shown = two ? two[0] : rest[0];
        fail('CHEM_UNKNOWN_ELEMENT', `„${shown}“ in „${sc.source}“ ist kein Element.`, { symbol: shown });
      }
      sc.i += symbol.length;
      if (mass !== null && !isotopeOk(symbol, mass)) sc.error(`${mass}${symbol} ist keine sinnvolle Massenzahl. Koeffizienten gehören in eine Reaktionsgleichung.`);
      const n = sc.number();
      if (n === 0) sc.error('ein Index darf nicht 0 sein.');
      items.push({ type: 'el', symbol, mass, n: n === null ? 1 : n });
    } else if (c === '_' || c === '{' || c === '}') {
      sc.i++; // LaTeX leftovers: H_2 → H2
    } else {
      sc.error(`unerwartetes Zeichen „${c}“.`);
    }
  }
  return items;
}

function count(items, factor, atoms, isotopes) {
  for (const item of items) {
    if (item.type === 'el') {
      atoms[item.symbol] = (atoms[item.symbol] || 0) + item.n * factor;
      if (item.mass !== null) {
        const key = `${item.mass}${item.symbol}`;
        isotopes[key] = (isotopes[key] || 0) + item.n * factor;
      }
    } else count(item.items, factor * item.n, atoms, isotopes);
  }
}

/** Parses one formula. Throws ChemError (CHEM_FORMULA_INVALID, CHEM_UNKNOWN_ELEMENT, CHEM_INVALID_CHARGE). */
export function parseFormula(input) {
  const original = String(input);
  let text = normalize(original);
  if (!text) fail('CHEM_FORMULA_INVALID', 'Die Formel ist leer.');
  const [withoutPhase, phase] = splitPhase(text);
  text = withoutPhase;
  // The electron
  if (/^e(\^?-|⁻)?$/.test(text) && /^e/.test(text) && (text === 'e-' || text === 'e^-' || text === 'e')) {
    return Object.freeze({ input: original, atoms: {}, isotopes: {}, charge: -1, hydrate: [], phase, ast: [], electron: true, hydrateParts: [] });
  }
  const { body, charge } = splitCharge(text);
  if (!body) fail('CHEM_FORMULA_INVALID', `„${original}“ enthält kein Element.`);
  // Hydrates: CuSO4·5H2O (also with a dot or a star); split outside brackets only
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if ((c === '·' || c === '*' || (c === '.' && /[0-9A-Z(\[]/.test(body[i + 1] || ''))) && depth === 0) {
      parts.push(body.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(body.slice(start));
  const atoms = {};
  const isotopes = {};
  const hydrate = [];
  let ast = [];
  parts.forEach((partText, index) => {
    let part = partText.replace(/\s+/g, '');
    let factor = 1;
    if (index > 0) {
      const m = /^(\d+(?:[.,]\d+)?)/.exec(part);
      if (m) {
        factor = Number(m[1].replace(',', '.'));
        part = part.slice(m[1].length);
      }
    }
    if (!part) fail('CHEM_FORMULA_INVALID', `„${original}“: nach dem Punkt fehlt ein Stoff.`);
    const sc = new Scanner(part, original);
    const items = parseSequence(sc, null);
    if (!sc.done) sc.error('der Rest der Formel ist nicht lesbar.');
    if (!items.length) sc.error('kein Element gefunden.');
    if (index === 0) {
      ast = items;
      count(items, 1, atoms, isotopes);
    } else {
      const sub = {};
      count(items, 1, sub, {});
      count(items, factor, atoms, isotopes);
      hydrate.push({ n: factor, ast: items, atoms: sub });
    }
  });
  return Object.freeze({ input: original, atoms, isotopes, charge, hydrate, phase, ast, electron: false });
}

/** Whether the text is a formula at all (no throwing) */
export function isFormula(text) {
  try {
    parseFormula(text);
    return true;
  } catch (e) {
    return false;
  }
}

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const SUPERSCRIPTS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const sub = (n) => String(n).split('').map((d) => SUBSCRIPTS[Number(d)]).join('');
const sup = (t) => String(t).split('').map((c) => SUPERSCRIPTS[c] || c).join('');

function chargeText(charge) {
  if (!charge) return '';
  const size = Math.abs(charge);
  return (size === 1 ? '' : String(size)) + (charge > 0 ? '+' : '-');
}

const writeItems = (items, style) =>
  items
    .map((item) => {
      if (item.type === 'el') {
        const isotope = item.mass !== null ? (style === 'unicode' ? sup(item.mass) : style === 'latex' ? `^{${item.mass}}` : String(item.mass)) : '';
        const index = item.n === 1 ? '' : style === 'unicode' ? sub(item.n) : style === 'latex' ? `_{${item.n}}` : String(item.n);
        return isotope + item.symbol + index;
      }
      const close = item.bracket === '(' ? ')' : ']';
      const index = item.n === 1 ? '' : style === 'unicode' ? sub(item.n) : style === 'latex' ? `_{${item.n}}` : String(item.n);
      return item.bracket + writeItems(item.items, style) + close + index;
    })
    .join('');

/** A parsed formula as text: style 'text' (H2SO4, SO4^2-), 'unicode' (H₂SO₄, SO₄²⁻) or 'latex' (\mathrm{…}) */
export function formatFormula(f, style = 'text') {
  if (f.electron) return style === 'latex' ? '\\mathrm{e^{-}}' : style === 'unicode' ? 'e⁻' : 'e-';
  let body = writeItems(f.ast, style);
  for (const h of f.hydrate) {
    const n = Number.isInteger(h.n) ? String(h.n) : String(h.n).replace('.', ',');
    body += (style === 'latex' ? '\\cdot ' : '·') + (h.n === 1 ? '' : n) + writeItems(h.ast, style);
  }
  const c = chargeText(f.charge);
  if (style === 'unicode') body += c ? sup(c) : '';
  else if (style === 'latex') body += c ? `^{${c}}` : '';
  else body += c ? (Math.abs(f.charge) === 1 ? c : '^' + c) : '';
  const phase = f.phase ? (style === 'latex' ? `\\,\\mathrm{(${f.phase})}` : `(${f.phase})`) : '';
  return style === 'latex' ? `\\mathrm{${body}}${phase}` : body + phase;
}

/** A key that is the same for the same formula however it was typed (no phase, no spaces, ASCII) */
export function formulaKey(f) {
  return formatFormula({ ...f, phase: null }, 'text');
}

/** Atom counts in the Hill order (C, H, then alphabetical) as text */
export function hill(f) {
  const symbols = Object.keys(f.atoms);
  const rest = symbols.filter((x) => x !== 'C' && x !== 'H').sort();
  const order = f.atoms.C ? ['C', ...(f.atoms.H ? ['H'] : []), ...rest] : symbols.sort();
  return order.map((s) => s + (f.atoms[s] === 1 ? '' : f.atoms[s])).join('');
}

export const phaseName = (phase) => PHASES[phase] || null;

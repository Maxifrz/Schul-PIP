// The element database: all 118 elements from data/elements.json, looked up by symbol, name or atomic number. Nothing
// about elements is written anywhere else in the engine.

import data from './data/elements.json' with { type: 'json' };
import { fail } from './errors.js';

export const ELEMENT_DATA_VERSION = data.version;
export const ELEMENT_SOURCE = data.source;

const bySymbol = new Map();
const byName = new Map();
const byNumber = new Map();

// Ground-state configurations follow the Madelung order; these elements deviate from it.
const EXCEPTIONS = {
  24: '[Ar] 3d5 4s1', 29: '[Ar] 3d10 4s1', 41: '[Kr] 4d4 5s1', 42: '[Kr] 4d5 5s1', 44: '[Kr] 4d7 5s1', 45: '[Kr] 4d8 5s1',
  46: '[Kr] 4d10', 47: '[Kr] 4d10 5s1', 57: '[Xe] 5d1 6s2', 58: '[Xe] 4f1 5d1 6s2', 64: '[Xe] 4f7 5d1 6s2', 78: '[Xe] 4f14 5d9 6s1',
  79: '[Xe] 4f14 5d10 6s1', 89: '[Rn] 6d1 7s2', 90: '[Rn] 6d2 7s2', 91: '[Rn] 5f2 6d1 7s2', 92: '[Rn] 5f3 6d1 7s2',
  93: '[Rn] 5f4 6d1 7s2', 96: '[Rn] 5f7 6d1 7s2', 103: '[Rn] 5f14 7s2 7p1',
};
const NOBLE = [[2, 'He'], [10, 'Ne'], [18, 'Ar'], [36, 'Kr'], [54, 'Xe'], [86, 'Rn']];
const SUBSHELLS = [];
for (let n = 1; n <= 8; n++) for (let l = 0; l < Math.min(n, 4); l++) SUBSHELLS.push({ n, l });
SUBSHELLS.sort((a, b) => a.n + a.l - (b.n + b.l) || a.n - b.n);
const L = 'spdf';

/** The configuration from the Madelung rule, as a list of [subshell, electrons] */
function madelung(z) {
  const out = [];
  let left = z;
  for (const { n, l } of SUBSHELLS) {
    if (left <= 0) break;
    const take = Math.min(left, 2 * (2 * l + 1));
    out.push([`${n}${L[l]}`, take]);
    left -= take;
  }
  return out;
}

function configuration(z) {
  if (EXCEPTIONS[z]) return EXCEPTIONS[z];
  const full = madelung(z);
  // Abbreviate with the largest noble gas core that fits.
  let core = null;
  for (const [count, symbol] of NOBLE) if (count < z) core = { count, symbol };
  const byShell = (a, b) => Number(a[0][0]) - Number(b[0][0]) || L.indexOf(a[0][1]) - L.indexOf(b[0][1]);
  if (!core) return [...full].sort(byShell).map(([s, e]) => s + e).join(' ');
  const coreShells = madelung(core.count);
  const rest = full.slice(coreShells.length).sort(byShell);
  return `[${core.symbol}] ` + rest.map(([s, e]) => s + e).join(' ');
}

for (const raw of data.elements) {
  const element = Object.freeze({ ...raw, oxidationStates: Object.freeze([...raw.oxidationStates]), configuration: configuration(raw.atomicNumber) });
  bySymbol.set(element.symbol, element);
  byName.set(element.name.toLowerCase(), element);
  byName.set(element.nameDe.toLowerCase(), element);
  byNumber.set(element.atomicNumber, element);
}

export const ELEMENTS = Object.freeze([...byNumber.values()]);
export const isElementSymbol = (symbol) => bySymbol.has(symbol);

/** An element by symbol ("Fe"), name ("Eisen", "iron") or atomic number; undefined when there is none */
export function findElement(key) {
  if (typeof key === 'number') return byNumber.get(key);
  const text = String(key).trim();
  return bySymbol.get(text) || byName.get(text.toLowerCase());
}

export function element(key) {
  const found = findElement(key);
  if (!found) fail('CHEM_UNKNOWN_ELEMENT', `„${key}“ ist kein bekanntes Element.`, { symbol: String(key) });
  return found;
}

/** The mass in g/mol of an element; a given mass number (isotope) gives that isotope's mass number as an approximation */
export function atomicMass(symbol) {
  return element(symbol).atomicMass;
}

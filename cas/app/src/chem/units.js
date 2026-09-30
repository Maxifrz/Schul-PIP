// Units and dimensions. A unit is a factor to the SI unit and a vector of exponents of kg, m, s, mol, K and A; so
// "mol/L", "mol·L^-1", "J/(mol·K)" and "kJ/mol" all work, and mixing dimensions is an error instead of a wrong number.

import { fail } from './errors.js';

/** Exponents of kg, m, s, mol, K, A */
const dim = (kg = 0, m = 0, s = 0, mol = 0, K = 0, A = 0) => [kg, m, s, mol, K, A];
export const DIM = {
  none: dim(), mass: dim(1), length: dim(0, 1), time: dim(0, 0, 1), amount: dim(0, 0, 0, 1), temperature: dim(0, 0, 0, 0, 1), current: dim(0, 0, 0, 0, 0, 1),
  volume: dim(0, 3), area: dim(0, 2), concentration: dim(0, -3, 0, 1), massConcentration: dim(1, -3), molarMass: dim(1, 0, 0, -1),
  pressure: dim(1, -1, -2), energy: dim(1, 2, -2), power: dim(1, 2, -3), force: dim(1, 1, -2), charge: dim(0, 0, 1, 0, 0, 1),
  voltage: dim(1, 2, -3, 0, 0, -1), molarEnergy: dim(1, 2, -2, -1), molarEntropy: dim(1, 2, -2, -1, -1), heatCapacity: dim(1, 2, -2, 0, -1),
  frequency: dim(0, 0, -1), molarVolume: dim(0, 3, 0, -1), density: dim(1, -3), rateConstant1: dim(0, 0, -1),
};

const NAMES = Object.entries(DIM).map(([name, d]) => [name, d.join(',')]);
/** The name of a dimension vector ("amount", "concentration", …) or a description of it */
export function dimensionName(d) {
  const key = d.join(',');
  const found = NAMES.find(([, k]) => k === key);
  if (found) return found[0];
  const parts = ['kg', 'm', 's', 'mol', 'K', 'A'].map((u, i) => (d[i] ? `${u}${d[i] === 1 ? '' : '^' + d[i]}` : '')).filter(Boolean);
  return parts.join('·') || 'none';
}

const eq = (a, b) => a.every((x, i) => x === b[i]);
const add = (a, b) => a.map((x, i) => x + b[i]);
const scale = (a, n) => a.map((x) => x * n);

// name → [factor to SI, dimension, offset (K) or undefined, prefixes allowed]
const P = { p: 1e-12, n: 1e-9, µ: 1e-6, u: 1e-6, m: 1e-3, c: 1e-2, d: 1e-1, h: 1e2, k: 1e3, M: 1e6, G: 1e9 };
const BASE = {
  g: [1e-3, DIM.mass, 'pnµumk'], t: [1e3, DIM.mass, ''], kg: [1, DIM.mass, ''],
  mol: [1, DIM.amount, 'nµumk'],
  L: [1e-3, DIM.volume, 'nµumcd'], l: [1e-3, DIM.volume, 'nµumcd'],
  m: [1, DIM.length, 'pnµumcdk'],
  s: [1, DIM.time, 'nµum'], min: [60, DIM.time, ''], h: [3600, DIM.time, ''], d: [86400, DIM.time, ''],
  K: [1, DIM.temperature, ''],
  Pa: [1, DIM.pressure, 'hkMG'], bar: [1e5, DIM.pressure, 'm'], atm: [101325, DIM.pressure, ''], Torr: [101325 / 760, DIM.pressure, ''], mmHg: [133.322387415, DIM.pressure, ''],
  J: [1, DIM.energy, 'mkMG'], cal: [4.184, DIM.energy, 'k'], eV: [1.602176634e-19, DIM.energy, 'kM'], Wh: [3600, DIM.energy, 'k'],
  W: [1, DIM.power, 'mkMG'], N: [1, DIM.force, 'mk'], C: [1, DIM.charge, 'mk'], V: [1, DIM.voltage, 'mk'], A: [1, DIM.current, 'mµun'], Hz: [1, DIM.frequency, 'kM'],
  M: [1000, DIM.concentration, 'mµun'], // molar: mol/L
  '%': [0.01, DIM.none, ''], ppm: [1e-6, DIM.none, ''], u_: [1.66053906660e-27, DIM.mass, ''],
};
const KCAL_ALIAS = { kcal: 'cal' };
const OFFSET = { '°C': 273.15, degC: 273.15, '℃': 273.15 };

/** One unit name like "mL", "kJ", "°C", "mol" → { factor, dim, offset } or null */
function unitAtom(name) {
  if (OFFSET[name] !== undefined) return { factor: 1, dim: DIM.temperature, offset: OFFSET[name] };
  const direct = BASE[name];
  if (direct) return { factor: direct[0], dim: direct[1] };
  // a unit with an SI prefix
  for (const [prefix, size] of Object.entries(P)) {
    if (!name.startsWith(prefix) || name.length === prefix.length) continue;
    const base = BASE[name.slice(prefix.length)];
    if (!base || !base[2].includes(prefix)) continue;
    return { factor: size * base[0], dim: base[1] };
  }
  if (KCAL_ALIAS[name]) return unitAtom(KCAL_ALIAS[name]);
  return null;
}

const cache = new Map();

function tokenize(text) {
  return text.match(/\^\s*-?\d+|[·*/()]|[-−]?\d+|[A-Za-zµ°%℃Ω_]+|\s+/g) || [];
}

/**
 * Reads a unit expression: "mol/L", "mol·L^-1", "g/mol", "J/(mol·K)", "cm3", "m^3", "L·atm", "°C", "kJ·mol^-1".
 * Returns { factor, dim, offset?, text }. Throws CHEM_UNIT_MISMATCH for an unknown unit.
 */
export function parseUnit(text) {
  const raw = String(text).trim();
  if (cache.has(raw)) return cache.get(raw);
  const source = raw.normalize('NFC').replace(/[−–]/g, '-').replace(/[²³]/g, (c) => '^' + (c === '²' ? 2 : 3)).replace(/[⁻¹]/g, (c) => (c === '⁻' ? '^-' : '1')).replace(/\s*\/\s*/g, '/').replace(/\s*[·*]\s*/g, '·');
  const tokens = tokenize(source);
  let i = 0;
  const unknown = (name) => fail('CHEM_UNIT_MISMATCH', `Unbekannte Einheit „${name}“ in „${raw}“.`, { unit: name });
  const skip = () => {
    while (tokens[i] !== undefined && /^\s+$/.test(tokens[i])) i++;
  };
  function exponentOf() {
    const t = tokens[i];
    if (t === undefined) return 1;
    if (/^\^/.test(t)) {
      i++;
      return Number(t.replace(/[^\d-]/g, ''));
    }
    if (/^-?\d+$/.test(t)) {
      i++;
      return Number(t);
    }
    return 1;
  }
  function atom() {
    skip();
    const t = tokens[i];
    if (t === '(') {
      i++;
      const inner = expression();
      skip();
      if (tokens[i] !== ')') fail('CHEM_UNIT_MISMATCH', `Klammer in „${raw}“ nicht geschlossen.`);
      i++;
      const e = exponentOf();
      return { factor: inner.factor ** e, dim: scale(inner.dim, e) };
    }
    // "1/s": the number one stands for "no unit"
    if (t === '1') {
      i++;
      return { factor: 1, dim: DIM.none };
    }
    if (t === undefined || !/^[A-Za-zµ°%℃Ω_]/.test(t)) fail('CHEM_UNIT_MISMATCH', `Einheit „${raw}“ ist nicht lesbar.`);
    i++;
    const a = unitAtom(t);
    if (!a) unknown(t);
    const e = exponentOf();
    if (a.offset !== undefined && e !== 1) fail('CHEM_UNIT_MISMATCH', `„${t}“ lässt sich nicht potenzieren.`);
    return { factor: a.factor ** e, dim: scale(a.dim, e), offset: a.offset };
  }
  function expression() {
    let acc = atom();
    for (;;) {
      skip();
      const t = tokens[i];
      if (t === '·' || (t !== undefined && t !== ')' && t !== '/' && /^[A-Za-zµ°%℃Ω_(]/.test(t))) {
        if (t === '·') i++;
        const next = atom();
        acc = combine(acc, next, 1);
      } else if (t === '/') {
        i++;
        const next = atom();
        acc = combine(acc, next, -1);
      } else break;
    }
    return acc;
  }
  function combine(a, b, sign) {
    if (a.offset !== undefined || b.offset !== undefined) fail('CHEM_UNIT_MISMATCH', `„°C“ lässt sich nicht mit anderen Einheiten verbinden („${raw}“). Rechne in K.`);
    return { factor: sign > 0 ? a.factor * b.factor : a.factor / b.factor, dim: add(a.dim, scale(b.dim, sign)) };
  }
  if (!source) fail('CHEM_UNIT_MISMATCH', 'Die Einheit fehlt.');
  const result = expression();
  skip();
  if (i < tokens.length) fail('CHEM_UNIT_MISMATCH', `Einheit „${raw}“ ist nicht lesbar.`);
  const unit = Object.freeze({ ...result, text: raw });
  cache.set(raw, unit);
  return unit;
}

export function isUnit(text) {
  try {
    parseUnit(text);
    return true;
  } catch (e) {
    return false;
  }
}

/** The value in SI base units */
export function toSI(value, unit) {
  const u = typeof unit === 'string' ? parseUnit(unit) : unit;
  return (value + (u.offset !== undefined && u.offset !== 0 && u.factor === 1 ? u.offset : 0)) * u.factor;
}

export function fromSI(si, unit) {
  const u = typeof unit === 'string' ? parseUnit(unit) : unit;
  return si / u.factor - (u.offset !== undefined && u.factor === 1 ? u.offset : 0);
}

export const sameDimension = (a, b) => eq(a.dim, b.dim);

/** Converts a value between two units of the same dimension: convert(250, 'mL', 'L') → 0.25 */
export function convert(value, from, to) {
  const a = parseUnit(from);
  const b = parseUnit(to);
  if (!eq(a.dim, b.dim)) fail('CHEM_UNIT_MISMATCH', `„${from}“ (${dimensionName(a.dim)}) lässt sich nicht in „${to}“ (${dimensionName(b.dim)}) umrechnen.`, { from, to });
  return Number(fromSI(toSI(value, a), b).toPrecision(15));
}

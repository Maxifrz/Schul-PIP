// Reaction kinetics: integrated rate laws of orders 0 to 3, half-lives, the order from measured data (which
// linearisation is straight) and the Arrhenius equation. Rate constants are checked by dimension: the unit of k for order n
// is (mol/L)^(1−n)/s, so a k in the wrong unit is an error, not a wrong number.

import { ChemicalResult, L } from './result.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { CONSTANTS } from './constants.js';
import { DIM } from './units.js';
import { linearFit } from './numeric.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';

const R = CONSTANTS.R.value;
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

/** The unit of k for an order, as text and LaTeX */
export const kUnit = (n) => (n === 0 ? 'mol/(L·s)' : n === 1 ? '1/s' : n === 2 ? 'L/(mol·s)' : `L^${n - 1}/(mol^${n - 1}·s)`);

const ORDERS = [0, 1, 2, 3];

const number = (text, what) => {
  const v = Number(String(text).trim().replace(',', '.').replace(/[·×]\s*10\^?/, 'e'));
  if (!Number.isFinite(v)) fail('CHEM_SYNTAX', `${what}: „${text}“ ist keine Zahl.`);
  return v;
};

/** Expected dimension of k for order n: (mol/L)^(1−n)/s */
function kDimension(n) {
  const e = 1 - n;
  const conc = DIM.concentration;
  return conc.map((x, i) => x * e + (i === 2 ? -1 : 0));
}

/** k in (mol/L)^(1−n)/s from a quantity, checking the unit */
export function rateConstant(q, n) {
  const want = kDimension(n);
  if (!want.every((x, i) => x === q.dim[i])) fail('CHEM_UNIT_MISMATCH', `Die Geschwindigkeitskonstante einer Reaktion ${n}. Ordnung hat die Einheit ${kUnit(n)}, nicht „${q.unit || '(ohne Einheit)'}“.`, { expected: kUnit(n), got: q.unit });
  return q.si / 1000 ** (1 - n);
}

const concentration = (t, what) => Quantity.parse(t).need('concentration', what).in('mol/L');
const timeOf = (t, what) => Quantity.parse(t).need('time', what).in('s');

/** Integrated rate law: c(t) for order n (rate constant k in the standard unit) */
export function concentrationAt(n, k, c0, t) {
  if (n === 1) return c0 * Math.exp(-k * t);
  if (n === 0) return Math.max(0, c0 - k * t);
  const base = c0 ** (1 - n) + (n - 1) * k * t;
  return base ** (1 / (1 - n));
}

/** t for a target concentration */
export function timeFor(n, k, c0, c) {
  if (n === 1) return Math.log(c0 / c) / k;
  if (n === 0) return (c0 - c) / k;
  return (c ** (1 - n) - c0 ** (1 - n)) / ((n - 1) * k);
}

export function halfLife(n, k, c0) {
  if (n === 1) return Math.LN2 / k;
  if (n === 0) return c0 / (2 * k);
  return (2 ** (n - 1) - 1) / ((n - 1) * k * c0 ** (n - 1));
}

const lawLatex = (n) => ({
  0: 'c = c_0 - k\\,t',
  1: 'c = c_0\\,e^{-k\\,t}',
  2: '\\frac{1}{c} = \\frac{1}{c_0} + k\\,t',
  3: '\\frac{1}{c^2} = \\frac{1}{c_0^2} + 2\\,k\\,t',
}[n]);
const lawText = (n) => ({ 0: 'c = c0 − k·t', 1: 'c = c0·e^(−k·t)', 2: '1/c = 1/c0 + k·t', 3: '1/c² = 1/c0² + 2·k·t' }[n]);
const halfLatex = (n) => ({ 0: 't_{1/2} = \\frac{c_0}{2k}', 1: 't_{1/2} = \\frac{\\ln 2}{k}', 2: 't_{1/2} = \\frac{1}{k\\,c_0}', 3: 't_{1/2} = \\frac{3}{2\\,k\\,c_0^2}' }[n]);

/**
 * kinetik(Ordnung=1; k=0,05 1/s; c0=0,8 mol/L; t=20 s)  → c(t)
 * kinetik(Ordnung=2; k=…; c0=…; c=…)                     → t
 * kinetik(Ordnung=1; c0=…; c=…; t=…)                     → k
 * kinetik(Ordnung=1; k=…; halbwertszeit)                 → t½ (with c0 for orders ≠ 1)
 */
export function kineticsFromArgs(args) {
  const { options } = parseArgs(args);
  const nText = options.Ordnung ?? options.ordnung ?? options.n;
  if (nText === undefined) fail('CHEM_MISSING_CONSTANT', 'Die Reaktionsordnung fehlt: Ordnung=0, 1, 2 oder 3.');
  const n = number(nText, 'Ordnung');
  if (!ORDERS.includes(n)) fail('CHEM_OUTSIDE_MODEL', `Integrierte Geschwindigkeitsgesetze sind für die Ordnungen 0, 1, 2 und 3 eingebaut, nicht für ${nText}.`);
  const res = new ChemicalResult('kinetics', `Kinetik ${n}. Ordnung`);
  res.step('Geschwindigkeitsgesetz', L(`v = k\\,c^{${n}}\\quad\\Rightarrow\\quad ${lawLatex(n)}`, `v = k·c^${n}; ${lawText(n)}`));
  res.step('Einheit von k', L(`[k] = \\mathrm{${kUnit(n).replace(/·/g, '\\cdot ')}}`, `[k] = ${kUnit(n)}`));
  const k = options.k !== undefined ? rateConstant(Quantity.parse(options.k), n) : null;
  const c0 = options.c0 !== undefined ? concentration(options.c0, 'c0') : null;
  const c = options.c !== undefined ? concentration(options.c, 'c') : null;
  const t = options.t !== undefined ? timeOf(options.t, 't') : null;
  const wantHalf = options.halbwertszeit !== undefined || options.t12 !== undefined || options['t½'] !== undefined;
  const haveK = k !== null;
  if (wantHalf) {
    if (!haveK) fail('CHEM_MISSING_CONSTANT', 'Für die Halbwertszeit fehlt k.');
    if (n !== 1 && c0 === null) fail('CHEM_MISSING_CONSTANT', `Die Halbwertszeit einer Reaktion ${n}. Ordnung hängt von c0 ab; gib c0=… an.`);
    const th = halfLife(n, k, c0 ?? 1);
    res.step('Halbwertszeit', L(`${halfLatex(n)} = ${fmtL(th)}\\,\\mathrm{s}`, `t½ = ${fmt(th)} s`));
    res.answer(new Quantity(th, 's'), { name: 't½' });
    return res;
  }
  if (haveK && c0 !== null && t !== null && c === null) {
    const value = concentrationAt(n, k, c0, t);
    if (n === 0 && c0 - k * t < 0) res.warn('CHEM_OUTSIDE_MODEL', `Nach ${fmt(c0 / k)} s ist der Stoff bei einer Reaktion 0. Ordnung aufgebraucht; danach gilt das Gesetz nicht mehr.`);
    res.step('Einsetzen', L(`c(${fmtL(t)}\\,\\mathrm{s}) = ${fmtL(value)}\\,\\mathrm{mol/L}`, `c(${fmt(t)} s) = ${fmt(value)} mol/L`));
    res.answer(new Quantity(value, 'mol/L'), { name: 'c' });
    res.value('Umsatz', new Quantity((1 - value / c0) * 100, '%'));
    res.value('Halbwertszeit', new Quantity(halfLife(n, k, c0), 's'));
    res.plot = { kind: 'kinetics', n, k, c0, tEnd: Math.max(t * 1.2, 3 * halfLife(n, k, c0)) };
    return res;
  }
  if (haveK && c0 !== null && c !== null && t === null) {
    if (!(c > 0) || c > c0) fail('CHEM_NEGATIVE_CONCENTRATION', 'Die Endkonzentration muss zwischen 0 und c0 liegen.');
    const time = timeFor(n, k, c0, c);
    res.step('Umstellen nach t', L(`t = ${fmtL(time)}\\,\\mathrm{s}`, `t = ${fmt(time)} s`));
    res.answer(new Quantity(time, 's'), { name: 't' });
    res.plot = { kind: 'kinetics', n, k, c0, tEnd: time * 1.3 };
    return res;
  }
  if (!haveK && c0 !== null && c !== null && t !== null) {
    if (!(c > 0) || c > c0) fail('CHEM_NEGATIVE_CONCENTRATION', 'Die Endkonzentration muss zwischen 0 und c0 liegen.');
    const kk = n === 1 ? Math.log(c0 / c) / t : n === 0 ? (c0 - c) / t : (c ** (1 - n) - c0 ** (1 - n)) / ((n - 1) * t);
    res.step('Umstellen nach k', L(`k = ${fmtL(kk)}\\,\\mathrm{${kUnit(n).replace(/·/g, '\\cdot ')}}`, `k = ${fmt(kk)} ${kUnit(n)}`));
    res.answer(new Quantity(kk, kUnit(n)), { name: 'k' });
    res.value('Halbwertszeit', new Quantity(halfLife(n, kk, c0), 's'));
    res.plot = { kind: 'kinetics', n, k: kk, c0, tEnd: t * 1.3 };
    return res;
  }
  fail('CHEM_MISSING_CONSTANT', 'Gib genau drei der Größen k, c0, c, t an (oder k und halbwertszeit=…): die vierte wird berechnet.');
}

// -------------------------------------------------------------------------------------------- data

/** "[0, 10, 20]" · "[0; 10; 20] s" → { values, unit } */
export function parseList(text) {
  const m = /^\s*\[([^\]]*)\]\s*(.*)$/.exec(String(text));
  if (!m) fail('CHEM_SYNTAX', `„${text}“ ist keine Liste; erwartet: [1; 2; 3] mit Einheit.`);
  const parts = m[1].trim().split(/\s*;\s*|\s*,\s+|\s+/).filter(Boolean);
  return { values: parts.map((p) => number(p, 'Messwert')), unit: m[2].trim() };
}

/**
 * ordnung(t=[0; 10; 20; 30] s; c=[1,00; 0,67; 0,45; 0,30] mol/L): the order whose linearisation is straightest.
 */
export function orderFromData(args) {
  const { options } = parseArgs(args);
  if (options.t === undefined || options.c === undefined) fail('CHEM_MISSING_CONSTANT', 'Es fehlen Messreihen: ordnung(t=[…] s; c=[…] mol/L).');
  const T = parseList(options.t);
  const C = parseList(options.c);
  if (T.values.length !== C.values.length) fail('CHEM_SYNTAX', 'Zeiten und Konzentrationen müssen gleich viele Werte haben.');
  if (T.values.length < 3) fail('CHEM_NO_SOLUTION', 'Zur Bestimmung der Ordnung braucht man mindestens drei Messpunkte.');
  const tUnit = T.unit || 's';
  const cUnit = C.unit || 'mol/L';
  const ts = T.values.map((v) => new Quantity(v, tUnit).need('time', 'die Zeit').in('s'));
  const cs = C.values.map((v) => new Quantity(v, cUnit).need('concentration', 'die Konzentration').in('mol/L'));
  if (cs.some((v) => !(v > 0))) fail('CHEM_NEGATIVE_CONCENTRATION', 'Alle Konzentrationen müssen größer als 0 sein.');
  const res = new ChemicalResult('order', 'Reaktionsordnung aus Messwerten');
  if (!T.unit || !C.unit) res.assume(`Ohne Einheit gelten Zeiten in s und Konzentrationen in mol/L.`);
  const transforms = { 0: (c) => c, 1: (c) => Math.log(c), 2: (c) => 1 / c, 3: (c) => 1 / (c * c) };
  const labels = { 0: 'c gegen t', 1: 'ln c gegen t', 2: '1/c gegen t', 3: '1/c² gegen t' };
  const fits = ORDERS.map((n) => ({ n, fit: linearFit(ts, cs.map(transforms[n])) }));
  const forced = options.Ordnung ?? options.ordnung;
  const best = forced !== undefined ? fits.find((f) => f.n === number(forced, 'Ordnung')) : [...fits].sort((a, b) => b.fit.r2 - a.fit.r2)[0];
  if (!best) fail('CHEM_OUTSIDE_MODEL', 'Ordnung muss 0, 1, 2 oder 3 sein.');
  res.step('Linearisierungen und Bestimmtheitsmaße', ...fits.map((f) => L(`n = ${f.n}:\\ ${labels[f.n].replace(/²/g, '^2')},\\ R^2 = ${fmtL(f.fit.r2, 6)}`, `n = ${f.n}: ${labels[f.n]}, R² = ${fmt(f.fit.r2, 6)}`)));
  const sorted = [...fits].sort((a, b) => b.fit.r2 - a.fit.r2);
  if (forced === undefined && sorted[0].fit.r2 - sorted[1].fit.r2 < 1e-3) res.warn('CHEM_MULTIPLE_SOLUTIONS', `Die Ordnungen ${sorted[0].n} und ${sorted[1].n} passen fast gleich gut (R² ${fmt(sorted[0].fit.r2, 6)} und ${fmt(sorted[1].fit.r2, 6)}); mehr Messwerte oder ein größerer Umsatz würden entscheiden.`);
  const n = best.n;
  const slope = best.fit.b;
  const kk = n === 0 ? -slope : n === 1 ? -slope : n === 2 ? slope : slope / 2;
  if (kk <= 0) res.warn('CHEM_OUTSIDE_MODEL', 'Die Steigung hat das falsche Vorzeichen für diese Ordnung; die Konzentration steigt statt zu fallen.');
  res.step(`Ordnung ${n}`, L(`\\text{Die Auftragung ${labels[n].replace(/²/g, '^2')} ist am geradlinigsten: } k = ${fmtL(kk)}\\,\\mathrm{${kUnit(n).replace(/·/g, '\\cdot ')}}`, `${labels[n]} ist am geradlinigsten: k = ${fmt(kk)} ${kUnit(n)}`));
  res.answer({ text: `Ordnung ${n}`, latex: `n = ${n}` });
  res.result.n = n;
  res.value('k', new Quantity(kk, kUnit(n)));
  res.value('Bestimmtheitsmaß R²', new Quantity(best.fit.r2, ''));
  const c0 = (n === 1 ? Math.exp(best.fit.a) : n === 0 ? best.fit.a : n === 2 ? 1 / best.fit.a : 1 / Math.sqrt(best.fit.a));
  if (Number.isFinite(c0) && c0 > 0) res.value('c0 (aus der Geraden)', new Quantity(c0, 'mol/L'));
  res.plot = { kind: 'order', ts, cs, n, fits: fits.map((f) => ({ n: f.n, r2: f.fit.r2 })), y: cs.map(transforms[n]), line: best.fit, label: labels[n] };
  return res;
}

// -------------------------------------------------------------------------------------------- Arrhenius

/**
 * arrhenius(k1=…; T1=…; k2=…; T2=…)  → Ea (and A)
 * arrhenius(k1=…; T1=…; T2=…; Ea=…) → k2
 * arrhenius(A=…; Ea=…; T=…)          → k
 * arrhenius(T=[…] K; k=[…])          → Ea and A from the straight line ln k against 1/T
 */
export function arrheniusFromArgs(args) {
  const { options } = parseArgs(args);
  const res = new ChemicalResult('arrhenius', 'Arrhenius-Gleichung');
  res.step('Arrhenius', L('k = A\\,e^{-E_a/(R\\,T)}\\quad\\Rightarrow\\quad \\ln k = \\ln A - \\frac{E_a}{R}\\cdot\\frac{1}{T}', 'k = A·exp(−Ea/(R·T)); ln k = ln A − Ea/R · 1/T'));
  const Ea = options.Ea !== undefined ? Quantity.parse(options.Ea).need('molarEnergy', 'Ea').in('J/mol') : null;
  const kq = (t) => Quantity.parse(t);
  const Tq = (t) => Quantity.parse(t).need('temperature', 'die Temperatur').si;
  if (options.T !== undefined && /^\s*\[/.test(options.T) && options.k !== undefined) {
    const TT = parseList(options.T);
    const KK = parseList(options.k);
    if (TT.values.length !== KK.values.length || TT.values.length < 2) fail('CHEM_SYNTAX', 'T und k brauchen gleich viele Werte (mindestens zwei).');
    const tUnit = TT.unit || 'K';
    const Ts = TT.values.map((v) => new Quantity(v, tUnit).need('temperature', 'die Temperatur').si);
    if (KK.values.some((v) => !(v > 0))) fail('CHEM_NEGATIVE_CONCENTRATION', 'Die Geschwindigkeitskonstanten müssen positiv sein.');
    const fit = linearFit(Ts.map((T) => 1 / T), KK.values.map(Math.log));
    const ea = -fit.b * R;
    res.step('Ausgleichsgerade ln k gegen 1/T', L(`\\text{Steigung } m = ${fmtL(fit.b)}\\,\\mathrm{K},\\ R^2 = ${fmtL(fit.r2, 6)}`, `Steigung = ${fmt(fit.b)} K, R² = ${fmt(fit.r2, 6)}`));
    res.step('Aktivierungsenergie', L(`E_a = -m\\cdot R = ${fmtL(ea / 1000)}\\,\\mathrm{kJ/mol}`, `Ea = −Steigung·R = ${fmt(ea / 1000)} kJ/mol`));
    res.answer(new Quantity(ea / 1000, 'kJ/mol'), { name: 'Ea' });
    res.value('A', new Quantity(Math.exp(fit.a), KK.unit || ''));
    res.value('Bestimmtheitsmaß R²', new Quantity(fit.r2, ''));
    if (fit.r2 < 0.98) res.warn('CHEM_OUTSIDE_MODEL', 'Die Messpunkte liegen nicht gut auf einer Geraden; die Arrhenius-Gleichung passt hier schlecht.');
    res.plot = { kind: 'arrhenius', x: Ts.map((T) => 1 / T), y: KK.values.map(Math.log), line: fit };
    return res;
  }
  if (options.k1 !== undefined && options.T1 !== undefined && options.k2 !== undefined && options.T2 !== undefined) {
    const k1 = kq(options.k1);
    const k2 = kq(options.k2);
    if (k1.dim.some((x, i) => x !== k2.dim[i])) fail('CHEM_UNIT_MISMATCH', 'k₁ und k₂ haben verschiedene Einheiten.');
    const T1 = Tq(options.T1);
    const T2 = Tq(options.T2);
    if (T1 === T2) fail('CHEM_NO_SOLUTION', 'Bei gleicher Temperatur lässt sich Ea nicht bestimmen.');
    const ea = (R * Math.log(k2.si / k1.si)) / (1 / T1 - 1 / T2);
    res.step('Aus zwei Messungen', L(`E_a = \\frac{R\\,\\ln(k_2/k_1)}{1/T_1 - 1/T_2} = ${fmtL(ea / 1000)}\\,\\mathrm{kJ/mol}`, `Ea = R·ln(k2/k1)/(1/T1 − 1/T2) = ${fmt(ea / 1000)} kJ/mol`));
    const A = k1.value * Math.exp(ea / (R * T1));
    res.answer(new Quantity(ea / 1000, 'kJ/mol'), { name: 'Ea' });
    res.value('A', new Quantity(A, k1.unit));
    res.plot = { kind: 'arrhenius', x: [1 / T1, 1 / T2], y: [Math.log(k1.si), Math.log(k2.si)], line: { a: Math.log(k1.si) + ea / (R * T1), b: -ea / R, r2: 1 } };
    return res;
  }
  if (options.k1 !== undefined && options.T1 !== undefined && options.T2 !== undefined && Ea !== null) {
    const k1 = kq(options.k1);
    const T1 = Tq(options.T1);
    const T2 = Tq(options.T2);
    const k2 = k1.value * Math.exp((-Ea / R) * (1 / T2 - 1 / T1));
    res.step('k bei T₂', L(`k_2 = k_1\\,\\exp\\left(-\\frac{E_a}{R}\\left(\\frac{1}{T_2} - \\frac{1}{T_1}\\right)\\right) = ${fmtL(k2)}\\,\\mathrm{${k1.unit.replace(/·/g, '\\cdot ')}}`, `k2 = ${fmt(k2)} ${k1.unit}`));
    res.answer(new Quantity(k2, k1.unit), { name: 'k₂' });
    res.value('k₂/k₁', new Quantity(k2 / k1.value, ''));
    return res;
  }
  if (options.A !== undefined && Ea !== null && options.T !== undefined) {
    const A = kq(options.A);
    const T = Tq(options.T);
    const k = A.value * Math.exp(-Ea / (R * T));
    res.step('Einsetzen', L(`k = ${fmtL(A.value)}\\cdot\\exp\\left(-\\frac{${fmtL(Ea)}}{8{,}314\\cdot ${fmtL(T)}}\\right) = ${fmtL(k)}`, `k = ${fmt(k)} ${A.unit}`));
    res.answer(new Quantity(k, A.unit), { name: 'k' });
    return res;
  }
  fail('CHEM_MISSING_CONSTANT', 'Gib entweder k1, T1, k2, T2 (→ Ea), k1, T1, T2, Ea (→ k2), A, Ea, T (→ k) oder Reihen T=[…] und k=[…] an.');
}


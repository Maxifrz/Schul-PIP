// Gases: the ideal gas law solved for any one missing quantity, the special laws of Boyle, Charles, Gay-Lussac and
// Avogadro, the combined gas law, molar volume and density, and the van der Waals equation with the tabulated constants
// (also for the volume, which is the root of a cubic).

import gasData from './data/gases.json' with { type: 'json' };
import { ChemicalResult, L } from './result.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { CONSTANTS } from './constants.js';
import { resolve } from './amounts.js';
import { formatFormula } from './formula.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';
import { bisect } from './numeric.js';

const R = CONSTANTS.R.value; // J/(mol·K)
const R_BAR = R * 1e-2; // L·bar/(mol·K)
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

export const GAS_DATA = { version: gasData.version, source: gasData.source, reference: gasData.reference };

const get = (options, ...names) => {
  for (const n of names) if (options[n] !== undefined) return options[n];
  return undefined;
};

/** A quantity of the given kind in the working unit: p in Pa, V in L, T in K, n in mol */
const READERS = {
  p: (t) => Quantity.parse(t).need('pressure', 'den Druck').si,
  V: (t) => Quantity.parse(t).need('volume', 'das Volumen').in('L'),
  T: (t) => {
    const q = Quantity.parse(t).need('temperature', 'die Temperatur');
    const K = q.si;
    if (!(K > 0)) fail('CHEM_OUTSIDE_MODEL', 'Die Temperatur muss über dem absoluten Nullpunkt liegen.');
    return K;
  },
  n: (t) => {
    const n = Quantity.parse(t).need('amount', 'die Stoffmenge').in('mol');
    if (!(n > 0)) fail('CHEM_OUTSIDE_MODEL', 'Die Stoffmenge muss positiv sein.');
    return n;
  },
};

const shown = { p: (v) => `${fmt(v / 1e5)} bar`, V: (v) => `${fmt(v)} L`, T: (v) => `${fmt(v)} K`, n: (v) => `${fmt(v)} mol` };
const shownL = { p: (v) => `${fmtL(v / 1e5)}\\,\\mathrm{bar}`, V: (v) => `${fmtL(v)}\\,\\mathrm{L}`, T: (v) => `${fmtL(v)}\\,\\mathrm{K}`, n: (v) => `${fmtL(v)}\\,\\mathrm{mol}` };
const UNITS = { p: 'bar', V: 'L', T: 'K', n: 'mol' };
const outValue = (key, v) => (key === 'p' ? v / 1e5 : v);

/** gasgesetz(p=1 bar; V=?; n=0,5 mol; T=300 K): whichever of p, V, n, T is missing (a mass with Stoff=… replaces n) */
export function idealGas(options) {
  const res = new ChemicalResult('gas', 'Ideales Gasgesetz');
  const vals = {};
  for (const key of ['p', 'V', 'n', 'T']) if (options[key] !== undefined) vals[key] = READERS[key](options[key]);
  const mass = get(options, 'm');
  if (mass !== undefined && vals.n === undefined) {
    const sub = resolve(get(options, 'Stoff', 'stoff'));
    const m = Quantity.parse(mass).need('mass', 'die Masse').in('g');
    vals.n = m / sub.M;
    res.step('Stoffmenge aus der Masse', L(`n = \\frac{m}{M} = \\frac{${fmtL(m)}\\,\\mathrm{g}}{${fmtL(sub.M)}\\,\\mathrm{g/mol}} = ${fmtL(vals.n)}\\,\\mathrm{mol}`, `n = m/M = ${fmt(vals.n)} mol`));
  }
  const missing = ['p', 'V', 'n', 'T'].filter((k) => vals[k] === undefined);
  if (missing.length !== 1) fail('CHEM_MISSING_CONSTANT', `Beim idealen Gasgesetz müssen genau drei der Größen p, V, n, T gegeben sein (fehlend: ${missing.join(', ') || 'keine'}).`, { missing });
  res.step('Zustandsgleichung', L('p\\,V = n\\,R\\,T\\quad(R = 8{,}314\\,\\mathrm{J/(mol\\cdot K)})', 'p·V = n·R·T'));
  const target = missing[0];
  const Vm3 = (vals.V ?? 0) * 1e-3;
  let result;
  if (target === 'p') result = (vals.n * R * vals.T) / Vm3;
  else if (target === 'V') result = ((vals.n * R * vals.T) / vals.p) * 1e3;
  else if (target === 'n') result = (vals.p * Vm3) / (R * vals.T);
  else result = (vals.p * Vm3) / (vals.n * R);
  const solvedFor = { p: 'p = \\frac{n R T}{V}', V: 'V = \\frac{n R T}{p}', n: 'n = \\frac{p V}{R T}', T: 'T = \\frac{p V}{n R}' };
  res.step(`Umstellen nach ${target}`, L(`${solvedFor[target]} = ${shownL[target](result)}`, `${target} = ${shown[target](result)}`));
  res.answer(new Quantity(outValue(target, result), UNITS[target]), { name: target });
  if (target === 'p') res.value('p in Pa', new Quantity(result, 'Pa'));
  res.value('Molvolumen Vm', new Quantity(((R * (vals.T ?? result)) / (vals.p ?? result)) * 1e3, 'L/mol'));
  res.assume('Ideales Gas: keine Wechselwirkung der Teilchen, Eigenvolumen vernachlässigt.');
  if (target === 'p' && result > 5e6) res.warn('CHEM_OUTSIDE_MODEL', 'Bei über 50 bar weichen reale Gase merklich vom idealen Verhalten ab; die van-der-Waals-Gleichung ist genauer.');
  return res;
}

/** The special laws: two states with one quantity fixed */
const LAWS = {
  boyle: { title: 'Gesetz von Boyle-Mariotte', formula: 'p_1 V_1 = p_2 V_2', text: 'p1·V1 = p2·V2', fixed: 'T und n', vars: ['p', 'V'], relation: 'inverse' },
  charles: { title: 'Gesetz von Gay-Lussac (Volumen)', formula: '\\frac{V_1}{T_1} = \\frac{V_2}{T_2}', text: 'V1/T1 = V2/T2', fixed: 'p und n', vars: ['V', 'T'], relation: 'direct' },
  gaylussac: { title: 'Gesetz von Amontons (Druck)', formula: '\\frac{p_1}{T_1} = \\frac{p_2}{T_2}', text: 'p1/T1 = p2/T2', fixed: 'V und n', vars: ['p', 'T'], relation: 'direct' },
  avogadro: { title: 'Gesetz von Avogadro', formula: '\\frac{V_1}{n_1} = \\frac{V_2}{n_2}', text: 'V1/n1 = V2/n2', fixed: 'p und T', vars: ['V', 'n'], relation: 'direct' },
};

export function gasLaw(kind, options) {
  const law = LAWS[kind];
  if (!law) fail('CHEM_SYNTAX', `Unbekanntes Gasgesetz „${kind}“.`);
  const [a, b] = law.vars;
  const res = new ChemicalResult('gas', law.title);
  res.step('Gesetz', L(`${law.formula}\\quad(\\text{${law.fixed} konstant})`, `${law.text} (${law.fixed} konstant)`));
  const keys = [`${a}1`, `${b}1`, `${a}2`, `${b}2`];
  const vals = {};
  for (const k of keys) if (options[k] !== undefined) vals[k] = READERS[k[0]](options[k]);
  const missing = keys.filter((k) => vals[k] === undefined);
  if (missing.length !== 1) fail('CHEM_MISSING_CONSTANT', `Es müssen genau drei der Größen ${keys.join(', ')} gegeben sein.`, { missing });
  const m = missing[0];
  let x;
  if (law.relation === 'inverse') {
    // p1 V1 = p2 V2
    const other = { p1: ['p2', 'V1', 'V2'], V1: ['p2', 'V2', 'p1'], p2: ['p1', 'V1', 'V2'], V2: ['p1', 'V1', 'p2'] }[m];
    x = m === 'p2' ? (vals.p1 * vals.V1) / vals.V2 : m === 'V2' ? (vals.p1 * vals.V1) / vals.p2 : m === 'p1' ? (vals.p2 * vals.V2) / vals.V1 : (vals.p2 * vals.V2) / vals.p1;
    void other;
  } else {
    // a1/b1 = a2/b2
    if (m === `${a}2`) x = (vals[`${a}1`] / vals[`${b}1`]) * vals[`${b}2`];
    else if (m === `${b}2`) x = (vals[`${b}1`] / vals[`${a}1`]) * vals[`${a}2`];
    else if (m === `${a}1`) x = (vals[`${a}2`] / vals[`${b}2`]) * vals[`${b}1`];
    else x = (vals[`${b}2`] / vals[`${a}2`]) * vals[`${a}1`];
  }
  const kind0 = m[0];
  res.step(`Umstellen nach ${m}`, L(`${m.replace(/(\d)/, '_$1')} = ${shownL[kind0](x)}`, `${m} = ${shown[kind0](x)}`));
  res.answer(new Quantity(outValue(kind0, x), UNITS[kind0]), { name: m });
  res.assume('Ideales Gas.');
  if (kind0 === 'T' && ['charles', 'gaylussac'].includes(kind)) res.assume('Temperaturen in Kelvin (bei Angabe in °C wurde umgerechnet).');
  return res;
}

/** Combined gas law p1·V1/T1 = p2·V2/T2 with one of the six missing */
export function combinedGas(options) {
  const res = new ChemicalResult('gas', 'Allgemeine Gasgleichung');
  res.step('Gesetz', L('\\frac{p_1 V_1}{T_1} = \\frac{p_2 V_2}{T_2}\\quad(n\\ \\text{konstant})', 'p1·V1/T1 = p2·V2/T2 (n konstant)'));
  const keys = ['p1', 'V1', 'T1', 'p2', 'V2', 'T2'];
  const vals = {};
  for (const k of keys) if (options[k] !== undefined) vals[k] = READERS[k[0]](options[k]);
  const missing = keys.filter((k) => vals[k] === undefined);
  if (missing.length !== 1) fail('CHEM_MISSING_CONSTANT', `Es müssen genau fünf der sechs Größen ${keys.join(', ')} gegeben sein.`, { missing });
  const m = missing[0];
  const side = m[1] === '1' ? '2' : '1';
  const other = (v) => vals[`${v}${side}`];
  const same = (v) => vals[`${v}${m[1]}`];
  const [p2, V2, T2] = [other('p'), other('V'), other('T')];
  const ratio = (p2 * V2) / T2; // p·V/T of the known state
  let x;
  if (m[0] === 'p') x = (ratio * same('T')) / same('V');
  else if (m[0] === 'V') x = (ratio * same('T')) / same('p');
  else x = (same('p') * same('V')) / ratio;
  res.step(`Umstellen nach ${m}`, L(`${m.replace(/(\d)/, '_$1')} = ${shownL[m[0]](x)}`, `${m} = ${shown[m[0]](x)}`));
  res.answer(new Quantity(outValue(m[0], x), UNITS[m[0]]), { name: m });
  res.assume('Ideales Gas, konstante Stoffmenge.');
  return res;
}

/** molvolumen(T=273,15 K; p=101,325 kPa): Vm = R·T/p */
export function molarVolume(options) {
  const T = options.T !== undefined ? READERS.T(options.T) : 273.15;
  const p = options.p !== undefined ? READERS.p(options.p) : 101325;
  const Vm = ((R * T) / p) * 1e3;
  const res = new ChemicalResult('gas', 'Molares Volumen');
  res.step('Ideales Gas', L(`V_m = \\frac{R\\,T}{p} = \\frac{8{,}314\\cdot ${fmtL(T)}}{${fmtL(p)}}\\,\\mathrm{m^3/mol} = ${fmtL(Vm)}\\,\\mathrm{L/mol}`, `Vm = R·T/p = ${fmt(Vm)} L/mol`));
  res.answer(new Quantity(Vm, 'L/mol'), { name: 'Vm' });
  if (options.T === undefined && options.p === undefined) res.assume('Normbedingungen: 0 °C und 101 325 Pa.');
  return res;
}

/** gasdichte(CO2; T=25 °C; p=1 bar) → ρ = p·M/(R·T) */
export function gasDensity(substance, options) {
  const sub = resolve(substance);
  const T = options.T !== undefined ? READERS.T(options.T) : 273.15;
  const p = options.p !== undefined ? READERS.p(options.p) : 101325;
  const rho = (p * sub.M * 1e-3) / (R * T); // kg/m³ = g/L
  const res = new ChemicalResult('gas', 'Dichte eines Gases');
  res.step('Ideales Gas', L(`\\rho = \\frac{p\\,M}{R\\,T} = ${fmtL(rho)}\\,\\mathrm{g/L}`, `ρ = p·M/(R·T) = ${fmt(rho)} g/L`));
  res.answer(new Quantity(rho, 'g/L'), { name: 'ρ' });
  return res;
}

// ------------------------------------------------------------------------------------ van der Waals

/** The constants of a gas: { a (L²·bar/mol²), b (L/mol), label } or throws CHEM_DATA_UNAVAILABLE */
export function vdwConstants(text) {
  const sub = resolve(text);
  const key = formatFormula({ ...sub.formula, phase: null }, 'text');
  const c = gasData.gases[key];
  if (!c) fail('CHEM_DATA_UNAVAILABLE', `Für ${key} sind keine van-der-Waals-Konstanten gespeichert (vorhanden: ${Object.keys(gasData.gases).join(', ')}). Gib a=… (L²·bar/mol²) und b=… (L/mol) an.`, { gas: key });
  return { a: c[0], b: c[1], label: key };
}

/** Pressure (bar) of n mol in V litres at T: p = nRT/(V − nb) − a n²/V² */
export const vdwPressure = (a, b, n, V, T) => (n * R_BAR * T) / (V - n * b) - (a * n * n) / (V * V);

/** The real roots V > nb of p V³ − (n b p + n R T) V² + a n² V − a n³ b = 0 (litres), ascending */
export function vdwVolumes(a, b, n, p, T) {
  // p(V) is monotone where the gas is stable; scan for sign changes of p(V) − p on a log grid above n·b
  const lo = n * b * (1 + 1e-9);
  const f = (V) => vdwPressure(a, b, n, V, T) - p;
  const roots = [];
  let prevV = lo;
  let prevF = f(prevV);
  const hi = Math.max((10 * n * R_BAR * T) / Math.max(p, 1e-9), n * b * 1e4);
  const steps = 4000;
  for (let i = 1; i <= steps; i++) {
    const V = lo * Math.exp((Math.log(hi / lo) * i) / steps);
    const fv = f(V);
    if (prevF === 0) roots.push(prevV);
    else if (Math.sign(fv) !== Math.sign(prevF) && Number.isFinite(fv) && Number.isFinite(prevF)) roots.push(bisect(f, prevV, V));
    prevV = V;
    prevF = fv;
  }
  return roots;
}

/**
 * vanderwaals(Gas=CO2; n=1 mol; V=1 L; T=300 K): p ; missing one of p, V, T, n.
 */
export function vanDerWaals(options) {
  const gas = get(options, 'Gas', 'gas', 'Stoff');
  let a;
  let b;
  let label;
  if (options.a !== undefined && options.b !== undefined) {
    a = Number(String(options.a).replace(',', '.'));
    b = Number(String(options.b).replace(',', '.'));
    label = gas || 'Gas';
    if (!Number.isFinite(a) || !Number.isFinite(b)) fail('CHEM_SYNTAX', 'a und b müssen Zahlen sein (a in L²·bar/mol², b in L/mol).');
  } else {
    if (!gas) fail('CHEM_MISSING_CONSTANT', 'Es fehlt das Gas (Gas=CO2) oder die Konstanten a=… und b=….');
    ({ a, b, label } = vdwConstants(gas));
  }
  const res = new ChemicalResult('gas', 'Van-der-Waals-Gleichung');
  res.step('Konstanten', L(`a = ${fmtL(a)}\\,\\mathrm{L^2\\cdot bar/mol^2},\\quad b = ${fmtL(b)}\\,\\mathrm{L/mol}\\quad(\\text{${label}})`, `a = ${fmt(a)} L²·bar/mol², b = ${fmt(b)} L/mol (${label})`));
  res.step('Gleichung', L('\\left(p + \\frac{a\\,n^2}{V^2}\\right)(V - n\\,b) = n\\,R\\,T', '(p + a·n²/V²)(V − n·b) = n·R·T'));
  const vals = {};
  for (const key of ['p', 'V', 'n', 'T']) if (options[key] !== undefined) vals[key] = READERS[key](options[key]);
  const missing = ['p', 'V', 'n', 'T'].filter((k) => vals[k] === undefined);
  if (missing.length !== 1) fail('CHEM_MISSING_CONSTANT', `Es müssen genau drei der Größen p, V, n, T gegeben sein (fehlend: ${missing.join(', ') || 'keine'}).`);
  const target = missing[0];
  const p = vals.p !== undefined ? vals.p / 1e5 : undefined; // bar
  let result;
  if (target === 'p') {
    if (vals.V <= vals.n * b) fail('CHEM_OUTSIDE_MODEL', 'Das Volumen ist kleiner als das Eigenvolumen n·b der Teilchen: Die Gleichung gilt nicht.');
    result = vdwPressure(a, b, vals.n, vals.V, vals.T);
  } else if (target === 'T') {
    result = ((p + (a * vals.n * vals.n) / (vals.V * vals.V)) * (vals.V - vals.n * b)) / (vals.n * R_BAR);
  } else if (target === 'V') {
    const roots = vdwVolumes(a, b, vals.n, p, vals.T);
    if (!roots.length) fail('CHEM_NO_SOLUTION', 'Für diesen Druck gibt es bei dieser Temperatur kein Gasvolumen nach der van-der-Waals-Gleichung.');
    result = roots[roots.length - 1];
    if (roots.length > 1) res.warn('CHEM_MULTIPLE_SOLUTIONS', `Unterhalb der kritischen Temperatur hat die Gleichung ${roots.length} Lösungen (${roots.map((r) => fmt(r) + ' L').join(', ')}); als Gas gilt die größte.`);
  } else {
    // n: p(n) rises with n at fixed V and T for n·b < V; solve p(n) = p
    const nMax = (vals.V / b) * (1 - 1e-9);
    const g = (n) => vdwPressure(a, b, n, vals.V, vals.T) - p;
    let hiN = Math.min(nMax, 1e-3);
    while (g(hiN) < 0 && hiN < nMax) hiN = Math.min(hiN * 2, nMax);
    if (g(hiN) < 0) fail('CHEM_NO_SOLUTION', 'Für diesen Druck gibt es in diesem Volumen keine passende Stoffmenge.');
    result = bisect(g, 1e-15, hiN);
  }
  const keyValue = { p: result, V: result, T: result, n: result }[target];
  res.step(`Ergebnis für ${target}`, L(`${target} = ${shownL[target](target === 'p' ? result * 1e5 : keyValue)}`, `${target} = ${shown[target](target === 'p' ? result * 1e5 : keyValue)}`));
  res.answer(new Quantity(target === 'p' ? result : keyValue, UNITS[target]), { name: target });
  // comparison with the ideal gas
  const full = { ...vals, [target]: target === 'p' ? result * 1e5 : keyValue };
  const pIdeal = (full.n * R * full.T) / (full.V * 1e-3) / 1e5;
  const pReal = target === 'p' ? result : full.p / 1e5;
  const dev = ((pReal - pIdeal) / pIdeal) * 100;
  res.step('Vergleich mit dem idealen Gas', L(`p_{\\mathrm{ideal}} = ${fmtL(pIdeal)}\\,\\mathrm{bar},\\ p_{\\mathrm{real}} = ${fmtL(pReal)}\\,\\mathrm{bar}\\ (${fmtL(dev)}\\,\\%)`, `p(ideal) = ${fmt(pIdeal)} bar, p(real) = ${fmt(pReal)} bar (${fmt(dev)} %)`));
  res.value('p (ideales Gas)', new Quantity(pIdeal, 'bar'));
  res.value('Abweichung vom idealen Gas', new Quantity(dev, '%'));
  res.source(`Konstanten: ${gasData.source}`);
  res.assume('Die Van-der-Waals-Gleichung ist selbst eine Näherung; nahe dem kritischen Punkt und bei sehr hohem Druck ist sie ungenau.');
  return res;
}

export function gasFromArgs(kind, args) {
  const { positional, options } = parseArgs(args);
  switch (kind) {
    case 'ideal': return idealGas(options);
    case 'boyle': case 'charles': case 'gaylussac': case 'avogadro': return gasLaw(kind, options);
    case 'combined': return combinedGas(options);
    case 'molarvolume': return molarVolume(options);
    case 'density': return gasDensity(positional[0] || options.Stoff, options);
    case 'vdw': return vanDerWaals(options);
    default: return fail('CHEM_SYNTAX', 'Unbekannte Gasrechnung.');
  }
}

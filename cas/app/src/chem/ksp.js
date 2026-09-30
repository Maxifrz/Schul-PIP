// Solubility equilibria of sparingly soluble salts: Ksp from the solubility and back, the solubility with a common
// ion or at a fixed pH, and the question whether mixing two solutions makes a salt precipitate (and how much).
// The ion product Π cᵢ^νᵢ rises strictly with the amount that dissolves, so the saturated solution is the unique root
// of Π cᵢ^νᵢ = Ksp and is found by bisection.

import { ChemicalResult, L } from './result.js';
import { formatFormula, parseFormula } from './formula.js';
import { resolve, latexOf, parseGiven, amountFrom, conditionsFrom } from './amounts.js';
import { SUBSTANCES, conjugateAcid } from './substances.js';
import { fractions, kwAt, lg } from './acidbase.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { bisect } from './numeric.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';
import { DEFAULT_TEMPERATURE } from './constants.js';

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

/** The ions of a salt from the database: { sub, entry, ksp, ions: [{ formula (parsed), n, label }] } */
export function saltOf(text) {
  const sub = resolve(text);
  const entry = sub.entry;
  if (!entry || !entry.ions) fail('CHEM_DATA_UNAVAILABLE', `Für ${sub.label} sind keine Ionen gespeichert; es ist vermutlich kein Salz.`, { substance: sub.label });
  const ions = entry.ions.map((i) => ({ formula: parseFormula(i.formula), n: i.n, label: formatFormula(parseFormula(i.formula), 'text') }));
  return { sub, entry, ions, ksp: entry.ksp ? entry.ksp.value : null };
}

function needKsp(salt, options) {
  if (options.Ksp !== undefined) return parseNumber(options.Ksp);
  if (salt.ksp === null) fail('CHEM_DATA_UNAVAILABLE', `Für ${salt.sub.label} ist kein Löslichkeitsprodukt gespeichert. Gib es mit Ksp=… an.`, { substance: salt.sub.label });
  return salt.ksp;
}

function parseNumber(t) {
  const v = Number(String(t).trim().replace(',', '.').replace(/[·×]\s*10\^?/, 'e'));
  if (!Number.isFinite(v)) fail('CHEM_SYNTAX', `„${t}“ ist keine Zahl.`);
  return v;
}

/** The free fraction of an ion that is a base of a weak acid at [H⁺] = h (1 for other ions) */
function freeFraction(ion, h) {
  if (ion.formula.charge >= 0) return 1;
  let current = ion.formula;
  let depth = 0;
  for (;;) {
    const s = SUBSTANCES.find((x) => x.acidBase && x.acidBase.pKa && x.acidBase.pKa.length && sameSpecies(x.parsed, current) && !(conjugateAcid(x.parsed) && conjugateAcid(x.parsed).acidBase && conjugateAcid(x.parsed).acidBase.pKa));
    if (s) {
      const pKa = s.acidBase.pKa;
      const strong = pKa[0] === null;
      const list = strong ? pKa.slice(1) : pKa;
      const alpha = fractions(h, list, strong);
      const k = depth - (strong ? 1 : 0);
      return alpha[k] === undefined ? 1 : alpha[k];
    }
    const up = conjugateAcid(current);
    if (!up) return 1;
    current = up.parsed;
    depth++;
  }
}

const sameSpecies = (a, b) => {
  if (a.charge !== b.charge) return false;
  const keys = new Set([...Object.keys(a.atoms), ...Object.keys(b.atoms)]);
  for (const k of keys) if ((a.atoms[k] || 0) !== (b.atoms[k] || 0)) return false;
  return true;
};

/**
 * The saturated solution: s (mol/L of the salt that dissolves) for Ksp, the ions, start concentrations `c0` per ion
 * label, and optionally a fixed pH (OH⁻ fixed, anions of weak acids protonated as the pH says).
 */
export function saturate(ions, ksp, c0 = {}, options = {}) {
  const alphaOf = (ion) => (options.h ? freeFraction(ion, options.h) : 1);
  const fixedOH = (ion) => options.OH !== undefined && ion.label === 'OH-';
  const product = (s) => {
    let p = 1;
    for (const ion of ions) {
      const total = fixedOH(ion) ? options.OH : (c0[ion.label] || 0) + ion.n * s;
      const free = fixedOH(ion) ? total : total * alphaOf(ion);
      p *= free ** ion.n;
    }
    return p;
  };
  // the product rises with s from its value at s = 0; if that is above Ksp already the solution is oversaturated
  const p0 = product(0);
  if (p0 >= ksp) return { s: 0, oversaturated: p0 > ksp, p0 };
  let hi = 1e-12;
  while (product(hi) < ksp && hi < 1e6) hi *= 4;
  const s = bisect((x) => Math.log(product(x)) - Math.log(ksp), 0, hi);
  return { s, oversaturated: false, p0 };
}

/** Ksp expression as LaTeX: [Ag+][Cl-] or [Ca2+][OH-]^2 */
const kspLatex = (ions) => ions.map((i) => `c(${formatFormula(i.formula, 'latex')})${i.n === 1 ? '' : `^{${i.n}}`}`).join('\\cdot ');

/**
 * Solubility of a salt.
 * options: { Ksp (override), pH, T, gegenion: "c(Cl-)=0,1 mol/L" texts in `givens` }
 */
export function solubility(saltText, givens = [], options = {}) {
  const salt = saltOf(saltText);
  const Ksp = needKsp(salt, options);
  const res = new ChemicalResult('solubility', 'Löslichkeit');
  const { ions } = salt;
  const nTotal = ions.reduce((s, i) => s + i.n, 0);
  res.step('Lösegleichgewicht', L(`${latexOf(salt.sub)} \\rightleftharpoons ${ions.map((i) => `${i.n === 1 ? '' : i.n}\\,${formatFormula(i.formula, 'latex')}`).join(' + ')}`, `${salt.sub.label} <=> ${ions.map((i) => `${i.n === 1 ? '' : i.n + ' '}${i.label}`).join(' + ')}`));
  res.step('Löslichkeitsprodukt', L(`K_{sp} = ${kspLatex(ions)} = ${fmtL(Ksp)}\\,\\mathrm{mol^{${nTotal}}/L^{${nTotal}}}`, `Ksp = ${fmt(Ksp)} (mol/L)^${nTotal}`));
  if (options.Ksp === undefined) res.source(`Ksp von ${salt.sub.label}: CRC Handbook, 25 °C`);
  res.assume('Ideale Lösung; keine Komplexbildung, kein Einfluss anderer Ionen.');

  // start concentrations of common ions
  const c0 = {};
  for (const text of givens) {
    const g = parseGiven(text);
    const q = g.quantities[0];
    const ion = ions.find((i) => i.label === formatFormula(parseFormula(g.substance), 'text'));
    if (!ion) fail('CHEM_UNKNOWN_SUBSTANCE', `${g.substance} ist kein Ion von ${salt.sub.label}; ein Gegenion mit Konzentration kann nur eines der Ionen sein.`, { substance: g.substance });
    if (!q.is('concentration')) fail('CHEM_UNIT_MISMATCH', `Für ${g.substance} wird eine Konzentration erwartet.`);
    c0[ion.label] = (c0[ion.label] || 0) + q.in('mol/L');
  }
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  if (Math.abs(T - DEFAULT_TEMPERATURE) > 1e-9) res.warn('CHEM_OUTSIDE_MODEL', 'Das gespeicherte Löslichkeitsprodukt gilt bei 25 °C.');
  const solveOptions = {};
  if (options.pH !== undefined) {
    const pH = parseNumber(options.pH);
    const { pKw } = kwAt(T);
    solveOptions.h = 10 ** -pH;
    if (ions.some((i) => i.label === 'OH-')) solveOptions.OH = 10 ** (pH - pKw);
    res.assume(`Der pH-Wert wird durch eine Pufferlösung bei pH = ${fmt(pH)} konstant gehalten.`);
  }
  const common = Object.keys(c0);
  if (common.length) res.step('Gleichionige Zusätze', L(common.map((k) => `c_0(${formatFormula(ions.find((i) => i.label === k).formula, 'latex')}) = ${fmtL(c0[k])}\\,\\mathrm{mol/L}`).join(',\\ '), common.map((k) => `c0(${k}) = ${fmt(c0[k])} mol/L`).join(', ')));

  const { s, oversaturated } = saturate(ions, Ksp, c0, solveOptions);
  if (oversaturated) fail('CHEM_NO_SOLUTION', 'Die Anfangskonzentrationen der Ionen überschreiten schon das Löslichkeitsprodukt: Es gibt keine ungesättigte Lösung, das Salz fällt aus.');
  // closed form without additives
  if (!common.length && options.pH === undefined) {
    const product = ions.reduce((p, i) => p * i.n ** i.n, 1);
    res.step('Ansatz', L(`K_{sp} = ${ions.map((i) => `(${i.n === 1 ? '' : i.n}\\,s)${i.n === 1 ? '' : `^{${i.n}}`}`).join('\\cdot ')} = ${product}\\,s^{${nTotal}}`, `Ksp = ${product}·s^${nTotal}`));
    res.step('Auflösen nach s', L(`s = \\sqrt[${nTotal}]{\\frac{K_{sp}}{${product}}} = ${fmtL(s)}\\,\\mathrm{mol/L}`, `s = (Ksp/${product})^(1/${nTotal}) = ${fmt(s)} mol/L`));
  } else {
    res.step('Numerische Lösung', L(`\\prod c_i^{\\nu_i} = K_{sp}\\;\\Rightarrow\\; s = ${fmtL(s)}\\,\\mathrm{mol/L}`, `Π c^ν = Ksp => s = ${fmt(s)} mol/L`));
  }
  const gPerL = s * salt.sub.M;
  res.step('Massenlöslichkeit', L(`L = s \\cdot M = ${fmtL(s)}\\,\\mathrm{mol/L} \\cdot ${fmtL(salt.sub.M)}\\,\\mathrm{g/mol} = ${fmtL(gPerL)}\\,\\mathrm{g/L}`, `L = s·M = ${fmt(gPerL)} g/L`));
  res.answer(new Quantity(s, 'mol/L', { substance: salt.sub.label }));
  res.value('Löslichkeit in g/L', new Quantity(gPerL, 'g/L'));
  for (const ion of ions) {
    const total = solveOptions.OH !== undefined && ion.label === 'OH-' ? solveOptions.OH : (c0[ion.label] || 0) + ion.n * s;
    res.value(`c(${formatFormula(ion.formula, 'unicode')})`, new Quantity(total, 'mol/L'));
  }
  if (solveOptions.h && ions.some((i) => i.formula.charge < 0 && i.label !== 'OH-' && freeFraction(i, solveOptions.h) < 0.999)) res.assume('Die Anionen schwacher Säuren liegen bei diesem pH teilweise protoniert vor; die Löslichkeit wurde entsprechend erhöht.');
  res.chemistry = { s, Ksp, ions: ions.map((i) => i.label) };
  return res;
}

/** Ksp from a solubility: kspFromSolubility('Ag2CrO4', '1,3e-4 mol/L') */
export function kspFromSolubility(saltText, quantityText) {
  const salt = saltOf(saltText);
  const q = Quantity.parse(quantityText);
  let s;
  if (q.is('concentration')) s = q.in('mol/L');
  else if (q.is('massConcentration')) s = q.in('g/L') / salt.sub.M;
  else fail('CHEM_UNIT_MISMATCH', 'Die Löslichkeit braucht die Einheit mol/L oder g/L.');
  const { ions } = salt;
  const nTotal = ions.reduce((t, i) => t + i.n, 0);
  const Ksp = ions.reduce((p, i) => p * (i.n * s) ** i.n, 1);
  const res = new ChemicalResult('ksp', 'Löslichkeitsprodukt');
  res.step('Lösegleichgewicht', L(`${latexOf(salt.sub)} \\rightleftharpoons ${ions.map((i) => `${i.n === 1 ? '' : i.n}\\,${formatFormula(i.formula, 'latex')}`).join(' + ')}`));
  if (q.is('massConcentration')) res.step('In mol/L', L(`s = \\frac{${fmtL(q.in('g/L'))}\\,\\mathrm{g/L}}{${fmtL(salt.sub.M)}\\,\\mathrm{g/mol}} = ${fmtL(s)}\\,\\mathrm{mol/L}`, `s = β/M = ${fmt(s)} mol/L`));
  res.step('Ionenkonzentrationen', L(ions.map((i) => `c(${formatFormula(i.formula, 'latex')}) = ${i.n === 1 ? '' : i.n + '\\cdot '}${fmtL(s)} = ${fmtL(i.n * s)}\\,\\mathrm{mol/L}`).join(',\\ ')));
  res.step('Löslichkeitsprodukt', L(`K_{sp} = ${kspLatex(ions)} = ${fmtL(Ksp)}`, `Ksp = ${fmt(Ksp)}`));
  res.answer(new Quantity(Ksp, ''), { name: 'Ksp' });
  res.result.latex = `K_{sp} = ${fmtL(Ksp)}\\,\\mathrm{mol^{${nTotal}}/L^{${nTotal}}}`;
  res.result.unit = '';
  res.assume('Vollständige Dissoziation des gelösten Anteils; ideale Lösung.');
  res.assume('25 °C.');
  return res;
}

/** The ions of what a solution item brings: [{ label, formula, n (mol) }] */
function ionsOfItem(text, defaults) {
  const g = parseGiven(text);
  if (!g.substance) fail('CHEM_SYNTAX', `„${text}“: es fehlt der Stoff (z. B. AgNO3 0,001 mol/L 50 mL).`);
  const sub = resolve(g.substance);
  const a = amountFrom(sub, g.quantities, defaults.conditions || {});
  const V = g.quantities.find((q) => q.is('volume'));
  if (!V) fail('CHEM_MISSING_CONSTANT', `Für ${sub.label} fehlt das Volumen der Lösung.`);
  const ionList = sub.entry && sub.entry.ions ? sub.entry.ions.map((i) => ({ parsed: parseFormula(i.formula), n: i.n })) : sub.formula.charge !== 0 ? [{ parsed: sub.formula, n: 1 }] : null;
  if (!ionList) fail('CHEM_DATA_UNAVAILABLE', `Für ${sub.label} sind keine Ionen gespeichert.`, { substance: sub.label });
  return { sub, V: V.in('L'), ions: ionList.map((i) => ({ label: formatFormula(i.parsed, 'text'), formula: i.parsed, n: a.n * i.n })), steps: a.steps };
}

/**
 * Whether a precipitate forms when solutions are mixed: fällung(AgCl; AgNO3 0,001 mol/L 50 mL; NaCl 0,001 mol/L 50 mL).
 */
export function precipitation(saltText, solutions, options = {}) {
  const salt = saltOf(saltText);
  const Ksp = needKsp(salt, options);
  const items = solutions.map((t) => ionsOfItem(t, {}));
  const Vtot = items.reduce((s, i) => s + i.V, 0);
  const res = new ChemicalResult('precipitation', 'Fällung');
  res.assume('Die Volumina der Lösungen werden addiert.');
  res.assume('Ideale Lösung; keine Komplexbildung.');
  for (const it of items) for (const st of it.steps) res.steps.push(st);
  // total amount of each needed ion
  const amount = {};
  for (const it of items) for (const ion of it.ions) amount[ion.label] = (amount[ion.label] || 0) + ion.n;
  const need = salt.ions;
  for (const ion of need) if (!amount[ion.label]) fail('CHEM_MISSING_CONSTANT', `Das Ion ${ion.label} kommt in keiner der Lösungen vor.`, { ion: ion.label });
  res.step('Konzentrationen nach dem Mischen', ...need.map((ion) => L(`c(${formatFormula(ion.formula, 'latex')}) = \\frac{${fmtL(amount[ion.label])}\\,\\mathrm{mol}}{${fmtL(Vtot)}\\,\\mathrm{L}} = ${fmtL(amount[ion.label] / Vtot)}\\,\\mathrm{mol/L}`, `c(${ion.label}) = ${fmt(amount[ion.label])} mol / ${fmt(Vtot)} L = ${fmt(amount[ion.label] / Vtot)} mol/L`)));
  const conc = (label, x = 0) => (amount[label] - (need.find((i) => i.label === label).n * x)) / Vtot;
  const ionProduct = (x) => need.reduce((p, i) => p * conc(i.label, x) ** i.n, 1);
  const Q = ionProduct(0);
  res.step('Ionenprodukt', L(`Q = ${kspLatex(need)} = ${fmtL(Q)}\\quad\\text{gegen}\\quad K_{sp} = ${fmtL(Ksp)}`, `Q = ${fmt(Q)} gegen Ksp = ${fmt(Ksp)}`));
  const precipitates = Q > Ksp;
  res.step('Entscheidung', L(precipitates ? `Q > K_{sp}\\;\\Rightarrow\\;\\text{${salt.sub.label} fällt aus}` : `Q \\le K_{sp}\\;\\Rightarrow\\;\\text{kein Niederschlag}`, precipitates ? `Q > Ksp => ${salt.sub.label} fällt aus` : 'Q ≤ Ksp => kein Niederschlag'));
  res.answer({ text: precipitates ? `${salt.sub.label} fällt aus` : 'kein Niederschlag', latex: precipitates ? `\\text{${salt.sub.label} fällt aus}` : '\\text{kein Niederschlag}' });
  res.value('Ionenprodukt Q', new Quantity(Q, ''));
  res.value('Löslichkeitsprodukt Ksp', new Quantity(Ksp, ''));
  if (precipitates) {
    // amount x (mol) that precipitates: the product of what is left equals Ksp
    const limit = Math.min(...need.map((i) => amount[i.label] / i.n));
    const x = bisect((v) => Math.log(ionProduct(v)) - Math.log(Ksp), 0, limit * (1 - 1e-15) > 0 ? limit * (1 - 1e-12) : limit);
    const mass = x * salt.sub.M;
    res.step('Ausgefallene Stoffmenge', L(`\\prod c_{\\mathrm{Rest}}^{\\nu} = K_{sp}\\;\\Rightarrow\\; n(\\text{Niederschlag}) = ${fmtL(x)}\\,\\mathrm{mol}\\;=\\;${fmtL(mass)}\\,\\mathrm{g}`, `n(Niederschlag) = ${fmt(x)} mol = ${fmt(mass)} g`));
    res.value('n(Niederschlag)', new Quantity(x, 'mol'));
    res.value('m(Niederschlag)', new Quantity(mass, 'g'));
    for (const ion of need) res.value(`c(${formatFormula(ion.formula, 'unicode')}) danach`, new Quantity(conc(ion.label, x), 'mol/L'));
  }
  res.chemistry = { Q, Ksp, precipitates };
  return res;
}

/** Command form */
export function kspFromArgs(args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt das Salz, z. B. Ksp(AgCl).');
  if (options['löslichkeit'] !== undefined || options.loeslichkeit !== undefined || options.s !== undefined) {
    return kspFromSolubility(positional[0], options['löslichkeit'] || options.loeslichkeit || options.s);
  }
  // a plain lookup
  const salt = saltOf(positional[0]);
  const Ksp = needKsp(salt, options);
  const res = new ChemicalResult('ksp', 'Löslichkeitsprodukt');
  res.step('Lösegleichgewicht', L(`${latexOf(salt.sub)} \\rightleftharpoons ${salt.ions.map((i) => `${i.n === 1 ? '' : i.n}\\,${formatFormula(i.formula, 'latex')}`).join(' + ')}`));
  res.answer(new Quantity(Ksp, ''), { name: 'Ksp' });
  res.result.latex = `K_{sp}(${latexOf(salt.sub)}) = ${fmtL(Ksp)}`;
  res.value('pKsp', new Quantity(-lg(Ksp), ''));
  res.source('CRC Handbook of Chemistry and Physics, 25 °C');
  return res;
}

// n, m, M, c, V of a substance: from whatever is given, everything that follows is derived by forward chaining over the
// basic relations (n = m/M, c = n/V, ideal gas, density). The answer is the asked quantity; the steps are the rules that
// were used. Also dilution (c₁V₁ = c₂V₂) and plain unit conversion with dimension checking.

import { ChemicalResult, L } from './result.js';
import { resolve, parseGiven, latexOf, minSig, conditionsFrom } from './amounts.js';
import { Quantity } from './quantity.js';
import { convert } from './units.js';
import { formatNumber, sigFigsOf, sigWords } from './format.js';
import { CONSTANTS, NORMAL } from './constants.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';

const R = CONSTANTS.R.value;
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

const TARGETS = {
  n: { unit: 'mol', dim: 'amount', name: 'Stoffmenge' },
  m: { unit: 'g', dim: 'mass', name: 'Masse' },
  c: { unit: 'mol/L', dim: 'concentration', name: 'Stoffmengenkonzentration' },
  V: { unit: 'L', dim: 'volume', name: 'Volumen' },
  beta: { unit: 'g/L', dim: 'massConcentration', name: 'Massenkonzentration' },
};

/**
 * Derives n, m, c, V, β for one substance. `known` is { n, m, c, V, beta, p, T } in mol, g, mol/L, L, g/L, Pa, K.
 * Returns { values, steps, assumptions }.
 */
export function derive(sub, known, wanted) {
  const v = { ...known };
  const steps = [];
  const assumptions = [];
  const M = sub.M;
  const label = sub.label;
  const rules = [
    () => v.n === undefined && v.m !== undefined && Number.isFinite(M) && (v.n = v.m / M, steps.push({ label: `n aus m (${label})`, lines: [L(`n = \\frac{m}{M} = \\frac{${fmtL(v.m)}\\,\\mathrm{g}}{${fmtL(M)}\\,\\mathrm{g/mol}} = ${fmtL(v.n)}\\,\\mathrm{mol}`, `n = m/M = ${fmt(v.m)} g / ${fmt(M)} g/mol = ${fmt(v.n)} mol`)] }), true),
    () => v.m === undefined && v.n !== undefined && Number.isFinite(M) && (v.m = v.n * M, steps.push({ label: `m aus n (${label})`, lines: [L(`m = n \\cdot M = ${fmtL(v.n)}\\,\\mathrm{mol}\\cdot ${fmtL(M)}\\,\\mathrm{g/mol} = ${fmtL(v.m)}\\,\\mathrm{g}`, `m = n·M = ${fmt(v.n)} mol · ${fmt(M)} g/mol = ${fmt(v.m)} g`)] }), true),
    () => v.c === undefined && v.beta !== undefined && Number.isFinite(M) && (v.c = v.beta / M, steps.push({ label: `c aus β (${label})`, lines: [L(`c = \\frac{\\beta}{M} = ${fmtL(v.c)}\\,\\mathrm{mol/L}`, `c = β/M = ${fmt(v.c)} mol/L`)] }), true),
    () => v.beta === undefined && v.c !== undefined && Number.isFinite(M) && (v.beta = v.c * M, steps.push({ label: `β aus c (${label})`, lines: [L(`\\beta = c\\cdot M = ${fmtL(v.beta)}\\,\\mathrm{g/L}`, `β = c·M = ${fmt(v.beta)} g/L`)] }), true),
    () => v.c === undefined && v.n !== undefined && v.V !== undefined && (v.c = v.n / v.V, steps.push({ label: `c aus n und V (${label})`, lines: [L(`c = \\frac{n}{V} = \\frac{${fmtL(v.n)}\\,\\mathrm{mol}}{${fmtL(v.V)}\\,\\mathrm{L}} = ${fmtL(v.c)}\\,\\mathrm{mol/L}`, `c = n/V = ${fmt(v.n)} mol / ${fmt(v.V)} L = ${fmt(v.c)} mol/L`)] }), true),
    () => v.n === undefined && v.c !== undefined && v.V !== undefined && (v.n = v.c * v.V, steps.push({ label: `n aus c und V (${label})`, lines: [L(`n = c\\cdot V = ${fmtL(v.c)}\\,\\mathrm{mol/L}\\cdot ${fmtL(v.V)}\\,\\mathrm{L} = ${fmtL(v.n)}\\,\\mathrm{mol}`, `n = c·V = ${fmt(v.c)} mol/L · ${fmt(v.V)} L = ${fmt(v.n)} mol`)] }), true),
    () => v.V === undefined && v.n !== undefined && v.c !== undefined && v.c > 0 && (v.V = v.n / v.c, steps.push({ label: `V aus n und c (${label})`, lines: [L(`V = \\frac{n}{c} = ${fmtL(v.V)}\\,\\mathrm{L}\\ (= ${fmtL(v.V * 1000)}\\,\\mathrm{mL})`, `V = n/c = ${fmt(v.V)} L (= ${fmt(v.V * 1000)} mL)`)] }), true),
  ];
  const gas = () => {
    if (sub.phase !== 'g') return false;
    const T = v.T !== undefined ? v.T : NORMAL.T;
    const p = v.p !== undefined ? v.p : NORMAL.p;
    let done = false;
    if (v.V === undefined && v.n !== undefined && v.c === undefined) {
      v.V = ((v.n * R * T) / p) * 1e3;
      steps.push({ label: `V aus n (ideales Gas, ${label})`, lines: [L(`V = \\frac{n\\,R\\,T}{p} = ${fmtL(v.V)}\\,\\mathrm{L}`, `V = n·R·T/p = ${fmt(v.V)} L`)] });
      done = true;
    } else if (v.n === undefined && v.V !== undefined && v.c === undefined) {
      v.n = (p * v.V * 1e-3) / (R * T);
      steps.push({ label: `n aus V (ideales Gas, ${label})`, lines: [L(`n = \\frac{p\\,V}{R\\,T} = ${fmtL(v.n)}\\,\\mathrm{mol}`, `n = p·V/(R·T) = ${fmt(v.n)} mol`)] });
      done = true;
    }
    if (done) {
      const text = v.T === undefined && v.p === undefined ? 'Gasvolumen bei Normbedingungen (0 °C, 101,325 kPa) als ideales Gas; andere Bedingungen mit T=… und p=….' : `Ideales Gas bei ${fmt(T)} K und ${fmt(p / 1000)} kPa.`;
      if (!assumptions.includes(text)) assumptions.push(text);
    }
    return done;
  };
  const density = () => {
    const d = sub.entry && sub.entry.density;
    if (!d || sub.phase === 'g') return false;
    const rho = convert(d.value, d.unit, 'g/L');
    if (v.V === undefined && v.m !== undefined && v.c === undefined) {
      v.V = v.m / rho;
      steps.push({ label: `V aus m und Dichte (${label})`, lines: [L(`V = \\frac{m}{\\rho} = ${fmtL(v.V)}\\,\\mathrm{L}`, `V = m/ρ = ${fmt(v.V)} L`)] });
      assumptions.push(`Dichte von ${label} = ${fmt(d.value)} ${d.unit} (${fmt(d.T - 273.15)} °C).`);
      return true;
    }
    if (v.m === undefined && v.V !== undefined && v.c === undefined && v.n === undefined) {
      v.m = rho * v.V;
      steps.push({ label: `m aus V und Dichte (${label})`, lines: [L(`m = \\rho\\cdot V = ${fmtL(v.m)}\\,\\mathrm{g}`, `m = ρ·V = ${fmt(v.m)} g`)] });
      assumptions.push(`Dichte von ${label} = ${fmt(d.value)} ${d.unit} (${fmt(d.T - 273.15)} °C).`);
      return true;
    }
    return false;
  };
  for (let round = 0; round < 12; round++) {
    let changed = false;
    for (const rule of rules) {
      const before = JSON.stringify(v);
      rule();
      if (JSON.stringify(v) !== before) changed = true;
    }
    if (v[wanted] !== undefined) break;
    if (!changed) {
      if (gas()) changed = true;
      else if (density()) changed = true;
    }
    if (!changed) break;
  }
  return { values: v, steps, assumptions };
}

/** Collects substance and quantities from the arguments of n(...), m(...), c(...), V(...) */
function collect(positional, options) {
  let substance = null;
  const known = {};
  const quantities = [];
  const put = (q, symbol) => {
    const kind = { amount: 'n', mass: 'm', volume: 'V', concentration: 'c', massConcentration: 'beta', pressure: 'p', temperature: 'T' };
    const key = Object.keys(kind).find((k) => q.is(k));
    if (!key) fail('CHEM_UNIT_MISMATCH', `Die Größe „${q.value} ${q.unit}“ (${q.dimension}) ist hier nicht verwendbar.`, { unit: q.unit });
    const name = kind[key];
    const base = { n: 'mol', m: 'g', V: 'L', c: 'mol/L', beta: 'g/L', p: 'Pa', T: 'K' }[name];
    const value = name === 'p' ? q.si : name === 'T' ? q.si : q.in(base);
    if (known[name] !== undefined && Math.abs(known[name] - value) > 1e-12 * Math.abs(value)) fail('CHEM_UNIT_MISMATCH', `Zwei verschiedene Angaben für ${TARGETS[name] ? TARGETS[name].name : name}.`);
    known[name] = value;
    quantities.push(q);
    void symbol;
  };
  for (const text of positional) {
    // a bare substance ("NaCl") or a full given ("10 g NaCl", "m(NaCl) = 10 g")
    if (!/[\d]/.test(text.replace(/[A-Za-z()]+\d*/g, '')) && !/=/.test(text) && !/^\s*[-+]?[\d.,]/.test(text)) {
      if (substance) fail('CHEM_SYNTAX', 'Es ist nur ein Stoff möglich.');
      substance = text.trim();
      continue;
    }
    const g = parseGiven(text);
    if (g.substance) {
      if (substance && substance !== g.substance) fail('CHEM_SYNTAX', 'Es ist nur ein Stoff möglich.');
      substance = g.substance;
    }
    for (const q of g.quantities) put(q, g.symbol);
  }
  for (const key of ['n', 'm', 'V', 'c', 'p', 'T']) if (options[key] !== undefined) put(Quantity.parse(options[key]), key);
  if (options['β'] !== undefined) put(Quantity.parse(options['β']), 'beta');
  return { substance, known, quantities };
}

/** n(NaCl; 10 g) · m(NaCl; 0,5 mol) · c(NaCl; 5 g; 250 mL) · V(H2; 0,5 mol) */
export function convertCommand(target, args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length && !Object.keys(options).length) fail('CHEM_SYNTAX', `Schreibweise: ${target}(Stoff; Angaben), z. B. ${target === 'n' ? 'n(NaCl; 10 g)' : target === 'm' ? 'm(NaCl; 0,5 mol)' : target === 'c' ? 'c(NaCl; 5 g; 250 mL)' : 'V(H2; 0,5 mol)'}`);
  const { substance, known, quantities } = collect(positional, options);
  const t = TARGETS[target];
  if (!substance) fail('CHEM_UNKNOWN_SUBSTANCE', 'Es fehlt der Stoff (Formel oder Name).');
  const sub = resolve(substance);
  const res = new ChemicalResult('conversion', `${t.name} von ${sub.label}`);
  if (known[target] !== undefined) {
    res.answer(new Quantity(known[target], t.unit, { substance: sub.label }));
    res.step('Angegeben', L(`${target} = ${fmtL(known[target])}\\,\\mathrm{${t.unit}}`, `${target} = ${fmt(known[target])} ${t.unit}`));
    return res;
  }
  const d = derive(sub, known, target);
  const value = d.values[target];
  if (value === undefined) {
    const need = { n: 'die Masse (g), das Volumen eines Gases oder Konzentration und Volumen', m: 'die Stoffmenge (mol), Konzentration und Volumen oder Volumen mit Dichte', c: 'Stoffmenge oder Masse und das Volumen der Lösung', V: 'die Stoffmenge (bei Gasen) oder Stoffmenge und Konzentration' }[target];
    fail('CHEM_MISSING_CONSTANT', `Zur ${t.name} von ${sub.label} fehlt noch: ${need}.`, { substance: sub.label });
  }
  for (const s of d.steps) res.steps.push(s);
  for (const a of d.assumptions) res.assume(a);
  res.answer(new Quantity(value, t.unit, { substance: sub.label, sigFigs: minSig(quantities) }));
  for (const key of ['n', 'm', 'c', 'V', 'beta']) {
    if (key !== target && d.values[key] !== undefined && known[key] === undefined) res.value(`${key === 'beta' ? 'β' : key}(${sub.label})`, new Quantity(d.values[key], TARGETS[key].unit, { substance: sub.label }));
  }
  const sig = minSig(quantities);
  if (sig !== undefined && sig < 4) res.step('Signifikante Stellen', L(`\\text{Kleinste Angabe: ${sigWords(sig)}} \\Rightarrow ${formatNumber(value, { sig, style: 'latex' })}\\,\\mathrm{${t.unit}}`, `Kleinste Angabe: ${sigWords(sig)} => ${formatNumber(value, { sig })} ${t.unit}`));
  res.source('Molmasse aus den Atommassen (IUPAC)');
  return res;
}

/** verdünnung(c1=1 mol/L; V1=10 mL; V2=100 mL) → c2 (any one of c1, V1, c2, V2 missing) */
export function dilutionFromArgs(args) {
  const { options } = parseArgs(args);
  const c1 = options.c1 !== undefined ? Quantity.parse(options.c1).need('concentration', 'c1').in('mol/L') : null;
  const c2 = options.c2 !== undefined ? Quantity.parse(options.c2).need('concentration', 'c2').in('mol/L') : null;
  const V1 = options.V1 !== undefined ? Quantity.parse(options.V1).need('volume', 'V1').in('L') : null;
  const V2 = options.V2 !== undefined ? Quantity.parse(options.V2).need('volume', 'V2').in('L') : null;
  const missing = [['c1', c1], ['V1', V1], ['c2', c2], ['V2', V2]].filter(([, x]) => x === null).map(([k]) => k);
  if (missing.length !== 1) fail('CHEM_MISSING_CONSTANT', `Für die Verdünnung müssen genau drei der Größen c1, V1, c2, V2 gegeben sein (fehlend: ${missing.join(', ') || 'keine'}).`);
  const res = new ChemicalResult('dilution', 'Verdünnung');
  res.step('Stoffmenge bleibt gleich', L('n = c_1 V_1 = c_2 V_2', 'c1·V1 = c2·V2'));
  let x;
  let unit;
  const target = missing[0];
  if (target === 'c2') [x, unit] = [(c1 * V1) / V2, 'mol/L'];
  else if (target === 'c1') [x, unit] = [(c2 * V2) / V1, 'mol/L'];
  else if (target === 'V2') [x, unit] = [(c1 * V1) / c2, 'L'];
  else [x, unit] = [(c2 * V2) / c1, 'L'];
  res.step(`Umstellen nach ${target}`, L(`${target.replace(/(\d)/, '_$1')} = ${fmtL(x)}\\,\\mathrm{${unit}}`, `${target} = ${fmt(x)} ${unit}`));
  res.answer(new Quantity(x, unit), { name: target });
  if (target === 'V2' && V1 !== null && x < V1) res.warn('CHEM_NEGATIVE_CONCENTRATION', 'Das Endvolumen wäre kleiner als das Ausgangsvolumen: Das ist keine Verdünnung, sondern ein Aufkonzentrieren.');
  if (target === 'c2' && c1 !== null && x > c1) res.warn('CHEM_OUTSIDE_MODEL', 'Die Endkonzentration ist höher als die Ausgangskonzentration: Das ist keine Verdünnung.');
  if (target === 'V1' || target === 'V2') res.value('in mL', new Quantity(x * 1000, 'mL'));
  if (V1 !== null && V2 !== null && target !== 'V1' && target !== 'V2') res.value('Wasser zugeben', new Quantity((V2 - V1) * 1000, 'mL'));
  if (V2 !== null && V1 !== null && V2 < V1) res.warn('CHEM_OUTSIDE_MODEL', 'V2 ist kleiner als V1.');
  res.assume('Volumina additiv (ideal).');
  return res;
}

/** umrechnen(250 mL; L) · umrechnen(25 °C; K) */
export function unitConversionFromArgs(args) {
  const { positional } = parseArgs(args);
  if (positional.length !== 2) fail('CHEM_SYNTAX', 'Schreibweise: umrechnen(250 mL; L)');
  const q = Quantity.parse(positional[0]);
  const value = convert(q.value, q.unit, positional[1].trim());
  const res = new ChemicalResult('convert', 'Einheiten umrechnen');
  res.step('Umrechnung', L(`${fmtL(q.value)}\\,\\mathrm{${q.unit.replace(/·/g, '\\cdot ')}} = ${fmtL(value)}\\,\\mathrm{${positional[1].trim().replace(/·/g, '\\cdot ')}}`, `${fmt(q.value)} ${q.unit} = ${fmt(value)} ${positional[1].trim()}`));
  res.answer(new Quantity(value, positional[1].trim()));
  res.assume(`Größenart: ${q.dimension}; die Einheiten wurden auf ihre Dimension geprüft.`);
  return res;
}

export { sigFigsOf, latexOf, conditionsFrom };

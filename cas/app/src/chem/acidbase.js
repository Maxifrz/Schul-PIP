// Acids, bases, salts and buffers in water. Every solution is solved the same way, from the charge balance
//
//     [H⁺] + Σ(spectator charges) + Σ C·(mean charge of each acid/base system) − Kw/[H⁺] = 0
//
// where the mean charge of a system comes from its acid constants. The left side grows with [H⁺], so there is exactly one
// root, found by bisection on lg [H⁺]. The school formulas (pH = −lg c, pH = ½(pKa − lg c), Henderson–Hasselbalch) are
// shown next to the exact value with their deviation, and used only where they hold. Activities are taken as 1: the
// solution is treated as ideal.

import { ChemicalResult, L } from './result.js';
import { formatFormula } from './formula.js';
import { SUBSTANCES, conjugateAcid, conjugateBase } from './substances.js';
import { resolve, resolveParsed, parseGiven, amountFrom, latexOf, conditionsFrom, minSig } from './amounts.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { KW_25, DEFAULT_TEMPERATURE } from './constants.js';
import { fail } from './errors.js';
import { parseFormula } from './formula.js';
import { parseArgs } from './args.js';

const LN10 = Math.LN10;
export const lg = (x) => Math.log10(x);

/** pKw of pure water by temperature in °C (25 °C at the school value 14,00) */
const PKW = [[0, 14.94], [5, 14.73], [10, 14.53], [15, 14.35], [20, 14.17], [25, 14.0], [30, 13.83], [35, 13.68], [40, 13.53], [45, 13.4], [50, 13.26], [60, 13.02], [70, 12.8], [80, 12.6], [90, 12.42], [100, 12.26]];

/** Ion product of water at T (K): { Kw, pKw }. Between the table's temperatures pKw is interpolated linearly. */
export function kwAt(T = DEFAULT_TEMPERATURE) {
  const t = T - 273.15;
  if (Math.abs(t - 25) < 1e-9) return { Kw: KW_25, pKw: 14, interpolated: false };
  if (t < PKW[0][0] || t > PKW[PKW.length - 1][0]) fail('CHEM_OUTSIDE_MODEL', `Der Ionenproduktwert des Wassers ist nur für 0 bis 100 °C gespeichert, nicht für ${formatNumber(t, { sig: 4 })} °C.`);
  let i = PKW.findIndex(([x]) => x >= t);
  if (PKW[i][0] === t) return { Kw: 10 ** -PKW[i][1], pKw: PKW[i][1], interpolated: false };
  const [x0, y0] = PKW[i - 1];
  const [x1, y1] = PKW[i];
  const pKw = y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  return { Kw: 10 ** -pKw, pKw, interpolated: true };
}

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

/** The formula with k protons removed (charge k lower): the database's own writing (CH₃COO⁻) when it has one */
export function deprotonated(parsed, k) {
  let current = parsed;
  for (let i = 0; i < k; i++) {
    const base = conjugateBase(current);
    if (!base) return deprotonatedByAtoms(parsed, k);
    current = base.parsed;
  }
  return current;
}

function deprotonatedByAtoms(parsed, k) {
  const atoms = { ...parsed.atoms };
  atoms.H = (atoms.H || 0) - k;
  if (atoms.H < 0) fail('CHEM_FORMULA_INVALID', `${formatFormula(parsed)} hat nicht genug Wasserstoff für ${k} Protonenabgaben.`);
  if (atoms.H === 0) delete atoms.H;
  return { ...parsed, atoms, isotopes: {}, hydrate: [], charge: parsed.charge - k, ast: rebuildAst(atoms), phase: null };
}

/** A minimal AST for a formula given by atom counts: elements in Hill-like order */
function rebuildAst(atoms) {
  const symbols = Object.keys(atoms);
  const rest = symbols.filter((x) => x !== 'C' && x !== 'H').sort();
  const order = atoms.C ? ['C', ...(atoms.H ? ['H'] : []), ...rest] : [...(atoms.H ? [...rest.slice(0, 0)] : []), ...symbols];
  const seen = new Set();
  return order.filter((s) => !seen.has(s) && seen.add(s)).map((symbol) => ({ type: 'el', symbol, n: atoms[symbol], mass: null }));
}

/** Fractions of the species of a system at [H⁺] = h. forms[k] is the species with k protons removed. */
export function fractions(h, pKa, strongFirst = false) {
  const n = pKa.length;
  const start = strongFirst ? 1 : 0;
  // ln of the weight of form k: −ln10 · Σ_{j≤k} pKa_j + (n − k) ln h
  const logs = [];
  let acc = 0;
  for (let k = 0; k <= n; k++) {
    if (k > 0 && !(strongFirst && k === 1)) acc -= pKa[k - 1] * LN10;
    logs.push(k < start ? -Infinity : acc + (n - k) * Math.log(h));
  }
  const top = Math.max(...logs);
  const w = logs.map((x) => Math.exp(x - top));
  const sum = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / sum);
}

/**
 * The acid/base systems a substance brings into the water.
 * Returns { systems, spectators, notes, kind } for `c` mol/L of `sub`:
 *  - systems: [{ top (parsed), z, pKa: [...], C, strongFirst, contributions: [{ k, c, label }] }]
 *  - spectators: [{ label, charge (per particle), c, source: 'strong' | 'salt' }]
 */
export function systemsOf(sub, c, constants = {}) {
  const notes = [];
  const assumptions = [];
  const systems = [];
  const spectators = [];
  const entry = sub.entry;
  const ab = entry && entry.acidBase;

  const addSystem = (root, C, form) => {
    let { pKa } = root;
    let top = root.top;
    let strongFirst = false;
    if (pKa[0] === null) {
      // the first proton is strong (H2SO4): start at the ion
      const base = conjugateBase(top);
      if (!base) fail('CHEM_DATA_UNAVAILABLE', `Für ${formatFormula(top)} fehlt die Formel der ersten Stufe.`);
      top = base.parsed;
      pKa = pKa.slice(1);
    }
    let system = systems.find((s) => s.key === formatFormula({ ...top, phase: null }));
    if (!system) {
      system = { key: formatFormula({ ...top, phase: null }), top, z: top.charge, pKa, C: 0, strongFirst, contributions: [] };
      systems.push(system);
    }
    system.C += C;
    system.contributions.push({ k: form, c: C });
  };

  // a system for a weak acid/base or one of its ions: found through the conjugate acids up to the top form
  const rootOf = (parsed) => {
    let current = parsed;
    let depth = 0;
    for (;;) {
      const s = SUBSTANCES.find((x) => sameSpecies(x.parsed, current));
      if (s && s.acidBase && s.acidBase.pKa && s.acidBase.pKa.length && !isLevelOfHigher(s)) return { entry: s, k: depth };
      const up = conjugateAcid(current);
      if (!up) return null;
      current = up.parsed;
      depth++;
    }
  };

  const bring = (parsedSpecies, count) => {
    const found = rootOf(parsedSpecies) || fromPkb(parsedSpecies);
    if (!found) return null;
    const e = found.entry;
    const pKa = e.acidBase.pKa;
    // the first stage of a strong first proton is skipped, so the form index shifts
    const shift = pKa[0] === null ? 1 : 0;
    addSystem({ top: e.parsed, pKa }, c * count, found.k - shift);
    return found;
  };

  const spectate = (parsedIon, count, source) => {
    const z = parsedIon.charge;
    spectators.push({ label: formatFormula({ ...parsedIon, phase: null }), charge: z, c: c * count, source });
    if (Math.abs(z) >= 2 && z > 0 && !['Ca2+', 'Mg2+', 'Ba2+', 'Sr2+'].includes(formatFormula({ ...parsedIon, phase: null }, 'text'))) {
      notes.push(`Die Hydrolyse von ${formatFormula(parsedIon)} wird nicht berücksichtigt.`);
    }
  };

  // an ion typed alone stands for its salt: a counter-ion that takes no part keeps the solution neutral
  const counterion = (charge) => {
    spectators.push({ label: 'Gegenion', charge: -charge, c, source: 'salt' });
    assumptions.push('Ein einzelnes Ion wird mit einem unbeteiligten Gegenion (z. B. Na⁺ oder Cl⁻) gerechnet.');
  };

  // user constants: a generic acid HA or base B
  if (constants.pKa || constants.pKb) {
    const pKa = constants.pKa ? constants.pKa : [14 - constants.pKb];
    const isBaseInput = !constants.pKa;
    // the given constant belongs to a base B (then its acid is BH+) or to an acid HA
    addSystem({ top: isBaseInput ? protonated(sub.formula) : sub.formula, pKa }, c, isBaseInput ? 1 : 0);
    if (sub.formula.charge !== 0) counterion(sub.formula.charge);
    return { systems, spectators, notes, assumptions, kind: isBaseInput ? 'weakBase' : 'weakAcid', given: { label: sub.label, pKa } };
  }

  // the ions of water itself
  if (formatFormula({ ...sub.formula, phase: null }) === 'H+') {
    spectators.push({ label: 'Anion', charge: -1, c, source: 'strong' });
    return { systems, spectators, notes, assumptions, kind: 'strongAcid', given: { label: 'H3O+' } };
  }
  if (formatFormula({ ...sub.formula, phase: null }) === 'OH-') {
    spectators.push({ label: 'Kation', charge: 1, c, source: 'strong' });
    return { systems, spectators, notes, assumptions, kind: 'strongBase', given: { label: 'OH-' } };
  }

  if (sub.formula.charge === 0 && ab && ab.strong && !(ab.pKa && ab.pKa.length && ab.pKa[0] !== null) && !(ab.pKa && ab.pKa[0] === null)) {
    // a strong monoprotic acid: its anion is a spectator
    const anion = conjugateBase(sub.formula);
    const label = anion ? formatFormula(anion.parsed) : `${sub.label}⁻`;
    spectators.push({ label, charge: -1, c, source: 'strong' });
    return { systems, spectators, notes, assumptions, kind: 'strongAcid', given: { label: sub.label } };
  }
  if (ab && ab.strong && ab.pKa && ab.pKa[0] === null) {
    bring(sub.formula, 1, 'strong');
    return { systems, spectators, notes, assumptions, kind: 'strongAcid', given: { label: sub.label } };
  }
  if (ab && ab.strongBase) {
    const ions = entry.ions || [];
    const cation = ions.find((i) => i.formula !== 'OH-');
    if (cation) spectators.push({ label: cation.formula, charge: parseFormula(cation.formula).charge, c: c * cation.n, source: 'strong' });
    else spectators.push({ label: 'Kation', charge: ab.strongBase, c, source: 'strong' });
    return { systems, spectators, notes, assumptions, kind: 'strongBase', given: { label: sub.label } };
  }
  if (ab && (ab.pKa || ab.pKb !== undefined)) {
    const found = bring(sub.formula, 1);
    if (found) {
      if (sub.formula.charge !== 0) counterion(sub.formula.charge);
      const kind = found.k > 0 ? 'weakBase' : sub.formula.charge > 0 ? 'cationAcid' : 'weakAcid';
      return { systems, spectators, notes, assumptions, kind, given: { label: sub.label } };
    }
  }
  // a salt or an ion: dissolves into its ions
  if (entry && entry.ions) {
    let anyWeak = false;
    for (const ion of entry.ions) {
      const parsed = parseFormula(ion.formula);
      if (parsed.charge === 0) continue;
      if (parsed.electron) continue;
      if (ion.formula === 'OH-') continue;
      const weak = bring(parsed, ion.n);
      if (weak) anyWeak = true;
      else spectate(parsed, ion.n, 'salt');
    }
    return { systems, spectators, notes, assumptions, kind: anyWeak ? 'salt' : 'neutralSalt', given: { label: sub.label } };
  }
  if (sub.formula.charge !== 0) {
    if (bring(sub.formula, 1)) {
      counterion(sub.formula.charge);
      return { systems, spectators, notes, assumptions, kind: 'salt', given: { label: sub.label } };
    }
    spectate(sub.formula, 1, 'ion');
    counterion(sub.formula.charge);
    return { systems, spectators, notes, assumptions, kind: 'neutralSalt', given: { label: sub.label } };
  }
  fail('CHEM_DATA_UNAVAILABLE', `Für ${sub.label} sind keine Säure-Base-Daten gespeichert. Gib eine Konstante an, z. B. pKa=4,76 oder pKb=4,75.`, { substance: sub.label });
}

const sameSpecies = (a, b) => {
  if (a.charge !== b.charge) return false;
  const keys = new Set([...Object.keys(a.atoms), ...Object.keys(b.atoms)]);
  for (const k of keys) if ((a.atoms[k] || 0) !== (b.atoms[k] || 0)) return false;
  return true;
};

/** A species whose DB pKa list only covers part of its family (HCO3- has [10.33]; H2CO3 has [6.35, 10.33]) */
const isLevelOfHigher = (s) => {
  const up = conjugateAcid(s.parsed);
  return !!(up && up.acidBase && up.acidBase.pKa && up.acidBase.pKa.length);
};

/** Entry-like object for a base given by pKb only (pyridine): its conjugate acid with pKa = 14 − pKb */
function fromPkb(parsed) {
  const e = SUBSTANCES.find((s) => sameSpecies(s.parsed, parsed) && s.acidBase && s.acidBase.pKb !== undefined);
  if (!e) return null;
  const acid = protonated(parsed);
  return { entry: { parsed: acid, acidBase: { pKa: [14 - e.acidBase.pKb] } }, k: 1 };
}

/** The formula plus one proton */
export function protonated(parsed) {
  const atoms = { ...parsed.atoms, H: (parsed.atoms.H || 0) + 1 };
  return { ...parsed, atoms, isotopes: {}, hydrate: [], charge: parsed.charge + 1, ast: rebuildAst(atoms), phase: null };
}

/** Charge balance of a solution at [H⁺] = h (mol/L); positive when there is a surplus of positive charge */
function balanceAt(h, systems, spectators, Kw) {
  let sum = h - Kw / h;
  for (const s of spectators) sum += s.charge * s.c;
  for (const s of systems) {
    const alpha = fractions(h, s.pKa, s.strongFirst);
    let mean = 0;
    alpha.forEach((a, k) => {
      mean += a * (s.z - k);
    });
    sum += s.C * mean;
  }
  return sum;
}

/**
 * Solves the solution: { h, pH, oh, pOH, species: [{ label, formula, c }], iterations }.
 * There is exactly one positive root (the balance rises with h); bisection on lg h finds it.
 */
export function solveSolution(systems, spectators, Kw = KW_25) {
  let lo = -22;
  let hi = 4;
  if (balanceAt(10 ** lo, systems, spectators, Kw) > 0 || balanceAt(10 ** hi, systems, spectators, Kw) < 0) fail('CHEM_OUTSIDE_MODEL', 'Die Konzentrationen liegen außerhalb des Bereichs, in dem die Rechnung gilt.');
  let iterations = 0;
  while (hi - lo > 1e-14 && iterations < 200) {
    const mid = (lo + hi) / 2;
    if (balanceAt(10 ** mid, systems, spectators, Kw) < 0) lo = mid;
    else hi = mid;
    iterations++;
  }
  const x = (lo + hi) / 2;
  const h = 10 ** x;
  const species = [];
  for (const s of systems) {
    const alpha = fractions(h, s.pKa, s.strongFirst);
    alpha.forEach((a, k) => {
      if (a === 0) return;
      const formula = deprotonated(s.top, k);
      species.push({ label: formatFormula(formula, 'text'), formula, c: a * s.C, alpha: a, system: s.key, k });
    });
  }
  const oh = Kw / h;
  return { h, pH: -x, oh, pOH: -lg(oh), Kw, species, iterations };
}

// ------------------------------------------------------------------------------------------ components

/** One component of a solution: { sub, c (mol/L) or n (mol) and V (L), text } */
export function componentOf(text, defaults = {}) {
  const g = parseGiven(text);
  if (!g.substance) fail('CHEM_SYNTAX', `„${text}“: es fehlt der Stoff (z. B. HCl 0,1 mol/L).`);
  const sub = resolveAcidBase(g.substance, defaults);
  const conc = g.quantities.find((q) => q.is('concentration'));
  const vol = g.quantities.find((q) => q.is('volume'));
  const rest = g.quantities.filter((q) => q !== conc && q !== vol);
  const comp = { sub, text, sigFigs: minSig(g.quantities) };
  if (conc && !vol && !rest.length) {
    comp.c = conc.in('mol/L');
    comp.quantities = [conc];
    return comp;
  }
  if (vol) comp.V = vol.in('L');
  if (!conc && !rest.length && vol) fail('CHEM_MISSING_CONSTANT', `Für ${sub.label} fehlt die Konzentration oder die Stoffmenge.`);
  // amount from concentration·volume, mass or amount
  const withoutVolumeOnly = [...(conc ? [conc] : []), ...rest, ...(vol && (conc || rest.some((q) => q.is('mass') || q.is('amount'))) ? [vol] : [])];
  const a = amountFrom(sub, conc ? [conc, vol].filter(Boolean) : rest, defaults.conditions || {});
  comp.n = a.n;
  comp.steps = a.steps;
  comp.quantities = g.quantities;
  return comp;
}

function resolveAcidBase(text, defaults) {
  try {
    return resolve(text);
  } catch (e) {
    if (['CHEM_UNKNOWN_SUBSTANCE', 'CHEM_UNKNOWN_ELEMENT', 'CHEM_FORMULA_INVALID'].includes(e.code) && (defaults.pKa || defaults.pKb)) {
      // "HA" or "B": a substance for which the constant is given
      const label = text.trim();
      const el = (symbol, n = 1) => ({ type: 'el', symbol, n, mass: null });
      // HA, H2A, H3A: n protons and a residue A
      const rest = /^H(\d*)([A-Za-z].*)$/.exec(label);
      const protons = rest ? Number(rest[1] || 1) : 1;
      const parsed = defaults.pKa
        ? (rest
            ? { input: label, atoms: { H: protons, [rest[2]]: 1 }, isotopes: {}, charge: 0, hydrate: [], phase: null, ast: [el('H', protons), el(rest[2])], generic: label }
            : { input: label, atoms: { H: 1, [label]: 1 }, isotopes: {}, charge: 0, hydrate: [], phase: null, ast: [el('H'), el(label)], generic: label })
        : { input: label, atoms: { [label]: 1 }, isotopes: {}, charge: 0, hydrate: [], phase: null, ast: [el(label)], generic: label };
      return { formula: parsed, entry: null, M: NaN, terms: [], notes: [], phase: null, label, input: label, generic: true };
    }
    throw e;
  }
}

/** pKa list from options: pKa=4,76 · pKa=2,15/7,2/12,35 · Ka=1,8e-5 · pKb=4,75 · Kb=1,8e-5 */
export function constantsFrom(options) {
  const out = {};
  const num = (t) => {
    const v = Number(String(t).trim().replace(',', '.').replace(/[·×]\s*10\^?/, 'e'));
    if (!Number.isFinite(v)) fail('CHEM_SYNTAX', `„${t}“ ist keine Zahl.`);
    return v;
  };
  if (options.pKa !== undefined) out.pKa = String(options.pKa).split('/').map(num);
  else if (options.Ka !== undefined) out.pKa = String(options.Ka).split('/').map((t) => -lg(num(t)));
  if (options.pKb !== undefined) out.pKb = num(options.pKb);
  else if (options.Kb !== undefined) out.pKb = -lg(num(options.Kb));
  if (out.pKa && out.pKb !== undefined) fail('CHEM_SYNTAX', 'Bitte entweder eine Säure- oder eine Basenkonstante angeben, nicht beide.');
  return out;
}

// ------------------------------------------------------------------------------------------ the pH command

const KIND_TITLE = {
  strongAcid: 'pH einer starken Säure',
  strongBase: 'pH einer starken Base',
  weakAcid: 'pH einer schwachen Säure',
  cationAcid: 'pH einer Kationsäure',
  weakBase: 'pH einer schwachen Base',
  salt: 'pH einer Salzlösung',
  neutralSalt: 'pH einer Salzlösung',
  mixture: 'pH einer Lösung',
  buffer: 'pH eines Puffers',
};

/**
 * pH of a solution from its components (texts like "HCl 0,1 mol/L" or "CH3COOH: 0,1 mol/L 50 mL").
 * options: { T (temperature), pKa, Ka, pKb, Kb, V (final volume) }.
 */
export function phOfSolution(componentTexts, options = {}, forceKind) {
  const constants = constantsFrom(options);
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  const { Kw, pKw, interpolated } = kwAt(T);
  const res = new ChemicalResult('ph', 'pH-Wert');
  if (!componentTexts.length) fail('CHEM_SYNTAX', 'Es fehlt ein Stoff mit Konzentration, z. B. pH(HCl; 0,01 mol/L).');
  const components = componentTexts.map((t, i) => componentOf(t, { ...constants, conditions: {} }));
  if (constants.pKa || constants.pKb) {
    if (components.length > 1 && !components.every((c) => c.sub.generic || c.sub.entry)) fail('CHEM_SYNTAX', 'Eine eigene Konstante gilt für einen Stoff; bei mehreren Stoffen fehlen die Daten der anderen.');
  }

  // concentrations in the mixture
  const withVolume = components.filter((c) => c.V !== undefined);
  let finalVolume = null;
  if (options.V !== undefined) finalVolume = Quantity.parse(options.V).need('volume', 'das Endvolumen').in('L');
  else if (withVolume.length) {
    if (withVolume.length !== components.length) fail('CHEM_MISSING_CONSTANT', 'Wenn ein Stoff mit Volumen angegeben ist, brauchen alle Stoffe ein Volumen (oder gib das Endvolumen mit V=… an).');
    finalVolume = withVolume.reduce((s, c) => s + c.V, 0);
    res.assume('Die Volumina der gemischten Lösungen werden addiert.');
  }
  for (const c of components) {
    if (c.n !== undefined) {
      if (finalVolume === null) fail('CHEM_MISSING_CONSTANT', `Für ${c.sub.label} fehlt das Volumen der Lösung.`);
      c.conc = c.n / finalVolume;
      for (const s of c.steps || []) if (!/Konzentration und Volumen/.test(s.label)) res.steps.push(s);
      if (components.length > 1 || withVolume.length) res.step(`Konzentration von ${c.sub.label} in der Mischung`, L(`c = \\frac{n}{V_{\\mathrm{ges}}} = \\frac{${fmtL(c.n)}\\,\\mathrm{mol}}{${fmtL(finalVolume)}\\,\\mathrm{L}} = ${fmtL(c.conc)}\\,\\mathrm{mol/L}`, `c = n/V(ges) = ${fmt(c.n)} mol / ${fmt(finalVolume)} L = ${fmt(c.conc)} mol/L`));
    } else c.conc = c.c;
    if (!(c.conc >= 0)) fail('CHEM_NEGATIVE_CONCENTRATION', `Die Konzentration von ${c.sub.label} ist negativ.`);
  }

  // systems and spectators
  const systems = [];
  const spectators = [];
  const notes = [];
  const kinds = [];
  const usedConstants = components.length === 1 ? constants : {};
  for (const comp of components) {
    const s = systemsOf(comp.sub, comp.conc, usedConstants);
    kinds.push(s.kind);
    notes.push(...s.notes);
    for (const a of s.assumptions) res.assume(a);
    for (const sys of s.systems) {
      const existing = systems.find((x) => x.key === sys.key);
      if (existing) {
        existing.C += sys.C;
        existing.contributions.push(...sys.contributions);
      } else systems.push(sys);
    }
    spectators.push(...s.spectators);
  }
  for (const n of notes) res.warn('CHEM_OUTSIDE_MODEL', n);
  res.assume('Ideale Lösung: Aktivitäten werden gleich den Konzentrationen gesetzt.');
  if (Math.abs(T - DEFAULT_TEMPERATURE) > 1e-9) {
    res.assume(`Ionenprodukt des Wassers bei ${fmt(T - 273.15)} °C: pKw = ${fmt(pKw)}${interpolated ? ' (zwischen Tabellenwerten interpoliert)' : ''}.`);
    if (systems.length) res.warn('CHEM_OUTSIDE_MODEL', 'Die gespeicherten pKa-Werte gelten bei 25 °C; bei anderen Temperaturen ist der Wert ungenau.');
  } else res.assume('25 °C, Kw = 1·10⁻¹⁴ mol²/L².');

  const kind = forceKind || (components.length > 1 ? (systems.some((s) => s.contributions.length > 1) ? 'buffer' : 'mixture') : kinds[0]);
  res.title = KIND_TITLE[kind] || 'pH-Wert';

  // the exact solution
  const sol = solveSolution(systems, spectators, Kw);
  const pH = sol.pH;

  // ------------- steps
  for (const comp of components) {
    if (comp.sub.entry && comp.sub.entry.acidBase) res.source(`Säurekonstanten ${comp.sub.label}: CRC Handbook, 25 °C`);
  }
  const strongAcid = spectators.filter((s) => s.source === 'strong' && s.charge < 0);
  const strongBase = spectators.filter((s) => s.source === 'strong' && s.charge > 0);
  const single = components.length === 1 ? components[0] : null;
  const c0 = single ? single.conc : null;

  if (single && kind === 'strongAcid') {
    const c = single.conc;
    const approx = -lg(c);
    res.step('Vollständige Protolyse', L(`\\mathrm{HA} + \\mathrm{H_2O} \\rightarrow \\mathrm{H_3O^+} + \\mathrm{A^-}\\quad\\Rightarrow\\quad c(\\mathrm{H_3O^+}) = c_0 = ${fmtL(c)}\\,\\mathrm{mol/L}`, `HA + H2O -> H3O+ + A-  =>  c(H3O+) = c0 = ${fmt(c)} mol/L`));
    res.step('Näherung', L(`\\mathrm{pH} = -\\lg c(\\mathrm{H_3O^+}) = -\\lg ${fmtL(c)} = ${fmtL(approx, 4)}`, `pH = -lg c = ${fmt(approx)}`));
    if (Math.abs(approx - pH) > 0.005) res.step('Autoprotolyse des Wassers', L(`\\text{Bei so kleiner Konzentration liefert das Wasser merklich H}_3\\text{O}^+\\text{: } c(\\mathrm{H_3O^+}) = \\frac{c_0}{2} + \\sqrt{\\frac{c_0^2}{4} + K_w} = ${fmtL(sol.h)}\\,\\mathrm{mol/L}`, `Bei so kleiner Konzentration liefert das Wasser merklich H3O+: c(H3O+) = c0/2 + sqrt(c0²/4 + Kw) = ${fmt(sol.h)} mol/L`));
  } else if (single && kind === 'strongBase') {
    const ions = single.sub.entry.ions || [];
    const oh = ions.find((i) => i.formula === 'OH-');
    const k = oh ? oh.n : 1;
    const cOH = k * single.conc;
    const approx = pKw + lg(cOH);
    res.step('Vollständige Protolyse', L(`c(\\mathrm{OH^-}) = ${k} \\cdot c_0 = ${fmtL(cOH)}\\,\\mathrm{mol/L}`, `c(OH-) = ${k} · c0 = ${fmt(cOH)} mol/L`));
    res.step('Näherung', L(`\\mathrm{pOH} = -\\lg c(\\mathrm{OH^-}) = ${fmtL(-lg(cOH))}\\;\\Rightarrow\\; \\mathrm{pH} = ${fmtL(pKw)} - \\mathrm{pOH} = ${fmtL(approx)}`, `pOH = ${fmt(-lg(cOH))} => pH = ${fmt(pKw)} - pOH = ${fmt(approx)}`));
    if (Math.abs(approx - pH) > 0.005) res.step('Autoprotolyse des Wassers', L(`\\text{Bei so kleiner Konzentration ist die Autoprotolyse nicht zu vernachlässigen (exakt: pH = }${fmtL(pH)}\\text{).}`, `Bei so kleiner Konzentration ist die Autoprotolyse nicht zu vernachlässigen (exakt: pH = ${fmt(pH)}).`));
  } else if (single && systems.length === 1 && systems[0].pKa.length === 1 && !spectators.some((s) => s.source === 'strong')) {
    const sys = systems[0];
    const pKa = sys.pKa[0];
    const Ka = 10 ** -pKa;
    const c = sys.C;
    const contribution = sys.contributions[0].k;
    const acidForm = formatFormula(sys.top, 'latex');
    const baseForm = formatFormula(deprotonated(sys.top, 1), 'latex');
    if (contribution === 0) {
      // the weak acid itself
      res.step('Säurekonstante', L(`K_a = ${fmtL(Ka)}\\,\\mathrm{mol/L}\\quad (\\mathrm{p}K_a = ${fmtL(pKa)})`, `Ka = ${fmt(Ka)} mol/L (pKa = ${fmt(pKa)})`));
      res.step('Massenwirkungsgesetz', L(`K_a = \\frac{c(\\mathrm{H_3O^+})\\cdot c(${baseForm})}{c(${acidForm})} = \\frac{x^2}{c_0 - x}`, `Ka = c(H3O+)·c(A-)/c(HA) = x²/(c0 - x)`));
      const x = (-Ka + Math.sqrt(Ka * Ka + 4 * Ka * c)) / 2;
      res.step('Quadratische Gleichung (Wasser vernachlässigt)', L(`x = \\frac{-K_a + \\sqrt{K_a^2 + 4K_a c_0}}{2} = ${fmtL(x)}\\,\\mathrm{mol/L}\\;\\Rightarrow\\; \\mathrm{pH} = ${fmtL(-lg(x))}`, `x = (-Ka + sqrt(Ka² + 4·Ka·c0))/2 = ${fmt(x)} mol/L => pH = ${fmt(-lg(x))}`));
      const approx = 0.5 * (pKa - lg(c));
      const alpha = sol.h / c;
      const ok = c / Ka >= 100 && alpha < 0.05;
      res.step('Schulnäherung', L(`\\mathrm{pH} \\approx \\frac{1}{2}(\\mathrm{p}K_a - \\lg c_0) = ${fmtL(approx)}\\quad(${ok ? '\\text{zulässig}' : '\\text{hier nicht zulässig}'})`, `pH ≈ (pKa - lg c0)/2 = ${fmt(approx)} (${ok ? 'zulässig' : 'hier nicht zulässig'})`));
      if (!ok) res.warn('CHEM_OUTSIDE_MODEL', `Die Näherung pH ≈ ½(pKa − lg c) ist hier nicht zulässig (c/Ka = ${fmt(c / Ka)}); die exakte Lösung wird benutzt.`);
      res.value('Protolysegrad α', new Quantity(alpha, ''));
    } else {
      // the weak base: the given form has lost k protons
      const pKb = pKw - pKa;
      const Kb = 10 ** -pKb;
      res.step('Basenkonstante', L(`\\mathrm{p}K_b = \\mathrm{p}K_w - \\mathrm{p}K_a = ${fmtL(pKw)} - ${fmtL(pKa)} = ${fmtL(pKb)}`, `pKb = pKw - pKa = ${fmt(pKw)} - ${fmt(pKa)} = ${fmt(pKb)}`));
      const x = (-Kb + Math.sqrt(Kb * Kb + 4 * Kb * c)) / 2;
      res.step('Quadratische Gleichung (Wasser vernachlässigt)', L(`c(\\mathrm{OH^-}) = \\frac{-K_b + \\sqrt{K_b^2 + 4K_b c_0}}{2} = ${fmtL(x)}\\,\\mathrm{mol/L}\\;\\Rightarrow\\; \\mathrm{pH} = ${fmtL(pKw)} - ${fmtL(-lg(x))} = ${fmtL(pKw + lg(x))}`, `c(OH-) = ${fmt(x)} mol/L => pH = ${fmt(pKw)} - ${fmt(-lg(x))} = ${fmt(pKw + lg(x))}`));
      const approx = pKw - 0.5 * (pKb - lg(c));
      const ok = c / Kb >= 100;
      res.step('Schulnäherung', L(`\\mathrm{pH} \\approx ${fmtL(pKw)} - \\frac{1}{2}(\\mathrm{p}K_b - \\lg c_0) = ${fmtL(approx)}\\quad(${ok ? '\\text{zulässig}' : '\\text{hier nicht zulässig}'})`, `pH ≈ ${fmt(pKw)} - (pKb - lg c0)/2 = ${fmt(approx)} (${ok ? 'zulässig' : 'hier nicht zulässig'})`));
      if (!ok) res.warn('CHEM_OUTSIDE_MODEL', `Die Näherung ist hier nicht zulässig (c/Kb = ${fmt(c / Kb)}); die exakte Lösung wird benutzt.`);
      res.value('Protolysegrad α', new Quantity(sol.oh / c, ''));
    }
  } else if (kind === 'buffer') {
    const sys = systems.find((s) => s.contributions.length > 1);
    const parts = [...sys.contributions].sort((a, b) => a.k - b.k);
    // acid = fewer protons removed
    const acid = parts[0];
    const base = parts[parts.length - 1];
    if (parts.length === 2 && base.k === acid.k + 1 && acid.c > 0 && base.c > 0) {
      const pKa = sys.pKa[acid.k];
      const ratio = base.c / acid.c;
      const hh = pKa + lg(ratio);
      const valid = ratio >= 0.1 && ratio <= 10 && Math.abs(hh - pH) <= 0.05 && !strongAcid.length && !strongBase.length;
      res.step('Henderson-Hasselbalch-Gleichung', L(`\\mathrm{pH} = \\mathrm{p}K_a + \\lg\\frac{c(\\text{Base})}{c(\\text{Säure})} = ${fmtL(pKa)} + \\lg\\frac{${fmtL(base.c)}}{${fmtL(acid.c)}} = ${fmtL(hh)}\\quad(${valid ? '\\text{gültig}' : '\\text{hier nicht gültig}'})`, `pH = pKa + lg(c(Base)/c(Säure)) = ${fmt(pKa)} + lg(${fmt(base.c)}/${fmt(acid.c)}) = ${fmt(hh)} (${valid ? 'gültig' : 'hier nicht gültig'})`));
      res.value('pH nach Henderson-Hasselbalch', new Quantity(hh, ''));
      if (valid) res.value('Pufferkapazität-Bereich', { text: `pKa ± 1 = ${fmt(pKa - 1)} … ${fmt(pKa + 1)}` });
      else res.warn('CHEM_OUTSIDE_MODEL', `Die Henderson-Hasselbalch-Gleichung gilt hier nicht (${ratio < 0.1 || ratio > 10 ? 'Verhältnis Base : Säure außerhalb 1 : 10 bis 10 : 1' : 'die Näherung weicht mehr als 0,05 vom exakten Wert ab'}); es gilt der exakte Wert.`);
    }
  } else if (systems.length) {
    res.step('Säure-Base-Systeme', ...systems.map((s) => L(`${formatFormula(s.top, 'latex')}:\\ \\mathrm{p}K_a = ${s.pKa.map((p) => fmtL(p)).join(';\\ ')},\\ C = ${fmtL(s.C)}\\,\\mathrm{mol/L}`, `${formatFormula(s.top)}: pKa = ${s.pKa.map((p) => fmt(p)).join('; ')}, C = ${fmt(s.C)} mol/L`)));
  }

  res.step('Ladungsbilanz (exakt)', L('c(\\mathrm{H_3O^+}) + \\sum_{\\text{Kationen}} z\\,c = c(\\mathrm{OH^-}) + \\sum_{\\text{Anionen}} |z|\\,c', 'c(H3O+) + Σ(Kationen) = c(OH-) + Σ(Anionen)'), L(`c(\\mathrm{H_3O^+}) = ${fmtL(sol.h)}\\,\\mathrm{mol/L}\\quad(${sol.iterations}\\ \\text{Halbierungen})`, `c(H3O+) = ${fmt(sol.h)} mol/L`));
  res.step('Ergebnis', L(`\\mathrm{pH} = -\\lg c(\\mathrm{H_3O^+}) = ${fmtL(pH, 4)},\\quad \\mathrm{pOH} = ${fmtL(sol.pOH, 4)}`, `pH = -lg c(H3O+) = ${fmt(pH)}, pOH = ${fmt(sol.pOH)}`));

  res.answer(new Quantity(pH, ''), { name: 'pH' });
  res.result.latex = `\\mathrm{pH} = ${fmtL(pH, 4)}`;
  res.display = { sig: 4, decimals: null };
  res.value('pOH', new Quantity(sol.pOH, ''));
  res.value('c(H3O⁺)', new Quantity(sol.h, 'mol/L'));
  res.value('c(OH⁻)', new Quantity(sol.oh, 'mol/L'));
  for (const sp of sol.species) res.value(`c(${formatFormula(sp.formula, 'unicode')})`, new Quantity(sp.c, 'mol/L'));
  res.chemistry = { pH, h: sol.h, oh: sol.oh, pKw, T, species: sol.species.map((s) => ({ label: s.label, c: s.c, alpha: s.alpha })), kind };
  const sig = minSig(components.map((c) => ({ sigFigs: c.sigFigs })));
  res.sig = sig;
  return res;
}

/** pH from the command arguments: pH(HCl; 0,01 mol/L; T=25 °C) or pH(0,001 mol/L) or pH(HCl 0,01 mol/L; NaCl …) */
export function phFromArgs(args, kind) {
  const { positional, options } = parseArgs(args);
  // pH(0,001 mol/L): the concentration of H3O+ itself
  if (positional.length === 1 && /^[-+]?[\d.,]+(?:[eE][-+]?\d+)?\s*(?:mol\/L|M|mmol\/L|mM|µmol\/L)$/.test(positional[0]) && !options.pKa && !options.pKb && !options.Ka && !options.Kb) {
    return phOfSolution([`H+ ${positional[0]}`], options);
  }
  // pH(HCl; 0,01 mol/L): substance and quantity in two arguments
  const merged = mergeSubstanceArgs(positional);
  return phOfSolution(merged, options, kind);
}

/** "HCl; 0,01 mol/L" → ["HCl 0,01 mol/L"]; "HCl 0,01 mol/L; NaOH 0,01 mol/L" stays two components */
export function mergeSubstanceArgs(positional) {
  const out = [];
  for (const arg of positional) {
    if (out.length && /^[-+]?[\d.,]/.test(arg) && !/^[-+]?[\d.,]+(?:[eE][-+]?\d+)?\s*[A-Za-zµ°%/·^0-9-]*\s+\S+/.test(arg) === false) {
      // a bare quantity continues the previous component
      out[out.length - 1] += ' ' + arg;
    } else if (out.length && /^[-+]?[\d.,]+(?:[eE][-+]?\d+)?\s*[A-Za-zµ°/·^0-9-]+$/.test(arg)) {
      out[out.length - 1] += ' ' + arg;
    } else out.push(arg);
  }
  return out;
}

export { parseFormula, resolveParsed, latexOf };

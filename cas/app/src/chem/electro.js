// Electrochemistry: the standard potentials of the redox series, the voltage of a galvanic cell, the Nernst equation
// for half-cells and cells, and Faraday's laws for electrolysis. Potentials are for the reduction direction against the
// standard hydrogen electrode at 25 °C; a cell's cathode is the couple with the higher potential.

import redoxData from './data/redox.json' with { type: 'json' };
import { ChemicalResult, L } from './result.js';
import { parseReaction, speciesOf, formatReaction, balanceCheck } from './reaction.js';
import { parseFormula, formatFormula, formulaKey } from './formula.js';
import { resolve, resolveParsed, latexOf, parseGiven, amountFrom, conditionsFrom } from './amounts.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { CONSTANTS, DEFAULT_TEMPERATURE } from './constants.js';
import { kwAt } from './acidbase.js';
import { Frac } from './rational.js';
import { constantFromLn } from './numeric.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';

const { R, F } = { R: CONSTANTS.R.value, F: CONSTANTS.F.value };
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });
const keyOf = (f) => formulaKey({ ...f, phase: null });

export const REDOX_DATA = { version: redoxData.version, source: redoxData.source, reference: redoxData.reference, temperature: redoxData.temperature };

/** The couples: { pair, E0, oxidized: [{formula, coef}], reduced: [...], electrons n, basic } */
export const COUPLES = redoxData.halfReactions.map((h) => {
  const r = parseReaction(h.reduction);
  const electron = r.reactants.find((t) => t.formula.electron);
  const n = electron ? Number(electron.coef ? electron.coef.n : 1n) : 0;
  const toNum = (c) => (c ? Number(c.n) / Number(c.d) : 1);
  return Object.freeze({
    pair: h.pair,
    E0: h.E0,
    n,
    oxidized: r.reactants.filter((t) => !t.formula.electron).map((t) => ({ formula: t.formula, coef: toNum(t.coef) })),
    reduced: r.products.map((t) => ({ formula: t.formula, coef: toNum(t.coef) })),
    reduction: h.reduction,
    basic: /basisch|OH-/.test(h.pair + h.reduction),
  });
});

const isMetalOrGas = (f) => Object.keys(f.atoms).length === 1 && f.charge === 0;

/**
 * A couple by pair name ("Zn2+/Zn"), by the metal ("Zn"), by its ion ("Zn2+"), or by a gas ("Cl2"). Returns the couple.
 */
export function findCouple(text) {
  const raw = String(text).trim();
  const norm = raw.replace(/\s+/g, '').replace(/\|/g, '/');
  const direct = COUPLES.find((c) => c.pair.replace(/\s+/g, '') === norm || c.pair.replace(/\s+/g, '').replace(/\^/g, '') === norm.replace(/\^/g, ''));
  if (direct) return direct;
  // the reversed writing Zn/Zn2+
  const parts = norm.split('/');
  if (parts.length === 2) {
    const reversed = COUPLES.find((c) => c.pair.replace(/\s+/g, '') === `${parts[1]}/${parts[0]}`);
    if (reversed) return reversed;
  }
  let f;
  try {
    f = parseFormula(raw);
  } catch (e) {
    fail('CHEM_UNKNOWN_SUBSTANCE', `„${raw}“ ist kein Redoxpaar der Spannungsreihe (Beispiele: Zn2+/Zn, Cu, Cl2).`, { couple: raw });
  }
  const key = keyOf(f);
  const holds = (list) => list.some((x) => keyOf(x.formula) === key);
  const candidates = COUPLES.filter((c) => (holds(c.reduced) || holds(c.oxidized)) && !c.basic);
  const matches = COUPLES.filter((c) => holds(c.reduced) || holds(c.oxidized));
  const pool = candidates.length ? candidates : matches;
  if (!pool.length) fail('CHEM_DATA_UNAVAILABLE', `Für ${raw} ist kein Standardpotential gespeichert.`, { couple: raw });
  // the simplest couple: two-electron metal ions first, then the smallest charge
  const score = (c) => Math.abs(c.n - 2) * 10 + c.pair.length / 100;
  if (isMetalOrGas(f) || f.charge !== 0) return [...pool].sort((a, b) => score(a) - score(b))[0];
  return [...pool].sort((a, b) => score(a) - score(b))[0];
}

const couplePairLatex = (c) => {
  const ox = c.oxidized[0].formula;
  const red = c.reduced[0].formula;
  return `${formatFormula({ ...ox, phase: null }, 'latex')}\\,/\\,${formatFormula({ ...red, phase: null }, 'latex')}`;
};

// -------------------------------------------------------------------------------------------- Nernst

/** Activities of the species of a couple from the givens: { key → activity } (default 1) */
function activitiesFor(couples, givens, options, T) {
  const act = new Map();
  const notes = [];
  const known = new Set(couples.flatMap((c) => [...c.oxidized, ...c.reduced].map((x) => keyOf(x.formula))));
  for (const text of givens) {
    const g = parseGiven(text);
    if (!g.substance) fail('CHEM_SYNTAX', `„${text}“: es fehlt der Stoff, z. B. c(Cu2+) = 0,01 mol/L.`);
    const f = resolve(g.substance).formula;
    const q = g.quantities[0];
    const k = keyOf(f);
    if (!known.has(k)) fail('CHEM_UNKNOWN_SUBSTANCE', `${g.substance} kommt in den Halbzellen nicht vor.`, { substance: g.substance });
    if (q.is('concentration')) act.set(k, q.in('mol/L'));
    else if (q.is('pressure')) act.set(k, q.in('bar'));
    else fail('CHEM_UNIT_MISMATCH', `Für ${g.substance} wird eine Konzentration oder ein Druck erwartet.`);
  }
  if (options.pH !== undefined) {
    const pH = Number(String(options.pH).replace(',', '.'));
    if (!Number.isFinite(pH)) fail('CHEM_SYNTAX', 'pH muss eine Zahl sein.');
    const { pKw } = kwAt(T);
    act.set('H+', 10 ** -pH);
    act.set('OH-', 10 ** (pH - pKw));
    notes.push(`pH = ${fmt(pH)}: c(H⁺) = ${fmt(10 ** -pH)} mol/L.`);
  }
  return { act, notes };
}

/** Reaction quotient of a half-reaction in the reduction direction: Π a(red)^ν / Π a(ox)^ν; solids and liquids count 1 */
function quotient(c, act) {
  let q = 1;
  const a = (x) => {
    const f = x.formula;
    const k = keyOf(f);
    const phase = f.phase || (isSolidOrLiquid(f) ? 's' : null);
    if (phase === 's' || phase === 'l') return 1;
    return act.has(k) ? act.get(k) : 1;
  };
  for (const x of c.reduced) q *= a(x) ** x.coef;
  for (const x of c.oxidized) q /= a(x) ** x.coef;
  return q;
}

/** Metals and water are solids/liquids at the electrode; solutes and gases are not */
function isSolidOrLiquid(f) {
  if (f.charge !== 0) return false;
  const key = keyOf(f);
  if (key === 'H2O') return true;
  const sub = resolveParsed(f);
  if (sub.entry) return sub.entry.phase === 's' || sub.entry.phase === 'l';
  return Object.keys(f.atoms).length === 1 && !['H', 'N', 'O', 'F', 'Cl'].includes(Object.keys(f.atoms)[0]);
}

/** E of a half-cell by the Nernst equation: E = E° − (RT/nF)·ln Q, Q of the reduction */
export function nernstHalf(c, act, T = DEFAULT_TEMPERATURE) {
  const Q = quotient(c, act);
  return { E: c.E0 - ((R * T) / (c.n * F)) * Math.log(Q), Q };
}

/** nernst(Couple; c(Zn2+) = 0,01 mol/L; T=…; pH=…) */
export function nernstFromArgs(args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt das Redoxpaar, z. B. nernst(Cu2+/Cu; c(Cu2+) = 0,01 mol/L).');
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  const c = findCouple(positional[0]);
  const { act, notes } = activitiesFor([c], positional.slice(1), options, T);
  const res = new ChemicalResult('nernst', 'Nernst-Gleichung');
  const { E, Q } = nernstHalf(c, act, T);
  res.step('Halbzelle (Reduktion)', L(formatReaction(reductionAsReaction(c), null, 'latex'), c.reduction));
  res.step('Standardpotential', L(`E^\\circ = ${fmtL(c.E0)}\\,\\mathrm{V}`, `E° = ${fmt(c.E0)} V`));
  const factor = (R * T) / (c.n * F);
  res.step('Nernst-Gleichung', L(`E = E^\\circ - \\frac{R\\,T}{n\\,F}\\,\\ln Q = ${fmtL(c.E0)} - ${fmtL(factor)}\\,\\mathrm{V}\\cdot\\ln ${fmtL(Q)} = ${fmtL(E)}\\,\\mathrm{V}`, `E = E° − (R·T/(n·F))·ln Q = ${fmt(c.E0)} − ${fmt(factor)} V · ln ${fmt(Q)} = ${fmt(E)} V`));
  if (Math.abs(T - DEFAULT_TEMPERATURE) < 1e-9) res.step('Bei 25 °C', L(`E = E^\\circ - \\frac{0{,}0592\\,\\mathrm{V}}{${c.n}}\\,\\lg Q = ${fmtL(c.E0 - (0.05916 / c.n) * Math.log10(Q))}\\,\\mathrm{V}`));
  res.assume('Ideale Lösung: Aktivitäten = Konzentrationen; Gase mit p/p°, reine Feststoffe und Flüssigkeiten mit 1.');
  for (const n of notes) res.assume(n);
  if (Math.abs(T - DEFAULT_TEMPERATURE) > 1e-9) res.assume(`Das Standardpotential gilt bei 25 °C; bei ${fmt(T)} K ist es nur näherungsweise gültig.`);
  res.source(`Standardpotentiale: ${redoxData.source}`);
  res.answer(new Quantity(E, 'V'), { name: 'E' });
  res.value('Q', new Quantity(Q, ''));
  res.value('E°', new Quantity(c.E0, 'V'));
  return res;
}

function reductionAsReaction(c) {
  return parseReaction(c.reduction);
}

// -------------------------------------------------------------------------------------------- galvanic cell

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

/** Sums the reduction of `cat` and the reversed reduction of `an` (electrons matched) into one equation */
function cellReaction(cat, an) {
  const g = gcd(cat.n, an.n);
  const mc = an.n / g;
  const ma = cat.n / g;
  const net = new Map();
  const put = (formula, coef, sign) => {
    const k = keyOf(formula);
    const cur = net.get(k) || { formula, net: 0 };
    cur.net += sign * coef;
    net.set(k, cur);
  };
  // cathode: ox → red (left − right) ; anode: red → ox
  for (const x of cat.oxidized) put(x.formula, x.coef * mc, 1);
  for (const x of cat.reduced) put(x.formula, x.coef * mc, -1);
  for (const x of an.reduced) put(x.formula, x.coef * ma, 1);
  for (const x of an.oxidized) put(x.formula, x.coef * ma, -1);
  const entries = [...net.values()].filter((x) => Math.abs(x.net) > 1e-12);
  // whole numbers
  let scale = 1;
  while (entries.some((x) => Math.abs(x.net * scale - Math.round(x.net * scale)) > 1e-9) && scale < 1000) scale *= 2;
  const ints = entries.map((x) => ({ formula: x.formula, net: Math.round(x.net * scale) }));
  let d = 0;
  for (const x of ints) d = gcd(d, Math.abs(x.net));
  const left = ints.filter((x) => x.net > 0).map((x) => ({ formula: x.formula, coef: x.net / d }));
  const right = ints.filter((x) => x.net < 0).map((x) => ({ formula: x.formula, coef: -x.net / d }));
  const n = (cat.n * mc * scale) / d;
  const reaction = {
    reactants: left.map((x) => ({ coef: new Frac(BigInt(x.coef)), formula: x.formula, text: '' })),
    products: right.map((x) => ({ coef: new Frac(BigInt(x.coef)), formula: x.formula, text: '' })),
    reversible: false,
    arrow: '->',
    source: '',
    hasCoefficients: true,
  };
  return { reaction, n: Number.isInteger(n) ? n : Math.round(n), mc, ma };
}

/** zellspannung(Zn; Cu; c(Zn2+) = 0,1 mol/L; …) */
export function cellFromArgs(args) {
  const { positional, options } = parseArgs(args);
  if (positional.length < 2) fail('CHEM_SYNTAX', 'Es fehlen zwei Redoxpaare, z. B. zellspannung(Zn; Cu) oder zellspannung(Zn2+/Zn; Cu2+/Cu).');
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  const a = findCouple(positional[0]);
  const b = findCouple(positional[1]);
  if (a === b) fail('CHEM_NO_SOLUTION', 'Beide Halbzellen sind dasselbe Redoxpaar: Die Standardzellspannung ist 0 V.');
  const { act, notes } = activitiesFor([a, b], positional.slice(2), options, T);
  const res = new ChemicalResult('cell', 'Galvanische Zelle');
  res.step('Standardpotentiale', L(`E^\\circ(${couplePairLatex(a)}) = ${fmtL(a.E0)}\\,\\mathrm{V},\\quad E^\\circ(${couplePairLatex(b)}) = ${fmtL(b.E0)}\\,\\mathrm{V}`, `E°(${a.pair}) = ${fmt(a.E0)} V, E°(${b.pair}) = ${fmt(b.E0)} V`));
  // the cathode: the higher potential (at the actual concentrations when they are given)
  const useActual = act.size > 0;
  const ea = nernstHalf(a, act, T);
  const eb = nernstHalf(b, act, T);
  const [cat, an] = (useActual ? eb.E >= ea.E : b.E0 >= a.E0) ? [b, a] : [a, b];
  const stdOrder = b.E0 >= a.E0 ? [b, a] : [a, b];
  if (useActual && stdOrder[0] !== cat) res.warn('CHEM_OUTSIDE_MODEL', 'Bei diesen Konzentrationen kehren sich die Elektroden gegenüber dem Standardfall um.');
  const E0cell = cat.E0 - an.E0;
  res.step('Kathode und Anode', L(`\\text{Kathode (Reduktion): ${cat.pair}},\\quad \\text{Anode (Oxidation): ${an.pair}}`, `Kathode (Reduktion): ${cat.pair}, Anode (Oxidation): ${an.pair}`));
  res.step('Standardzellspannung', L(`\\Delta E^\\circ = E^\\circ_{\\mathrm{Kathode}} - E^\\circ_{\\mathrm{Anode}} = ${fmtL(cat.E0)}\\,\\mathrm{V} - (${fmtL(an.E0)}\\,\\mathrm{V}) = ${fmtL(E0cell)}\\,\\mathrm{V}`, `ΔE° = E°(Kathode) − E°(Anode) = ${fmt(cat.E0)} V − (${fmt(an.E0)} V) = ${fmt(E0cell)} V`));
  const cell = cellReaction(cat, an);
  const eq = formatReaction(cell.reaction, cell.reaction.reactants.concat(cell.reaction.products).map((t) => t.coef), 'text');
  const eqL = formatReaction(cell.reaction, cell.reaction.reactants.concat(cell.reaction.products).map((t) => t.coef), 'latex');
  const chk = balanceCheck(cell.reaction);
  if (!chk.balanced) fail('CHEM_UNBALANCED_REACTION', 'Interner Fehler: Die Zellreaktion ist nicht ausgeglichen.');
  res.step('Zellreaktion', L(eqL, eq), L(`z = ${cell.n}\\ \\text{Elektronen}`, `z = ${cell.n} Elektronen`));
  const cellNotation = `${cellSide(an, 'anode')} || ${cellSide(cat, 'cathode')}`;
  res.step('Zelldiagramm', L(`\\text{${cellNotation.replace(/\|\|/g, '} \\,\\|\\!\\|\\, \\text{').replace(/ \| /g, '} \\,|\\, \\text{')}}`, cellNotation));
  const dG0 = -cell.n * F * E0cell;
  const kc = constantFromLn((cell.n * F * E0cell) / (R * T));
  const K = kc.value;
  res.step('Freie Standardreaktionsenthalpie', L(`\\Delta G^\\circ = -z\\,F\\,\\Delta E^\\circ = -${cell.n}\\cdot 96485\\,\\mathrm{C/mol}\\cdot ${fmtL(E0cell)}\\,\\mathrm{V} = ${fmtL(dG0 / 1000)}\\,\\mathrm{kJ/mol}`, `ΔG° = −z·F·ΔE° = ${fmt(dG0 / 1000)} kJ/mol`));
  res.step('Gleichgewichtskonstante', L(`K = \\exp\\left(\\frac{z\\,F\\,\\Delta E^\\circ}{R\\,T}\\right) = ${K === null ? kc.latex : fmtL(K)}`, `K = exp(z·F·ΔE°/(R·T)) = ${K === null ? kc.text : fmt(K)}`));
  let Ecell = E0cell;
  if (useActual) {
    const Ea = cat === a ? ea : eb;
    const Eb = cat === a ? eb : ea;
    Ecell = Ea.E - Eb.E;
    res.step('Nernst-Gleichung für beide Halbzellen', L(`E_{\\mathrm{Kathode}} = ${fmtL(Ea.E)}\\,\\mathrm{V},\\quad E_{\\mathrm{Anode}} = ${fmtL(Eb.E)}\\,\\mathrm{V}\\;\\Rightarrow\\; \\Delta E = ${fmtL(Ecell)}\\,\\mathrm{V}`, `E(Kathode) = ${fmt(Ea.E)} V, E(Anode) = ${fmt(Eb.E)} V => ΔE = ${fmt(Ecell)} V`));
    for (const n of notes) res.assume(n);
    res.assume('Ideale Lösung: Aktivitäten = Konzentrationen; nicht genannte Konzentrationen und Drücke sind 1 mol/L bzw. 1 bar.');
  }
  if (Math.abs(T - DEFAULT_TEMPERATURE) > 1e-9) res.assume(`Standardpotentiale gelten bei 25 °C; Rechnung bei ${fmt(T)} K nur näherungsweise.`);
  res.source(`Standardpotentiale: ${redoxData.source}`);
  res.answer(new Quantity(Ecell, 'V'), { name: useActual ? 'ΔE' : 'ΔE°' });
  res.result.latex = `${useActual ? '\\Delta E' : '\\Delta E^\\circ'} = ${fmtL(Ecell)}\\,\\mathrm{V}`;
  res.value('ΔE° (Standard)', new Quantity(E0cell, 'V'));
  res.value('ΔG°', new Quantity(dG0 / 1000, 'kJ/mol'));
  if (K !== null) res.value('K', new Quantity(K, ''));
  else res.value('K', { text: kc.text, latex: kc.latex });
  res.value('lg K', new Quantity(kc.lg, ''));
  res.value('Zellreaktion', { text: eq, latex: eqL });
  res.value('Kathode', { text: cat.pair, latex: couplePairLatex(cat) });
  res.value('Anode', { text: an.pair, latex: couplePairLatex(an) });
  res.value('z', { text: String(cell.n), latex: String(cell.n) });
  if (Ecell <= 0) res.warn('CHEM_NO_SOLUTION', 'ΔE ≤ 0: Die Reaktion läuft unter diesen Bedingungen nicht freiwillig ab.');
  res.chemistry = { E0cell, Ecell, z: cell.n, cathode: cat.pair, anode: an.pair, equation: eq, K, dG0 };
  return res;
}

function cellSide(c, side) {
  const red = c.reduced[0].formula;
  const ox = c.oxidized[0].formula;
  const r = formatFormula({ ...red, phase: null });
  const o = formatFormula({ ...ox, phase: null });
  return side === 'anode' ? `${r} | ${o}` : `${o} | ${r}`;
}

/** E0(Zn) or standardpotential(Zn2+/Zn) */
export function potentialFromArgs(args) {
  const { positional } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt das Redoxpaar, z. B. E0(Zn).');
  const c = findCouple(positional[0]);
  const res = new ChemicalResult('potential', 'Standardpotential');
  res.step('Halbreaktion (Reduktion)', L(formatReaction(reductionAsReaction(c), null, 'latex'), c.reduction));
  res.answer(new Quantity(c.E0, 'V'), { name: 'E°' });
  res.result.latex = `E^\\circ(${couplePairLatex(c)}) = ${fmtL(c.E0)}\\,\\mathrm{V}`;
  res.value('Elektronen n', { text: String(c.n), latex: String(c.n) });
  res.source(`${redoxData.source}`);
  return res;
}

// -------------------------------------------------------------------------------------------- electrolysis

/**
 * Faraday's law m = M·I·t / (z·F) with one of m, I, t, V (gas) unknown.
 * elektrolyse(Cu2+; I=2 A; t=30 min) → m ; elektrolyse(Cu; m=1 g; I=2 A) → t
 */
export function electrolysisFromArgs(args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt der Stoff, z. B. elektrolyse(Cu2+; I=2 A; t=30 min).');
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : 273.15;
  const p = conditions.p !== undefined ? conditions.p : 101325;
  const c = findCouple(positional[0]);
  // the deposited substance: the reduced form of the couple (for a reduction at the cathode)
  let target = c.reduced[0];
  let anodic = false;
  try {
    const asked = keyOf(parseFormula(positional[0]));
    const oxidizedHit = c.oxidized.find((x) => keyOf(x.formula) === asked);
    // a neutral oxidized form (Cl₂, O₂) is what forms at the anode; ions and metals are deposited at the cathode
    if (oxidizedHit && oxidizedHit.formula.charge === 0 && !c.reduced.some((x) => keyOf(x.formula) === asked)) {
      target = oxidizedHit;
      anodic = true;
    }
  } catch (e) {
    // a pair written as Zn2+/Zn: the reduced form is deposited
  }
  const sub = resolveParsed(target.formula);
  const z = options.z !== undefined ? Number(options.z) : c.n / target.coef;
  if (!Number.isFinite(z) || z <= 0) fail('CHEM_SYNTAX', 'z muss eine positive Zahl sein.');
  const res = new ChemicalResult('electrolysis', 'Elektrolyse (Faraday)');
  res.step(anodic ? 'Anodenvorgang (Oxidation, Umkehrung der Halbreaktion)' : 'Kathodenvorgang', L(formatReaction(reductionAsReaction(c), null, 'latex'), c.reduction), L(`z = ${fmtL(z)}\\ \\text{Elektronen je ${latexOf(sub)}}`, `z = ${fmt(z)} Elektronen je ${sub.label}`));
  const I = options.I !== undefined ? Quantity.parse(options.I).need('current', 'die Stromstärke').in('A') : null;
  const t = options.t !== undefined ? Quantity.parse(options.t).need('time', 'die Zeit').in('s') : null;
  let nGiven = null;
  let mGiven = null;
  if (options.m !== undefined) mGiven = Quantity.parse(options.m).need('mass', 'die Masse').in('g');
  if (options.n !== undefined) nGiven = Quantity.parse(options.n).need('amount', 'die Stoffmenge').in('mol');
  if (options.V !== undefined) {
    const v = Quantity.parse(options.V).need('volume', 'das Volumen').in('L');
    nGiven = (p * v * 1e-3) / (R * T);
    res.assume(`Gasvolumen als ideales Gas bei ${fmt(T)} K und ${fmt(p / 1000)} kPa.`);
  }
  if (mGiven !== null && nGiven !== null) fail('CHEM_SYNTAX', 'Bitte entweder die Masse m oder die Stoffmenge n (oder das Volumen V) angeben, nicht mehrere.');
  const nKnown = mGiven !== null ? mGiven / sub.M : nGiven;
  const unknowns = [I === null ? 'I' : null, t === null ? 't' : null, nKnown === null ? 'n' : null].filter(Boolean);
  if (unknowns.length !== 1) fail('CHEM_MISSING_CONSTANT', 'Von den Größen Stromstärke I, Zeit t und Stoffmenge/Masse m müssen genau zwei gegeben sein.', { unknowns });
  res.step('Faraday-Gesetz', L('n = \\frac{I\\cdot t}{z\\cdot F}\\quad(F = 96485\\,\\mathrm{C/mol})', 'n = I·t/(z·F), F = 96485 C/mol'));
  let result;
  if (unknowns[0] === 'n') {
    const n = (I * t) / (z * F);
    const m = n * sub.M;
    res.step('Ladung', L(`Q = I\\cdot t = ${fmtL(I)}\\,\\mathrm{A}\\cdot ${fmtL(t)}\\,\\mathrm{s} = ${fmtL(I * t)}\\,\\mathrm{C}`, `Q = I·t = ${fmt(I * t)} C`));
    res.step('Stoffmenge und Masse', L(`n = \\frac{Q}{z\\,F} = ${fmtL(n)}\\,\\mathrm{mol},\\quad m = n\\cdot M = ${fmtL(m)}\\,\\mathrm{g}`, `n = Q/(z·F) = ${fmt(n)} mol, m = n·M = ${fmt(m)} g`));
    result = new Quantity(m, 'g', { substance: sub.label });
    res.value('n', new Quantity(n, 'mol'));
    if (sub.phase === 'g') res.value('V (ideales Gas)', new Quantity(((n * R * T) / p) * 1e3, 'L'));
  } else if (unknowns[0] === 't') {
    const time = (nKnown * z * F) / I;
    res.step('Zeit', L(`t = \\frac{n\\,z\\,F}{I} = \\frac{${fmtL(nKnown)}\\,\\mathrm{mol}\\cdot ${fmtL(z)}\\cdot 96485\\,\\mathrm{C/mol}}{${fmtL(I)}\\,\\mathrm{A}} = ${fmtL(time)}\\,\\mathrm{s}\\ (= ${fmtL(time / 60)}\\,\\mathrm{min})`, `t = n·z·F/I = ${fmt(time)} s (= ${fmt(time / 60)} min)`));
    result = new Quantity(time, 's');
    res.value('t in min', new Quantity(time / 60, 'min'));
  } else {
    const current = (nKnown * z * F) / t;
    res.step('Stromstärke', L(`I = \\frac{n\\,z\\,F}{t} = ${fmtL(current)}\\,\\mathrm{A}`, `I = n·z·F/t = ${fmt(current)} A`));
    result = new Quantity(current, 'A');
  }
  res.answer(result);
  res.assume('Stromausbeute 100 % (keine Nebenreaktionen).');
  res.source('Faraday-Konstante: CODATA 2018');
  return res;
}

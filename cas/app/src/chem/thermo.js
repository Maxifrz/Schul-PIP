// Thermodynamics of reactions: ΔH°, ΔS° and ΔG° from the standard formation data of the substance database, ΔG = ΔH − TΔS,
// K = exp(−ΔG°/RT), the temperature at which a reaction turns spontaneous, the van 't Hoff equation and Hess's law
// (a target reaction as an exact linear combination of reactions with known enthalpies).

import { ChemicalResult, L } from './result.js';
import { coefficientsFor } from './balance.js';
import { parseReaction, speciesOf, formatReaction } from './reaction.js';
import { formulaKey, formatFormula } from './formula.js';
import { resolveParsed, latexOf, conditionsFrom, parseGiven } from './amounts.js';
import { thermoOf } from './substances.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { CONSTANTS, DEFAULT_TEMPERATURE } from './constants.js';
import { solveLinear, Frac } from './rational.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';

const R = CONSTANTS.R.value;
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });
const PHASE_NAMES = { s: 'fest', l: 'flüssig', g: 'gasförmig', aq: 'gelöst' };

/** Standard data of one species of a reaction: { sub, phase, dfH, dfG, S } or throws CHEM_DATA_UNAVAILABLE */
function dataFor(species) {
  const sub = resolveParsed(species.formula);
  const phase = species.formula.phase || sub.phase || (sub.entry ? sub.entry.phase : null);
  const t = thermoOf(sub.entry, phase);
  const label = `${sub.label}${species.formula.phase ? `(${species.formula.phase})` : ''}`;
  if (!sub.entry || !t) {
    const known = sub.entry && sub.entry.thermo ? Object.keys(sub.entry.thermo).map((p) => PHASE_NAMES[p] || p).join(', ') : null;
    fail('CHEM_DATA_UNAVAILABLE', `Für ${label}${phase ? ` (${PHASE_NAMES[phase] || phase})` : ''} sind keine Standard-Bildungsdaten gespeichert${known ? `; vorhanden: ${known}` : ''}.`, { substance: label, phase });
  }
  return { sub, phase, ...t };
}

const num = (t) => {
  const v = Number(String(t).trim().replace(',', '.').replace(/[·×]\s*10\^?/, 'e'));
  if (!Number.isFinite(v)) fail('CHEM_SYNTAX', `„${t}“ ist keine Zahl.`);
  return v;
};

/** thermodynamik(Reaktion; T=…): ΔH°, ΔS°, ΔG°, K and the direction of the reaction */
export function reactionThermo(reactionText, options = {}) {
  const { reaction, coefficients, auto } = coefficientsFor(reactionText);
  const species = speciesOf(reaction);
  const nu = species.map((s, i) => (s.side === 'right' ? 1 : -1) * coefficients[i].toNumber());
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  const res = new ChemicalResult('thermo', 'Reaktionsthermodynamik');
  res.step('Reaktionsgleichung', L(formatReaction(reaction, coefficients, 'latex'), formatReaction(reaction, coefficients, 'text')));
  if (auto) res.assume('Die Koeffizienten wurden automatisch ausgeglichen.');
  const data = species.map((s) => dataFor(s));
  const term = (key, unit) => (d, i) => `${Math.abs(nu[i]) === 1 ? '' : Math.abs(nu[i]) + '\\cdot '}${fmtL(d[key])}`;
  const sum = (key) => data.reduce((s, d, i) => s + nu[i] * d[key], 0);
  const dH = sum('dfH');
  const dS = sum('S');
  const dGf = sum('dfG');
  const pairs = (key) => data.map((d, i) => ({ d, i })).filter((x) => nu[x.i] > 0).map((x) => `${Math.abs(nu[x.i]) === 1 ? '' : Math.abs(nu[x.i]) + '\\cdot '}${x.d[key] < 0 ? `(${fmtL(x.d[key])})` : fmtL(x.d[key])}`).join(' + ') || '0';
  const reactants = (key) => data.map((d, i) => ({ d, i })).filter((x) => nu[x.i] < 0).map((x) => `${Math.abs(nu[x.i]) === 1 ? '' : Math.abs(nu[x.i]) + '\\cdot '}${x.d[key] < 0 ? `(${fmtL(x.d[key])})` : fmtL(x.d[key])}`).join(' + ') || '0';
  res.step('Standarddaten (298,15 K)', ...data.map((d, i) => L(`${latexOf(d.sub)}\\,(${d.phase}):\\ \\Delta_fH^\\circ = ${fmtL(d.dfH)}\\,\\mathrm{kJ/mol},\\ S^\\circ = ${fmtL(d.S)}\\,\\mathrm{J/(mol\\cdot K)},\\ \\Delta_fG^\\circ = ${fmtL(d.dfG)}\\,\\mathrm{kJ/mol}`, `${d.sub.label} (${d.phase}): ΔfH° = ${fmt(d.dfH)} kJ/mol, S° = ${fmt(d.S)} J/(mol·K), ΔfG° = ${fmt(d.dfG)} kJ/mol`)));
  res.step('Reaktionsenthalpie', L(`\\Delta_RH^\\circ = \\sum\\nu\\,\\Delta_fH^\\circ(\\text{Produkte}) - \\sum\\nu\\,\\Delta_fH^\\circ(\\text{Edukte}) = (${pairs('dfH')}) - (${reactants('dfH')}) = ${fmtL(dH)}\\,\\mathrm{kJ/mol}`, `ΔRH° = Σν·ΔfH°(Produkte) − Σν·ΔfH°(Edukte) = ${fmt(dH)} kJ/mol`));
  res.step('Reaktionsentropie', L(`\\Delta_RS^\\circ = \\sum\\nu\\,S^\\circ(\\text{Produkte}) - \\sum\\nu\\,S^\\circ(\\text{Edukte}) = (${pairs('S')}) - (${reactants('S')}) = ${fmtL(dS)}\\,\\mathrm{J/(mol\\cdot K)}`, `ΔRS° = ${fmt(dS)} J/(mol·K)`));
  let dG;
  const atStandard = Math.abs(T - DEFAULT_TEMPERATURE) < 1e-9;
  if (atStandard) {
    dG = dGf;
    res.step('Freie Reaktionsenthalpie (aus ΔfG°)', L(`\\Delta_RG^\\circ = \\sum\\nu\\,\\Delta_fG^\\circ = ${fmtL(dG)}\\,\\mathrm{kJ/mol}`, `ΔRG° = Σν·ΔfG° = ${fmt(dG)} kJ/mol`));
    const check = dH - (T * dS) / 1000;
    res.step('Kontrolle mit ΔG = ΔH − T·ΔS', L(`\\Delta_RH^\\circ - T\\,\\Delta_RS^\\circ = ${fmtL(dH)} - ${fmtL(T)}\\cdot ${fmtL(dS / 1000)} = ${fmtL(check)}\\,\\mathrm{kJ/mol}`, `ΔH − T·ΔS = ${fmt(check)} kJ/mol`));
  } else {
    dG = dH - (T * dS) / 1000;
    res.step(`Freie Reaktionsenthalpie bei ${fmt(T)} K`, L(`\\Delta_RG = \\Delta_RH^\\circ - T\\,\\Delta_RS^\\circ = ${fmtL(dH)} - ${fmtL(T)}\\cdot ${fmtL(dS / 1000)} = ${fmtL(dG)}\\,\\mathrm{kJ/mol}`, `ΔG = ΔH° − T·ΔS° = ${fmt(dG)} kJ/mol`));
    res.assume('ΔH° und ΔS° werden als temperaturunabhängig angenommen (Näherung).');
    if (data.some((d) => d.phase !== resolveParsed(species[data.indexOf(d)].formula).phase)) res.assume('Phasenübergänge zwischen 298 K und T werden nicht berücksichtigt.');
    if (T < 200 || T > 1500) res.warn('CHEM_OUTSIDE_MODEL', `Bei ${fmt(T)} K ist die Näherung konstanter ΔH° und ΔS° unsicher, besonders wenn ein Stoff seinen Aggregatzustand ändert.`);
  }
  const K = Math.exp((-dG * 1000) / (R * T));
  res.step('Gleichgewichtskonstante', L(`K = \\exp\\left(-\\frac{\\Delta_RG^\\circ}{R\\,T}\\right) = \\exp\\left(-\\frac{${fmtL(dG * 1000)}\\,\\mathrm{J/mol}}{8{,}314\\,\\mathrm{J/(mol\\cdot K)}\\cdot ${fmtL(T)}\\,\\mathrm{K}}\\right) = ${fmtL(K)}`, `K = exp(−ΔG°/(R·T)) = ${fmt(K)}`));
  const verdict = dG < 0 ? 'freiwillig (exergonisch)' : dG > 0 ? 'nicht freiwillig (endergonisch)' : 'im Gleichgewicht';
  res.step('Bewertung', L(`\\Delta_RH^\\circ ${dH < 0 ? '<' : '>'} 0\\ (\\text{${dH < 0 ? 'exotherm' : 'endotherm'}}),\\ \\Delta_RG ${dG < 0 ? '<' : '>'} 0\\ (\\text{${verdict}})`, `${dH < 0 ? 'exotherm' : 'endotherm'}, ${verdict}`));
  if (dS !== 0 && dH !== 0) {
    if (Math.sign(dH) === Math.sign(dS)) {
      // ΔG = ΔH − TΔS = 0 at T = ΔH/ΔS; with both positive the reaction is spontaneous above it, with both negative below it
      const Ts = (dH * 1000) / dS;
      res.step('Umschlagtemperatur', L(`T_0 = \\frac{\\Delta_RH^\\circ}{\\Delta_RS^\\circ} = ${fmtL(Ts)}\\,\\mathrm{K}\\ (=${fmtL(Ts - 273.15)}\\,^{\\circ}\\mathrm{C})\\quad\\Rightarrow\\ \\text{freiwillig ${dH > 0 ? 'oberhalb' : 'unterhalb'} von } T_0`, `T0 = ΔH/ΔS = ${fmt(Ts)} K (= ${fmt(Ts - 273.15)} °C): freiwillig ${dH > 0 ? 'oberhalb' : 'unterhalb'} von T0`));
      res.value('Umschlagtemperatur', new Quantity(Ts, 'K'));
    } else {
      res.step('Temperaturabhängigkeit', L(dH < 0 ? '\\Delta H < 0,\\ \\Delta S > 0:\\ \\text{bei jeder Temperatur freiwillig}' : '\\Delta H > 0,\\ \\Delta S < 0:\\ \\text{bei keiner Temperatur freiwillig}', dH < 0 ? 'ΔH < 0, ΔS > 0: bei jeder Temperatur freiwillig' : 'ΔH > 0, ΔS < 0: bei keiner Temperatur freiwillig'));
    }
  }
  res.answer(new Quantity(dH, 'kJ/mol'), { name: 'ΔH°' });
  res.result.latex = `\\Delta_RH^\\circ = ${fmtL(dH)}\\,\\mathrm{kJ/mol}`;
  res.value('ΔS°', new Quantity(dS, 'J/(mol·K)'));
  res.value(atStandard ? 'ΔG°' : `ΔG (${fmt(T)} K)`, new Quantity(dG, 'kJ/mol'));
  res.value('K', new Quantity(K, ''));
  res.value('Bewertung', { text: verdict, latex: `\\text{${verdict}}` });
  res.assume('Reaktionsumsatz = 1 mol Formelumsatz der Gleichung; Standardzustand: 1 bar, gelöste Stoffe 1 mol/L.');
  res.source('Standardbildungsdaten: NIST / CRC Handbook, 298,15 K');
  res.chemistry = { dH, dS, dG, K, T };
  return res;
}

/** gibbs(ΔH=−92 kJ/mol; ΔS=−199 J/(mol·K); T=298 K) → ΔG, K, Umschlagtemperatur */
export function gibbsFromArgs(args) {
  const { options } = parseArgs(args);
  const pick = (...names) => {
    for (const n of names) if (options[n] !== undefined) return options[n];
    return undefined;
  };
  const H = pick('ΔH', 'dH', 'H', 'DeltaH');
  const S = pick('ΔS', 'dS', 'S', 'DeltaS');
  const G = pick('ΔG', 'dG', 'G', 'DeltaG');
  const Kopt = pick('K');
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  const res = new ChemicalResult('gibbs', 'Gibbs-Helmholtz-Gleichung');
  const kJ = (t, what) => Quantity.parse(t).need('molarEnergy', what).in('kJ/mol');
  const JK = (t, what) => Quantity.parse(t).need('molarEntropy', what).in('J/(mol·K)');
  if (H !== undefined && S !== undefined) {
    const dH = kJ(H, 'ΔH');
    const dS = JK(S, 'ΔS');
    const dG = dH - (T * dS) / 1000;
    const K = Math.exp((-dG * 1000) / (R * T));
    res.step('Gibbs-Helmholtz', L(`\\Delta G = \\Delta H - T\\,\\Delta S = ${fmtL(dH)} - ${fmtL(T)}\\cdot ${fmtL(dS / 1000)} = ${fmtL(dG)}\\,\\mathrm{kJ/mol}`, `ΔG = ΔH − T·ΔS = ${fmt(dG)} kJ/mol`));
    res.step('Gleichgewichtskonstante', L(`K = e^{-\\Delta G/(RT)} = ${fmtL(K)}`, `K = exp(−ΔG/(R·T)) = ${fmt(K)}`));
    if (dS !== 0 && dH !== 0 && Math.sign(dH) === Math.sign(dS)) {
      const Ts = (dH * 1000) / dS;
      res.step('Umschlagtemperatur', L(`T_0 = \\frac{\\Delta H}{\\Delta S} = ${fmtL(Ts)}\\,\\mathrm{K}`, `T0 = ΔH/ΔS = ${fmt(Ts)} K`));
      res.value('Umschlagtemperatur', new Quantity(Ts, 'K'));
    }
    res.answer(new Quantity(dG, 'kJ/mol'), { name: 'ΔG' });
    res.value('K', new Quantity(K, ''));
    res.assume(`Temperatur ${fmt(T)} K; ΔH und ΔS temperaturunabhängig.`);
    return res;
  }
  if (G !== undefined) {
    const dG = kJ(G, 'ΔG');
    const K = Math.exp((-dG * 1000) / (R * T));
    res.step('Gleichgewichtskonstante', L(`K = \\exp\\left(-\\frac{\\Delta G}{R\\,T}\\right) = ${fmtL(K)}`, `K = exp(−ΔG/(R·T)) = ${fmt(K)}`));
    res.answer(new Quantity(K, ''), { name: 'K' });
    res.assume(`Temperatur ${fmt(T)} K.`);
    return res;
  }
  if (Kopt !== undefined) {
    const K = num(Kopt);
    if (!(K > 0)) fail('CHEM_MISSING_CONSTANT', 'K muss eine positive Zahl sein.');
    const dG = (-R * T * Math.log(K)) / 1000;
    res.step('Freie Standardreaktionsenthalpie', L(`\\Delta G^\\circ = -R\\,T\\,\\ln K = ${fmtL(dG)}\\,\\mathrm{kJ/mol}`, `ΔG° = −R·T·ln K = ${fmt(dG)} kJ/mol`));
    res.answer(new Quantity(dG, 'kJ/mol'), { name: 'ΔG°' });
    res.assume(`Temperatur ${fmt(T)} K.`);
    return res;
  }
  fail('CHEM_MISSING_CONSTANT', 'Gib ΔH und ΔS an (gibbs(ΔH=−92 kJ/mol; ΔS=−199 J/(mol·K); T=298 K)), oder ΔG=… bzw. K=….');
}

/** van 't Hoff: vanthoff(K=…; T1=…; T2=…; ΔH=…) → K at T2 */
export function vantHoffFromArgs(args) {
  const { options } = parseArgs(args);
  const K1 = num(options.K1 ?? options.K);
  const T1 = Quantity.parse(options.T1).need('temperature', 'T1').si;
  const T2 = Quantity.parse(options.T2).need('temperature', 'T2').si;
  const H = options['ΔH'] ?? options.dH ?? options.H;
  if (H === undefined) fail('CHEM_MISSING_CONSTANT', 'Es fehlt ΔH=… (in kJ/mol).');
  const dH = Quantity.parse(H).need('molarEnergy', 'ΔH').in('J/mol');
  const K2 = K1 * Math.exp((-dH / R) * (1 / T2 - 1 / T1));
  const res = new ChemicalResult('vanthoff', "Van-'t-Hoff-Gleichung");
  res.step("Van 't Hoff", L(`\\ln\\frac{K_2}{K_1} = -\\frac{\\Delta H}{R}\\left(\\frac{1}{T_2} - \\frac{1}{T_1}\\right)`, 'ln(K2/K1) = −ΔH/R · (1/T2 − 1/T1)'));
  res.step('Einsetzen', L(`K_2 = ${fmtL(K1)}\\cdot\\exp\\left(-\\frac{${fmtL(dH)}}{8{,}314}\\left(\\frac{1}{${fmtL(T2)}} - \\frac{1}{${fmtL(T1)}}\\right)\\right) = ${fmtL(K2)}`, `K2 = ${fmt(K2)}`));
  res.answer(new Quantity(K2, ''), { name: 'K₂' });
  res.assume('ΔH temperaturunabhängig im Bereich T₁ bis T₂.');
  return res;
}

// ------------------------------------------------------------------------------------------ Hess

/** Splits "C + O2 -> CO2 @ -393,5 kJ/mol" or "... ΔH=-393,5 kJ/mol" into the equation and the enthalpy (kJ/mol) */
function splitEnthalpy(text) {
  const m = /^(.*?)\s*(?:@|(?:ΔH|ΔRH|dH|DeltaH)\s*=)\s*(.+)$/.exec(text);
  if (!m) fail('CHEM_SYNTAX', `„${text}“: es fehlt die Reaktionsenthalpie (… ΔH=−393,5 kJ/mol).`);
  const q = Quantity.parse(m[2]);
  if (q.is('molarEnergy')) return { equation: m[1], dH: q.in('kJ/mol') };
  if (q.is('energy')) return { equation: m[1], dH: q.in('kJ') };
  fail('CHEM_UNIT_MISMATCH', `„${m[2]}“ ist keine Energie (kJ oder kJ/mol).`);
}

const speciesId = (s, usePhase) => `${formulaKey({ ...s.formula, phase: null })}${usePhase && s.formula.phase ? `(${s.formula.phase})` : ''}`;

/**
 * Hess's law: hess(Ziel; Reaktion1 @ ΔH1; Reaktion2 @ ΔH2; …). The target is written as a linear combination of the
 * reactions, exactly (fractions allowed); ΔH follows with the same factors.
 */
export function hessFromArgs(args) {
  const { positional } = parseArgs(args);
  if (positional.length < 2) fail('CHEM_SYNTAX', 'Schreibweise: hess(Zielreaktion; Reaktion1 @ ΔH1; Reaktion2 @ ΔH2 …)');
  const target = coefficientsFor(positional[0]);
  const known = positional.slice(1).map((t) => {
    const { equation, dH } = splitEnthalpy(t);
    const { reaction, coefficients } = coefficientsFor(equation);
    return { reaction, coefficients, dH, text: equation };
  });
  // species ids: with phases when at least one of them is tagged
  const usePhase = [target, ...known].some((x) => speciesOf(x.reaction).some((s) => s.formula.phase));
  const vectorOf = (x) => {
    const v = new Map();
    speciesOf(x.reaction).forEach((s, i) => {
      const id = speciesId(s, usePhase);
      v.set(id, (v.get(id) || new Frac(0n)).add(x.coefficients[i].mul(new Frac(BigInt(s.side === 'right' ? 1 : -1)))));
    });
    return v;
  };
  const tv = vectorOf(target);
  const kvs = known.map(vectorOf);
  const ids = [...new Set([...tv.keys(), ...kvs.flatMap((v) => [...v.keys()])])];
  const A = ids.map((id) => kvs.map((v) => v.get(id) || new Frac(0n)));
  const b = ids.map((id) => tv.get(id) || new Frac(0n));
  const solution = solveLinear(A, b);
  if (solution.kind === 'none') fail('CHEM_NO_SOLUTION', `Die Zielreaktion lässt sich aus den gegebenen Reaktionen nicht kombinieren.${usePhase ? '' : ''} Prüfe, ob alle Stoffe (und ihre Aggregatzustände) vorkommen.`);
  if (solution.kind === 'many') fail('CHEM_MULTIPLE_SOLUTIONS', 'Die Kombination ist nicht eindeutig: Die gegebenen Reaktionen sind voneinander abhängig.', { basis: solution.basis.map((b2) => b2.map(String)) });
  const factors = solution.x;
  const dH = factors.reduce((s, f, i) => s + f.toNumber() * known[i].dH, 0);
  const res = new ChemicalResult('hess', 'Satz von Hess');
  res.step('Zielreaktion', L(formatReaction(target.reaction, target.coefficients, 'latex'), formatReaction(target.reaction, target.coefficients, 'text')));
  res.step('Gegebene Reaktionen', ...known.map((k, i) => L(`(${i + 1})\\ ${formatReaction(k.reaction, k.coefficients, 'latex')},\\ \\Delta H_${i + 1} = ${fmtL(k.dH)}\\,\\mathrm{kJ/mol}`, `(${i + 1}) ${formatReaction(k.reaction, k.coefficients, 'text')}, ΔH${i + 1} = ${fmt(k.dH)} kJ/mol`)));
  const signed = (parts) => parts.join(' ').replace(/^\+ /, '').replace(/\+ -/g, '- ');
  const combo = factors.map((f, i) => (f.isZero ? null : `+ ${f.sign < 0 ? '' : ''}${f.toString()}·(${i + 1})`)).filter(Boolean);
  const comboL = factors.map((f, i) => (f.isZero ? null : `+ ${f.toLatex()}\\cdot(${i + 1})`)).filter(Boolean);
  res.step('Kombination (exakt über die Stoffbilanz)', L(`\\text{Ziel} = ${signed(comboL)}`, `Ziel = ${signed(combo)}`));
  res.step('Reaktionsenthalpie', L(`\\Delta H = ${signed(factors.map((f, i) => (f.isZero ? null : `+ ${f.toLatex()}\\cdot(${fmtL(known[i].dH)})`)).filter(Boolean))} = ${fmtL(dH)}\\,\\mathrm{kJ/mol}`, `ΔH = ${fmt(dH)} kJ/mol`));
  res.answer(new Quantity(dH, 'kJ/mol'), { name: 'ΔH' });
  res.result.latex = `\\Delta H = ${fmtL(dH)}\\,\\mathrm{kJ/mol}`;
  factors.forEach((f, i) => res.value(`Faktor der Reaktion (${i + 1})`, { text: String(f), latex: f.toLatex() }));
  res.assume('Reaktionsenthalpien gelten für die Gleichungen mit den angegebenen Koeffizienten.');
  return res;
}

export { PHASE_NAMES, parseGiven };

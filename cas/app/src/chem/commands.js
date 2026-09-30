// The command language of the chemistry engine: every command with its German name, spellings, syntax, explanation
// and a worked example, and the function that runs it. The calculator's command search reads the catalog; the engine
// calls `runChemistry` before the mathematics, for a call like molmasse(H2SO4), pH(HCl; 0,01 mol/L) or a bare reaction
// equation. Arguments are separated by ";" (a decimal comma is part of a number).

import { ChemicalResult, L, toRows, errorResult } from './result.js';
import { ChemError, fail } from './errors.js';
import { splitArgs, parseArgs } from './args.js';
import { infoFromArgs } from './info.js';
import { convertCommand, dilutionFromArgs, unitConversionFromArgs } from './conversions.js';
import { balanceResult } from './balance.js';
import { balanceRedox } from './redox.js';
import { parseReaction, isReaction } from './reaction.js';
import { stoichiometryFromArgs } from './stoich.js';
import { phFromArgs, systemsOf, kwAt, lg } from './acidbase.js';
import { resolve, latexOf } from './amounts.js';
import { equilibrium, coupledEquilibrium } from './equilibrium.js';
import { solubility, kspFromArgs, precipitation } from './ksp.js';
import { cellFromArgs, nernstFromArgs, electrolysisFromArgs, potentialFromArgs } from './electro.js';
import { reactionThermo, gibbsFromArgs, hessFromArgs, vantHoffFromArgs } from './thermo.js';
import { kineticsFromArgs, orderFromData, arrheniusFromArgs } from './kinetics.js';
import { gasFromArgs } from './gas.js';
import { titrationFromArgs } from './titration.js';
import { distributionFromArgs, isothermFromArgs } from './diagrams.js';
import { oxidationNumbers, onText } from './oxidation.js';
import { formatFormula, parseFormula } from './formula.js';
import { chemLatexToText } from './latex.js';
import { plotShapes } from './plots.js';
import { parseChemicalIntent } from './intent.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

// ------------------------------------------------------------------------------------------ small commands

function oxidationCommand(args) {
  const { positional } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Formel, z. B. oxidationszahl(KMnO4).');
  const sub = resolve(positional[0]);
  const r = oxidationNumbers(sub.formula);
  const res = new ChemicalResult('oxidation', `Oxidationszahlen in ${sub.label}`);
  const only = positional[1] ? positional[1].trim() : null;
  const entries = Object.entries(r.numbers).filter(([el]) => !only || el === only);
  if (only && !entries.length) fail('CHEM_UNKNOWN_ELEMENT', `${only} kommt in ${sub.label} nicht vor.`, { symbol: only });
  res.step('Regeln', L('\\text{F: −1; Alkalimetalle +1; Erdalkalimetalle +2; H: +1 (in Hydriden −1); O: −2 (in Peroxiden −1); Summe = Ladung}', 'F −1; Alkalimetalle +1; Erdalkalimetalle +2; H +1 (Hydride −1); O −2 (Peroxide −1); Summe = Ladung'));
  res.step('Oxidationszahlen', ...entries.map(([el, v]) => L(`\\mathrm{${el}}:\\ ${onText(v, 'latex')}${sub.formula.atoms[el] > 1 ? `\\ (\\text{Mittelwert aus ${sub.formula.atoms[el]} Atomen})` : ''}`, `${el}: ${onText(v)}${sub.formula.atoms[el] > 1 ? ` (Mittelwert aus ${sub.formula.atoms[el]} Atomen)` : ''}`)));
  const sum = Object.entries(r.numbers).reduce((s, [el, v]) => s + v.toNumber() * sub.formula.atoms[el], 0);
  res.step('Probe', L(`\\sum = ${fmtL(sum)} = \\text{Ladung } ${sub.formula.charge}`, `Summe = ${fmt(sum)} = Ladung ${sub.formula.charge}`));
  res.answer({ text: entries.map(([el, v]) => `${el} ${onText(v)}`).join(', '), latex: `\\text{${entries.map(([el, v]) => `${el} ${onText(v)}`).join(', ')}}` });
  for (const [el, v] of entries) res.value(`Oxidationszahl ${el}`, { text: onText(v), latex: onText(v, 'latex'), number: v.toNumber() });
  for (const n of r.notes) res.assume(n);
  return res;
}

/** Ka(CH3COOH), Kb(NH3), pKa(…), pKb(…) from the substance database */
function constantCommand(kind, args) {
  const { positional } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', `Es fehlt der Stoff, z. B. ${kind}(CH3COOH).`);
  const sub = resolve(positional[0]);
  const s = systemsOf(sub, 1);
  const res = new ChemicalResult('constant', `${kind} von ${sub.label}`);
  if (s.kind === 'strongAcid' && !s.systems.length) {
    res.answer({ text: 'starke Säure: Ka ≫ 1 (vollständig dissoziiert)', latex: '\\text{starke Säure: } K_a \\gg 1' });
    res.step('Einordnung', L('\\text{vollständige Protolyse in Wasser}', 'vollständige Protolyse in Wasser'));
    return res;
  }
  if (s.kind === 'strongBase' && !s.systems.length) {
    res.answer({ text: 'starke Base: Kb ≫ 1 (vollständig dissoziiert)', latex: '\\text{starke Base: } K_b \\gg 1' });
    return res;
  }
  const sys = s.systems[0];
  if (!sys) fail('CHEM_DATA_UNAVAILABLE', `Für ${sub.label} sind keine Säure-Base-Konstanten gespeichert.`, { substance: sub.label });
  const k = sys.contributions[0].k;
  const n = sys.pKa.length;
  const wantsAcid = kind === 'Ka' || kind === 'pKa';
  const stagesA = k < n ? sys.pKa.slice(Math.max(k, 0)) : [];
  if (wantsAcid) {
    if (!stagesA.length) fail('CHEM_OUTSIDE_MODEL', `${sub.label} ist die Base des Systems und gibt kein Proton ab; die Säurekonstante gehört zur konjugierten Säure. Frage Kb(${sub.label}) ab.`, { substance: sub.label });
    stagesA.forEach((p, i) => res.step(`${i + 1 > 1 || stagesA.length > 1 ? i + 1 + '. Stufe: ' : ''}Säurekonstante`, L(`K_a = ${fmtL(10 ** -p)}\\,\\mathrm{mol/L},\\quad \\mathrm{p}K_a = ${fmtL(p)}`, `Ka = ${fmt(10 ** -p)} mol/L, pKa = ${fmt(p)}`)));
    const first = stagesA[0];
    res.answer(new Quantity(kind === 'Ka' ? 10 ** -first : first, kind === 'Ka' ? 'mol/L' : ''), { name: kind });
    stagesA.forEach((p, i) => {
      res.value(`pKa${stagesA.length > 1 ? i + 1 : ''}`, new Quantity(p, ''));
      res.value(`Ka${stagesA.length > 1 ? i + 1 : ''}`, new Quantity(10 ** -p, 'mol/L'));
    });
  } else {
    const stagesB = k > 0 ? sys.pKa.slice(0, k).map((p) => 14 - p).reverse() : [];
    if (!stagesB.length) fail('CHEM_OUTSIDE_MODEL', `${sub.label} nimmt in Wasser kein Proton auf; die Basenkonstante ist nicht definiert. Frage Ka(${sub.label}) ab.`, { substance: sub.label });
    stagesB.forEach((p, i) => res.step(`${stagesB.length > 1 ? i + 1 + '. Stufe: ' : ''}Basenkonstante`, L(`K_b = ${fmtL(10 ** -p)}\\,\\mathrm{mol/L},\\quad \\mathrm{p}K_b = ${fmtL(p)}\\quad(\\mathrm{p}K_a + \\mathrm{p}K_b = 14)`, `Kb = ${fmt(10 ** -p)} mol/L, pKb = ${fmt(p)} (pKa + pKb = 14)`)));
    res.answer(new Quantity(kind === 'Kb' ? 10 ** -stagesB[0] : stagesB[0], kind === 'Kb' ? 'mol/L' : ''), { name: kind });
    stagesB.forEach((p, i) => {
      res.value(`pKb${stagesB.length > 1 ? i + 1 : ''}`, new Quantity(p, ''));
      res.value(`Kb${stagesB.length > 1 ? i + 1 : ''}`, new Quantity(10 ** -p, 'mol/L'));
    });
  }
  res.source('CRC Handbook of Chemistry and Physics, 25 °C');
  return res;
}

function kwCommand(args) {
  const { positional, options } = parseArgs(args);
  const t = options.T ?? positional[0];
  const T = t ? Quantity.parse(t).need('temperature', 'die Temperatur').si : 298.15;
  const { Kw, pKw, interpolated } = kwAt(T);
  const res = new ChemicalResult('kw', 'Ionenprodukt des Wassers');
  res.step('Autoprotolyse', L('2\\,\\mathrm{H_2O} \\rightleftharpoons \\mathrm{H_3O^+} + \\mathrm{OH^-},\\quad K_w = c(\\mathrm{H_3O^+})\\cdot c(\\mathrm{OH^-})', '2 H2O <=> H3O+ + OH-, Kw = c(H3O+)·c(OH-)'));
  res.step(`Bei ${fmt(T - 273.15)} °C`, L(`K_w = ${fmtL(Kw)}\\,\\mathrm{mol^2/L^2},\\quad \\mathrm{p}K_w = ${fmtL(pKw)}`, `Kw = ${fmt(Kw)} mol²/L², pKw = ${fmt(pKw)}`));
  const neutral = pKw / 2;
  res.step('Neutraler pH-Wert', L(`\\mathrm{pH}_{\\mathrm{neutral}} = \\frac{\\mathrm{p}K_w}{2} = ${fmtL(neutral)}`, `pH(neutral) = pKw/2 = ${fmt(neutral)}`));
  res.answer(new Quantity(Kw, 'mol²/L²'), { name: 'Kw' });
  res.result.unit = '';
  res.result.latex = `K_w = ${fmtL(Kw)}\\,\\mathrm{mol^2/L^2}`;
  res.value('pKw', new Quantity(pKw, ''));
  res.value('pH (neutral)', new Quantity(neutral, ''));
  if (interpolated) res.assume('pKw zwischen den Tabellenwerten linear interpoliert.');
  res.source('CRC Handbook of Chemistry and Physics (Ionenprodukt des Wassers); 25 °C auf den Schulwert 14,00 gesetzt');
  return res;
}

function oxoniumCommand(args) {
  const { options, positional } = parseArgs(args);
  const raw = options.pH ?? positional[0];
  if (raw === undefined) fail('CHEM_SYNTAX', 'Schreibweise: oxonium(pH=3)');
  const pH = Number(String(raw).replace(',', '.'));
  if (!Number.isFinite(pH)) fail('CHEM_SYNTAX', `„${raw}“ ist keine Zahl.`);
  const { pKw } = kwAt(options.T ? Quantity.parse(options.T).si : 298.15);
  const h = 10 ** -pH;
  const res = new ChemicalResult('oxonium', 'Konzentration aus dem pH-Wert');
  res.step('Umkehrung', L(`c(\\mathrm{H_3O^+}) = 10^{-\\mathrm{pH}} = 10^{-${fmtL(pH)}} = ${fmtL(h)}\\,\\mathrm{mol/L}`, `c(H3O+) = 10^(−pH) = ${fmt(h)} mol/L`));
  res.step('Hydroxid-Ionen', L(`c(\\mathrm{OH^-}) = 10^{\\mathrm{pH} - \\mathrm{p}K_w} = ${fmtL(10 ** (pH - pKw))}\\,\\mathrm{mol/L}`, `c(OH-) = ${fmt(10 ** (pH - pKw))} mol/L`));
  res.answer(new Quantity(h, 'mol/L'), { name: 'c(H₃O⁺)' });
  res.value('c(OH⁻)', new Quantity(10 ** (pH - pKw), 'mol/L'));
  res.value('pOH', new Quantity(pKw - pH, ''));
  if (pH < 0 || pH > pKw) res.warn('CHEM_OUTSIDE_MODEL', 'pH-Werte außerhalb von 0 bis pKw sind bei sehr konzentrierten Lösungen möglich, doch dort weichen Aktivitäten stark von Konzentrationen ab.');
  return res;
}

// ------------------------------------------------------------------------------------------ the catalog

const wrapThermo = (which) => (args) => {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Reaktionsgleichung.');
  const res = reactionThermo(positional[0], options);
  if (which === 'S') {
    res.title = 'Reaktionsentropie';
    res.answer(res.values['ΔS°'].quantity, { name: 'ΔS°' });
    res.result.latex = `\\Delta_RS^\\circ = ${fmtL(res.values['ΔS°'].value)}\\,\\mathrm{J/(mol\\cdot K)}`;
  } else if (which === 'G') {
    res.title = 'Freie Reaktionsenthalpie';
    const key = Object.keys(res.values).find((k) => k.startsWith('ΔG'));
    res.answer(res.values[key].quantity, { name: key });
    res.result.latex = `\\Delta_RG = ${fmtL(res.values[key].value)}\\,\\mathrm{kJ/mol}`;
  } else if (which === 'K') {
    res.title = 'Gleichgewichtskonstante aus ΔG°';
    res.answer(res.values.K.quantity, { name: 'K' });
    res.result.latex = `K = ${fmtL(res.values.K.value)}`;
  }
  return res;
};

const equilibriumCommand = (mode) => (args) => {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Reaktionsgleichung.');
  // several reactions at once: coupled equilibria, one K each
  const reactions = positional.filter((p) => isReaction(p));
  if (mode === 'solve' && reactions.length > 1) return coupledEquilibrium(reactions, positional.filter((p) => !isReaction(p)), options);
  return equilibrium(positional[0], positional.slice(1), options, mode);
};

const kcCommand = (kind) => (args) => {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Reaktionsgleichung.');
  const givens = positional.slice(1).map((g) => (kind === 'p' && /^\s*c\s*\(/.test(g) ? g.replace(/^\s*c\s*\(/, 'p(') : g));
  return equilibrium(positional[0], givens, options, 'constant');
};

const pOHCommand = (args) => {
  const res = phFromArgs(args);
  const pOH = res.chemistry ? -Math.log10(res.chemistry.oh) : NaN;
  res.title = 'pOH-Wert';
  res.answer(new Quantity(pOH, ''), { name: 'pOH' });
  res.result.latex = `\\mathrm{pOH} = ${fmtL(pOH)}`;
  return res;
};

const bufferCommand = (args) => phFromArgs(args, 'buffer');

/** ausgleichen: atoms and charge; a redox skeleton without H⁺/H₂O falls back to the redox balancing */
function balanceCommand(args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Reaktionsgleichung, z. B. ausgleichen(Fe + O2 -> Fe2O3).');
  const reaction = parseReaction(positional[0]);
  try {
    return balanceResult(reaction);
  } catch (e) {
    if (e instanceof ChemError && e.code === 'CHEM_NO_SOLUTION') {
      try {
        const res = balanceRedox(reaction, mediumOptions(options));
        res.assume('Die Gleichung ist eine Redoxgleichung: H⁺/OH⁻ und H₂O wurden ergänzt.');
        return res;
      } catch (e2) {
        throw e;
      }
    }
    throw e;
  }
}

function mediumOptions(options) {
  const m = String(options.medium || options.Medium || '').toLowerCase();
  if (!m) return {};
  if (/^(sauer|acid)/.test(m)) return { medium: 'acidic' };
  if (/^(basisch|alkal|base)/.test(m)) return { medium: 'basic' };
  if (/^neutral/.test(m)) return { medium: 'neutral' };
  return fail('CHEM_SYNTAX', `Unbekanntes Medium „${options.medium}“ (sauer, basisch, neutral).`);
}

function redoxCommand(args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Reaktionsgleichung, z. B. redox(MnO4- + Fe2+ -> Mn2+ + Fe3+).');
  return balanceRedox(positional[0], mediumOptions(options));
}

/**
 * name: what is typed · aliases · short: case-sensitive short forms handled by the engine (M, n, pH …) ·
 * syntax · text · example (runs in the tests) · run(args)
 */
export const CHEM_COMMANDS = [
  // Stoffe und Größen
  { name: 'molmasse', aliases: ['molarmasse', 'molaremasse', 'molekulargewicht'], short: ['M'], syntax: 'molmasse(H2SO4) · M(H2SO4)', text: 'Molare Masse mit Rechenweg aus den Atommassen; Formel oder Name (Salzsäure, Wasser …).', example: 'molmasse(H2SO4)', run: (a) => infoFromArgs('molarmass', a) },
  { name: 'zusammensetzung', aliases: ['massenanteile', 'elementanteile'], syntax: 'zusammensetzung(H2SO4)', text: 'Massenanteile der Elemente in einer Verbindung.', example: 'zusammensetzung(Fe2O3)', run: (a) => infoFromArgs('composition', a) },
  { name: 'element', aliases: ['elementinfo'], syntax: 'element(Fe) · element(Eisen)', text: 'Ordnungszahl, Atommasse, Elektronenkonfiguration, Elektronegativität, Oxidationszahlen.', example: 'element(Fe)', run: (a) => infoFromArgs('element', a) },
  { name: 'stoffinfo', aliases: ['substanz'], syntax: 'stoffinfo(NaCl)', text: 'Daten eines Stoffs: Molmasse, Aggregatzustand, Dichte, Bildungsdaten, Säure-/Base-Konstanten, Löslichkeitsprodukt.', example: 'stoffinfo(NaCl)', run: (a) => infoFromArgs('substance', a) },
  { name: 'stoffmenge', aliases: [], short: ['n'], syntax: 'stoffmenge(NaCl; 10 g) · n(H2; 2,24 L) · n(HCl; c=0,1 mol/L; V=50 mL)', text: 'Stoffmenge n aus Masse, Gasvolumen oder Konzentration und Volumen.', example: 'stoffmenge(NaCl; 10 g)', run: (a) => convertCommand('n', a) },
  { name: 'masse', short: ['m'], syntax: 'masse(NaCl; 0,5 mol) · m(HCl; c=0,1 mol/L; V=50 mL)', text: 'Masse aus Stoffmenge, Konzentration und Volumen oder Volumen und Dichte.', example: 'masse(NaCl; 0,5 mol)', run: (a) => convertCommand('m', a) },
  { name: 'konzentration', short: ['c'], syntax: 'konzentration(NaCl; 5 g; 250 mL) · c(NaCl; 0,1 mol; 2 L)', text: 'Stoffmengenkonzentration c aus Stoffmenge oder Masse und Lösungsvolumen.', example: 'konzentration(NaCl; 5 g; 250 mL)', run: (a) => convertCommand('c', a) },
  { name: 'stoffvolumen', aliases: ['gasvolumen'], short: ['V'], syntax: 'stoffvolumen(H2; 0,5 mol) · V(CO2; 10 g; T=25 °C; p=1 bar)', text: 'Volumen eines Gases (ideales Gas) oder einer Lösung bzw. Flüssigkeit aus Stoffmenge, Konzentration oder Dichte.', example: 'stoffvolumen(H2; 0,5 mol)', run: (a) => convertCommand('V', a) },
  { name: 'verdünnung', aliases: ['verduennung', 'verduenne'], syntax: 'verdünnung(c1=1 mol/L; V1=10 mL; V2=100 mL)', text: 'Verdünnungsrechnung c₁·V₁ = c₂·V₂: eine der vier Größen fehlt.', example: 'verdünnung(c1=1 mol/L; V1=10 mL; V2=100 mL)', run: dilutionFromArgs },
  { name: 'einheitenumrechnung', aliases: ['konvertiere'], syntax: 'einheitenumrechnung(250 mL; L) · einheitenumrechnung(25 °C; K)', text: 'Rechnet Einheiten um und prüft die Dimension (g in mL geht nicht).', example: 'einheitenumrechnung(250 mL; L)', run: unitConversionFromArgs },
  { name: 'oxidationszahl', aliases: ['oxidationszahlen'], syntax: 'oxidationszahl(KMnO4) · oxidationszahl(KMnO4; Mn)', text: 'Oxidationszahlen aller Elemente einer Formel nach den Schulregeln.', example: 'oxidationszahl(KMnO4)', run: oxidationCommand },
  // Reaktionen
  { name: 'ausgleichen', aliases: ['gleichungausgleichen', 'balance'], syntax: 'ausgleichen(Fe + O2 -> Fe2O3)', text: 'Gleicht eine Reaktionsgleichung aus (Atom- und Ladungsbilanz, kleinste ganze Zahlen). Pfeile: ->, →, ⇌.', example: 'ausgleichen(Fe + O2 -> Fe2O3)', run: balanceCommand },
  { name: 'stöchiometrie', aliases: ['stoechiometrie', 'stöchiometrisch'], syntax: 'stöchiometrie(2 H2 + O2 -> 2 H2O; 4 g H2; 32 g O2; gesucht=H2O)', text: 'Umsatz aus gegebenen Mengen: limitierender Stoff, Überschuss, gebildete Massen und Volumina.', example: 'stöchiometrie(2 H2 + O2 -> 2 H2O; 4 g H2; 32 g O2)', run: (a) => stoichiometryFromArgs(a, 'stoichiometry') },
  { name: 'limitierenderstoff', aliases: ['limitierend', 'limitierendereaktant'], syntax: 'limitierenderstoff(HCl + NaOH -> NaCl + H2O; HCl: 0,1 mol/L 50 mL; NaOH: 0,2 mol/L 20 mL)', text: 'Welcher Ausgangsstoff begrenzt die Reaktion, und was bleibt übrig?', example: 'limitierenderstoff(HCl + NaOH -> NaCl + H2O; HCl: 0,1 mol/L 50 mL; NaOH: 0,2 mol/L 20 mL)', run: (a) => stoichiometryFromArgs(a, 'limiting') },
  { name: 'ausbeute', syntax: 'ausbeute(N2 + 3 H2 -> 2 NH3; 28 g N2; 10 g H2; 15 g NH3)', text: 'Prozentuale Ausbeute aus theoretischer und tatsächlich erhaltener Menge.', example: 'ausbeute(N2 + 3 H2 -> 2 NH3; 28 g N2; 10 g H2; 15 g NH3)', run: (a) => stoichiometryFromArgs(a, 'yield') },
  { name: 'redox', aliases: ['redoxgleichung'], syntax: 'redox(MnO4- + Fe2+ -> Mn2+ + Fe3+; medium=sauer)', text: 'Redoxgleichung mit Oxidationszahlen, Teilgleichungen, Elektronenausgleich; sauer oder basisch.', example: 'redox(MnO4- + Fe2+ -> Mn2+ + Fe3+)', run: redoxCommand },
  // Säuren und Basen
  { name: 'phwert', aliases: [], short: ['pH'], syntax: 'pH(HCl; 0,01 mol/L) · pH(CH3COOH; 0,1 mol/L) · pH(HA; 0,1 mol/L; pKa=4,76)', text: 'pH-Wert starker und schwacher Säuren und Basen, Salze, mehrprotonig, Gemische; exakt aus der Ladungsbilanz, mit Schulnäherung zum Vergleich.', example: 'phwert(CH3COOH; 0,1 mol/L)', run: (a) => phFromArgs(a) },
  { name: 'pohwert', short: ['pOH'], syntax: 'pOH(NaOH; 0,01 mol/L)', text: 'pOH-Wert einer Lösung.', example: 'pohwert(NaOH; 0,01 mol/L)', run: pOHCommand },
  { name: 'puffer', aliases: ['pufferlösung'], syntax: 'puffer(CH3COOH 0,1 mol/L; CH3COONa 0,1 mol/L)', text: 'pH eines Puffers: exakt, und mit Henderson-Hasselbalch, wenn sie gilt.', example: 'puffer(CH3COOH 0,1 mol/L; CH3COONa 0,05 mol/L)', run: bufferCommand },
  { name: 'säurekonstante', aliases: ['saeurekonstante'], short: ['Ka', 'pKa'], syntax: 'Ka(CH3COOH) · pKa(H3PO4)', text: 'Säurekonstante (alle Stufen) aus der Stoffdatenbank.', example: 'säurekonstante(CH3COOH)', run: (a) => constantCommand('Ka', a) },
  { name: 'basenkonstante', aliases: [], short: ['Kb', 'pKb'], syntax: 'Kb(NH3) · pKb(CH3COO-)', text: 'Basenkonstante aus pKa + pKb = 14.', example: 'basenkonstante(NH3)', run: (a) => constantCommand('Kb', a) },
  { name: 'ionenprodukt', aliases: ['autoprotolyse'], short: ['Kw'], syntax: 'ionenprodukt() · Kw(T=50 °C)', text: 'Ionenprodukt und pKw des Wassers bei einer Temperatur.', example: 'ionenprodukt(T=50 °C)', run: kwCommand },
  { name: 'oxonium', aliases: ['oxoniumkonzentration'], syntax: 'oxonium(pH=3)', text: 'c(H₃O⁺), c(OH⁻) und pOH aus dem pH-Wert.', example: 'oxonium(pH=3)', run: oxoniumCommand },
  { name: 'titration', aliases: ['titrationskurve'], syntax: 'titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)', text: 'Titrationskurve pH(V) mit Äquivalenzpunkten, Halbäquivalenzpunkt und passendem Indikator.', example: 'titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)', run: titrationFromArgs },
  { name: 'speziesverteilung', aliases: ['speziation'], syntax: 'speziesverteilung(H3PO4)', text: 'Verteilungsdiagramm einer Säure: Anteil jeder Spezies gegen den pH.', example: 'speziesverteilung(H3PO4)', run: distributionFromArgs },
  // Gleichgewicht
  { name: 'gleichgewicht', aliases: ['massenwirkung'], syntax: 'gleichgewicht(N2 + 3 H2 <=> 2 NH3; Kc=0,5; c(N2)=1 mol/L; c(H2)=3 mol/L) · gleichgewicht(R1; R2; K1=…; K2=…; c(…)=…)', text: 'Gleichgewichtskonzentrationen aus K und Anfangswerten; keine negativen Konzentrationen. Kp mit Drücken in bar; mehrere Reaktionen mit K1, K2 … werden gemeinsam gelöst.', example: 'gleichgewicht(N2 + 3 H2 <=> 2 NH3; Kc=0,5; c(N2)=1 mol/L; c(H2)=3 mol/L)', run: equilibriumCommand('solve') },
  { name: 'gleichgewichtskonstante', aliases: [], short: ['Kc', 'Kp'], syntax: 'gleichgewichtskonstante(N2 + 3 H2 <=> 2 NH3; c(N2)=0,4 mol/L; c(H2)=1,2 mol/L; c(NH3)=0,3 mol/L)', text: 'K aus Gleichgewichtswerten (oder Anfangswerten c0(…) mit einem bekannten Gleichgewichtswert).', example: 'gleichgewichtskonstante(N2 + 3 H2 <=> 2 NH3; c(N2)=0,4 mol/L; c(H2)=1,2 mol/L; c(NH3)=0,3 mol/L)', run: kcCommand('c') },
  { name: 'löslichkeit', aliases: ['loeslichkeit'], syntax: 'löslichkeit(AgCl) · löslichkeit(AgCl; c(Cl-)=0,1 mol/L) · löslichkeit(Mg(OH)2; pH=10)', text: 'Löslichkeit eines schwerlöslichen Salzes aus Ksp; mit gleichionigem Zusatz oder festem pH.', example: 'löslichkeit(AgCl)', run: (a) => { const { positional, options } = parseArgs(a); return solubility(positional[0], positional.slice(1), options); } },
  { name: 'löslichkeitsprodukt', aliases: ['loeslichkeitsprodukt'], short: ['Ksp'], syntax: 'Ksp(AgCl) · Ksp(Ag2CrO4; löslichkeit=1,3e-4 mol/L)', text: 'Löslichkeitsprodukt aus der Datenbank oder aus einer gemessenen Löslichkeit.', example: 'löslichkeitsprodukt(AgCl)', run: kspFromArgs },
  { name: 'fällung', aliases: ['faellung', 'niederschlag'], syntax: 'fällung(AgCl; AgNO3 0,001 mol/L 50 mL; NaCl 0,001 mol/L 50 mL)', text: 'Fällt beim Mischen ein Salz aus (Q gegen Ksp), und wie viel?', example: 'fällung(AgCl; AgNO3 0,001 mol/L 50 mL; NaCl 0,001 mol/L 50 mL)', run: (a) => { const { positional, options } = parseArgs(a); return precipitation(positional[0], positional.slice(1), options); } },
  // Elektrochemie
  { name: 'standardpotential', aliases: ['spannungsreihe', 'redoxpotential'], short: ['E0', 'E°'], syntax: 'standardpotential(Zn) · E0(Cu2+/Cu)', text: 'Standardelektrodenpotential eines Redoxpaars (25 °C, gegen die Wasserstoffelektrode).', example: 'standardpotential(Zn)', run: potentialFromArgs },
  { name: 'zellspannung', aliases: ['zelle', 'galvanischezelle'], syntax: 'zellspannung(Zn; Cu) · zellspannung(Zn2+/Zn; Cu2+/Cu; c(Zn2+)=0,1 mol/L; c(Cu2+)=0,01 mol/L)', text: 'Spannung einer galvanischen Zelle (Kathode, Anode, Zellreaktion, ΔG°, K); mit Konzentrationen nach Nernst.', example: 'zellspannung(Zn; Cu)', run: cellFromArgs },
  { name: 'nernst', syntax: 'nernst(Cu2+/Cu; c(Cu2+)=0,01 mol/L)', text: 'Nernst-Gleichung für eine Halbzelle.', example: 'nernst(Cu2+/Cu; c(Cu2+)=0,01 mol/L)', run: nernstFromArgs },
  { name: 'elektrolyse', aliases: ['faraday'], syntax: 'elektrolyse(Cu2+; I=2 A; t=30 min) · elektrolyse(Cu; m=1 g; I=2 A)', text: 'Faraday-Gesetz: Masse, Zeit oder Stromstärke bei der Elektrolyse.', example: 'elektrolyse(Cu2+; I=2 A; t=30 min)', run: electrolysisFromArgs },
  // Thermodynamik
  { name: 'reaktionsenthalpie', aliases: ['thermodynamik', 'enthalpie'], short: ['deltaH', 'dH', 'ΔH'], syntax: 'reaktionsenthalpie(CH4 + 2 O2 -> CO2 + 2 H2O; T=298 K)', text: 'ΔH°, ΔS°, ΔG°, K und Freiwilligkeit aus den Standard-Bildungsdaten.', example: 'reaktionsenthalpie(CH4 + O2 -> CO2 + H2O)', run: wrapThermo('H') },
  { name: 'reaktionsentropie', aliases: ['entropie'], short: ['deltaS', 'dS', 'ΔS'], syntax: 'reaktionsentropie(N2 + 3 H2 -> 2 NH3)', text: 'Reaktionsentropie ΔS° aus den Standardentropien.', example: 'reaktionsentropie(N2 + 3 H2 -> 2 NH3)', run: wrapThermo('S') },
  { name: 'freieenthalpie', aliases: ['gibbsenergie', 'freiereaktionsenthalpie'], short: ['deltaG', 'dG', 'ΔG'], syntax: 'freieenthalpie(CaCO3 -> CaO + CO2; T=1200 K)', text: 'Freie Reaktionsenthalpie ΔG (bei 298 K aus ΔfG°, sonst ΔH − T·ΔS).', example: 'freieenthalpie(CaCO3 -> CaO + CO2; T=1200 K)', run: wrapThermo('G') },
  { name: 'gibbs', aliases: ['gibbshelmholtz'], syntax: 'gibbs(ΔH=-92 kJ/mol; ΔS=-199 J/(mol·K); T=298 K) · gibbs(ΔG=-33 kJ/mol; T=298 K) · gibbs(K=1e5)', text: 'ΔG = ΔH − T·ΔS, K = exp(−ΔG/RT) und die Umschlagtemperatur.', example: 'gibbs(ΔH=-92 kJ/mol; ΔS=-199 J/(mol·K); T=298 K)', run: gibbsFromArgs },
  { name: 'hess', aliases: ['hessscher', 'satzvonhess'], syntax: 'hess(C + 1/2 O2 -> CO; C + O2 -> CO2 @ -393,5 kJ/mol; CO + 1/2 O2 -> CO2 @ -283 kJ/mol)', text: 'Satz von Hess: die Zielreaktion als exakte Kombination gegebener Reaktionen.', example: 'hess(C + 1/2 O2 -> CO; C + O2 -> CO2 @ -393,5 kJ/mol; CO + 1/2 O2 -> CO2 @ -283 kJ/mol)', run: hessFromArgs },
  { name: 'vanthoff', syntax: 'vanthoff(K=1e5; T1=298 K; T2=350 K; ΔH=-92 kJ/mol)', text: "Temperaturabhängigkeit von K (van 't Hoff).", example: 'vanthoff(K=1e5; T1=298 K; T2=350 K; ΔH=-92 kJ/mol)', run: vantHoffFromArgs },
  // Kinetik
  { name: 'kinetik', aliases: ['geschwindigkeitsgesetz'], syntax: 'kinetik(Ordnung=1; k=0,05 1/s; c0=0,8 mol/L; t=20 s)', text: 'Integrierte Geschwindigkeitsgesetze 0. bis 3. Ordnung: c(t), t, k, Halbwertszeit; k-Einheit wird geprüft.', example: 'kinetik(Ordnung=1; k=0,05 1/s; c0=0,8 mol/L; t=20 s)', run: kineticsFromArgs },
  { name: 'reaktionsordnung', aliases: ['ordnung'], syntax: 'reaktionsordnung(t=[0; 10; 20; 30] s; c=[1; 0,61; 0,37; 0,22] mol/L)', text: 'Bestimmt die Ordnung aus Messwerten: welche Linearisierung ist eine Gerade?', example: 'reaktionsordnung(t=[0; 10; 20; 30] s; c=[1; 0,61; 0,37; 0,22] mol/L)', run: orderFromData },
  { name: 'arrhenius', syntax: 'arrhenius(k1=0,01 1/s; T1=300 K; k2=0,1 1/s; T2=330 K)', text: 'Aktivierungsenergie und Geschwindigkeitskonstante nach Arrhenius, auch aus Messreihen.', example: 'arrhenius(k1=0,01 1/s; T1=300 K; k2=0,1 1/s; T2=330 K)', run: arrheniusFromArgs },
  // Gase
  { name: 'gasgesetz', aliases: ['idealesgas', 'idealgas'], syntax: 'gasgesetz(n=1 mol; T=273,15 K; p=101325 Pa)', text: 'Ideales Gasgesetz p·V = n·R·T nach der fehlenden Größe aufgelöst.', example: 'gasgesetz(n=1 mol; T=273,15 K; p=101325 Pa)', run: (a) => gasFromArgs('ideal', a) },
  { name: 'boyle', aliases: ['boylemariotte'], syntax: 'boyle(p1=1 bar; V1=10 L; p2=2 bar)', text: 'Gesetz von Boyle-Mariotte: p₁V₁ = p₂V₂.', example: 'boyle(p1=1 bar; V1=10 L; p2=2 bar)', run: (a) => gasFromArgs('boyle', a) },
  { name: 'charles', aliases: ['gaylussacvolumen'], syntax: 'charles(V1=1 L; T1=20 °C; T2=100 °C)', text: 'Gesetz von Gay-Lussac (Volumen): V₁/T₁ = V₂/T₂.', example: 'charles(V1=1 L; T1=20 °C; T2=100 °C)', run: (a) => gasFromArgs('charles', a) },
  { name: 'gaylussac', aliases: ['amontons'], syntax: 'gaylussac(p1=1 bar; T1=300 K; T2=350 K)', text: 'Gesetz von Amontons: p₁/T₁ = p₂/T₂.', example: 'gaylussac(p1=1 bar; T1=300 K; T2=350 K)', run: (a) => gasFromArgs('gaylussac', a) },
  { name: 'avogadro', syntax: 'avogadro(V1=22,4 L; n1=1 mol; n2=2 mol)', text: 'Gesetz von Avogadro: V₁/n₁ = V₂/n₂.', example: 'avogadro(V1=22,4 L; n1=1 mol; n2=2 mol)', run: (a) => gasFromArgs('avogadro', a) },
  { name: 'gasgleichung', aliases: ['allgemeinegasgleichung'], syntax: 'gasgleichung(p1=1 bar; V1=10 L; T1=300 K; p2=2 bar; T2=600 K)', text: 'Allgemeine Gasgleichung p₁V₁/T₁ = p₂V₂/T₂.', example: 'gasgleichung(p1=1 bar; V1=10 L; T1=300 K; p2=2 bar; T2=600 K)', run: (a) => gasFromArgs('combined', a) },
  { name: 'molvolumen', aliases: ['molaresvolumen'], syntax: 'molvolumen(T=298 K; p=1 bar)', text: 'Molares Volumen eines idealen Gases (ohne Angaben: Normbedingungen).', example: 'molvolumen()', run: (a) => gasFromArgs('molarvolume', a) },
  { name: 'gasdichte', syntax: 'gasdichte(CO2; T=25 °C; p=1 bar)', text: 'Dichte eines idealen Gases ρ = p·M/(R·T).', example: 'gasdichte(CO2; T=25 °C; p=1 bar)', run: (a) => gasFromArgs('density', a) },
  { name: 'vanderwaals', aliases: [], syntax: 'vanderwaals(Gas=CO2; n=1 mol; V=1 L; T=300 K)', text: 'Van-der-Waals-Gleichung: p, V, T oder n; Vergleich mit dem idealen Gas.', example: 'vanderwaals(Gas=CO2; n=1 mol; V=1 L; T=300 K)', run: (a) => gasFromArgs('vdw', a) },
  { name: 'isotherme', syntax: 'isotherme(Gas=CO2; n=1 mol; T=280 K)', text: 'p-V-Diagramm eines realen Gases (van der Waals) neben dem idealen Gas; kritische Daten.', example: 'isotherme(Gas=CO2; n=1 mol; T=280 K)', run: isothermFromArgs },
];

const BY_NAME = new Map();
for (const c of CHEM_COMMANDS) {
  BY_NAME.set(c.name.toLowerCase(), c);
  for (const alias of c.aliases || []) if (!BY_NAME.has(alias.toLowerCase())) BY_NAME.set(alias.toLowerCase(), c);
}

/** Case-sensitive short forms: pH, pOH, Ka, Kb, Ksp, M, n, m, c, V, E0, dH … */
const SHORT = new Map();
for (const c of CHEM_COMMANDS) for (const s of c.short || []) SHORT.set(s, c);
const SHORT_KA = { Ka: 'Ka', pKa: 'pKa', Kb: 'Kb', pKb: 'pKb' };

/** A short form that names a single letter and could just as well be a variable of the mathematics */
const AMBIGUOUS = new Set(['M', 'n', 'm', 'c', 'V', 'E0', 'dH', 'dS', 'dG', 'Kc', 'ΔH', 'ΔS', 'ΔG', 'deltaH', 'deltaS', 'deltaG']);
const NEEDS_ARGUMENTS = new Set(['M', 'n', 'm', 'c', 'V']);

/** The catalog entries for the command search (no functions) */
export const CHEM_CATALOG = CHEM_COMMANDS.map(({ name, aliases, syntax, text, example, short }) => ({ name, aliases: aliases || [], cat: 'Chemie', syntax, text: short ? `${text} (Kurzform: ${short.join(', ')})` : text, example, chem: true }));

/** The chemistry command a name means, or null */
export function chemCommand(name) {
  return BY_NAME.get(String(name).toLowerCase()) || SHORT.get(String(name)) || null;
}

// ------------------------------------------------------------------------------------------ the engine hook

const CALL = /^\s*([A-Za-zÄÖÜäöüß°Δ][A-Za-zÄÖÜäöüß0-9°Δ²]*)\s*\(([\s\S]*)\)\s*$/;

/** The engine's answer for a chemistry result: a table-like "analysis" with rows, steps, warnings and a plot */
export function toEngineResult(res) {
  const all = toRows(res, { steps: false });
  return {
    ok: true,
    kind: 'analysis',
    title: res.title,
    rows: all,
    steps: res.steps.map((s) => ({ label: s.label, lines: s.lines.map((l) => ({ latex: l.latex, text: l.text })) })),
    table: res.table,
    chart: null,
    shapes: plotShapes(res.plot),
    actions: res.actions,
    chem: res.toJSON(),
    chemResult: res,
  };
}

function failure(error) {
  const r = errorResult(error);
  return { ok: false, error: r.error, code: r.code };
}

/** Whether some word of the text is a formula or a name from the substance database */
function mentionsSubstance(text) {
  const words = String(text).match(/[A-Za-zÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß()\[\]^+\-·.]*/g) || [];
  return words.some((w) => {
    try {
      resolve(w.replace(/[.,;:]+$/, ''));
      return true;
    } catch (e) {
      return false;
    }
  });
}

function runCall(name, argsText, defined) {
  const cmd = chemCommand(name);
  if (!cmd) return null;
  const isShort = SHORT.has(name) && !BY_NAME.has(name.toLowerCase());
  const ambiguous = isShort && AMBIGUOUS.has(name);
  if (defined && defined.has(name)) return null;
  if (NEEDS_ARGUMENTS.has(name) && !argsText.trim()) return null;
  const args = splitArgs(argsText);
  // A short name is chemistry only when an argument names a substance; otherwise it is mathematics (n(5), c(t), M(x))
  if (ambiguous && !mentionsSubstance(argsText)) return null;
  // Ka(…) and its relatives run the constant lookup with their own kind
  let run = cmd.run;
  if (SHORT_KA[name]) run = (a) => constantCommand(SHORT_KA[name], a);
  else if (name === 'Kp') run = kcCommand('p');
  else if (name === 'ΔS' || name === 'dS' || name === 'deltaS') run = wrapThermo('S');
  else if (name === 'ΔG' || name === 'dG' || name === 'deltaG') run = wrapThermo('G');
  try {
    const out = toEngineResult(run(args));
    out.call = { name, args };
    return out;
  } catch (e) {
    if (e instanceof ChemError) {
      return failure(e);
    }
    return failure(new ChemError('CHEM_SYNTAX', 'Die Eingabe ist nicht lesbar.'));
  }
}

/**
 * Runs a chemistry input if it is one. `input` is { text } or { latex }. Returns null for anything else, so the
 * mathematics takes it; otherwise { ok, kind: 'analysis', … } or { ok: false, error, code }.
 * `defined` is the set of names the student has defined (M = 5 makes M(…) a product, not the molar mass).
 */
export function runChemistry(input, defined) {
  let text = input.text !== undefined ? String(input.text) : null;
  if (text === null) {
    if (!input.latex) return null;
    text = chemLatexToText(input.latex);
  }
  const t = text.trim();
  if (!t || /^\s*(programm|def\b)/i.test(t)) return null;
  const call = CALL.exec(t);
  if (call) {
    const [, name, args] = call;
    const found = runCall(name, args, defined);
    if (found) return found;
    // a call of something else that contains a bare reaction ("ausgleichen" is handled above)
    return null;
  }
  // a bare reaction equation: balance it (a redox skeleton falls back to the redox balancing)
  if (/->|→|⇌|<=>|⇄|=>|<->|=/.test(t) && !/[a-z]{4,}\s*=/.test(t) && isReaction(t)) {
    try {
      return toEngineResult(balanceCommand([t]));
    } catch (e) {
      return e instanceof ChemError ? failure(e) : null;
    }
  }
  // a sentence about chemistry
  if (/\s/.test(t) && !/[=<>+*^]/.test(t.replace(/[-+][\d.]/g, ''))) {
    const intent = parseChemicalIntent(t);
    if (intent.intent !== 'unknown' && intent.command) {
      const call2 = CALL.exec(intent.command);
      if (call2) {
        const r = runCall(call2[1], call2[2], defined);
        if (r) return { ...r, understood: intent.command };
      }
    }
  }
  return null;
}

/**
 * Chemistry calls inside a mathematical expression — 2*M(NaCl) or 0,5*V(H2; 1 mol) — are replaced by their number,
 * so the mathematics can go on with it. Returns { text, parts: [{ call, value, unit }] } or null when nothing was replaced.
 */
export function substituteChemistry(text, defined) {
  if (text && typeof text === 'object') {
    // LaTeX of the formula editor: only plain chemistry notation is read, anything else stays mathematics
    const plain = text.latex ? chemLatexToText(text.latex, { strict: true }) : null;
    return plain ? substituteChemistry(plain.replace(/·/g, '*'), defined) : null;
  }
  const source = String(text);
  const parts = [];
  let out = '';
  let i = 0;
  const isStart = (c) => /[A-Za-zÄÖÜäöüß°Δ]/.test(c);
  while (i < source.length) {
    if (isStart(source[i]) && (i === 0 || !/[A-Za-zÄÖÜäöüß0-9_.]/.test(source[i - 1]))) {
      const m = /^[A-Za-zÄÖÜäöüß°Δ][A-Za-zÄÖÜäöüß0-9°Δ²]*/.exec(source.slice(i));
      const name = m[0];
      const open = i + name.length;
      if (source[open] === '(' && chemCommand(name) && !(defined && defined.has(name))) {
        let depth = 0;
        let j = open;
        for (; j < source.length; j++) {
          if (source[j] === '(') depth++;
          else if (source[j] === ')' && --depth === 0) break;
        }
        if (j < source.length) {
          const call = source.slice(i, j + 1);
          const r = runCall(name, source.slice(open + 1, j), defined);
          const main = r && r.ok && r.chemResult && r.chemResult.result;
          if (main && Number.isFinite(main.value)) {
            parts.push({ call, value: main.value, unit: main.unit || '' });
            out += `(${Number(main.value.toPrecision(15))})`;
            i = j + 1;
            continue;
          }
        }
      }
      out += name;
      i += name.length;
      continue;
    }
    out += source[i++];
  }
  return parts.length ? { text: out, parts } : null;
}

export { chemLatexToText, parseChemicalIntent, L, formatFormula, parseFormula, latexOf, lg };

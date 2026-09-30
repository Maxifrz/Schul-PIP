// Titration curves: pH as a function of the added volume, for strong and weak, mono- and polyprotic acids and bases titrated
// with a strong base or acid. Each point is the exact charge-balance solution of the mixture (the same solver as pH),
// so buffer region, half-equivalence point, equivalence point and the excess region come out of one calculation.

import { ChemicalResult, L } from './result.js';
import { resolve, parseGiven, amountFrom, latexOf } from './amounts.js';
import { systemsOf, solveSolution, kwAt } from './acidbase.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';
import { DEFAULT_TEMPERATURE } from './constants.js';

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

/** How much steeper than the buffer region an equivalence point must be to count as a jump */
const RATIO = 1.8;

const INDICATORS = [
  ['Methylorange', 3.1, 4.4],
  ['Methylrot', 4.4, 6.2],
  ['Bromthymolblau', 6.0, 7.6],
  ['Phenolphthalein', 8.2, 10.0],
  ['Thymolphthalein', 9.3, 10.5],
];

/** pH of the mixture of the analyte amount `nA` and titrant amount `nT` in the volume `V` (L) */
function mixturePH(analyte, titrant, nA, nT, V, Kw) {
  const systems = [];
  const spectators = [];
  const add = (sub, n) => {
    const s = systemsOf(sub, n / V);
    for (const sys of s.systems) {
      const same = systems.find((x) => x.key === sys.key);
      if (same) {
        same.C += sys.C;
        same.contributions.push(...sys.contributions);
      } else systems.push(sys);
    }
    spectators.push(...s.spectators);
  };
  add(analyte, nA);
  if (nT > 0) add(titrant, nT);
  return solveSolution(systems, spectators, Kw);
}

/**
 * Titration. args: analyte "CH3COOH 0,1 mol/L 25 mL" (or with mass) and titrant "NaOH 0,1 mol/L"; options: Vmax=…
 */
export function titration(analyteText, titrantText, options = {}) {
  const ga = parseGiven(analyteText);
  const gt = parseGiven(titrantText);
  if (!ga.substance || !gt.substance) fail('CHEM_SYNTAX', 'Schreibweise: titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)');
  const analyte = resolve(ga.substance);
  const titrant = resolve(gt.substance);
  const cA = ga.quantities.find((q) => q.is('concentration'));
  const VA = ga.quantities.find((q) => q.is('volume'));
  const cT = gt.quantities.find((q) => q.is('concentration'));
  if (!VA) fail('CHEM_MISSING_CONSTANT', 'Es fehlt das Volumen der vorgelegten Lösung, z. B. 25 mL.');
  if (!cT) fail('CHEM_MISSING_CONSTANT', 'Es fehlt die Konzentration der Maßlösung, z. B. NaOH 0,1 mol/L.');
  const V0 = VA.in('L');
  let n0;
  if (cA) n0 = cA.in('mol/L') * V0;
  else n0 = amountFrom(analyte, ga.quantities.filter((q) => !q.is('volume')), {}).n;
  const ct = cT.in('mol/L');
  const T = options.T ? Quantity.parse(options.T).need('temperature', 'die Temperatur').si : DEFAULT_TEMPERATURE;
  const { Kw } = kwAt(T);

  const res = new ChemicalResult('titration', 'Titrationskurve');
  // what the titrant is: a strong base adds cations, a strong acid adds anions
  const tSystems = systemsOf(titrant, 1);
  const titrantBase = tSystems.spectators.some((s) => s.charge > 0 && s.source === 'strong');
  const titrantAcid = tSystems.spectators.some((s) => s.charge < 0 && s.source === 'strong');
  if (!titrantBase && !titrantAcid) fail('CHEM_OUTSIDE_MODEL', `${titrant.label} ist keine starke Säure oder Base; als Maßlösung werden starke Säuren und Basen unterstützt.`);
  const aSystems = systemsOf(analyte, n0 / V0);
  const sys = aSystems.systems[0];
  const k0 = sys ? Math.max(sys.contributions[0].k, 0) : 0;
  const strongAcidic = aSystems.kind === 'strongAcid' && !sys;
  const strongBasic = aSystems.kind === 'strongBase';
  const ionsOfAnalyte = analyte.entry && analyte.entry.ions ? analyte.entry.ions : [];
  const strongHydroxide = ionsOfAnalyte.find((i) => i.formula === 'OH-');
  // protons the analyte can give (titrant base) or take (titrant acid)
  const strongProtons = strongAcidic ? 1 : analyte.entry && analyte.entry.acidBase && analyte.entry.acidBase.strong && sys ? 1 : 0;
  let stages;
  let factor = 1;
  if (titrantBase) {
    stages = (sys ? sys.pKa.length - k0 : 0) + strongProtons;
    if (strongAcidic && !sys) stages = 1;
  } else {
    stages = sys ? k0 : 0;
    if (strongBasic) {
      stages += 1;
      factor = strongHydroxide ? strongHydroxide.n : 1;
    }
  }
  if (stages < 1) fail('CHEM_OUTSIDE_MODEL', `${analyte.label} ${titrantBase ? 'gibt' : 'nimmt'} kein Proton ${titrantBase ? 'ab' : 'auf'}, das mit ${titrant.label} titriert werden könnte.`);
  if (sys && strongBasic) factor = 1;

  res.step('Vorlage und Maßlösung', L(`${latexOf(analyte)}: ${fmtL(n0 / V0)}\\,\\mathrm{mol/L}\\cdot ${fmtL(V0 * 1000)}\\,\\mathrm{mL} = ${fmtL(n0)}\\,\\mathrm{mol};\\quad ${latexOf(titrant)}: ${fmtL(ct)}\\,\\mathrm{mol/L}`, `${analyte.label}: n = ${fmt(n0)} mol; ${titrant.label}: c = ${fmt(ct)} mol/L`));
  res.assume('Ideale Lösung; Volumina additiv; 25 °C, wenn nichts anderes angegeben ist.');
  res.assume('pH-Werte sind exakte Lösungen der Ladungsbilanz an jedem Punkt der Kurve.');

  const Veq = (k) => ((k * n0 * factor) / ct) * 1000; // mL
  const last = Veq(stages);
  const Vmax = options.Vmax ? Quantity.parse(options.Vmax).need('volume', 'Vmax').in('mL') : last * 1.6;
  const points = [];
  const N = 400;
  for (let i = 0; i <= N; i++) {
    const v = (Vmax * i) / N; // mL
    const sol = mixturePH(analyte, titrant, n0, (ct * v) / 1000, V0 + v / 1000, Kw);
    points.push([v, sol.pH]);
  }
  // equivalence points: the stoichiometric volumes k·V_eq that show a jump (the steepest points of the curve)
  const pHAt = (v) => mixturePH(analyte, titrant, n0, (ct * v) / 1000, V0 + v / 1000, Kw).pH;
  const equivalence = [];
  const slopeAt = (v) => (pHAt(v * 1.004) - pHAt(v * 0.996)) / (0.008 * v);
  const candidates = [];
  for (let k = 1; k <= stages; k++) {
    const v = Veq(k);
    const from = k === 1 ? 0 : Veq(k - 1);
    const buffer = [0.3, 0.4, 0.5, 0.6, 0.7].map((f) => Math.abs(slopeAt(from + f * (v - from)))).sort((x, y) => x - y)[2];
    const ratio = Math.abs(slopeAt(v)) / Math.max(Math.abs(buffer), 1e-9);
    candidates.push({ k, V: v, pH: pHAt(v), ratio });
  }
  // an equivalence point is a jump: the curve is much steeper there than in the buffer region before it
  for (const c of candidates) {
    if (stages === 1 || c.ratio > RATIO) equivalence.push(c);
    else res.warn('CHEM_OUTSIDE_MODEL', `Der ${c.k}. Äquivalenzpunkt (${fmt(c.V)} mL) ist kein deutlicher Sprung; die Stufe lässt sich nicht getrennt titrieren.`);
  }
  if (!equivalence.length) equivalence.push([...candidates].sort((x, y) => y.ratio - x.ratio)[0]);
  res.step('Äquivalenzvolumen', ...equivalence.map((e) => L(`V_{\\ddot{A}${e.k > 1 || stages > 1 ? e.k : ''}} = \\frac{${e.k}\\cdot n_0}{c_T} = ${fmtL(e.V)}\\,\\mathrm{mL}`, `V(ÄP${stages > 1 ? e.k : ''}) = ${e.k}·n0/c(Maßlösung) = ${fmt(e.V)} mL`)));
  // characteristic points
  const half = [];
  const startSol = mixturePH(analyte, titrant, n0, 0, V0, Kw);
  res.step('Anfangs-pH (0 mL)', L(`\\mathrm{pH} = ${fmtL(startSol.pH)}`, `pH = ${fmt(startSol.pH)}`));
  for (let k = 1; k <= stages; k++) {
    const v = Veq(k) - Veq(1) / 2;
    if (sys && sys.pKa.length && !strongProtons) {
      const pKaIdx = titrantBase ? k0 + k - 1 : k0 - k;
      const pKa = sys.pKa[pKaIdx];
      if (pKa !== undefined) {
        const hp = pHAt(v);
        half.push({ V: v, pH: hp, pKa });
        res.step(`Halbäquivalenzpunkt ${stages > 1 ? k + '. Stufe ' : ''}(${fmt(v)} mL)`, L(`\\mathrm{pH} = ${fmtL(hp)}\\ \\approx\\ \\mathrm{p}K_a = ${fmtL(pKa)}\\quad(c(\\mathrm{HA}) = c(\\mathrm{A^-}))`, `pH = ${fmt(hp)} ≈ pKa = ${fmt(pKa)} (c(HA) = c(A-))`));
      }
    }
  }
  for (const e of equivalence) res.step(`Äquivalenzpunkt${stages > 1 ? ' ' + e.k : ''} (${fmt(e.V)} mL)`, L(`\\mathrm{pH} = ${fmtL(e.pH)}`, `pH = ${fmt(e.pH)}`));
  const extra = pHAt(last * 1.5);
  res.step('Überschuss der Maßlösung', L(`\\mathrm{pH}(${fmtL(last * 1.5)}\\,\\mathrm{mL}) = ${fmtL(extra)}`, `pH(${fmt(last * 1.5)} mL) = ${fmt(extra)}`));

  // indicators for the (last) equivalence point
  const eqLast = equivalence[equivalence.length - 1];
  const upper = pHAt(eqLast.V * 1.001);
  const lower = pHAt(eqLast.V * 0.999);
  const lo = Math.min(upper, lower);
  const hi = Math.max(upper, lower);
  const suitable = INDICATORS.filter(([, a, b]) => (a + b) / 2 >= lo - 0.3 && (a + b) / 2 <= hi + 0.3).map(([name, a, b]) => `${name} (${fmt(a, 2)}–${fmt(b, 2)})`);
  res.step('Geeignete Indikatoren (Umschlag im Sprungbereich)', L(`\\text{Sprung im Bereich pH ${fmt(lo, 3)} bis ${fmt(hi, 3)}: ${suitable.join(', ') || 'kein Standardindikator'}}`, `Sprung im Bereich pH ${fmt(lo, 3)} bis ${fmt(hi, 3)}: ${suitable.join(', ') || 'kein Standardindikator'}`));
  if (!suitable.length) res.warn('CHEM_OUTSIDE_MODEL', 'Für diesen Sprung passt kein Standardindikator; besser ist eine pH-Messung.');

  res.answer(new Quantity(eqLast.V, 'mL'), { name: 'Vₑ' });
  res.result.latex = `V_{\\mathrm{\\ddot{A}}} = ${fmtL(eqLast.V)}\\,\\mathrm{mL}`;
  equivalence.forEach((e) => {
    res.value(`Äquivalenzvolumen${stages > 1 ? ' ' + e.k : ''}`, new Quantity(e.V, 'mL'));
    res.value(`pH am Äquivalenzpunkt${stages > 1 ? ' ' + e.k : ''}`, new Quantity(e.pH, ''));
  });
  half.forEach((h, i) => res.value(`pH am Halbäquivalenzpunkt${stages > 1 ? ' ' + (i + 1) : ''}`, new Quantity(h.pH, '')));
  res.value('Anfangs-pH', new Quantity(startSol.pH, ''));
  res.value('Geeignete Indikatoren', { text: suitable.join(', ') || 'keine', latex: `\\text{${suitable.join(', ') || 'keine'}}` });
  // a table of selected points
  const sample = [0, 0.25, 0.5, 0.75, 0.9, 0.99, 1, 1.01, 1.1, 1.5].map((f) => f * Veq(1));
  res.table = { head: ['V in mL', 'pH'], rows: sample.filter((v) => v <= Vmax + 1e-9).map((v) => [fmtL(v), fmtL(pHAt(v))]) };
  res.plot = { kind: 'titration', points, equivalence: equivalence.map((e) => ({ V: e.V, pH: e.pH })), half: half.map((h) => ({ V: h.V, pH: h.pH })), titrant: titrant.label };
  res.chemistry = { equivalence, half, start: startSol.pH, stages };
  return res;
}

export function titrationFromArgs(args) {
  const { positional, options } = parseArgs(args);
  if (positional.length < 2) fail('CHEM_SYNTAX', 'Schreibweise: titration(CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L)');
  return titration(positional[0], positional[1], options);
}


import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cellFromArgs, nernstFromArgs, electrolysisFromArgs, potentialFromArgs, findCouple, nernstHalf, COUPLES } from '../../src/chem/electro.js';
import { reactionThermo, gibbsFromArgs, hessFromArgs, vantHoffFromArgs } from '../../src/chem/thermo.js';
import { kineticsFromArgs, orderFromData, arrheniusFromArgs, rateConstant, concentrationAt, timeFor, halfLife, kUnit } from '../../src/chem/kinetics.js';
import { gasFromArgs, vdwPressure, vdwVolumes, vdwConstants } from '../../src/chem/gas.js';
import { titrationFromArgs } from '../../src/chem/titration.js';
import { distributionFromArgs, isothermFromArgs } from '../../src/chem/diagrams.js';
import { plotShapes } from '../../src/chem/plots.js';
import { Quantity } from '../../src/chem/quantity.js';
import { splitArgs, parseArgs } from '../../src/chem/args.js';
import { linearFit, bisect, solveLinearFloat } from '../../src/chem/numeric.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps * Math.max(1, Math.abs(b)), `${a} ≠ ${b}`);
const A = (text) => splitArgs(text);
const code = (f) => {
  try {
    f();
  } catch (e) {
    return e.code;
  }
  return null;
};
const R = 8.314462618;
const F = 96485.33212;

test('galvanic cells: Daniell element and friends', () => {
  const daniell = cellFromArgs(A('Zn; Cu'));
  close(daniell.result.value, 1.1, 1e-12);
  assert.equal(daniell.chemistry.cathode, 'Cu2+/Cu');
  assert.equal(daniell.chemistry.anode, 'Zn2+/Zn');
  assert.equal(daniell.chemistry.z, 2);
  assert.equal(daniell.chemistry.equation, 'Cu^2+ + Zn -> Cu + Zn^2+');
  close(daniell.chemistry.dG0, -2 * F * 1.1, 1e-9);
  close(daniell.chemistry.K, Math.exp((2 * F * 1.1) / (R * 298.15)), 1e-9);
  // order of the arguments does not matter
  close(cellFromArgs(A('Cu; Zn')).result.value, 1.1, 1e-12);
  close(cellFromArgs(A('Cu; Ag')).result.value, 0.46, 1e-12);
  // electrons are matched: 2 Al + 3 Cu2+
  const al = cellFromArgs(A('Al; Cu'));
  assert.equal(al.chemistry.z, 6);
  assert.match(al.chemistry.equation, /^3 Cu\^2\+ \+ 2 Al -> 3 Cu \+ 2 Al\^3\+$/);
  // a permanganate cell in acid
  const mn = cellFromArgs(A('Fe2+/Fe3+; MnO4-/Mn2+; pH=0'));
  close(mn.result.value, 1.51 - 0.77, 1e-9);
  assert.equal(mn.chemistry.z, 5);
  assert.equal(code(() => cellFromArgs(A('Zn; Zn'))), 'CHEM_NO_SOLUTION');
  assert.equal(code(() => cellFromArgs(A('Zn'))), 'CHEM_SYNTAX');
  assert.equal(code(() => cellFromArgs(A('Zn; Xx'))), 'CHEM_UNKNOWN_SUBSTANCE');
  assert.equal(code(() => cellFromArgs(A('Zn; Cu; c(Cu2+)=1 g'))), 'CHEM_UNIT_MISMATCH');
});

test('Nernst: half-cells and cells with concentrations', () => {
  const E = (t) => nernstFromArgs(A(t)).result.value;
  close(E('Cu2+/Cu; c(Cu2+)=1 mol/L'), 0.34, 1e-12);
  close(E('Cu2+/Cu; c(Cu2+)=0,01 mol/L'), 0.34 + ((R * 298.15) / (2 * F)) * Math.log(0.01), 1e-12);
  close(E('H+/H2; pH=7'), -((R * 298.15) / F) * Math.log(1e7), 1e-9);
  const cell = cellFromArgs(A('Zn2+/Zn; Cu2+/Cu; c(Zn2+)=0,1 mol/L; c(Cu2+)=0,01 mol/L'));
  close(cell.result.value, 1.1 - ((R * 298.15) / (2 * F)) * Math.log(0.1 / 0.01), 1e-9);
  // a gas at a partial pressure
  const h2 = nernstFromArgs(A('H+/H2; c(H+)=1 mol/L; p(H2)=2 bar'));
  close(h2.result.value, -((R * 298.15) / (2 * F)) * Math.log(2), 1e-9);
  // the electrodes swap when the concentrations demand it
  const swapped = cellFromArgs(A('Zn2+/Zn; Cu2+/Cu; c(Zn2+)=1 mol/L; c(Cu2+)=1e-40 mol/L'));
  assert.ok(swapped.warnings.some((w) => /kehren sich/.test(w.message)));
  assert.equal(nernstHalf(findCouple('Zn'), new Map()).E, -0.76);
  // temperature enters
  assert.ok(nernstFromArgs(A('Cu2+/Cu; c(Cu2+)=0,01 mol/L; T=350 K')).result.value < E('Cu2+/Cu; c(Cu2+)=0,01 mol/L'));
});

test('the redox series is ordered and every couple is usable', () => {
  assert.ok(findCouple('Zn').E0 < findCouple('Cu').E0);
  assert.equal(findCouple('Zn2+/Zn').pair, 'Zn2+/Zn');
  assert.equal(findCouple('Zn/Zn2+').pair, 'Zn2+/Zn');
  assert.equal(findCouple('Fe').pair, 'Fe2+/Fe');
  assert.equal(findCouple('Cl2').pair, 'Cl2/Cl-');
  assert.equal(findCouple('Ag+').pair, 'Ag+/Ag');
  assert.equal(potentialFromArgs(A('Zn')).result.value, -0.76);
  for (const c of COUPLES) {
    const q = nernstHalf(c, new Map());
    assert.equal(q.E, c.E0, c.pair);
  }
});

test('Faraday: mass, time, current, gas volume', () => {
  const m = electrolysisFromArgs(A('Cu2+; I=2 A; t=30 min')).result.value;
  close(m, (63.546 * 2 * 1800) / (2 * F), 1e-9);
  close(electrolysisFromArgs(A('Cu; m=1 g; I=2 A')).result.value, (1 / 63.546) * 2 * F / 2, 1e-9);
  close(electrolysisFromArgs(A('Ag+; m=1 g; t=10 min')).result.value, ((1 / 107.8682) * F) / 600, 1e-9);
  const cl2 = electrolysisFromArgs(A('Cl2; I=1 A; t=1 h'));
  close(cl2.result.value, (70.906 * 3600) / (2 * F), 1e-4);
  const h2 = electrolysisFromArgs(A('H2; I=1 A; t=1 h'));
  assert.ok(h2.values['V (ideales Gas)'].value > 0);
  assert.equal(code(() => electrolysisFromArgs(A('Cu2+; I=2 A'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => electrolysisFromArgs(A('Cu2+; I=2 A; t=30 min; m=1 g'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => electrolysisFromArgs(A('Cu2+; I=2 s; t=30 min'))), 'CHEM_UNIT_MISMATCH');
});

test('thermodynamics from formation data', () => {
  const r = (t, o = {}) => {
    const { positional, options } = parseArgs(A(t));
    return reactionThermo(positional[0], { ...options, ...o });
  };
  const ch4 = r('CH4 + O2 -> CO2 + H2O');
  close(ch4.result.value, -393.51 + 2 * -285.83 + 74.81, 1e-3);
  const nh3 = r('N2 + H2 -> NH3');
  close(nh3.result.value, 2 * -46.11, 1e-9);
  close(nh3.values['ΔS°'].value, 2 * 192.45 - 191.61 - 3 * 130.68, 1e-9);
  close(nh3.values['ΔG°'].value, 2 * -16.45, 1e-9);
  close(nh3.values.K.value, Math.exp((32.9e3) / (R * 298.15)), 1e-9);
  // ΔG = ΔH − T·ΔS agrees with the tabulated ΔfG within table accuracy
  const check = nh3.result.value - (298.15 * nh3.values['ΔS°'].value) / 1000;
  close(check, nh3.values['ΔG°'].value, 0.01);
  // temperature changes ΔG and the direction
  const hot = r('CaCO3 -> CaO + CO2; T=1200 K');
  assert.ok(hot.values['ΔG (1200 K)'].value < 0);
  assert.ok(r('CaCO3 -> CaO + CO2').values['ΔG°'].value > 0);
  close(hot.values.Umschlagtemperatur.value, (178.32 * 1000) / hot.values['ΔS°'].value, 1e-6);
  assert.equal(code(() => r('Xe + F2 -> XeF2')), 'CHEM_DATA_UNAVAILABLE');
  assert.equal(code(() => r('C6H12O6(g) -> C6H12O6(s)')), 'CHEM_DATA_UNAVAILABLE');
  assert.equal(code(() => r('2 H2 + O2 -> H2O')), 'CHEM_UNBALANCED_REACTION');
});

test('Gibbs-Helmholtz, van \'t Hoff and Hess', () => {
  const g = gibbsFromArgs(A('ΔH=-92 kJ/mol; ΔS=-199 J/(mol·K); T=298 K'));
  close(g.result.value, -92 + (298 * 199) / 1000, 1e-9);
  close(g.values.K.value, Math.exp((-g.result.value * 1000) / (R * 298)), 1e-9);
  close(g.values.Umschlagtemperatur.value, (-92000) / -199, 1e-9);
  close(gibbsFromArgs(A('K=1e5; T=298 K')).result.value, (-R * 298 * Math.log(1e5)) / 1000, 1e-9);
  close(gibbsFromArgs(A('ΔG=-33 kJ/mol; T=298 K')).result.value, Math.exp(33000 / (R * 298)), 1e-9);
  assert.equal(code(() => gibbsFromArgs(A('ΔH=-92 kJ; T=298 K'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => gibbsFromArgs(A('ΔH=-92 K; ΔS=-199 J/(mol·K)'))), 'CHEM_UNIT_MISMATCH');
  close(vantHoffFromArgs(A('K=1e5; T1=298 K; T2=350 K; ΔH=-92 kJ/mol')).result.value, 1e5 * Math.exp((92000 / R) * (1 / 350 - 1 / 298)), 1e-9);
  const hess = hessFromArgs(A('C + 1/2 O2 -> CO; C + O2 -> CO2 @ -393,5 kJ/mol; CO + 1/2 O2 -> CO2 @ -283 kJ/mol'));
  close(hess.result.value, -110.5, 1e-12);
  const h2 = hessFromArgs(A('C + 2 H2 -> CH4; C + O2 -> CO2 @ -393,5 kJ/mol; H2 + 1/2 O2 -> H2O @ -285,8 kJ/mol; CH4 + 2 O2 -> CO2 + 2 H2O @ -890,4 kJ/mol'));
  close(h2.result.value, -393.5 + 2 * -285.8 + 890.4, 1e-9);
  assert.equal(code(() => hessFromArgs(A('C + O2 -> CO2; H2 + O2 -> H2O2 @ -100 kJ/mol'))), 'CHEM_NO_SOLUTION');
  assert.equal(code(() => hessFromArgs(A('C + O2 -> CO2; C + O2 -> CO2 @ -393 kJ/mol; C + O2 -> CO2 @ -393 kJ/mol'))), 'CHEM_MULTIPLE_SOLUTIONS');
  assert.equal(code(() => hessFromArgs(A('C + O2 -> CO2; C + O2 -> CO2'))), 'CHEM_SYNTAX');
});

test('kinetics: the integrated laws invert each other', () => {
  for (const n of [0, 1, 2, 3]) {
    const k = 0.05;
    const c0 = 2;
    const t = 4;
    const c = concentrationAt(n, k, c0, t);
    close(timeFor(n, k, c0, c), t, 1e-9);
    close(concentrationAt(n, k, c0, halfLife(n, k, c0)), c0 / 2, 1e-9);
    assert.ok(c < c0 && c > 0);
  }
  close(halfLife(1, 0.05, 1), Math.LN2 / 0.05, 1e-12);
  close(halfLife(2, 0.5, 1), 2, 1e-12);
  const r = kineticsFromArgs(A('Ordnung=1; k=0,05 1/s; c0=0,8 mol/L; t=20 s'));
  close(r.result.value, 0.8 * Math.exp(-1), 1e-12);
  close(kineticsFromArgs(A('Ordnung=2; k=0,5 L/(mol·s); c0=1 mol/L; c=0,25 mol/L')).result.value, 6, 1e-12);
  close(kineticsFromArgs(A('Ordnung=1; c0=1 mol/L; c=0,5 mol/L; t=693 s')).result.value, Math.LN2 / 693, 1e-12);
  close(kineticsFromArgs(A('Ordnung=3; k=2 L^2/(mol^2·s); c0=1 mol/L; t=1 s')).result.value, 1 / Math.sqrt(5), 1e-12);
  assert.equal(kUnit(2), 'L/(mol·s)');
  assert.equal(code(() => kineticsFromArgs(A('Ordnung=2; k=0,5 1/s; c0=1 mol/L; c=0,25 mol/L'))), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => kineticsFromArgs(A('Ordnung=5; k=1 1/s; c0=1 mol/L; t=1 s'))), 'CHEM_OUTSIDE_MODEL');
  assert.equal(code(() => kineticsFromArgs(A('k=1 1/s; c0=1 mol/L; t=1 s'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => kineticsFromArgs(A('Ordnung=1; k=1 1/s; c0=1 mol/L'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => kineticsFromArgs(A('Ordnung=1; k=1 1/s; c0=1 mol/L; c=2 mol/L'))), 'CHEM_NEGATIVE_CONCENTRATION');
  assert.ok(kineticsFromArgs(A('Ordnung=0; k=0,1 mol/(L·s); c0=1 mol/L; t=20 s')).warnings.length === 1);
  close(rateConstant(new Quantity(2, 'L/(mol·min)'), 2), 2 / 60, 1e-12);
});

test('kinetics: the order is recovered from data', () => {
  const ts = [0, 5, 10, 15, 20, 25, 30];
  const series = (f) => `t=[${ts.join('; ')}] s; c=[${ts.map((t) => String(f(t).toFixed(6)).replace('.', ',')).join('; ')}] mol/L`;
  const first = orderFromData(A(series((t) => Math.exp(-0.08 * t))));
  assert.equal(first.result.n, 1);
  close(first.values.k.value, 0.08, 1e-4);
  const second = orderFromData(A(series((t) => 1 / (1 + 0.5 * t))));
  assert.equal(second.result.n, 2);
  close(second.values.k.value, 0.5, 1e-4);
  const zero = orderFromData(A(series((t) => 1 - 0.02 * t)));
  assert.equal(zero.result.n, 0);
  close(zero.values.k.value, 0.02, 1e-4);
  const third = orderFromData(A(series((t) => 1 / Math.sqrt(1 + 2 * 0.1 * t))));
  assert.equal(third.result.n, 3);
  close(third.values.k.value, 0.1, 1e-3);
  assert.equal(code(() => orderFromData(A('t=[0; 1] s; c=[1; 0,5] mol/L'))), 'CHEM_NO_SOLUTION');
  assert.equal(code(() => orderFromData(A('t=[0; 1; 2] s; c=[1; 0,5] mol/L'))), 'CHEM_SYNTAX');
  assert.equal(code(() => orderFromData(A('t=[0; 1; 2] s; c=[1; 0,5; 0] mol/L'))), 'CHEM_NEGATIVE_CONCENTRATION');
  assert.ok(plotShapes(first.plot).dots.length === ts.length);
});

test('Arrhenius from two values, a series and forwards', () => {
  const two = arrheniusFromArgs(A('k1=0,01 1/s; T1=300 K; k2=0,1 1/s; T2=330 K'));
  close(two.result.value * 1000, (R * Math.log(10)) / (1 / 300 - 1 / 330), 1e-9);
  const k2 = arrheniusFromArgs(A(`k1=0,01 1/s; T1=300 K; T2=330 K; Ea=${two.result.value} kJ/mol`)).result.value;
  close(k2, 0.1, 1e-9);
  close(arrheniusFromArgs(A('A=1e13 1/s; Ea=75 kJ/mol; T=298 K')).result.value, 1e13 * Math.exp(-75000 / (R * 298)), 1e-9);
  const Ea = 60000;
  const Ts = [290, 300, 310, 320, 330];
  const ks = Ts.map((T) => 1e10 * Math.exp(-Ea / (R * T)));
  const series = arrheniusFromArgs(A(`T=[${Ts.join('; ')}] K; k=[${ks.map((k) => k.toExponential(8).replace('.', ',')).join('; ')}]`));
  close(series.result.value, 60, 1e-4);
  close(series.values['Bestimmtheitsmaß R²'].value, 1, 1e-8);
  assert.equal(code(() => arrheniusFromArgs(A('k1=1 1/s; T1=300 K; k2=2 1/s; T2=300 K'))), 'CHEM_NO_SOLUTION');
  assert.equal(code(() => arrheniusFromArgs(A('k1=1 1/s; T1=300 K; k2=2 L/(mol·s); T2=310 K'))), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => arrheniusFromArgs(A('A=1 1/s'))), 'CHEM_MISSING_CONSTANT');
});

test('gases: laws and the van der Waals equation', () => {
  const g = (kind, t) => gasFromArgs(kind, A(t)).result.value;
  close(g('ideal', 'n=1 mol; T=273,15 K; p=101325 Pa'), (R * 273.15) / 101325 * 1000, 1e-12);
  close(g('ideal', 'n=1 mol; T=25 °C; V=24,5 L'), (R * 298.15) / 0.0245 / 1e5, 1e-12);
  close(g('ideal', 'p=1 bar; V=10 L; m=8 g; Stoff=O2'), (1e5 * 0.01) / (R * (8 / 31.9988)), 1e-9);
  assert.equal(code(() => gasFromArgs('ideal', A('p=1 bar; V=10 L'))), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => gasFromArgs('ideal', A('p=1 bar; V=-10 K; n=1 mol; T=1 K'))), 'CHEM_UNIT_MISMATCH');
  assert.equal(code(() => gasFromArgs('ideal', A('p=1 bar; V=10 L; n=1 mol; T=-5 K'))), 'CHEM_OUTSIDE_MODEL');
  close(g('boyle', 'p1=1 bar; V1=10 L; p2=2 bar'), 5, 1e-12);
  close(g('charles', 'V1=1 L; T1=20 °C; T2=100 °C'), 373.15 / 293.15, 1e-12);
  close(g('gaylussac', 'p1=1 bar; T1=300 K; T2=350 K'), 350 / 300, 1e-12);
  close(g('avogadro', 'V1=22,4 L; n1=1 mol; n2=2 mol'), 44.8, 1e-12);
  close(g('combined', 'p1=1 bar; V1=10 L; T1=300 K; p2=2 bar; T2=600 K'), 10, 1e-12);
  close(g('molarvolume', ''), 22.4139695, 1e-6);
  close(g('density', 'CO2; T=25 °C; p=1 bar'), (1e5 * 44.0095 * 1e-3) / (R * 298.15), 1e-4);
  // van der Waals: pressure and its inverse
  const { a, b } = vdwConstants('CO2');
  close(g('vdw', 'Gas=CO2; n=1 mol; V=1 L; T=300 K'), vdwPressure(a, b, 1, 1, 300), 1e-12);
  const V = g('vdw', 'Gas=N2; n=1 mol; p=1 bar; T=300 K');
  close(vdwPressure(vdwConstants('N2').a, vdwConstants('N2').b, 1, V, 300), 1, 1e-9);
  close(g('vdw', 'Gas=N2; V=1 L; n=1 mol; p=50 bar'), ((50 + vdwConstants('N2').a) * (1 - vdwConstants('N2').b)) / (0.08314462618), 1e-9);
  const n = g('vdw', 'Gas=N2; V=1 L; p=100 bar; T=300 K');
  close(vdwPressure(vdwConstants('N2').a, vdwConstants('N2').b, n, 1, 300), 100, 1e-9);
  // real gas below the critical temperature has three volumes for one pressure
  assert.ok(vdwVolumes(a, b, 1, 60, 280).length >= 1);
  assert.equal(code(() => gasFromArgs('vdw', A('Gas=Xe; n=1 mol; V=1 L; T=300 K'))), 'CHEM_DATA_UNAVAILABLE');
  assert.equal(code(() => gasFromArgs('vdw', A('Gas=CO2; n=1 mol; V=0,01 L; T=300 K'))), 'CHEM_OUTSIDE_MODEL');
  assert.ok(gasFromArgs('vdw', A('a=3,658; b=0,04286; n=1 mol; V=1 L; T=300 K')).result.value > 0);
  // for a dilute gas the two agree
  const dilute = gasFromArgs('vdw', A('Gas=N2; n=1 mol; V=1000 L; T=300 K'));
  assert.ok(Math.abs(dilute.values['Abweichung vom idealen Gas'].value) < 0.2);
});

test('titration curves', () => {
  const t = (text) => titrationFromArgs(A(text));
  const strong = t('HCl 0,1 mol/L 25 mL; NaOH 0,1 mol/L');
  close(strong.result.value, 25, 1e-9);
  close(strong.values['pH am Äquivalenzpunkt'].value, 7, 1e-6);
  close(strong.values['Anfangs-pH'].value, 1, 1e-9);
  const weak = t('CH3COOH 0,1 mol/L 25 mL; NaOH 0,1 mol/L');
  close(weak.result.value, 25, 1e-9);
  close(weak.values['pH am Halbäquivalenzpunkt'].value, 4.76, 0.005);
  // the equivalence pH is that of the salt solution, worked out independently
  close(weak.values['pH am Äquivalenzpunkt'].value, 14 - 0.5 * (9.24 - Math.log10(0.05)), 0.01);
  assert.match(weak.values['Geeignete Indikatoren'].text, /Phenolphthalein/);
  const base = t('NH3 0,1 mol/L 25 mL; HCl 0,1 mol/L');
  close(base.values['pH am Halbäquivalenzpunkt'].value, 9.25, 0.005);
  close(base.values['pH am Äquivalenzpunkt'].value, 0.5 * (9.25 - Math.log10(0.05)), 0.01);
  assert.match(base.values['Geeignete Indikatoren'].text, /Methylrot/);
  const poly = t('H3PO4 0,1 mol/L 25 mL; NaOH 0,1 mol/L');
  assert.equal(poly.chemistry.equivalence.length, 2, 'the third proton is no jump');
  close(poly.chemistry.equivalence[0].V, 25, 1e-9);
  close(poly.chemistry.equivalence[1].V, 50, 1e-9);
  assert.ok(poly.warnings.length >= 1);
  const carbonate = t('Na2CO3 0,1 mol/L 25 mL; HCl 0,1 mol/L');
  assert.equal(carbonate.chemistry.equivalence.length, 2);
  close(carbonate.chemistry.equivalence[1].V, 50, 1e-9);
  close(t('Ca(OH)2 0,05 mol/L 25 mL; HCl 0,1 mol/L').result.value, 25, 1e-9);
  // the curve rises without a step back, and is a set of plot shapes
  const pts = weak.plot.points;
  for (let i = 1; i < pts.length; i++) assert.ok(pts[i][1] >= pts[i - 1][1] - 1e-9, `monotone at ${pts[i][0]}`);
  const shapes = plotShapes(weak.plot);
  assert.ok(shapes.lines.length >= 2 && shapes.dots.length >= 3 && shapes.bounds.ymax > 12);
  assert.equal(code(() => t('HCl 0,1 mol/L 25 mL; HNO3 0,1 mol/L')), 'CHEM_OUTSIDE_MODEL');
  assert.equal(code(() => t('CH3COOH 0,1 mol/L; NaOH 0,1 mol/L')), 'CHEM_MISSING_CONSTANT');
  assert.equal(code(() => t('CH3COOH 0,1 mol/L 25 mL; NH3 0,1 mol/L')), 'CHEM_OUTSIDE_MODEL');
  assert.equal(code(() => t('NaCl 0,1 mol/L 25 mL; NaOH 0,1 mol/L')), 'CHEM_OUTSIDE_MODEL');
});

test('diagrams', () => {
  const d = distributionFromArgs(A('H3PO4'));
  const shapes = plotShapes(d.plot);
  assert.equal(shapes.lines.length, 4);
  assert.deepEqual(d.plot.species, ['H₃PO₄', 'H₂PO₄⁻', 'HPO₄²⁻', 'PO₄³⁻']);
  assert.equal(code(() => distributionFromArgs(A('NaCl'))), 'CHEM_DATA_UNAVAILABLE');
  const iso = isothermFromArgs(A('Gas=CO2; T=350 K'));
  assert.ok(plotShapes(iso.plot).lines.length === 2);
  close(iso.result.value, (8 * 3.658) / (27 * 0.08314462618 * 0.04286), 1e-9);
  assert.equal(plotShapes({ kind: 'nothing' }), null);
  assert.equal(plotShapes(null), null);
});

test('numeric tools', () => {
  const fit = linearFit([0, 1, 2, 3], [1, 3, 5, 7]);
  close(fit.a, 1, 1e-12);
  close(fit.b, 2, 1e-12);
  close(fit.r2, 1, 1e-12);
  close(bisect((x) => x * x - 2, 0, 2), Math.SQRT2, 1e-14);
  assert.throws(() => bisect((x) => x * x + 1, 0, 2), (e) => e.code === 'CHEM_NO_SOLUTION');
  const x = solveLinearFloat([[2, 1], [1, 3]], [5, 10]);
  close(x[0], 1, 1e-12);
  close(x[1], 3, 1e-12);
  assert.throws(() => solveLinearFloat([[1, 1], [1, 1]], [1, 2]), (e) => e.code === 'CHEM_NO_SOLUTION');
  assert.throws(() => linearFit([1, 1], [1, 2]), (e) => e.code === 'CHEM_NO_SOLUTION');
});

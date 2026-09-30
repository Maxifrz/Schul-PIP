// Diagram commands that have no calculation of their own: the distribution diagram of an acid (fractions of its species
// against pH) and the p–V isotherm of a real gas next to the ideal one.

import { ChemicalResult, L } from './result.js';
import { resolve } from './amounts.js';
import { systemsOf, fractions } from './acidbase.js';
import { distributionLabels } from './plots.js';
import { vdwConstants, vdwPressure } from './gas.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { CONSTANTS } from './constants.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const R_BAR = CONSTANTS.R.value * 1e-2;

/** verteilung(H3PO4): the fractions α of H₃PO₄, H₂PO₄⁻, HPO₄²⁻, PO₄³⁻ against the pH */
export function distributionFromArgs(args) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt die Säure, z. B. verteilung(H3PO4).');
  const sub = resolve(positional[0]);
  const s = systemsOf(sub, 1, options.pKa || options.pKb ? {} : {});
  if (!s.systems.length) fail('CHEM_DATA_UNAVAILABLE', `${sub.label} ist keine schwache Säure mit gespeicherten Säurekonstanten.`);
  const sys = s.systems[0];
  const labels = distributionLabels(sys.top, sys.pKa.length);
  const res = new ChemicalResult('distribution', 'Verteilungsdiagramm');
  res.step('Säurekonstanten', ...sys.pKa.map((p, i) => L(`\\mathrm{p}K_{a${sys.pKa.length > 1 ? i + 1 : ''}} = ${formatNumber(p, { sig: 4, style: 'latex' })}`, `pKa${sys.pKa.length > 1 ? i + 1 : ''} = ${fmt(p)}`)));
  res.step('Anteil der Spezies', L('\\alpha_k = \\frac{\\prod_{j\\le k}K_j\\,[\\mathrm{H^+}]^{n-k}}{\\sum_i \\prod_{j\\le i}K_j\\,[\\mathrm{H^+}]^{n-i}}', 'α(k) = Π K · [H+]^(n−k) / Σ …'));
  // where each species dominates
  const labelAt = labels.map((l, k) => {
    const lo = k === 0 ? -1 : sys.pKa[k - 1];
    const hi = k === sys.pKa.length ? 15 : sys.pKa[k];
    return Math.max(0.6, Math.min(13.4, (lo + hi) / 2));
  });
  const dominant = labels.map((l, k) => {
    const lo = k === 0 ? 0 : sys.pKa[k - 1];
    const hi = k === sys.pKa.length ? 14 : sys.pKa[k];
    return `${l}: pH ${fmt(Math.max(0, lo), 3)} bis ${fmt(Math.min(14, hi), 3)}`;
  });
  res.step('Vorherrschende Spezies', ...dominant.map((d) => L(`\\text{${d}}`, d)));
  res.answer({ text: labels.join(' | '), latex: `\\text{${labels.join(' | ')}}` });
  for (const p of sys.pKa) {
    const a = fractions(10 ** -p, sys.pKa, sys.strongFirst);
    res.value(`Anteile bei pH = pKa = ${fmt(p)}`, { text: a.map((x, k) => `${labels[k]} ${fmt(x * 100, 3)} %`).join(', ') });
  }
  res.plot = { kind: 'distribution', pKa: sys.pKa, strongFirst: sys.strongFirst, species: labels, labelAt };
  return res;
}

/** isotherme(Gas=CO2; n=1 mol; T=280 K; Vmin=0,08 L; Vmax=2 L): van der Waals curve and ideal gas */
export function isothermFromArgs(args) {
  const { options } = parseArgs(args);
  const gas = options.Gas || options.gas;
  if (!gas) fail('CHEM_MISSING_CONSTANT', 'Es fehlt das Gas, z. B. isotherme(Gas=CO2; T=280 K).');
  const { a, b, label } = vdwConstants(gas);
  const n = options.n ? Quantity.parse(options.n).need('amount', 'n').in('mol') : 1;
  const T = options.T ? Quantity.parse(options.T).need('temperature', 'T').si : 300;
  const Tc = (8 * a) / (27 * R_BAR * b);
  const Vc = 3 * b * n;
  const Vmin = options.Vmin ? Quantity.parse(options.Vmin).need('volume', 'Vmin').in('L') : Math.max(n * b * 1.03, Vc * 0.5);
  const Vmax = options.Vmax ? Quantity.parse(options.Vmax).need('volume', 'Vmax').in('L') : Vc * 8;
  if (Vmin <= n * b) fail('CHEM_OUTSIDE_MODEL', 'Vmin muss über dem Eigenvolumen n·b liegen.');
  const real = [];
  const ideal = [];
  const N = 240;
  for (let i = 0; i <= N; i++) {
    const V = Vmin * Math.exp((Math.log(Vmax / Vmin) * i) / N);
    real.push([V, vdwPressure(a, b, n, V, T)]);
    ideal.push([V, (n * R_BAR * T) / V]);
  }
  const res = new ChemicalResult('isotherm', 'Isotherme eines realen Gases');
  res.step('Konstanten', L(`a = ${formatNumber(a, { sig: 4, style: 'latex' })},\\ b = ${formatNumber(b, { sig: 4, style: 'latex' })}\\quad(\\text{${label}})`, `a = ${fmt(a)} L²·bar/mol², b = ${fmt(b)} L/mol (${label})`));
  res.step('Kritische Temperatur', L(`T_c = \\frac{8a}{27\\,R\\,b} = ${formatNumber(Tc, { sig: 4, style: 'latex' })}\\,\\mathrm{K}`, `Tc = 8a/(27·R·b) = ${fmt(Tc)} K`));
  if (T < Tc) res.warn('CHEM_OUTSIDE_MODEL', `Unter der kritischen Temperatur (${fmt(Tc)} K) hat die Isotherme eine Schleife: Dort verflüssigt sich das Gas, die van-der-Waals-Kurve gilt im Zweiphasengebiet nicht.`);
  res.answer(new Quantity(Tc, 'K'), { name: 'Tc' });
  res.value('Kritisches Volumen', new Quantity(3 * b, 'L/mol'));
  res.value('Kritischer Druck', new Quantity(a / (27 * b * b), 'bar'));
  res.plot = { kind: 'isotherm', real: real.filter((p) => p[1] > -1e3 && p[1] < 1e4), ideal };
  res.source('Van-der-Waals-Konstanten: CRC Handbook');
  return res;
}

// Molar mass with its working, the composition by mass, and the information cards for elements and substances.

import { ChemicalResult, L } from './result.js';
import { resolve, latexOf } from './amounts.js';
import { parseFormula, formatFormula, hill } from './formula.js';
import { atomicMass, element, findElement } from './elements.js';
import { SUBSTANCE_DATA } from './substances.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { fail } from './errors.js';
import { parseArgs } from './args.js';
import { PHASE_NAMES } from './thermo.js';

const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });
const num3 = (v) => formatNumber(v, { decimals: 3 });
const num3L = (v) => formatNumber(v, { decimals: 3, style: 'latex' });
const num5 = (v) => formatNumber(v, { sig: 9 });
const num5L = (v) => formatNumber(v, { sig: 9, style: 'latex' });
const CATEGORIES = { acid: 'Säure', base: 'Base', salt: 'Salz', ion: 'Ion', oxide: 'Oxid', metal: 'Metall', nonmetal: 'Nichtmetall', gas: 'Gas', organic: 'organische Verbindung', water: 'Wasser' };

/** molmasse(H2SO4): the molar mass with each element's contribution */
export function molarMassResult(text) {
  const sub = resolve(text);
  const f = sub.formula;
  const res = new ChemicalResult('molarMass', `Molmasse von ${sub.label}`);
  const name = sub.entry ? sub.entry.name : null;
  res.step('Formel', L(latexOf(sub) + (f.charge ? '' : ''), sub.label));
  const terms = sub.terms;
  if (f.electron) {
    res.answer(new Quantity(0, 'g/mol'));
    res.warn('CHEM_OUTSIDE_MODEL', 'Ein Elektron hat die Molmasse 5,486·10⁻⁴ g/mol; es wird mit 0 gerechnet.');
    return res;
  }
  const lines = terms.map((t) => {
    const symbol = t.symbol;
    const many = t.count !== 1;
    const times = many ? `${t.count}\\cdot ` : '';
    const timesText = many ? `${t.count} · ` : '';
    const latex = many ? `${times}M(\\mathrm{${symbol}}) = ${times}${num5L(t.mass)}\\,\\mathrm{g/mol} = ${num5L(t.sum)}\\,\\mathrm{g/mol}` : `M(\\mathrm{${symbol}}) = ${num5L(t.mass)}\\,\\mathrm{g/mol}`;
    const text = many ? `${timesText}M(${symbol}) = ${timesText}${num5(t.mass)} g/mol = ${num5(t.sum)} g/mol` : `M(${symbol}) = ${num5(t.mass)} g/mol`;
    return L(latex, text);
  });
  res.step('Beiträge der Elemente', ...lines);
  const sumLatex = terms.map((t) => num5L(t.sum)).join(' + ');
  res.step('Summe', L(`M(${latexOf(sub)}) = ${sumLatex} = ${num3L(sub.M)}\\,\\mathrm{g/mol}`, `M(${sub.label}) = ${terms.map((t) => num5(t.sum)).join(' + ')} = ${num3(sub.M)} g/mol`));
  res.answer(new Quantity(sub.M, 'g/mol', { substance: sub.label }));
  res.display = { decimals: 3 };
  if (name) res.value('Name', { text: name, latex: `\\text{${name}}` });
  res.value('Summenformel (Hill)', { text: hill(f), latex: `\\mathrm{${hill(f).replace(/(\d+)/g, '_{$1}')}}` });
  for (const t of terms) {
    res.value(`w(${t.symbol})`, new Quantity((t.sum / sub.M) * 100, '%'));
  }
  for (const n of sub.notes) res.warn('CHEM_OUTSIDE_MODEL', n);
  res.source('Atommassen: IUPAC (abgekürzte Tabelle), CRC Handbook of Chemistry and Physics');
  if (f.charge) res.assume('Die Masse der Elektronen (5,5·10⁻⁴ g/mol je Elektron) wird nicht mitgezählt.');
  if (f.hydrate.length) res.assume('Das Kristallwasser wurde mitgezählt.');
  return res;
}

/** zusammensetzung(H2SO4): mass fractions of the elements */
export function compositionResult(text) {
  const sub = resolve(text);
  const res = new ChemicalResult('composition', `Zusammensetzung von ${sub.label}`);
  const terms = sub.terms;
  res.step('Molmasse', L(`M = ${num3L(sub.M)}\\,\\mathrm{g/mol}`, `M = ${num3(sub.M)} g/mol`));
  res.step('Massenanteil w = n·Ar / M', ...terms.map((t) => L(`w(\\mathrm{${t.symbol}}) = \\frac{${t.sum ? num5L(t.sum) : '0'}}{${num3L(sub.M)}} = ${fmtL((t.sum / sub.M) * 100)}\\,\\%`, `w(${t.symbol}) = ${num5(t.sum)}/${num3(sub.M)} = ${fmt((t.sum / sub.M) * 100)} %`)));
  const sum = terms.reduce((s, t) => s + (t.sum / sub.M) * 100, 0);
  res.answer({ text: terms.map((t) => `${t.symbol} ${fmt((t.sum / sub.M) * 100)} %`).join(', '), latex: `\\text{${terms.map((t) => `${t.symbol} ${fmt((t.sum / sub.M) * 100)} %`).join(', ')}}` });
  for (const t of terms) res.value(`w(${t.symbol})`, new Quantity((t.sum / sub.M) * 100, '%'));
  res.value('Summe', new Quantity(sum, '%'));
  return res;
}

/** element(Fe): the element card */
export function elementResult(text) {
  const key = String(text).trim();
  const el = findElement(key) || findElement(Number(key));
  if (!el) fail('CHEM_UNKNOWN_ELEMENT', `„${key}“ ist kein bekanntes Element.`, { symbol: key });
  const res = new ChemicalResult('element', `${el.nameDe} (${el.symbol})`);
  res.step('Ordnungszahl', L(`Z = ${el.atomicNumber}`, `Ordnungszahl Z = ${el.atomicNumber}`));
  res.step('Atommasse', L(`A_r = ${fmtL(el.atomicMass, 6)}\\,\\mathrm{u}${el.massIsMassNumber ? '\\ (\\text{Massenzahl des langlebigsten Isotops})' : ''}`, `Ar = ${fmt(el.atomicMass, 6)} u${el.massIsMassNumber ? ' (Massenzahl des langlebigsten Isotops)' : ''}`));
  res.step('Elektronenkonfiguration', L(`\\text{${el.configuration}}`, el.configuration));
  if (el.electronegativity) res.step('Elektronegativität (Pauling)', L(`EN = ${fmtL(el.electronegativity, 3)}`, `EN = ${fmt(el.electronegativity, 3)}`));
  res.step('Übliche Oxidationszahlen', L(`\\text{${el.oxidationStates.map((o) => (o > 0 ? '+' + o : o < 0 ? '−' + Math.abs(o) : '0')).join(', ') || '–'}}`, el.oxidationStates.map((o) => (o > 0 ? '+' + o : o < 0 ? '−' + Math.abs(o) : '0')).join(', ') || '–'));
  res.answer(new Quantity(el.atomicMass, 'g/mol'), { name: 'M' });
  res.value('Name', { text: `${el.nameDe} (${el.name})`, latex: `\\text{${el.nameDe}}` });
  res.value('Ordnungszahl', { text: String(el.atomicNumber), latex: String(el.atomicNumber) });
  res.source('Atommassen: IUPAC; Elektronegativität: Pauling (CRC Handbook)');
  return res;
}

/** stoff(NaCl) / stoffinfo(Wasser): the substance card */
export function substanceResult(text) {
  const sub = resolve(text);
  const e = sub.entry;
  const res = new ChemicalResult('substance', e ? `${e.name} (${sub.label})` : sub.label);
  if (!e) res.warn('CHEM_DATA_UNAVAILABLE', `${sub.label} ist nicht in der Stoffdatenbank; angezeigt wird nur, was sich aus der Formel ergibt.`);
  res.step('Formel und Molmasse', L(`${latexOf(sub)},\\quad M = ${num3L(sub.M)}\\,\\mathrm{g/mol}`, `${sub.label}, M = ${num3(sub.M)} g/mol`));
  if (e) {
    res.step('Stoffklasse', L(`\\text{${CATEGORIES[e.category] || e.category}}${e.phase ? `,\\ \\text{${PHASE_NAMES[e.phase] || e.phase} bei 25 °C}` : ''}`, `${CATEGORIES[e.category] || e.category}${e.phase ? `, ${PHASE_NAMES[e.phase] || e.phase} bei 25 °C` : ''}`));
    if (e.aliases && e.aliases.length) res.step('Auch bekannt als', L(`\\text{${e.aliases.join(', ')}}`, e.aliases.join(', ')));
    if (e.thermo) {
      for (const [phase, t] of Object.entries(e.thermo)) {
        res.step(`Thermodynamik (${phase})`, L(`\\Delta_fH^\\circ = ${fmtL(t.dfH)}\\,\\mathrm{kJ/mol},\\ \\Delta_fG^\\circ = ${fmtL(t.dfG)}\\,\\mathrm{kJ/mol},\\ S^\\circ = ${fmtL(t.S)}\\,\\mathrm{J/(mol\\cdot K)}`, `ΔfH° = ${fmt(t.dfH)} kJ/mol, ΔfG° = ${fmt(t.dfG)} kJ/mol, S° = ${fmt(t.S)} J/(mol·K)`));
      }
    }
    if (e.density) res.step('Dichte', L(`\\rho = ${fmtL(e.density.value)}\\,\\mathrm{${e.density.unit.replace('cm3', 'cm^3')}}`, `ρ = ${fmt(e.density.value)} ${e.density.unit} bei ${fmt(e.density.T - 273.15)} °C`));
    if (e.acidBase) {
      const ab = e.acidBase;
      const parts = [];
      if (ab.strong) parts.push('starke Säure');
      if (ab.strongBase) parts.push('starke Base');
      if (ab.pKa) parts.push('pKa = ' + ab.pKa.map((p) => (p === null ? 'stark' : fmt(p))).join('; '));
      if (ab.pKb !== undefined) parts.push(`pKb = ${fmt(ab.pKb)}`);
      res.step('Säure/Base', L(`\\text{${parts.join(', ')}}`, parts.join(', ')));
    }
    if (e.ksp) res.step('Löslichkeitsprodukt', L(`K_{sp} = ${fmtL(e.ksp.value)}`, `Ksp = ${fmt(e.ksp.value)}`));
    if (e.ions) res.step('Ionen', L(e.ions.map((i) => `${i.n === 1 ? '' : i.n}\\,${formatFormula(parseFormula(i.formula), 'latex')}`).join(' + '), e.ions.map((i) => `${i.n === 1 ? '' : i.n + ' '}${i.formula}`).join(' + ')));
  }
  res.answer(new Quantity(sub.M, 'g/mol', { substance: sub.label }));
  res.display = { decimals: 3 };
  res.source(`${SUBSTANCE_DATA.source.split(';')[0]}`);
  res.actions = [{ label: 'Molmasse', command: 'molmasse' }, { label: 'Zusammensetzung', command: 'zusammensetzung' }];
  return res;
}

export function infoFromArgs(kind, args) {
  const { positional } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Es fehlt der Stoff oder das Element.');
  switch (kind) {
    case 'molarmass': return molarMassResult(positional[0]);
    case 'composition': return compositionResult(positional[0]);
    case 'element': return elementResult(positional[0]);
    case 'substance': return substanceResult(positional[0]);
    default: return fail('CHEM_SYNTAX', 'Unbekannte Auskunft.');
  }
}

export { atomicMass, element };

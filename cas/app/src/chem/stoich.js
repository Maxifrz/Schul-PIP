// Stoichiometry of a reaction: from what is given (masses, amounts, gas volumes, solutions) to the limiting reagent, the
// excess, the amounts and masses formed and the yield. The extent of reaction ξ = n / ν is the one number that links
// every substance; the limiting reagent is the one with the smallest ξ.

import { ChemicalResult, L } from './result.js';
import { coefficientsFor } from './balance.js';
import { formatReaction, speciesOf } from './reaction.js';
import { formulaKey, formatFormula } from './formula.js';
import { resolve, resolveParsed, parseGiven, amountFrom, conditionsFrom, latexOf, minSig } from './amounts.js';
import { Quantity } from './quantity.js';
import { formatNumber, sigWords } from './format.js';
import { CONSTANTS, NORMAL } from './constants.js';
import { fail } from './errors.js';
import { splitArgs, parseArgs } from './args.js';

const R = CONSTANTS.R.value;
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(Math.abs(a), Math.abs(b));

/** Which species of the reaction a substance text means */
function matchSpecies(species, text) {
  const wanted = resolve(text);
  const key = formulaKey(wanted.formula);
  const found = species.findIndex((s) => formulaKey(s.formula) === key);
  if (found < 0) fail('CHEM_UNKNOWN_SUBSTANCE', `${wanted.label} kommt in der Reaktionsgleichung nicht vor.`, { substance: wanted.label });
  return found;
}

/** Merges the given items per substance: "c(HCl) = 0,1 mol/L" and "V(HCl) = 50 mL" belong together */
function collect(species, givenTexts) {
  const perSpecies = new Map();
  for (const text of givenTexts) {
    const g = parseGiven(text);
    if (!g.substance) fail('CHEM_SYNTAX', `„${text}“: es fehlt der Stoff (z. B. 10 g Fe oder m(Fe) = 10 g).`);
    const i = matchSpecies(species, g.substance);
    const list = perSpecies.get(i) || [];
    list.push(...g.quantities);
    perSpecies.set(i, list);
  }
  return perSpecies;
}

/**
 * Stoichiometry.
 *   reaction   text of the equation (coefficients optional)
 *   givens     texts like "10 g Fe", "m(O2) = 5 g", "HCl: 0,1 mol/L 50 mL"
 *   options    { T, p (conditions), gesucht (substance or n(X)/m(X)/V(X)), praktisch (actual yield of `gesucht`) }
 */
export function stoichiometry(reactionText, givens, options = {}, kind = 'stoichiometry') {
  const { reaction, coefficients, auto } = coefficientsFor(reactionText);
  const species = speciesOf(reaction);
  const subs = species.map((s) => resolveParsed(s.formula));
  const nu = coefficients.map((c) => c.toNumber());
  const conditions = conditionsFrom(options);
  const res = new ChemicalResult(kind, kind === 'limiting' ? 'Limitierender Stoff' : kind === 'yield' ? 'Ausbeute' : 'Stöchiometrie');
  const eqText = formatReaction(reaction, coefficients, 'text');
  res.step('Reaktionsgleichung', L(formatReaction(reaction, coefficients, 'latex'), eqText));
  if (auto) {
    res.assume('Die Koeffizienten wurden automatisch ausgeglichen.');
  }
  res.assume('Vollständiger Umsatz zum Produkt (kein Gleichgewicht, keine Nebenreaktionen).');

  const given = collect(species, givens);
  if (!given.size) fail('CHEM_MISSING_CONSTANT', 'Es sind keine Stoffmengen oder Massen angegeben. Beispiel: stöchiometrie(2 H2 + O2 -> 2 H2O; 4 g H2; 32 g O2)');
  const amounts = new Map();
  const allQuantities = [];
  for (const [i, quantities] of given) {
    allQuantities.push(...quantities);
    const a = amountFrom(subs[i], quantities, conditions);
    amounts.set(i, a);
    for (const st of a.steps) res.steps.push(st);
    for (const as of a.assumptions) res.assume(as);
  }
  const reactantIdx = species.map((s, i) => (s.side === 'left' ? i : -1)).filter((i) => i >= 0);
  const productIdx = species.map((s, i) => (s.side === 'right' ? i : -1)).filter((i) => i >= 0);
  const givenReactants = reactantIdx.filter((i) => amounts.has(i));
  const givenProducts = productIdx.filter((i) => amounts.has(i));

  let xi;
  let limiting = [];
  let mode;
  if (givenReactants.length) {
    mode = 'forward';
    const xis = givenReactants.map((i) => ({ i, xi: amounts.get(i).n / nu[i] }));
    xi = Math.min(...xis.map((x) => x.xi));
    limiting = xis.filter((x) => close(x.xi, xi)).map((x) => x.i);
    res.step('Reaktionsumsatz ξ = n / ν je Edukt', ...xis.map((x) => L(`\\xi(${latexOf(subs[x.i])}) = \\frac{n}{\\nu} = \\frac{${fmtL(amounts.get(x.i).n)}\\,\\mathrm{mol}}{${nu[x.i]}} = ${fmtL(x.xi)}\\,\\mathrm{mol}`, `ξ(${subs[x.i].label}) = n/ν = ${fmt(amounts.get(x.i).n)} mol / ${nu[x.i]} = ${fmt(x.xi)} mol`)));
    const names = limiting.map((i) => subs[i].label).join(' und ');
    res.step('Limitierender Stoff', L(`\\text{${limiting.length > 1 ? 'Beide sind' : 'Der kleinste Wert ξ gehört zu'} ${names}: } \\xi = ${fmtL(xi)}\\,\\mathrm{mol}`, `${limiting.length > 1 ? 'Beide sind' : 'Der kleinste Wert ξ gehört zu'} ${names}: ξ = ${fmt(xi)} mol`));
    if (reactantIdx.length > givenReactants.length) res.assume(`Nicht angegebene Edukte (${reactantIdx.filter((i) => !amounts.has(i)).map((i) => subs[i].label).join(', ')}) liegen im Überschuss vor.`);
  } else if (givenProducts.length) {
    mode = 'backward';
    const xis = givenProducts.map((i) => ({ i, xi: amounts.get(i).n / nu[i] }));
    xi = xis[0].xi;
    if (xis.some((x) => !close(x.xi, xi))) fail('CHEM_NO_SOLUTION', 'Die angegebenen Produktmengen passen nicht zur Reaktionsgleichung (verschiedene Reaktionsumsätze ξ).', { xi: xis.map((x) => x.xi) });
    res.step('Reaktionsumsatz ξ = n / ν aus dem Produkt', ...xis.map((x) => L(`\\xi = \\frac{${fmtL(amounts.get(x.i).n)}\\,\\mathrm{mol}}{${nu[x.i]}} = ${fmtL(x.xi)}\\,\\mathrm{mol}`, `ξ = ${fmt(amounts.get(x.i).n)} mol / ${nu[x.i]} = ${fmt(x.xi)} mol`)));
    res.assume('Es wurde angegeben, wie viel Produkt entstehen soll; berechnet werden die benötigten Edukte.');
  } else fail('CHEM_MISSING_CONSTANT', 'Es fehlt die Angabe eines Edukts (oder eines Produkts).');

  // amounts per species
  const rows = [];
  const values = {};
  species.forEach((s, i) => {
    const sub = subs[i];
    const changed = nu[i] * xi;
    const start = amounts.has(i) && s.side === 'left' ? amounts.get(i).n : null;
    const n = s.side === 'left' ? (mode === 'forward' && start !== null ? start - changed : null) : changed;
    const m = n === null ? null : n * sub.M;
    const usedMass = changed * sub.M;
    rows.push({ i, sub, side: s.side, nu: nu[i], start, changed, n, m, usedMass });
    values[`n(${sub.label})`] = changed;
  });

  const isGas = (sub) => sub.phase === 'g';
  const T = conditions.T !== undefined ? conditions.T : NORMAL.T;
  const p = conditions.p !== undefined ? conditions.p : NORMAL.p;
  const gasVolume = (n) => (n * R * T) / p * 1e3; // L

  if (rows.some((r) => isGas(r.sub))) {
    res.assume(conditions.T !== undefined || conditions.p !== undefined ? `Gasvolumina als ideales Gas bei ${fmt(T)} K und ${fmt(p / 1000)} kPa.` : 'Gasvolumina als ideales Gas bei Normbedingungen (0 °C, 101,325 kPa); andere Bedingungen mit T=… und p=… angeben.');
  }

  // steps for consumed / formed
  for (const r of rows) {
    const verb = r.side === 'left' ? 'verbraucht' : 'gebildet';
    const lines = [
      L(`n_{${latexOf(r.sub)}} = \\nu \\cdot \\xi = ${r.nu} \\cdot ${fmtL(xi)}\\,\\mathrm{mol} = ${fmtL(r.changed)}\\,\\mathrm{mol}`, `n(${r.sub.label}) = ν·ξ = ${r.nu} · ${fmt(xi)} mol = ${fmt(r.changed)} mol`),
      L(`m = n \\cdot M = ${fmtL(r.changed)}\\,\\mathrm{mol} \\cdot ${fmtL(r.sub.M)}\\,\\mathrm{g/mol} = ${fmtL(r.usedMass)}\\,\\mathrm{g}`, `m = n·M = ${fmt(r.changed)} mol · ${fmt(r.sub.M)} g/mol = ${fmt(r.usedMass)} g`),
    ];
    if (isGas(r.sub)) lines.push(L(`V = \\frac{nRT}{p} = ${fmtL(gasVolume(r.changed))}\\,\\mathrm{L}`, `V = nRT/p = ${fmt(gasVolume(r.changed))} L`));
    res.step(`${r.sub.label} ${verb}`, ...lines);
  }

  // excess
  if (mode === 'forward') {
    for (const r of rows.filter((x) => x.side === 'left' && x.start !== null && !limiting.includes(x.i))) {
      res.step(`Überschuss von ${r.sub.label}`, L(`n_{\\mathrm{Rest}} = ${fmtL(r.start)}\\,\\mathrm{mol} - ${fmtL(r.changed)}\\,\\mathrm{mol} = ${fmtL(r.n)}\\,\\mathrm{mol}\\quad (${fmtL(r.n * r.sub.M)}\\,\\mathrm{g})`, `Rest = ${fmt(r.start)} mol − ${fmt(r.changed)} mol = ${fmt(r.n)} mol (${fmt(r.n * r.sub.M)} g)`));
    }
  }

  // table
  res.table = {
    head: ['Stoff', 'ν', 'n(Start) in mol', 'Umsatz in mol', 'n(Ende) in mol', 'm(Ende) in g'],
    rows: rows.map((r) => [
      latexOf(r.sub),
      String(r.side === 'left' ? -r.nu : r.nu),
      r.start === null ? '–' : fmtL(r.start),
      fmtL(r.changed),
      r.n === null ? '–' : fmtL(r.n),
      r.m === null ? '–' : fmtL(r.m),
    ]),
  };

  // yields
  if (mode === 'forward') {
    const actual = givenProducts;
    if (actual.length) {
      for (const i of actual) {
        const r = rows.find((x) => x.i === i);
        const real = amounts.get(i).n;
        const percent = (real / r.changed) * 100;
        res.step(`Ausbeute von ${r.sub.label}`, L(`\\eta = \\frac{n_{\\mathrm{praktisch}}}{n_{\\mathrm{theoretisch}}} = \\frac{${fmtL(real)}\\,\\mathrm{mol}}{${fmtL(r.changed)}\\,\\mathrm{mol}} = ${fmtL(percent)}\\,\\%`, `η = n(praktisch)/n(theoretisch) = ${fmt(real)} mol / ${fmt(r.changed)} mol = ${fmt(percent)} %`));
        values[`Ausbeute(${r.sub.label})`] = percent;
        res.value(`Ausbeute(${r.sub.label})`, new Quantity(percent, '%'));
        if (percent > 100 + 1e-9) res.warn('CHEM_OUTSIDE_MODEL', `Die angegebene Ausbeute von ${r.sub.label} übersteigt den theoretischen Wert (${fmt(percent)} %): Das Produkt ist vermutlich nicht trocken oder verunreinigt, oder eine Angabe stimmt nicht.`);
      }
    }
  }

  // named answers
  const limitingText = limiting.map((i) => subs[i].label).join(', ');
  if (mode === 'forward') res.value('Limitierender Stoff', { text: limitingText, latex: limiting.map((i) => latexOf(subs[i])).join(',\\ ') });
  res.value('Reaktionsumsatz ξ', new Quantity(xi, 'mol'));
  for (const r of rows) {
    res.value(`n(${r.sub.label}) umgesetzt`, new Quantity(r.changed, 'mol'));
    res.value(`m(${r.sub.label}) umgesetzt`, new Quantity(r.usedMass, 'g'));
  }

  // what was asked for
  let target = null;
  if (options.gesucht) {
    const m = /^([nmV])\s*\(\s*(.+)\s*\)$/.exec(options.gesucht.trim());
    const kindWanted = m ? m[1] : 'm';
    const idx = matchSpecies(species, m ? m[2] : options.gesucht);
    const r = rows.find((x) => x.i === idx);
    const q = kindWanted === 'n' ? new Quantity(r.changed, 'mol', { substance: r.sub.label }) : kindWanted === 'V' ? new Quantity(gasVolume(r.changed), 'L', { substance: r.sub.label }) : new Quantity(r.usedMass, 'g', { substance: r.sub.label });
    if (kindWanted === 'V' && !isGas(r.sub)) res.warn('CHEM_OUTSIDE_MODEL', `${r.sub.label} ist kein Gas; das berechnete Volumen gilt für ein ideales Gas.`);
    target = q;
    res.answer(q);
    if (options.praktisch) {
      const real = Quantity.parse(options.praktisch);
      const a = amountFrom(r.sub, [real], conditions);
      const percent = (a.n / r.changed) * 100;
      res.step(`Ausbeute von ${r.sub.label}`, L(`\\eta = \\frac{${fmtL(a.n)}\\,\\mathrm{mol}}{${fmtL(r.changed)}\\,\\mathrm{mol}} = ${fmtL(percent)}\\,\\%`, `η = ${fmt(a.n)} mol / ${fmt(r.changed)} mol = ${fmt(percent)} %`));
      res.value('Ausbeute', new Quantity(percent, '%'));
      if (kind === 'yield') res.answer(new Quantity(percent, '%'));
    }
  } else if (kind === 'yield' && res.values.Ausbeute === undefined) {
    const firstProduct = givenProducts[0];
    if (firstProduct === undefined) fail('CHEM_MISSING_CONSTANT', 'Für die Ausbeute fehlt die tatsächlich erhaltene Menge, z. B. ausbeute(N2 + 3 H2 -> 2 NH3; 10 g N2; 8 g NH3).');
    const r = rows.find((x) => x.i === firstProduct);
    res.answer(res.values[`Ausbeute(${r.sub.label})`].quantity);
  } else if (mode === 'forward') {
    res.answer({ text: `Limitierender Stoff: ${limitingText}`, latex: `\\text{Limitierender Stoff: }${limiting.map((i) => latexOf(subs[i])).join(',\\ ')}` });
  } else {
    const first = rows.find((r) => r.side === 'left');
    res.answer(new Quantity(first.usedMass, 'g', { substance: first.sub.label }));
  }
  const sig = minSig(allQuantities);
  if (sig !== undefined && sig < 4 && res.result && res.result.value !== undefined) {
    res.step('Signifikante Stellen', L(`\\text{Kleinste Angabe: ${sigWords(sig)}} \\Rightarrow ${formatNumber(res.result.value, { sig, style: 'latex' })}\\,${res.result.unit ? `\\mathrm{${res.result.unit}}` : ''}`, `Kleinste Angabe: ${sigWords(sig)} => ${formatNumber(res.result.value, { sig })} ${res.result.unit || ''}`));
  }
  res.stoich = { mode, xi, limiting: limiting.map((i) => subs[i].label), rows: rows.map((r) => ({ substance: r.sub.label, side: r.side, nu: r.nu, start: r.start, changed: r.changed, end: r.n, mass: r.usedMass })) };
  res.source('Stoffmengenverhältnis der Reaktionsgleichung; Molmassen aus den Atommassen (IUPAC)');
  return res;
}

/** The command form: stoichiometry from text arguments */
export function stoichiometryFromArgs(args, kind) {
  const { positional, options } = parseArgs(args);
  if (!positional.length) fail('CHEM_SYNTAX', 'Die Reaktionsgleichung fehlt.');
  return stoichiometry(positional[0], positional.slice(1), options, kind);
}

export { splitArgs };

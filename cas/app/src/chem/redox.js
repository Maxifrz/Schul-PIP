// Redox reactions: oxidation numbers, the two half-reactions balanced with H₂O, H⁺ (or OH⁻) and electrons, the electrons
// matched and added. Every balancing is an exact null-space problem over atoms and charge, so the result is always
// checked by counting. Reactions that do not split into one oxidation and one reduction (internal redox, several
// couples) are balanced as a whole and say so.

import { ChemicalResult, L } from './result.js';
import { parseFormula, formatFormula, formulaKey } from './formula.js';
import { parseReaction, speciesOf, formatReaction, balanceCheck } from './reaction.js';
import { oxidationNumbers, onText } from './oxidation.js';
import { nullspace, toIntegers, Frac } from './rational.js';
import { fail, ChemError } from './errors.js';

const EXTRA = {
  water: parseFormula('H2O'),
  proton: parseFormula('H+'),
  hydroxide: parseFormula('OH-'),
  electron: parseFormula('e-'),
};

const nameOf = (f) => formatFormula({ ...f, phase: null }, 'text');
const latexOf = (f) => formatFormula({ ...f, phase: null }, 'latex');
const keyOf = (f) => formulaKey({ ...f, phase: null });

/**
 * Balances left → right with extra species of free side: columns are the left species (+), the right species (−) and
 * the extras (+; a negative coefficient puts them on the right). Returns
 *   { left: [{ formula, coef }], right: [...], extras: { water, proton, hydroxide, electron: signed Frac } }
 */
export function balanceFlexible(leftForms, rightForms, extras) {
  const cols = [
    ...leftForms.map((f) => ({ f, sign: 1, kind: 'left' })),
    ...rightForms.map((f) => ({ f, sign: -1, kind: 'right' })),
    ...extras.map((name) => ({ f: EXTRA[name], sign: 1, kind: 'extra', name })),
  ];
  const elements = [];
  for (const c of cols) for (const el of Object.keys(c.f.atoms)) if (!elements.includes(el)) elements.push(el);
  const rows = elements.map((el) => cols.map((c) => c.sign * (c.f.atoms[el] || 0)));
  rows.push(cols.map((c) => c.sign * c.f.charge));
  const basis = nullspace(rows);
  if (basis.length === 0) fail('CHEM_NO_SOLUTION', 'Die Gleichung lässt sich mit diesen Stoffen nicht ausgleichen.');
  if (basis.length > 1) fail('CHEM_MULTIPLE_SOLUTIONS', `Die Gleichung ist nicht eindeutig: Es gibt ${basis.length} unabhängige Ausgleiche.`, { count: basis.length });
  let v = toIntegers(basis[0]);
  const skeleton = cols.map((c, i) => (c.kind === 'extra' ? null : v[i])).filter((x) => x !== null);
  if (skeleton.length && skeleton[0] < 0n) v = v.map((x) => -x);
  if (v.some((x, i) => cols[i].kind !== 'extra' && x <= 0n)) fail('CHEM_NO_SOLUTION', 'Kein Ausgleich mit positiven Koeffizienten: Ein Stoff steht vermutlich auf der falschen Seite oder es fehlt ein Stoff.');
  const out = { left: [], right: [], extras: {} };
  cols.forEach((c, i) => {
    if (c.kind === 'left') out.left.push({ formula: c.f, coef: Number(v[i]) });
    else if (c.kind === 'right') out.right.push({ formula: c.f, coef: Number(v[i]) });
    else out.extras[c.name] = Number(v[i]);
  });
  return out;
}

const sideOf = (n) => (n > 0 ? 'left' : 'right');

/** Half-reaction text: "MnO4- + 8 H+ + 5 e- -> Mn2+ + 4 H2O" from a balanceFlexible result */
function halfSides(b) {
  const left = b.left.map((x) => ({ ...x }));
  const right = b.right.map((x) => ({ ...x }));
  const put = (name) => {
    const n = b.extras[name];
    if (!n) return;
    (n > 0 ? left : right).push({ formula: EXTRA[name], coef: Math.abs(n) });
  };
  for (const name of ['proton', 'hydroxide', 'water', 'electron']) put(name);
  // water on the left of the equation reads better after the ions, electrons last
  return { left, right };
}

const term = (x, style) => `${x.coef === 1 ? '' : x.coef + (style === 'latex' ? '\\,' : ' ')}${formatFormula({ ...x.formula, phase: null }, style)}`;
const sideText = (side, style) => side.map((x) => term(x, style)).join(' + ');

/** A ChemicalResult-independent description of one half-reaction: text, latex, electrons */
function describeHalf(b) {
  const { left, right } = halfSides(b);
  const e = b.extras.electron || 0;
  return {
    text: `${sideText(left, 'text')} -> ${sideText(right, 'text')}`,
    latex: `${sideText(left, 'latex')} \\longrightarrow ${sideText(right, 'latex')}`,
    left,
    right,
    electrons: Math.abs(e),
    kind: e > 0 ? 'reduction' : 'oxidation',
  };
}

/** Steps that show how the extras were found */
function halfSteps(b, medium, title) {
  const lines = [];
  const w = b.extras.water || 0;
  const h = medium === 'basic' ? b.extras.hydroxide || 0 : b.extras.proton || 0;
  const hName = medium === 'basic' ? 'OH⁻' : 'H⁺';
  const hLatex = medium === 'basic' ? '\\mathrm{OH^-}' : '\\mathrm{H^+}';
  const e = b.extras.electron || 0;
  if (w) lines.push(L(`\\text{Sauerstoff: ${Math.abs(w)} H}_2\\text{O auf der ${sideOf(w) === 'left' ? 'linken' : 'rechten'} Seite}`, `Sauerstoff: ${Math.abs(w)} H2O ${sideOf(w) === 'left' ? 'links' : 'rechts'}`));
  if (h) lines.push(L(`\\text{Wasserstoff: ${Math.abs(h)} }${hLatex}\\text{ ${sideOf(h) === 'left' ? 'links' : 'rechts'}}`, `Wasserstoff: ${Math.abs(h)} ${hName} ${sideOf(h) === 'left' ? 'links' : 'rechts'}`));
  if (e) lines.push(L(`\\text{Ladung: ${Math.abs(e)} e}^-\\text{ ${sideOf(e) === 'left' ? 'links' : 'rechts'}}`, `Ladung: ${Math.abs(e)} e- ${sideOf(e) === 'left' ? 'links' : 'rechts'}`));
  const d = describeHalf(b);
  lines.push(L(d.latex, d.text));
  return { label: title, lines };
}

const lcm = (a, b) => {
  const g = (x, y) => (y ? g(y, x % y) : x);
  return (a * b) / g(a, b);
};

/**
 * Which half-reactions the skeleton has: for every reactant species holding an element whose oxidation number changes,
 * the products holding that element with a different number. Returns null when it does not split into one
 * oxidation and one reduction.
 */
function findHalves(species, numbers) {
  const halves = [];
  const products = species.filter((x) => x.side === 'right' && !x.formula.electron);
  for (const s of species.filter((x) => x.side === 'left' && !x.formula.electron)) {
    const on = numbers.get(s);
    const up = new Set();
    const down = new Set();
    for (const el of Object.keys(s.formula.atoms)) {
      // O (−2) and H (+1) in their usual state are not the redox centre
      if ((el === 'O' && on.O.equals(-2)) || (el === 'H' && on.H.equals(1))) continue;
      for (const p of products.filter((x) => x.formula.atoms[el])) {
        const from = on[el];
        const to = numbers.get(p)[el];
        if (!from || !to || from.equals(to)) continue;
        (to.sub(from).sign > 0 ? up : down).add(p);
      }
    }
    // a reactant that both gains and loses through different elements is an internal redox: not split
    if (up.size && down.size && [...up].some((p) => [...down].some((q) => p === q))) return null;
    if (up.size) halves.push({ reactant: s, products: [...up], type: 'ox' });
    if (down.size) halves.push({ reactant: s, products: [...down], type: 'red' });
  }
  return halves;
}

/**
 * Balances a redox reaction. options: { medium: 'acidic' | 'basic' | 'neutral' | undefined }
 */
export function balanceRedox(input, options = {}) {
  const reaction = typeof input === 'string' ? parseReaction(input) : input;
  const species = speciesOf(reaction);
  const res = new ChemicalResult('redox', 'Redoxgleichung ausgleichen');
  // oxidation numbers
  const numbers = new Map();
  const table = [];
  for (const s of species) {
    if (s.formula.electron) continue;
    const r = oxidationNumbers(s.formula);
    numbers.set(s, r.numbers);
    table.push({ species: s, r });
  }
  const withE = species.some((s) => s.formula.electron);

  // the medium
  let medium = options.medium;
  let mediumAssumed = false;
  const keys = new Set(species.map((s) => keyOf(s.formula)));
  if (!medium) {
    if (keys.has('OH-')) medium = 'basic';
    else if (keys.has('H+') || keys.has('H3O+')) medium = 'acidic';
    else {
      medium = 'acidic';
      mediumAssumed = true;
    }
  }
  const acidBase = medium === 'basic' ? 'hydroxide' : 'proton';
  const extras = ['water', acidBase];

  res.step('Oxidationszahlen', ...table.map(({ species: s, r }) => {
    const parts = Object.entries(r.numbers).map(([el, v]) => `${el}: ${onText(v)}`);
    const partsLatex = Object.entries(r.numbers).map(([el, v]) => `\\mathrm{${el}}\\,${onText(v, 'latex')}`);
    return L(`${latexOf(s.formula)}:\\quad ${partsLatex.join(',\\ ')}`, `${nameOf(s.formula)}: ${parts.join(', ')}${r.notes.length ? ' (' + r.notes.join('; ') + ')' : ''}`);
  }));
  for (const { r } of table) for (const n of r.notes) if (/außerhalb/.test(n)) res.warn('CHEM_OUTSIDE_MODEL', n);

  // the two half-reactions
  let result = null;
  let split = false;
  const halves = withE ? [] : findHalves(species, numbers) || [];
  const ox = halves.filter((h) => h.type === 'ox');
  const red = halves.filter((h) => h.type === 'red');
  if (!withE && ox.length === 1 && red.length === 1) {
    try {
      // H₂O₂ ⇄ O₂ needs no extra water: when the extras are redundant, fewer are tried
      const build = (h) => {
        for (const set of [['water', acidBase, 'electron'], [acidBase, 'electron'], ['water', 'electron']]) {
          try {
            return balanceFlexible([h.reactant.formula], h.products.map((p) => p.formula), set);
          } catch (e) {
            if (!(e instanceof ChemError) || e.code !== 'CHEM_MULTIPLE_SOLUTIONS') throw e;
          }
        }
        return fail('CHEM_MULTIPLE_SOLUTIONS', 'Die Teilgleichung ist nicht eindeutig.');
      };
      const bo = build(ox[0]);
      const br = build(red[0]);
      const eo = Math.abs(bo.extras.electron || 0);
      const er = Math.abs(br.extras.electron || 0);
      if (eo && er && (bo.extras.electron < 0) && (br.extras.electron > 0)) {
        const m = lcm(BigInt(eo), BigInt(er));
        const mo = Number(m / BigInt(eo));
        const mr = Number(m / BigInt(er));
        // sum up: left − right per species
        const total = new Map();
        const add = (formula, coef, side) => {
          const k = keyOf(formula);
          const cur = total.get(k) || { formula, net: 0 };
          cur.net += side === 'left' ? coef : -coef;
          total.set(k, cur);
        };
        for (const [b, mult] of [[bo, mo], [br, mr]]) {
          const { left, right } = halfSides(b);
          for (const x of left) add(x.formula, x.coef * mult, 'left');
          for (const x of right) add(x.formula, x.coef * mult, 'right');
        }
        total.delete('e-');
        result = { total, halves: { ox: bo, red: br }, mult: { ox: mo, red: mr }, electrons: Number(m) };
        split = true;
      }
    } catch (e) {
      if (!(e instanceof ChemError)) throw e;
      split = false;
    }
  }

  let equationLeft;
  let equationRight;
  if (split) {
    const { halves: h, mult, electrons } = result;
    const dox = describeHalf(h.ox);
    const dred = describeHalf(h.red);
    res.step('Teilgleichung der Oxidation (Elektronenabgabe)', ...halfSteps(h.ox, medium, 'x').lines);
    res.step('Teilgleichung der Reduktion (Elektronenaufnahme)', ...halfSteps(h.red, medium, 'x').lines);
    res.step('Elektronen angleichen', L(`\\text{Oxidation} \\times ${mult.ox},\\quad \\text{Reduktion} \\times ${mult.red}\\;\\Rightarrow\\; ${electrons}\\ \\text{e}^-\\ \\text{übertragen}`, `Oxidation × ${mult.ox}, Reduktion × ${mult.red} => ${electrons} e- übertragen`));
    // rebuild the equation: net positive on the left
    const order = [...species.map((s) => keyOf(s.formula)), 'H2O', 'H+', 'OH-'];
    let divisor = 0;
    const gcd = (x, y) => (y ? gcd(y, x % y) : x);
    for (const x of result.total.values()) divisor = gcd(divisor, Math.abs(x.net));
    if (divisor > 1) for (const x of result.total.values()) x.net /= divisor;
    const entries = [...result.total.values()].filter((x) => x.net !== 0);
    entries.sort((a, b) => order.indexOf(keyOf(a.formula)) - order.indexOf(keyOf(b.formula)));
    equationLeft = entries.filter((x) => x.net > 0).map((x) => ({ formula: x.formula, coef: x.net }));
    equationRight = entries.filter((x) => x.net < 0).map((x) => ({ formula: x.formula, coef: -x.net }));
    res.step('Addieren und kürzen', L(`\\text{Beide Teilgleichungen addieren; e}^-\\text{, H}_2\\text{O und ${medium === 'basic' ? 'OH}^-' : 'H}^+'}\\text{ auf beiden Seiten kürzen.}`, `Beide Teilgleichungen addieren; e-, H2O und ${medium === 'basic' ? 'OH-' : 'H+'} auf beiden Seiten kürzen.`));
    const oxidizer = red[0].reactant.formula;
    const reducer = ox[0].reactant.formula;
    res.redox = { half: { ox: dox.text, red: dred.text }, electrons };
    res.value('Oxidation', { text: dox.text, latex: dox.latex });
    res.value('Reduktion', { text: dred.text, latex: dred.latex });
    res.value('Oxidationsmittel', { text: nameOf(oxidizer), latex: latexOf(oxidizer) });
    res.value('Reduktionsmittel', { text: nameOf(reducer), latex: latexOf(reducer) });
    res.value('Übertragene Elektronen', { text: String(electrons), latex: String(electrons) });
  } else {
    // whole-equation balancing
    const leftForms = species.filter((s) => s.side === 'left').map((s) => s.formula);
    const rightForms = species.filter((s) => s.side === 'right').map((s) => s.formula);
    const present = new Set(species.map((s) => keyOf(s.formula)));
    const wanted = withE ? ['water', acidBase] : extras;
    const usable = wanted.filter((name) => !present.has(keyOf(EXTRA[name])));
    let b;
    try {
      b = balanceFlexible(leftForms, rightForms, usable);
    } catch (e) {
      if (!(e instanceof ChemError) || e.code !== 'CHEM_NO_SOLUTION') throw e;
      // a half-reaction typed without its electrons: they are added
      try {
        b = balanceFlexible(leftForms, rightForms, [...usable, 'electron']);
        res.assume('Elektronen wurden ergänzt: Die Gleichung ist eine Teilgleichung (Oxidation oder Reduktion).');
      } catch (e2) {
        throw new ChemError('CHEM_NO_SOLUTION', 'Die Redoxgleichung lässt sich nicht ausgleichen: Es fehlen Stoffe oder ein Stoff steht auf der falschen Seite.', e.details);
      }
    }
    equationLeft = b.left.map((x) => ({ ...x }));
    equationRight = b.right.map((x) => ({ ...x }));
    for (const name of [...usable, 'electron']) {
      const n = b.extras[name];
      if (!n) continue;
      (n > 0 ? equationLeft : equationRight).push({ formula: EXTRA[name], coef: Math.abs(n) });
    }
    if (!withE) res.assume('Die Reaktion lässt sich nicht in eine Oxidation und eine Reduktion trennen (z. B. Molekülgleichung, mehrere Redoxpaare); sie wurde als Ganzes über die Atom- und Ladungsbilanz ausgeglichen.');
    const changes = changesOf(species, numbers);
    if (changes.length) res.step('Oxidationszahländerungen', ...changes);
  }

  // final equation
  const finalReaction = { reactants: equationLeft.map((x) => ({ coef: new Frac(BigInt(x.coef)), formula: x.formula, text: nameOf(x.formula) })), products: equationRight.map((x) => ({ coef: new Frac(BigInt(x.coef)), formula: x.formula, text: nameOf(x.formula) })), reversible: reaction.reversible, arrow: '->', source: reaction.source, hasCoefficients: true };
  const coefs = [...finalReaction.reactants, ...finalReaction.products].map((x) => x.coef);
  const text = formatReaction(finalReaction, coefs, 'text');
  const latex = formatReaction(finalReaction, coefs, 'latex');
  const check = balanceCheck(finalReaction);
  if (!check.balanced) fail('CHEM_UNBALANCED_REACTION', 'Interner Fehler: die berechnete Gleichung ist nicht ausgeglichen.');
  res.step('Ausgeglichene Gleichung', L(latex, text));
  res.step('Probe', ...check.rows.map((r) => L(`${r.key === 'charge' ? '\\text{Ladung}' : `\\mathrm{${r.key}}`}:\\ ${r.left} = ${r.right}`, `${r.key === 'charge' ? 'Ladung' : r.key}: ${r.left} = ${r.right}`)));
  res.answer({ text, unicode: formatReaction(finalReaction, coefs, 'unicode'), latex });
  res.result.equation = text;
  res.result.coefficients = coefs.map((c) => Number(c.n));
  res.result.medium = medium;
  const usedMedium = [...equationLeft, ...equationRight].some((x) => ['H+', 'OH-'].includes(keyOf(x.formula)) && !species.some((s) => keyOf(s.formula) === keyOf(x.formula)));
  if (mediumAssumed && usedMedium) res.assume('Kein Medium angegeben: sauer angenommen (H⁺ und H₂O werden ergänzt). Für basisch medium=basisch angeben.');
  const skeletonKeys = new Set([...equationLeft, ...equationRight].map((x) => keyOf(x.formula)));
  const dropped = species.filter((s) => !skeletonKeys.has(keyOf(s.formula)));
  for (const s of dropped) res.warn('CHEM_OUTSIDE_MODEL', `${nameOf(s.formula)} hebt sich auf oder nimmt nicht teil und kommt in der ausgeglichenen Gleichung nicht mehr vor.`);
  res.source('Oxidationszahlen nach den Regeln der Schulchemie; Ausgleich über Atom- und Ladungsbilanz (exakte Bruchrechnung)');
  res.actions = [{ label: 'Zellspannung', command: 'zellspannung' }];
  res.chemistry = { medium, equation: text, split, electrons: split ? result.electrons : null };
  return res;
}

/** "Mn: +7 → +2 (Reduktion, −5 e⁻)" lines from the oxidation numbers */
function changesOf(species, numbers) {
  const lines = [];
  const seen = new Set();
  for (const s of species.filter((x) => x.side === 'left' && !x.formula.electron)) {
    for (const el of Object.keys(s.formula.atoms)) {
      if ((el === 'O' && numbers.get(s).O.equals(-2)) || (el === 'H' && numbers.get(s).H.equals(1))) continue;
      for (const p of species.filter((x) => x.side === 'right' && x.formula.atoms[el] && !x.formula.electron)) {
        const a = numbers.get(s)[el];
        const c = numbers.get(p)[el];
        if (!a || !c || a.equals(c)) continue;
        const key = `${el}:${keyOf(s.formula)}:${keyOf(p.formula)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const up = c.sub(a).sign > 0;
        lines.push(L(`\\mathrm{${el}}:\\ ${onText(a, 'latex')} \\to ${onText(c, 'latex')}\\quad(\\text{${up ? 'Oxidation' : 'Reduktion'}})`, `${el}: ${onText(a)} → ${onText(c)} (${up ? 'Oxidation' : 'Reduktion'})`));
      }
    }
  }
  return lines;
}

// Chemical equilibrium. For one reaction Σν_i A_i = 0 the activities follow a_i = a_i⁰ + ν_i·ξ with the extent ξ, and the
// law of mass action Π a_i^ν_i = K has exactly one root ξ inside the range where no activity is negative: the left side
// (in logarithm) rises strictly with ξ. It is found by bisection, so concentrations can never become negative.
// Several coupled reactions are solved by damped Newton steps on the convex function whose gradient is ln Q − ln K.

import { ChemicalResult, L } from './result.js';
import { coefficientsFor } from './balance.js';
import { formatReaction, speciesOf } from './reaction.js';
import { formulaKey, formatFormula } from './formula.js';
import { resolve, resolveParsed, latexOf, parseGiven, conditionsFrom, isPurePhase } from './amounts.js';
import { Quantity } from './quantity.js';
import { formatNumber } from './format.js';
import { CONSTANTS, DEFAULT_TEMPERATURE } from './constants.js';
import { fail } from './errors.js';
import { solveLinearFloat } from './numeric.js';

const R = CONSTANTS.R.value;
const fmt = (v, sig = 4) => formatNumber(v, { sig });
const fmtL = (v, sig = 4) => formatNumber(v, { sig, style: 'latex' });

/**
 * Activities a[i] = a0[i] + ν[i]·ξ for one reaction; `active[i]` false marks pure solids/liquids (activity 1).
 * Returns { xi, a, iterations } — the unique root of Σ ν ln a = ln K with all activities > 0.
 */
export function solveExtent(nu, a0, K, active = nu.map(() => true)) {
  if (!(K > 0) || !Number.isFinite(K)) fail('CHEM_MISSING_CONSTANT', 'Die Gleichgewichtskonstante muss eine positive Zahl sein.');
  const idx = nu.map((v, i) => i).filter((i) => active[i] && nu[i] !== 0);
  if (!idx.length) fail('CHEM_OUTSIDE_MODEL', 'Es gibt keine gelösten Stoffe oder Gase, die im Massenwirkungsgesetz vorkommen.');
  if (idx.some((i) => a0[i] < 0)) fail('CHEM_NEGATIVE_CONCENTRATION', 'Eine Anfangskonzentration ist negativ.');
  let lo = -Infinity;
  let hi = Infinity;
  for (const i of idx) {
    const bound = -a0[i] / nu[i];
    if (nu[i] > 0) lo = Math.max(lo, bound);
    else hi = Math.min(hi, bound);
  }
  if (!(lo < hi)) {
    // the range is empty: a reactant and a product are both absent at the start
    fail('CHEM_NO_SOLUTION', 'Es ist weder ein Edukt noch ein Produkt vorhanden; das Gleichgewicht ist nicht bestimmt.');
  }
  const lnK = Math.log(K);
  const value = (xi, anchor) => {
    let s = 0;
    for (const i of idx) {
      const a = anchor ? anchor(i, xi) : a0[i] + nu[i] * xi;
      if (!(a > 0)) return nu[i] > 0 ? -Infinity : Infinity;
      s += nu[i] * Math.log(a);
    }
    return s - lnK;
  };
  const scale = idx.reduce((m, i) => Math.max(m, a0[i]), 0) || 1;
  // bracket: finite ends are singular (F = ∓∞); infinite ends are expanded until F changes sign
  let a = lo;
  let b = hi;
  if (!Number.isFinite(a)) {
    a = (Number.isFinite(b) ? b : 0) - scale;
    while (value(a) > 0 && a > -1e300) a = (Number.isFinite(b) ? b : 0) - 2 * (( Number.isFinite(b) ? b : 0) - a);
  }
  if (!Number.isFinite(b)) {
    b = a + scale;
    while (value(b) < 0 && b < 1e300) b = a + 2 * (b - a);
  }
  let xi = (a + b) / 2;
  let iterations = 0;
  // bisection in ξ, then a refinement that stays exact where a species nearly vanishes
  for (; iterations < 400; iterations++) {
    xi = (a + b) / 2;
    if (xi === a || xi === b) break;
    if (value(xi) < 0) a = xi;
    else b = xi;
  }
  let activities = nu.map((v, i) => (active[i] ? a0[i] + v * xi : 1));
  // a nearly consumed reactant loses digits in a0 − |ν|ξ: solve for what is left instead
  const near = idx.filter((i) => activities[i] < 1e-6 * Math.max(a0[i], scale * 1e-3) && (nu[i] < 0 ? Number.isFinite(hi) : Number.isFinite(lo)));
  if (near.length) {
    const i0 = near.reduce((best, i) => (activities[i] < activities[best] ? i : best), near[0]);
    const end = nu[i0] < 0 ? hi : lo;
    // ξ = end − sign·δ, δ > 0; species i0 has activity |ν_i0|·δ exactly
    const sgn = nu[i0] < 0 ? 1 : -1;
    const anchored = (i, delta) => (i === i0 ? Math.abs(nu[i0]) * delta : a0[i] + nu[i] * (end - sgn * delta));
    const g = (delta) => value(delta, anchored);
    // F rises with ξ, so it falls with δ when ξ = end − δ and rises with δ when ξ = end + δ
    const tooSmall = (delta) => (sgn > 0 ? g(delta) > 0 : g(delta) < 0);
    let dLo = 0;
    let dHi = Math.max(Math.abs(end - xi) * 4, 1e-300);
    while (tooSmall(dHi) && dHi < 1e300) dHi *= 2;
    for (let k = 0; k < 400; k++) {
      const mid = (dLo + dHi) / 2;
      if (mid === dLo || mid === dHi) break;
      if (tooSmall(mid)) dLo = mid;
      else dHi = mid;
    }
    const delta = (dLo + dHi) / 2;
    xi = end - sgn * delta;
    activities = nu.map((v, i) => (!active[i] ? 1 : i === i0 ? Math.abs(nu[i0]) * delta : a0[i] + v * xi));
  }
  return { xi, a: activities, iterations };
}

/**
 * Several coupled reactions: reactions[j] = ν vector, K[j]. Solves Σ_j ν_ij ln … by damped Newton steps on
 * G(ξ) = Σ_i (a_i ln a_i − a_i) − Σ_j ξ_j ln K_j, a convex function; the step is cut so that no activity reaches zero.
 * Returns { xi: number[], a: number[], iterations }.
 */
export function solveCoupled(reactions, K, a0, active = a0.map(() => true)) {
  const m = reactions.length;
  const n = a0.length;
  const act = (i) => active[i] && reactions.some((r) => r[i] !== 0);
  const conc = (xi) => a0.map((v, i) => v + reactions.reduce((s, r, j) => s + r[i] * xi[j], 0));
  // an interior starting point: push every violated constraint a0 + ν·ξ ≥ ε back by projection
  const scale = a0.reduce((m2, v, i) => (act(i) ? Math.max(m2, v) : m2), 0) || 1;
  const eps = 1e-6 * scale;
  let xi = new Array(m).fill(0);
  for (let pass = 0; pass < 20000; pass++) {
    const a = conc(xi);
    let worst = -1;
    for (let i = 0; i < n; i++) if (act(i) && a[i] < eps * 0.999 && (worst < 0 || a[i] < a[worst])) worst = i;
    if (worst < 0) break;
    const row = reactions.map((r) => r[worst]);
    const norm = row.reduce((s, x) => s + x * x, 0);
    if (norm === 0) fail('CHEM_NO_SOLUTION', 'Ein Stoff ohne Anfangsmenge kann durch keine Reaktion entstehen.');
    xi = xi.map((v, j) => v + ((eps - a[worst]) / norm) * row[j] * 1.5);
    if (pass === 19999) fail('CHEM_NO_SOLUTION', 'Es gibt keinen Zustand, in dem alle Konzentrationen positiv sind.');
  }
  const lnK = K.map(Math.log);
  const G = (x) => {
    const a = conc(x);
    let s = 0;
    for (let i = 0; i < n; i++) if (act(i)) s += a[i] * Math.log(a[i]) - a[i];
    for (let j = 0; j < m; j++) s -= x[j] * lnK[j];
    return s;
  };
  let iterations = 0;
  for (; iterations < 500; iterations++) {
    const a = conc(xi);
    const grad = reactions.map((r, j) => {
      let s = -lnK[j];
      for (let i = 0; i < n; i++) if (act(i)) s += r[i] * Math.log(a[i]);
      return s;
    });
    if (Math.max(...grad.map(Math.abs)) < 1e-13) break;
    // Hessian H_jk = Σ_i ν_ij ν_ik / a_i
    const H = reactions.map((rj) => reactions.map((rk) => {
      let s = 0;
      for (let i = 0; i < n; i++) if (act(i)) s += (rj[i] * rk[i]) / a[i];
      return s;
    }));
    const step = solveLinearFloat(H, grad);
    const dx = step;
    // damp: keep every activity positive and G falling
    let t = 1;
    for (let i = 0; i < n; i++) {
      if (!act(i)) continue;
      const d = reactions.reduce((s, r, j) => s + r[i] * -dx[j], 0);
      if (d < 0) t = Math.min(t, (0.9 * a[i]) / -d);
    }
    const g0 = G(xi);
    let next;
    for (let tries = 0; tries < 60; tries++) {
      next = xi.map((v, j) => v - t * dx[j]);
      if (G(next) <= g0 + 1e-15 * Math.abs(g0)) break;
      t /= 2;
    }
    xi = next;
  }
  return { xi, a: conc(xi), iterations };
}


// ------------------------------------------------------------------------------------ the command level

const isPure = isPurePhase;

/** Which species of the reaction a substance text means */
function indexOfSpecies(subs, text) {
  const wanted = resolve(text);
  const i = subs.findIndex((s) => formulaKey(s.formula) === formulaKey(wanted.formula));
  if (i < 0) fail('CHEM_UNKNOWN_SUBSTANCE', `${text} kommt in der Reaktionsgleichung nicht vor.`, { substance: text });
  return i;
}

const readK = (options) => {
  const num = (t) => {
    const v = Number(String(t).trim().replace(',', '.').replace(/[·×]\s*10\^?/, 'e'));
    if (!Number.isFinite(v)) fail('CHEM_SYNTAX', `„${t}“ ist keine Zahl.`);
    return v;
  };
  if (options.Kp !== undefined) return { K: num(options.Kp), kind: 'p' };
  if (options.Kc !== undefined) return { K: num(options.Kc), kind: 'c' };
  if (options.K !== undefined) return { K: num(options.K), kind: null };
  return null;
};

/**
 * Equilibrium of one reaction.
 *   mode 'solve'    K and the start values are given → the equilibrium
 *   mode 'constant' values at the equilibrium (and optionally start values, c0(X)) are given → K
 * givens: "c(N2) = 1 mol/L", "c0(N2) = 1 mol/L", "p(NH3) = 2 bar", "n(NH3) = 0,5 mol" (with V=…).
 */
export function equilibrium(reactionText, givens, options = {}, mode = 'solve') {
  const { reaction, coefficients, auto } = coefficientsFor(reactionText);
  const species = speciesOf(reaction);
  const subs = species.map((s) => resolveParsed(s.formula));
  const nu = species.map((s, i) => (s.side === 'right' ? 1 : -1) * coefficients[i].toNumber());
  const conditions = conditionsFrom(options);
  const T = conditions.T !== undefined ? conditions.T : DEFAULT_TEMPERATURE;
  const res = new ChemicalResult('equilibrium', mode === 'constant' ? 'Gleichgewichtskonstante' : 'Gleichgewicht');
  res.step('Reaktionsgleichung', L(formatReaction(reaction, coefficients, 'latex'), formatReaction(reaction, coefficients, 'text')));
  if (auto) res.assume('Die Koeffizienten wurden automatisch ausgeglichen.');
  res.assume('Ideale Lösung bzw. ideales Gas: Aktivitäten a = c/c° und p/p° mit c° = 1 mol/L und p° = 1 bar.');

  const pure = subs.map(isPure);
  const active = pure.map((p) => !p);
  if (pure.some(Boolean)) res.assume(`Reine Feststoffe und Flüssigkeiten (${subs.filter((s, i) => pure[i]).map((s) => s.label).join(', ')}) haben die Aktivität 1 und stehen nicht im Massenwirkungsgesetz.`);
  const dn = species.reduce((s, sp, i) => (active[i] && subs[i].phase === 'g' ? s + nu[i] : s), 0);

  const kGiven = readK(options);
  const parsedGivens = givens.map((t) => ({ text: t, ...parseGiven(t) }));
  const usesPressure = (kGiven && kGiven.kind === 'p') || parsedGivens.some((g) => g.quantities[0] && g.quantities[0].is('pressure'));
  const unit = usesPressure ? 'bar' : 'mol/L';
  const volume = options.V !== undefined ? Quantity.parse(options.V).need('volume', 'das Volumen').in('L') : null;

  const start = subs.map(() => null);
  const atEq = subs.map(() => null);
  for (const g of parsedGivens) {
    if (!g.substance) fail('CHEM_SYNTAX', `„${g.text}“: es fehlt der Stoff, z. B. c(N2) = 1 mol/L.`);
    const i = indexOfSpecies(subs, g.substance);
    const q = g.quantities[0];
    let v;
    if (q.is('pressure')) v = q.in('bar');
    else if (q.is('concentration')) v = q.in('mol/L');
    else if (q.is('amount')) {
      if (volume === null) fail('CHEM_MISSING_CONSTANT', `Zur Stoffmenge von ${g.substance} fehlt das Volumen (V=…).`);
      v = q.in('mol') / volume;
    } else fail('CHEM_UNIT_MISMATCH', `Für ${g.substance} wird eine Konzentration, ein Druck oder eine Stoffmenge erwartet.`);
    if (g.initial || mode === 'solve') start[i] = v;
    else atEq[i] = v;
  }
  if (usesPressure && species.some((s, i) => active[i] && subs[i].phase !== 'g')) res.warn('CHEM_OUTSIDE_MODEL', 'Ein Druck gilt nur für Gase; gelöste Stoffe gehen mit ihrer Konzentration ein.');

  const factor = (0.08314462618 * T); // bar·L/(mol): c° R T / p°
  const toKind = (K, from, to) => (from === to || from === null || dn === 0 ? K : to === 'p' ? K * factor ** dn : K / factor ** dn);
  const namesExpr = (which) => {
    const nums = [];
    const dens = [];
    species.forEach((s, i) => {
      if (!active[i]) return;
      const p = Math.abs(nu[i]);
      const f = `${which === 'p' ? 'p' : 'c'}(${latexOf(subs[i])})`;
      (nu[i] > 0 ? nums : dens).push(p === 1 ? f : `${f}^{${p}}`);
    });
    return `\\frac{${nums.join('\\cdot ') || '1'}}{${dens.join('\\cdot ') || '1'}}`;
  };
  const kKind = usesPressure ? 'p' : 'c';
  res.step('Massenwirkungsgesetz', L(`K_${kKind} = ${namesExpr(kKind)}`, `K = (Produkte)^ν / (Edukte)^ν`));

  const activityOf = (i, value) => (active[i] ? value : 1);
  const Q = (a) => nu.reduce((prod, v, i) => (active[i] ? prod * a[i] ** v : prod), 1);
  const subName = (i) => subs[i].label;
  const valueLatex = (v) => `${fmtL(v)}\\,\\mathrm{${unit}}`;

  let K;
  let a0;
  let aEq;
  let xi;

  if (mode === 'constant') {
    // fill in the missing equilibrium values from the extent
    const fromStart = start.some((v) => v !== null);
    aEq = atEq.map((v) => v);
    if (fromStart) {
      subs.forEach((s, i) => {
        if (active[i] && start[i] === null) {
          start[i] = 0;
          res.assume(`Anfangswert von ${subName(i)} = 0.`);
        }
      });
      let xiKnown = null;
      subs.forEach((s, i) => {
        if (active[i] && start[i] !== null && atEq[i] !== null) {
          const x = (atEq[i] - start[i]) / nu[i];
          if (xiKnown !== null && Math.abs(x - xiKnown) > 1e-9 * Math.max(1, Math.abs(x))) fail('CHEM_NO_SOLUTION', 'Die Angaben passen nicht zusammen: Sie führen zu verschiedenen Reaktionsumsätzen.', { xi: [xiKnown, x] });
          xiKnown = x;
        }
      });
      if (xiKnown === null) fail('CHEM_MISSING_CONSTANT', 'Mit Anfangswerten braucht man mindestens einen Stoff, dessen Wert im Gleichgewicht bekannt ist.');
      xi = xiKnown;
      res.step('Reaktionsumsatz aus dem bekannten Stoff', L(`\\xi = \\frac{a_{\\mathrm{GG}} - a_0}{\\nu} = ${valueLatex(xi)}`, `ξ = (a(GG) − a0)/ν = ${fmt(xi)} ${unit}`));
      aEq = subs.map((s, i) => (active[i] ? (start[i] !== null ? start[i] : 0) + nu[i] * xi : 1));
      for (let i = 0; i < subs.length; i++) if (active[i] && aEq[i] < 0) fail('CHEM_NEGATIVE_CONCENTRATION', `${subName(i)} würde im Gleichgewicht negativ (${fmt(aEq[i])} ${unit}); die Angaben sind nicht möglich.`, { substance: subName(i) });
    } else {
      const missing = subs.filter((s, i) => active[i] && atEq[i] === null).map((s) => s.label);
      if (missing.length) fail('CHEM_MISSING_CONSTANT', `Es fehlen Gleichgewichtswerte für: ${missing.join(', ')}. Mit Anfangswerten c0(…) lässt sich der Rest ausrechnen.`, { missing });
      aEq = subs.map((s, i) => activityOf(i, atEq[i]));
    }
    if (subs.some((s, i) => active[i] && !(aEq[i] > 0) && nu[i] < 0 === false && aEq[i] === 0)) fail('CHEM_NO_SOLUTION', 'Ein Produkt hat im Gleichgewicht die Konzentration 0; K ist nicht bestimmt.');
    K = Q(aEq);
    if (!Number.isFinite(K) || K <= 0) fail('CHEM_NO_SOLUTION', 'Aus diesen Werten lässt sich keine Gleichgewichtskonstante berechnen (eine Konzentration ist 0).');
    res.step('Gleichgewichtskonzentrationen', ...subs.map((s, i) => (active[i] ? L(`${latexOf(s)}:\\ ${valueLatex(aEq[i])}`, `${s.label}: ${fmt(aEq[i])} ${unit}`) : null)).filter(Boolean));
    const terms = species.map((s, i) => (active[i] ? `${aEq[i] < 0.01 || aEq[i] >= 1e4 ? fmtL(aEq[i]) : fmtL(aEq[i])}${Math.abs(nu[i]) === 1 ? '' : `^{${Math.abs(nu[i])}}`}` : null));
    const num = species.map((s, i) => (active[i] && nu[i] > 0 ? terms[i] : null)).filter(Boolean).join('\\cdot ') || '1';
    const den = species.map((s, i) => (active[i] && nu[i] < 0 ? terms[i] : null)).filter(Boolean).join('\\cdot ') || '1';
    res.step('Einsetzen', L(`K_${kKind} = \\frac{${num}}{${den}} = ${fmtL(K)}`, `K = ${fmt(K)}`));
    res.answer(new Quantity(K, ''), { name: `K${kKind}` });
    res.result.latex = `K_${kKind} = ${fmtL(K)}`;
    res.value(`K${kKind}`, new Quantity(K, ''));
    if (dn !== 0 || kGiven === null) {
      const other = kKind === 'p' ? 'c' : 'p';
      if (species.some((s, i) => active[i] && subs[i].phase === 'g')) {
        const converted = toKind(K, kKind, other);
        res.value(`K${other} (bei ${fmt(T)} K)`, new Quantity(converted, ''));
        res.step('Umrechnung Kc ↔ Kp', L(`K_p = K_c\\,(R\\,T)^{\\Delta n},\\quad \\Delta n = ${dn}\;\\Rightarrow\; K_${other} = ${fmtL(converted)}`, `Kp = Kc·(R·T)^Δn, Δn = ${dn} => K${other} = ${fmt(converted)}`));
        res.assume(`Umrechnung bei T = ${fmt(T)} K.`);
      }
    }
    res.chemistry = { K, xi: xi === undefined ? null : xi, equilibrium: aEq };
    return res;
  }

  // ---- solve for the equilibrium
  if (!kGiven) fail('CHEM_MISSING_CONSTANT', 'Die Gleichgewichtskonstante fehlt. Beispiel: gleichgewicht(N2 + 3 H2 <=> 2 NH3; Kc=0,5; c(N2)=1 mol/L; c(H2)=3 mol/L)');
  if (kGiven.kind !== null && kGiven.kind !== kKind && species.some((s, i) => active[i] && subs[i].phase === 'g')) {
    res.assume(`Umrechnung Kp ↔ Kc bei T = ${fmt(T)} K (Δn = ${dn}).`);
  } else if (kGiven.kind !== null && kGiven.kind !== kKind) res.warn('CHEM_OUTSIDE_MODEL', `K${kGiven.kind} wurde ohne Gase als K${kKind} verwendet.`);
  K = kGiven.kind !== null && kGiven.kind !== kKind ? toKind(kGiven.K, kGiven.kind, kKind) : kGiven.K;
  res.step('Gleichgewichtskonstante', L(`K_${kKind} = ${fmtL(K)}`, `K = ${fmt(K)}`));
  a0 = subs.map((s, i) => (active[i] ? (start[i] === null ? 0 : start[i]) : 1));
  subs.forEach((s, i) => {
    if (active[i] && start[i] === null) res.assume(`Anfangswert von ${subName(i)} = 0.`);
  });
  const q0 = active.some((x, i) => x && nu[i] < 0 && a0[i] > 0) && active.some((x, i) => x && nu[i] > 0 && a0[i] > 0) ? Q(a0) : null;
  if (q0 !== null) {
    res.step('Reaktionsquotient am Anfang', L(`Q = ${fmtL(q0)}\;${q0 < K ? '<' : q0 > K ? '>' : '='}\; K \;\\Rightarrow\; \\text{${q0 < K ? 'die Reaktion läuft nach rechts' : q0 > K ? 'die Reaktion läuft nach links' : 'Gleichgewicht'}}`, `Q = ${fmt(q0)} ${q0 < K ? '<' : q0 > K ? '>' : '='} K => ${q0 < K ? 'die Reaktion läuft nach rechts' : q0 > K ? 'die Reaktion läuft nach links' : 'Gleichgewicht'}`));
  }
  const sol = solveExtent(nu, a0, K, active);
  xi = sol.xi;
  aEq = sol.a;
  res.step('Ansatz mit dem Umsatz ξ', L(`a_i = a_{i,0} + \\nu_i\\,\\xi\\quad\\Rightarrow\\quad K_${kKind} = \\frac{\\prod a_{\\mathrm{Produkte}}^{\\nu}}{\\prod a_{\\mathrm{Edukte}}^{\\nu}}`, 'a(i) = a0(i) + ν(i)·ξ; K = Π a^ν'));
  res.step('Lösung des Massenwirkungsgesetzes (nur Umsätze mit positiven Konzentrationen)', L(`\\xi = ${valueLatex(xi)}`, `ξ = ${fmt(xi)} ${unit}`));
  res.step('Gleichgewichtskonzentrationen', ...subs.map((s, i) => (active[i] ? L(`${latexOf(s)}:\\ ${fmtL(a0[i])} ${nu[i] > 0 ? '+' : '-'} ${Math.abs(nu[i]) === 1 ? '' : Math.abs(nu[i]) + '\\cdot '}${fmtL(Math.abs(xi))} = ${valueLatex(aEq[i])}`, `${s.label}: ${fmt(aEq[i])} ${unit}`) : null)).filter(Boolean));
  const check = Q(aEq);
  res.step('Probe', L(`Q = ${fmtL(check, 6)} \\approx K = ${fmtL(K, 6)}`, `Q = ${fmt(check, 6)} ≈ K = ${fmt(K, 6)}`));
  res.answer({ text: subs.map((s, i) => (active[i] ? `${s.label} = ${fmt(aEq[i])} ${unit}` : null)).filter(Boolean).join('; '), latex: subs.map((s, i) => (active[i] ? `${latexOf(s)} = ${valueLatex(aEq[i])}` : null)).filter(Boolean).join(',\\ ') });
  subs.forEach((s, i) => {
    if (active[i]) res.value(`${usesPressure ? 'p' : 'c'}(${s.label}) im Gleichgewicht`, new Quantity(aEq[i], unit));
  });
  res.value('Reaktionsumsatz ξ', new Quantity(xi, unit));
  const limiting = subs.map((s, i) => ({ i, share: nu[i] < 0 && a0[i] > 0 ? -nu[i] * xi / a0[i] : null })).filter((x) => x.share !== null);
  for (const l of limiting) res.value(`Umsatz ${subName(l.i)}`, new Quantity(l.share * 100, '%'));
  res.table = { head: ['Stoff', `Anfang in ${unit}`, `Änderung in ${unit}`, `Gleichgewicht in ${unit}`], rows: subs.map((s, i) => (active[i] ? [latexOf(s), fmtL(a0[i]), fmtL(nu[i] * xi), fmtL(aEq[i])] : null)).filter(Boolean) };
  res.chemistry = { K, xi, equilibrium: aEq, start: a0, unit };
  return res;
}

// ------------------------------------------------------------------------------------ coupled equilibria

/**
 * Several equilibria at once: gleichgewicht(R1; R2; K1=…; K2=…; c(X)=…). Every reaction has its own K (K1, K2, …, or
 * Kp1, Kc1 …); species with the same formula in different reactions are the same species. The extents of all reactions
 * are found together, so every concentration stays positive and every mass action law holds at the same time.
 */
export function coupledEquilibrium(reactionTexts, givens, options = {}) {
  const parsed = reactionTexts.map((t) => coefficientsFor(t));
  const res = new ChemicalResult('equilibrium', 'Gekoppelte Gleichgewichte');
  const universe = [];
  const indexOf = (formula) => {
    const key = formulaKey({ ...formula, phase: null });
    let i = universe.findIndex((u) => u.key === key);
    if (i < 0) {
      universe.push({ key, sub: resolveParsed(formula) });
      i = universe.length - 1;
    }
    return i;
  };
  const vectors = parsed.map((p) => {
    const v = {};
    speciesOf(p.reaction).forEach((s, i) => {
      const at = indexOf(s.formula);
      v[at] = (v[at] || 0) + (s.side === 'right' ? 1 : -1) * p.coefficients[i].toNumber();
    });
    return v;
  });
  const n = universe.length;
  const nu = vectors.map((v) => Array.from({ length: n }, (_, i) => v[i] || 0));
  const active = universe.map((u) => !isPure(u.sub));
  const Ks = parsed.map((p, j) => {
    const raw = options[`K${j + 1}`] ?? options[`Kc${j + 1}`] ?? options[`Kp${j + 1}`];
    if (raw === undefined) fail('CHEM_MISSING_CONSTANT', `Für die ${j + 1}. Reaktion fehlt die Gleichgewichtskonstante K${j + 1}=….`);
    const v = Number(String(raw).trim().replace(',', '.').replace(/[·×]\s*10\^?/, 'e'));
    if (!(v > 0) || !Number.isFinite(v)) fail('CHEM_MISSING_CONSTANT', `K${j + 1} muss eine positive Zahl sein.`);
    return v;
  });
  parsed.forEach((p, j) => {
    res.step(`Reaktion ${j + 1}`, L(`${formatReaction(p.reaction, p.coefficients, 'latex')},\\quad K_${j + 1} = ${fmtL(Ks[j])}`, `${formatReaction(p.reaction, p.coefficients, 'text')}, K${j + 1} = ${fmt(Ks[j])}`));
  });
  res.assume('Ideale Lösung: Aktivitäten = c/c° mit c° = 1 mol/L; reine Feststoffe und Flüssigkeiten haben die Aktivität 1.');
  const a0 = universe.map(() => 0);
  const volume = options.V !== undefined ? Quantity.parse(options.V).need('volume', 'das Volumen').in('L') : null;
  for (const text of givens) {
    const g = parseGiven(text);
    if (!g.substance) fail('CHEM_SYNTAX', `„${text}“: es fehlt der Stoff, z. B. c(H2A) = 0,1 mol/L.`);
    const wanted = formulaKey({ ...resolve(g.substance).formula, phase: null });
    const i = universe.findIndex((u) => u.key === wanted);
    if (i < 0) fail('CHEM_UNKNOWN_SUBSTANCE', `${g.substance} kommt in keiner Reaktion vor.`, { substance: g.substance });
    const q = g.quantities[0];
    if (q.is('concentration')) a0[i] = q.in('mol/L');
    else if (q.is('amount') && volume !== null) a0[i] = q.in('mol') / volume;
    else fail('CHEM_UNIT_MISMATCH', `Für ${g.substance} wird eine Konzentration erwartet (oder eine Stoffmenge mit V=…).`);
    if (a0[i] < 0) fail('CHEM_NEGATIVE_CONCENTRATION', `Die Anfangskonzentration von ${g.substance} ist negativ.`);
  }
  universe.forEach((u, i) => {
    if (!active[i]) a0[i] = 1;
  });
  const sol = solveCoupled(nu, Ks, a0, active);
  // the answer must satisfy every law and stay positive
  const q = (j) => universe.reduce((prod, u, i) => (active[i] ? prod * sol.a[i] ** nu[j][i] : prod), 1);
  res.step('Ansatz', L('a_i = a_{i,0} + \\sum_j \\nu_{ij}\\,\\xi_j\\quad\\text{und}\\quad \\prod_i a_i^{\\nu_{ij}} = K_j\\ \\text{für jede Reaktion}', 'a(i) = a0(i) + Σ ν(i,j)·ξ(j) und Π a^ν = K(j) für jede Reaktion'));
  res.step('Umsätze', L(sol.xi.map((x, j) => `\\xi_${j + 1} = ${fmtL(x)}\\,\\mathrm{mol/L}`).join(',\\ '), sol.xi.map((x, j) => `ξ${j + 1} = ${fmt(x)} mol/L`).join(', ')));
  res.step('Gleichgewichtskonzentrationen', ...universe.map((u, i) => (active[i] ? L(`${latexOf(u.sub)}:\\ ${fmtL(sol.a[i])}\\,\\mathrm{mol/L}`, `${u.sub.label}: ${fmt(sol.a[i])} mol/L`) : null)).filter(Boolean));
  res.step('Probe der Massenwirkungsgesetze', ...parsed.map((p, j) => L(`Q_${j + 1} = ${fmtL(q(j), 6)} \\approx K_${j + 1} = ${fmtL(Ks[j], 6)}`, `Q${j + 1} = ${fmt(q(j), 6)} ≈ K${j + 1} = ${fmt(Ks[j], 6)}`)));
  // conservation: charge always; atoms when no pure phase takes part
  const charge = (a) => universe.reduce((s, u, i) => (active[i] ? s + u.sub.formula.charge * a[i] : s), 0);
  const c0 = charge(a0);
  const c1 = charge(sol.a);
  res.step('Ladungsbilanz', L(`\\sum z\\,c = ${fmtL(c0)} \\to ${fmtL(c1)}\\,\\mathrm{mol/L}\\quad(\\text{unverändert})`, `Σ z·c: ${fmt(c0)} → ${fmt(c1)} mol/L (unverändert)`));
  if (Math.abs(c1 - c0) > 1e-9 * Math.max(1, Math.abs(c0))) res.warn('CHEM_OUTSIDE_MODEL', 'Die Ladungsbilanz hat sich verändert: Die Reaktionen sind nicht ladungsneutral geschrieben.');
  if (universe.every((u, i) => active[i])) {
    const elements = new Set(universe.flatMap((u) => Object.keys(u.sub.formula.atoms)));
    const lines = [...elements].map((el) => {
      const total = (a) => universe.reduce((s, u, i) => s + (u.sub.formula.atoms[el] || 0) * a[i], 0);
      return `${el}: ${fmt(total(a0))} → ${fmt(total(sol.a))} mol/L`;
    });
    res.step('Massenbilanz (Elemente)', ...lines.map((t) => L(`\\text{${t}}`, t)));
  }
  res.answer({ text: universe.map((u, i) => (active[i] ? `${u.sub.label} = ${fmt(sol.a[i])} mol/L` : null)).filter(Boolean).join('; '), latex: universe.map((u, i) => (active[i] ? `${latexOf(u.sub)} = ${fmtL(sol.a[i])}\\,\\mathrm{mol/L}` : null)).filter(Boolean).join(',\\ ') });
  universe.forEach((u, i) => {
    if (active[i]) res.value(`c(${u.sub.label}) im Gleichgewicht`, new Quantity(sol.a[i], 'mol/L'));
  });
  res.table = { head: ['Stoff', 'Anfang in mol/L', 'Gleichgewicht in mol/L'], rows: universe.map((u, i) => (active[i] ? [latexOf(u.sub), fmtL(a0[i]), fmtL(sol.a[i])] : null)).filter(Boolean) };
  res.chemistry = { K: Ks, xi: sol.xi, equilibrium: sol.a, species: universe.map((u) => u.sub.label), iterations: sol.iterations };
  return res;
}

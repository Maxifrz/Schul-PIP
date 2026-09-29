// The statistics, probability, test and simulation commands that are worked out in JavaScript (stats.js) instead of
// Giac: they answer with a table of values, and the chart commands also draw into the graphics (charts.js). Lists
// come from Giac, so L, zellen(A1, A10), [1, 2, a] and slider values all work as arguments.

import * as S from './stats.js';
import { latexNumber } from './expr.js';
import { command, COMMANDS, CATEGORIES } from './commands.js';

const num = (v, digits = 6) => (Number.isFinite(v) ? latexNumber(String(v), digits) : v === Infinity ? '\\infty' : v === -Infinity ? '-\\infty' : '\\text{–}');
// Decimal commas in words too: B(20; 0,3)
const text = (t) => '\\text{' + String(t).replace(/[\\{}]/g, '').replace(/(\d)\.(\d)/g, '$1,$2') + '}';
const list = (values, digits) => '\\left\\{' + values.map((v) => num(v, digits)).join(';\\ ') + '\\right\\}';
const interval = (a, b) => `\\left[${num(a)};\\ ${num(b)}\\right]`;
const percent = (p) => num(p * 100, 4) + '\\,\\%';

/** Words that stand for themselves in a call: distributions, sides of a test, regression models */
export const WORDS = new Set([
  ...Object.keys(S.DISTRIBUTION_ALIASES), ...Object.keys(S.MODEL_ALIASES),
  'ableiten', 'integrieren', 'gleichung', 'bruch', 'prozent',
  'links', 'linksseitig', 'rechts', 'rechtsseitig', 'beidseitig', 'zweiseitig', 'ohne', 'mit', 'ohnezurücklegen', 'mitzurücklegen',
]);

export function isWord(node) {
  return Boolean(node && ((node.t === 'sym' && WORDS.has(node.v.toLowerCase())) || node.t === 'str'));
}

const wordOf = (node) => (node.t === 'str' ? node.v : node.v).toLowerCase();

/** y' = x·y is given as its right side; so is f(x) = … */
export function functionArg(node) {
  if (node && node.t === 'rel' && node.op === '=' && ((node.a.t === 'call' && node.a.prime) || node.a.t === 'call' || node.a.t === 'sym')) return node.b;
  return node;
}

const fmt = (v, digits = 6) => (Number.isFinite(v) ? latexNumber(String(Number(v.toPrecision(digits))), digits) : '\\text{–}');

/** Reads the arguments of a call through Giac; `ctx` comes from the engine. */
export function reader(ctx, args) {
  let i = 0;
  const r = {
    get left() {
      return args.length - i;
    },
    peekWord() {
      return i < args.length && isWord(args[i]);
    },
    word(fallback) {
      if (i < args.length && isWord(args[i])) return wordOf(args[i++]);
      if (fallback !== undefined) return fallback;
      throw new Error('Hier fehlt ein Wort wie binomial, links oder linear.');
    },
    number(fallback) {
      // A word where a number with a default could be: the default is meant (binomialtest(100, 0.5, links)).
      if (i >= args.length || (fallback !== undefined && isWord(args[i]))) {
        if (fallback !== undefined) return fallback;
        throw new Error('Hier fehlt eine Zahl.');
      }
      const value = ctx.values(args[i++]);
      if (typeof value !== 'number') throw new Error('Hier wird eine Zahl erwartet, keine Liste.');
      return value;
    },
    numbers() {
      if (i >= args.length) throw new Error('Hier fehlt eine Liste, z. B. [1, 2, 3].');
      const value = ctx.values(args[i++]);
      const flat = Array.isArray(value) ? value.flat(Infinity) : [value];
      if (!flat.length) throw new Error('Die Liste ist leer.');
      return flat;
    },
    matrix() {
      const value = ctx.values(args[i++]);
      if (!Array.isArray(value) || !value.every(Array.isArray)) throw new Error('Hier wird eine Tabelle (Matrix) erwartet.');
      return value;
    },
    isList() {
      if (i >= args.length) return false;
      return Array.isArray(ctx.values(args[i]));
    },
    rest() {
      const out = [];
      while (i < args.length) out.push(isWord(args[i]) ? wordOf(args[i++]) : r.number());
      return out;
    },
  };
  return r;
}

const summaryRows = (s) => [
  ['Anzahl n', num(s.n)],
  ['Mittelwert x̄', num(s.mean)],
  ['Median', num(s.median)],
  ['Modus', s.modes.length ? s.modes.map((m) => num(m)).join(';\\ ') : text('keiner')],
  ['Minimum', num(s.min)],
  ['Maximum', num(s.max)],
  ['Spannweite', num(s.range)],
  ['unteres Quartil q₁', num(s.q1)],
  ['oberes Quartil q₃', num(s.q3)],
  ['Quartilsabstand', num(s.iqr)],
  ['Varianz (÷ n)', num(s.variance)],
  ['Standardabweichung σ (÷ n)', num(s.sd)],
  ...(s.n > 1 ? [['Stichprobenvarianz s² (÷ n−1)', num(s.sampleVariance)], ['Stichproben-Standardabweichung s', num(s.sampleSd)], ['Standardfehler s/√n', num(s.standardError)]] : []),
  ['Summe', num(s.sum)],
].map(([label, latex]) => ({ label, latex }));

export function distributionOf(r) {
  const name = r.word();
  const key = S.DISTRIBUTION_ALIASES[name];
  if (!key) throw new Error(`Unbekannte Verteilung „${name}“.`);
  const params = S.DISTRIBUTIONS[key].params.map(() => r.number());
  return S.distribution(key, params);
}

function testRows(result, h0, h1) {
  const rows = [
    { label: 'Nullhypothese', latex: h0 },
    { label: 'Gegenhypothese', latex: h1 },
    { label: 'Signifikanzniveau α', latex: num(result.alpha) },
    { label: 'Teststatistik ' + result.name, latex: num(result.statistic) },
  ];
  if (result.df !== undefined) rows.push({ label: 'Freiheitsgrade', latex: Array.isArray(result.df) ? result.df.map((d) => num(d)).join(';\\ ') : num(result.df) });
  if (result.critical !== undefined) rows.push({ label: 'kritischer Wert', latex: num(result.critical) });
  rows.push({ label: 'p-Wert', latex: num(result.p) });
  rows.push({ label: 'Entscheidung', latex: text(result.reject ? 'H₀ wird verworfen (p ≤ α)' : 'H₀ wird nicht verworfen (p > α)') });
  return rows;
}

const REL = { left: ['\\geq', '<'], right: ['\\leq', '>'], both: ['=', '\\neq'] };

/**
 * name → { run(ctx, args) → result, chart?: kind, random?: true }.
 * A result is { title, rows, table } (shown as a table) or { giac } (worked on by Giac like any other input).
 */
export const STAT_COMMANDS = {
  // Describing data
  statistik: {
    run(ctx, args) {
      const data = reader(ctx, args).numbers();
      return { title: 'Kennzahlen', rows: summaryRows(S.summary(data)) };
    },
  },
  häufigkeitstabelle: {
    run(ctx, args) {
      const data = reader(ctx, args).numbers();
      const rows = S.frequencies(data).map((f) => [num(f.value), num(f.count), num(f.relative, 4), num(f.cumulative, 4)]);
      return { title: 'Häufigkeitstabelle', table: { head: ['Wert', 'absolut', 'relativ', 'kumuliert'], rows }, rows: [{ label: 'Anzahl n', latex: num(data.length) }] };
    },
  },
  klassen: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const data = r.numbers();
      const width = r.number();
      const start = r.left ? r.number() : undefined;
      const rows = S.classes(data, width, start).map((c) => [`\\left[${num(c.from)};\\ ${num(c.to)}\\right[`, num(c.count), num(c.relative, 4)]);
      return { title: 'Klasseneinteilung', table: { head: ['Klasse', 'absolut', 'relativ'], rows } };
    },
  },

  // The spreadsheet in the CAS: zellen(A1, A10) is the list of those cells, zellen(A1, C5) a matrix
  zellen: {
    run(ctx, args) {
      const refs = args.map((a) => (a && a.t === 'sym' ? /^([A-Za-z])_?([1-9]\d{0,3})$/.exec(a.v) : null));
      if (refs.length !== 2 || refs.some((m) => !m)) throw new Error('zellen(A1, A10): erste und letzte Zelle des Bereichs.');
      const [c0, c1] = refs.map((m) => m[1].toUpperCase().charCodeAt(0) - 65);
      const [r0, r1] = refs.map((m) => Number(m[2]));
      const filled = ctx.cells ? (ref) => ctx.cells.has(ref) : () => true;
      const cols = [];
      for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c++) cols.push(String.fromCharCode(65 + c));
      const rows = [];
      for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r++) rows.push(r);
      if (cols.length === 1 || rows.length === 1) {
        const names = cols.flatMap((c) => rows.map((r) => c + r)).filter(filled);
        return { giac: '[' + names.join(',') + ']' };
      }
      const matrix = rows.map((r) => cols.map((c) => c + r)).filter((row) => row.every(filled));
      return { giac: '[' + matrix.map((row) => '[' + row.join(',') + ']').join(',') + ']' };
    },
  },

  // Charts
  boxplot: {
    chart: 'boxplot',
    run(ctx, args) {
      const s = S.summary(reader(ctx, args).numbers());
      return { title: 'Boxplot', rows: [['Minimum', s.min], ['unteres Quartil', s.q1], ['Median', s.median], ['oberes Quartil', s.q3], ['Maximum', s.max]].map(([label, v]) => ({ label, latex: num(v) })) };
    },
  },
  histogramm: {
    chart: 'histogram',
    run(ctx, args) {
      const r = reader(ctx, args);
      const data = r.numbers();
      const width = r.number();
      const start = r.left ? r.number() : undefined;
      const rows = S.classes(data, width, start).map((c) => [`\\left[${num(c.from)};\\ ${num(c.to)}\\right[`, num(c.count), num(c.relative, 4)]);
      return { title: 'Histogramm', table: { head: ['Klasse', 'absolut', 'relativ'], rows } };
    },
  },
  balkendiagramm: {
    chart: 'bars',
    run(ctx, args) {
      const { values, counts } = valuesAndCounts(reader(ctx, args));
      const total = counts.reduce((s, c) => s + c, 0);
      return { title: 'Säulendiagramm', table: { head: ['Wert', 'Höhe', 'Anteil'], rows: values.map((v, i) => [num(v), num(counts[i]), num(counts[i] / total, 4)]) } };
    },
  },
  kreisdiagramm: {
    chart: 'pie',
    run(ctx, args) {
      const { values, counts } = valuesAndCounts(reader(ctx, args));
      const total = counts.reduce((s, c) => s + c, 0);
      return { title: 'Kreisdiagramm', table: { head: ['Wert', 'Anzahl', 'Anteil', 'Winkel'], rows: values.map((v, i) => [num(v), num(counts[i]), percent(counts[i] / total), num((360 * counts[i]) / total, 4) + '^{\\circ}']) } };
    },
  },
  streudiagramm: {
    chart: 'scatter',
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const y = r.numbers();
      if (x.length !== y.length) throw new Error('X und Y müssen gleich viele Werte haben.');
      const rows = [{ label: 'Anzahl der Punkte', latex: num(x.length) }];
      if (x.length > 1) rows.push({ label: 'Korrelationskoeffizient r', latex: num(S.correlation(x, y), 4) });
      return { title: 'Streudiagramm', rows };
    },
  },
  residuenplot: {
    chart: 'residuals',
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const y = r.numbers();
      const fit = S.regression(x, y, r.word('linear'));
      return { title: 'Residuen (' + fit.label + ')', rows: [
        { label: 'Modell', latex: 'y=' + ctx.format(fit.giac) },
        { label: 'Residuen', latex: list(fit.residuals, 4) },
        { label: 'Quadratsumme der Residuen', latex: num(fit.ssRes) },
        { label: 'Bestimmtheitsmaß R²', latex: num(fit.r2, 4) },
      ] };
    },
  },

  // Regression
  regression: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const y = r.numbers();
      if (r.peekWord()) {
        const fit = S.regression(x, y, r.word());
        return { title: 'Regression (' + fit.label + ')', rows: [
          { label: 'Form', latex: text(fit.form) },
          { label: 'Regressionsgleichung', latex: 'y=' + ctx.format(fit.giac) },
          { label: 'Bestimmtheitsmaß R²', latex: num(fit.r2, 4) },
          { label: 'Residuen', latex: list(fit.residuals, 4) },
        ] };
      }
      const fits = S.compareModels(x, y);
      if (!fits.length) throw new Error('Kein Modell passt zu diesen Daten.');
      return { title: 'Modellvergleich (bestes zuerst)', table: { head: ['Modell', 'Gleichung', 'R²'], rows: fits.map((f) => [text(f.label), 'y=' + ctx.format(f.giac), num(f.r2, 4)]) } };
    },
  },
  regressionlinear: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'linear').giac }) },
  regressionquadratisch: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'quadratisch').giac }) },
  regressionkubisch: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'kubisch').giac }) },
  regressionexponentiell: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'exponentiell').giac }) },
  regressionlogarithmisch: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'logarithmisch').giac }) },
  regressionpotenz: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'potenz').giac }) },
  regressionsinus: { run: (ctx, args) => ({ giac: fitOf(ctx, args, 'sinus').giac }) },
  regressionpolynom: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const y = r.numbers();
      const degree = Math.round(r.number());
      if (!(degree >= 0) || degree >= new Set(x).size) throw new Error('Der Grad muss kleiner sein als die Anzahl verschiedener x-Werte.');
      return { giac: S.polynomialFit(x, y, degree).giac };
    },
  },
  residuen: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const y = r.numbers();
      const fit = S.regression(x, y, r.word('linear'));
      return { giac: '[' + fit.residuals.map((v) => S.roundNumber(v, 6)).join(',') + ']' };
    },
  },
  bestimmtheitsmaß: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const y = r.numbers();
      return { giac: S.roundNumber(S.regression(x, y, r.word('linear')).r2, 8) };
    },
  },

  // Probability
  verteilung: {
    chart: 'distribution',
    run(ctx, args) {
      const r = reader(ctx, args);
      const X = distributionOf(r);
      const bounds = r.left ? [r.number(), r.left ? r.number() : undefined] : null;
      const rows = [
        { label: 'Verteilung', latex: text(X.name) },
        { label: 'Erwartungswert μ', latex: num(X.mean) },
        { label: 'Varianz', latex: num(X.variance) },
        { label: 'Standardabweichung σ', latex: num(Math.sqrt(X.variance)) },
      ];
      if (bounds) {
        const [a, b] = bounds;
        const p = b === undefined ? S.probability(X, null, a) : S.probability(X, a, b);
        rows.push({ label: b === undefined ? `P(X ≤ ${a})` : `P(${a} ≤ X ≤ ${b})`, latex: num(p) });
      }
      const result = { title: X.label, rows };
      if (X.discrete) {
        const values = S.listed(X, 60);
        let cumulative = 0;
        result.table = { head: ['k', 'P(X = k)', 'P(X ≤ k)'], rows: values.map(([k, p]) => [num(k), num(p, 5), num((cumulative += p), 5)]) };
      }
      return result;
    },
  },
  kenngrößen: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const x = r.numbers();
      const p = r.numbers();
      if (x.length !== p.length) throw new Error('Werte und Wahrscheinlichkeiten müssen gleich viele sein.');
      const total = p.reduce((s, v) => s + v, 0);
      if (Math.abs(total - 1) > 1e-6) throw new Error(`Die Wahrscheinlichkeiten ergeben ${S.roundNumber(total)}, nicht 1.`);
      const E = x.reduce((s, v, i) => s + v * p[i], 0);
      const V = x.reduce((s, v, i) => s + (v - E) ** 2 * p[i], 0);
      return { title: 'Zufallsgröße', rows: [
        { label: 'Erwartungswert E(X)', latex: ctx.exact(`sum(${ctx.giac(args[0])}[k]*${ctx.giac(args[1])}[k],k,0,${x.length - 1})`) || num(E) },
        { label: 'Varianz V(X)', latex: num(V) },
        { label: 'Standardabweichung σ', latex: num(Math.sqrt(V)) },
      ] };
    },
  },
  invbinom: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const X = S.distribution('binomial', [r.number(), r.number()]);
      return { giac: String(X.quantile(r.number())) };
    },
  },
  sigmaumgebung: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const n = r.number();
      const p = r.number();
      const c = r.number(1.96);
      const s = S.sigmaInterval(n, p, c);
      return { title: `${num(c, 4)}σ-Umgebung von B(${n}; ${p})`, rows: [
        { label: 'μ = n·p', latex: num(s.mu) },
        { label: 'σ = √(n·p·(1−p))', latex: num(s.sigma) },
        { label: 'μ ± c·σ', latex: interval(s.mu - c * s.sigma, s.mu + c * s.sigma) },
        { label: 'ganzzahlig', latex: `\\left\\{${num(s.low)};\\ \\ldots;\\ ${num(s.high)}\\right\\}` },
        { label: 'Wahrscheinlichkeit', latex: num(s.probability) },
      ] };
    },
  },

  // Tests
  binomialtest: {
    chart: 'binomialtest',
    run(ctx, args) {
      const r = reader(ctx, args);
      const n = r.number();
      const p0 = r.number();
      const alpha = r.number(0.05);
      const side = S.sideOf(r.word('beidseitig'));
      const k = r.left ? r.number() : undefined;
      const t = S.binomialTest(n, p0, alpha, side, k);
      const [h0, h1] = REL[side];
      const region = t.region.length ? t.region.map(([a, b]) => `\\left\\{${num(a)};\\ \\ldots;\\ ${num(b)}\\right\\}`).join('\\cup ') : '\\emptyset';
      const rows = [
        { label: 'Test', latex: text(`${S.SIDE_TEXT[side]}, n = ${n}`) },
        { label: 'Nullhypothese', latex: `H_0\\colon\\ p${h0}${num(p0)}` },
        { label: 'Gegenhypothese', latex: `H_1\\colon\\ p${h1}${num(p0)}` },
        { label: 'Signifikanzniveau α', latex: num(alpha) },
        { label: 'Ablehnungsbereich', latex: '\\overline{A}=' + region },
        { label: 'tatsächliche Irrtumswahrscheinlichkeit', latex: num(t.error, 5) },
      ];
      if (k !== undefined) {
        rows.push({ label: 'p-Wert', latex: num(t.pValue, 5) });
        rows.push({ label: 'Entscheidung', latex: text(`k = ${k} liegt ${t.reject ? 'im Ablehnungsbereich: H₀ wird verworfen' : 'nicht im Ablehnungsbereich: H₀ wird nicht verworfen'}`) });
      }
      return { title: 'Binomialtest', rows };
    },
  },
  gausstest: {
    run(ctx, args) {
      const r = reader(ctx, args);
      let xbar;
      let n;
      if (r.isList()) {
        const data = r.numbers();
        xbar = S.mean(data);
        n = data.length;
      } else {
        xbar = r.number();
        n = r.number();
      }
      const mu0 = r.number();
      const sigma = r.number();
      const alpha = r.number(0.05);
      const side = S.sideOf(r.word('beidseitig'));
      const t = S.zTest(xbar, mu0, sigma, n, alpha, side);
      const [h0, h1] = REL[side];
      return { title: 'Gauß-Test (σ bekannt)', rows: [{ label: 'Stichprobenmittel x̄', latex: num(xbar) }, ...testRows(t, `H_0\\colon\\ \\mu${h0}${num(mu0)}`, `H_1\\colon\\ \\mu${h1}${num(mu0)}`)] };
    },
  },
  ttest: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const data = r.numbers();
      const mu0 = r.number();
      const alpha = r.number(0.05);
      const side = S.sideOf(r.word('beidseitig'));
      const t = S.tTest(data, mu0, alpha, side);
      const [h0, h1] = REL[side];
      return { title: 't-Test', rows: [{ label: 'x̄ und s', latex: num(t.mean) + ';\\ ' + num(t.sd) }, ...testRows(t, `H_0\\colon\\ \\mu${h0}${num(mu0)}`, `H_1\\colon\\ \\mu${h1}${num(mu0)}`)] };
    },
  },
  zweistichprobenttest: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const a = r.numbers();
      const b = r.numbers();
      const alpha = r.number(0.05);
      const side = S.sideOf(r.word('beidseitig'));
      const t = S.tTest2(a, b, alpha, side);
      const [h0, h1] = REL[side];
      return { title: 't-Test für zwei Stichproben (Welch)', rows: testRows(t, `H_0\\colon\\ \\mu_1${h0}\\mu_2`, `H_1\\colon\\ \\mu_1${h1}\\mu_2`) };
    },
  },
  varianztest: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const data = r.numbers();
      const sigma2 = r.number();
      const alpha = r.number(0.05);
      const side = S.sideOf(r.word('beidseitig'));
      const t = S.varianceTest(data, sigma2, alpha, side);
      const [h0, h1] = REL[side];
      return { title: 'χ²-Test für die Varianz', rows: testRows(t, `H_0\\colon\\ \\sigma^2${h0}${num(sigma2)}`, `H_1\\colon\\ \\sigma^2${h1}${num(sigma2)}`) };
    },
  },
  ftest: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const a = r.numbers();
      const b = r.numbers();
      const alpha = r.number(0.05);
      const side = S.sideOf(r.word('beidseitig'));
      const t = S.fTest(a, b, alpha, side);
      const [h0, h1] = REL[side];
      return { title: 'F-Test für zwei Varianzen', rows: testRows(t, `H_0\\colon\\ \\sigma_1^2${h0}\\sigma_2^2`, `H_1\\colon\\ \\sigma_1^2${h1}\\sigma_2^2`) };
    },
  },
  chi2test: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const first = ctx.values(args[0]);
      if (Array.isArray(first) && first.every(Array.isArray)) {
        const table = r.matrix();
        const t = S.chi2Independence(table, r.number(0.05));
        return { title: 'χ²-Unabhängigkeitstest', rows: [...testRows(t, text('Merkmale unabhängig'), text('Merkmale abhängig')), { label: 'erwartete Häufigkeiten', latex: t.expected.map((row) => list(row, 4)).join('\\ ') }] };
      }
      const observed = r.numbers();
      const expected = r.numbers();
      const t = S.chi2Fit(observed, expected, r.number(0.05));
      return { title: 'χ²-Anpassungstest', rows: [...testRows(t, text('die Daten folgen der Verteilung'), text('sie folgen ihr nicht')), { label: 'erwartete Häufigkeiten', latex: list(t.expected, 4) }] };
    },
  },
  konfidenzintervall: {
    run(ctx, args) {
      const r = reader(ctx, args);
      if (r.isList()) {
        const data = r.numbers();
        const level = r.number(0.95);
        const sigma = r.left ? r.number() : undefined;
        const k = S.meanInterval(data, level, sigma);
        return { title: `${percent(level).replace('\\,', ' ')}-Konfidenzintervall für μ`, rows: [
          { label: 'Mittelwert x̄', latex: num(k.mean) },
          { label: k.kind === 't' ? `t-Quantil (${k.df} Freiheitsgrade)` : 'z-Quantil', latex: num(k.c, 5) },
          { label: 'Intervall', latex: interval(k.low, k.high) },
        ] };
      }
      const k = r.number();
      const n = r.number();
      const level = r.number(0.95);
      const ci = S.proportionInterval(k, n, level);
      return { title: 'Konfidenzintervall für p', rows: [
        { label: 'relative Häufigkeit h', latex: num(ci.h) },
        { label: 'c', latex: num(ci.c, 5) },
        { label: 'Intervall (aus |h − p| ≤ c·σ)', latex: interval(ci.low, ci.high) },
        { label: 'Näherung h ± c·√(h(1−h)/n)', latex: interval(ci.waldLow, ci.waldHigh) },
      ] };
    },
  },

  // Simulation
  würfelsimulation: simulationCommand(),
  münzwurfsimulation: simulationCommand(),
  zufallsexperiment: simulationCommand(),
  simuliere: {
    chart: 'simulation',
    random: true,
    run(ctx, args, seed) {
      const sim = simulationData('simuliere', reader(ctx, args), seed);
      if (sim.continuous) {
        const s = S.summary(sim.outcomes);
        const X = sim.dist;
        return { title: sim.title, rows: [
          { label: 'Mittelwert (Simulation / Theorie)', latex: num(s.mean) + '\\ /\\ ' + num(X.mean) },
          { label: 'Standardabweichung (Simulation / Theorie)', latex: num(s.sd) + '\\ /\\ ' + num(Math.sqrt(X.variance)) },
        ] };
      }
      return simulationTable(sim);
    },
  },
  ziehen: {
    random: true,
    run(ctx, args, seed) {
      const r = reader(ctx, args);
      const urn = r.numbers();
      const n = Math.round(r.number());
      const mode = r.word('mit');
      const rand = S.random(seed);
      const drawn = mode.startsWith('ohne') ? S.drawWithout(rand, urn, n) : S.draw(rand, urn, null, n);
      return { giac: '[' + drawn.join(',') + ']' };
    },
  },
  montecarlo: {
    random: true,
    run(ctx, args, seed) {
      if (args.length < 4) throw new Error('montecarlo(f(x), a, b, n)');
      const f = ctx.function(args[0]);
      const r = reader(ctx, args.slice(1));
      const a = r.number();
      const b = r.number();
      const n = Math.round(r.number());
      const estimate = S.monteCarloIntegral(S.random(seed), f, a, b, n);
      const exact = ctx.number(`evalf(integrate(${ctx.giac(args[0])},x,${a},${b}))`);
      return { title: `Monte-Carlo-Integration mit ${n} Zufallspunkten`, rows: [
        { label: 'Schätzung', latex: num(estimate) },
        ...(Number.isFinite(exact) ? [{ label: 'Integral', latex: num(exact) }, { label: 'Abweichung', latex: num(estimate - exact) }] : []),
      ] };
    },
  },
  montecarlopi: {
    chart: 'montecarlo',
    random: true,
    run(ctx, args, seed) {
      const n = Math.round(reader(ctx, args).number(1000));
      const m = S.monteCarloPi(S.random(seed), n);
      return { title: `π aus ${n} Zufallspunkten`, rows: [
        { label: 'im Viertelkreis', latex: num(m.inside) },
        { label: 'Schätzung 4·Treffer/n', latex: num(m.estimate) },
        { label: 'Abweichung von π', latex: num(m.estimate - Math.PI) },
      ] };
    },
  },
  gesetzdergroßenzahlen: {
    chart: 'lln',
    random: true,
    run(ctx, args, seed) {
      const r = reader(ctx, args);
      const p = r.number();
      const n = Math.round(r.number(1000));
      const running = S.runningFrequency(S.random(seed), p, n);
      const at = [10, 100, 1000, 10000, 100000].filter((k) => k <= n);
      if (!at.includes(n)) at.push(n);
      return { title: 'Relative Häufigkeit nach n Versuchen', table: { head: ['n', 'relative Häufigkeit', 'Abweichung von p'], rows: at.map((k) => [num(k), num(running[k - 1], 5), num(running[k - 1] - p, 4)]) } };
    },
  },
};

function fitOf(ctx, args, model) {
  const r = reader(ctx, args);
  return S.regression(r.numbers(), r.numbers(), model);
}

/** balkendiagramm(L) counts the values; balkendiagramm(Werte, Häufigkeiten) takes them as they are */
export function valuesAndCounts(r) {
  const first = r.numbers();
  if (r.left) {
    const counts = r.numbers();
    if (counts.length !== first.length) throw new Error('Werte und Häufigkeiten müssen gleich viele sein.');
    return { values: first, counts };
  }
  const f = S.frequencies(first);
  return { values: f.map((x) => x.value), counts: f.map((x) => x.count) };
}

function diceSum(dice) {
  let dist = new Map([[0, 1]]);
  for (let d = 0; d < dice; d++) {
    const next = new Map();
    for (const [s, p] of dist) for (let k = 1; k <= 6; k++) next.set(s + k, (next.get(s + k) || 0) + p / 6);
    dist = next;
  }
  return [...dist.entries()].sort((a, b) => a[0] - b[0]);
}

function simulationCommand() {
  return {
    chart: 'simulation',
    random: true,
    run(ctx, args, seed, name) {
      return simulationTable(simulationData(name, reader(ctx, args), seed));
    },
  };
}

/** The outcomes of a simulation and what theory expects; the same seed gives the same outcomes in table and chart. */
export function simulationData(name, r, seed) {
  const rand = S.random(seed);
  switch (name) {
    case 'würfelsimulation': {
      const n = Math.round(r.number());
      const dice = Math.round(r.number(1));
      const outcomes = Array.from({ length: n }, () => S.draw(rand, [1, 2, 3, 4, 5, 6], null, dice).reduce((s, x) => s + x, 0));
      return { title: dice === 1 ? `${n} Würfe` : `${n} Würfe mit ${dice} Würfeln (Augensumme)`, outcomes, theory: diceSum(dice) };
    }
    case 'münzwurfsimulation': {
      const n = Math.round(r.number());
      return { title: `${n} Münzwürfe (1 = Kopf, 0 = Zahl)`, outcomes: S.draw(rand, [0, 1], null, n), theory: [[0, 0.5], [1, 0.5]] };
    }
    case 'zufallsexperiment': {
      const values = r.numbers();
      const p = r.numbers();
      const n = Math.round(r.number());
      if (values.length !== p.length) throw new Error('Ergebnisse und Wahrscheinlichkeiten müssen gleich viele sein.');
      const total = p.reduce((s, x) => s + x, 0);
      return { title: `${n} Durchführungen`, outcomes: S.draw(rand, values, p, n), theory: values.map((v, i) => [v, p[i] / total]) };
    }
    default: {
      const X = distributionOf(r);
      const n = Math.round(r.number(1000));
      const outcomes = S.sample(rand, X, n);
      return { title: `${n} Wiederholungen von ${X.name}`, outcomes, theory: X.discrete ? S.listed(X, 60) : [], continuous: !X.discrete, dist: X };
    }
  }
}

function simulationTable({ title, outcomes, theory }) {
  const counts = new Map();
  for (const x of outcomes) counts.set(x, (counts.get(x) || 0) + 1);
  const n = outcomes.length;
  const rows = theory.map(([v, p]) => [num(v), num(counts.get(v) || 0), num((counts.get(v) || 0) / n, 4), num(p, 4)]);
  return { title, table: { head: ['Ergebnis', 'absolut', 'relativ', 'Wahrscheinlichkeit'], rows }, rows: [{ label: 'Mittelwert', latex: num(S.mean(outcomes)) }] };
}

// Sequences, iterations, numerics, differential equations and complex numbers. `roles` says how the chart reads each
// argument: a function of some variables, a variable name kept as it is, or (default) a number or list.

function iterate(f, x0, n) {
  const xs = [x0];
  for (let k = 0; k < n; k++) {
    const next = f(xs[k]);
    xs.push(next);
    if (!Number.isFinite(next) || Math.abs(next) > 1e150) break;
  }
  return xs;
}

export function newtonSteps(f, x0, n = 8) {
  const h = (x) => 1e-6 * Math.max(1, Math.abs(x));
  const steps = [{ k: 0, x: x0, fx: f(x0) }];
  let x = x0;
  for (let k = 1; k <= n; k++) {
    const d = (f(x + h(x)) - f(x - h(x))) / (2 * h(x));
    if (!Number.isFinite(d) || d === 0) break;
    const next = x - f(x) / d;
    steps.push({ k, x: next, fx: f(next), slope: d, from: x });
    if (Math.abs(next - x) < 1e-13 * Math.max(1, Math.abs(x))) {
      x = next;
      break;
    }
    x = next;
  }
  return steps;
}

export function bisectionSteps(f, a, b, n = 12) {
  let fa = f(a);
  if (fa * f(b) > 0) throw new Error('f(a) und f(b) müssen verschiedene Vorzeichen haben.');
  const steps = [];
  for (let k = 1; k <= n; k++) {
    const m = (a + b) / 2;
    const fm = f(m);
    steps.push({ k, a, b, m, fm, width: b - a });
    if (fm === 0) break;
    if (fa * fm < 0) b = m;
    else {
      a = m;
      fa = fm;
    }
  }
  return steps;
}

/** Runge–Kutta for y' = f(x, y) from (x0, y0) to x1 */
export function rungeKutta(f, x0, y0, x1, steps = 400) {
  const h = (x1 - x0) / steps;
  const out = [[x0, y0]];
  let x = x0;
  let y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = f(x, y);
    const k2 = f(x + h / 2, y + (h / 2) * k1);
    const k3 = f(x + h / 2, y + (h / 2) * k2);
    const k4 = f(x + h, y + h * k3);
    y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    x += h;
    if (!Number.isFinite(y) || Math.abs(y) > 1e9) break;
    out.push([x, y]);
  }
  return out;
}

const iterationTable = (xs) => ({
  head: ['k', 'xₖ', '|xₖ − xₖ₋₁|'],
  rows: xs.slice(0, 40).map((x, k) => [fmt(k), fmt(x, 10), k ? fmt(Math.abs(x - xs[k - 1]), 4) : '\\text{–}']),
});

Object.assign(STAT_COMMANDS, {
  hilfe: {
    run(ctx, args) {
      const name = args[0] && (args[0].t === 'sym' ? args[0].v : args[0].t === 'call' ? args[0].f : args[0].t === 'str' ? args[0].v : null);
      if (!name) {
        return { title: 'Befehle nach Bereichen', table: { head: ['Bereich', 'Befehle'], rows: CATEGORIES.map((cat) => [text(cat), text(COMMANDS.filter((c) => c.cat === cat).map((c) => c.name).join(', '))]) } };
      }
      const c = command(name);
      if (!c) throw new Error(`Einen Befehl „${name}“ gibt es nicht. hilfe() zeigt alle.`);
      return { title: `Hilfe: ${c.name}`, rows: [
        { label: 'Schreibweise', latex: text(c.syntax) },
        { label: 'Was er tut', latex: text(c.text) },
        { label: 'Beispiel', latex: text(c.example.split('\n')[0]) },
        ...(c.aliases && c.aliases.length ? [{ label: 'Auch', latex: text(c.aliases.join(', ')) }] : []),
        { label: 'Bereich', latex: text(c.cat) },
      ] };
    },
  },
  folgenplot: {
    chart: 'sequence',
    roles: (args) => [{ fn: [args[1] && args[1].t === 'sym' ? args[1].v : 'n'] }, { name: true }],
    run(ctx, args) {
      const v = args[1] && args[1].t === 'sym' ? args[1].v : 'n';
      const a = ctx.function(args[0], [v]);
      const r = reader(ctx, args.slice(2));
      const from = Math.round(r.number(1));
      const to = Math.round(r.number(from + 19));
      const rows = [];
      for (let k = from; k <= Math.min(to, from + 59); k++) rows.push([fmt(k), fmt(a(k), 8)]);
      const limit = ctx.exact(`limit(${ctx.giac(args[0])},${v},inf)`);
      return { title: 'Folge', table: { head: [v, 'aₙ'], rows }, rows: limit ? [{ label: `Grenzwert für ${v} → ∞`, latex: limit }] : [] };
    },
  },
  iteration: {
    run(ctx, args) {
      const f = ctx.function(args[0]);
      const r = reader(ctx, args.slice(1));
      const xs = iterate(f, r.number(), Math.round(r.number(10)));
      const last = xs[xs.length - 1];
      const rows = [{ label: 'letzter Wert', latex: fmt(last, 10) }];
      if (xs.length > 2) rows.push({ label: 'Änderung im letzten Schritt (Fehlerschätzung)', latex: fmt(Math.abs(last - xs[xs.length - 2]), 4) });
      return { title: 'Iteration xₖ₊₁ = f(xₖ)', table: iterationTable(xs), rows };
    },
  },
  spinnweb: {
    chart: 'cobweb',
    roles: () => [{ fn: ['x'] }],
    run(ctx, args) {
      const f = ctx.function(args[0]);
      const r = reader(ctx, args.slice(1));
      const xs = iterate(f, r.number(), Math.round(r.number(10)));
      return { title: 'Spinnwebdiagramm (Rekursion xₖ₊₁ = f(xₖ))', table: iterationTable(xs) };
    },
  },
  newtonschritte: {
    chart: 'newton',
    roles: () => [{ fn: ['x'] }],
    run(ctx, args) {
      const f = ctx.function(args[0]);
      const r = reader(ctx, args.slice(1));
      const steps = newtonSteps(f, r.number(), Math.round(r.number(8)));
      return {
        title: 'Newton-Verfahren xₖ₊₁ = xₖ − f(xₖ)/f′(xₖ)',
        table: { head: ['k', 'xₖ', 'f(xₖ)', '|xₖ − xₖ₋₁|'], rows: steps.map((s, i) => [fmt(s.k), fmt(s.x, 12), fmt(s.fx, 4), i ? fmt(Math.abs(s.x - steps[i - 1].x), 4) : '\\text{–}']) },
      };
    },
  },
  bisektionsschritte: {
    chart: 'bisection',
    roles: () => [{ fn: ['x'] }],
    run(ctx, args) {
      const f = ctx.function(args[0]);
      const r = reader(ctx, args.slice(1));
      const steps = bisectionSteps(f, r.number(), r.number(), Math.round(r.number(12)));
      const last = steps[steps.length - 1];
      return {
        title: 'Bisektionsverfahren',
        table: { head: ['k', 'a', 'b', 'm', 'f(m)'], rows: steps.map((s) => [fmt(s.k), fmt(s.a, 10), fmt(s.b, 10), fmt(s.m, 10), fmt(s.fm, 4)]) },
        rows: [{ label: 'Nullstelle liegt in', latex: `\\left[${fmt(Math.min(last.a, last.m), 10)};\\ ${fmt(Math.max(last.b, last.m), 10)}\\right]` }, { label: 'Fehler höchstens', latex: fmt(last.width / 2, 4) }],
      };
    },
  },
  richtungsfeld: {
    chart: 'field',
    roles: () => [{ fn: ['x', 'y'] }],
    run(ctx, args) {
      return { title: 'Richtungsfeld', rows: [{ label: 'Differentialgleichung', latex: "y'=" + ctx.text(args[0]) }] };
    },
  },
  lösungskurve: {
    chart: 'solution',
    roles: () => [{ fn: ['x', 'y'] }],
    run(ctx, args) {
      const f = ctx.function(args[0], ['x', 'y']);
      const r = reader(ctx, args.slice(1));
      const x0 = r.number();
      const y0 = r.number();
      const curve = rungeKutta(f, x0, y0, x0 + 5, 500);
      const rows = [];
      for (let k = 0; k <= 5; k++) {
        const p = curve[Math.min(curve.length - 1, k * 100)];
        if (p) rows.push([fmt(p[0], 4), fmt(p[1], 8)]);
      }
      return { title: 'Lösungskurve (Runge-Kutta)', table: { head: ['x', 'y'], rows }, rows: [{ label: 'Differentialgleichung', latex: "y'=" + ctx.text(args[0]) }, { label: 'Anfangswert', latex: `y\\left(${fmt(x0)}\\right)=${fmt(y0)}` }] };
    },
  },
  phasenporträt: {
    chart: 'phase',
    roles: () => [{ fn: ['x', 'y'] }, { fn: ['x', 'y'] }],
    run(ctx, args) {
      return { title: 'Phasenporträt', rows: [{ label: "x'", latex: ctx.text(args[0]) }, { label: "y'", latex: ctx.text(args[1]) }] };
    },
  },
  zahlenebene: {
    chart: 'complex',
    roles: (args) => args.map(() => ({ complex: true })),
    run(ctx, args) {
      const rows = args.map((a) => {
        const g = ctx.giac(a);
        return { label: ctx.format(g) === '' ? g : 'z', latex: `${ctx.format(g)}:\\ |z|=${ctx.exact(`abs(${g})`)},\\ \\varphi=${ctx.exact(`arg(${g})`)}` };
      });
      return { title: 'Gaußsche Zahlenebene', rows };
    },
  },
  rundungsfehler: {
    run(ctx, args) {
      const g = ctx.giac(args[0]);
      const exact = ctx.exact(g);
      const reference = ctx.number(`evalf(${g},40)`);
      const rows = [4, 6, 8, 10, 12, 15].map((d) => {
        const v = Number(Number(reference).toPrecision(d));
        return [fmt(d), fmt(v, d), fmt(Math.abs(v - reference), 3)];
      });
      const float = ctx.number(`evalf(${g})`);
      return { title: 'Rundungsfehler', table: { head: ['Stellen', 'gerundet', 'Fehler'], rows }, rows: [{ label: 'exakt', latex: exact || '\\text{–}' }, { label: 'Gleitkomma (Giac)', latex: fmt(float, 15) }] };
    },
  },
  restglied: {
    run(ctx, args) {
      const g = ctx.giac(functionArg(args[0]));
      const r = reader(ctx, args.slice(1));
      const a = r.number();
      const n = Math.round(r.number());
      const b = r.number();
      const taylor = ctx.exact(`convert(taylor(${g},x=${a},${n}),polynom)`);
      const fn1 = ctx.functionOfGiac(`diff(${g},x,${n + 1})`);
      let max = 0;
      for (let i = 0; i <= 400; i++) {
        const t = a + ((b - a) * i) / 400;
        const v = Math.abs(fn1(t));
        if (Number.isFinite(v)) max = Math.max(max, v);
      }
      let factorial = 1;
      for (let k = 2; k <= n + 1; k++) factorial *= k;
      const bound = (max * Math.abs(b - a) ** (n + 1)) / factorial;
      const actual = Math.abs(ctx.number(`evalf(subst(${g},x=${b}))`) - ctx.number(`evalf(subst(convert(taylor(${g},x=${a},${n}),polynom),x=${b}))`));
      return { title: `Taylorpolynom vom Grad ${n} und Restglied`, rows: [
        { label: `Tₙ(x) um ${a}`, latex: taylor || '\\text{–}' },
        { label: 'Restglied (Lagrange) höchstens', latex: fmt(bound, 4) },
        { label: `tatsächlicher Fehler bei x = ${b}`, latex: fmt(actual, 4) },
      ] };
    },
  },
});

/** The chart commands and what each draws */
export const CHART_COMMANDS = new Map(Object.entries(STAT_COMMANDS).filter(([, c]) => c.chart).map(([name, c]) => [name, c.chart]));

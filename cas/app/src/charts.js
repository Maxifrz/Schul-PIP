// What the chart commands draw, in coordinates of the graphics: bars, lines, dots, pie wedges and captions. The
// graphics view paints these shapes; the values come live from the scene, so sliders move charts too.

import * as S from './stats.js';
import { reader, valuesAndCounts, distributionOf, simulationData } from './statcommands.js';

const fmt = (v, digits = 4) => {
  if (!Number.isFinite(v)) return '–';
  return String(Number(v.toPrecision(digits))).replace('.', ',');
};

/** Arguments as the chart gets them: numbers and lists as they are, words as they were typed */
function readerOf(items) {
  const nodes = items.map((item) => (typeof item === 'string' ? { t: 'sym', v: item } : { t: 'value', v: item }));
  return reader({ values: (node) => node.v }, nodes);
}

function boundsOf(xs, ys, pad = 0.08) {
  const finite = (a) => a.filter(Number.isFinite);
  const [x0, x1] = [Math.min(...finite(xs)), Math.max(...finite(xs))];
  const [y0, y1] = [Math.min(...finite(ys)), Math.max(...finite(ys))];
  const dx = (x1 - x0 || 1) * pad;
  const dy = (y1 - y0 || 1) * pad;
  return { xmin: x0 - dx, xmax: x1 + dx, ymin: y0 - dy, ymax: y1 + dy };
}

/** Bars of a discrete distribution: one unit wide around each k, touching, as school books draw them */
function distributionBars(values, highlight) {
  return values.map(([k, p]) => ({ x0: k - 0.5, x1: k + 0.5, y0: 0, y1: p, strong: highlight ? highlight(k) : false }));
}

/**
 * The shapes of a chart. `command` is the German command, `kind` its chart kind, `items` the arguments.
 * Returns { rects, lines, dots, wedges, areas, texts, bounds }.
 */
export function chartShapes(command, kind, items, seed) {
  const r = readerOf(items);
  const out = { rects: [], lines: [], dots: [], wedges: [], areas: [], texts: [], bounds: null };
  switch (kind) {
    case 'boxplot': {
      const s = S.summary(r.numbers());
      const y = r.left ? r.number() : 1;
      const h = 0.4;
      out.rects.push({ x0: s.q1, x1: s.q3, y0: y - h, y1: y + h });
      out.lines.push({ points: [[s.median, y - h], [s.median, y + h]], bold: true });
      out.lines.push({ points: [[s.min, y], [s.q1, y]] }, { points: [[s.q3, y], [s.max, y]] });
      out.lines.push({ points: [[s.min, y - h / 2], [s.min, y + h / 2]] }, { points: [[s.max, y - h / 2], [s.max, y + h / 2]] });
      out.bounds = boundsOf([s.min, s.max], [0, y + 1]);
      return out;
    }
    case 'histogram': {
      const data = r.numbers();
      const width = r.number();
      const start = r.left ? r.number() : undefined;
      const classes = S.classes(data, width, start);
      for (const c of classes) out.rects.push({ x0: c.from, x1: c.to, y0: 0, y1: c.count });
      out.bounds = boundsOf([classes[0].from, classes[classes.length - 1].to], [0, Math.max(...classes.map((c) => c.count)) * 1.1]);
      return out;
    }
    case 'bars': {
      const { values, counts } = valuesAndCounts(r);
      const gaps = [...values].sort((a, b) => a - b).slice(1).map((v, i, all) => v - (i ? all[i - 1] : Math.min(...values)));
      const width = 0.7 * Math.min(1, ...gaps.filter((g) => g > 0));
      values.forEach((v, i) => out.rects.push({ x0: v - width / 2, x1: v + width / 2, y0: 0, y1: counts[i] }));
      out.bounds = boundsOf([Math.min(...values) - width, Math.max(...values) + width], [0, Math.max(...counts) * 1.1]);
      return out;
    }
    case 'pie': {
      const { values, counts } = valuesAndCounts(r);
      let center = [0, 0];
      let radius = 3;
      while (r.left) {
        const next = items[items.length - r.left];
        if (Array.isArray(next) && next.length === 2) center = r.numbers();
        else radius = r.number();
      }
      const total = counts.reduce((s, c) => s + c, 0);
      let angle = Math.PI / 2;
      values.forEach((v, i) => {
        const sweep = (2 * Math.PI * counts[i]) / total;
        out.wedges.push({ cx: center[0], cy: center[1], r: radius, a0: angle, a1: angle - sweep, index: i });
        const mid = angle - sweep / 2;
        out.texts.push({ x: center[0] + Math.cos(mid) * radius * 0.65, y: center[1] + Math.sin(mid) * radius * 0.65, text: `${fmt(v)}: ${fmt((100 * counts[i]) / total, 3)} %`, align: 'center' });
        angle -= sweep;
      });
      out.bounds = boundsOf([center[0] - radius, center[0] + radius], [center[1] - radius, center[1] + radius], 0.15);
      return out;
    }
    case 'scatter': {
      const x = r.numbers();
      const y = r.numbers();
      x.forEach((v, i) => out.dots.push({ x: v, y: y[i] }));
      out.bounds = boundsOf(x, [...y, 0]);
      return out;
    }
    case 'residuals': {
      const x = r.numbers();
      const y = r.numbers();
      const fit = S.regression(x, y, r.left ? r.word() : 'linear');
      const xmin = Math.min(...x);
      const xmax = Math.max(...x);
      out.lines.push({ points: [[xmin - (xmax - xmin) * 0.1, 0], [xmax + (xmax - xmin) * 0.1, 0]], dash: true });
      x.forEach((v, i) => {
        out.lines.push({ points: [[v, 0], [v, fit.residuals[i]]], thin: true });
        out.dots.push({ x: v, y: fit.residuals[i] });
      });
      const m = Math.max(...fit.residuals.map(Math.abs)) || 1;
      out.bounds = boundsOf([xmin, xmax], [-m, m], 0.2);
      return out;
    }
    case 'distribution': {
      const X = distributionOf(r);
      const a = r.left ? r.number() : null;
      const b = r.left ? r.number() : null;
      const [low, high] = b === null ? [-Infinity, a] : [a, b];
      const inside = (k) => a !== null && k >= low - 1e-9 && k <= high + 1e-9;
      if (X.discrete) {
        const values = S.listed(X, 400);
        out.rects.push(...distributionBars(values, a === null ? null : inside));
        const top = Math.max(...values.map((v) => v[1]));
        out.bounds = boundsOf([values[0][0] - 0.5, values[values.length - 1][0] + 0.5], [0, top * 1.4]);
      } else {
        const [x0, x1] = X.range;
        const points = [];
        for (let i = 0; i <= 400; i++) {
          const t = x0 + ((x1 - x0) * i) / 400;
          points.push([t, X.pdf(t)]);
        }
        out.lines.push({ points, bold: true });
        if (a !== null) {
          const from = Math.max(x0, low === -Infinity ? x0 : low);
          const to = Math.min(x1, high);
          if (to > from) {
            const area = [[from, 0]];
            for (let i = 0; i <= 200; i++) {
              const t = from + ((to - from) * i) / 200;
              area.push([t, X.pdf(t)]);
            }
            area.push([to, 0]);
            out.areas.push({ points: area });
          }
        }
        const top = Math.max(...points.map((p) => p[1]).filter(Number.isFinite));
        out.bounds = boundsOf([x0, x1], [0, top * 1.4]);
      }
      if (a !== null) {
        const p = b === null ? S.probability(X, null, a) : S.probability(X, a, b);
        const label = b === null ? `P(X ≤ ${fmt(a)})` : `P(${fmt(a)} ≤ X ≤ ${fmt(b)})`;
        out.texts.push({ x: X.mean, y: (out.bounds.ymax - out.bounds.ymin) * 0.84 + out.bounds.ymin, text: `${label} = ${fmt(p, 5)}`, align: 'center', strong: true });
      }
      out.texts.push({ x: X.mean, y: (out.bounds.ymax - out.bounds.ymin) * 0.77 + out.bounds.ymin, text: `${X.name}: μ = ${fmt(X.mean)}, σ = ${fmt(Math.sqrt(X.variance))}`, align: 'center' });
      return out;
    }
    case 'binomialtest': {
      const n = r.number();
      const p0 = r.number();
      const alpha = r.left ? r.number() : 0.05;
      const side = S.sideOf(r.left && r.peekWord() ? r.word() : 'beidseitig');
      const k = r.left ? r.number() : undefined;
      const t = S.binomialTest(n, p0, alpha, side, k);
      const X = S.distribution('binomial', [n, p0]);
      const values = S.listed(X, 400);
      out.rects.push(...distributionBars(values, (v) => t.region.some(([a, b]) => v >= a && v <= b)));
      const top = Math.max(...values.map((v) => v[1]));
      if (k !== undefined) out.lines.push({ points: [[k, 0], [k, top * 1.08]], bold: true, accent: true });
      out.bounds = boundsOf([values[0][0] - 0.5, values[values.length - 1][0] + 0.5], [0, top * 1.2]);
      out.texts.push({ x: n * p0, y: top * 1.14, text: `Ablehnungsbereich markiert, α* = ${fmt(t.error, 4)}`, align: 'center' });
      return out;
    }
    case 'simulation': {
      const sim = simulationData(command, r, seed);
      const n = sim.outcomes.length;
      if (sim.continuous) {
        const s = S.summary(sim.outcomes);
        const width = (s.max - s.min) / Math.max(5, Math.min(40, Math.round(Math.sqrt(n)))) || 1;
        const classes = S.classes(sim.outcomes, width);
        // Density scale, so the curve of the distribution fits over the bars
        for (const c of classes) out.rects.push({ x0: c.from, x1: c.to, y0: 0, y1: c.relative / width });
        const [x0, x1] = sim.dist.range;
        const points = [];
        for (let i = 0; i <= 300; i++) {
          const t = x0 + ((x1 - x0) * i) / 300;
          points.push([t, sim.dist.pdf(t)]);
        }
        out.lines.push({ points, bold: true, accent: true });
        out.bounds = boundsOf([Math.min(x0, s.min), Math.max(x1, s.max)], [0, Math.max(...classes.map((c) => c.relative / width), ...points.map((p) => p[1])) * 1.1]);
        return out;
      }
      const counts = new Map();
      for (const x of sim.outcomes) counts.set(x, (counts.get(x) || 0) + 1);
      const values = sim.theory.map((t) => t[0]);
      const gaps = values.slice(1).map((v, i) => v - values[i]).filter((g) => g > 0);
      const width = 0.7 * Math.min(1, ...gaps);
      for (const [v, p] of sim.theory) {
        out.rects.push({ x0: v - width / 2, x1: v + width / 2, y0: 0, y1: (counts.get(v) || 0) / n });
        out.lines.push({ points: [[v - width / 2 - 0.08, p], [v + width / 2 + 0.08, p]], bold: true, accent: true });
      }
      const top = Math.max(...sim.theory.map((t) => t[1]), ...[...counts.values()].map((c) => c / n));
      out.bounds = boundsOf([values[0] - 1, values[values.length - 1] + 1], [0, top * 1.2]);
      out.texts.push({ x: (values[0] + values[values.length - 1]) / 2, y: top * 1.12, text: 'Säulen: relative Häufigkeit · Striche: Wahrscheinlichkeit', align: 'center' });
      return out;
    }
    case 'montecarlo': {
      const n = Math.round(r.left ? r.number() : 1000);
      const m = S.monteCarloPi(S.random(seed), n);
      for (const [x, y, hit] of m.points) out.dots.push({ x, y, small: true, accent: !hit });
      const arc = [];
      for (let i = 0; i <= 90; i++) arc.push([Math.cos((i * Math.PI) / 180), Math.sin((i * Math.PI) / 180)]);
      out.lines.push({ points: arc, bold: true }, { points: [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]] });
      out.texts.push({ x: 0.5, y: 1.1, text: `π ≈ ${fmt(m.estimate, 5)}`, align: 'center', strong: true });
      out.bounds = { xmin: -0.2, xmax: 1.2, ymin: -0.15, ymax: 1.2 };
      return out;
    }
    case 'lln': {
      const p = r.number();
      const n = Math.round(r.left ? r.number() : 1000);
      const running = S.runningFrequency(S.random(seed), p, n);
      const step = Math.max(1, Math.floor(n / 2000));
      const points = [];
      for (let i = 0; i < n; i += step) points.push([i + 1, running[i]]);
      points.push([n, running[n - 1]]);
      out.lines.push({ points, bold: true });
      out.lines.push({ points: [[0, p], [n, p]], dash: true, accent: true });
      out.texts.push({ x: n * 0.75, y: Math.min(1.05, p + 0.12), text: `p = ${fmt(p)}`, align: 'center' });
      out.bounds = { xmin: -n * 0.04, xmax: n * 1.04, ymin: -0.05, ymax: 1.1 };
      return out;
    }
    default:
      return out;
  }
}

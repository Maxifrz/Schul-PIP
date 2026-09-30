// Chemistry plots as chart shapes of the graphics view: { rects, lines, dots, wedges, areas, texts, bounds }. The
// results of the chemistry commands carry a `plot` description; `plotShapes` turns it into shapes, so the graphics view
// paints titration curves, concentration–time curves, linearisations and distribution diagrams like any other chart.

import { concentrationAt, halfLife } from './kinetics.js';
import { fractions, deprotonated } from './acidbase.js';
import { formatFormula } from './formula.js';

const empty = () => ({ rects: [], lines: [], dots: [], wedges: [], areas: [], texts: [], bounds: null });

function padded(xs, ys, pad = 0.08) {
  const f = (a) => a.filter(Number.isFinite);
  const x0 = Math.min(...f(xs));
  const x1 = Math.max(...f(xs));
  const y0 = Math.min(...f(ys));
  const y1 = Math.max(...f(ys));
  const dx = (x1 - x0 || 1) * pad;
  const dy = (y1 - y0 || 1) * pad;
  return { xmin: x0 - dx, xmax: x1 + dx, ymin: y0 - dy, ymax: y1 + dy };
}

/** Axis captions at the lower right and upper left of the bounds */
function captions(out, xLabel, yLabel) {
  const b = out.bounds;
  if (!b) return;
  out.texts.push({ x: b.xmax - (b.xmax - b.xmin) * 0.02, y: b.ymin + (b.ymax - b.ymin) * 0.035, text: xLabel, align: 'right', strong: true });
  out.texts.push({ x: b.xmin + (b.xmax - b.xmin) * 0.02, y: b.ymax - (b.ymax - b.ymin) * 0.035, text: yLabel, align: 'left', strong: true });
}

const fmt = (v, digits = 4) => String(Number(v.toPrecision(digits))).replace('.', ',');

/** Shapes for a plot description; null for an unknown kind */
export function plotShapes(plot) {
  if (!plot) return null;
  const out = empty();
  switch (plot.kind) {
    case 'titration': {
      out.lines.push({ points: plot.points, bold: true });
      const xs = plot.points.map((p) => p[0]);
      const ys = plot.points.map((p) => p[1]);
      out.bounds = padded(xs, [0, 14, ...ys], 0.06);
      for (const e of plot.equivalence) {
        out.dots.push({ x: e.V, y: e.pH, accent: true, label: `ÄP ${fmt(e.V, 4)} mL · pH ${fmt(e.pH, 3)}` });
        out.lines.push({ points: [[e.V, out.bounds.ymin], [e.V, e.pH]], dash: true, faint: true });
      }
      for (const h of plot.half || []) out.dots.push({ x: h.V, y: h.pH, label: `pH ${fmt(h.pH, 3)}` });
      out.dots.push({ x: plot.points[0][0], y: plot.points[0][1], label: `pH ${fmt(plot.points[0][1], 3)}` });
      captions(out, `V(${plot.titrant}) in mL`, 'pH');
      return out;
    }
    case 'kinetics': {
      const { n, k, c0, tEnd } = plot;
      const pts = [];
      const N = 200;
      for (let i = 0; i <= N; i++) {
        const t = (tEnd * i) / N;
        pts.push([t, concentrationAt(n, k, c0, t)]);
      }
      out.lines.push({ points: pts, bold: true });
      const th = halfLife(n, k, c0);
      if (Number.isFinite(th) && th < tEnd) {
        out.dots.push({ x: th, y: c0 / 2, accent: true, label: `t½ = ${fmt(th)} s` });
        out.lines.push({ points: [[th, 0], [th, c0 / 2]], dash: true, faint: true });
      }
      out.bounds = padded([0, tEnd], [0, c0], 0.08);
      captions(out, 't in s', 'c in mol/L');
      return out;
    }
    case 'order': {
      out.dots.push(...plot.ts.map((x, i) => ({ x, y: plot.y[i] })));
      const x0 = Math.min(...plot.ts);
      const x1 = Math.max(...plot.ts);
      out.lines.push({ points: [[x0, plot.line.a + plot.line.b * x0], [x1, plot.line.a + plot.line.b * x1]], accent: true });
      out.bounds = padded(plot.ts, plot.y, 0.12);
      captions(out, 't in s', plot.label.split(' gegen ')[0]);
      return out;
    }
    case 'arrhenius': {
      out.dots.push(...plot.x.map((x, i) => ({ x, y: plot.y[i] })));
      const x0 = Math.min(...plot.x);
      const x1 = Math.max(...plot.x);
      out.lines.push({ points: [[x0, plot.line.a + plot.line.b * x0], [x1, plot.line.a + plot.line.b * x1]], accent: true });
      out.bounds = padded(plot.x, plot.y, 0.12);
      captions(out, '1/T in 1/K', 'ln k');
      return out;
    }
    case 'distribution': {
      const N = 280;
      plot.species.forEach((s, k) => {
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const pH = (14 * i) / N;
          pts.push([pH, fractions(10 ** -pH, plot.pKa, plot.strongFirst)[k]]);
        }
        out.lines.push({ points: pts, bold: k === 0, accent: k % 2 === 1 });
        const at = plot.labelAt[k];
        out.texts.push({ x: at, y: Math.max(0.05, Math.min(0.97, fractions(10 ** -at, plot.pKa, plot.strongFirst)[k] + 0.05)), text: s, align: 'center', strong: true });
      });
      for (const p of plot.pKa) out.dots.push({ x: p, y: 0.5, small: true, accent: true });
      out.bounds = { xmin: 0, xmax: 14, ymin: -0.05, ymax: 1.08 };
      captions(out, 'pH', 'Anteil α');
      return out;
    }
    case 'isotherm': {
      out.lines.push({ points: plot.real, bold: true });
      out.lines.push({ points: plot.ideal, dash: true, accent: true });
      const xs = [...plot.real, ...plot.ideal].map((p) => p[0]);
      const ys = [...plot.real, ...plot.ideal].map((p) => p[1]);
      out.bounds = padded(xs, [0, ...ys], 0.06);
      captions(out, 'V in L', 'p in bar');
      out.texts.push({ x: plot.real[Math.floor(plot.real.length * 0.55)][0], y: plot.real[Math.floor(plot.real.length * 0.55)][1], text: 'real (van der Waals)', align: 'left' });
      out.texts.push({ x: plot.ideal[Math.floor(plot.ideal.length * 0.3)][0], y: plot.ideal[Math.floor(plot.ideal.length * 0.3)][1], text: 'ideal', align: 'left' });
      return out;
    }
    default:
      return null;
  }
}

/** Species names of a system for the distribution diagram: HA, A⁻ … */
export function distributionLabels(top, n) {
  const names = [];
  for (let k = 0; k <= n; k++) names.push(formatFormula(deprotonated(top, k), 'unicode'));
  return names;
}

// The graphics view: a coordinate system on a canvas with the scene's objects. Drag to move, pinch or scroll to
// zoom; tap a graph to see its special points, hold to trace it, drag a free point to move it. Exports a PNG on
// white for documents.

import { h, toast } from '../ui.js';
import { sliderSettings } from './sliders.js';
import { TOOLS, tool as toolById } from './tools.js';
import { styleOf, isVisible, PALETTE } from './scene.js';
import { chartShapes, VIEW_CHARTS } from '../charts.js';
import { sampleFunction, contour, specialPoints, niceStep, piStep, tickLabel, piLabel, coordinate } from './plot.js';
import { parsePlain, compile, compileCondition } from '../expr.js';

export const DEFAULT_SETTINGS = {
  xmin: -8, xmax: 8, ymin: -5, ymax: 5,
  grid: true, minor: true, axes: true, arrows: true, logX: false, logY: false, piX: false, equal: true, snap: true,
  xLabel: 'x', yLabel: 'y',
};

const HIT = 14;
const HOLD_MS = 420;

const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n) => String(n).split('').map((d) => SUBSCRIPTS[d]).join('');

export class GraphView {
  constructor({ scene, onViewChange, onSelect, onPointMove, onGliderMove, onStyle, onCreatePoint, onConstruct }) {
    this.scene = scene;
    this.onViewChange = onViewChange || (() => {});
    this.onSelect = onSelect || (() => {});
    this.onPointMove = onPointMove || (() => {});
    this.onStyle = onStyle || (() => {});
    this.onGliderMove = onGliderMove || (() => {});
    this.onCreatePoint = onCreatePoint || (() => null);
    this.onConstruct = onConstruct || (() => {});
    this.tool = 'move';
    this.picks = [];
    this.settings = { ...DEFAULT_SETTINGS };
    this.selected = null;
    this.special = [];
    this.tip = null;
    this.traceAt = null;
    this.pointers = new Map();
    this.gesture = null;
    this.width = 0;
    this.height = 0;
    this.frame = 0;
    this.lastDraw = { version: -1 };

    this.canvas = h('canvas.graph-canvas');
    this.traceCanvas = document.createElement('canvas');
    this.readout = h('div.readout');
    this.tooltip = h('div.graph-tip');
    this.tools = h('div.graph-tools');
    this.overlay = h('div.graph-overlay', {}, this.tools);
    this.toolbar = h('div.construct');
    this.hint = h('div.construct-hint');
    this.bottom = h('div.graph-bottom');
    this.stage = h('div.graph-stage', {}, this.canvas, this.readout, this.tooltip, this.overlay, h('div.construct-bar', {}, this.toolbar, this.hint));
    this.renderToolbar();
    this.el = h('section.graph', {}, this.stage, this.bottom);

    this.bindPointers();
    const observer = new ResizeObserver(() => this.resize());
    observer.observe(this.stage);
  }

  // Viewport

  setSettings(settings) {
    this.settings = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    this.fitAspect();
    this.clearTrace();
    this.redraw();
  }

  resize() {
    const rect = this.stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = window.devicePixelRatio || 1;
    const oldWidth = this.width;
    this.width = rect.width;
    this.height = rect.height;
    for (const c of [this.canvas, this.traceCanvas]) {
      c.width = Math.round(rect.width * ratio);
      c.height = Math.round(rect.height * ratio);
    }
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
    this.ratio = ratio;
    if (!oldWidth) this.fitAspect();
    else this.fitAspect(true);
    this.redraw();
  }

  /** With equal units on both axes, the y range follows the shape of the view. */
  fitAspect() {
    const s = this.settings;
    if (!s.equal || s.logX || s.logY || !this.width || !this.height) return;
    const perPixel = (s.xmax - s.xmin) / this.width;
    const middle = (s.ymin + s.ymax) / 2;
    const half = (perPixel * this.height) / 2;
    s.ymin = middle - half;
    s.ymax = middle + half;
  }

  standardView() {
    const s = this.settings;
    Object.assign(s, { xmin: DEFAULT_SETTINGS.xmin, xmax: DEFAULT_SETTINGS.xmax, ymin: DEFAULT_SETTINGS.ymin, ymax: DEFAULT_SETTINGS.ymax });
    if (s.logX) Object.assign(s, { xmin: 0.1, xmax: 1000 });
    if (s.logY) Object.assign(s, { ymin: 0.1, ymax: 1000 });
    this.fitAspect();
    this.viewChanged();
  }

  viewChanged() {
    this.clearTrace();
    this.special = this.selected ? this.computeSpecial() : [];
    this.redraw();
    this.onViewChange(this.settings);
  }

  // World ↔ pixel (CSS pixels)
  px(x) {
    const s = this.settings;
    if (s.logX) return ((Math.log10(x) - Math.log10(s.xmin)) / (Math.log10(s.xmax) - Math.log10(s.xmin))) * this.width;
    return ((x - s.xmin) / (s.xmax - s.xmin)) * this.width;
  }

  py(y) {
    const s = this.settings;
    if (s.logY) return this.height - ((Math.log10(y) - Math.log10(s.ymin)) / (Math.log10(s.ymax) - Math.log10(s.ymin))) * this.height;
    return this.height - ((y - s.ymin) / (s.ymax - s.ymin)) * this.height;
  }

  wx(px) {
    const s = this.settings;
    const t = px / this.width;
    if (s.logX) return Math.pow(10, Math.log10(s.xmin) + t * (Math.log10(s.xmax) - Math.log10(s.xmin)));
    return s.xmin + t * (s.xmax - s.xmin);
  }

  wy(py) {
    const s = this.settings;
    const t = (this.height - py) / this.height;
    if (s.logY) return Math.pow(10, Math.log10(s.ymin) + t * (Math.log10(s.ymax) - Math.log10(s.ymin)));
    return s.ymin + t * (s.ymax - s.ymin);
  }

  /** Moves the view by pixels. */
  pan(dx, dy) {
    const s = this.settings;
    const shift = (min, max, log, pixels, size) => {
      if (log) {
        const k = Math.pow(max / min, -pixels / size);
        return [min * k, max * k];
      }
      const d = (-pixels / size) * (max - min);
      return [min + d, max + d];
    };
    [s.xmin, s.xmax] = shift(s.xmin, s.xmax, s.logX, dx, this.width);
    [s.ymin, s.ymax] = shift(s.ymin, s.ymax, s.logY, -dy, this.height);
  }

  /** Zooms by `factor` (< 1 is closer) around the pixel (cx, cy); `fx`, `fy` scale the axes separately. */
  zoom(factor, cx = this.width / 2, cy = this.height / 2, fx = factor, fy = factor) {
    const s = this.settings;
    const scale = (min, max, log, centre, f) => {
      if (log) {
        const c = Math.log10(centre);
        return [Math.pow(10, c + (Math.log10(min) - c) * f), Math.pow(10, c + (Math.log10(max) - c) * f)];
      }
      return [centre + (min - centre) * f, centre + (max - centre) * f];
    };
    const x = this.wx(cx);
    const y = this.wy(cy);
    const wx = s.equal ? factor : fx;
    const wy = s.equal ? factor : fy;
    const [xmin, xmax] = scale(s.xmin, s.xmax, s.logX, x, wx);
    const [ymin, ymax] = scale(s.ymin, s.ymax, s.logY, y, wy);
    // Not beyond what doubles can tell apart, nor out to where nothing is left to see.
    const ok = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b - a > 1e-9 * Math.max(1, Math.abs(a)) && b - a < 1e12;
    if (ok(xmin, xmax) && ok(ymin, ymax)) Object.assign(s, { xmin, xmax, ymin, ymax });
  }

  // Drawing

  redraw() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.draw();
    });
  }

  colors(exporting) {
    if (exporting) return { bg: '#FFFFFF', ink: '#16150F', muted: '#6E6B62', grid: 'rgba(22,21,15,0.07)', gridMajor: 'rgba(22,21,15,0.14)', axis: '#3A3830', surface: '#FFFFFF' };
    const style = getComputedStyle(document.documentElement);
    const v = (name) => style.getPropertyValue(name).trim();
    return { bg: v('--surface') || '#fff', ink: v('--ink') || '#16150F', muted: v('--muted') || '#6E6B62', grid: v('--line-soft'), gridMajor: v('--line2'), axis: v('--ink2') || '#24231C', surface: v('--surface') };
  }

  draw() {
    if (!this.width) return;
    const ctx = this.canvas.getContext('2d');
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    this.paint(ctx, this.colors(false), false);
    this.updateTip();
  }

  /** Everything, onto a context in CSS pixels. */
  paint(ctx, colors, exporting) {
    const w = this.width;
    const hgt = this.height;
    ctx.save();
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, hgt);
    if (this.settings.grid) this.paintGrid(ctx, colors);
    if (!exporting && this.traceCanvas.width) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.traceCanvas, 0, 0);
      ctx.restore();
    }
    if (this.settings.axes) this.paintAxes(ctx, colors);
    const objects = this.scene.objects.filter((o) => isVisible(o) && this.conditionHolds(o));
    const order = { chart: 0, region: 0, polygon: 1, circle: 2, implicit: 3, function: 4, curve: 4, line: 5, ray: 5, segment: 5, vector: 6, point: 9 };
    objects.sort((a, b) => (order[a.type] ?? 5) - (order[b.type] ?? 5));
    for (const object of objects) {
      try {
        this.paintObject(ctx, object, styleOf(object), object.id === this.selected, colors);
      } catch (e) {
        // An object that cannot be drawn at the moment is left out.
      }
    }
    if (!exporting) {
      this.paintSpecial(ctx, colors);
      this.paintTrace(ctx, colors);
    }
    ctx.restore();
    this.paintTraces(objects);
  }

  paintGrid(ctx, colors) {
    const s = this.settings;
    const w = this.width;
    const hgt = this.height;
    ctx.lineWidth = 1;
    const lines = (ticks, vertical, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath();
      for (const t of ticks) {
        const p = Math.round(vertical ? this.px(t) : this.py(t)) + 0.5;
        if (vertical) {
          ctx.moveTo(p, 0);
          ctx.lineTo(p, hgt);
        } else {
          ctx.moveTo(0, p);
          ctx.lineTo(w, p);
        }
      }
      ctx.stroke();
    };
    const x = this.ticks('x');
    const y = this.ticks('y');
    if (s.minor) {
      lines(x.minor, true, colors.grid);
      lines(y.minor, false, colors.grid);
    }
    lines(x.major, true, colors.gridMajor);
    lines(y.major, false, colors.gridMajor);
  }

  /** Major ticks (labelled) and minor ticks of an axis. */
  ticks(axis) {
    const s = this.settings;
    const min = axis === 'x' ? s.xmin : s.ymin;
    const max = axis === 'x' ? s.xmax : s.ymax;
    const log = axis === 'x' ? s.logX : s.logY;
    const size = axis === 'x' ? this.width : this.height;
    if (log) {
      const major = [];
      const minor = [];
      for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
        const base = Math.pow(10, e);
        if (base >= min && base <= max) major.push(base);
        for (let k = 2; k < 10; k++) if (base * k >= min && base * k <= max) minor.push(base * k);
      }
      return { major, minor, step: null, log: true };
    }
    const pi = axis === 'x' && s.piX;
    const step = pi ? piStep(max - min, size / 90) : niceStep(max - min, size / 90);
    const minorStep = pi ? step / 2 : step / (String(step / Math.pow(10, Math.floor(Math.log10(step)))).startsWith('2') ? 4 : 5);
    const major = [];
    const minor = [];
    const count = (max - min) / minorStep;
    if (count > 2000) return { major, minor, step };
    for (let k = Math.ceil(min / minorStep); k * minorStep <= max; k++) {
      const v = k * minorStep;
      if (Math.abs(v / step - Math.round(v / step)) < 1e-6) major.push(Math.round(v / step) * step);
      else minor.push(v);
    }
    return { major, minor, step, pi };
  }

  paintAxes(ctx, colors) {
    const s = this.settings;
    const w = this.width;
    const hgt = this.height;
    // Axes at 0, or at the edge when 0 is out of view
    const ax = s.logY ? hgt - 0.5 : Math.min(hgt - 1, Math.max(0, this.py(0)));
    const ay = s.logX ? 0.5 : Math.min(w - 1, Math.max(0, this.px(0)));
    ctx.strokeStyle = colors.axis;
    ctx.fillStyle = colors.axis;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, Math.round(ax) + 0.5);
    ctx.lineTo(w, Math.round(ax) + 0.5);
    ctx.moveTo(Math.round(ay) + 0.5, 0);
    ctx.lineTo(Math.round(ay) + 0.5, hgt);
    ctx.stroke();
    if (s.arrows) {
      const arrow = (x, y, dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - dx * 9 - dy * 4, y - dy * 9 + dx * 4);
        ctx.lineTo(x - dx * 9 + dy * 4, y - dy * 9 - dx * 4);
        ctx.closePath();
        ctx.fill();
      };
      arrow(w - 1, Math.round(ax) + 0.5, 1, 0);
      arrow(Math.round(ay) + 0.5, 1, 0, -1);
    }
    ctx.font = '500 12px ' + FONT;
    ctx.fillStyle = colors.muted;
    const x = this.ticks('x');
    const y = this.ticks('y');
    const below = ax + 16 < hgt;
    ctx.textAlign = 'center';
    ctx.textBaseline = below ? 'top' : 'bottom';
    let lastRight = -Infinity;
    for (const t of x.major) {
      const p = this.px(t);
      if (Math.abs(t) < 1e-12 && !s.logX) continue;
      const label = x.log ? logLabel(t) : x.pi ? piLabel(t) : tickLabel(t, x.step);
      const width = ctx.measureText(label).width;
      if (p - width / 2 < lastRight + 6 || p < 8 || p > w - 14) continue;
      ctx.fillRect(p - 0.5, ax - 3, 1, 6);
      ctx.fillText(label, p, below ? ax + 5 : ax - 5);
      lastRight = p + width / 2;
    }
    const right = ay + 8 + 40 < w;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    for (const t of y.major) {
      const p = this.py(t);
      if (Math.abs(t) < 1e-12 && !s.logY) continue;
      if (p < 10 || p > hgt - 10) continue;
      const label = y.log ? logLabel(t) : tickLabel(t, y.step);
      ctx.fillRect(ay - 3, p - 0.5, 6, 1);
      ctx.fillText(label, right ? ay + 7 : ay - 7, p);
    }
    // Axis names
    ctx.font = 'italic 500 14px ' + FONT;
    ctx.fillStyle = colors.axis;
    ctx.textAlign = 'right';
    ctx.textBaseline = below ? 'bottom' : 'top';
    ctx.fillText(s.xLabel || '', w - 6, below ? ax - 6 : ax + 6);
    ctx.textAlign = right ? 'left' : 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(s.yLabel || '', right ? ay + 9 : ay - 9, 4);
    if (!s.logX && !s.logY && this.px(0) >= 0 && this.px(0) <= w && this.py(0) >= 0 && this.py(0) <= hgt) {
      ctx.font = '500 12px ' + FONT;
      ctx.fillStyle = colors.muted;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', ay - 5, ax + 4);
    }
  }

  conditionHolds(object) {
    const text = styleOf(object).condition;
    if (!text || !text.trim()) return true;
    if (object.conditionText !== text) {
      object.conditionText = text;
      try {
        const clean = text.replace(/\bund\b/g, ' and ').replace(/\boder\b/g, ' or ').replace(/,/g, '.');
        object.conditionFn = compileCondition(parsePlain(clean), [], this.scene.scope);
      } catch (e) {
        object.conditionFn = null;
      }
    }
    return object.conditionFn ? object.conditionFn() : true;
  }

  stroke(ctx, style, selected) {
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width + (selected ? 1.5 : 0);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const w = ctx.lineWidth;
    ctx.setLineDash(style.dash === 'dash' ? [w * 4, w * 2.5] : style.dash === 'dot' ? [0.1, w * 2.4] : []);
  }

  paintObject(ctx, object, style, selected, colors) {
    const w = this.width;
    const hgt = this.height;
    switch (object.type) {
      case 'function': {
        this.stroke(ctx, style, selected);
        const from = object.from ? Math.max(this.settings.xmin, object.from()) : this.settings.xmin;
        const to = object.to ? Math.min(this.settings.xmax, object.to()) : this.settings.xmax;
        const pieces = this.sampleGraph(object.f, from, to);
        for (const piece of pieces) this.polyline(ctx, piece);
        ctx.setLineDash([]);
        if (object.from || object.to) {
          ctx.fillStyle = style.color;
          for (const piece of pieces) for (const end of [piece[0], piece[piece.length - 1]]) this.dot(ctx, end[0], end[1], style.width + 1.5, style.color, colors.bg);
        }
        if (style.label && object.label) {
          const label = this.caption(object, style) || object.label;
          const spot = labelSpot(pieces, (x) => this.px(x), (y) => this.py(y), w, hgt);
          if (spot) this.text(ctx, label, spot[0] + 6, spot[1] - 8, style.color, colors.bg);
        }
        return;
      }
      case 'implicit': {
        this.stroke(ctx, style, selected);
        const cell = 5;
        const nx = Math.ceil(w / cell);
        const ny = Math.ceil(hgt / cell);
        const F = (px, py) => object.F(this.wx(px), this.wy(py));
        ctx.beginPath();
        for (const [a, b] of contour(F, 0, w, 0, hgt, nx, ny)) {
          ctx.moveTo(a[0], a[1]);
          ctx.lineTo(b[0], b[1]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      case 'region': {
        const cell = 3;
        ctx.fillStyle = withAlpha(style.color, style.fill || 0.18);
        for (let py = 0; py < hgt; py += cell) {
          let start = -1;
          const y = this.wy(py + cell / 2);
          for (let px = 0; px < w; px += cell) {
            const inside = object.test(this.wx(px + cell / 2), y);
            if (inside && start < 0) start = px;
            if (!inside && start >= 0) {
              ctx.fillRect(start, py, px - start, cell);
              start = -1;
            }
          }
          if (start >= 0) ctx.fillRect(start, py, w - start, cell);
        }
        // The boundary, dashed when it does not belong to the region
        const edge = { ...style, dash: object.strict ? 'dash' : 'solid' };
        this.stroke(ctx, edge, selected);
        if (object.boundary) {
          for (const piece of this.sampleGraph(object.boundary, this.settings.xmin, this.settings.xmax)) this.polyline(ctx, piece);
        } else {
          const F = (px, py) => object.F(this.wx(px), this.wy(py));
          ctx.beginPath();
          for (const [a, b] of contour(F, 0, w, 0, hgt, Math.ceil(w / 5), Math.ceil(hgt / 5))) {
            ctx.moveTo(a[0], a[1]);
            ctx.lineTo(b[0], b[1]);
          }
          ctx.stroke();
        }
        ctx.setLineDash([]);
        return;
      }
      case 'point': {
        const [x, y] = object.at();
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        const r = style.pointSize + (selected ? 1.5 : 0);
        this.dot(ctx, x, y, r, style.color, colors.bg, object.free);
        if (style.label && (object.label || style.caption)) {
          const text = this.caption(object, style) || object.label;
          this.text(ctx, text, this.px(x) + r + 4, this.py(y) - r - 4, colors.ink, colors.bg);
        }
        return;
      }
      case 'line':
      case 'ray':
      case 'segment':
      case 'vector': {
        const [x1, y1] = object.p();
        const [x2, y2] = object.q();
        if (![x1, y1, x2, y2].every(Number.isFinite)) return;
        let a = [this.px(x1), this.py(y1)];
        let b = [this.px(x2), this.py(y2)];
        const far = 4 * (w + hgt);
        const d = [b[0] - a[0], b[1] - a[1]];
        const len = Math.hypot(d[0], d[1]) || 1;
        const u = [d[0] / len, d[1] / len];
        if (object.type === 'line') {
          a = [a[0] - u[0] * far, a[1] - u[1] * far];
          b = [b[0] + u[0] * far, b[1] + u[1] * far];
        } else if (object.type === 'ray') {
          b = [a[0] + u[0] * far, a[1] + u[1] * far];
        }
        this.stroke(ctx, style, selected);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
        ctx.setLineDash([]);
        if (object.type === 'vector') {
          const size = 8 + style.width * 2;
          ctx.fillStyle = style.color;
          ctx.beginPath();
          ctx.moveTo(b[0], b[1]);
          ctx.lineTo(b[0] - u[0] * size - u[1] * size * 0.45, b[1] - u[1] * size + u[0] * size * 0.45);
          ctx.lineTo(b[0] - u[0] * size + u[1] * size * 0.45, b[1] - u[1] * size - u[0] * size * 0.45);
          ctx.closePath();
          ctx.fill();
        }
        if (style.label && (object.name || style.caption)) {
          const text = this.caption(object, style) || object.name;
          const mid = object.type === 'segment' || object.type === 'vector' ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : clampToView([this.px(x1), this.py(y1)], u, w, hgt);
          if (mid) this.text(ctx, text, mid[0] + 6, mid[1] - 8, style.color, colors.bg);
        }
        return;
      }
      case 'circle': {
        const [cx, cy] = object.center();
        const r = object.radius();
        if (![cx, cy, r].every(Number.isFinite) || r < 0) return;
        const rx = Math.abs(this.px(cx + r) - this.px(cx));
        const ry = Math.abs(this.py(cy + r) - this.py(cy));
        ctx.beginPath();
        ctx.ellipse(this.px(cx), this.py(cy), rx, ry, 0, 0, Math.PI * 2);
        if (style.fill > 0) {
          ctx.fillStyle = withAlpha(style.color, style.fill);
          ctx.fill();
        }
        this.stroke(ctx, style, selected);
        ctx.stroke();
        ctx.setLineDash([]);
        if (style.label && (object.name || style.caption)) this.text(ctx, this.caption(object, style) || object.name, this.px(cx) + rx * 0.72 + 4, this.py(cy) - ry * 0.72 - 4, style.color, colors.bg);
        return;
      }
      case 'polygon': {
        const corners = object.corners.map((c) => c());
        if (!corners.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y))) return;
        ctx.beginPath();
        corners.forEach(([x, y], i) => (i ? ctx.lineTo(this.px(x), this.py(y)) : ctx.moveTo(this.px(x), this.py(y))));
        ctx.closePath();
        ctx.fillStyle = withAlpha(style.color, style.fill);
        ctx.fill();
        this.stroke(ctx, style, selected);
        ctx.stroke();
        ctx.setLineDash([]);
        if (style.label && (object.name || style.caption)) {
          const cx = corners.reduce((s, c) => s + c[0], 0) / corners.length;
          const cy = corners.reduce((s, c) => s + c[1], 0) / corners.length;
          ctx.textAlign = 'center';
          this.text(ctx, this.caption(object, style) || object.name, this.px(cx), this.py(cy), style.color, colors.bg, 'center');
        }
        return;
      }
      case 'points': {
        const r = style.pointSize + (selected ? 1.5 : 0);
        const all = object.all().filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        all.forEach(([x, y], i) => {
          this.dot(ctx, x, y, r, style.color, colors.bg);
          if (style.label && object.name) this.text(ctx, all.length > 1 ? object.name + sub(i + 1) : object.name, this.px(x) + r + 4, this.py(y) - r - 4, colors.ink, colors.bg);
        });
        return;
      }
      case 'arc':
      case 'sector': {
        const [M, A, B] = object.parts.map((p) => p());
        if (![...M, ...A, ...B].every(Number.isFinite)) return;
        const r = Math.hypot(A[0] - M[0], A[1] - M[1]);
        const a0 = Math.atan2(A[1] - M[1], A[0] - M[0]);
        const a1 = Math.atan2(B[1] - M[1], B[0] - M[0]);
        const rx = Math.abs(this.px(M[0] + r) - this.px(M[0]));
        const ry = Math.abs(this.py(M[1] + r) - this.py(M[1]));
        ctx.beginPath();
        if (object.type === 'sector') ctx.moveTo(this.px(M[0]), this.py(M[1]));
        ctx.ellipse(this.px(M[0]), this.py(M[1]), rx, ry, 0, -a0, -a1, true);
        if (object.type === 'sector') {
          ctx.closePath();
          ctx.fillStyle = withAlpha(style.color, style.fill);
          ctx.fill();
        }
        this.stroke(ctx, style, selected);
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      case 'angle': {
        const [A, B, C] = object.parts.map((p) => p());
        if (![...A, ...B, ...C].every(Number.isFinite)) return;
        // Screen angles: the y axis points down
        const X = this.px(B[0]);
        const Y = this.py(B[1]);
        const aA = Math.atan2(this.py(A[1]) - Y, this.px(A[0]) - X);
        const aC = Math.atan2(this.py(C[1]) - Y, this.px(C[0]) - X);
        let sweep = aC - aA;
        while (sweep > Math.PI) sweep -= 2 * Math.PI;
        while (sweep <= -Math.PI) sweep += 2 * Math.PI;
        const r = 28;
        const degrees = angleDegrees(A, B, C);
        ctx.fillStyle = withAlpha(style.color, Math.max(style.fill, 0.18));
        ctx.beginPath();
        if (Math.abs(degrees - 90) < 1e-6) {
          // A right angle: a square with a dot
          const u = [Math.cos(aA) * r * 0.6, Math.sin(aA) * r * 0.6];
          const v = [Math.cos(aC) * r * 0.6, Math.sin(aC) * r * 0.6];
          ctx.moveTo(X, Y);
          ctx.lineTo(X + u[0], Y + u[1]);
          ctx.lineTo(X + u[0] + v[0], Y + u[1] + v[1]);
          ctx.lineTo(X + v[0], Y + v[1]);
          ctx.closePath();
          ctx.fill();
          this.stroke(ctx, { ...style, width: Math.min(style.width, 2) }, selected);
          ctx.stroke();
          ctx.fillStyle = style.color;
          ctx.beginPath();
          ctx.arc(X + (u[0] + v[0]) / 2, Y + (u[1] + v[1]) / 2, 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.moveTo(X, Y);
          ctx.arc(X, Y, r, aA, aA + sweep, sweep < 0);
          ctx.closePath();
          ctx.fill();
          this.stroke(ctx, { ...style, width: Math.min(style.width, 2) }, selected);
          ctx.beginPath();
          ctx.arc(X, Y, r, aA, aA + sweep, sweep < 0);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        if (style.label) {
          const mid = aA + sweep / 2;
          const name = object.name ? greek(object.name) + ' = ' : '';
          const text = this.caption(object, style) || name + coordinate(degrees, 1) + '°';
          this.text(ctx, text, X + Math.cos(mid) * (r + 22), Y + Math.sin(mid) * (r + 14), style.color, colors.bg, 'center');
        }
        return;
      }
      case 'chart':
        this.paintChart(ctx, object, style, selected, colors);
        return;
      case 'locus': {
        const path = this.locusPath(object);
        if (!path) return;
        this.stroke(ctx, style, selected);
        ctx.beginPath();
        let last = null;
        for (const point of path) {
          if (!point) {
            last = null;
            continue;
          }
          const X = this.px(point[0]);
          const Y = this.py(point[1]);
          if (last && Math.hypot(X - last[0], Y - last[1]) < (this.width + this.height) / 3) ctx.lineTo(X, Y);
          else ctx.moveTo(X, Y);
          last = [X, Y];
        }
        ctx.stroke();
        ctx.setLineDash([]);
        return;
      }
      case 'curve': {
        const from = object.from();
        const to = object.to();
        if (!Number.isFinite(from) || !Number.isFinite(to)) return;
        this.stroke(ctx, style, selected);
        const n = 1200;
        ctx.beginPath();
        let open = false;
        let last = null;
        for (let i = 0; i <= n; i++) {
          const t = from + ((to - from) * i) / n;
          const X = this.px(object.X(t));
          const Y = this.py(object.Y(t));
          if (!Number.isFinite(X) || !Number.isFinite(Y) || Math.abs(X) > 1e5 || Math.abs(Y) > 1e5 || (last && Math.hypot(X - last[0], Y - last[1]) > (w + hgt) / 2)) {
            open = false;
            last = null;
            continue;
          }
          if (open) ctx.lineTo(X, Y);
          else ctx.moveTo(X, Y);
          open = true;
          last = [X, Y];
        }
        ctx.stroke();
        ctx.setLineDash([]);
        if (style.label && (object.name || style.caption)) {
          const t = from + (to - from) * 0.1;
          this.text(ctx, this.caption(object, style) || object.name, this.px(object.X(t)) + 6, this.py(object.Y(t)) - 8, style.color, colors.bg);
        }
        return;
      }
      default:
    }
  }

  /** The path of a point while a slider or a point on an object runs through its range. */
  /** The shapes of a chart for the current slider values; worked out again only when they change */
  chartOf(object) {
    if (object.shapes) return object.shapes;
    const items = object.items();
    // Functions in the arguments change with the sliders; fields fill the view, so both belong to the key.
    const sliders = items.some((i) => typeof i === 'function') ? [...this.scene.params.values()].map((p) => p.value) : [];
    const viewBound = VIEW_CHARTS.has(object.chart) ? [this.settings.xmin, this.settings.xmax, this.settings.ymin, this.settings.ymax] : [];
    const key = JSON.stringify([items, sliders, viewBound]);
    if (!object.cache || object.cache.key !== key) {
      let shapes = null;
      try {
        shapes = chartShapes(object.command, object.chart, items, object.seed, this.settings);
      } catch (e) {
        shapes = null;
      }
      object.cache = { key, shapes };
    }
    return object.cache.shapes;
  }

  paintChart(ctx, object, style, selected, colors) {
    const shapes = this.chartOf(object);
    if (!shapes) return;
    const accent = style.color === PALETTE[1] ? PALETTE[0] : PALETTE[1];
    const X = (x) => this.px(x);
    const Y = (y) => this.py(y);
    ctx.setLineDash([]);
    ctx.lineJoin = 'round';
    for (const a of shapes.areas) {
      ctx.beginPath();
      a.points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      ctx.closePath();
      ctx.fillStyle = a.own ? withAlpha(style.color, Math.max(style.fill, 0.3)) : withAlpha(accent, 0.45);
      ctx.fill();
    }
    // Filled cells of a region: no borders, so they read as one area
    const flat = shapes.rects.filter((r) => r.flat);
    if (flat.length) {
      ctx.fillStyle = withAlpha(style.color, Math.max(style.fill, 0.3));
      ctx.beginPath();
      for (const r of flat) ctx.rect(Math.min(X(r.x0), X(r.x1)), Math.min(Y(r.y0), Y(r.y1)), Math.abs(X(r.x1) - X(r.x0)) + 0.5, Math.abs(Y(r.y1) - Y(r.y0)) + 0.5);
      ctx.fill();
    }
    for (const r of shapes.rects.filter((x) => !x.flat)) {
      const x = Math.min(X(r.x0), X(r.x1));
      const y = Math.min(Y(r.y0), Y(r.y1));
      const w = Math.abs(X(r.x1) - X(r.x0));
      const hh = Math.abs(Y(r.y1) - Y(r.y0));
      ctx.fillStyle = r.strong ? withAlpha(accent, 0.7) : withAlpha(style.color, Math.max(style.fill, 0.35));
      ctx.fillRect(x, y, w, hh);
      ctx.strokeStyle = r.strong ? accent : style.color;
      ctx.lineWidth = selected ? 2 : 1.2;
      ctx.strokeRect(x + 0.5, y + 0.5, Math.max(0, w - 1), Math.max(0, hh - 1));
    }
    shapes.wedges.forEach((wedge) => {
      const rx = Math.abs(X(wedge.cx + wedge.r) - X(wedge.cx));
      const ry = Math.abs(Y(wedge.cy + wedge.r) - Y(wedge.cy));
      ctx.beginPath();
      ctx.moveTo(X(wedge.cx), Y(wedge.cy));
      ctx.ellipse(X(wedge.cx), Y(wedge.cy), rx, ry, 0, -wedge.a0, -wedge.a1, false);
      ctx.closePath();
      ctx.fillStyle = withAlpha(PALETTE[wedge.index % PALETTE.length], 0.8);
      ctx.fill();
      ctx.strokeStyle = colors.bg;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    for (const line of shapes.lines) {
      ctx.beginPath();
      line.points.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
      const color = line.accent ? accent : style.color;
      ctx.strokeStyle = line.faint ? withAlpha(color, 0.45) : line.shade !== undefined ? withAlpha(color, 0.35 + 0.65 * line.shade) : color;
      ctx.lineWidth = (line.bold ? style.width : line.thin ? 1 : 1.6) + (selected ? 1 : 0);
      ctx.setLineDash(line.dash ? [6, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      if (line.arrow && line.points.length >= 2) {
        // An arrow head at the end, in screen space
        const [x1, y1] = line.points[line.points.length - 1];
        const [x0, y0] = line.points[line.points.length - 2];
        const ax = X(x1);
        const ay = Y(y1);
        const angle = Math.atan2(ay - Y(y0), ax - X(x0));
        const size = line.bold ? 11 : 6;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - size * Math.cos(angle - 0.4), ay - size * Math.sin(angle - 0.4));
        ctx.lineTo(ax - size * Math.cos(angle + 0.4), ay - size * Math.sin(angle + 0.4));
        ctx.closePath();
        ctx.fillStyle = ctx.strokeStyle;
        ctx.fill();
      }
    }
    for (const d of shapes.dots) {
      if (!Number.isFinite(d.x) || !Number.isFinite(d.y)) continue;
      if (d.small) {
        ctx.fillStyle = d.accent ? accent : style.color;
        ctx.fillRect(X(d.x) - 1.5, Y(d.y) - 1.5, 3, 3);
      } else this.dot(ctx, d.x, d.y, style.pointSize + (selected ? 1.5 : 0), d.accent ? accent : style.color, colors.bg);
      if (d.label) this.text(ctx, d.label, X(d.x) + 8, Y(d.y) - 12, colors.ink, colors.bg);
    }
    for (const t of shapes.texts) {
      if (t.strong) this.text(ctx, t.text, X(t.x), Y(t.y), colors.ink, colors.bg, t.align || 'left');
      else {
        ctx.font = '500 12.5px ' + FONT;
        ctx.textAlign = t.align || 'left';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 3;
        ctx.strokeStyle = colors.bg;
        ctx.strokeText(t.text, X(t.x), Y(t.y));
        ctx.fillStyle = colors.muted;
        ctx.fillText(t.text, X(t.x), Y(t.y));
      }
    }
  }

  /** Shows a chart whole: the view takes its bounds, with unequal units except for pie charts */
  fitChart(object) {
    const shapes = this.chartOf(object);
    if (!shapes || !shapes.bounds) return;
    const b = shapes.bounds;
    const s = this.settings;
    const pie = ['pie', 'montecarlo', 'complex', 'cobweb'].includes(object.chart);
    Object.assign(s, { xmin: b.xmin, xmax: b.xmax, ymin: b.ymin, ymax: b.ymax, logX: false, logY: false });
    s.equal = pie;
    if (pie && this.width && this.height) {
      // Equal units: widen whichever side is short
      const perX = (s.xmax - s.xmin) / this.width;
      const perY = (s.ymax - s.ymin) / this.height;
      if (perX > perY) {
        const half = (perX * this.height) / 2;
        const middle = (s.ymin + s.ymax) / 2;
        s.ymin = middle - half;
        s.ymax = middle + half;
      } else {
        const half = (perY * this.width) / 2;
        const middle = (s.xmin + s.xmax) / 2;
        s.xmin = middle - half;
        s.xmax = middle + half;
      }
    }
    this.viewChanged();
  }

  locusPath(object) {
    const P = this.scene.objects.find((o) => o.name === object.pointName && o.type === 'point');
    if (!P) return null;
    const param = this.scene.params.get(object.parameter);
    const glider = this.scene.gliders.get(object.parameter);
    let range;
    let set;
    let saved;
    if (param && param.kind === 'slider') {
      const s = sliderSettings(param.row, param.value);
      range = [s.min, s.max];
      saved = param.value;
      set = (v) => {
        param.value = v;
      };
    } else if (glider) {
      const s = this.settings;
      range = { unit: [0, 1], angle: [0, 2 * Math.PI], x: [s.xmin, s.xmax], y: [s.ymin, s.ymax], line: [-20, 20], ray: [0, 20] }[glider.mode] || [0, 1];
      saved = glider.t;
      set = (v) => {
        glider.t = v;
      };
    } else return null;
    const path = [];
    const n = 400;
    try {
      for (let i = 0; i <= n; i++) {
        set(range[0] + ((range[1] - range[0]) * i) / n);
        const [x, y] = P.at();
        path.push(Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null);
      }
    } finally {
      set(saved);
    }
    return path;
  }

  // Construction tools

  renderToolbar() {
    this.toolbar.replaceChildren(...TOOLS.map((t) => h('button', {
      'aria-pressed': String(t.id === this.tool),
      onclick: () => this.setTool(t.id),
    }, t.label)));
    const t = toolById(this.tool);
    const step = Math.min(this.picks.length, (t.hint || []).length - 1);
    this.hint.textContent = this.tool === 'move' ? '' : Array.isArray(t.hint) ? t.hint[Math.max(0, step)] : t.hint;
  }

  setTool(id) {
    this.tool = id;
    this.picks = [];
    this.canvas.style.cursor = id === 'move' ? '' : 'crosshair';
    this.renderToolbar();
    this.redraw();
  }

  /** A tap while a construction tool is on. */
  toolTap(at) {
    const t = toolById(this.tool);
    const need = t.repeat ? 'point' : t.picks[this.picks.length];
    const target = this.hit(at[0], at[1]);
    let pick = null;
    if (need === 'point') {
      if (target && target.type === 'point' && target.name) pick = target.name;
      else pick = this.onCreatePoint(...this.snapped(at));
      if (t.id === 'point') {
        this.picks = [];
        this.renderToolbar();
        return;
      }
      if (t.repeat && this.picks.length >= 3 && pick === this.picks[0]) {
        this.onConstruct(t, [...this.picks]);
        this.picks = [];
        this.renderToolbar();
        return;
      }
    } else if (need === 'object') {
      if (target && target.type !== 'point' && target.name) pick = target.name;
      else {
        toast('Tippe auf eine benannte Gerade, einen Kreis oder einen Graphen.');
        return;
      }
    } else if (need === 'any') {
      if (target && target.name) pick = target.name;
      else {
        toast('Tippe auf ein benanntes Objekt.');
        return;
      }
    } else if (need === 'glider') {
      if (!target || target.type === 'point' || !target.name) {
        toast('Tippe auf eine Gerade, eine Strecke, einen Kreis oder einen Graphen.');
        return;
      }
      pick = { name: target.name, t: roundNumber(this.gliderStart(target, at)) };
    }
    if (pick === null) return;
    this.picks.push(pick);
    if (!t.repeat && this.picks.length === t.picks.length) {
      this.onConstruct(t, [...this.picks]);
      this.picks = [];
    }
    this.renderToolbar();
    this.redraw();
  }

  snapped(at) {
    let x = this.wx(at[0]);
    let y = this.wy(at[1]);
    if (this.settings.snap) {
      const step = niceStep(this.settings.xmax - this.settings.xmin, this.width / 90) / 2;
      x = Math.round(x / step) * step;
      y = Math.round(y / step) * step;
    }
    return [roundNumber(x), roundNumber(y)];
  }

  /** Where a new point on an object starts: the tapped x on a graph or sloped line, the angle on a circle … */
  gliderStart(object, at) {
    const x = this.wx(at[0]);
    const y = this.wy(at[1]);
    if (object.type === 'circle') {
      const [cx, cy] = object.center();
      return Math.atan2(y - cy, x - cx);
    }
    if (object.type === 'segment' || object.type === 'ray' || object.type === 'vector') {
      const [ax, ay] = object.p();
      const [bx, by] = object.q();
      const len = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len;
      return object.type === 'ray' ? Math.max(0, t) : Math.max(0, Math.min(1, t));
    }
    if (object.type === 'line') {
      const [ax, ay] = object.p();
      const [bx, by] = object.q();
      if (Math.abs(bx - ax) < 1e-12) return y;
      const len = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      // A line through two points is walked from its first point; the tool writes x for graphs
      return ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len;
    }
    return x;
  }

  /** The place t on its object nearest to the finger. */
  gliderT(object, at) {
    const g = object.glider;
    const x = this.wx(at[0]);
    const y = this.wy(at[1]);
    switch (g.mode) {
      case 'x':
        return x;
      case 'y':
        return y;
      case 'angle': {
        const [ax, ay] = g.atT(0);
        const [bx, by] = g.atT(Math.PI);
        return Math.atan2(y - (ay + by) / 2, x - (ax + bx) / 2);
      }
      default: {
        const [ax, ay] = g.atT(0);
        const [bx, by] = g.atT(1);
        const len = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
        let t = ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len;
        if (g.mode === 'unit') t = Math.max(0, Math.min(1, t));
        if (g.mode === 'ray') t = Math.max(0, t);
        return t;
      }
    }
  }

  /** Samples a graph once per pixel, with the jumps of poles left open. */
  sampleGraph(f, from, to) {
    if (!(to > from)) return [];
    const s = this.settings;
    const left = Math.max(0, this.px(from));
    const right = Math.min(this.width, this.px(to));
    const n = Math.max(2, Math.ceil((right - left) * 1.5));
    const pieces = s.logX
      ? sampleFunction((t) => f(Math.pow(10, t)), Math.log10(from), Math.log10(to), n, Infinity).map((p) => p.map(([t, y]) => [Math.pow(10, t), y]))
      : sampleFunction(f, from, to, n, s.ymax - s.ymin);
    return pieces;
  }

  polyline(ctx, piece) {
    ctx.beginPath();
    let started = false;
    const limit = 10 * (this.width + this.height);
    for (const [x, y] of piece) {
      const X = this.px(x);
      let Y = this.py(y);
      if (!Number.isFinite(Y)) continue;
      Y = Math.max(-limit, Math.min(limit, Y));
      if (started) ctx.lineTo(X, Y);
      else ctx.moveTo(X, Y);
      started = true;
    }
    ctx.stroke();
  }

  dot(ctx, x, y, r, color, bg, hollow = false) {
    const X = this.px(x);
    const Y = this.py(y);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(X, Y, r, 0, Math.PI * 2);
    ctx.fillStyle = hollow ? color : color;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = bg;
    ctx.stroke();
    if (hollow) {
      ctx.beginPath();
      ctx.arc(X, Y, Math.max(1.5, r * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
    }
  }

  text(ctx, text, x, y, color, bg, align = 'left') {
    ctx.font = '600 13.5px ' + FONT;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = bg;
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  /** The caption of an object with {…} worked out: "a = {a}", "Fläche {x(A)}" … */
  caption(object, style) {
    const text = style.caption;
    if (!text) return '';
    return text.replace(/\{([^{}]+)\}/g, (all, expr) => {
      try {
        let fn = object.captionFns && object.captionFns[expr];
        if (!fn) {
          const clean = expr.replace(/,/g, '.');
          const point = object.type === 'point' ? object.at : null;
          const node = parsePlain(clean);
          const scope = {
            value: (name) => {
              if (point && name === 'x') return point()[0];
              if (point && name === 'y') return point()[1];
              return this.scene.scope.value(name);
            },
          };
          fn = compile(node, [], scope);
          object.captionFns = { ...(object.captionFns || {}), [expr]: fn };
        }
        return coordinate(fn(), 2);
      } catch (e) {
        return all;
      }
    });
  }

  // Special points of the selected graph

  selectedObject() {
    return this.scene.objects.find((o) => o.id === this.selected) || null;
  }

  computeSpecial() {
    const object = this.selectedObject();
    if (!object || object.type !== 'function' || !isVisible(object)) return [];
    const s = this.settings;
    const from = object.from ? Math.max(s.xmin, object.from()) : s.xmin;
    const to = object.to ? Math.min(s.xmax, object.to()) : s.xmax;
    const others = this.scene.objects.filter((o) => o !== object && o.type === 'function' && isVisible(o));
    try {
      const tolerance = (s.xmax - s.xmin) / 2000;
      const points = specialPoints(object.f, object.d1, object.d2, from, to, others)
        .filter((p, i, all) => p.kind !== 'Sy' || !all.some((q) => q !== p && Math.abs(q.x) < tolerance && Math.abs(q.y - p.y) < tolerance));
      const count = {};
      const total = {};
      for (const p of points) total[p.kind] = (total[p.kind] || 0) + 1;
      return points.map((p) => {
        count[p.kind] = (count[p.kind] || 0) + 1;
        const letter = { X: 'S', Sy: 'Sᵧ' }[p.kind] || p.kind;
        const name = total[p.kind] > 1 && p.kind !== 'Sy' ? letter + sub(count[p.kind]) : letter;
        return { ...p, name };
      });
    } catch (e) {
      return [];
    }
  }

  paintSpecial(ctx, colors) {
    const object = this.selectedObject();
    if (!object) return;
    const color = styleOf(object).color;
    for (const p of this.special) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      this.dot(ctx, p.x, p.y, 4.5, colors.ink, colors.bg);
      this.text(ctx, p.name, this.px(p.x) + 7, this.py(p.y) + 12, color, colors.bg);
    }
  }

  paintTrace(ctx, colors) {
    if (!this.traceAt) return;
    const { x, y, object } = this.traceAt;
    const color = styleOf(object).color;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.px(x), this.py(y));
    ctx.lineTo(this.px(x), this.py(0));
    ctx.moveTo(this.px(x), this.py(y));
    ctx.lineTo(this.px(0), this.py(y));
    ctx.stroke();
    ctx.restore();
    // Tangent
    if (object.d1) {
      const m = object.d1(x);
      if (Number.isFinite(m)) {
        ctx.save();
        ctx.strokeStyle = withAlpha(color, 0.55);
        ctx.lineWidth = 1.5;
        const span = (this.settings.xmax - this.settings.xmin) / 5;
        ctx.beginPath();
        ctx.moveTo(this.px(x - span), this.py(y - m * span));
        ctx.lineTo(this.px(x + span), this.py(y + m * span));
        ctx.stroke();
        ctx.restore();
      }
    }
    this.dot(ctx, x, y, 6, color, colors.bg);
  }

  /** Objects with a trace leave their image on the trace layer, which only a change of view clears. */
  paintTraces(objects) {
    const tracing = objects.filter((o) => styleOf(o).trace);
    if (!tracing.length || !this.width) return;
    const ctx = this.traceCanvas.getContext('2d');
    ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
    ctx.globalAlpha = 0.35;
    const bg = 'rgba(0,0,0,0)';
    for (const object of tracing) {
      const style = { ...styleOf(object), label: false, fill: 0 };
      try {
        this.paintObject(ctx, object, style, false, { bg, ink: style.color });
      } catch (e) {
        // skip
      }
    }
    ctx.globalAlpha = 1;
  }

  clearTrace() {
    const ctx = this.traceCanvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.traceCanvas.width, this.traceCanvas.height);
  }

  // The tooltip for a tapped special point or the trace

  showTip(text, x, y) {
    this.tip = { text, x, y };
    this.updateTip();
  }

  hideTip() {
    this.tip = null;
    this.updateTip();
  }

  updateTip() {
    const tip = this.traceAt
      ? { text: `(${coordinate(this.traceAt.x)} | ${coordinate(this.traceAt.y)})` + (this.traceAt.object.d1 ? `   m = ${coordinate(this.traceAt.object.d1(this.traceAt.x))}` : ''), x: this.traceAt.x, y: this.traceAt.y }
      : this.tip;
    if (!tip) {
      this.tooltip.style.display = 'none';
      return;
    }
    this.tooltip.textContent = tip.text;
    this.tooltip.style.display = 'block';
    const X = Math.min(this.width - 12, Math.max(12, this.px(tip.x)));
    const Y = this.py(tip.y);
    this.tooltip.style.left = X + 'px';
    this.tooltip.style.top = Math.max(8, Y - 44) + 'px';
  }

  // Hit testing

  hit(px, py) {
    const candidates = [];
    const objects = this.scene.objects.filter((o) => isVisible(o) && this.conditionHolds(o));
    for (const o of objects) {
      let d = Infinity;
      try {
        d = this.distance(o, px, py);
      } catch (e) {
        d = Infinity;
      }
      if (d < HIT) candidates.push([o.type === 'point' ? d - HIT : d, o]);
    }
    candidates.sort((a, b) => a[0] - b[0]);
    return candidates.length ? candidates[0][1] : null;
  }

  distance(o, px, py) {
    switch (o.type) {
      case 'point': {
        const [x, y] = o.at();
        return Math.hypot(this.px(x) - px, this.py(y) - py);
      }
      case 'function': {
        let best = Infinity;
        for (let dx = -HIT; dx <= HIT; dx += 2) {
          const x = this.wx(px + dx);
          if (o.from && x < o.from()) continue;
          if (o.to && x > o.to()) continue;
          const y = o.f(x);
          if (Number.isFinite(y)) best = Math.min(best, Math.hypot(dx, this.py(y) - py));
        }
        return best;
      }
      case 'line':
      case 'ray':
      case 'segment':
      case 'vector': {
        const [x1, y1] = o.p();
        const [x2, y2] = o.q();
        return segmentDistance([px, py], [this.px(x1), this.py(y1)], [this.px(x2), this.py(y2)], o.type);
      }
      case 'circle': {
        const [cx, cy] = o.center();
        const r = o.radius();
        const rx = Math.abs(this.px(cx + r) - this.px(cx));
        return Math.abs(Math.hypot(px - this.px(cx), py - this.py(cy)) - rx);
      }
      case 'implicit': {
        const F = (a, b) => o.F(this.wx(a), this.wy(b));
        const v = F(px, py);
        const gx = (F(px + 1, py) - F(px - 1, py)) / 2;
        const gy = (F(px, py + 1) - F(px, py - 1)) / 2;
        const g = Math.hypot(gx, gy);
        return g ? Math.abs(v) / g : Infinity;
      }
      case 'polygon': {
        const corners = o.corners.map((c) => c()).map(([x, y]) => [this.px(x), this.py(y)]);
        let best = Infinity;
        corners.forEach((a, i) => {
          best = Math.min(best, segmentDistance([px, py], a, corners[(i + 1) % corners.length], 'segment'));
        });
        return best;
      }
      case 'points':
        return Math.min(Infinity, ...o.all().map(([x, y]) => Math.hypot(this.px(x) - px, this.py(y) - py)));
      case 'chart': {
        const shapes = this.chartOf(o);
        if (!shapes) return Infinity;
        const X = (x) => this.px(x);
        const Y = (y) => this.py(y);
        const inRect = shapes.rects.some((r) => px >= Math.min(X(r.x0), X(r.x1)) && px <= Math.max(X(r.x0), X(r.x1)) && py >= Math.min(Y(r.y0), Y(r.y1)) && py <= Math.max(Y(r.y0), Y(r.y1)));
        const inWedge = shapes.wedges.some((w) => Math.hypot((px - X(w.cx)) / Math.abs(X(w.cx + w.r) - X(w.cx)), (py - Y(w.cy)) / Math.abs(Y(w.cy + w.r) - Y(w.cy))) <= 1);
        if (inRect || inWedge) return HIT / 2;
        let best = Infinity;
        for (const d of shapes.dots) best = Math.min(best, Math.hypot(X(d.x) - px, Y(d.y) - py));
        for (const line of shapes.lines) for (let i = 1; i < line.points.length; i++) {
          best = Math.min(best, segmentDistance([px, py], [X(line.points[i - 1][0]), Y(line.points[i - 1][1])], [X(line.points[i][0]), Y(line.points[i][1])], 'segment'));
        }
        return best;
      }
      case 'arc':
      case 'sector':
      case 'angle': {
        const [M, A] = o.parts.map((p) => p());
        if (o.type === 'angle') {
          const [, B] = o.parts.map((p) => p());
          return Math.max(0, Math.hypot(this.px(B[0]) - px, this.py(B[1]) - py) - 30);
        }
        const r = Math.abs(this.px(M[0] + Math.hypot(A[0] - M[0], A[1] - M[1])) - this.px(M[0]));
        return Math.abs(Math.hypot(px - this.px(M[0]), py - this.py(M[1])) - r);
      }
      case 'curve': {
        let best = Infinity;
        const from = o.from();
        const to = o.to();
        for (let i = 0; i <= 400; i++) {
          const t = from + ((to - from) * i) / 400;
          best = Math.min(best, Math.hypot(this.px(o.X(t)) - px, this.py(o.Y(t)) - py));
        }
        return best;
      }
      default:
        return Infinity;
    }
  }

  select(object) {
    this.selected = object ? object.id : null;
    this.special = object ? this.computeSpecial() : [];
    this.hideTip();
    this.redraw();
    this.onSelect(object ? object.row : null);
  }

  // Pointer input: pan, pinch, tap, hold to trace, drag free points

  bindPointers() {
    const c = this.canvas;
    c.style.touchAction = 'none';
    c.addEventListener('pointerdown', (e) => this.down(e));
    c.addEventListener('pointermove', (e) => this.move(e));
    c.addEventListener('pointerup', (e) => this.up(e));
    c.addEventListener('pointercancel', (e) => this.up(e, true));
    c.addEventListener('pointerleave', () => {
      this.readout.textContent = '';
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = c.getBoundingClientRect();
      const factor = Math.exp(e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      this.zoom(factor, e.clientX - rect.left, e.clientY - rect.top);
      this.viewChanged();
    }, { passive: false });
    c.addEventListener('dblclick', (e) => {
      const rect = c.getBoundingClientRect();
      this.zoom(0.5, e.clientX - rect.left, e.clientY - rect.top);
      this.viewChanged();
    });
  }

  local(e) {
    const rect = this.canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  }

  down(e) {
    this.canvas.setPointerCapture(e.pointerId);
    const at = this.local(e);
    this.pointers.set(e.pointerId, at);
    if (this.pointers.size === 2) {
      clearTimeout(this.holdTimer);
      const [a, b] = [...this.pointers.values()];
      this.gesture = { kind: 'pinch', distance: Math.hypot(a[0] - b[0], a[1] - b[1]), dx: Math.abs(a[0] - b[0]), dy: Math.abs(a[1] - b[1]), centre: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
      this.traceAt = null;
      return;
    }
    const target = this.hit(at[0], at[1]);
    if (target && target.type === 'point' && target.glider && this.tool === 'move') {
      this.gesture = { kind: 'glider', object: target, start: at, moved: false };
      const g = this.scene.gliders.get(target.name);
      if (g) g.dragging = true;
      return;
    }
    if (target && target.type === 'point' && target.free && this.tool === 'move') {
      this.gesture = { kind: 'point', object: target, start: at, moved: false };
      const p = this.scene.points.get(target.name);
      if (p) p.dragging = true;
      return;
    }
    this.gesture = { kind: 'pan', start: at, last: at, moved: false, target };
    clearTimeout(this.holdTimer);
    this.holdTimer = setTimeout(() => {
      if (this.gesture && this.gesture.kind === 'pan' && !this.gesture.moved) {
        const graph = (target && target.type === 'function' ? target : null) || this.nearestGraph(at[0]);
        if (graph) {
          this.gesture = { kind: 'trace', object: graph };
          this.traceTo(at[0]);
        }
      }
    }, HOLD_MS);
  }

  nearestGraph(px) {
    const selected = this.selectedObject();
    if (selected && selected.type === 'function') return selected;
    return this.scene.objects.find((o) => o.type === 'function' && isVisible(o) && Number.isFinite(o.f(this.wx(px)))) || null;
  }

  traceTo(px) {
    const object = this.gesture.object;
    const x = this.wx(px);
    const y = object.f(x);
    this.traceAt = Number.isFinite(y) ? { x, y, object } : null;
    this.redraw();
  }

  move(e) {
    const at = this.local(e);
    if (e.pointerType === 'mouse' && !this.pointers.size) {
      this.readout.textContent = `x = ${coordinate(this.wx(at[0]), 3)}   y = ${coordinate(this.wy(at[1]), 3)}`;
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, at);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch' && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const distance = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const centre = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      this.pan(centre[0] - g.centre[0], centre[1] - g.centre[1]);
      const dx = Math.abs(a[0] - b[0]);
      const dy = Math.abs(a[1] - b[1]);
      const fx = g.dx > 30 && dx > 30 ? g.dx / dx : g.distance / distance;
      const fy = g.dy > 30 && dy > 30 ? g.dy / dy : g.distance / distance;
      this.zoom(g.distance / distance, centre[0], centre[1], fx, fy);
      Object.assign(g, { distance, centre, dx, dy });
      this.clearTrace();
      this.redraw();
      return;
    }
    if (g.kind === 'trace') {
      this.traceTo(at[0]);
      return;
    }
    if (g.kind === 'glider') {
      if (Math.hypot(at[0] - g.start[0], at[1] - g.start[1]) > 3) g.moved = true;
      const glider = this.scene.gliders.get(g.object.name);
      if (glider) glider.t = this.gliderT(g.object, at);
      this.onGliderMove(g.object.name, glider ? glider.t : 0, false);
      this.redraw();
      return;
    }
    if (g.kind === 'point') {
      if (Math.hypot(at[0] - g.start[0], at[1] - g.start[1]) > 3) g.moved = true;
      let x = this.wx(at[0]);
      let y = this.wy(at[1]);
      if (this.settings.snap) {
        const step = niceStep(this.settings.xmax - this.settings.xmin, this.width / 90) / 10;
        x = Math.round(x / step) * step;
        y = Math.round(y / step) * step;
      }
      const p = this.scene.points.get(g.object.name);
      if (p) {
        p.x = x;
        p.y = y;
      }
      this.onPointMove(g.object.name, x, y, false);
      this.redraw();
      return;
    }
    if (g.kind === 'pan') {
      if (!g.moved && Math.hypot(at[0] - g.start[0], at[1] - g.start[1]) < 6) return;
      g.moved = true;
      clearTimeout(this.holdTimer);
      this.pan(at[0] - g.last[0], at[1] - g.last[1]);
      g.last = at;
      this.clearTrace();
      this.redraw();
    }
  }

  up(e, cancelled = false) {
    this.pointers.delete(e.pointerId);
    clearTimeout(this.holdTimer);
    const g = this.gesture;
    if (!g) return;
    if (g.kind === 'pinch') {
      if (this.pointers.size === 0) {
        this.gesture = null;
        this.viewChanged();
      }
      return;
    }
    this.gesture = null;
    if (g.kind === 'trace') {
      this.traceAt = null;
      this.redraw();
      return;
    }
    if (g.kind === 'glider') {
      const glider = this.scene.gliders.get(g.object.name);
      if (glider) {
        glider.dragging = false;
        if (g.moved && !cancelled) this.onGliderMove(g.object.name, roundNumber(glider.t), true);
      }
      if (!g.moved) this.select(g.object);
      return;
    }
    if (g.kind === 'point') {
      const p = this.scene.points.get(g.object.name);
      if (p) {
        p.dragging = false;
        if (g.moved && !cancelled) this.onPointMove(g.object.name, p.x, p.y, true);
      }
      if (!g.moved) this.select(g.object);
      return;
    }
    if (g.kind === 'pan') {
      if (g.moved) {
        this.viewChanged();
        return;
      }
      if (cancelled) return;
      const at = this.local(e);
      if (this.tool !== 'move') {
        this.toolTap(at);
        return;
      }
      // A tapped special point shows its coordinates.
      const special = this.special.find((p) => Math.hypot(this.px(p.x) - at[0], this.py(p.y) - at[1]) < HIT);
      if (special) {
        this.showTip(`${special.name}(${coordinate(special.x)} | ${coordinate(special.y)})`, special.x, special.y);
        return;
      }
      const target = this.hit(at[0], at[1]);
      if (target && target.type === 'point') {
        const [x, y] = target.at();
        this.select(target);
        this.showTip(`${target.name || ''}(${coordinate(x)} | ${coordinate(y)})`, x, y);
        return;
      }
      this.select(target);
    }
  }

  // Export

  /** The graphics as a PNG (base64) on white, `scale` times the size on screen. */
  png(scale = 2) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(this.width * scale);
    canvas.height = Math.round(this.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.paint(ctx, this.colors(true), true);
    return canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }
}

const FONT = "'Work Sans', -apple-system, system-ui, sans-serif";

const GREEK = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', phi: 'φ', psi: 'ψ', omega: 'ω', theta: 'θ', rho: 'ρ', sigma: 'σ', tau: 'τ', mu: 'μ', lambda: 'λ' };

function greek(name) {
  const [base, index] = String(name).split('_');
  return (GREEK[base] || base) + (index ? sub(index) : '');
}

/** The angle ABC in degrees, between 0 and 180 */
function angleDegrees(A, B, C) {
  const u = [A[0] - B[0], A[1] - B[1]];
  const v = [C[0] - B[0], C[1] - B[1]];
  const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

/** A number for a row: no float noise */
function roundNumber(value) {
  return Number(Number(value).toFixed(6));
}

function logLabel(value) {
  const e = Math.round(Math.log10(value));
  if (e >= 0 && e <= 4) return String(Math.pow(10, e));
  if (e < 0 && e >= -3) return String(Math.pow(10, e)).replace('.', ',');
  return '10^' + e;
}

function withAlpha(color, alpha) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color || '');
  if (!hex) return color;
  const n = parseInt(hex[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function segmentDistance(p, a, b, kind) {
  const d = [b[0] - a[0], b[1] - a[1]];
  const len2 = d[0] * d[0] + d[1] * d[1];
  if (!len2) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * d[0] + (p[1] - a[1]) * d[1]) / len2;
  if (kind === 'segment' || kind === 'vector') t = Math.max(0, Math.min(1, t));
  if (kind === 'ray') t = Math.max(0, t);
  return Math.hypot(p[0] - (a[0] + t * d[0]), p[1] - (a[1] + t * d[1]));
}

/** Where a graph's name goes: near the right edge, where the graph is in view. */
function labelSpot(pieces, X, Y, w, hgt) {
  let best = null;
  for (const piece of pieces) {
    for (let i = piece.length - 1; i >= 0; i -= 3) {
      const px = X(piece[i][0]);
      const py = Y(piece[i][1]);
      if (px < w * 0.9 && px > 20 && py > 20 && py < hgt - 20) {
        if (!best || px > best[0]) best = [px, py];
        break;
      }
    }
  }
  return best;
}

/** A point of a line inside the view, for its label. */
function clampToView(a, u, w, hgt) {
  for (let t = -2 * (w + hgt); t <= 2 * (w + hgt); t += 20) {
    const p = [a[0] + u[0] * t, a[1] + u[1] * t];
    if (p[0] > w * 0.75 && p[0] < w - 20 && p[1] > 20 && p[1] < hgt - 20) return p;
  }
  return null;
}

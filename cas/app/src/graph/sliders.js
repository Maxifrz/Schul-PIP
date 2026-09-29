// Sliders and checkboxes for the values of a project (a = 2, zeige = wahr), and the animation that moves sliders
// by themselves: back and forth, up, down or once, at a chosen speed. While a slider moves only the graphics follow
// at full speed; the CAS rows catch up a few times a second and exactly when it stops.

import { h, sheet, toggle } from '../ui.js';
import { coordinate } from './plot.js';

export const SLIDER_DEFAULTS = { min: -5, max: 5, step: 0.1, speed: 1, mode: 'oscillate' };

/** A sweep from min to max takes this long at speed 1. */
const SWEEP_MS = 4000;

/** The slider settings of a row, with a range that fits its value. */
export function sliderSettings(row, value) {
  const own = (row.graph && row.graph.slider) || {};
  const settings = { ...SLIDER_DEFAULTS, ...own };
  if (own.min === undefined && own.max === undefined && Number.isFinite(value) && Math.abs(value) > 5) {
    const size = Math.pow(10, Math.ceil(Math.log10(Math.abs(value) * 2)));
    settings.min = value > 0 ? 0 : -size;
    settings.max = value > 0 ? size : 0;
    settings.step = size / 100;
  }
  if (own.step === undefined && Number.isInteger(value) && settings.max - settings.min >= 20) settings.step = 1;
  return settings;
}

export class Animator {
  constructor({ scene, onFrame, onLive, onSettle }) {
    this.scene = scene;
    this.onFrame = onFrame;
    this.onLive = onLive;
    this.onSettle = onSettle;
    /** name → direction (+1 / −1) */
    this.playing = new Map();
    this.controls = new Set();
    this.last = 0;
    this.tick = this.tick.bind(this);
  }

  isPlaying(name) {
    return this.playing.has(name);
  }

  get anyPlaying() {
    return this.playing.size > 0;
  }

  play(name) {
    const param = this.scene.params.get(name);
    if (!param || param.kind !== 'slider') return;
    const settings = sliderSettings(param.row, param.value);
    let direction = settings.mode === 'down' ? -1 : 1;
    if (settings.mode === 'once' && param.value >= settings.max) param.value = settings.min;
    this.playing.set(name, direction);
    param.dragging = true;
    if (this.playing.size === 1) {
      this.last = 0;
      requestAnimationFrame(this.tick);
    }
    this.refreshControls();
  }

  pause(name) {
    if (!this.playing.has(name)) return;
    this.playing.delete(name);
    this.settle(name);
    this.refreshControls();
  }

  toggle(name) {
    if (this.isPlaying(name)) this.pause(name);
    else this.play(name);
  }

  /** Plays every slider, or stops them all when one is playing. */
  toggleAll() {
    if (this.anyPlaying) {
      for (const name of [...this.playing.keys()]) this.pause(name);
      return;
    }
    for (const [name, param] of this.scene.params) if (param.kind === 'slider' && (param.row.graph?.slider?.animate !== false)) this.play(name);
  }

  /** Every slider and checkbox back to where it started. */
  reset() {
    for (const name of [...this.playing.keys()]) this.playing.delete(name);
    for (const [name, param] of this.scene.params) {
      const initial = param.row.graph?.slider?.initial ?? param.row.graph?.checkbox?.initial;
      if (initial !== undefined) param.value = initial;
      this.settle(name);
    }
    this.refreshControls();
    this.onFrame();
  }

  tick(time) {
    if (!this.playing.size) return;
    const dt = this.last ? Math.min(100, time - this.last) : 16;
    this.last = time;
    for (const [name, direction] of [...this.playing]) {
      const param = this.scene.params.get(name);
      if (!param) {
        this.playing.delete(name);
        continue;
      }
      const s = sliderSettings(param.row, param.value);
      const range = s.max - s.min || 1;
      let value = param.value + (direction * s.speed * range * dt) / SWEEP_MS;
      let next = direction;
      if (value > s.max) {
        if (s.mode === 'oscillate') {
          value = s.max - (value - s.max);
          next = -1;
        } else if (s.mode === 'up') value = s.min + (value - s.max);
        else {
          value = s.max;
          this.playing.delete(name);
          param.value = value;
          this.settle(name);
          continue;
        }
      } else if (value < s.min) {
        if (s.mode === 'oscillate') {
          value = s.min + (s.min - value);
          next = 1;
        } else if (s.mode === 'down') value = s.max - (s.min - value);
        else {
          value = s.min;
          this.playing.delete(name);
          param.value = value;
          this.settle(name);
          continue;
        }
      }
      param.value = value;
      if (this.playing.has(name)) this.playing.set(name, next);
      this.onLive(param.row);
    }
    this.updateControls();
    this.onFrame();
    if (this.playing.size) requestAnimationFrame(this.tick);
    else this.refreshControls();
  }

  /** A slider moved by hand. */
  drag(name, value) {
    const param = this.scene.params.get(name);
    if (!param) return;
    param.value = value;
    param.dragging = true;
    this.updateControls();
    this.onFrame();
    this.onLive(param.row);
  }

  settle(name) {
    const param = this.scene.params.get(name);
    if (!param) return;
    if (param.kind === 'slider') {
      const s = sliderSettings(param.row, param.value);
      param.value = roundTo(param.value, s.step);
    }
    param.dragging = false;
    this.onSettle(param.row, name, param.value);
  }

  register(control) {
    this.controls.add(control);
  }

  /** Forgets controls that are no longer in the page. */
  prune() {
    for (const c of this.controls) if (!c.el.isConnected) this.controls.delete(c);
  }

  updateControls() {
    for (const c of this.controls) c.update();
  }

  refreshControls() {
    for (const c of this.controls) c.refresh();
  }
}

export function roundTo(value, step) {
  if (!(step > 0)) return value;
  const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(step) + 1e-9) + (String(step).includes('5') ? 1 : 0)));
  return Number((Math.round(value / step) * step).toFixed(decimals));
}

/** A slider with play button and value, for a CAS row or the strip under the graphics. */
export function sliderControl(name, animator, { onSettings, compact = false } = {}) {
  const scene = animator.scene;
  const param = () => scene.params.get(name);
  const playButton = h('button.play', { 'aria-label': 'Animation starten oder anhalten', onclick: () => animator.toggle(name) });
  const range = h('input.range', { type: 'range', 'aria-label': 'Wert von ' + name });
  const value = h('span.value');
  const settingsButton = h('button.gear', { 'aria-label': 'Schieberegler einstellen', onclick: () => onSettings && onSettings(name) }, '⋯');
  const el = h('div.slider' + (compact ? '.compact' : ''), {}, playButton, h('span.name', {}, name), range, value, settingsButton);
  range.addEventListener('input', () => animator.drag(name, Number(range.value)));
  range.addEventListener('change', () => animator.settle(name));
  // Touch devices end a drag without "change" sometimes.
  range.addEventListener('pointerup', () => setTimeout(() => param()?.dragging && animator.settle(name), 0));

  const control = {
    el,
    refresh() {
      const p = param();
      if (!p) return;
      const s = sliderSettings(p.row, p.value);
      range.min = String(s.min);
      range.max = String(s.max);
      range.step = String(s.step);
      playButton.textContent = animator.isPlaying(name) ? '❚❚' : '▶';
      playButton.setAttribute('aria-pressed', String(animator.isPlaying(name)));
      this.update();
    },
    update() {
      const p = param();
      if (!p) return;
      if (document.activeElement !== range || animator.isPlaying(name)) range.value = String(p.value);
      value.textContent = coordinate(p.value, 3);
    },
  };
  animator.register(control);
  control.refresh();
  return el;
}

export function checkboxControl(name, animator) {
  const scene = animator.scene;
  const box = h('input', { type: 'checkbox' });
  const el = h('label.checkbox', {}, box, h('span', {}, name));
  box.addEventListener('change', () => {
    const p = scene.params.get(name);
    if (!p) return;
    p.value = box.checked;
    animator.onFrame();
    animator.settle(name);
  });
  const control = {
    el,
    refresh() {
      this.update();
    },
    update() {
      const p = scene.params.get(name);
      if (p) box.checked = Boolean(p.value);
    },
  };
  animator.register(control);
  control.refresh();
  return el;
}

/** Range, step, speed and kind of animation of a slider. */
export function sliderSheet(row, name, value, onChange) {
  const current = sliderSettings(row, value);
  const field = (label, key) => {
    const input = h('input', { type: 'text', inputmode: 'decimal', value: String(current[key]).replace('.', ',') });
    input.addEventListener('change', () => {
      const v = Number(input.value.replace(',', '.').replace('−', '-'));
      if (Number.isFinite(v)) {
        row.graph.slider = { ...(row.graph.slider || {}), [key]: v };
        onChange();
      }
    });
    return h('div.field', {}, label, h('div', { style: { width: '120px' } }, input));
  };
  row.graph = row.graph || {};
  return sheet((close) => [
    h('h2', {}, 'Schieberegler ' + name),
    field('Minimum', 'min'),
    field('Maximum', 'max'),
    field('Schrittweite', 'step'),
    h('div.field', {}, 'Tempo', toggle([[0.25, '¼×'], [0.5, '½×'], [1, '1×'], [2, '2×'], [4, '4×']], current.speed, (v) => {
      row.graph.slider = { ...(row.graph.slider || {}), speed: v };
      onChange();
    })),
    h('div.field', {}, 'Animation', toggle([['oscillate', '↔'], ['up', '→'], ['down', '←'], ['once', 'einmal']], current.mode, (v) => {
      row.graph.slider = { ...(row.graph.slider || {}), mode: v };
      onChange();
    })),
    h('div.field', {}, 'Bei „Alle abspielen“', toggle([[true, 'mit'], [false, 'ohne']], current.animate !== false, (v) => {
      row.graph.slider = { ...(row.graph.slider || {}), animate: v };
      onChange();
    })),
    h('div.actions', {}, h('button.pill.primary', { onclick: () => close() }, 'Fertig')),
  ]);
}

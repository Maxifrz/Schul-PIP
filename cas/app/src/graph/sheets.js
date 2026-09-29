// Sheets of the graphics: the look of one object, the coordinate system, the list of objects and exporting.

import { SCRIPT_HELP } from '../script.js';
import { h, sheet, toggle } from '../ui.js';
import { PALETTE, styleOf, isVisible } from './scene.js';
import { DEFAULT_SETTINGS } from './view.js';

const LABELS = {
  chart: 'Diagramm', function: 'Funktion', implicit: 'Kurve', region: 'Ungleichung', point: 'Punkt', line: 'Gerade', ray: 'Strahl',
  segment: 'Strecke', vector: 'Vektor', circle: 'Kreis', polygon: 'Vieleck', curve: 'Kurve',
};

export function kindLabel(object) {
  return LABELS[object.type] || 'Objekt';
}

function setStyle(row, key, value) {
  row.graph = row.graph || {};
  row.graph.style = { ...(row.graph.style || {}), [key]: value };
}

/** Colour, line, filling, point size, label, trace and when the object shows. */
export function styleSheet(object, onChange) {
  const row = object.row;
  const style = styleOf(object);
  const apply = (key, value) => {
    setStyle(row, key, value);
    onChange();
  };
  const swatches = h('div.swatches', {}, ...PALETTE.map((c) => h('button.swatch', {
    style: { background: c },
    'aria-label': 'Farbe ' + c,
    'aria-pressed': String(c.toLowerCase() === String(style.color).toLowerCase()),
    onclick: (e) => {
      swatches.querySelectorAll('.swatch').forEach((b) => b.setAttribute('aria-pressed', 'false'));
      e.currentTarget.setAttribute('aria-pressed', 'true');
      apply('color', c);
    },
  })), (() => {
    const custom = h('input.custom-color', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(style.color) ? style.color : '#2F6FDF', 'aria-label': 'Eigene Farbe' });
    custom.addEventListener('input', () => apply('color', custom.value.toUpperCase()));
    return custom;
  })());
  const slider = (label, key, min, max, step, value, format) => {
    const out = h('span.range-value', {}, format(value));
    const input = h('input.range', { type: 'range', min, max, step, value });
    input.addEventListener('input', () => {
      out.textContent = format(Number(input.value));
      apply(key, Number(input.value));
    });
    return h('div.field', {}, label, h('div.range-field', {}, input, out));
  };
  const text = (label, key, placeholder) => {
    const input = h('input', { type: 'text', value: style[key] || '', placeholder });
    input.addEventListener('input', () => apply(key, input.value));
    return h('div.field.stacked', {}, h('span', {}, label), input);
  };
  const lines = object.type !== 'point';
  const fills = ['region', 'polygon', 'circle', 'chart'].includes(object.type);
  return sheet((close) => [
    h('h2', {}, kindLabel(object) + (object.name ? ' ' + object.name : '')),
    h('div.field', {}, 'Sichtbar', toggle([[true, 'ja'], [false, 'nein']], isVisible(object), (v) => {
      row.graph = row.graph || {};
      row.graph.visible = v;
      onChange();
    })),
    h('div.field.stacked', {}, h('span', {}, 'Farbe'), swatches),
    lines ? slider('Linienstärke', 'width', 1, 8, 0.5, style.width, (v) => String(v).replace('.', ',')) : null,
    lines ? h('div.field', {}, 'Linienart', toggle([['solid', '───'], ['dash', '– – –'], ['dot', '·····']], style.dash, (v) => apply('dash', v))) : null,
    fills ? slider('Füllung', 'fill', 0, 1, 0.05, style.fill, (v) => Math.round(v * 100) + ' %') : null,
    object.type === 'point' ? slider('Punktgröße', 'pointSize', 2, 10, 0.5, style.pointSize, (v) => String(v).replace('.', ',')) : null,
    h('div.field', {}, 'Beschriftung', toggle([[true, 'an'], [false, 'aus']], style.label, (v) => apply('label', v))),
    text('Beschriftungstext', 'caption', object.type === 'point' ? 'z. B. {x} | {y} oder Start' : 'z. B. a = {a}'),
    h('p.hint', {}, 'In geschweiften Klammern steht ein Wert, der sich mitbewegt: {a}, {2a+1}, bei Punkten {x} und {y}.'),
    h('div.field', {}, 'Spur', toggle([[false, 'aus'], [true, 'an']], style.trace, (v) => apply('trace', v))),
    text('Nur zeigen, wenn', 'condition', 'z. B. a > 0 oder zeige'),
    h('div.actions', {}, h('button.pill', { onclick: () => { close(); scriptSheet(row, { onChange }); } }, 'Skript …'), h('button.pill.primary', { onclick: () => close() }, 'Fertig')),
  ]);
}

/** Grid, axes, logarithmic scales, π on the x axis, the visible range. */
export function settingsSheet(view, onChange) {
  const s = view.settings;
  const flag = (label, key, options = [[true, 'an'], [false, 'aus']]) => h('div.field', {}, label, toggle(options, s[key], (v) => {
    s[key] = v;
    if (key === 'logX' || key === 'logY') {
      if (v && (key === 'logX' ? s.xmin <= 0 : s.ymin <= 0)) {
        if (key === 'logX') Object.assign(s, { xmin: 0.1, xmax: 1000 });
        else Object.assign(s, { ymin: 0.1, ymax: 1000 });
      }
      if (!v) view.standardView();
    }
    if (key === 'equal') view.fitAspect();
    view.viewChanged();
    onChange();
  }));
  const number = (key) => {
    const input = h('input', { type: 'text', inputmode: 'decimal', value: formatNumber(s[key]) });
    input.addEventListener('change', () => {
      const v = Number(input.value.replace(',', '.').replace('−', '-'));
      if (!Number.isFinite(v)) return;
      s[key] = v;
      if (s.xmax > s.xmin && s.ymax > s.ymin) {
        s.equal = false;
        view.viewChanged();
        onChange();
      }
    });
    return input;
  };
  const name = (key) => {
    const input = h('input', { type: 'text', value: s[key] });
    input.addEventListener('input', () => {
      s[key] = input.value;
      view.redraw();
      onChange();
    });
    return input;
  };
  return sheet((close) => [
    h('h2', {}, 'Koordinatensystem'),
    flag('Raster', 'grid'),
    flag('Feines Raster', 'minor'),
    flag('Achsen', 'axes'),
    flag('Pfeile an den Achsen', 'arrows'),
    flag('x-Achse in Vielfachen von π', 'piX'),
    flag('Gleiche Einheiten auf beiden Achsen', 'equal', [[true, 'ja'], [false, 'nein']]),
    flag('x-Achse logarithmisch', 'logX', [[false, 'nein'], [true, 'ja']]),
    flag('y-Achse logarithmisch', 'logY', [[false, 'nein'], [true, 'ja']]),
    flag('Punkte rasten ein', 'snap', [[true, 'ja'], [false, 'nein']]),
    h('div.field', {}, 'x von … bis', h('div.pair', {}, number('xmin'), number('xmax'))),
    h('div.field', {}, 'y von … bis', h('div.pair', {}, number('ymin'), number('ymax'))),
    h('div.field', {}, 'Achsennamen', h('div.pair', {}, name('xLabel'), name('yLabel'))),
    h('div.actions', {},
      h('button.pill', { onclick: () => { view.clearTrace(); view.redraw(); } }, 'Spuren löschen'),
      h('button.pill', { onclick: () => { Object.assign(s, { ...DEFAULT_SETTINGS }); view.fitAspect(); view.viewChanged(); onChange(); close(); } }, 'Zurücksetzen'),
      h('button.pill.primary', { onclick: () => close() }, 'Fertig'),
    ),
  ]);
}

function formatNumber(v) {
  return String(Math.round(v * 1000) / 1000).replace('.', ',');
}

/** Every object: show or hide, select, style. */
export function objectsSheet(scene, { onToggle, onSelect, onStyle }) {
  return sheet((close) => {
    const list = h('div.object-list');
    const render = () => {
      list.replaceChildren(...scene.objects.map((object) => {
        const style = styleOf(object);
        const visible = isVisible(object);
        const input = object.row.mode === 'text' ? object.row.text : object.row.latex;
        return h('div.object', {},
          h('button.object-dot', {
            style: { background: visible ? style.color : 'transparent', borderColor: style.color },
            'aria-label': visible ? 'Ausblenden' : 'Einblenden',
            onclick: () => {
              onToggle(object);
              render();
            },
          }),
          h('button.object-name', { onclick: () => { close(); onSelect(object); } }, h('b', {}, kindLabel(object)), h('span', {}, ' ' + shorten(input))),
          h('button.pill', { onclick: () => { close(); onStyle(object); } }, 'Stil'),
        );
      }));
      if (!scene.objects.length) list.append(h('p', { style: { color: 'var(--muted)' } }, 'Noch nichts zu zeichnen. Definiere eine Funktion wie f(x) = x^2, einen Punkt wie A(1|2) oder eine Gleichung wie x^2 + y^2 = 9.'));
    };
    render();
    return [h('h2', {}, 'Objekte'), list, h('div.actions', {}, h('button.pill.primary', { onclick: () => close() }, 'Fertig'))];
  });
}

function shorten(latex) {
  const text = String(latex || '')
    .replace(/\\left|\\right|\\middle/g, '')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    .replace(/\\mathrm\{([^}]*)\}/g, '$1')
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '($1)/($2)')
    .replace(/\\cdot/g, '·')
    .replace(/\\[a-zA-Z]+/g, (m) => m.slice(1))
    .replace(/[{}]/g, '');
  return text.length > 40 ? text.slice(0, 39) + '…' : text;
}

/** Share as picture or put into a document of the library. */
export function exportSheet({ onShare, onInsert, canInsert }) {
  return sheet((close) => [
    h('h2', {}, 'Grafik exportieren'),
    h('div.list', {},
      h('button', { onclick: () => { close(); onShare(); } }, 'Als Bild teilen', h('span', {}, 'PNG')),
      canInsert ? h('button', { onclick: () => { close(); onInsert(); } }, 'In ein Dokument einfügen', h('span', {}, 'als neue Seite')) : null,
    ),
    h('div.actions', {}, h('button.pill', { onclick: () => close() }, 'Schließen')),
  ]);
}

/** The scripts of a row: on tap (or press, for a button) and on change */
export function scriptSheet(row, { button = false, onChange } = {}) {
  row.graph = row.graph || {};
  const scripts = row.graph.scripts || {};
  const area = (key, label, placeholder) => {
    const input = h('textarea.script-input', { rows: 4, spellcheck: 'false', autocapitalize: 'off', placeholder });
    input.value = scripts[key] || '';
    return [h('div.field.stacked', {}, label, input), input];
  };
  const [clickRow, click] = area('click', button ? 'Beim Drücken' : 'Beim Antippen in der Grafik', 'z. B. a = a + 1');
  const [changeRow, change] = button ? [null, null] : area('change', 'Wenn sich der Wert ändert', 'z. B. wenn a > 5 dann meldung Geschafft');
  return sheet((close) => [
    h('h2', {}, 'Skript'),
    clickRow,
    changeRow,
    h('details.script-help', {}, h('summary', {}, 'Befehle'), h('div.list.compact', {}, ...SCRIPT_HELP.map(([code, text]) => h('div', {}, h('code', {}, code), h('span', {}, text))))),
    h('div.actions', {}, h('button.pill', { onclick: () => close() }, 'Abbrechen'), h('button.pill.primary', { onclick: () => {
      const next = { click: click.value.trim() };
      if (change) next.change = change.value.trim();
      row.graph.scripts = next;
      if (!next.click && !next.change) delete row.graph.scripts;
      close();
      onChange && onChange();
    } }, 'Speichern')),
  ]);
}

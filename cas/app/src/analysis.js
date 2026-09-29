// Curve sketching as at school, from several Giac calls: domain, symmetry, zeros, y-intercept, derivatives, extreme
// points with the sufficient condition, inflection and saddle points, monotony, curvature, behaviour at infinity and
// asymptotes. Every point comes exactly and, where that is not a whole number, as a decimal too.

import { parsePlain, toLatex, latexNumber } from './expr.js';
import { intervalLatex } from './engine.js';

export const ANALYSIS_COMMANDS = new Set([
  'kurvendiskussion', 'extrempunkte', 'wendepunkte', 'asymptoten', 'monotonie', 'krümmung', 'definitionsmenge',
]);

const PERIODIC = /\b(sin|cos|tan|cot)\(/;

export function analyse(cas, f, which) {
  const g = (command) => {
    const result = cas.raw(command);
    if (result.error) throw new Error(result.error);
    return result.value;
  };
  const tryG = (command) => {
    const result = cas.raw(command);
    return result.error ? null : result.value;
  };
  const latex = (text) => {
    try {
      return toLatex(parsePlain(String(text).replace(/\blist\[/g, '[')));
    } catch (e) {
      return '\\text{' + String(text).replace(/[\\{}]/g, '') + '}';
    }
  };
  const decimal = (text) => {
    const value = tryG(`evalf(${text})`);
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  };
  const listOf = (text) => {
    if (!text) return [];
    const body = String(text).replace(/^list\[/, '[');
    if (body === '[]') return [];
    if (!body.startsWith('[')) return [body];
    return splitTop(body.slice(1, -1));
  };
  // A value exactly, with ≈ decimal when it is not a whole number: 1/3 ≈ 0,333
  const value = (text) => {
    const shown = latex(text);
    const n = decimal(text);
    if (!Number.isFinite(n) || /^-?\d+$/.test(String(text).trim())) return shown;
    const approx = latexNumber(String(Math.round(n * 1000) / 1000));
    return shown === approx ? shown : shown + '\\approx ' + approx;
  };
  const point = (name, x, y) => `${name}\\left(${value(x)}\\,\\middle|\\,${value(y)}\\right)`;
  const at = (expr, x) => g(`simplify(subst(${expr},x=${x}))`);

  const fx = `(${f})`;
  const rows = [];
  const add = (label, content) => rows.push({ label, latex: content });
  const periodic = PERIODIC.test(f);
  const note = periodic ? '\\quad\\text{(in }[0;\\ 2\\pi)\\text{, periodisch)}' : '';

  const d1 = g(`simplify(diff(${fx},x))`);
  const d2 = g(`simplify(diff(${d1},x))`);
  const d3 = g(`simplify(diff(${d2},x))`);
  const domain = tryG(`domain(${fx},x)`);
  const excluded = excludedPoints(domain);

  const wants = (name) => which === 'kurvendiskussion' || which === name;

  if (wants('definitionsmenge')) add('Definitionsmenge', domainLatex(domain, cas, latex));

  if (which === 'kurvendiskussion') {
    const even = tryG(`simplify(subst(${fx},x=-x)-${fx})`) === '0';
    const odd = tryG(`simplify(subst(${fx},x=-x)+${fx})`) === '0';
    add('Symmetrie', even ? '\\text{achsensymmetrisch zur y-Achse, denn } f(-x)=f(x)' : odd ? '\\text{punktsymmetrisch zum Ursprung, denn } f(-x)=-f(x)' : '\\text{keine Symmetrie zur y-Achse oder zum Ursprung}');

    let zeros = listOf(tryG(`solve(${fx}=0,x)`));
    let numeric = false;
    if (!zeros.length) {
      const approx = tryG(`fsolve(${fx}=0,x)`);
      zeros = listOf(approx).filter((z) => Number.isFinite(Number(z)));
      numeric = zeros.length > 0;
    }
    add('Nullstellen', zeros.length ? zeros.map((z) => 'x=' + value(z)).join(';\\ ') + (numeric ? '\\quad\\text{(numerisch)}' : '') + note : '\\text{keine}');

    const y0 = excluded.includes('0') ? null : tryG(`simplify(subst(${fx},x=0))`);
    if (y0 !== null && y0 !== 'undef' && !/infinity/.test(y0)) add('y-Achsenabschnitt', point('S_y', '0', y0));

    add('Ableitungen', `f'(x)=${latex(tryG(`factor(${d1})`) || d1)}\\\\f''(x)=${latex(d2)}\\\\f'''(x)=${latex(d3)}`);
  }

  const critical = wants('extrempunkte') || wants('monotonie') || wants('wendepunkte') ? listOf(tryG(`solve(${d1}=0,x)`)) : [];
  const saddles = [];
  if (wants('extrempunkte')) {
    const found = [];
    for (const c of critical) {
      const second = decimal(at(d2, c));
      const y = at(fx, c);
      if (second < -1e-12) found.push(point('H', c, y) + '\\ \\text{Hochpunkt}');
      else if (second > 1e-12) found.push(point('T', c, y) + '\\ \\text{Tiefpunkt}');
      else {
        // f''(x₀) = 0: the sign change of f' decides.
        const h = 1e-3 * Math.max(1, Math.abs(decimal(c)));
        const left = decimal(`subst(${d1},x=${c}-${h})`);
        const right = decimal(`subst(${d1},x=${c}+${h})`);
        if (left > 0 && right < 0) found.push(point('H', c, y) + '\\ \\text{Hochpunkt (Vorzeichenwechsel von } f\'\\text{)}');
        else if (left < 0 && right > 0) found.push(point('T', c, y) + '\\ \\text{Tiefpunkt (Vorzeichenwechsel von } f\'\\text{)}');
        else saddles.push(c);
      }
    }
    add('Extrempunkte', found.length ? found.join('\\\\') + note : '\\text{keine}');
  }

  if (wants('wendepunkte')) {
    const candidates = listOf(tryG(`solve(${d2}=0,x)`));
    const found = [];
    for (const c of candidates) {
      const third = decimal(at(d3, c));
      let turns = Math.abs(third) > 1e-12;
      if (!turns) {
        const h = 1e-3 * Math.max(1, Math.abs(decimal(c)));
        const left = decimal(`subst(${d2},x=${c}-${h})`);
        const right = decimal(`subst(${d2},x=${c}+${h})`);
        turns = left * right < 0;
      }
      if (!turns) continue;
      const slope = decimal(at(d1, c));
      const y = at(fx, c);
      if (Math.abs(slope) < 1e-12) found.push(point('S', c, y) + '\\ \\text{Sattelpunkt (Terrassenpunkt)}');
      else found.push(point('W', c, y) + '\\ \\text{Wendepunkt}');
    }
    add('Wendepunkte', found.length ? found.join('\\\\') + note : '\\text{keine}');
  }

  if (wants('monotonie')) {
    const up = intervalsOf(cas, tryG(`solve(${d1}>0,x)`), latex);
    const down = intervalsOf(cas, tryG(`solve(${d1}<0,x)`), latex);
    add('Monotonie', `\\text{streng monoton steigend auf } ${up}\\\\\\text{streng monoton fallend auf } ${down}`);
  }

  if (wants('krümmung') && tryG(`simplify(${d2})`) === '0') {
    add('Krümmung', '\\text{keine: der Graph ist (stückweise) eine Gerade}');
  } else if (wants('krümmung')) {
    const left = intervalsOf(cas, tryG(`solve(${d2}>0,x)`), latex);
    const right = intervalsOf(cas, tryG(`solve(${d2}<0,x)`), latex);
    add('Krümmung', `\\text{linksgekrümmt auf } ${left}\\\\\\text{rechtsgekrümmt auf } ${right}`);
  }

  if (which === 'kurvendiskussion' && !periodic) {
    const plus = tryG(`limit(${fx},x,inf)`);
    const minus = tryG(`limit(${fx},x,-inf)`);
    if (plus !== null && minus !== null) {
      add('Verhalten im Unendlichen', `\\lim_{x\\to\\infty}f(x)=${latex(plus)}\\\\\\lim_{x\\to-\\infty}f(x)=${latex(minus)}`);
    }
  }

  if (wants('asymptoten')) {
    const found = [];
    for (const a of excluded) {
      const right = tryG(`limit(${fx},x,${a},1)`);
      const left = tryG(`limit(${fx},x,${a},-1)`);
      if (right === null || left === null) continue;
      if (/infinity/.test(right) || /infinity/.test(left)) {
        const change = right !== left;
        found.push(`x=${latex(a)}\\ \\text{senkrechte Asymptote (Polstelle ${change ? 'mit' : 'ohne'} Vorzeichenwechsel)}`);
      } else if (right === left && right !== 'undef') {
        found.push(`\\text{hebbare Lücke bei } x=${latex(a)}\\ \\text{mit Grenzwert } ${latex(right)}`);
      }
    }
    const plus = tryG(`limit(${fx},x,inf)`);
    const minus = tryG(`limit(${fx},x,-inf)`);
    const finite = (v) => v !== null && !/infinity|undef/.test(v);
    if (finite(plus)) found.push(`y=${latex(plus)}\\ \\text{waagerechte Asymptote für } x\\to\\infty`);
    if (finite(minus) && minus !== plus) found.push(`y=${latex(minus)}\\ \\text{waagerechte Asymptote für } x\\to-\\infty`);
    if (!finite(plus) && !finite(minus)) {
      // Oblique asymptote of a rational function: the polynomial part of the division
      const numerator = tryG(`numer(normal(${fx}))`);
      const denominator = tryG(`denom(normal(${fx}))`);
      if (numerator && denominator && tryG(`degree(${denominator},x)`) !== '0') {
        const degreeNum = Number(tryG(`degree(${numerator},x)`));
        const degreeDen = Number(tryG(`degree(${denominator},x)`));
        if (degreeNum === degreeDen + 1) found.push(`y=${latex(g(`quo(${numerator},${denominator},x)`))}\\ \\text{schiefe Asymptote}`);
      }
    }
    add('Asymptoten', found.length ? found.join('\\\\') : '\\text{keine}');
  }

  return { title: titleOf(which), function: latex(f), rows };
}

function titleOf(which) {
  return {
    kurvendiskussion: 'Kurvendiskussion', extrempunkte: 'Extrempunkte', wendepunkte: 'Wendepunkte', asymptoten: 'Asymptoten',
    monotonie: 'Monotonie', krümmung: 'Krümmung', definitionsmenge: 'Definitionsmenge',
  }[which] || which;
}

function splitTop(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      out.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = text.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/** Points left out of the domain: ((x<>-1) and (x<>1)) → [-1, 1] */
function excludedPoints(domain) {
  if (!domain) return [];
  const out = [];
  const pattern = /x<>([^()]+|\([^()]*\))\)?/g;
  let match;
  while ((match = pattern.exec(domain))) out.push(match[1].replace(/\)+$/, ''));
  return out;
}

function domainLatex(domain, cas, latex) {
  // Giac answers with the variable itself (or true) when every real number is allowed.
  if (!domain || domain === 'true' || domain === '1' || domain === 'x') return '\\mathbb{D}=\\mathbb{R}';
  const excluded = excludedPoints(domain);
  const rest = domain.replace(/\(?x<>([^()]+|\([^()]*\))\)?/g, '').replace(/\band\b/g, '').replace(/[()\s]/g, '');
  if (excluded.length && !rest) return '\\mathbb{D}=\\mathbb{R}\\setminus\\left\\{' + excluded.map(latex).join(';\\ ') + '\\right\\}';
  const parts = cas.intervalParts('[' + domain + ']');
  if (parts && parts.length) {
    const shown = parts.map((p) => intervalLatex(p, latex)).join('\\cup ');
    return '\\mathbb{D}=' + shown + (excluded.length ? '\\setminus\\left\\{' + excluded.map(latex).join(';\\ ') + '\\right\\}' : '');
  }
  return '\\mathbb{D}=\\left\\{x\\in\\mathbb{R}\\mid ' + latex(domain.replace(/<>/g, '!=')) + '\\right\\}';
}

function intervalsOf(cas, solved, latex) {
  if (!solved) return '\\text{–}';
  // Giac: [x] for „every x“, [] for „none“
  const plain = String(solved).replace(/^list/, '').replace(/\s/g, '');
  if (plain === '[x]') return '\\mathbb{D}';
  if (plain === '[]') return '\\text{nirgends}';
  const parts = cas.intervalParts(solved);
  if (!parts) return latex(solved);
  if (!parts.length) return '\\text{nirgends}';
  return parts.map((p) => intervalLatex(p, latex)).join('\\cup ');
}

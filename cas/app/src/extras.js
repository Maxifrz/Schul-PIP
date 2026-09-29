// Commands that explain or finish the job: derivatives and equations step by step, the Gauss algorithm with its row
// operations, inverse functions, ranges, sign tables, convergence, systems of inequalities, line and surface
// integrals, contour lines and units. They answer through the same table results as the statistics (statcommands.js).

import { STAT_COMMANDS, reader, functionArg } from './statcommands.js';
import { symbols, latexNumber, toLatex, parsePlain } from './expr.js';

const text = (t) => '\\text{' + String(t).replace(/[\\{}]/g, '').replace(/_/g, '\\_') + '}';
const fmt = (v, digits = 6) => (Number.isFinite(v) ? latexNumber(String(Number(v.toPrecision(digits))), digits) : v === Infinity ? '\\infty' : v === -Infinity ? '-\\infty' : '\\text{–}');
const hasX = (node, v = 'x') => symbols(node).has(v);

// Exact fractions for the Gauss algorithm

function gcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

class Fraction {
  constructor(n, d = 1n) {
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d);
    this.n = n / g;
    this.d = d / g;
  }
  static of(node) {
    if (node.t === 'num') {
      const [whole, part = ''] = node.v.split('.');
      return new Fraction(BigInt(whole + part), 10n ** BigInt(part.length));
    }
    if (node.t === 'neg') return Fraction.of(node.a).neg();
    if (node.t === 'op' && node.op === '/') return Fraction.of(node.a).div(Fraction.of(node.b));
    throw new Error('Die Matrix darf nur Zahlen enthalten.');
  }
  add(o) { return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Fraction(this.n * o.n, this.d * o.d); }
  div(o) { return new Fraction(this.n * o.d, this.d * o.n); }
  neg() { return new Fraction(-this.n, this.d); }
  get zero() { return this.n === 0n; }
  get one() { return this.n === this.d; }
  latex() {
    if (this.d === 1n) return String(this.n);
    const sign = this.n < 0n ? '-' : '';
    return `${sign}\\frac{${this.n < 0n ? -this.n : this.n}}{${this.d}}`;
  }
}

const matrixLatex = (m) => '\\begin{pmatrix}' + m.map((row) => row.map((f) => f.latex()).join(' & ')).join('\\\\') + '\\end{pmatrix}';

export function gaussSteps(rows) {
  const m = rows.map((r) => [...r]);
  const steps = [];
  const R = (i) => `Z_{${i + 1}}`;
  let lead = 0;
  for (let r = 0; r < m.length && lead < m[0].length; r++) {
    let i = r;
    while (i < m.length && m[i][lead].zero) i++;
    if (i === m.length) {
      lead++;
      r--;
      continue;
    }
    if (i !== r) {
      [m[i], m[r]] = [m[r], m[i]];
      steps.push([`${R(r)}\\leftrightarrow ${R(i)}`, matrixLatex(m)]);
    }
    const pivot = m[r][lead];
    if (!pivot.one) {
      const factor = new Fraction(pivot.d, pivot.n);
      m[r] = m[r].map((f) => f.mul(factor));
      steps.push([`${R(r)}\\cdot ${factor.n < 0n ? '\\left(' + factor.latex() + '\\right)' : factor.latex()}`, matrixLatex(m)]);
    }
    for (let k = 0; k < m.length; k++) {
      if (k === r || m[k][lead].zero) continue;
      const factor = m[k][lead];
      m[k] = m[k].map((f, j) => f.sub(factor.mul(m[r][j])));
      const sign = factor.n < 0n ? '+' : '-';
      const abs = factor.n < 0n ? factor.neg() : factor;
      steps.push([`${R(k)}${sign}${abs.one ? '' : abs.latex() + '\\cdot '}${R(r)}`, matrixLatex(m)]);
    }
    lead++;
  }
  return { steps, result: m };
}

Object.assign(STAT_COMMANDS, {
  ableitungsschritte: {
    run(ctx, args) {
      const node = functionArg(args[0]);
      const g = (n) => ctx.giac(n);
      const d = (n) => ctx.exact(`diff(${g(n)},x)`);
      const show = (n) => ctx.format(ctx.raw(g(n)));
      const rows = [{ label: 'Funktion', latex: `f\\left(x\\right)=${show(node)}` }];
      const rule = (name, detail) => rows.push({ label: name, latex: detail });
      if (node.t === 'op' && (node.op === '+' || node.op === '-')) {
        rule('Summenregel', text('jeder Summand wird für sich abgeleitet'));
        const parts = [];
        const collect = (n, sign) => {
          if (n.t === 'op' && (n.op === '+' || n.op === '-')) {
            collect(n.a, sign);
            collect(n.b, n.op === '-' ? -sign : sign);
          } else parts.push([n, sign]);
        };
        collect(node, 1);
        for (const [part, sign] of parts) rows.push({ label: `(${sign < 0 ? '−' : ''}${show(part).length > 30 ? 'Summand' : ''})′`, latex: `\\left(${show(part)}\\right)'=${d(part)}` });
      } else if (node.t === 'op' && node.op === '*' && hasX(node.a) && hasX(node.b)) {
        rule('Produktregel', "f=u\\cdot v\\ \\Rightarrow\\ f'=u'\\cdot v+u\\cdot v'");
        rows.push({ label: 'u, u′', latex: `u=${show(node.a)},\\quad u'=${d(node.a)}` });
        rows.push({ label: 'v, v′', latex: `v=${show(node.b)},\\quad v'=${d(node.b)}` });
        rows.push({ label: 'eingesetzt', latex: `f'\\left(x\\right)=\\left(${d(node.a)}\\right)\\cdot \\left(${show(node.b)}\\right)+\\left(${show(node.a)}\\right)\\cdot \\left(${d(node.b)}\\right)` });
      } else if (node.t === 'op' && node.op === '*' && !hasX(node.a)) {
        rule('Faktorregel', "\\left(c\\cdot u\\right)'=c\\cdot u'");
        rows.push({ label: 'u′', latex: `\\left(${show(node.b)}\\right)'=${d(node.b)}` });
      } else if (node.t === 'op' && node.op === '/' && hasX(node.b)) {
        rule('Quotientenregel', "f=\\frac{u}{v}\\ \\Rightarrow\\ f'=\\frac{u'\\cdot v-u\\cdot v'}{v^{2}}");
        rows.push({ label: 'u, u′', latex: `u=${show(node.a)},\\quad u'=${d(node.a)}` });
        rows.push({ label: 'v, v′', latex: `v=${show(node.b)},\\quad v'=${d(node.b)}` });
      } else if (node.t === 'op' && node.op === '^' && hasX(node.a) && !hasX(node.b)) {
        const inner = node.a.t === 'sym' ? null : node.a;
        if (!inner) rule('Potenzregel', "\\left(x^{n}\\right)'=n\\cdot x^{n-1}");
        else {
          rule('Kettenregel', "f=u\\left(v\\left(x\\right)\\right)\\ \\Rightarrow\\ f'=u'\\left(v\\right)\\cdot v'");
          rows.push({ label: 'außen, innen', latex: `u\\left(v\\right)=v^{${show(node.b)}},\\quad v=${show(inner)}` });
          rows.push({ label: 'Ableitungen', latex: `u'\\left(v\\right)=${ctx.format(ctx.raw(`(${g(node.b)})*v^((${g(node.b)})-1)`))},\\quad v'=${d(inner)}` });
        }
      } else if (node.t === 'call' && node.args.length === 1 && hasX(node.args[0]) && !(node.args[0].t === 'sym')) {
        const inner = node.args[0];
        rule('Kettenregel', "f=u\\left(v\\left(x\\right)\\right)\\ \\Rightarrow\\ f'=u'\\left(v\\right)\\cdot v'");
        const outer = ctx.format(ctx.raw(g({ ...node, args: [{ t: 'sym', v: 'v' }] })));
        rows.push({ label: 'außen, innen', latex: `u\\left(v\\right)=${outer},\\quad v=${show(inner)}` });
        rows.push({ label: 'Ableitungen', latex: `u'\\left(v\\right)=${ctx.exact(`diff(${g({ ...node, args: [{ t: 'sym', v: 'v' }] })},v)`)},\\quad v'=${d(inner)}` });
      } else if (node.t === 'op' && node.op === '^' && !hasX(node.a) && hasX(node.b)) {
        rule('Exponentialfunktion', "\\left(a^{v}\\right)'=\\ln\\left(a\\right)\\cdot a^{v}\\cdot v'");
      } else {
        rule('Grundableitung', text('aus der Tabelle der Grundfunktionen'));
      }
      rows.push({ label: 'Ergebnis', latex: `f'\\left(x\\right)=${ctx.format(ctx.raw(`diff(${g(node)},x)`))}` });
      return { title: 'Ableitung Schritt für Schritt', rows };
    },
  },
  lösungsschritte: {
    run(ctx, args) {
      const eq = args[0];
      if (!eq || eq.t !== 'rel' || eq.op !== '=') throw new Error('Bitte eine Gleichung angeben, z. B. lösungsschritte(3x + 4 = x - 2).');
      const v = args[1] && args[1].t === 'sym' ? args[1].v : 'x';
      const left = ctx.giac(eq.a);
      const right = ctx.giac(eq.b);
      const diff = `normal((${left})-(${right}))`;
      const degree = Number(ctx.raw(`degree(${diff},${v})`));
      const coef = (k) => ctx.raw(`coeff(${diff},${v},${k})`);
      const L = (t) => ctx.format(t);
      const rows = [{ label: 'Gleichung', latex: `${L(left)}=${L(right)}` }];
      const R = (t) => L(ctx.raw(t));
      if (degree === 1) {
        const a = coef(1);
        const b = coef(0);
        rows.push({ label: 'alles mit ' + v + ' nach links, Zahlen nach rechts', latex: `${R(`(${a})*${v}`)}=${R(`-(${b})`)}` });
        rows.push({ label: `durch ${L(a)} teilen`, latex: `${v}=${R(`-(${b})/(${a})`)}` });
        rows.push({ label: 'Lösung', latex: `L=\\left\\{${R(`-(${b})/(${a})`)}\\right\\}` });
      } else if (degree === 2) {
        const a = coef(2);
        const b = coef(1);
        const c = coef(0);
        rows.push({ label: 'auf eine Seite bringen', latex: `${R(`expand(${diff})`)}=0` });
        if (ctx.raw(`(${a})==1`) !== 'true') rows.push({ label: `durch ${L(a)} teilen (Normalform)`, latex: `${R(`expand((${diff})/(${a}))`)}=0` });
        const p = `(${b})/(${a})`;
        const q = `(${c})/(${a})`;
        rows.push({ label: 'p und q ablesen', latex: `p=${L(ctx.raw(p))},\\quad q=${L(ctx.raw(q))}` });
        const D = `((${p})/2)^2-(${q})`;
        rows.push({ label: 'Diskriminante D = (p/2)² − q', latex: `D=${L(ctx.raw(D))}` });
        const sign = Number(ctx.raw(`evalf(sign(${D}))`));
        if (sign < 0) rows.push({ label: 'D < 0', latex: text('keine reelle Lösung') + '\\quad L=\\emptyset' });
        else {
          rows.push({ label: 'pq-Formel', latex: `${v}_{1,2}=-\\frac{p}{2}\\pm\\sqrt{D}=${L(ctx.raw(`-(${p})/2`))}\\pm\\sqrt{${L(ctx.raw(D))}}` });
          rows.push({ label: 'Lösung', latex: `L=\\left\\{${[...new Set([ctx.raw(`simplify(-(${p})/2-sqrt(${D}))`), ctx.raw(`simplify(-(${p})/2+sqrt(${D}))`)])].map(L).join(';\\ ')}\\right\\}` });
        }
      } else {
        rows.push({ label: 'Grad ' + (Number.isFinite(degree) ? degree : '?'), latex: text('keine Schulformel; das CAS löst direkt') });
        rows.push({ label: 'Lösung', latex: L(ctx.raw(`solve(${left}=${right},${v})`)) });
      }
      return { title: 'Gleichung Schritt für Schritt', rows };
    },
  },
  gaußschritte: {
    run(ctx, args) {
      const exact = ctx.raw(`exact(${ctx.giac(args[0])})`);
      const tree = parsePlain(String(exact).replace(/\b(list|matrix)\[/g, '['));
      if (tree.t !== 'list' || !tree.items.every((r) => r.t === 'list')) throw new Error('Bitte eine Matrix angeben, z. B. [[1, 2, 3], [4, 5, 6]].');
      const rows = tree.items.map((r) => r.items.map((n) => Fraction.of(n)));
      const { steps } = gaussSteps(rows);
      return {
        title: 'Gauß-Verfahren',
        table: { head: ['Schritt', 'Umformung', 'Matrix'], rows: [['0', text('Start'), matrixLatex(rows)], ...steps.map(([op, m], i) => [String(i + 1), op, m])] },
      };
    },
  },
  umkehrfunktion: {
    run(ctx, args) {
      const f = ctx.giac(functionArg(args[0]));
      const solutions = ctx.raw(`solve(y=(${f}),x)`);
      const tree = parsePlain(String(solutions).replace(/\blist\[/g, '['));
      if (tree.t !== 'list' || !tree.items.length) throw new Error('Die Funktion lässt sich nicht nach x auflösen.');
      const items = tree.items.map((i) => ctx.raw(`subst(${ctx.giacOfTree(i)},y=x)`));
      return { giac: items.length === 1 ? items[0] : '[' + items.join(',') + ']' };
    },
  },
  wertebereich: {
    run(ctx, args) {
      const f = ctx.giac(functionArg(args[0]));
      const fn = ctx.functionOfGiac(f);
      const candidates = [];
      const crit = parsePlain(String(ctx.raw(`solve(diff(${f},x)=0,x)`) || '[]').replace(/\blist\[/g, '['));
      for (const c of crit.t === 'list' ? crit.items : []) {
        const x = Number(ctx.raw(`evalf(${ctx.giacOfTree(c)})`));
        if (Number.isFinite(x)) candidates.push(fn(x));
      }
      const limit = (to) => {
        const v = ctx.raw(`limit(${f},x,${to})`);
        if (v === '+infinity' || v === 'infinity' || v === 'inf') return Infinity;
        if (v === '-infinity') return -Infinity;
        const n = Number(ctx.raw(`evalf(${v})`));
        return Number.isFinite(n) ? n : NaN;
      };
      const ends = [limit('-inf'), limit('+inf')];
      // Poles: the function runs off to infinity next to them
      const den = ctx.raw(`denom(normal(${f}))`);
      const poles = den && den !== '1' ? parsePlain(String(ctx.raw(`solve(${den}=0,x)`) || '[]').replace(/\blist\[/g, '[')) : { items: [] };
      for (const p of poles.items || []) {
        const x = Number(ctx.raw(`evalf(${ctx.giacOfTree(p)})`));
        if (!Number.isFinite(x)) continue;
        for (const side of [-1e-7, 1e-7]) candidates.push(fn(x + side) > 0 ? Infinity : -Infinity);
      }
      for (let i = -2000; i <= 2000; i++) candidates.push(fn(i / 20));
      const values = [...candidates, ...ends].filter((v) => !Number.isNaN(v) && v !== undefined);
      const low = Math.min(...values);
      const high = Math.max(...values);
      const attained = (v) => candidates.some((c) => Math.abs(c - v) < 1e-9 * Math.max(1, Math.abs(v)));
      const open = (v, closed) => (Number.isFinite(v) && closed ? '\\left[' : '\\left]');
      const close = (v, closed) => (Number.isFinite(v) && closed ? '\\right]' : '\\right[');
      return { title: 'Wertebereich', rows: [
        { label: 'Wertebereich', latex: `W=${open(low, attained(low))}${fmt(low)};\\ ${fmt(high)}${close(high, attained(high))}` },
        { label: 'ermittelt aus', latex: text('Extremstellen, Grenzwerten für x → ±∞ und Polstellen, numerisch geprüft') },
      ] };
    },
  },
  vorzeichentabelle: {
    run(ctx, args) {
      const f = ctx.giac(functionArg(args[0]));
      const fn = ctx.functionOfGiac(f);
      const points = [];
      const add = (list, kind) => {
        const tree = parsePlain(String(list || '[]').replace(/\blist\[/g, '['));
        for (const item of tree.t === 'list' ? tree.items : []) {
          const x = Number(ctx.raw(`evalf(${ctx.giacOfTree(item)})`));
          if (Number.isFinite(x)) points.push({ x, kind, latex: ctx.format(ctx.giacOfTree(item)) });
        }
      };
      add(ctx.raw(`solve(numer(normal(${f}))=0,x)`), 'Nullstelle');
      const den = ctx.raw(`denom(normal(${f}))`);
      if (den && den !== '1') add(ctx.raw(`solve(${den}=0,x)`), 'Polstelle');
      points.sort((a, b) => a.x - b.x);
      const unique = points.filter((p, i) => !i || Math.abs(p.x - points[i - 1].x) > 1e-12);
      const bounds = [-Infinity, ...unique.map((p) => p.x), Infinity];
      const labels = ['-\\infty', ...unique.map((p) => p.latex), '\\infty'];
      const rows = [];
      for (let i = 0; i + 1 < bounds.length; i++) {
        const a = bounds[i];
        const b = bounds[i + 1];
        const mid = !Number.isFinite(a) ? (Number.isFinite(b) ? b - 1 : 0) : !Number.isFinite(b) ? a + 1 : (a + b) / 2;
        const v = fn(mid);
        rows.push([`\\left]${labels[i]};\\ ${labels[i + 1]}\\right[`, v > 0 ? '+' : v < 0 ? '-' : '0', v > 0 ? text('positiv') : v < 0 ? text('negativ') : text('null')]);
        if (i < unique.length) rows.push([`x=${unique[i].latex}`, unique[i].kind === 'Nullstelle' ? '0' : text('n. d.'), text(unique[i].kind)]);
      }
      return { title: 'Vorzeichentabelle', table: { head: ['Bereich', 'f(x)', ''], rows } };
    },
  },
  ungleichungssystem: {
    chart: 'inequalities',
    roles: (args) => args.map(() => ({ cond: ['x', 'y'] })),
    run(ctx, args) {
      const vars = new Set(args.flatMap((a) => [...symbols(a)]).filter((v) => ['x', 'y'].includes(v)));
      if (vars.has('y')) return { title: 'Ungleichungssystem', rows: [{ label: 'Lösungsmenge', latex: text('die Fläche, in der alle Ungleichungen gelten (in der Grafik)') }] };
      const answer = ctx.raw(`solve([${args.map((a) => ctx.giac(a)).join(',')}],x)`);
      return { title: 'Ungleichungssystem', rows: [{ label: 'Lösungsmenge', latex: ctx.solutions(answer) }] };
    },
  },
  parameterableitung: {
    run(ctx, args) {
      const v = args[2] && args[2].t === 'sym' ? args[2].v : 't';
      return { giac: `simplify(diff(${ctx.giac(args[1])},${v})/diff(${ctx.giac(args[0])},${v}))` };
    },
  },
  konvergenz: {
    run(ctx, args) {
      const v = args[1] && args[1].t === 'sym' ? args[1].v : 'n';
      const a = ctx.giac(args[0]);
      const g = ctx.raw(`limit(${a},${v},inf)`);
      let verdict;
      if (g === '+infinity' || g === 'infinity') verdict = 'bestimmt divergent gegen +∞';
      else if (g === '-infinity') verdict = 'bestimmt divergent gegen −∞';
      else if (!g || /bounded|undef/.test(g)) verdict = 'divergent (kein Grenzwert)';
      else verdict = 'konvergent';
      const rows = [{ label: 'Folge', latex: text(verdict) }];
      if (verdict === 'konvergent') rows.push({ label: `Grenzwert für ${v} → ∞`, latex: ctx.format(g) });
      // The series Σ aₙ
      const sum = ctx.raw(`sum(${a},${v},1,inf)`);
      if (verdict === 'konvergent' && g !== '0') rows.push({ label: 'Reihe Σ aₙ', latex: text('divergent, weil aₙ nicht gegen 0 geht') });
      else if (sum && !/infinity|undef|sum\(/.test(sum)) rows.push({ label: `Reihe Σ aₙ (ab ${v} = 1)`, latex: `\\text{konvergent, Summe }${ctx.format(sum)}` });
      else if (sum && /infinity/.test(sum)) rows.push({ label: 'Reihe Σ aₙ', latex: text('divergent') });
      const ratio = ctx.raw(`limit(abs((${a.replace(new RegExp(`\\b${v}\\b`, 'g'), `(${v}+1)`)})/(${a})),${v},inf)`);
      if (ratio && !/undef|bounded/.test(ratio)) rows.push({ label: 'Quotientenkriterium lim |aₙ₊₁/aₙ|', latex: ctx.format(ratio) });
      return { title: 'Konvergenz', rows };
    },
  },
  kurvenintegral: {
    run(ctx, args) {
      const field = ctx.giac(args[0]);
      const curve = ctx.giac(args[1]);
      const v = args[2] && args[2].t === 'sym' ? args[2].v : 't';
      // Bounds as typed: 2π stays exact
      const a = ctx.giac(args[3]);
      const b = ctx.giac(args[4]);
      const coords = ['x', 'y', 'z'];
      const n = Number(ctx.raw(`size(${curve})`));
      const at = (expr) => `subst(${expr},[${coords.slice(0, n).join(',')}],[${coords.slice(0, n).map((c, i) => `(${curve})[${i}]`).join(',')}])`;
      const isField = /^\[/.test(ctx.raw(field));
      const integrand = isField ? `dot(${at(field)},diff(${curve},${v}))` : `(${at(field)})*sqrt(sum(diff(${curve},${v})[k]^2,k,0,${n - 1}))`;
      const exact = ctx.exact(`integrate(${integrand},${v},${a},${b})`);
      const approx = ctx.number(`evalf(integrate(${integrand},${v},${a},${b}))`);
      return { title: isField ? 'Kurvenintegral ∫ F · dr' : 'Kurvenintegral ∫ f ds', rows: [{ label: 'Wert', latex: exact || fmt(approx) }, ...(exact && Number.isFinite(approx) ? [{ label: '≈', latex: fmt(approx) }] : [])] };
    },
  },
  flächenintegral: {
    run(ctx, args) {
      return surfaceIntegral(ctx, args, false);
    },
  },
  fluss: {
    run(ctx, args) {
      return surfaceIntegral(ctx, args, true);
    },
  },
  flächennormale: {
    run(ctx, args) {
      const s = ctx.giac(args[0]);
      const u = args[1] && args[1].t === 'sym' ? args[1].v : 'u';
      const w = args[2] && args[2].t === 'sym' ? args[2].v : 'v';
      return { giac: `trigsimplify(cross(diff(${s},${u}),diff(${s},${w})))` };
    },
  },
  höhenlinien: {
    chart: 'contour',
    roles: () => [{ fn: ['x', 'y'] }],
    run(ctx, args) {
      return { title: 'Höhenlinien des Skalarfelds', rows: [{ label: 'f(x, y)', latex: ctx.text(args[0]) }] };
    },
  },
  temperatur: {
    run(ctx, args) {
      const r = reader(ctx, args);
      const value = r.number();
      const from = unitWord(args[1]);
      const to = unitWord(args[2]);
      const kelvin = { C: value + 273.15, K: value, F: ((value - 32) * 5) / 9 + 273.15 }[from];
      const out = { C: kelvin - 273.15, K: kelvin, F: ((kelvin - 273.15) * 9) / 5 + 32 }[to];
      if (kelvin === undefined || out === undefined) throw new Error('Einheiten: C, K oder F, z. B. temperatur(20, C, F).');
      return { giac: String(Number(out.toPrecision(12))) };
    },
  },
  einheiten: {
    run() {
      const rows = [
        ['Länge', '_m, _cm, _mm, _km, _inch, _ft, _mile'],
        ['Fläche', '_(m^2), _ha, _acre'],
        ['Volumen', '_l, _ml, _(m^3)'],
        ['Zeit', '_s, _min, _h, _d, _yr'],
        ['Geschwindigkeit', '_(m/s), _(km/h), _knot'],
        ['Beschleunigung', '_(m/s^2), _g_ (Erdbeschleunigung)'],
        ['Masse', '_kg, _g, _t, _lb'],
        ['Kraft', '_N, _kN'],
        ['Energie', '_J, _kJ, _Wh, _kWh, _cal, _eV'],
        ['Leistung', '_W, _kW, _hp'],
        ['Druck', '_Pa, _hPa, _bar, _atm'],
        ['Temperatur', 'temperatur(20, C, F); C, K, F'],
      ];
      return { title: 'Einheiten', table: { head: ['Größe', 'Schreibweise'], rows: rows.map(([a, b]) => [text(a), text(b)]) }, rows: [
        { label: 'rechnen', latex: text('3_m + 20_cm, 5_kg * 9.81_(m/s^2)') },
        { label: 'umrechnen', latex: text('umrechnen(100_(km/h), _(m/s)); si(3_kWh)') },
      ] };
    },
  },
});

function unitWord(node) {
  const name = node && (node.t === 'sym' ? node.v : node.t === 'str' ? node.v : '');
  return { c: 'C', celsius: 'C', k: 'K', kelvin: 'K', f: 'F', fahrenheit: 'F' }[String(name).toLowerCase()];
}

function surfaceIntegral(ctx, args, flux) {
  const f = ctx.giac(args[0]);
  const s = ctx.giac(args[1]);
  const u = args[2] && args[2].t === 'sym' ? args[2].v : 'u';
  const [a, b] = [ctx.giac(args[3]), ctx.giac(args[4])];
  const w = args[5] && args[5].t === 'sym' ? args[5].v : 'v';
  const [c, d] = [ctx.giac(args[6]), ctx.giac(args[7])];
  const at = (expr) => `subst(${expr},[x,y,z],[(${s})[0],(${s})[1],(${s})[2]])`;
  const normal = `cross(diff(${s},${u}),diff(${s},${w}))`;
  const integrand = flux ? `dot(${at(f)},${normal})` : `(${at(f)})*sqrt(sum((${normal})[k]^2,k,0,2))`;
  const exact = ctx.exact(`integrate(integrate(${integrand},${u},${a},${b}),${w},${c},${d})`);
  const approx = ctx.number(`evalf(integrate(integrate(${integrand},${u},${a},${b}),${w},${c},${d}))`);
  return { title: flux ? 'Fluss durch die Fläche' : 'Flächenintegral', rows: [{ label: 'Wert', latex: exact && !/int/.test(exact) ? exact : fmt(approx) }, ...(Number.isFinite(approx) ? [{ label: '≈', latex: fmt(approx) }] : [])] };
}

export { toLatex };

// Practice: tasks by topic and level, with the same numbers every time a row is calculated again (the row text is
// the seed), checked by the CAS, with a hint on the usual mistakes.

const TOPICS = {
  ableiten: 'Ableiten', integrieren: 'Integrieren', gleichung: 'Gleichungen', bruch: 'Bruchrechnen', prozent: 'Prozentrechnung', binomial: 'Binomialverteilung',
};

const practice = { tasks: [] };

function hash(text) {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

function makeTask(topic, level, rand) {
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const nz = (a, b) => {
    let v = 0;
    while (!v) v = int(a, b);
    return v;
  };
  const pick = (list) => list[Math.floor(rand() * list.length)];
  switch (topic) {
    case 'ableiten': {
      const f = level === 1 ? `${nz(-5, 5)}*x^${int(2, 5)}+${nz(1, 9)}*x^${int(1, 1)}`
        : level === 2 ? pick([`x^${int(2, 3)}*sin(x)`, `(${nz(1, 4)}x+${nz(1, 5)})/(x^2+1)`, `x*exp(${nz(1, 3)}x)`])
          : pick([`sin(${nz(2, 5)}x^2+${nz(1, 4)})`, `(${nz(2, 4)}x-${nz(1, 5)})^${int(3, 6)}`, `exp(${nz(-3, 3)}x^2)`, `ln(${nz(1, 4)}x^2+1)`]);
      return { question: `f(x) = ${f}. Bestimme f′(x).`, giac: f, check: 'derivative' };
    }
    case 'integrieren': {
      if (level === 2) {
        const a = int(0, 2);
        const b = a + int(1, 3);
        const f = `${nz(1, 4)}*x^${int(1, 3)}+${nz(-5, 5)}`;
        return { question: `Berechne ∫ von ${a} bis ${b} über ${f} dx.`, giac: `integrate(${f},x,${a},${b})`, check: 'value' };
      }
      const f = level === 1 ? `${nz(1, 6)}*x^${int(2, 4)}-${nz(1, 6)}*x` : pick([`exp(${nz(2, 4)}x)`, `sin(${nz(2, 5)}x)`, `${nz(2, 6)}/x`, `cos(${nz(2, 4)}x)`]);
      return { question: `Bestimme eine Stammfunktion von f(x) = ${f}.`, giac: f, check: 'antiderivative' };
    }
    case 'gleichung': {
      if (level === 1) {
        const x = nz(-9, 9);
        const a = nz(2, 7);
        const b = nz(-9, 9);
        return { question: `Löse ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}.`, giac: `[${x}]`, check: 'set' };
      }
      if (level === 2) {
        const r1 = nz(-6, 6);
        const r2 = nz(-6, 6);
        return { question: `Löse x² ${-(r1 + r2) < 0 ? '−' : '+'} ${Math.abs(r1 + r2)}x ${r1 * r2 < 0 ? '−' : '+'} ${Math.abs(r1 * r2)} = 0.`, giac: `[${[...new Set([r1, r2])].join(',')}]`, check: 'set' };
      }
      const a = nz(2, 5);
      const c = a * int(2, 9);
      const b = nz(1, 3);
      return { question: `Löse ${a}·e^(${b}x) = ${c} (auf 3 Nachkommastellen).`, giac: `[ln(${c / a})/${b}]`, check: 'set' };
    }
    case 'bruch': {
      const fr = () => `${nz(1, 9)}/${nz(2, 9)}`;
      const expr = level === 1 ? `${fr()}+${fr()}` : level === 2 ? `${fr()}*${fr()}-${fr()}` : `(${fr()}+${fr()})/(${fr()}-${fr()})`;
      return { question: `Berechne ${expr} und kürze vollständig.`, giac: expr, check: 'exact' };
    }
    case 'prozent': {
      const p = pick([5, 12, 15, 20, 25, 30, 40, 75]);
      const G = int(4, 60) * 20;
      if (level === 1) return { question: `Wie viel sind ${p} % von ${G}?`, giac: `${p}*${G}/100`, check: 'value' };
      if (level === 2) return { question: `${p * G / 100} sind ${p} % von welchem Grundwert?`, giac: `${G}`, check: 'value' };
      const n = int(2, 10);
      return { question: `${G} € werden ${n} Jahre zu ${p / 10} % Zinseszins angelegt. Wie hoch ist das Endkapital (auf Cent)?`, giac: `${G}*(1+${p / 1000})^${n}`, check: 'value' };
    }
    default: {
      const n = pick([10, 20, 25, 50]);
      const p = pick([0.1, 0.2, 0.25, 0.3, 0.5, 0.6]);
      const k = int(1, Math.round(n * p) + 2);
      if (level === 1) return { question: `X ~ B(${n}; ${p}). Berechne P(X = ${k}) auf 4 Stellen.`, giac: `binomial(${n},${k},${p})`, check: 'value' };
      if (level === 2) return { question: `X ~ B(${n}; ${p}). Berechne P(X ≤ ${k}) auf 4 Stellen.`, giac: `binomial_cdf(${n},${p},${k})`, check: 'value' };
      const a = Math.max(0, k - 2);
      return { question: `X ~ B(${n}; ${p}). Berechne P(${a} ≤ X ≤ ${k + 3}) auf 4 Stellen.`, giac: `binomial_cdf(${n},${p},${a},${k + 3})`, check: 'value' };
    }
  }
}

/** Whether an answer fits the task, and if not a hint on what went wrong */
function checkAnswer(ctx, task, answer) {
  const raw = (t) => ctx.raw(t);
  const number = (t) => Number(raw(`evalf(${t})`));
  switch (task.check) {
    case 'derivative':
    case 'exact': {
      const expected = task.check === 'derivative' ? `diff(${task.giac},x)` : task.giac;
      if (raw(`simplify((${answer})-(${expected}))`) === '0') return { ok: true };
      if (raw(`simplify((${answer})+(${expected}))`) === '0') return { ok: false, hint: 'Das Vorzeichen stimmt nicht.' };
      const ratio = raw(`simplify((${answer})/(${expected}))`);
      if (ratio && ratio !== '0' && !/x/.test(ratio)) return { ok: false, hint: `Um den Faktor ${ratio} daneben${task.check === 'derivative' ? ' – innere Ableitung (Kettenregel) oder Faktor vergessen?' : '.'}` };
      return { ok: false, hint: task.check === 'derivative' ? 'Prüfe, welche Regel gilt: ableitungsschritte(f(x)) zeigt den Weg.' : 'Noch nicht richtig.' };
    }
    case 'antiderivative': {
      const d = raw(`simplify(diff(${answer},x)-(${task.giac}))`);
      if (d === '0') return { ok: true };
      const ratio = raw(`simplify(diff(${answer},x)/(${task.giac}))`);
      if (ratio && ratio !== '0' && !/x/.test(ratio)) return { ok: false, hint: `Abgeleitet ergibt deine Lösung das ${ratio}-fache von f – Faktor der inneren Funktion beachten.` };
      return { ok: false, hint: 'Leite deine Stammfunktion zur Probe ab: sie muss f ergeben.' };
    }
    case 'value': {
      const want = number(task.giac);
      const got = number(answer);
      if (Math.abs(got - want) <= Math.max(5e-4, Math.abs(want) * 5e-4)) return { ok: true };
      if (Math.abs(got + want) <= Math.abs(want) * 5e-4) return { ok: false, hint: 'Das Vorzeichen stimmt nicht.' };
      if (Math.abs(got * 100 - want) <= Math.abs(want) * 5e-3 || Math.abs(got - want * 100) <= Math.abs(want) * 5) return { ok: false, hint: 'Um den Faktor 100 daneben – Prozent und Dezimalzahl verwechselt?' };
      return { ok: false, hint: 'Noch nicht richtig.' };
    }
    default: {
      const want = raw(`evalf(${task.giac})`).replace(/^list/, '');
      const got = raw(`evalf(${answer.startsWith('[') ? answer : '[' + answer + ']'})`).replace(/^list/, '');
      const nums = (t) => (t.match(/-?\d+(\.\d+)?(e-?\d+)?/g) || []).map(Number).sort((a, b) => a - b);
      const [w, g] = [nums(want), nums(got)];
      if (w.length === g.length && w.every((v, i) => Math.abs(v - g[i]) < 1e-3)) return { ok: true };
      if (g.length && g.length < w.length && g.every((v) => w.some((u) => Math.abs(u - v) < 1e-3))) return { ok: false, hint: 'Es fehlt noch eine Lösung.' };
      return { ok: false, hint: 'Setze deine Lösung zur Probe in die Gleichung ein.' };
    }
  }
}

Object.assign(STAT_COMMANDS, {
  aufgabe: {
    run(ctx, args) {
      const topicWord = args[0] && (args[0].t === 'sym' ? args[0].v : args[0].t === 'str' ? args[0].v : '');
      const topic = Object.keys(TOPICS).find((t) => t === String(topicWord).toLowerCase() || TOPICS[t].toLowerCase() === String(topicWord).toLowerCase());
      if (!topic) return { title: 'Übungsaufgaben', table: { head: ['Thema', 'Aufruf'], rows: Object.entries(TOPICS).map(([k, v]) => [text(v), text(`aufgabe(${k}, Stufe 1–3, Anzahl)`)]) }, rows: [{ label: 'prüfen', latex: text('prüfe(Antwort) oder prüfe(Nummer, Antwort)') }] };
      const r = reader(ctx, args.slice(1));
      const level = Math.min(3, Math.max(1, Math.round(r.number(1))));
      const count = Math.min(10, Math.max(1, Math.round(r.number(1))));
      const variant = Math.round(r.number(0));
      const rand = STAT_RANDOM(hash(`${topic}|${level}|${count}|${variant}`));
      practice.tasks = Array.from({ length: count }, () => ({ ...makeTask(topic, level, rand), solved: false }));
      return {
        title: `${TOPICS[topic]}, Stufe ${level}`,
        table: { head: ['Nr.', 'Aufgabe'], rows: practice.tasks.map((t, i) => [String(i + 1), text(t.question)]) },
        rows: [{ label: 'antworten mit', latex: text(count > 1 ? 'prüfe(Nummer, Antwort)' : 'prüfe(Antwort)') }, { label: 'neue Zahlen', latex: text(`aufgabe(${topic}, ${level}, ${count}, ${variant + 1})`) }],
      };
    },
  },
  prüfe: {
    run(ctx, args) {
      if (!practice.tasks.length) throw new Error('Zuerst eine Aufgabe stellen: aufgabe(ableiten, 1).');
      const numbered = args.length >= 2;
      const index = numbered ? Math.round(ctx.number(ctx.giac(args[0]))) - 1 : practice.tasks.findIndex((t) => !t.solved) >= 0 ? practice.tasks.findIndex((t) => !t.solved) : 0;
      const task = practice.tasks[index];
      if (!task) throw new Error(`Eine Aufgabe ${index + 1} gibt es nicht.`);
      const answer = ctx.giac(args[numbered ? 1 : 0]);
      const verdict = checkAnswer(ctx, task, answer);
      task.solved = task.solved || verdict.ok;
      const solved = practice.tasks.filter((t) => t.solved).length;
      return { title: verdict.ok ? `Aufgabe ${index + 1}: richtig` : `Aufgabe ${index + 1}: noch nicht`, rows: [
        ...(verdict.ok ? [] : [{ label: 'Hinweis', latex: text(verdict.hint) }]),
        { label: 'Fortschritt', latex: text(`${solved} von ${practice.tasks.length} gelöst`) },
      ] };
    },
  },
});

import { random as STAT_RANDOM } from './stats.js';

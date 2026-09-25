// Runs cas.js against the real Giac build: node cas/test/cas.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const web = path.join(__dirname, '..', 'web');
global.require = require;
global.__dirname = web;
global.process = process;
vm.runInThisContext(fs.readFileSync(path.join(web, 'cas.js'), 'utf8'), { filename: 'cas.js' });

const tests = [];
function test(name, body) { tests.push({ name, body }); }

// Translation, without Giac

test('German commands become Giac commands', () => {
  assert.strictEqual(CAS.translate('löse(x^2-4=0, x)').giac, 'solve(x^2-4=0, x)');
  assert.strictEqual(CAS.translate('Ableiten(sin(x))').giac, 'diff(sin(x))');
  assert.strictEqual(CAS.translate('integriere(x^2, x, 0, 1)').giac, 'integrate(x^2, x, 0, 1)');
  assert.strictEqual(CAS.translate('grenzwert(1/x, x, unendlich)').giac, 'limit(1/x, x, inf)');
  assert.strictEqual(CAS.translate('vereinfache(x+x)').giac, 'simplify(x+x)');
  assert.strictEqual(CAS.translate('loese(x=1)').giac, 'solve(x=1)');
  assert.strictEqual(CAS.translate('mittelwert([1,2])').giac, 'mean([1,2])');
  assert.strictEqual(CAS.translate('log(100)').giac, 'log10(100)');
});

test('School symbols', () => {
  assert.strictEqual(CAS.translate('√2 · π').giac, 'sqrt(2) * pi');
  assert.strictEqual(CAS.translate('√(x+1)').giac, 'sqrt(x+1)');
  assert.strictEqual(CAS.translate('3² − 4 ÷ 2').giac, '3^2 - 4 / 2');
  assert.strictEqual(CAS.translate('x ≤ 3').giac, 'x <= 3');
});

test('faktorisiere splits whole numbers into primes', () => {
  assert.strictEqual(CAS.translate('faktorisiere(360)').giac, 'ifactor(360)');
  assert.strictEqual(CAS.translate('faktorisiere(x^2-1)').giac, 'factor(x^2-1)');
});

test('Higher derivatives, zeros and tangents', () => {
  assert.strictEqual(CAS.translate('ableiten(x^4, x, 2)').giac, 'diff(x^4,x$2)');
  assert.strictEqual(CAS.translate('nullstellen(x^2-1)').giac, 'solve((x^2-1)=0,x)');
  assert.ok(CAS.translate('tangente(x^2, 1)').giac.indexOf('normal(subst((x^2),x=(1))') === 0);
});

test('Definitions and equations', () => {
  const a = CAS.translate('a = 5');
  assert.strictEqual(a.giac, 'a:=5');
  assert.strictEqual(a.kind, 'variable');
  assert.strictEqual(CAS.translate('x = 5').kind, null);
  assert.strictEqual(CAS.translate('b := 2b').kind, 'variable');
  assert.strictEqual(CAS.translate('n = n + 1').kind, null);
  const f = CAS.translate('f(x) = x^2 + 1');
  assert.strictEqual(f.giac, 'f(x):=x^2 + 1');
  assert.strictEqual(f.kind, 'function');
  assert.strictEqual(CAS.translate('löse(x = 2)').kind, null);
  assert.strictEqual(CAS.translate('a == 5').kind, null);
});

test('Pretty output', () => {
  assert.strictEqual(CAS.pretty('2*sqrt(2)'), '2√2');
  assert.strictEqual(CAS.pretty('sqrt(x+1)/2'), '√(x+1)/2');
  assert.strictEqual(CAS.pretty('3*x^2+2*x'), '3x²+2x');
  assert.strictEqual(CAS.pretty('(x^2)'), '(x²)');
  assert.strictEqual(CAS.pretty('x^(-1)'), 'x⁻¹');
  assert.strictEqual(CAS.pretty('list[1.5,2.25]'), '[1,5; 2,25]');
  assert.strictEqual(CAS.pretty('exp(1)'), 'e');
  assert.strictEqual(CAS.pretty('pi/6'), 'π/6');
  assert.strictEqual(CAS.pretty('1.26765060023e+30'), '1,2676506·10³⁰');
  assert.strictEqual(CAS.pretty('+infinity'), '+∞');
  assert.strictEqual(CAS.pretty('x*y'), 'x·y');
});

// With Giac

test('Arithmetic, exact and rounded', () => {
  const r = CAS.evaluate('1/3 + 1/6');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.exact, '1/2');
  assert.strictEqual(r.pretty, '1/2');
  assert.strictEqual(r.prettyApprox, '0,5');
  const s = CAS.evaluate('√8');
  assert.strictEqual(s.pretty, '2√2');
  assert.strictEqual(s.prettyApprox, '2,828427125');
  const whole = CAS.evaluate('2+3');
  assert.strictEqual(whole.pretty, '5');
  assert.strictEqual(whole.prettyApprox, null);
});

test('Solving gives a solution set', () => {
  const r = CAS.evaluate('löse(x^2-5x+6=0, x)');
  assert.strictEqual(r.pretty, 'L = {2; 3}');
  const roots = CAS.evaluate('löse(x^2=2)');
  assert.strictEqual(roots.pretty, 'L = {-√2; √2}');
  assert.strictEqual(roots.prettyApprox, 'L ≈ {-1,414213562; 1,414213562}');
  assert.strictEqual(CAS.evaluate('löse(x^2=-1)').pretty, 'L = {}');
  assert.strictEqual(CAS.evaluate('nullstellen(x^3-x)').pretty, 'L = {-1; 0; 1}');
  assert.strictEqual(CAS.evaluate('löse([x+y=3, x-y=1], [x, y])').pretty, 'L = {[2; 1]}');
});

test('Calculus', () => {
  assert.strictEqual(CAS.evaluate('ableiten(x^3)').pretty, '3x²');
  assert.strictEqual(CAS.evaluate('ableiten(x^4, x, 2)').pretty, '12x²');
  assert.strictEqual(CAS.evaluate('integriere(x*exp(x), x)').pretty, '(x-1)·exp(x)');
  assert.strictEqual(CAS.evaluate('integriere(x^2, x, 0, 3)').pretty, '9');
  assert.strictEqual(CAS.evaluate('grenzwert(sin(x)/x, x, 0)').pretty, '1');
  assert.strictEqual(CAS.evaluate('grenzwert((1+1/n)^n, n, unendlich)').pretty, 'e');
  assert.strictEqual(CAS.evaluate('tangente(x^2, 1)').pretty, '2x-1');
});

test('Algebra', () => {
  assert.strictEqual(CAS.evaluate('faktorisiere(x^4-1)').pretty, '(x-1)·(x+1)·(x²+1)');
  assert.strictEqual(CAS.evaluate('faktorisiere(360)').pretty, '2³·3²·5');
  assert.strictEqual(CAS.evaluate('vereinfache((x^2-1)/(x-1))').pretty, 'x+1');
  assert.strictEqual(CAS.evaluate('ausmultiplizieren((x+1)^2)').pretty, 'x²+2x+1');
});

test('Variables and functions carry across lines', () => {
  const a = CAS.evaluate('a = 5');
  assert.strictEqual(a.pretty, 'a = 5');
  assert.strictEqual(a.assigns, 'a');
  assert.strictEqual(CAS.evaluate('a * 3').pretty, '15');
  const f = CAS.evaluate('f(x) = x^2 + 1');
  assert.strictEqual(f.pretty, 'f(x) = x²+1');
  assert.strictEqual(f.assigns, 'f');
  assert.strictEqual(CAS.evaluate('f(3)').pretty, '10');
  assert.strictEqual(CAS.evaluate('ableiten(f(x))').pretty, '2x');
  CAS.forget(['a', 'f']);
  assert.strictEqual(CAS.evaluate('a').pretty, 'a');
});

test('Matrices', () => {
  const inverse = CAS.evaluate('inverse([[1,2],[3,4]])');
  assert.deepStrictEqual(inverse.matrix, [['-2', '1'], ['3/2', '-1/2']]);
  assert.strictEqual(CAS.evaluate('det([[1,2],[3,4]])').pretty, '-2');
  assert.deepStrictEqual(CAS.evaluate('transponiere([[1,2],[3,4]])').matrix, [['1', '3'], ['2', '4']]);
  const singular = CAS.evaluate('inverse([[1,2],[2,4]])');
  assert.strictEqual(singular.ok, false);
  assert.strictEqual(singular.error, 'Die Matrix ist nicht invertierbar.');
});

test('Statistics', () => {
  assert.strictEqual(CAS.evaluate('mittelwert([1,2,3,4])').pretty, '5/2');
  assert.strictEqual(CAS.evaluate('median([1,2,3,4])').pretty, '5/2');
  assert.strictEqual(CAS.evaluate('median([5,1,3])').pretty, '3');
  assert.strictEqual(CAS.evaluate('varianz([1,2,3,4])').pretty, '5/4');
  assert.strictEqual(CAS.evaluate('standardabweichung([2,4,4,4,5,5,7,9])').pretty, '2');
});

test('Degrees and radians', () => {
  CAS.setDegrees(true);
  assert.strictEqual(CAS.evaluate('sin(30)').pretty, '1/2');
  CAS.setDegrees(false);
  assert.strictEqual(CAS.evaluate('sin(pi/6)').pretty, '1/2');
});

test('Errors are reported in German', () => {
  const syntax = CAS.evaluate('1+');
  assert.strictEqual(syntax.ok, false);
  assert.ok(/Syntaxfehler/.test(syntax.error));
  assert.strictEqual(CAS.evaluate('   ').ok, false);
  assert.strictEqual(CAS.evaluate('det([[1,2],[3,4],[5]])').ok, false);
});

test('JSON bridge', () => {
  const r = JSON.parse(CAS.evaluateJSON('2^10'));
  assert.strictEqual(r.pretty, '1024');
  const p = JSON.parse(CAS.plotJSON(JSON.stringify(['x^2-1']), -3, 3, 61));
  assert.strictEqual(p.ok, true);
  assert.strictEqual(p.curves[0].values.length, 61);
});

test('Plot: zeros, extreme points, y intercept', () => {
  const p = CAS.plot(['x^3-3x'], -3, 3, 301);
  assert.strictEqual(p.ok, true);
  const xs = p.roots.map(r => r.x).sort((a, b) => a - b);
  assert.deepStrictEqual(xs, [-1.7321, 0, 1.7321]);
  const max = p.extrema.find(e => e.kind === 'max');
  const min = p.extrema.find(e => e.kind === 'min');
  assert.deepStrictEqual([max.x, max.y], [-1, 2]);
  assert.deepStrictEqual([min.x, min.y], [1, -2]);
  assert.deepStrictEqual(p.intercepts.map(i => i.y), [0]);
  assert.ok(p.ymin < -2 && p.ymax > 2);
});

test('Plot: a zero that only touches the axis', () => {
  const p = CAS.plot(['(x-1)^2'], -2, 4, 301);
  assert.deepStrictEqual(p.roots.map(r => r.x), [1]);
  assert.deepStrictEqual(p.extrema.map(e => [e.x, e.y, e.kind]), [[1, 0, 'min']]);
});

test('Plot: intersections and definitions', () => {
  const p = CAS.plot(['f(x) = x^2', 'y = x + 2'], -4, 4, 401);
  assert.strictEqual(p.curves[0].label, 'f(x)');
  const points = p.intersections.map(i => [i.x, i.y]).sort((a, b) => a[0] - b[0]);
  assert.deepStrictEqual(points, [[-1, 1], [2, 4]]);
});

test('Plot: poles are not zeros', () => {
  const p = CAS.plot(['1/x'], -2, 2, 400);
  assert.strictEqual(p.roots.length, 0);
  assert.ok(p.curves[0].values.some(v => v === null) || p.ymax < 1e6);
});

test('Plot: trigonometric zeros', () => {
  const p = CAS.plot(['sin(x)'], 0.5, 10, 400);
  assert.deepStrictEqual(p.roots.map(r => r.x), [3.1416, 6.2832, 9.4248]);
  assert.strictEqual(p.extrema.length, 3);
});

test('Plot: errors', () => {
  assert.strictEqual(CAS.plot([''], -1, 1).ok, false);
  assert.strictEqual(CAS.plot(['x'], 1, -1).ok, false);
});

const withoutGiac = tests.filter(t => !/Arithmetic|Solving|Calculus|Algebra|Variables|Matrices|Statistics|Degrees|Errors|JSON|Plot/.test(t.name));
let failed = 0;
function runAll(list) {
  for (const t of list) {
    try {
      t.body();
      console.log('ok   ' + t.name);
    } catch (e) {
      failed++;
      console.log('FAIL ' + t.name + '\n     ' + String(e.message).split('\n').join('\n     '));
    }
  }
}

runAll(withoutGiac);
const started = Date.now();
global.Module = {
  print: line => CAS.captured(line),
  printErr: line => CAS.captured(line),
  onRuntimeInitialized() {
    CAS.init(Module.cwrap('caseval', 'string', ['string']));
    console.log('Giac ready in ' + (Date.now() - started) + ' ms');
    runAll(tests.filter(t => withoutGiac.indexOf(t) < 0));
    console.log(failed ? failed + ' failed' : 'all ' + tests.length + ' passed');
    process.exit(failed ? 1 : 0);
  },
};
vm.runInThisContext(fs.readFileSync(path.join(web, 'giacwasm.js'), 'utf8'), { filename: 'giacwasm.js' });

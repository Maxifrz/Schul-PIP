import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlain, parseLatex, toGiac, toLatex, compile, symbols } from '../src/expr.js';

const giacOf = (latex, options) => toGiac(parseLatex(latex, options));
const latexOf = (plain) => toLatex(parsePlain(plain));

test('plain text round trip through Giac syntax', () => {
  assert.equal(toGiac(parsePlain('1/2*x^2+3*x-1/6')), '1/2*x^2+3*x-1/6');
  assert.equal(toGiac(parsePlain('2x(x+1)', { isFunction: () => false })), '2*x*(x+1)');
  assert.equal(toGiac(parsePlain('-(x+1)^2')), '-(x+1)^2');
  assert.equal(toGiac(parsePlain('a-(b-c)')), 'a-(b-c)');
  assert.equal(toGiac(parsePlain('2^3^2')), '2^(3^2)');
  assert.equal(toGiac(parsePlain('list[1,2,3]')), '[1,2,3]');
  assert.equal(toGiac(parsePlain('x<=2')), 'x<=2');
  assert.equal(toGiac(parsePlain('5!')), '5!');
});

test('LaTeX from the formula editor becomes Giac input', () => {
  assert.equal(giacOf('\\frac{1}{2}x^2+3x'), '1/2*x^2+3*x');
  assert.equal(giacOf('\\sqrt{x+1}'), 'sqrt(x+1)');
  assert.equal(giacOf('\\sqrt[3]{8}'), 'nthroot(8,3)');
  assert.equal(giacOf('\\sin\\left(x\\right)+\\cos x'), 'sin(x)+cos(x)');
  assert.equal(giacOf('2\\pi r'), '2*pi*r');
  assert.equal(giacOf('x\\le2'), 'x<=2');
  assert.equal(giacOf('\\left|x-1\\right|'), 'abs(x-1)');
  assert.equal(giacOf('e^{2x}'), 'e^(2*x)');
  assert.equal(giacOf('3{,}5\\cdot2'), '3.5*2');
  assert.equal(giacOf('\\int_0^1x^2\\,dx'), 'integrate(x^2,x,0,1)');
  assert.equal(giacOf('\\int x\\cdot e^x\\mathrm{d}x'), 'integrate(x*e^x,x)');
  assert.equal(giacOf('\\sum_{k=1}^{n}k^2'), 'sum(k^2,k,1,n)');
  assert.equal(giacOf('\\lim_{x\\to\\infty}\\frac{1}{x}'), 'limit(1/x,x,inf)');
  assert.equal(giacOf('\\lim_{x\\to0^{+}}\\frac{1}{x}'), 'limit(1/x,x,0,1)');
  assert.equal(giacOf('\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}'), '[[1,2],[3,4]]');
  assert.equal(giacOf('\\begin{pmatrix}1\\\\2\\\\3\\end{pmatrix}'), '[1,2,3]');
  assert.equal(giacOf('\\binom{5}{2}'), 'comb(5,2)');
  assert.equal(giacOf('5!'), '5!');
  assert.equal(giacOf('30^{\\circ}'), '30*pi/180');
  assert.equal(giacOf('20\\%\\cdot150'), '20/100*150');
});

test('letters typed one by one become known words', () => {
  const options = { names: ['loese', 'nullstellen', 'f'], isFunction: (n) => ['loese', 'nullstellen', 'f', 'sin'].includes(n) };
  assert.equal(giacOf('loese\\left(x^2=4,x\\right)', options), 'loese(x^2=4,x)');
  assert.equal(giacOf('nullstellen(x^3-x)', options), 'nullstellen(x^3-x)');
  assert.equal(giacOf('f(3)', options), 'f(3)');
  assert.equal(giacOf('x(x+1)', options), 'x*(x+1)');
  assert.equal(giacOf('ab', options), 'a*b');
  assert.equal(giacOf('\\operatorname{ableiten}\\left(x^2\\right)', { isFunction: () => true }), 'ableiten(x^2)');
});

test('definitions and derivatives', () => {
  assert.equal(giacOf('f\\left(x\\right)=x^2', { names: ['f'], isFunction: (n) => n === 'f' }), 'f(x)=x^2');
  assert.equal(giacOf("f'(2)", { names: ['f'], isFunction: (n) => n === 'f' }), '(diff(f(x),x))|(x=2)');
  assert.equal(giacOf("f''(x)", { names: ['f'], isFunction: (n) => n === 'f' }), '(diff(diff(f(x),x),x))|(x=x)');
});

test('Giac answers in school notation', () => {
  assert.equal(latexOf('1/2*x^2+3*x+(-1)/6'), '\\frac{1}{2}x^{2}+3x-\\frac{1}{6}');
  assert.equal(latexOf('pi*8'), '8\\pi');
  assert.equal(latexOf('2*sqrt(3)'), '2\\sqrt{3}');
  assert.equal(latexOf('sqrt(2)/2'), '\\frac{\\sqrt{2}}{2}');
  assert.equal(latexOf('(x-1)*exp(x)'), '\\left(x-1\\right)e^{x}');
  assert.equal(latexOf('exp(1)'), 'e');
  assert.equal(latexOf('3.14159'), '3{,}14159');
  assert.equal(latexOf('6.6743e-11'), '6{,}6743\\cdot 10^{-11}');
  assert.equal(latexOf('abs(x-1)'), '\\left|x-1\\right|');
  assert.equal(latexOf('[[1,2],[3,4]]'), '\\begin{pmatrix}1 & 2\\\\3 & 4\\end{pmatrix}');
  assert.equal(latexOf('list[1,2]'), '\\left[1;\\ 2\\right]');
  assert.equal(latexOf('x-(x+1)'), 'x-\\left(x+1\\right)');
  assert.equal(latexOf('-x/y'), '-\\frac{x}{y}');
  assert.equal(latexOf('sin(x)^2'), '\\sin^{2}\\left(x\\right)');
  assert.equal(latexOf('2*x*y'), '2x\\,y');
  assert.equal(latexOf('ln(x)'), '\\ln\\left(x\\right)');
  assert.equal(latexOf('infinity'), '\\infty');
});

test('compiled functions for plotting', () => {
  const f = compile(parsePlain('x^2-3*x+sin(pi*x)'));
  assert.ok(Math.abs(f(2) - (4 - 6 + Math.sin(2 * Math.PI))) < 1e-12);
  const scope = { value: (name) => ({ a: 3 })[name] };
  assert.equal(compile(parsePlain('a*x'), ['x'], scope)(2), 6);
  assert.equal(compile(parsePlain('x^(1/3)'))(-8), -2);
  const g = compile(parsePlain('x^2+y^2'), ['x', 'y']);
  assert.equal(g(3, 4), 25);
  assert.deepEqual([...symbols(parsePlain('a*x+f(b)'), ['x'])].sort(), ['a', 'b', 'f']);
});

test('nested names from the formula editor', () => {
  assert.equal(giacOf('\\operatorname{\\mathrm{löse}}\\left(x^2=4,x\\right)', { isFunction: () => true }), 'löse(x^2=4,x)');
});

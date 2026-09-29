import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sampleFunction, contour, roots, specialPoints, niceStep, piLabel, tickLabel, coordinate } from '../src/graph/plot.js';
import { roundTo, sliderSettings } from '../src/graph/sliders.js';

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test('Graphs break at poles and where they are undefined', () => {
  const hyperbola = sampleFunction((x) => 1 / x, -2, 2, 400, 10);
  assert.equal(hyperbola.length, 2);
  const root = sampleFunction(Math.sqrt, -2, 2, 400, 10);
  assert.equal(root.length, 1);
  near(root[0][0][0], 0, 1e-6);
  assert.equal(sampleFunction((x) => x * x, -2, 2, 100, 10).length, 1);
});

test('Zeros, extreme and inflection points', () => {
  const f = (x) => x ** 3 - 3 * x;
  near(roots(f, -3, 3)[0], -Math.sqrt(3));
  assert.equal(roots((x) => 1 / x, -1, 1.3).length, 0);
  const points = specialPoints(f, (x) => 3 * x * x - 3, (x) => 6 * x, -3, 3);
  const H = points.find((p) => p.kind === 'H');
  const T = points.find((p) => p.kind === 'T');
  near(H.x, -1);
  near(H.y, 2);
  near(T.x, 1);
  assert.ok(points.some((p) => p.kind === 'W' && Math.abs(p.x) < 1e-6));
  assert.equal(points.filter((p) => p.kind === 'N').length, 3);
  // A zero that only touches: x^2 at 0
  assert.ok(specialPoints((x) => x * x, null, null, -2, 2.1).some((p) => p.kind === 'N' && Math.abs(p.x) < 1e-4));
  // Saddle point of x^3
  assert.ok(specialPoints((x) => x ** 3, (x) => 3 * x * x, (x) => 6 * x, -2, 2.1).some((p) => p.kind === 'S'));
  const cut = specialPoints((x) => x, null, null, -3, 3.1, [{ f: (x) => 2 - x, name: 'g' }]).find((p) => p.kind === 'X');
  near(cut.x, 1);
});

test('Implicit curves: a circle, and no line along a pole', () => {
  const circle = contour((x, y) => x * x + y * y - 4, -3, 3, -3, 3, 60, 60);
  assert.ok(circle.length > 40);
  for (const [a] of circle) near(Math.hypot(a[0], a[1]), 2, 0.05);
  const tangent = contour((x, y) => y - Math.tan(x), -3, 3, -3, 3, 80, 80);
  for (const [a] of tangent) assert.ok(Math.abs(Math.cos(a[0])) > 0.05);
});

test('Ticks and numbers the school way', () => {
  assert.equal(niceStep(10, 10), 1);
  assert.equal(niceStep(7, 10), 0.5);
  assert.equal(niceStep(0.3, 10), 0.02);
  assert.equal(piLabel(Math.PI / 2), 'π/2');
  assert.equal(piLabel(-3 * Math.PI / 4), '−3π/4');
  assert.equal(piLabel(2 * Math.PI), '2π');
  assert.equal(tickLabel(-2.5, 0.5), '−2,5');
  assert.equal(coordinate(1.23456), '1,23');
  assert.equal(coordinate(-0.0001), '0');
});

test('Sliders round to their step and fit their value', () => {
  assert.equal(roundTo(2.34567, 0.1), 2.3);
  assert.equal(roundTo(2.37, 0.05), 2.35);
  const row = { graph: {} };
  assert.deepEqual([sliderSettings(row, 2).min, sliderSettings(row, 2).max], [-5, 5]);
  const big = sliderSettings(row, 30);
  assert.ok(big.max >= 30 && big.min === 0);
});

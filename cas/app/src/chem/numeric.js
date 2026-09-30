// Small numerical tools of the chemistry engine: a dense linear solver, bracketing root finders and a straight-line
// fit. Everything is plain double precision; results are rounded only when shown.

import { fail } from './errors.js';

/** Solves A·x = b by Gaussian elimination with partial pivoting (A square, numbers) */
export function solveLinearFloat(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-300) fail('CHEM_NO_SOLUTION', 'Das Gleichungssystem ist singulär.');
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** A root of f in [a, b] where f(a) and f(b) have opposite signs (bisection to machine precision) */
export function bisect(f, a, b, maxIterations = 400) {
  let fa = f(a);
  const fb = f(b);
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) fail('CHEM_NO_SOLUTION', 'Im angegebenen Bereich gibt es keinen Vorzeichenwechsel.');
  for (let i = 0; i < maxIterations; i++) {
    const mid = (a + b) / 2;
    if (mid === a || mid === b) break;
    const fm = f(mid);
    if (fm === 0) return mid;
    if (Math.sign(fm) === Math.sign(fa)) {
      a = mid;
      fa = fm;
    } else b = mid;
  }
  return (a + b) / 2;
}

/** Least-squares line y = a + b·x: { a, b, r2 } */
export function linearFit(xs, ys) {
  const n = xs.length;
  if (n < 2) fail('CHEM_NO_SOLUTION', 'Für eine Ausgleichsgerade braucht man mindestens zwei Messwerte.');
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) fail('CHEM_NO_SOLUTION', 'Alle x-Werte sind gleich.');
  const b = sxy / sxx;
  const a = my - b * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { a, b, r2 };
}

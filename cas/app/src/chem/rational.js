// Exact rational numbers on BigInt and the linear algebra the balancing and Hess's law need: reduced row echelon
// form, null space, solving linear systems. Nothing here uses floating point, so a balanced equation is exact.

const abs = (a) => (a < 0n ? -a : a);
const gcd = (a, b) => {
  a = abs(a);
  b = abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const lcm = (a, b) => (a === 0n || b === 0n ? 0n : abs(a * b) / gcd(a, b));

export class Frac {
  constructor(n, d = 1n) {
    n = BigInt(n);
    d = BigInt(d);
    if (d === 0n) throw new RangeError('division by zero');
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }

  static of(x) {
    if (x instanceof Frac) return x;
    if (typeof x === 'bigint') return new Frac(x);
    if (Number.isInteger(x)) return new Frac(BigInt(x));
    // a decimal such as 0.5 or 2.25 (number or text): exact through its decimal digits
    const text = String(x).trim();
    const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);
    if (!m) throw new RangeError(`not a rational number: ${x}`);
    const decimals = m[3] || '';
    return new Frac(BigInt(m[1] + m[2] + decimals), 10n ** BigInt(decimals.length));
  }

  add(o) {
    o = Frac.of(o);
    return new Frac(this.n * o.d + o.n * this.d, this.d * o.d);
  }

  sub(o) {
    o = Frac.of(o);
    return new Frac(this.n * o.d - o.n * this.d, this.d * o.d);
  }

  mul(o) {
    o = Frac.of(o);
    return new Frac(this.n * o.n, this.d * o.d);
  }

  div(o) {
    o = Frac.of(o);
    return new Frac(this.n * o.d, this.d * o.n);
  }

  neg() {
    return new Frac(-this.n, this.d);
  }

  get isZero() {
    return this.n === 0n;
  }

  get isInteger() {
    return this.d === 1n;
  }

  get sign() {
    return this.n === 0n ? 0 : this.n > 0n ? 1 : -1;
  }

  equals(o) {
    o = Frac.of(o);
    return this.n === o.n && this.d === o.d;
  }

  toNumber() {
    return Number(this.n) / Number(this.d);
  }

  toString() {
    return this.d === 1n ? String(this.n) : `${this.n}/${this.d}`;
  }

  toLatex() {
    if (this.d === 1n) return String(this.n);
    return `${this.n < 0n ? '-' : ''}\\frac{${abs(this.n)}}{${this.d}}`;
  }
}

export const ZERO = new Frac(0n);
export const ONE = new Frac(1n);

/** A matrix of numbers or Fracs → matrix of Fracs */
export const toFracs = (rows) => rows.map((r) => r.map((x) => Frac.of(x)));

/**
 * Reduced row echelon form. Returns { rows, pivots } where `pivots[i]` is the column of row i's leading 1.
 */
export function rref(matrix) {
  const rows = toFracs(matrix).map((r) => r.slice());
  const cols = rows.length ? rows[0].length : 0;
  const pivots = [];
  let r = 0;
  for (let c = 0; c < cols && r < rows.length; c++) {
    let p = r;
    while (p < rows.length && rows[p][c].isZero) p++;
    if (p === rows.length) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    const lead = rows[r][c];
    rows[r] = rows[r].map((x) => x.div(lead));
    for (let i = 0; i < rows.length; i++) {
      if (i === r || rows[i][c].isZero) continue;
      const f = rows[i][c];
      rows[i] = rows[i].map((x, j) => x.sub(f.mul(rows[r][j])));
    }
    pivots.push(c);
    r++;
  }
  return { rows, pivots };
}

/** A basis of the null space of a matrix (vectors x with A·x = 0), each as an array of Fracs */
export function nullspace(matrix) {
  const cols = matrix.length ? matrix[0].length : 0;
  const { rows, pivots } = rref(matrix);
  const free = [];
  for (let c = 0; c < cols; c++) if (!pivots.includes(c)) free.push(c);
  return free.map((f) => {
    const v = Array.from({ length: cols }, () => ZERO);
    v[f] = ONE;
    pivots.forEach((pc, i) => {
      v[pc] = rows[i][f].neg();
    });
    return v;
  });
}

/** The vector scaled to the smallest integers with the same direction (all Fracs → BigInt) */
export function toIntegers(vector) {
  const fr = vector.map((x) => Frac.of(x));
  let l = 1n;
  for (const x of fr) l = lcm(l, x.d);
  const ints = fr.map((x) => (x.n * l) / x.d);
  let g = 0n;
  for (const x of ints) g = gcd(g, x);
  return g === 0n ? ints : ints.map((x) => x / g);
}

/**
 * Solves A·x = b exactly. Returns { kind: 'unique', x } | { kind: 'none' } | { kind: 'many', x (a particular solution),
 * basis (null space) }.
 */
export function solveLinear(A, b) {
  const aug = toFracs(A).map((row, i) => [...row, Frac.of(b[i])]);
  const cols = A.length ? A[0].length : 0;
  const { rows, pivots } = rref(aug);
  if (pivots.includes(cols)) return { kind: 'none' };
  const x = Array.from({ length: cols }, () => ZERO);
  pivots.forEach((pc, i) => {
    x[pc] = rows[i][cols];
  });
  if (pivots.length === cols) return { kind: 'unique', x };
  return { kind: 'many', x, basis: nullspace(A) };
}

/** Rank of a matrix */
export const rank = (matrix) => rref(matrix).pivots.length;

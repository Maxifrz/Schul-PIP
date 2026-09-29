// Statistics and probability in plain JavaScript: school definitions of quartiles and quantiles, frequency tables,
// the usual distributions with their inverses, regressions with residuals and R², hypothesis tests, confidence
// intervals and seeded simulations. Everything here is numeric; the CAS stays exact for everything else.

// Special functions

const LANCZOS = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];

export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += LANCZOS[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/** ln C(n, k) */
export function logChoose(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);
}

/** Regularized lower incomplete gamma P(a, x) */
export function gammaP(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) {
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-16) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  return 1 - gammaQcf(a, x);
}

function gammaQcf(a, x) {
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

/** Regularized incomplete beta I_x(a, b) */
export function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (front * betaCf(x, a, b)) / a;
  return 1 - (front * betaCf(1 - x, b, a)) / b;
}

function betaCf(x, a, b) {
  const tiny = 1e-300;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m < 1000; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return h;
}

export function erf(x) {
  const p = gammaP(0.5, x * x);
  return x < 0 ? -p : p;
}

/** Φ(z) */
export function phi(z) {
  if (z < -8) return 0;
  if (z > 8) return 1;
  // For z < 0 the lower tail comes straight from the continued fraction, without cancellation.
  if (z < 0) return z * z / 2 < 1.5 ? 0.5 * (1 - erf(-z / Math.SQRT2)) : 0.5 * gammaQcf(0.5, (z * z) / 2);
  return 1 - phi(-z);
}

/** Φ⁻¹(p): Acklam's rational approximation, polished with one Halley step. */
export function phiInverse(p) {
  if (!(p > 0 && p < 1)) return p === 0 ? -Infinity : p === 1 ? Infinity : NaN;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= 1 - 0.02425) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const e = phi(x) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** The x with F(x) = p for an increasing F, by bisection */
function invert(F, p, low, high) {
  while (F(low) > p) low = low * 2 - Math.abs(high);
  while (F(high) < p) high = high * 2 + Math.abs(low) + 1;
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (F(mid) < p) low = mid;
    else high = mid;
    if (high - low < 1e-13 * Math.max(1, Math.abs(mid))) break;
  }
  return (low + high) / 2;
}

// Distributions: each with its values, P(X = k) or density, P(X ≤ x), expectation and variance

const discrete = (pdf, support) => ({
  discrete: true,
  pdf,
  support,
  cdf(x) {
    const [low, high] = support;
    let sum = 0;
    const top = Math.min(Math.floor(x + 1e-9), high);
    for (let k = low; k <= top; k++) sum += pdf(k);
    return Math.min(1, sum);
  },
  /** The smallest k with P(X ≤ k) ≥ p */
  quantile(p) {
    const [low, high] = support;
    let sum = 0;
    for (let k = low; k <= Math.min(high, low + 1e7); k++) {
      sum += pdf(k);
      if (sum >= p - 1e-12) return k;
    }
    return high;
  },
});

export const DISTRIBUTIONS = {
  binomial: {
    label: 'Binomialverteilung', params: ['n', 'p'],
    make([n, p]) {
      n = Math.round(n);
      if (!(n >= 0) || !(p >= 0 && p <= 1)) throw new Error('Binomialverteilung: n ≥ 0 und 0 ≤ p ≤ 1.');
      const pdf = (k) => {
        if (k < 0 || k > n || k !== Math.round(k)) return 0;
        if (p === 0) return k === 0 ? 1 : 0;
        if (p === 1) return k === n ? 1 : 0;
        return Math.exp(logChoose(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
      };
      return { ...discrete(pdf, [0, n]), mean: n * p, variance: n * p * (1 - p), name: `B(${n}; ${p})` };
    },
  },
  poisson: {
    label: 'Poissonverteilung', params: ['λ'],
    make([lambda]) {
      if (!(lambda > 0)) throw new Error('Poissonverteilung: λ > 0.');
      const pdf = (k) => (k < 0 || k !== Math.round(k) ? 0 : Math.exp(k * Math.log(lambda) - lambda - lgamma(k + 1)));
      const high = Math.ceil(lambda + 12 * Math.sqrt(lambda) + 20);
      return { ...discrete(pdf, [0, high]), mean: lambda, variance: lambda, name: `Po(${lambda})` };
    },
  },
  geometrisch: {
    label: 'Geometrische Verteilung (erster Treffer im k-ten Versuch)', params: ['p'],
    make([p]) {
      if (!(p > 0 && p <= 1)) throw new Error('Geometrische Verteilung: 0 < p ≤ 1.');
      const pdf = (k) => (k < 1 || k !== Math.round(k) ? 0 : Math.pow(1 - p, k - 1) * p);
      const high = p === 1 ? 1 : Math.ceil(Math.log(1e-12) / Math.log(1 - p)) + 1;
      return { ...discrete(pdf, [1, high]), mean: 1 / p, variance: (1 - p) / (p * p), name: `Geo(${p})` };
    },
  },
  hypergeometrisch: {
    label: 'Hypergeometrische Verteilung', params: ['N', 'M', 'n'],
    make([N, M, n]) {
      [N, M, n] = [N, M, n].map(Math.round);
      if (!(N >= 1 && M >= 0 && M <= N && n >= 0 && n <= N)) throw new Error('Hypergeometrische Verteilung: 0 ≤ M ≤ N und 0 ≤ n ≤ N.');
      const pdf = (k) => (k !== Math.round(k) ? 0 : Math.exp(logChoose(M, k) + logChoose(N - M, n - k) - logChoose(N, n)));
      const mean = (n * M) / N;
      const variance = N > 1 ? (n * (M / N) * (1 - M / N) * (N - n)) / (N - 1) : 0;
      return { ...discrete(pdf, [Math.max(0, n - (N - M)), Math.min(n, M)]), mean, variance, name: `H(${N}; ${M}; ${n})` };
    },
  },
  gleich: {
    label: 'Gleichverteilung auf {a, …, b}', params: ['a', 'b'],
    make([a, b]) {
      [a, b] = [a, b].map(Math.round);
      if (!(b >= a)) throw new Error('Gleichverteilung: a ≤ b.');
      const m = b - a + 1;
      const pdf = (k) => (k >= a && k <= b && k === Math.round(k) ? 1 / m : 0);
      return { ...discrete(pdf, [a, b]), mean: (a + b) / 2, variance: (m * m - 1) / 12, name: `U(${a}; ${b})` };
    },
  },
  normal: {
    label: 'Normalverteilung', params: ['μ', 'σ'],
    make([mu, sigma]) {
      if (!(sigma > 0)) throw new Error('Normalverteilung: σ > 0.');
      return {
        discrete: false,
        pdf: (x) => Math.exp(-((x - mu) ** 2) / (2 * sigma * sigma)) / (sigma * Math.sqrt(2 * Math.PI)),
        cdf: (x) => phi((x - mu) / sigma),
        quantile: (p) => mu + sigma * phiInverse(p),
        range: [mu - 4 * sigma, mu + 4 * sigma],
        mean: mu, variance: sigma * sigma, name: `N(${mu}; ${sigma}²)`,
      };
    },
  },
  exponential: {
    label: 'Exponentialverteilung', params: ['λ'],
    make([lambda]) {
      if (!(lambda > 0)) throw new Error('Exponentialverteilung: λ > 0.');
      return {
        discrete: false,
        pdf: (x) => (x < 0 ? 0 : lambda * Math.exp(-lambda * x)),
        cdf: (x) => (x < 0 ? 0 : 1 - Math.exp(-lambda * x)),
        quantile: (p) => -Math.log(1 - p) / lambda,
        range: [0, 6 / lambda],
        mean: 1 / lambda, variance: 1 / (lambda * lambda), name: `Exp(${lambda})`,
      };
    },
  },
  stetiggleich: {
    label: 'Stetige Gleichverteilung auf [a; b]', params: ['a', 'b'],
    make([a, b]) {
      if (!(b > a)) throw new Error('Gleichverteilung: a < b.');
      return {
        discrete: false,
        pdf: (x) => (x >= a && x <= b ? 1 / (b - a) : 0),
        cdf: (x) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a)),
        quantile: (p) => a + p * (b - a),
        range: [a - (b - a) * 0.2, b + (b - a) * 0.2],
        mean: (a + b) / 2, variance: ((b - a) ** 2) / 12, name: `U([${a}; ${b}])`,
      };
    },
  },
  t: {
    label: 't-Verteilung', params: ['Freiheitsgrade'],
    make([df]) {
      if (!(df > 0)) throw new Error('t-Verteilung: Freiheitsgrade > 0.');
      const cdf = (x) => tCdf(df, x);
      return {
        discrete: false,
        pdf: (x) => Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2) - 0.5 * Math.log(df * Math.PI) - ((df + 1) / 2) * Math.log(1 + (x * x) / df)),
        cdf,
        quantile: (p) => invert(cdf, p, -10, 10),
        range: [-5, 5],
        mean: df > 1 ? 0 : NaN, variance: df > 2 ? df / (df - 2) : NaN, name: `t(${df})`,
      };
    },
  },
  chi2: {
    label: 'χ²-Verteilung', params: ['Freiheitsgrade'],
    make([df]) {
      if (!(df > 0)) throw new Error('χ²-Verteilung: Freiheitsgrade > 0.');
      const cdf = (x) => chi2Cdf(df, x);
      return {
        discrete: false,
        pdf: (x) => (x <= 0 ? 0 : Math.exp((df / 2 - 1) * Math.log(x) - x / 2 - (df / 2) * Math.LN2 - lgamma(df / 2))),
        cdf,
        quantile: (p) => invert(cdf, p, 0, df + 10),
        range: [0, df + 5 * Math.sqrt(2 * df)],
        mean: df, variance: 2 * df, name: `χ²(${df})`,
      };
    },
  },
};

export const DISTRIBUTION_ALIASES = {
  binomial: 'binomial', bin: 'binomial', b: 'binomial', binomialverteilung: 'binomial',
  poisson: 'poisson', po: 'poisson',
  geometrisch: 'geometrisch', geometric: 'geometrisch', geo: 'geometrisch',
  hypergeometrisch: 'hypergeometrisch', hypergeometric: 'hypergeometrisch', hyper: 'hypergeometrisch',
  gleich: 'gleich', gleichverteilung: 'gleich', laplace: 'gleich', uniform: 'gleich',
  normal: 'normal', normalverteilung: 'normal', gauss: 'normal', gauß: 'normal', n: 'normal',
  exponential: 'exponential', exponentiell: 'exponential', exp: 'exponential',
  stetiggleich: 'stetiggleich', rechteck: 'stetiggleich',
  t: 't', student: 't', chi2: 'chi2', chiquadrat: 'chi2',
};

export function distribution(name, params) {
  const key = DISTRIBUTION_ALIASES[String(name).toLowerCase()];
  if (!key) throw new Error(`Unbekannte Verteilung „${name}“. Möglich: ${Object.keys(DISTRIBUTIONS).join(', ')}.`);
  const spec = DISTRIBUTIONS[key];
  if (params.length < spec.params.length) throw new Error(`${spec.label} braucht ${spec.params.join(', ')}.`);
  return { key, label: spec.label, ...spec.make(params) };
}

export function tCdf(df, x) {
  const tail = 0.5 * betaI(df / (df + x * x), df / 2, 0.5);
  return x >= 0 ? 1 - tail : tail;
}

export function chi2Cdf(df, x) {
  return x <= 0 ? 0 : gammaP(df / 2, x / 2);
}

/** P(a ≤ X ≤ b); for discrete X with whole a, b both ends count. */
export function probability(dist, a, b) {
  const low = a === undefined || a === null ? -Infinity : a;
  const high = b === undefined || b === null ? Infinity : b;
  if (dist.discrete) {
    const [s0, s1] = dist.support;
    let sum = 0;
    for (let k = Math.max(s0, Math.ceil(low - 1e-9)); k <= Math.min(s1, Math.floor(high + 1e-9)); k++) sum += dist.pdf(k);
    return Math.min(1, sum);
  }
  return Math.max(0, (high === Infinity ? 1 : dist.cdf(high)) - (low === -Infinity ? 0 : dist.cdf(low)));
}

/** The values with P(X = k) worth listing, for tables and bar charts */
export function listed(dist, limit = 400) {
  const [s0, s1] = dist.support;
  const out = [];
  for (let k = s0; k <= s1 && out.length < limit; k++) {
    const p = dist.pdf(k);
    if (p >= 1e-9 || (k - s0 < 3 && s1 - s0 < 40)) out.push([k, p]);
    else if (out.length && k > dist.mean) break;
  }
  return out;
}

// Describing data

export function sorted(data) {
  return [...data].sort((a, b) => a - b);
}

export function mean(data) {
  return data.reduce((s, x) => s + x, 0) / data.length;
}

/** The school median: the middle value, or the mean of the two middle ones */
export function median(data) {
  const s = sorted(data);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/** The school p-quantile: k = n·p; whole k: mean of the k-th and (k+1)-th value, else the ⌈k⌉-th value */
export function quantile(data, p) {
  const s = sorted(data);
  const n = s.length;
  const k = n * p;
  if (Math.abs(k - Math.round(k)) < 1e-12) {
    const r = Math.round(k);
    if (r <= 0) return s[0];
    if (r >= n) return s[n - 1];
    return (s[r - 1] + s[r]) / 2;
  }
  return s[Math.ceil(k) - 1];
}

export function variance(data, sample = false) {
  const m = mean(data);
  const sum = data.reduce((s, x) => s + (x - m) ** 2, 0);
  return sum / (data.length - (sample ? 1 : 0));
}

export function modes(data) {
  const counts = frequencies(data);
  const best = Math.max(...counts.map((c) => c.count));
  return best > 1 || counts.length === 1 ? counts.filter((c) => c.count === best).map((c) => c.value) : [];
}

/** Every value with its absolute, relative and cumulative frequency */
export function frequencies(data) {
  const map = new Map();
  for (const x of data) map.set(x, (map.get(x) || 0) + 1);
  const n = data.length;
  let cumulative = 0;
  return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([value, count]) => {
    cumulative += count;
    return { value, count, relative: count / n, cumulative: cumulative / n };
  });
}

/** Classes [a; a + w[ from `start`, for histograms */
export function classes(data, width, start) {
  if (!(width > 0)) throw new Error('Die Klassenbreite muss positiv sein.');
  const s = sorted(data);
  const from = start ?? Math.floor(s[0] / width) * width;
  const out = [];
  for (let a = from; a <= s[s.length - 1] + 1e-9 || !out.length; a += width) {
    const b = a + width;
    const last = b > s[s.length - 1] + 1e-9;
    const count = s.filter((x) => x >= a - 1e-9 && (x < b - 1e-9 || (last && x <= b + 1e-9))).length;
    out.push({ from: a, to: b, count, relative: count / s.length });
    if (last || out.length > 500) break;
  }
  return out;
}

export function summary(data) {
  if (!data.length) throw new Error('Die Liste ist leer.');
  const s = sorted(data);
  const n = s.length;
  const m = mean(s);
  const out = {
    n, mean: m, median: median(s), modes: modes(s), min: s[0], max: s[n - 1], range: s[n - 1] - s[0],
    q1: quantile(s, 0.25), q3: quantile(s, 0.75), sum: s.reduce((a, x) => a + x, 0),
    variance: variance(s), sd: Math.sqrt(variance(s)),
  };
  out.iqr = out.q3 - out.q1;
  if (n > 1) {
    out.sampleVariance = variance(s, true);
    out.sampleSd = Math.sqrt(out.sampleVariance);
    out.standardError = out.sampleSd / Math.sqrt(n);
  }
  return out;
}

export function covariance(x, y) {
  const mx = mean(x);
  const my = mean(y);
  return x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0) / x.length;
}

export function correlation(x, y) {
  return covariance(x, y) / Math.sqrt(variance(x) * variance(y));
}

// Regression

/** Least squares for y ≈ Σ cⱼ·fⱼ(x), by the normal equations with pivoting */
function leastSquares(x, y, basis) {
  const m = basis.length;
  const A = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  for (let i = 0; i < x.length; i++) {
    const f = basis.map((b) => b(x[i]));
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < m; c++) A[r][c] += f[r] * f[c];
      A[r][m] += f[r] * y[i];
    }
  }
  for (let col = 0; col < m; col++) {
    let pivot = col;
    for (let r = col + 1; r < m; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    if (Math.abs(A[col][col]) < 1e-300) throw new Error('Zu wenige verschiedene x-Werte für dieses Modell.');
    for (let r = 0; r < m; r++) {
      if (r === col) continue;
      const factor = A[r][col] / A[col][col];
      for (let c = col; c <= m; c++) A[r][c] -= factor * A[col][c];
    }
  }
  return A.map((row, i) => row[m] / row[i]);
}

const round = (v, digits = 4) => {
  if (!Number.isFinite(v)) return String(v);
  const r = Number(v.toPrecision(digits + 2));
  return String(Object.is(r, -0) ? 0 : r);
};

/** a·x + b written for Giac: signs folded, ready to evaluate or draw */
function terms(parts) {
  let text = '';
  const scale = Math.max(...parts.map(([c]) => Math.abs(c)));
  for (const [c0, factor] of parts) {
    // Rounding noise such as 1e-15 is zero.
    const c = Math.abs(c0) < 1e-10 * scale ? 0 : c0;
    const value = round(c, 6);
    if (Number(value) === 0 && parts.length > 1) continue;
    const body = factor ? (value === '1' ? factor : value === '-1' ? '-' + factor : `${value}*${factor}`) : value;
    text += text && !body.startsWith('-') ? '+' + body : body;
  }
  return text || '0';
}

export const MODELS = {
  linear: {
    label: 'linear', form: 'y = m·x + b',
    fit(x, y) {
      const [b, m] = leastSquares(x, y, [() => 1, (t) => t]);
      return { params: { m, b }, f: (t) => m * t + b, giac: terms([[m, 'x'], [b]]) };
    },
  },
  quadratisch: {
    label: 'quadratisch', form: 'y = a·x² + b·x + c',
    fit(x, y) {
      const [c, b, a] = leastSquares(x, y, [() => 1, (t) => t, (t) => t * t]);
      return { params: { a, b, c }, f: (t) => a * t * t + b * t + c, giac: terms([[a, 'x^2'], [b, 'x'], [c]]) };
    },
  },
  kubisch: {
    label: 'kubisch', form: 'y = a·x³ + b·x² + c·x + d',
    fit(x, y) {
      const [d, c, b, a] = leastSquares(x, y, [() => 1, (t) => t, (t) => t * t, (t) => t ** 3]);
      return { params: { a, b, c, d }, f: (t) => ((a * t + b) * t + c) * t + d, giac: terms([[a, 'x^3'], [b, 'x^2'], [c, 'x'], [d]]) };
    },
  },
  exponentiell: {
    label: 'exponentiell', form: 'y = a·bˣ',
    fit(x, y) {
      if (y.some((v) => v <= 0)) throw new Error('Exponentielle Regression braucht positive y-Werte.');
      const [la, lb] = leastSquares(x, y.map(Math.log), [() => 1, (t) => t]);
      const a = Math.exp(la);
      const b = Math.exp(lb);
      return { params: { a, b }, f: (t) => a * b ** t, giac: `${round(a, 6)}*${round(b, 6)}^x` };
    },
  },
  logarithmisch: {
    label: 'logarithmisch', form: 'y = a·ln(x) + b',
    fit(x, y) {
      if (x.some((v) => v <= 0)) throw new Error('Logarithmische Regression braucht positive x-Werte.');
      const [b, a] = leastSquares(x, y, [() => 1, (t) => Math.log(t)]);
      return { params: { a, b }, f: (t) => a * Math.log(t) + b, giac: terms([[a, 'ln(x)'], [b]]) };
    },
  },
  potenz: {
    label: 'Potenz', form: 'y = a·xᵇ',
    fit(x, y) {
      if (x.some((v) => v <= 0) || y.some((v) => v <= 0)) throw new Error('Potenzregression braucht positive x- und y-Werte.');
      const [la, b] = leastSquares(x.map(Math.log), y.map(Math.log), [() => 1, (t) => t]);
      const a = Math.exp(la);
      return { params: { a, b }, f: (t) => a * t ** b, giac: `${round(a, 6)}*x^${round(b, 6)}` };
    },
  },
  sinus: {
    label: 'Sinus', form: 'y = a·sin(b·x + c) + d',
    fit(x, y) {
      return sineFit(x, y);
    },
  },
};

export const MODEL_ALIASES = {
  linear: 'linear', lin: 'linear', gerade: 'linear',
  quadratisch: 'quadratisch', quad: 'quadratisch', parabel: 'quadratisch',
  kubisch: 'kubisch', kub: 'kubisch',
  exponentiell: 'exponentiell', exp: 'exponentiell', exponential: 'exponentiell',
  logarithmisch: 'logarithmisch', log: 'logarithmisch', ln: 'logarithmisch',
  potenz: 'potenz', pot: 'potenz', power: 'potenz',
  sinus: 'sinus', sin: 'sinus', periodisch: 'sinus',
};

export function modelOf(name) {
  const key = MODEL_ALIASES[String(name).toLowerCase()];
  if (!key) throw new Error(`Unbekanntes Modell „${name}“. Möglich: ${Object.keys(MODELS).join(', ')}.`);
  return key;
}

/** y = a·sin(b·x + c) + d: the frequency from a scan, the rest by least squares and Gauss–Newton */
function sineFit(x, y) {
  if (x.length < 4) throw new Error('Sinusregression braucht mindestens 4 Punkte.');
  const span = Math.max(...x) - Math.min(...x) || 1;
  const d0 = mean(y);
  let best = null;
  // For each trial frequency the amplitude and phase follow linearly: y ≈ p·sin(bx) + q·cos(bx) + d
  const xs = sorted(x);
  const minGap = Math.min(...xs.slice(1).map((v, i) => v - xs[i]).filter((g) => g > 0), span);
  const maxB = Math.PI / Math.max(minGap, span / 1000);
  for (let i = 1; i <= 2000; i++) {
    const b = (2 * Math.PI) / span * 0.25 + (maxB - (2 * Math.PI) / span * 0.25) * (i / 2000) ** 2;
    let coef;
    try {
      coef = leastSquares(x, y, [(t) => Math.sin(b * t), (t) => Math.cos(b * t), () => 1]);
    } catch (e) {
      continue;
    }
    const f = (t) => coef[0] * Math.sin(b * t) + coef[1] * Math.cos(b * t) + coef[2];
    const sse = x.reduce((s, t, k) => s + (y[k] - f(t)) ** 2, 0);
    if (!best || sse < best.sse) best = { b, coef, sse };
  }
  if (!best) throw new Error('Keine Sinuskurve gefunden.');
  let a = Math.hypot(best.coef[0], best.coef[1]);
  let b = best.b;
  let c = Math.atan2(best.coef[1], best.coef[0]);
  let d = best.coef[2] ?? d0;
  const sse = (a, b, c, d) => x.reduce((sum, t, k) => sum + (y[k] - (a * Math.sin(b * t + c) + d)) ** 2, 0);
  const start = [a, b, c, d];
  // Gauss–Newton polish of all four parameters
  for (let iter = 0; iter < 50; iter++) {
    const J = [];
    const r = [];
    for (let k = 0; k < x.length; k++) {
      const s = Math.sin(b * x[k] + c);
      const co = Math.cos(b * x[k] + c);
      J.push([s, a * x[k] * co, a * co, 1]);
      r.push(y[k] - (a * s + d));
    }
    const JtJ = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => J.reduce((sum, row) => sum + row[i] * row[j], 0)));
    const Jtr = [0, 1, 2, 3].map((i) => J.reduce((sum, row, k) => sum + row[i] * r[k], 0));
    let step;
    try {
      step = solve(JtJ, Jtr);
    } catch (e) {
      break;
    }
    a += step[0];
    b += step[1];
    c += step[2];
    d += step[3];
    if (step.every((s) => Math.abs(s) < 1e-12)) break;
  }
  // A polish that ran away (too few points for four parameters) keeps the scanned fit.
  if (!(sse(a, b, c, d) <= sse(...start)) || !(Math.abs(b) <= maxB * 1.5)) [a, b, c, d] = start;
  if (a < 0) {
    a = -a;
    c += Math.PI;
  }
  c = ((c % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  const giac = `${round(a, 6)}*sin(${round(b, 6)}*x${c < 0 ? '-' + round(-c, 6) : '+' + round(c, 6)})${d < 0 ? '-' + round(-d, 6) : '+' + round(d, 6)}`;
  return { params: { a, b, c, d }, f: (t) => a * Math.sin(b * t + c) + d, giac };
}

function solve(M, v) {
  const n = v.length;
  const A = M.map((row, i) => [...row, v[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    if (Math.abs(A[col][col]) < 1e-300) throw new Error('singular');
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = A[r][col] / A[col][col];
      for (let c = col; c <= n; c++) A[r][c] -= factor * A[col][c];
    }
  }
  return A.map((row, i) => row[n] / row[i]);
}

/** Least-squares polynomial of any degree, highest power first in the Giac text */
export function polynomialFit(x, y, degree) {
  const basis = Array.from({ length: degree + 1 }, (_, j) => (t) => t ** j);
  const c = leastSquares(x, y, basis);
  const giac = terms(c.map((v, j) => [v, j === 0 ? '' : j === 1 ? 'x' : `x^${j}`]).reverse());
  return { params: c, f: (t) => c.reduce((s, v, j) => s + v * t ** j, 0), giac };
}

/** A fitted model with its residuals and R² = 1 − SSres/SStot (on the original y values) */
export function regression(x, y, model) {
  if (x.length !== y.length) throw new Error('X und Y müssen gleich viele Werte haben.');
  if (x.length < 2) throw new Error('Für eine Regression braucht es mindestens 2 Punkte.');
  const key = modelOf(model);
  const fit = MODELS[key].fit(x, y);
  const scale = Math.max(...y.map(Math.abs)) || 1;
  // Residuals that are rounding noise are zero.
  const residuals = x.map((t, i) => y[i] - fit.f(t)).map((r) => (Math.abs(r) < 1e-12 * scale ? 0 : r));
  const my = mean(y);
  const ssTot = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  return { model: key, label: MODELS[key].label, form: MODELS[key].form, ...fit, residuals, ssRes, r2: ssTot > 0 ? 1 - ssRes / ssTot : 1 };
}

/** Every model that fits the data, best R² first */
export function compareModels(x, y) {
  const out = [];
  for (const key of Object.keys(MODELS)) {
    try {
      // A model needs more points than parameters to be worth comparing.
      const needed = { quadratisch: 4, kubisch: 5, sinus: 6 }[key] || 3;
      if (new Set(x).size < needed) continue;
      const fit = regression(x, y, key);
      if (fit.r2 >= 0) out.push(fit);
    } catch (e) {
      // a model that does not fit these data is left out
    }
  }
  return out.sort((a, b) => b.r2 - a.r2);
}

// Tests

const SIDES = { links: 'left', linksseitig: 'left', left: 'left', rechts: 'right', rechtsseitig: 'right', right: 'right', beidseitig: 'both', zweiseitig: 'both', both: 'both' };

export function sideOf(word) {
  const side = SIDES[String(word || 'beidseitig').toLowerCase()];
  if (!side) throw new Error('Seite: links, rechts oder beidseitig.');
  return side;
}

export const SIDE_TEXT = { left: 'linksseitig', right: 'rechtsseitig', both: 'beidseitig' };

/**
 * Binomial test of H₀: p = p₀ (p ≥ p₀ left, p ≤ p₀ right) with n trials at level α: the rejection region as at
 * school, the real error probability, and with an observed k the decision and p-value.
 */
export function binomialTest(n, p0, alpha, side, k) {
  const X = distribution('binomial', [n, p0]);
  const out = { n, p0, alpha, side };
  if (side === 'left') {
    // largest g with P(X ≤ g) ≤ α
    let g = -1;
    while (g + 1 <= n && X.cdf(g + 1) <= alpha + 1e-15) g++;
    out.region = g >= 0 ? [[0, g]] : [];
    out.error = g >= 0 ? X.cdf(g) : 0;
  } else if (side === 'right') {
    // smallest g with P(X ≥ g) ≤ α
    let g = n + 1;
    while (g - 1 >= 0 && 1 - X.cdf(g - 2) <= alpha + 1e-15) g--;
    out.region = g <= n ? [[g, n]] : [];
    out.error = g <= n ? 1 - X.cdf(g - 1) : 0;
  } else {
    let gl = -1;
    while (gl + 1 <= n && X.cdf(gl + 1) <= alpha / 2 + 1e-15) gl++;
    let gr = n + 1;
    while (gr - 1 >= 0 && 1 - X.cdf(gr - 2) <= alpha / 2 + 1e-15) gr--;
    out.region = [...(gl >= 0 ? [[0, gl]] : []), ...(gr <= n ? [[gr, n]] : [])];
    out.error = (gl >= 0 ? X.cdf(gl) : 0) + (gr <= n ? 1 - X.cdf(gr - 1) : 0);
  }
  if (k !== undefined && k !== null) {
    out.k = k;
    out.reject = out.region.some(([a, b]) => k >= a && k <= b);
    const left = X.cdf(k);
    const right = 1 - X.cdf(k - 1);
    out.pValue = side === 'left' ? left : side === 'right' ? right : Math.min(1, 2 * Math.min(left, right));
  }
  return out;
}

function pFrom(cdf, statistic, side) {
  if (side === 'left') return cdf(statistic);
  if (side === 'right') return 1 - cdf(statistic);
  return Math.min(1, 2 * Math.min(cdf(statistic), 1 - cdf(statistic)));
}

/** Gauss test for a mean with known σ */
export function zTest(xbar, mu0, sigma, n, alpha, side) {
  const z = (xbar - mu0) / (sigma / Math.sqrt(n));
  const p = pFrom(phi, z, side);
  const critical = side === 'both' ? phiInverse(1 - alpha / 2) : phiInverse(1 - alpha);
  return { statistic: z, name: 'z', p, critical: side === 'left' ? -critical : critical, reject: p <= alpha, alpha, side };
}

/** One-sample t test */
export function tTest(data, mu0, alpha, side) {
  if (data.length < 2) throw new Error('Der t-Test braucht mindestens 2 Werte.');
  const s = summary(data);
  const df = s.n - 1;
  const t = (s.mean - mu0) / s.standardError;
  const cdf = (v) => tCdf(df, v);
  const p = pFrom(cdf, t, side);
  const T = distribution('t', [df]);
  const critical = T.quantile(side === 'both' ? 1 - alpha / 2 : 1 - alpha);
  return { statistic: t, name: 't', df, p, critical: side === 'left' ? -critical : critical, reject: p <= alpha, mean: s.mean, sd: s.sampleSd, alpha, side };
}

/** Welch's two-sample t test for equal means */
export function tTest2(a, b, alpha, side) {
  if (a.length < 2 || b.length < 2) throw new Error('Beide Stichproben brauchen mindestens 2 Werte.');
  const va = variance(a, true) / a.length;
  const vb = variance(b, true) / b.length;
  const t = (mean(a) - mean(b)) / Math.sqrt(va + vb);
  const df = (va + vb) ** 2 / (va * va / (a.length - 1) + vb * vb / (b.length - 1));
  const p = pFrom((v) => tCdf(df, v), t, side);
  return { statistic: t, name: 't', df, p, reject: p <= alpha, alpha, side };
}

/** χ² test for a variance: H₀ σ² = σ₀² */
export function varianceTest(data, sigma2, alpha, side) {
  const n = data.length;
  if (n < 2) throw new Error('Der Varianztest braucht mindestens 2 Werte.');
  const chi = ((n - 1) * variance(data, true)) / sigma2;
  const df = n - 1;
  const p = pFrom((v) => chi2Cdf(df, v), chi, side);
  return { statistic: chi, name: 'χ²', df, p, reject: p <= alpha, alpha, side };
}

/** F test for two variances */
export function fTest(a, b, alpha, side) {
  const F = variance(a, true) / variance(b, true);
  const d1 = a.length - 1;
  const d2 = b.length - 1;
  const cdf = (f) => (f <= 0 ? 0 : betaI((d1 * f) / (d1 * f + d2), d1 / 2, d2 / 2));
  const p = pFrom(cdf, F, side);
  return { statistic: F, name: 'F', df: [d1, d2], p, reject: p <= alpha, alpha, side };
}

/** χ² goodness of fit: observed counts against expected counts or probabilities */
export function chi2Fit(observed, expected, alpha) {
  const n = observed.reduce((s, x) => s + x, 0);
  const sumE = expected.reduce((s, x) => s + x, 0);
  const e = Math.abs(sumE - 1) < 1e-9 ? expected.map((p) => p * n) : expected.map((x) => (x * n) / sumE);
  if (observed.length !== e.length) throw new Error('Beobachtet und erwartet müssen gleich lang sein.');
  const chi = observed.reduce((s, o, i) => s + (o - e[i]) ** 2 / e[i], 0);
  const df = observed.length - 1;
  const p = 1 - chi2Cdf(df, chi);
  return { statistic: chi, name: 'χ²', df, p, reject: p <= alpha, expected: e, alpha, critical: distribution('chi2', [df]).quantile(1 - alpha) };
}

/** χ² test of independence on a contingency table */
export function chi2Independence(table, alpha) {
  const rows = table.map((r) => r.reduce((s, x) => s + x, 0));
  const cols = table[0].map((_, j) => table.reduce((s, r) => s + r[j], 0));
  const n = rows.reduce((s, x) => s + x, 0);
  let chi = 0;
  const expected = table.map((r, i) => r.map((_, j) => (rows[i] * cols[j]) / n));
  table.forEach((r, i) => r.forEach((o, j) => (chi += (o - expected[i][j]) ** 2 / expected[i][j])));
  const df = (table.length - 1) * (table[0].length - 1);
  const p = 1 - chi2Cdf(df, chi);
  return { statistic: chi, name: 'χ²', df, p, reject: p <= alpha, expected, alpha, critical: distribution('chi2', [df]).quantile(1 - alpha) };
}

/** Confidence interval for a proportion: the school's (Wilson) interval from |h − p| ≤ c·√(p(1−p)/n), and Wald's */
export function proportionInterval(k, n, level) {
  const h = k / n;
  const c = phiInverse(0.5 + level / 2);
  const denominator = 1 + (c * c) / n;
  const centre = (h + (c * c) / (2 * n)) / denominator;
  const half = (c / denominator) * Math.sqrt((h * (1 - h)) / n + (c * c) / (4 * n * n));
  const wald = c * Math.sqrt((h * (1 - h)) / n);
  return { h, c, low: centre - half, high: centre + half, waldLow: h - wald, waldHigh: h + wald };
}

/** Confidence interval for a mean, with t (σ unknown) or z (σ given) */
export function meanInterval(data, level, sigma) {
  const s = summary(data);
  if (sigma) {
    const c = phiInverse(0.5 + level / 2);
    const half = (c * sigma) / Math.sqrt(s.n);
    return { mean: s.mean, c, low: s.mean - half, high: s.mean + half, kind: 'z' };
  }
  if (s.n < 2) throw new Error('Mindestens 2 Werte.');
  const c = distribution('t', [s.n - 1]).quantile(0.5 + level / 2);
  const half = c * s.standardError;
  return { mean: s.mean, c, low: s.mean - half, high: s.mean + half, kind: 't', df: s.n - 1 };
}

/** μ ± c·σ with its probability, the school's σ-rules for B(n; p) */
export function sigmaInterval(n, p, c) {
  const X = distribution('binomial', [n, p]);
  const mu = n * p;
  const sigma = Math.sqrt(n * p * (1 - p));
  const low = Math.ceil(mu - c * sigma - 1e-9);
  const high = Math.floor(mu + c * sigma + 1e-9);
  return { mu, sigma, low, high, probability: probability(X, low, high) };
}

// Simulation: seeded, so the same row draws the same picture every time

export function random(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed() {
  return Math.floor(Math.random() * 2 ** 31) + 1;
}

/** n draws of values with probabilities (equal when none are given) */
export function draw(rand, values, probabilities, n) {
  const p = probabilities || values.map(() => 1 / values.length);
  const total = p.reduce((s, x) => s + x, 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    let u = rand() * total;
    let k = 0;
    while (k < p.length - 1 && u >= p[k]) u -= p[k++];
    out.push(values[k]);
  }
  return out;
}

/** n draws from an urn without putting back */
export function drawWithout(rand, values, n) {
  if (n > values.length) throw new Error('Ohne Zurücklegen: höchstens so viele Züge wie Kugeln.');
  const urn = [...values];
  const out = [];
  for (let i = 0; i < n; i++) out.push(urn.splice(Math.floor(rand() * urn.length), 1)[0]);
  return out;
}

/** A sample of a distribution */
export function sample(rand, dist, n) {
  if (dist.discrete) {
    const values = listed(dist, 5000);
    return draw(rand, values.map((v) => v[0]), values.map((v) => v[1]), n);
  }
  return Array.from({ length: n }, () => dist.quantile(Math.min(1 - 1e-12, Math.max(1e-12, rand()))));
}

/** Relative frequency of hits after each of n trials with success probability p */
export function runningFrequency(rand, p, n) {
  let hits = 0;
  const out = [];
  for (let i = 1; i <= n; i++) {
    if (rand() < p) hits++;
    out.push(hits / i);
  }
  return out;
}

/** Monte Carlo estimate of ∫ f over [a; b] with n random points, and π from points in the unit square */
export function monteCarloIntegral(rand, f, a, b, n) {
  let sum = 0;
  for (let i = 0; i < n; i++) sum += f(a + (b - a) * rand());
  return ((b - a) * sum) / n;
}

export function monteCarloPi(rand, n) {
  let inside = 0;
  const points = [];
  for (let i = 0; i < n; i++) {
    const x = rand();
    const y = rand();
    const hit = x * x + y * y <= 1;
    if (hit) inside++;
    if (points.length < 3000) points.push([x, y, hit]);
  }
  return { estimate: (4 * inside) / n, inside, points };
}

export { round as roundNumber };

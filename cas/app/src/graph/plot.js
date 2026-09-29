// The numerical side of the graphics: sampling graphs without drawing across poles, contour lines of implicit
// equations, and the special points of a graph (zeros, extreme points, inflection points, intersections). Pure
// functions of numbers, tested in Node.

/**
 * Samples y = f(x) at n+1 points between x0 and x1 and returns the pieces to draw, each a list of [x, y]. A piece
 * ends where f is undefined or jumps across a pole: between two samples far apart, the middle value is checked.
 */
export function sampleFunction(f, x0, x1, n, span = Infinity) {
  const pieces = [];
  let piece = [];
  let previous = null;
  const finish = () => {
    if (piece.length) pieces.push(piece);
    piece = [];
  };
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = safe(f, x);
    if (!Number.isFinite(y)) {
      // Close in on where the graph ends (sqrt(x) at 0, ln(x) near 0).
      if (previous) {
        const edge = boundary(f, previous[0], x);
        if (edge) piece.push(edge);
      }
      finish();
      previous = null;
      continue;
    }
    if (previous) {
      const jump = Math.abs(y - previous[1]);
      if (jump > span * 0.5) {
        const middle = safe(f, (previous[0] + x) / 2);
        const low = Math.min(previous[1], y);
        const high = Math.max(previous[1], y);
        const through = Number.isFinite(middle) && middle >= low - jump * 0.25 && middle <= high + jump * 0.25;
        if (!through) {
          finish();
        }
      }
    } else if (i > 0) {
      const edge = boundary(f, x, x0 + ((x1 - x0) * (i - 1)) / n);
      if (edge) piece.push(edge);
    }
    piece.push([x, y]);
    previous = [x, y];
  }
  finish();
  return pieces;
}

function safe(f, x) {
  try {
    const y = f(x);
    return typeof y === 'number' ? y : NaN;
  } catch (e) {
    return NaN;
  }
}

/** The last defined point between a (defined) and b (undefined), by bisection. */
function boundary(f, a, b) {
  let good = a;
  let bad = b;
  for (let k = 0; k < 30; k++) {
    const m = (good + bad) / 2;
    if (Number.isFinite(safe(f, m))) good = m;
    else bad = m;
  }
  const y = safe(f, good);
  return Number.isFinite(y) ? [good, y] : null;
}

/**
 * Where F(x, y) = 0 in the rectangle, as line segments [[x1, y1], [x2, y2]] (marching squares). Sign changes that
 * are poles (tan, 1/x) are skipped: at a real zero the value between the corners is small.
 */
export function contour(F, xmin, xmax, ymin, ymax, nx, ny) {
  const values = new Float64Array((nx + 1) * (ny + 1));
  const X = (i) => xmin + ((xmax - xmin) * i) / nx;
  const Y = (j) => ymin + ((ymax - ymin) * j) / ny;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) values[j * (nx + 1) + i] = safe2(F, X(i), Y(j));
  const at = (i, j) => values[j * (nx + 1) + i];
  const segments = [];
  const cross = (i1, j1, i2, j2) => {
    const a = at(i1, j1);
    const b = at(i2, j2);
    if (!Number.isFinite(a) || !Number.isFinite(b) || (a > 0) === (b > 0)) return null;
    const t = a / (a - b);
    const x = X(i1) + (X(i2) - X(i1)) * t;
    const y = Y(j1) + (Y(j2) - Y(j1)) * t;
    const check = Math.abs(safe2(F, x, y));
    if (!(check <= 0.5 * Math.max(Math.abs(a), Math.abs(b)) + 1e-9)) return null;
    return [x, y];
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const points = [cross(i, j, i + 1, j), cross(i + 1, j, i + 1, j + 1), cross(i, j + 1, i + 1, j + 1), cross(i, j, i, j + 1)].filter(Boolean);
      if (points.length === 2) segments.push(points);
      else if (points.length === 4) {
        // Saddle: pair the crossings by the value in the middle.
        const centre = safe2(F, (X(i) + X(i + 1)) / 2, (Y(j) + Y(j + 1)) / 2);
        if ((centre > 0) === (at(i, j) > 0)) segments.push([points[0], points[1]], [points[2], points[3]]);
        else segments.push([points[0], points[3]], [points[1], points[2]]);
      }
    }
  }
  return segments;
}

function safe2(F, x, y) {
  try {
    const v = F(x, y);
    return typeof v === 'number' ? v : NaN;
  } catch (e) {
    return NaN;
  }
}

/** Zeros of g between a and b: sign changes, refined by bisection; poles (1/x) are left out. */
export function roots(g, a, b, n = 600) {
  const out = [];
  let px = a;
  let py = safe(g, a);
  if (py === 0) out.push(a);
  for (let i = 1; i <= n; i++) {
    const x = a + ((b - a) * i) / n;
    const y = safe(g, x);
    if (Number.isFinite(py) && Number.isFinite(y)) {
      if (y === 0) out.push(x);
      else if (py !== 0 && (py > 0) !== (y > 0)) {
        let lo = px;
        let hi = x;
        let flo = py;
        for (let k = 0; k < 60; k++) {
          const m = (lo + hi) / 2;
          const fm = safe(g, m);
          if (!Number.isFinite(fm)) break;
          if ((fm > 0) === (flo > 0)) {
            lo = m;
            flo = fm;
          } else hi = m;
        }
        const root = (lo + hi) / 2;
        const value = Math.abs(safe(g, root));
        // A pole changes sign too, but the value there is huge.
        if (value < 1e-6 * Math.max(1, Math.abs(py), Math.abs(y)) || value < 1e-9) out.push(root);
      }
    }
    px = x;
    py = y;
  }
  return dedupe(out, (b - a) / n);
}

function dedupe(list, gap) {
  const sorted = list.slice().sort((p, q) => p - q);
  return sorted.filter((v, i) => i === 0 || v - sorted[i - 1] > gap * 0.5);
}

/** Numerical derivative, when Giac gave none. */
export function derivative(f) {
  return (x) => {
    const h = 1e-5 * Math.max(1, Math.abs(x));
    return (f(x + h) - f(x - h)) / (2 * h);
  };
}

/**
 * The special points of y = f(x) between a and b: zeros (N), extreme points (H, T), inflection points (W, or S for
 * a saddle), where it crosses the y axis (Sy), and the intersections (S) with the other graphs.
 */
export function specialPoints(f, d1, d2, a, b, others = []) {
  const first = d1 || derivative(f);
  const second = d2 || derivative(first);
  const out = [];
  const tiny = 1e-7 * Math.max(1, b - a);
  const zeros = roots(f, a, b);
  const extrema = roots(first, a, b).filter((x) => Number.isFinite(safe(f, x)));
  for (const x of extrema) {
    const y = safe(f, x);
    const curvature = safe(second, x);
    let kind = null;
    if (curvature < -1e-9) kind = 'H';
    else if (curvature > 1e-9) kind = 'T';
    else {
      const h = (b - a) / 400;
      const left = safe(f, x - h);
      const right = safe(f, x + h);
      if (left < y && right < y) kind = 'H';
      else if (left > y && right > y) kind = 'T';
    }
    if (kind) out.push({ kind, x, y });
    // A zero where the graph only touches the axis has no sign change.
    if (Math.abs(y) < 1e-9 && !zeros.some((z) => Math.abs(z - x) < tiny * 100)) zeros.push(x);
  }
  zeros.sort((p, q) => p - q).forEach((x) => out.push({ kind: 'N', x, y: 0 }));
  for (const x of roots(second, a, b)) {
    const y = safe(f, x);
    if (!Number.isFinite(y)) continue;
    // Only where the curvature really changes (not x^4 at 0).
    const h = (b - a) / 300;
    if ((safe(second, x - h) > 0) === (safe(second, x + h) > 0)) continue;
    out.push({ kind: Math.abs(safe(first, x)) < 1e-6 ? 'S' : 'W', x, y });
  }
  if (a <= 0 && b >= 0) {
    const y = safe(f, 0);
    if (Number.isFinite(y) && !out.some((p) => p.kind === 'N' && Math.abs(p.x) < tiny)) out.push({ kind: 'Sy', x: 0, y });
  }
  for (const other of others) {
    for (const x of roots((t) => f(t) - other.f(t), a, b)) {
      const y = safe(f, x);
      if (Number.isFinite(y)) out.push({ kind: 'X', x, y, with: other.name || other.label || '' });
    }
  }
  return out;
}

/** A round step for about `count` ticks over `range`: 1, 2, 5 · 10^k */
export function niceStep(range, count) {
  const raw = range / Math.max(1, count);
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const unit = raw / power;
  const nice = unit < 1.5 ? 1 : unit < 3.5 ? 2 : unit < 7.5 ? 5 : 10;
  return nice * power;
}

/** Steps of the x axis in multiples of π, for trigonometry: π/6, π/4, π/2, π, 2π … */
export function piStep(range, count) {
  const raw = range / Math.max(1, count) / Math.PI;
  const options = [1 / 12, 1 / 6, 1 / 4, 1 / 2, 1, 2, 4, 5, 10, 20, 50, 100];
  return (options.find((o) => o >= raw) || raw) * Math.PI;
}

/** A tick label: decimal comma, real minus sign, no float noise. */
export function tickLabel(value, step) {
  if (Math.abs(value) < step * 1e-6) return '0';
  const decimals = Math.max(0, Math.min(10, -Math.floor(Math.log10(step) + 1e-9)));
  const abs = Math.abs(value);
  if (abs >= 1e6 || (abs < 1e-4 && abs > 0)) return formatScientific(value);
  const text = value.toFixed(decimals).replace('.', ',');
  return text.replace('-', '−');
}

function formatScientific(value) {
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = value / Math.pow(10, exponent);
  return (Math.round(mantissa * 100) / 100).toString().replace('.', ',').replace('-', '−') + '·10^' + exponent;
}

/** k·π/d as text: π/2, −3π/4, 2π */
export function piLabel(value) {
  const ratio = value / Math.PI;
  for (const d of [1, 2, 3, 4, 6, 12]) {
    const k = Math.round(ratio * d);
    if (Math.abs(ratio * d - k) < 1e-6) {
      if (k === 0) return '0';
      const g = gcd(Math.abs(k), d);
      const num = k / g;
      const den = d / g;
      const sign = num < 0 ? '−' : '';
      const top = Math.abs(num) === 1 ? 'π' : Math.abs(num) + 'π';
      return sign + (den === 1 ? top : top + '/' + den);
    }
  }
  return tickLabel(value, 0.01);
}

function gcd(a, b) {
  return b ? gcd(b, a % b) : a;
}

/** A coordinate for people: at most `digits` decimals, decimal comma, trailing zeros gone. */
export function coordinate(value, digits = 2) {
  if (!Number.isFinite(value)) return '–';
  const rounded = Math.round(value * Math.pow(10, digits)) / Math.pow(10, digits);
  const text = (Object.is(rounded, -0) ? 0 : rounded).toFixed(digits).replace(/\.?0+$/, '').replace('.', ',');
  return text.replace('-', '−');
}

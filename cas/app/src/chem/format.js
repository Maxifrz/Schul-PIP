// Numbers for display: German decimal comma, a chosen number of significant digits or decimals, LaTeX and plain text.
// Nothing here rounds a value that is used afterwards: only what is shown.

/** Significant digits of a number as typed: "5,0" → 2, "5,000" → 4, "0,0250" → 3, "1,5e-3" → 2 */
export function sigFigsOf(literal) {
  const m = /^\s*[+-]?(\d*)[.,]?(\d*)(?:[eE][+-]?\d+)?\s*$/.exec(String(literal));
  if (!m) return null;
  const digits = (m[1] + m[2]).replace(/^0+/, '');
  return digits.length || null;
}

export function roundSig(value, sig) {
  if (!Number.isFinite(value) || value === 0) return value;
  return Number(value.toPrecision(Math.max(1, Math.min(21, sig))));
}

export function roundDecimals(value, decimals) {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * f) / f;
}

/** Splits a number into mantissa digits and a power of ten for scientific notation */
function scientific(value, sig) {
  const [m, e] = value.toExponential(Math.max(0, sig - 1)).split('e');
  return { mantissa: m, exponent: Number(e) };
}

/**
 * The text of a number. `sig` significant digits (default 4) or `decimals` after the comma. Very small or large
 * numbers use scientific notation. Trailing zeros stay: 0,1000 mol shows the precision it was given with.
 */
export function formatNumber(value, { sig = 4, decimals = null, style = 'text', keepZeros = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (value === Infinity) return style === 'latex' ? '\\infty' : '∞';
  if (value === -Infinity) return style === 'latex' ? '-\\infty' : '-∞';
  if (value === 0) return decimals ? '0,' + '0'.repeat(decimals) : '0';
  const abs = Math.abs(value);
  const comma = style === 'latex' ? '{,}' : ',';
  const minus = value < 0 ? (style === 'latex' ? '-' : '−') : '';
  if (decimals !== null && abs < 1e6 && Number(abs.toFixed(decimals)) !== 0) {
    return minus + abs.toFixed(decimals).replace('.', comma);
  }
  if (abs < 1e-3 || abs >= 1e6) {
    const { mantissa, exponent } = scientific(abs, sig);
    let m = mantissa;
    if (!keepZeros && m.includes('.')) m = m.replace(/0+$/, '').replace(/\.$/, '');
    const text = m.replace('.', comma);
    return style === 'latex' ? `${minus}${text}\\cdot10^{${exponent}}` : `${minus}${text}·10${superscript(exponent)}`;
  }
  // digits before the point count toward the significant digits
  let text = Number(abs.toPrecision(sig)).toString();
  if (text.includes('e')) text = abs.toPrecision(sig);
  if (keepZeros) text = abs.toPrecision(sig);
  if (text.includes('e')) text = String(Number(text));
  return minus + text.replace('.', comma);
}

const SUP = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
const superscript = (n) => String(n).split('').map((c) => SUP[c] || c).join('');

/** A unit as LaTeX: "mol/L" → \mathrm{mol/L}, "µmol" → \mathrm{\mu mol}, "mol·L^-1" → \mathrm{mol\cdot L^{-1}} */
export function unitLatex(unit) {
  if (!unit) return '';
  const body = String(unit)
    .replace(/µ|μ/g, '\\mu ')
    .replace(/·|\*/g, '\\cdot ')
    .replace(/\^(-?\d+)/g, '^{$1}')
    .replace(/°C/g, '^{\\circ}\\mathrm{C}')
    .replace(/%/g, '\\%');
  return `\\mathrm{${body}}`;
}

/** A value with its unit, as text or LaTeX */
export function formatQuantity(value, unit, options = {}) {
  const style = options.style || 'text';
  const n = formatNumber(value, options);
  if (!unit) return n;
  if (style === 'latex') return `${n}\\,${unitLatex(unit)}`;
  return `${n} ${unit}`;
}

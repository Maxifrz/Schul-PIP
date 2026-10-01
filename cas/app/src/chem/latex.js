// The formula editor writes chemistry as LaTeX: H_2SO_4, Fe^{3+}, \rightarrow, \rightleftharpoons, \mathrm{mol}. The
// chemistry engine reads plain text, so this turns the LaTeX of an input into the text the parsers understand.

const SPACES = /\\[,;:! ]|\\quad|\\qquad|~/g;

/**
 * Text for a LaTeX string; unknown commands are dropped, braces removed. With `strict`, a LaTeX command that is not
 * chemistry notation (\sqrt, \int, \begin …) makes the answer null, so mathematics is never turned into nonsense.
 */
export function chemLatexToText(latex, { strict = false } = {}) {
  let s = String(latex).replace(/\^\s*\{?\\(?:circ|degree)\}?/g, '°');
  s = s
    .replace(/\\left(?![A-Za-z])|\\right(?![A-Za-z])/g, '')
    .replace(/\\operatorname\{([^}]*)\}/g, '$1')
    .replace(/\\(?:mathrm|text|textrm|mathit|mathbf|textit)\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:mathrm|text|textrm|mathit)\{([^{}]*)\}/g, '$1')
    .replace(/\\(?:longrightarrow|rightarrow|to|Rightarrow|longrightarrow)(?![A-Za-z])/g, ' -> ')
    .replace(/\\(?:rightleftharpoons|leftrightarrow|Leftrightarrow|leftrightharpoons|rightleftarrows)(?![A-Za-z])/g, ' <=> ')
    .replace(/\\(?:uparrow|downarrow)(?![A-Za-z])/g, ' ')
    .replace(/\\(?:Delta|triangle)(?![A-Za-z])\s*/g, 'Δ')
    .replace(/\\(?:mu)(?![A-Za-z])/g, 'µ')
    .replace(/\\(?:circ|degree)(?![A-Za-z])/g, '°')
    .replace(/\\%/g, '%')
    .replace(/\\(?:cdot|times|bullet)(?![A-Za-z])/g, '·')
    .replace(/\\(?:lbrack)(?![A-Za-z])/g, '[')
    .replace(/\\(?:rbrack)(?![A-Za-z])/g, ']')
    .replace(/\\(?:lbrace)(?![A-Za-z])/g, '{')
    .replace(/\\(?:rbrace)(?![A-Za-z])/g, '}')
    .replace(/\\(?:le|leq)(?![A-Za-z])/g, '<=')
    .replace(/\\(?:ge|geq)(?![A-Za-z])/g, '>=')
    .replace(SPACES, ' ')
    .replace(/\{,\}/g, ',')
    .replace(/\\lg\b/g, 'lg')
    .replace(/\\ln\b/g, 'ln')
    .replace(/\\pi\b/g, 'pi');
  // a fraction typed as mol/L: \frac{mol}{L} → mol/L
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
    if (s === before) break;
  }
  if (strict && /\\(?!left|right)[A-Za-z]+/.test(s)) return null;
  // sub- and superscripts: X_2, X_{12}, X^{2-}, X^-
  s = s.replace(/_\{([^{}]*)\}/g, '$1').replace(/_([A-Za-z0-9])/g, '$1');
  s = s.replace(/\^\{([^{}]*)\}/g, (m, body) => '^' + body).replace(/\^([A-Za-z0-9+-])/g, '^$1');
  // "e^-" stays the electron; ion charges written as ^3+ stay
  s = s.replace(/[{}]/g, '');
  s = s.replace(/\\([A-Za-z]+)/g, '');
  return s.replace(/°\s+C\b/g, '°C').replace(/\s+/g, ' ').trim();
}

/** Whether the LaTeX has anything only chemistry uses: subscripts in formulas, reaction arrows, degree signs … */
export const looksLikeChemistryLatex = (latex) => /\\(?:rightleftharpoons|rightarrow|longrightarrow|to|uparrow|downarrow|Delta|mathrm|operatorname)/.test(latex) || /[A-Z][a-z]?_/.test(latex);

const SUPER = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', '−': '⁻', n: 'ⁿ' };
const SUB = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', '+': '₊', '-': '₋', '−': '₋' };
const script = (body, table, mark) => (body.length && [...body].every((c) => table[c]) ? [...body].map((c) => table[c]).join('') : mark + body);

/**
 * LaTeX as text for people: what the calculator shows, written with Unicode (E° − (R·T/(n·F))·ln Q, 1·10⁸, H₂O),
 * so a copied calculation reads like the screen and not like source code.
 */
export function latexToUnicode(latex) {
  let s = String(latex)
    .replace(/\\left(?![A-Za-z])|\\right(?![A-Za-z])/g, '')
    .replace(/\\(?:operatorname|mathrm|text|textrm|mathit|mathbf|textit)\{([^{}]*)\}/g, '$1')
    .replace(/\{,\}|\{\.\}/g, ',')
    .replace(/\\(?:longrightarrow|rightarrow|to)(?![A-Za-z])/g, '→')
    .replace(/\\(?:Rightarrow|Longrightarrow)(?![A-Za-z])/g, '⇒')
    .replace(/\\(?:rightleftharpoons|leftrightarrow|Leftrightarrow)(?![A-Za-z])/g, '⇌')
    .replace(/\\uparrow(?![A-Za-z])/g, '↑')
    .replace(/\\downarrow(?![A-Za-z])/g, '↓')
    .replace(/\\Delta(?![A-Za-z])/g, 'Δ')
    .replace(/\\(?:circ|degree)(?![A-Za-z])/g, '°')
    .replace(/\\(?:cdot|bullet)(?![A-Za-z])/g, '·')
    .replace(/\\times(?![A-Za-z])/g, '×')
    .replace(/\\(?:le|leq)(?![A-Za-z])/g, '≤')
    .replace(/\\(?:ge|geq)(?![A-Za-z])/g, '≥')
    .replace(/\\ne(?![A-Za-z])/g, '≠')
    .replace(/\\approx(?![A-Za-z])/g, '≈')
    .replace(/\\pm(?![A-Za-z])/g, '±')
    .replace(/\\mu(?![A-Za-z])/g, 'µ')
    .replace(/\\pi(?![A-Za-z])/g, 'π')
    .replace(/\\(lg|ln|log|sin|cos|tan)(?![A-Za-z])/g, '$1')
    .replace(/\\%/g, '%')
    .replace(/\\(?:,|;|:|!|quad|qquad)|~/g, ' ');
  for (let i = 0; i < 6; i++) {
    const before = s;
    s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, (m, a, b) => {
      const wrap = (t) => (/^[\w.,°]+$/.test(t) ? t : '(' + t + ')');
      return wrap(a) + '/' + wrap(b);
    });
    if (s === before) break;
  }
  s = s.replace(/\^\s*\{?°\}?/g, '°').replace(/Δ\s+/g, 'Δ');
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)');
  s = s.replace(/_\{([^{}]*)\}/g, (m, b) => script(b, SUB, '_')).replace(/_([A-Za-z0-9])/g, (m, b) => script(b, SUB, '_'));
  s = s.replace(/\^\{([^{}]*)\}/g, (m, b) => script(b, SUPER, '^')).replace(/\^([A-Za-z0-9+-])/g, (m, b) => script(b, SUPER, '^'));
  s = s.replace(/\b(\d+(?:,\d+)?)\s*1·10(?=[⁰¹²³⁴⁵⁶⁷⁸⁹⁻])/g, '$1·10');
  s = s.replace(/[{}]/g, '').replace(/\\([A-Za-z]+)/g, '');
  return s.replace(/(\d) - (?=\d)/g, '$1 − ').replace(/ - /g, ' − ').replace(/\s+/g, ' ').trim();
}

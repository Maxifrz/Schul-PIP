// The formula editor writes chemistry as LaTeX: H_2SO_4, Fe^{3+}, \rightarrow, \rightleftharpoons, \mathrm{mol}. The
// chemistry engine reads plain text, so this turns the LaTeX of an input into the text the parsers understand.

const SPACES = /\\[,;:! ]|\\quad|\\qquad|~/g;

/** Text for a LaTeX string; unknown commands are dropped, braces removed */
export function chemLatexToText(latex) {
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

// The formula keyboard: numbers and operators, functions, calculus, letters, and the most used German commands.
// Templates use MathLive's placeholders: #@ takes the selection, #? is an empty box to fill.

import { command } from './commands.js';

/** LaTeX template for a command: löse → \operatorname{löse}\left(#?,x\right), filled from its syntax. */
export function commandTemplate(name) {
  const c = command(name);
  if (!c) return `\\operatorname{${name}}\\left(#?\\right)`;
  const first = c.syntax.split(/ · | oder /)[0];
  const inner = /\((.*)\)/.exec(first);
  const args = inner ? splitArgs(inner[1]) : ['#?'];
  const filled = args.map((arg) => (/^[a-z]$/.test(arg.trim()) ? arg.trim() : '#?'));
  return `\\operatorname{${c.name}}\\left(${filled.join(',')}\\right)`;
}

function splitArgs(text) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    else if (ch === ',' && depth === 0) {
      out.push(text.slice(start, i));
      start = i + 1;
    }
  }
  out.push(text.slice(start));
  return out;
}

const cmd = (name, label) => ({ latex: commandTemplate(name), insert: commandTemplate(name), label: label || name, class: 'small', width: 2 });

export const LAYOUTS = [
  {
    label: '123',
    tooltip: 'Zahlen und Grundrechenarten',
    rows: [
      [{ latex: 'x', variants: ['y', 'z', 't', 'a', 'b', 'n'] }, 'y', { latex: '#@^{2}', label: 'x²' }, { latex: '#@^{#?}', label: 'xⁿ' }, { latex: '\\sqrt{#0}', label: '√' }, { latex: '\\sqrt[#?]{#0}', label: 'ⁿ√' }, '[separator-5]', '7', '8', '9', { latex: '\\frac{#@}{#?}', label: '÷', class: 'hide-shift' }],
      ['(', ')', { latex: '\\left|#0\\right|', label: '|x|' }, { latex: '\\frac{#@}{#?}', label: 'a/b' }, '\\pi', { latex: 'e', label: 'e' }, '[separator-5]', '4', '5', '6', { latex: '\\cdot', label: '×' }],
      ['<', '>', '\\le', '\\ge', '=', { latex: ',', label: ',' }, '[separator-5]', '1', '2', '3', '-'],
      ['[left]', '[right]', { latex: '\\%', label: '%' }, { latex: '#@!', label: 'n!' }, { latex: '\\infty', label: '∞' }, '[backspace]', '[separator-5]', '0', '.', '+', '[return]'],
    ],
  },
  {
    label: 'f(x)',
    tooltip: 'Funktionen',
    rows: [
      [{ latex: '\\sin(#0)', label: 'sin' }, { latex: '\\cos(#0)', label: 'cos' }, { latex: '\\tan(#0)', label: 'tan' }, { latex: '\\ln(#0)', label: 'ln' }, { latex: '\\lg(#0)', label: 'lg' }, { latex: 'e^{#0}', label: 'eˣ' }, { latex: '10^{#0}', label: '10ˣ' }],
      [{ latex: '\\arcsin(#0)', label: 'sin⁻¹' }, { latex: '\\arccos(#0)', label: 'cos⁻¹' }, { latex: '\\arctan(#0)', label: 'tan⁻¹' }, { latex: '\\log_{#?}(#0)', label: 'logₐ' }, { latex: '\\sinh(#0)', label: 'sinh' }, { latex: '\\cosh(#0)', label: 'cosh' }, { latex: '\\operatorname{sign}(#0)', label: 'sgn' }],
      [{ latex: 'f\\left(x\\right)=', label: 'f(x)=' }, { latex: "f'\\left(#?\\right)", label: "f'" }, { latex: 'g\\left(x\\right)=', label: 'g(x)=' }, { latex: '\\binom{#?}{#?}', label: 'nCr' }, { latex: '\\left\\lfloor #0\\right\\rfloor', label: '⌊x⌋' }, { latex: '^{\\circ}', label: '°' }, 'i'],
      ['[left]', '[right]', '(', ')', ',', '[backspace]', '[return]'],
    ],
  },
  {
    label: '∫ d/dx',
    tooltip: 'Analysis, Matrizen, Vektoren',
    rows: [
      [{ latex: '\\int_{#?}^{#?}#0\\,\\mathrm{d}x', label: '∫ₐᵇ' }, { latex: '\\int #0\\,\\mathrm{d}x', label: '∫' }, { latex: '\\lim_{x\\to#?}#0', label: 'lim' }, { latex: '\\sum_{k=#?}^{#?}#0', label: 'Σ' }, { latex: '\\prod_{k=#?}^{#?}#0', label: 'Π' }, cmd('ableiten', "d/dx")],
      [{ latex: '\\begin{pmatrix}#?&#?\\\\#?&#?\\end{pmatrix}', label: '2×2' }, { latex: '\\begin{pmatrix}#?&#?&#?\\\\#?&#?&#?\\\\#?&#?&#?\\end{pmatrix}', label: '3×3' }, { latex: '\\begin{pmatrix}#?\\\\#?\\end{pmatrix}', label: '2D-Vektor' }, { latex: '\\begin{pmatrix}#?\\\\#?\\\\#?\\end{pmatrix}', label: '3D-Vektor' }, { latex: '\\left[#?\\right]', label: '[Liste]' }, cmd('determinante', 'det')],
      [{ latex: '\\begin{cases}#? & #?\\\\#? & #?\\end{cases}', label: 'Fälle' }, { latex: '_{#?}', label: 'xₙ' }, { latex: '\\overline{#0}', label: 'z̄' }, '\\ne', { latex: '\\mathrm{i}', label: 'i' }, cmd('inverse')],
      ['[left]', '[right]', '(', ')', ',', '[backspace]', '[return]'],
    ],
  },
  {
    label: 'Befehle',
    tooltip: 'Häufige Befehle',
    rows: [
      [cmd('löse'), cmd('nullstellen'), cmd('faktorisiere'), cmd('ausmultiplizieren')],
      [cmd('ableiten'), cmd('integriere'), cmd('grenzwert'), cmd('kurvendiskussion', 'Kurvend.')],
      [cmd('extrempunkte', 'Extrema'), cmd('wendepunkte', 'Wendep.'), cmd('tangente'), cmd('näherung')],
      ['[left]', '[right]', ',', '[backspace]', '[return]'],
    ],
  },
  {
    label: 'Chemie',
    tooltip: 'Chemie: Formeln, Reaktionen, Einheiten, Konstanten',
    rows: [
      [{ latex: 'H_2', label: 'H₂' }, { latex: 'O_2', label: 'O₂' }, { latex: 'N_2', label: 'N₂' }, { latex: 'CO_2', label: 'CO₂' }, { latex: 'SO_4^{2-}', label: 'SO₄²⁻' }, { latex: 'NH_4^{+}', label: 'NH₄⁺' }, { latex: '_{#?}', label: 'X₂' }, { latex: '^{#?}', label: 'Xⁿ⁺' }],
      [{ latex: '\\rightarrow', label: '→' }, { latex: '\\rightleftharpoons', label: '⇌' }, { latex: '\\uparrow', label: '↑' }, { latex: '\\downarrow', label: '↓' }, { latex: '\\Delta', label: 'Δ' }, { latex: 'e^{-}', label: 'e⁻' }, '+', '(', ')', { latex: ';', label: ';' }],
      [{ latex: '\\,\\mathrm{mol}', label: 'mol' }, { latex: '\\,\\mathrm{g}', label: 'g' }, { latex: '\\,\\mathrm{L}', label: 'L' }, { latex: '\\,\\mathrm{mL}', label: 'mL' }, { latex: '\\,\\mathrm{M}', label: 'M' }, { latex: '\\,\\mathrm{K}', label: 'K' }, { latex: '^{\\circ}\\mathrm{C}', label: '°C' }, { latex: '\\,\\mathrm{bar}', label: 'bar' }, '=', { latex: ',', label: ',' }],
      ['[left]', '[right]', { latex: '\\mathrm{pH}\\left(#?;#?\\right)', label: 'pH', class: 'small' }, { latex: 'K_a\\left(#?\\right)', label: 'Ka', class: 'small' }, { latex: 'K_b\\left(#?\\right)', label: 'Kb', class: 'small' }, { latex: 'K_{sp}\\left(#?\\right)', label: 'Ksp', class: 'small' }, { latex: 'E^{\\circ}\\left(#?\\right)', label: 'E°', class: 'small' }, { latex: '\\Delta H\\left(#?\\right)', label: 'ΔH', class: 'small' }, { latex: '\\Delta G\\left(#?\\right)', label: 'ΔG', class: 'small' }, '[backspace]', '[return]'],
    ],
  },
  'alphabetic',
  'greek',
];

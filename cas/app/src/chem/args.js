// Reading the arguments of a chemistry command: top-level separation, options like T=25 °C, and a light reading of
// what a command call looks like as text.

import { fail } from './errors.js';

/**
 * Splits at the top level: on ";" when there is one, otherwise on a comma followed by a space ("c(NaCl), 5 g" style).
 * A decimal comma ("0,1 mol/L") never separates.
 */
export function splitArgs(text) {
  const s = String(text);
  let depth = 0;
  const cut = (test) => {
    const parts = [];
    let start = 0;
    depth = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (depth === 0 && test(s, i)) {
        parts.push(s.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(s.slice(start));
    return parts.map((p) => p.trim());
  };
  const semicolons = cut((t, i) => t[i] === ';');
  const parts = semicolons.length > 1 ? semicolons : cut((t, i) => t[i] === ',' && /\s/.test(t[i + 1] || ''));
  return parts.length === 1 && !parts[0] ? [] : parts;
}

/**
 * Separates positional arguments from options written as key=value with a plain key (T=25 °C, gesucht=Fe2O3).
 * Keys with brackets — m(Fe)=10 g — stay positional: they name a substance.
 */
export function parseArgs(args) {
  const positional = [];
  const options = {};
  for (const a of args) {
    const m = /^([A-Za-zΔÄÖÜäöüß][A-Za-zÄÖÜäöüß0-9_°Δ₀-₉]*)\s*=\s*(.+)$/.exec(a);
    if (m) options[m[1]] = m[2].trim();
    else positional.push(a);
  }
  return { positional, options };
}

/** Requires a number of positional arguments */
export function need(args, min, syntax) {
  if (args.length < min) fail('CHEM_SYNTAX', `Zu wenige Angaben. Schreibweise: ${syntax}`);
}

// Plain German in a text row: „Ableitung von x^3“, „Integral von x^2 von 0 bis 3“, „löse x^2 = 4 nach x“,
// „20 Prozent von 150“, „faktorisiere x^2 - 1“. Each phrase becomes the command it means; the row shows what was
// understood. Anything else is left as it is.

import { command } from './commands.js';

const T = '(.+?)';
const PHRASES = [
  [new RegExp(`^(?:die )?(zweite|dritte) ableitung von ${T}$`, 'i'), (m) => `ableiten(${m[2]}, x, ${m[1].toLowerCase() === 'zweite' ? 2 : 3})`],
  [new RegExp(`^(?:die )?ableitung von ${T}(?: nach ([a-z]))?$`, 'i'), (m) => `ableiten(${m[1]}${m[2] ? ', ' + m[2] : ''})`],
  [new RegExp(`^(?:das )?integral von ${T} von ${T} bis ${T}$`, 'i'), (m) => `integriere(${m[1]}, x, ${m[2]}, ${m[3]})`],
  [new RegExp(`^(?:eine |die )?stammfunktion von ${T}$`, 'i'), (m) => `stammfunktion(${m[1]})`],
  [new RegExp(`^(?:die )?fläche unter ${T} von ${T} bis ${T}$`, 'i'), (m) => `fläche(${m[1]}, ${m[2]}, ${m[3]})`],
  [new RegExp(`^(?:die )?(?:quadrat)?wurzel (?:aus|von) ${T}$`, 'i'), (m) => `wurzel(${m[1]})`],
  [new RegExp(`^(?:die )?nullstellen von ${T}$`, 'i'), (m) => `nullstellen(${m[1]})`],
  [new RegExp(`^(?:die )?extrempunkte von ${T}$`, 'i'), (m) => `extrempunkte(${m[1]})`],
  [new RegExp(`^(?:die )?wendepunkte von ${T}$`, 'i'), (m) => `wendepunkte(${m[1]})`],
  [new RegExp(`^untersuche ${T}$`, 'i'), (m) => `kurvendiskussion(${m[1]})`],
  [new RegExp(`^(?:der )?grenzwert von ${T} für ([a-z]) gegen ${T}$`, 'i'), (m) => `grenzwert(${m[1]}, ${m[2]}, ${m[3].replace(/unendlich/i, 'inf')})`],
  [new RegExp(`^(?:die )?tangente an ${T} (?:bei|in|an der stelle) x ?= ?${T}$`, 'i'), (m) => `tangente(${m[1]}, ${m[2]})`],
  [new RegExp(`^(?:die )?schnittpunkte? von ${T} und ${T}$`, 'i'), (m) => `schnittpunkt(${m[1]}, ${m[2]})`],
  [new RegExp(`^${T} prozent von ${T}$`, 'i'), (m) => `prozentwert(${m[1]}, ${m[2]})`],
  [new RegExp(`^wie viel prozent sind ${T} von ${T}\\??$`, 'i'), (m) => `prozentsatz(${m[1]}, ${m[2]})`],
  [new RegExp(`^löse ${T} nach ([a-z])$`, 'i'), (m) => `löse(${m[1]}, ${m[2]})`],
  [new RegExp(`^(?:berechne|was ist|wie viel ist|rechne) ${T}\\??$`, 'i'), (m) => m[1]],
  [new RegExp(`^(?:der )?mittelwert von ${T}$`, 'i'), (m) => `mittelwert(${m[1].startsWith('[') ? m[1] : '[' + m[1] + ']'})`],
];

/** The command a German phrase means, or null */
export function naturalToCommand(text) {
  const t = String(text || '').trim();
  if (!/\s/.test(t) || /[{}]/.test(t)) return null;
  for (const [pattern, build] of PHRASES) {
    const m = pattern.exec(t);
    if (m) return build(m);
  }
  // „faktorisiere x^2 - 1“: a command word, a space, then its argument
  const call = /^([A-Za-zÄÖÜäöüß]+)\s+(?!\()(.+)$/.exec(t);
  if (call && command(call[1]) && !/^[=<>]/.test(call[2])) return `${call[1]}(${call[2]})`;
  return null;
}

/** LaTeX typed into a text row, like $\frac{1}{2}$ or \sqrt{2}: read as formula */
export function latexInText(text) {
  const t = String(text || '').trim();
  const dollars = /^\$+([\s\S]+?)\$+$/.exec(t);
  if (dollars) return dollars[1];
  if (/\\(frac|sqrt|int|sum|cdot|left|pi|sin|cos|tan|ln|log|lim|operatorname|begin)\b/.test(t)) return t;
  return null;
}

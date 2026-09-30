// Plain German about chemistry → what the student means, as a structured intent and the command that answers it.
// This module never calculates: it only recognizes the task, the substances and the given quantities, and hands the
// result to the command language, where the calculation is done and shown.

import { isFormula } from './formula.js';
import { isReaction } from './reaction.js';
import { findSubstance } from './substances.js';

const NUM = '[-+]?\\d+(?:[.,]\\d+)?(?:\\s*(?:e|E|·\\s*10\\^?)\\s*[-+]?\\d+)?';
const UNIT = '(?:[kmµn]?(?:g|mol|L|l)|mol/L|g/mol|M|mM|kg|bar|Pa|kPa|atm|K|°C|J|kJ|s|min|h|A|V|mL|cm3)(?:/[A-Za-z]+)?';
const QUANTITY = `${NUM}\\s*${UNIT}`;
const SUBSTANCE = '[A-Za-zÄÖÜäöüß][A-Za-z0-9ÄÖÜäöüß()\\[\\]^+\\-·.]*';

/** "0,1 M Essigsäure" and "Essigsäure 0,1 mol/L" are both a solution: { substance, quantity } pairs in a text */
function quantitiesIn(text) {
  const out = [];
  const before = new RegExp(`(${QUANTITY})\\s+(${SUBSTANCE})`, 'g');
  let m;
  const used = [];
  while ((m = before.exec(text))) {
    if (isSubstanceWord(m[2])) {
      out.push({ quantity: m[1].trim(), substance: m[2] });
      used.push([m.index, m.index + m[0].length]);
    }
  }
  const after = new RegExp(`(${SUBSTANCE})\\s+(${QUANTITY})`, 'g');
  while ((m = after.exec(text))) {
    if (used.some(([a, b]) => m.index >= a && m.index < b)) continue;
    if (isSubstanceWord(m[1])) out.push({ quantity: m[2].trim(), substance: m[1] });
  }
  return out;
}

/** A word that is a formula or a name from the database (and not an ordinary German word) */
function isSubstanceWord(word) {
  const w = word.replace(/[.,;:?!]+$/, '');
  if (!w) return false;
  if (findSubstance(w)) return true;
  return /^[A-Z(\[]/.test(w) && /[A-Z]/.test(w) && isFormula(w);
}

const clean = (t) => t.replace(/[.?!]+$/, '').trim();

/** The first reaction equation in the text ("N2 + 3 H2 -> 2 NH3"), or null */
function reactionIn(text) {
  const m = /([A-Za-z0-9()\[\]^+\-·.\s/]+?(?:->|→|⇌|<=>|=>)[A-Za-z0-9()\[\]^+\-·.\s/]+)/.exec(text);
  if (!m) return null;
  let candidate = m[1].trim();
  // cut leading words before the first formula-looking term: "Gleiche Fe + O2" → "Fe + O2"
  const words = candidate.split(/\s+/);
  while (words.length > 1 && !/^\d*[A-Z(\[]/.test(words[0])) words.shift();
  candidate = words.join(' ').replace(/[.?!,]+$/, '').replace(/\s+(?:aus|ein)$/i, '');
  return isReaction(candidate) ? candidate : null;
}

const RULES = [
  // molar mass
  { intent: 'molarMass', re: /^(?:wie (?:hoch|gross|groß) ist )?(?:die )?(?:molare masse|molmasse|molekulargewicht)(?: von| des| der)?\s+(.+)$/i, build: (m) => ({ substance: clean(m[1]) }), command: (a) => `molmasse(${a.substance})` },
  { intent: 'molarMass', re: /^wie schwer ist (?:ein )?mol (.+)$/i, build: (m) => ({ substance: clean(m[1]) }), command: (a) => `molmasse(${a.substance})` },
  // amount
  { intent: 'amount', re: new RegExp(`^wie (?:viel|viele) mol (?:sind|ist|entsprechen) (${QUANTITY})\\s+(.+)$`, 'i'), build: (m) => ({ substance: clean(m[2]), quantity: m[1] }), command: (a) => `n(${a.substance}; ${a.quantity})` },
  { intent: 'amount', re: new RegExp(`^(?:die )?stoffmenge (?:von|in) (${QUANTITY})\\s+(.+)$`, 'i'), build: (m) => ({ substance: clean(m[2]), quantity: m[1] }), command: (a) => `n(${a.substance}; ${a.quantity})` },
  // mass
  { intent: 'mass', re: new RegExp(`^wie (?:viel|viele) gramm (?:sind|wiegen|entsprechen) (${QUANTITY})\\s+(.+)$`, 'i'), build: (m) => ({ substance: clean(m[2]), quantity: m[1] }), command: (a) => `m(${a.substance}; ${a.quantity})` },
  { intent: 'mass', re: new RegExp(`^(?:die )?masse (?:von|der|des) (${QUANTITY})\\s+(.+)$`, 'i'), build: (m) => ({ substance: clean(m[2]), quantity: m[1] }), command: (a) => `m(${a.substance}; ${a.quantity})` },
  // concentration
  { intent: 'concentration', re: new RegExp(`^(?:wie hoch ist )?(?:die )?konzentration (?:von|wenn|bei)\\s+(${QUANTITY})\\s+(${SUBSTANCE})\\s+(?:in|auf)\\s+(${QUANTITY})(?:\\s+.*)?$`, 'i'), build: (m) => ({ substance: m[2], amount: m[1], volume: m[3] }), command: (a) => `c(${a.substance}; ${a.amount}; ${a.volume})` },
  // volume of a gas
  { intent: 'volume', re: new RegExp(`^(?:wie viel volumen|welches volumen|wie gro(?:ß|ss) ist das volumen)\\s*(?:haben|hat|von|nehmen|nimmt)?\\s+(${QUANTITY})\\s+(.+)$`, 'i'), build: (m) => ({ substance: clean(m[2]), quantity: m[1] }), command: (a) => `V(${a.substance}; ${a.quantity})` },
  // balancing
  { intent: 'balance', re: /^(?:gleiche|gleich|glei[cs]he)\s+(.+?)\s+aus$/i, build: (m) => ({ reaction: clean(m[1]) }), command: (a) => `ausgleichen(${a.reaction})`, needsReaction: true },
  { intent: 'balance', re: /^(?:reaktionsgleichung|gleichung)\s+(?:ausgleichen|von)\s*:?\s*(.+)$/i, build: (m) => ({ reaction: clean(m[1]) }), command: (a) => `ausgleichen(${a.reaction})`, needsReaction: true },
  { intent: 'balance', re: /^(?:wie|kann man)\s+(?:gleicht man|gleiche ich)\s+(.+?)\s+aus$/i, build: (m) => ({ reaction: clean(m[1]) }), command: (a) => `ausgleichen(${a.reaction})`, needsReaction: true },
  // redox
  { intent: 'redox', re: /^(?:redox(?:gleichung)?|gleiche (?:die )?redox(?:gleichung)?)\s*:?\s*(.+?)(?:\s+aus)?$/i, build: (m) => ({ reaction: clean(m[1]) }), command: (a) => `redox(${a.reaction})`, needsReaction: true },
  // oxidation numbers
  { intent: 'oxidationNumber', re: /^(?:die )?oxidationszahl(?:en)? (?:von|des|der) ([A-Z][a-z]?) (?:in|im|bei) (.+)$/i, build: (m) => ({ element: m[1], substance: clean(m[2]) }), command: (a) => `oxidationszahl(${a.substance}; ${a.element})` },
  { intent: 'oxidationNumber', re: /^(?:die )?oxidationszahlen? (?:von|in|der|des)\s+(.+)$/i, build: (m) => ({ substance: clean(m[1]) }), command: (a) => `oxidationszahl(${a.substance})` },
  // pH
  { intent: 'pH', re: new RegExp(`^(?:berechne |wie hoch ist |bestimme )?(?:den |der |die )?ph(?:-wert)?(?: von| einer| eines| der| des| bei)?\\s*(?:lösung|loesung)?\\s*(?:von )?(.*(?:${QUANTITY}).*)$`, 'i'), build: (m) => phArgs(m[1]), command: (a) => (a.solutions.length ? `pH(${a.solutions.join('; ')})` : null) },
  // titration
  { intent: 'titration', re: /^titration (?:von )?(.+?) mit (.+)$/i, build: (m) => ({ analyte: clean(m[1]), titrant: clean(m[2]) }), command: (a) => `titration(${a.analyte}; ${a.titrant})` },
  // cell voltage
  { intent: 'cell', re: /^(?:die )?(?:zellspannung|spannung)\s+(?:von|zwischen|der zelle)?\s*([A-Za-z0-9+^\-/]+)\s+(?:und|mit|\/|\|)\s+([A-Za-z0-9+^\-/]+)$/i, build: (m) => ({ a: m[1], b: m[2] }), command: (a) => `zellspannung(${a.a}; ${a.b})` },
  // solubility
  { intent: 'solubility', re: /^(?:die )?(?:löslichkeit|loeslichkeit) (?:von|des|der)\s+(.+)$/i, build: (m) => ({ substance: clean(m[1]) }), command: (a) => `löslichkeit(${a.substance})` },
  // thermodynamics
  { intent: 'enthalpy', re: /^(?:die )?(?:reaktions)?enthalpie (?:von|der reaktion)\s*:?\s*(.+)$/i, build: (m) => ({ reaction: clean(m[1]) }), command: (a) => `reaktionsenthalpie(${a.reaction})`, needsReaction: true },
  { intent: 'gibbs', re: /^(?:die )?(?:freie (?:reaktions)?enthalpie|gibbs(?:-energie)?) (?:von|der reaktion)\s*:?\s*(.+)$/i, build: (m) => ({ reaction: clean(m[1]) }), command: (a) => `freieenthalpie(${a.reaction})`, needsReaction: true },
  // element and substance information
  { intent: 'element', re: /^(?:informationen|infos?|daten) (?:zu|über|von) (?:dem )?element (.+)$/i, build: (m) => ({ element: clean(m[1]) }), command: (a) => `element(${a.element})` },
  { intent: 'substance', re: /^(?:informationen|infos?|daten|was ist) (?:zu|über|von)?\s*(?:dem |der |die |das )?(?:stoff )?(.+)$/i, build: (m) => ({ substance: clean(m[1]) }), command: (a) => (findSubstance(a.substance) ? `stoffinfo(${a.substance})` : null) },
];

/** "0,1 M Essigsäure und 0,1 M Natriumacetat" → solutions ["Essigsäure 0,1 mol/L", …] */
function phArgs(text) {
  const solutions = quantitiesIn(text).map((q) => `${q.substance} ${q.quantity}`);
  return { solutions };
}

/**
 * The intent of a German sentence about chemistry:
 *   { intent, confidence ('high' | 'medium'), args, command, understood } or { intent: 'unknown' }
 * `command` is text for the command language; nothing is calculated here.
 */
export function parseChemicalIntent(input) {
  const text = String(input || '').trim().replace(/\s+/g, ' ').replace(/-?\s?(?:lösung|loesung)\b/gi, (m, offset, whole) => (/ph/i.test(whole) || /\d/.test(whole) ? '' : m));
  if (!text) return { intent: 'unknown', confidence: 'none' };
  // a bare reaction equation
  if (isReaction(text)) return { intent: 'balance', confidence: 'high', args: { reaction: text }, command: `ausgleichen(${text})`, understood: 'Reaktionsgleichung ausgleichen' };
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (!m) continue;
    const args = rule.build(m);
    if (rule.needsReaction && !isReaction(args.reaction)) continue;
    const command = rule.command(args);
    if (!command) continue;
    return { intent: rule.intent, confidence: 'high', args, command, understood: text };
  }
  // a sentence that holds a reaction and quantities: stoichiometry
  const reaction = reactionIn(text);
  if (reaction) {
    const givens = quantitiesIn(text.replace(reaction, ' ')).map((q) => `${q.quantity} ${q.substance}`);
    if (givens.length) {
      const limiting = /limitier|begrenz|überschuss|ueberschuss/i.test(text);
      const yieldWord = /ausbeute/i.test(text);
      const wanted = /wie viel(?:e)?\s+(?:gramm |mol |liter )?([A-Za-z0-9()]+)\s+(?:entsteh|bildet|entstehen|erh)/i.exec(text);
      const command = `${yieldWord ? 'ausbeute' : limiting ? 'limitierenderstoff' : 'stöchiometrie'}(${[reaction, ...givens, ...(wanted && !yieldWord ? [`gesucht=${wanted[1]}`] : [])].join('; ')})`;
      return { intent: yieldWord ? 'yield' : limiting ? 'limiting' : 'stoichiometry', confidence: 'medium', args: { reaction, givens, wanted: wanted ? wanted[1] : null }, command, understood: text };
    }
  }
  return { intent: 'unknown', confidence: 'none' };
}

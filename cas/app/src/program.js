// Programs in the calculator. Students write them in German blocks:
//
//   programm fak(n)
//     wenn n <= 1 dann
//       zurück 1
//     ende
//     zurück n * fak(n - 1)
//   ende
//
// and they become Giac programs: fak(n):={ if (n<=1) { return 1; }; return n*fak(n-1); }. Giac's own syntax with
// { … } works as well. German commands inside are translated like everywhere else.

export const KEYWORDS = ['programm', 'funktion', 'lokal', 'wenn', 'dann', 'sonst', 'solange', 'tue', 'mache', 'für', 'fuer', 'von', 'bis', 'schritt', 'wiederhole', 'mal', 'zurück', 'zurueck', 'rückgabe', 'rueckgabe', 'ausgabe', 'zeige', 'abbrechen', 'weiter', 'ende', 'und', 'oder', 'nicht'];

const HEADER = /^\s*(?:programm|funktion)\s+([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)\s*\(([^)]*)\)\s*$/i;
const HEADER_ASSIGN = /^\s*([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)\s*\(([^)]*)\)\s*:?=\s*programm\s*$/i;
const GIAC_PROGRAM = /^\s*([A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*)\s*\(([^)]*)\)\s*:=\s*\{[\s\S]*\}\s*;?\s*$/;

/** A program in German blocks or Giac braces, or a lambda such as x -> x^2 */
export function isProgram(text) {
  const t = String(text || '');
  const first = t.split('\n').find((line) => line.trim()) || '';
  return HEADER.test(first) || HEADER_ASSIGN.test(first) || GIAC_PROGRAM.test(t);
}

/** Open blocks left in a program being typed: Enter adds a line until they are closed. */
export function openBlocks(text) {
  let depth = 0;
  for (const raw of String(text).split('\n')) {
    const line = stripComment(raw).trim().toLowerCase();
    if (!line) continue;
    if (HEADER.test(line) || HEADER_ASSIGN.test(line)) depth++;
    else if (/^(wenn\b.*\bdann|solange\b|für\b|fuer\b|wiederhole\b)/.test(line)) depth++;
    else if (/^ende\b/.test(line)) depth--;
  }
  const braces = (String(text).match(/\{/g) || []).length - (String(text).match(/\}/g) || []).length;
  return Math.max(depth, braces, 0);
}

function stripComment(line) {
  return line.replace(/(#|\/\/).*$/, '');
}

let counter = 0;

/**
 * Giac text of a program. `mapCalls(text)` translates German commands inside expressions.
 * Returns { name, params, giac } or throws with a message naming the line.
 */
export function translateProgram(text, mapCalls = (t) => t) {
  const source = String(text);
  const giacForm = GIAC_PROGRAM.exec(source);
  if (giacForm) {
    const body = source.slice(source.indexOf(':=') + 2);
    return { name: giacForm[1], params: splitParams(giacForm[2]), giac: `${giacForm[1]}(${giacForm[2]}):=${mapCalls(body.trim().replace(/;\s*$/, ''))}` };
  }
  const lines = source.split('\n').map((l, i) => ({ text: stripComment(l).trim(), number: i + 1 })).filter((l) => l.text);
  const header = HEADER.exec(lines[0].text) || HEADER_ASSIGN.exec(lines[0].text);
  if (!header) throw new Error('Ein Programm beginnt mit „programm name(parameter)“.');
  const [, name, paramText] = header;
  const params = splitParams(paramText);
  const out = [];
  const stack = ['programm'];
  // Variables the program assigns stay inside it, as if declared with lokal.
  const assigned = new Set();
  const expr = (t, line) => {
    if (!t.trim()) throw new Error(`Zeile ${line}: hier fehlt ein Ausdruck.`);
    return mapCalls(words(t));
  };
  const condition = (t, line) => expr(t.replace(/([^<>=!:])=(?!=)/g, '$1=='), line);
  for (const { text: line, number } of lines.slice(1)) {
    const lower = line.toLowerCase();
    let m;
    if (/^ende$/.test(lower)) {
      const block = stack.pop();
      if (!block) throw new Error(`Zeile ${number}: „ende“ ohne offenen Block.`);
      if (block !== 'programm') out.push('}');
      if (!stack.length) break;
    } else if ((m = /^lokal\s+(.+)$/i.exec(line))) {
      out.push(`local ${m[1].split(/\s*,\s*/).join(',')};`);
    } else if ((m = /^sonst\s+wenn\s+(.+?)\s+dann$/i.exec(line))) {
      if (stack[stack.length - 1] !== 'wenn') throw new Error(`Zeile ${number}: „sonst wenn“ gehört zu einem „wenn“.`);
      out.push(`} else if (${condition(m[1], number)}) {`);
    } else if (/^sonst$/i.test(line)) {
      if (stack[stack.length - 1] !== 'wenn') throw new Error(`Zeile ${number}: „sonst“ gehört zu einem „wenn“.`);
      out.push('} else {');
    } else if ((m = /^wenn\s+(.+?)\s+dann$/i.exec(line))) {
      stack.push('wenn');
      out.push(`if (${condition(m[1], number)}) {`);
    } else if ((m = /^wenn\s+(.+?)\s+dann\s+(.+)$/i.exec(line))) {
      // wenn n = 0 dann zurück 1 — a one-line if
      out.push(`if (${condition(m[1], number)}) { ${statement(m[2], number)} }`);
    } else if ((m = /^solange\s+(.+?)(?:\s+(?:tue|mache))?$/i.exec(line))) {
      stack.push('solange');
      out.push(`while (${condition(m[1], number)}) {`);
    } else if ((m = /^f(?:ü|ue)r\s+([A-Za-z_]\w*)\s+von\s+(.+?)\s+bis\s+(.+?)(?:\s+schritt\s+(.+?))?(?:\s+(?:tue|mache))?$/i.exec(line))) {
      stack.push('für');
      const [, v, from, to, step] = m;
      assigned.add(v);
      const s = step ? expr(step, number) : '1';
      const down = /^\s*-/.test(s);
      out.push(`for (${v}:=${expr(from, number)}; ${v}${down ? '>=' : '<='}${expr(to, number)}; ${v}:=${v}+(${s})) {`);
    } else if ((m = /^wiederhole\s+(.+?)\s+mal$/i.exec(line))) {
      stack.push('wiederhole');
      const v = `wdh__${++counter}`;
      out.push(`for (${v}:=1; ${v}<=${expr(m[1], number)}; ${v}:=${v}+1) {`);
    } else {
      out.push(statement(line, number));
    }
  }
  if (stack.length) throw new Error(`Es fehlt ${stack.length === 1 ? 'ein' : stack.length} „ende“ (für ${stack.map((b) => b).reverse().join(', ')}).`);
  const declared = new Set((out.join(' ').match(/local ([^;]+);/g) || []).flatMap((d) => d.slice(6, -1).split(',')));
  const locals = [...new Set([...(out.join(' ').match(/wdh__\d+/g) || []), ...[...assigned].filter((v) => !params.includes(v))])].filter((v) => !declared.has(v));
  const body = (locals.length ? `local ${locals.join(',')}; ` : '') + out.join(' ');
  return { name, params, giac: `${name}(${params.join(',')}):={ ${body} }` };

  function statement(line, number) {
    let m;
    if ((m = /^(?:zur(?:ü|ue)ck|r(?:ü|ue)ckgabe)\s+(.+)$/i.exec(line))) return `return ${expr(m[1], number)};`;
    if ((m = /^gib\s+(.+?)\s+zur(?:ü|ue)ck$/i.exec(line))) return `return ${expr(m[1], number)};`;
    if ((m = /^(?:ausgabe|zeige)\s+(.+)$/i.exec(line))) return `print(${expr(m[1], number)});`;
    if (/^abbrechen$/i.test(line)) return 'break;';
    if (/^weiter$/i.test(line)) return 'continue;';
    if ((m = /^([A-Za-z_]\w*(?:\[[^\]]+\])?)\s*:?=(?!=)\s*(.+)$/.exec(line))) {
      if (!m[1].includes('[')) assigned.add(m[1]);
      return `${m[1]}:=${expr(m[2], number)};`;
    }
    if (/^(wenn|solange|für|fuer|wiederhole)\b/i.test(line)) throw new Error(`Zeile ${number}: „${line}“ ist unvollständig (dann, von … bis, mal?).`);
    return `${expr(line, number)};`;
  }
}

function splitParams(text) {
  return String(text).split(',').map((p) => p.trim()).filter(Boolean);
}

/** und, oder, nicht, ≤, ≥, ≠ in expressions */
function words(text) {
  return String(text)
    .replace(/\bund\b/gi, ' and ').replace(/\boder\b/gi, ' or ').replace(/\bnicht\b/gi, ' not ')
    .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠|<>/g, '!=').replace(/·/g, '*').replace(/−/g, '-')
    .replace(/\bwahr\b/gi, 'true').replace(/\bfalsch\b/gi, 'false');
}

/**
 * German commands inside Giac text: every name(…) that `command` knows becomes its Giac form. Arguments are
 * split at top-level commas and translated first.
 */
export function mapCommandCalls(text, translate) {
  let out = '';
  let i = 0;
  const s = String(text);
  while (i < s.length) {
    const m = /^[A-Za-zÄÖÜäöüß_][\wÄÖÜäöüß]*/.exec(s.slice(i));
    if (m && (i === 0 || !/[\w.]/.test(s[i - 1]))) {
      const name = m[0];
      let j = i + name.length;
      while (s[j] === ' ') j++;
      if (s[j] === '(') {
        let depth = 0;
        let k = j;
        for (; k < s.length; k++) {
          if ('([{'.includes(s[k])) depth++;
          else if (')]}'.includes(s[k])) depth--;
          if (depth === 0) break;
        }
        const inner = s.slice(j + 1, k);
        const args = splitTop(inner).map((a) => mapCommandCalls(a, translate));
        const translated = translate(name, args);
        out += translated !== null ? translated : `${name}(${args.join(',')})`;
        i = k + 1;
        continue;
      }
      out += name;
      i += name.length;
      continue;
    }
    out += s[i++];
  }
  return out;
}

function splitTop(text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  if (text.trim() || parts.length) parts.push(text.slice(start));
  return parts.map((p) => p.trim());
}

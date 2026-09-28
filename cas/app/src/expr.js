// Expression trees for the whole calculator: one tree type, read from plain text (what Giac answers, what is typed
// in text mode) and from LaTeX (what the formula editor produces), and written as Giac input, as school-style LaTeX
// and as a JavaScript function for plotting.
//
// Nodes: { t: 'num', v: '3.5' } · { t: 'sym', v: 'x' } · { t: 'call', f: 'sin', args: [...] }
//        { t: 'op', op: '+'|'-'|'*'|'/'|'^', a, b } · { t: 'neg', a } · { t: 'rel', op: '='|'<'|'>'|'<='|'>='|'!=', a, b }
//        { t: 'list', items: [...] } · { t: 'fact', a } · { t: 'str', v } · { t: 'unit', a, unit: 'm*s^-1' }

export const MATH_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc', 'asin', 'acos', 'atan', 'acot', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh',
  'atanh', 'exp', 'ln', 'log', 'log10', 'lg', 'sqrt', 'abs', 'sign', 'floor', 'ceil', 'round', 'frac', 'max', 'min',
  'gcd', 'lcm', 'factorial', 'comb', 'perm', 'nthroot', 're', 'im', 'arg', 'conj',
]);

const GREEK = new Set([
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa',
  'lambda', 'mu', 'nu', 'xi', 'rho', 'sigma', 'tau', 'phi', 'varphi', 'chi', 'psi', 'omega', 'Gamma', 'Delta',
  'Theta', 'Lambda', 'Xi', 'Sigma', 'Phi', 'Psi', 'Omega',
]);

export const num = (v) => ({ t: 'num', v: String(v) });
export const sym = (v) => ({ t: 'sym', v });
export const call = (f, args) => ({ t: 'call', f, args });
export const op = (o, a, b) => ({ t: 'op', op: o, a, b });

export class ParseError extends Error {}

// Plain text

const PLAIN_TOKEN = /\s*(?:(\d+\.?\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?)|([A-Za-zÄÖÜäöüß_][A-Za-z0-9ÄÖÜäöüß_]*)|(<=|>=|!=|==|:=|->|[-+*/^()[\]{},;=<>!'|%.]))/y;

function tokenizePlain(text) {
  const tokens = [];
  PLAIN_TOKEN.lastIndex = 0;
  let index = 0;
  const source = String(text).replace(/\s+$/, '');
  while (index < source.length) {
    PLAIN_TOKEN.lastIndex = index;
    const match = PLAIN_TOKEN.exec(source);
    if (!match) throw new ParseError('Unbekanntes Zeichen: ' + source.slice(index, index + 1));
    if (match[1] !== undefined) tokens.push({ k: 'num', v: match[1] });
    else if (match[2] !== undefined) tokens.push({ k: 'id', v: match[2] });
    else tokens.push({ k: 'op', v: match[3] });
    index = PLAIN_TOKEN.lastIndex;
  }
  return tokens;
}

/**
 * Parses plain math text, as Giac prints it or as typed in text mode. `isFunction(name)` decides whether `name(…)`
 * is a call or a multiplication, e.g. x(x+1); Giac's own output always means a call.
 */
export function parsePlain(text, { isFunction = () => true } = {}) {
  const tokens = tokenizePlain(text);
  let pos = 0;
  const peek = (o = 0) => tokens[pos + o];
  const is = (v) => peek() && peek().k === 'op' && peek().v === v;
  const take = (v) => {
    if (!is(v)) throw new ParseError('Erwartet: ' + v);
    pos++;
  };

  function sequence() {
    const items = [relation()];
    while (is(',')) {
      pos++;
      items.push(relation());
    }
    return items.length === 1 ? items[0] : { t: 'list', items, seq: true };
  }

  function relation() {
    let left = additive();
    const token = peek();
    if (token && token.k === 'op' && ['=', '<', '>', '<=', '>=', '!=', '=='].includes(token.v)) {
      pos++;
      const right = additive();
      left = { t: 'rel', op: token.v === '==' ? '=' : token.v, a: left, b: right };
    }
    return left;
  }

  function additive() {
    let left = multiplicative();
    for (;;) {
      if (is('+')) {
        pos++;
        left = op('+', left, multiplicative());
      } else if (is('-')) {
        pos++;
        left = op('-', left, multiplicative());
      } else return left;
    }
  }

  function startsFactor() {
    const token = peek();
    if (!token) return false;
    if (token.k === 'num' || token.k === 'id') return true;
    return token.k === 'op' && (token.v === '(' || token.v === '[');
  }

  function multiplicative() {
    let left = unary();
    for (;;) {
      if (is('*')) {
        pos++;
        left = op('*', left, unary());
      } else if (is('/')) {
        pos++;
        left = op('/', left, unary());
      } else if (startsFactor()) {
        left = op('*', left, power());
      } else return left;
    }
  }

  function unary() {
    if (is('-')) {
      pos++;
      return { t: 'neg', a: unary() };
    }
    if (is('+')) {
      pos++;
      return unary();
    }
    return power();
  }

  function power() {
    const base = postfix();
    if (is('^')) {
      pos++;
      return op('^', base, unary());
    }
    return base;
  }

  function postfix() {
    let node = primary();
    for (;;) {
      if (is('!')) {
        pos++;
        node = { t: 'fact', a: node };
      } else if (is('%')) {
        pos++;
        node = op('/', node, num(100));
      } else return node;
    }
  }

  function args() {
    take('(');
    const list = [];
    if (!is(')')) {
      list.push(relation());
      while (is(',')) {
        pos++;
        list.push(relation());
      }
    }
    take(')');
    return list;
  }

  function bracketList() {
    take('[');
    const items = [];
    if (!is(']')) {
      items.push(relation());
      while (is(',')) {
        pos++;
        items.push(relation());
      }
    }
    take(']');
    return { t: 'list', items };
  }

  function primary() {
    const token = peek();
    if (!token) throw new ParseError('Der Ausdruck ist unvollständig.');
    if (token.k === 'num') {
      pos++;
      return num(token.v.startsWith('.') ? '0' + token.v : token.v.replace(/\.$/, ''));
    }
    if (token.k === 'id') {
      pos++;
      const name = token.v;
      // Giac's containers: list[1,2], matrix[[..]], set[..], group[..]
      if (['list', 'matrix', 'set', 'group', 'vector', 'seq'].includes(name) && is('[')) {
        const list = bracketList();
        list.kind = name;
        return list;
      }
      if (is("'")) {
        // f'(x), f''(x): the derivative of a defined function
        let order = 0;
        while (is("'")) {
          pos++;
          order++;
        }
        if (is('(')) return { t: 'call', f: name, args: args(), prime: order };
        return { t: 'call', f: name, args: [], prime: order };
      }
      // Giac units: _(km/h) as one symbol; _m, _kWh are plain names already.
      if (name === '_' && is('(')) {
        let depth = 0;
        let unit = '';
        do {
          const t = tokens[pos++];
          if (t.v === '(') depth++;
          if (t.v === ')') depth--;
          unit += t.v;
        } while (depth > 0 && pos < tokens.length);
        return sym('_' + unit);
      }
      if (is('(') && isFunction(name)) return call(name, args());
      return sym(name);
    }
    if (token.v === '(') {
      pos++;
      const inner = sequence();
      take(')');
      return inner.t === 'list' && inner.seq ? { ...inner, seq: false, paren: true } : { ...inner, paren: true };
    }
    if (token.v === '[') return bracketList();
    if (token.v === '|') {
      pos++;
      const inner = additive();
      take('|');
      return call('abs', [inner]);
    }
    throw new ParseError('Unerwartet: ' + token.v);
  }

  const tree = sequence();
  if (pos < tokens.length) throw new ParseError('Unerwartet: ' + tokens[pos].v);
  return strip(tree);
}

/** Removes the parse-only `paren` flags. */
function strip(node) {
  if (!node || typeof node !== 'object') return node;
  const copy = { ...node };
  delete copy.paren;
  if (copy.a) copy.a = strip(copy.a);
  if (copy.b) copy.b = strip(copy.b);
  if (copy.args) copy.args = copy.args.map(strip);
  if (copy.items) copy.items = copy.items.map(strip);
  return copy;
}

// LaTeX

const LATEX_FUNCTIONS = {
  '\\sin': 'sin', '\\cos': 'cos', '\\tan': 'tan', '\\cot': 'cot', '\\sec': 'sec', '\\csc': 'csc', '\\arcsin': 'asin',
  '\\arccos': 'acos', '\\arctan': 'atan', '\\arccot': 'acot', '\\sinh': 'sinh', '\\cosh': 'cosh', '\\tanh': 'tanh',
  '\\ln': 'ln', '\\log': 'log', '\\lg': 'log10', '\\exp': 'exp', '\\max': 'max', '\\min': 'min', '\\gcd': 'gcd',
  '\\det': 'det', '\\arg': 'arg', '\\Re': 're', '\\Im': 'im',
};

const LATEX_SYMBOLS = {
  '\\pi': 'pi', '\\infty': 'inf', '\\exponentialE': 'e', '\\imaginaryI': 'i', '\\mathrm{e}': 'e', '\\mathrm{i}': 'i',
  '\\degree': 'degree', '\\circ': 'degree',
};

function tokenizeLatex(latex) {
  const tokens = [];
  let i = 0;
  const s = String(latex);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === '\\') {
      const word = /^\\([A-Za-z]+|.)/.exec(s.slice(i));
      const command = '\\' + word[1];
      i += word[0].length;
      // Spacing commands carry no meaning.
      if ([`\\,`, '\\;', '\\:', '\\!', '\\ ', '\\quad', '\\qquad', '\\displaystyle', '\\limits', '\\mathstrut'].includes(command)) continue;
      tokens.push({ k: 'cmd', v: command });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      // A decimal comma written as {,} by the formula editor
      while (s.startsWith('{,}', j) && /[0-9]/.test(s[j + 3] || '')) {
        j += 3;
        while (j < s.length && /[0-9]/.test(s[j])) j++;
      }
      tokens.push({ k: 'num', v: s.slice(i, j).replace(/\{,\}/g, '.') });
      i = j;
      continue;
    }
    if (/[A-Za-zÄÖÜäöüß]/.test(c)) {
      tokens.push({ k: 'letter', v: c });
      i++;
      continue;
    }
    tokens.push({ k: 'op', v: c });
    i++;
  }
  return tokens;
}

/**
 * Parses the LaTeX of the formula editor. `names` are multi-letter words to recognize when typed letter by letter
 * (commands, defined objects); everything else splits into single letters that multiply, as in maths. `isFunction`
 * decides whether a name followed by parentheses is called.
 */
export function parseLatex(latex, { names = [], isFunction = (name) => MATH_FUNCTIONS.has(name) } = {}) {
  const tokens = tokenizeLatex(latex);
  const words = [...names].filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  let pos = 0;
  const peek = (o = 0) => tokens[pos + o];
  const isOp = (v, o = 0) => peek(o) && peek(o).k === 'op' && peek(o).v === v;
  const isCmd = (v, o = 0) => peek(o) && peek(o).k === 'cmd' && peek(o).v === v;
  const takeOp = (v) => {
    if (!isOp(v)) throw new ParseError('Erwartet: ' + v);
    pos++;
  };

  // A {...} group, or a single token after ^ and _.
  function group() {
    if (isOp('{')) {
      pos++;
      const inner = isOp('}') ? null : sequence(() => isOp('}'));
      takeOp('}');
      return inner;
    }
    const token = peek();
    if (!token) throw new ParseError('Der Ausdruck ist unvollständig.');
    if (token.k === 'num' && token.v.length > 1 && !token.v.includes('.')) {
      // x^23 in LaTeX means x^2·3; the editor always writes braces, so this is rare.
      pos++;
      tokens.splice(pos, 0, { k: 'num', v: token.v.slice(1) });
      return num(token.v[0]);
    }
    return primary();
  }

  function rawText() {
    // \operatorname{name}, \mathrm{name}, \text{…}; MathLive may nest them: \operatorname{\mathrm{löse}}
    takeOp('{');
    let text = '';
    let depth = 1;
    for (;;) {
      const token = peek();
      if (!token) throw new ParseError('Erwartet: }');
      pos++;
      if (token.k === 'op' && token.v === '{') depth++;
      else if (token.k === 'op' && token.v === '}') {
        if (--depth === 0) break;
      } else text += token.k === 'cmd' ? (token.v === '\\_' ? '_' : '') : token.v;
    }
    return text;
  }

  function sequence(stop) {
    const items = [relation(stop)];
    while (isOp(',') || isOp(';')) {
      pos++;
      items.push(relation(stop));
    }
    return items.length === 1 ? items[0] : { t: 'list', items, seq: true };
  }

  const RELATIONS = { '=': '=', '<': '<', '>': '>', '\\le': '<=', '\\leq': '<=', '\\ge': '>=', '\\geq': '>=', '\\ne': '!=', '\\neq': '!=', '\\lt': '<', '\\gt': '>', '\\leqslant': '<=', '\\geqslant': '>=' };

  function relationOp() {
    const token = peek();
    if (!token) return null;
    if (token.k === 'op' && token.v === ':' && isOp('=', 1)) return ':=';
    if (token.k === 'op' && ['=', '<', '>'].includes(token.v)) return RELATIONS[token.v];
    if (token.k === 'cmd' && RELATIONS[token.v]) return RELATIONS[token.v];
    if (token.k === 'cmd' && token.v === '\\coloneq') return ':=';
    return null;
  }

  function relation(stop) {
    let left = additive(stop);
    const relationToken = relationOp();
    if (relationToken) {
      pos += relationToken === ':=' && isOp(':') ? 2 : 1;
      // <= typed as two characters
      let operator = relationToken;
      if ((operator === '<' || operator === '>') && isOp('=')) {
        pos++;
        operator += '=';
      }
      const right = additive(stop);
      left = { t: 'rel', op: operator, a: left, b: right };
    }
    return left;
  }

  function additive(stop) {
    let left = multiplicative(stop);
    for (;;) {
      if (stop && stop()) return left;
      if (isOp('+')) {
        pos++;
        left = op('+', left, multiplicative(stop));
      } else if (isOp('-')) {
        pos++;
        left = op('-', left, multiplicative(stop));
      } else if (isCmd('\\pm')) {
        pos++;
        left = op('+', left, multiplicative(stop));
      } else return left;
    }
  }

  function startsFactor(stop) {
    if (stop && stop()) return false;
    const token = peek();
    if (!token) return false;
    if (token.k === 'num' || token.k === 'letter') return true;
    if (token.k === 'op') return ['(', '[', '|'].includes(token.v) && !(token.v === '|' && closingBar);
    if (token.k === 'cmd') {
      return !['\\right', '\\cdot', '\\times', '\\div', '\\le', '\\leq', '\\ge', '\\geq', '\\ne', '\\neq', '\\lt', '\\gt', '\\to', '\\rightarrow', '\\end', '\\pm', '\\mid', '\\vert', '\\rvert', '\\rbrace', '\\rbrack', '\\coloneq'].includes(token.v)
        && !(token.v === '\\vert' && closingBar);
    }
    return false;
  }

  let closingBar = 0;

  function multiplicative(stop) {
    let left = unary(stop);
    for (;;) {
      if (stop && stop()) return left;
      if (isOp('*') || isCmd('\\cdot') || isCmd('\\times') || isCmd('\\ast')) {
        pos++;
        left = op('*', left, unary(stop));
      } else if (isOp('/') || isCmd('\\div')) {
        pos++;
        left = op('/', left, unary(stop));
      } else if (startsFactor(stop)) {
        left = op('*', left, power(stop));
      } else return left;
    }
  }

  function unary(stop) {
    if (isOp('-')) {
      pos++;
      return { t: 'neg', a: unary(stop) };
    }
    if (isOp('+')) {
      pos++;
      return unary(stop);
    }
    return power(stop);
  }

  let inLimitTarget = false;

  function power(stop) {
    let base = postfix();
    for (;;) {
      // 30^{\circ}: degrees
      if (isOp('^') && (isCmd('\\circ', 1) || (isOp('{', 1) && isCmd('\\circ', 2) && isOp('}', 3)))) {
        pos += isCmd('\\circ', 1) ? 2 : 4;
        base = op('*', base, op('/', sym('pi'), num(180)));
        continue;
      }
      if (isOp('^') && inLimitTarget) return base;
      if (isOp('^')) {
        pos++;
        const exponent = group();
        base = op('^', base, exponent);
        base = postfixOps(base);
      } else if (isOp('_') && base.t === 'sym') {
        // a_1, x_{0}: a subscripted name
        pos++;
        const sub = group();
        base = sym(base.v + '_' + flat(sub));
        base = maybeCall(base);
      } else return base;
    }
  }

  function flat(node) {
    if (!node) return '';
    if (node.t === 'num' || node.t === 'sym') return node.v;
    if (node.t === 'op' && node.op === '*') return flat(node.a) + flat(node.b);
    return toGiac(node);
  }

  function postfixOps(node) {
    for (;;) {
      if (isOp('!')) {
        pos++;
        node = { t: 'fact', a: node };
      } else if (isCmd('\\%') || isOp('%')) {
        pos++;
        node = op('/', node, num(100));
      } else if (isCmd('\\degree') || (isOp('^') && isCmd('\\circ', 1))) {
        pos += isOp('^') ? 2 : 1;
        node = op('*', node, op('/', sym('pi'), num(180)));
      } else return node;
    }
  }

  function postfix() {
    return postfixOps(primary());
  }

  function delimited(close) {
    const inner = isCmd('\\right') ? null : sequence(() => isCmd('\\right') || isCmd('\\mright') || (close && isOp(close)));
    return inner;
  }

  function leftRight() {
    // \left( … \right)  \left[ … \right]  \left| … \right|  \left\lbrace … \right\rbrace
    pos++;
    const open = peek();
    pos++;
    const inner = delimited();
    if (!(isCmd('\\right') || isCmd('\\mright'))) throw new ParseError('Klammer nicht geschlossen.');
    pos++;
    const close = peek();
    pos++;
    const opening = open.v;
    if (opening === '|' || opening === '\\vert' || opening === '\\lvert') return call('abs', [inner]);
    if (opening === '[' || opening === '\\lbrack') {
      if (close && (close.v === ')' || close.v === '[')) return { t: 'interval', open, close, inner };
      return inner && inner.t === 'list' && inner.seq ? { t: 'list', items: inner.items } : { t: 'list', items: inner ? [inner] : [] };
    }
    if (opening === '\\lbrace' || opening === '\\{') return inner && inner.t === 'list' ? { t: 'list', items: inner.items, kind: 'set' } : { t: 'list', items: inner ? [inner] : [], kind: 'set' };
    if (!inner) throw new ParseError('Leere Klammer.');
    return inner.t === 'list' && inner.seq ? { ...inner, seq: false, tuple: true } : inner;
  }

  // A name followed by (…) becomes a call if it is a function.
  function maybeCall(node) {
    if (node.t !== 'sym' || !isFunction(node.v)) return node;
    if (isOp('(')) {
      pos++;
      const inner = isOp(')') ? null : sequence(() => isOp(')'));
      takeOp(')');
      return call(node.v, listItems(inner));
    }
    if (isCmd('\\left') && peek(1) && peek(1).v === '(') {
      pos += 2;
      const inner = delimited();
      pos += 2;
      return call(node.v, listItems(inner));
    }
    return node;
  }

  function listItems(inner) {
    if (!inner) return [];
    return inner.t === 'list' && (inner.seq || inner.tuple) ? inner.items : [inner];
  }

  // The argument of \sin x or \sin(x): a parenthesized group, or the next power term.
  function functionArgument() {
    if (isOp('(') || (isCmd('\\left') && peek(1) && peek(1).v === '(')) {
      if (isOp('(')) {
        pos++;
        const inner = sequence(() => isOp(')'));
        takeOp(')');
        return listItems(inner);
      }
      pos += 2;
      const inner = delimited();
      pos += 2;
      return listItems(inner);
    }
    return [power()];
  }

  function letters() {
    // Merge letters typed one by one into a known word: nullstellen, löse, f1 …
    let run = '';
    let k = pos;
    while (peek(k - pos) && (peek(k - pos).k === 'letter' || (run && peek(k - pos).k === 'num' && /^\d+$/.test(peek(k - pos).v)))) {
      run += peek(k - pos).v;
      k++;
    }
    for (const word of words) {
      if (run.startsWith(word)) {
        pos += countTokens(word);
        return sym(word);
      }
    }
    const token = peek();
    pos++;
    return sym(token.v);
  }

  function countTokens(word) {
    // Letters are one token each, digit runs one token.
    let count = 0;
    let i = 0;
    while (i < word.length) {
      if (/\d/.test(word[i])) {
        while (i < word.length && /\d/.test(word[i])) i++;
      } else i++;
      count++;
    }
    return count;
  }

  function bigOperator(kind) {
    // \int_{a}^{b} f \,dx · \sum_{k=1}^{n} f · \prod_{k=1}^{n} f
    let lower = null;
    let upper = null;
    for (let n = 0; n < 2; n++) {
      if (isOp('_')) {
        pos++;
        lower = group();
      } else if (isOp('^')) {
        pos++;
        upper = group();
      }
    }
    if (kind === 'int') {
      let variable = null;
      const body = additive(() => {
        if (isCmd('\\differentialD') || isCmd('\\mathrm') || (peek() && peek().k === 'letter' && peek().v === 'd' && peek(1) && peek(1).k === 'letter' && !peek(2))) return true;
        return peek() && peek().k === 'letter' && peek().v === 'd' && peek(1) && peek(1).k === 'letter' && (!peek(2) || peek(2).k !== 'letter');
      });
      if (isCmd('\\differentialD')) {
        pos++;
        variable = primary();
      } else if (isCmd('\\mathrm') && tokens[pos + 2] && tokens[pos + 2].v === 'd') {
        pos += 4;
        variable = primary();
      } else if (peek() && peek().v === 'd') {
        pos++;
        variable = primary();
      }
      const v = variable || sym('x');
      return lower && upper ? call('integrate', [body, v, lower, upper]) : call('integrate', [body, v]);
    }
    const body = power();
    if (lower && lower.t === 'rel' && lower.op === '=') {
      return call(kind === 'sum' ? 'sum' : 'product', [body, lower.a, lower.b, upper || sym('inf')]);
    }
    return call(kind === 'sum' ? 'sum' : 'product', [body]);
  }

  function limit() {
    // \lim_{x\to a} f, \lim_{x\to a^+} f
    let variable = sym('x');
    let target = num(0);
    let side = null;
    if (isOp('_')) {
      pos++;
      takeOp('{');
      variable = primary();
      if (isCmd('\\to') || isCmd('\\rightarrow') || isCmd('\\longrightarrow')) pos++;
      else if (isOp('-') && isOp('>', 1)) pos += 2;
      inLimitTarget = true;
      target = additive(() => isOp('}') || isOp('^'));
      inLimitTarget = false;
      if (isOp('^')) {
        // x → a^+ or a^{-}: from the right or the left
        pos++;
        const braced = isOp('{');
        if (braced) pos++;
        side = isOp('-') ? -1 : 1;
        if (isOp('-') || isOp('+')) pos++;
        if (braced) takeOp('}');
      }
      takeOp('}');
    }
    const body = additive(() => relationOp() !== null);
    return call('limit', side ? [body, variable, target, num(side)] : [body, variable, target]);
  }

  function environment() {
    // \begin{pmatrix} a & b \\ c & d \end{pmatrix} → [[a, b], [c, d]]
    pos++;
    const name = rawText();
    const rows = [[]];
    while (!isCmd('\\end')) {
      if (!peek()) throw new ParseError('\\end fehlt.');
      if (isOp('&')) {
        pos++;
        continue;
      }
      if (isCmd('\\\\') || isCmd('\\cr')) {
        pos++;
        rows.push([]);
        continue;
      }
      rows[rows.length - 1].push(additive(() => isOp('&') || isCmd('\\\\') || isCmd('\\end') || isCmd('\\cr')));
    }
    pos++;
    rawText();
    const filled = rows.filter((row) => row.length);
    if (name === 'cases') {
      // piecewise: value & condition rows
      const args = [];
      for (const row of filled) {
        if (row.length === 2) args.push(row[1], row[0]);
        else args.push(row[0]);
      }
      return call('piecewise', args);
    }
    // A single column is a vector.
    if (filled.every((row) => row.length === 1) && filled.length > 1) return { t: 'list', items: filled.map((row) => row[0]), vector: true };
    return { t: 'list', items: filled.map((row) => ({ t: 'list', items: row })) };
  }

  function primary() {
    const token = peek();
    if (!token) throw new ParseError('Der Ausdruck ist unvollständig.');
    if (token.k === 'num') {
      pos++;
      return num(token.v);
    }
    if (token.k === 'letter') {
      const node = letters();
      if (isOp("'")) {
        let order = 0;
        while (isOp("'")) {
          pos++;
          order++;
        }
        const args = isOp('(') || isCmd('\\left') ? functionArgument() : [];
        return { t: 'call', f: node.v, args, prime: order };
      }
      if (isOp('^') && isCmd('\\prime', 1)) {
        let order = 0;
        while (isOp('^') && isCmd('\\prime', 1)) {
          pos += 2;
          order++;
        }
        const args = isOp('(') || isCmd('\\left') ? functionArgument() : [];
        return { t: 'call', f: node.v, args, prime: order };
      }
      return maybeCall(node);
    }
    if (token.k === 'op') {
      if (token.v === '(') {
        pos++;
        const inner = sequence(() => isOp(')'));
        takeOp(')');
        return inner.t === 'list' && inner.seq ? { ...inner, seq: false, tuple: true } : inner;
      }
      if (token.v === '[') {
        pos++;
        const inner = isOp(']') ? null : sequence(() => isOp(']'));
        takeOp(']');
        return { t: 'list', items: listItems(inner && inner.t === 'list' && inner.seq ? inner : inner) };
      }
      if (token.v === '|') {
        pos++;
        closingBar++;
        const inner = additive(() => isOp('|'));
        closingBar--;
        takeOp('|');
        return call('abs', [inner]);
      }
      if (token.v === '{') {
        pos++;
        const inner = isOp('}') ? null : sequence(() => isOp('}'));
        takeOp('}');
        if (!inner) throw new ParseError('Leere Klammer.');
        return inner;
      }
      throw new ParseError('Unerwartet: ' + token.v);
    }
    // Commands
    const c = token.v;
    if (c === '\\frac' || c === '\\dfrac' || c === '\\tfrac' || c === '\\cfrac') {
      pos++;
      const top = group();
      const bottom = group();
      return op('/', top, bottom);
    }
    if (c === '\\sqrt') {
      pos++;
      if (isOp('[')) {
        pos++;
        const index = sequence(() => isOp(']'));
        takeOp(']');
        return call('nthroot', [group(), index]);
      }
      return call('sqrt', [group()]);
    }
    if (c === '\\left' || c === '\\mleft') return leftRight();
    if (c === '\\begin') return environment();
    if (c === '\\binom' || c === '\\dbinom' || c === '\\tbinom') {
      pos++;
      const n = group();
      const k = group();
      return call('comb', [n, k]);
    }
    if (c === '\\operatorname' || c === '\\mathrm' || c === '\\text' || c === '\\mathit' || c === '\\textrm') {
      pos++;
      const name = rawText().trim();
      if (c === '\\text' && !/^[A-Za-zÄÖÜäöüß_][A-Za-z0-9ÄÖÜäöüß_]*$/.test(name)) return { t: 'str', v: name };
      if (name === 'e') return sym('e');
      if (name === 'i') return sym('i');
      return maybeCall(sym(name));
    }
    if (c === '\\int') {
      pos++;
      return bigOperator('int');
    }
    if (c === '\\sum') {
      pos++;
      return bigOperator('sum');
    }
    if (c === '\\prod') {
      pos++;
      return bigOperator('prod');
    }
    if (c === '\\lim') {
      pos++;
      return limit();
    }
    if (LATEX_FUNCTIONS[c]) {
      pos++;
      const name = LATEX_FUNCTIONS[c];
      if (isOp('^')) {
        // \sin^2 x = (sin x)^2; \sin^{-1} x = asin x
        pos++;
        const exponent = group();
        const args = functionArgument();
        if (exponent && exponent.t === 'neg' && exponent.a.t === 'num' && exponent.a.v === '1') {
          const inverse = { sin: 'asin', cos: 'acos', tan: 'atan' }[name];
          if (inverse) return call(inverse, args);
        }
        return op('^', call(name, args), exponent);
      }
      if (name === 'log' && isOp('_')) {
        pos++;
        const base = group();
        const args = functionArgument();
        return op('/', call('ln', args), call('ln', [base]));
      }
      return call(name, functionArgument());
    }
    if (LATEX_SYMBOLS[c]) {
      pos++;
      return sym(LATEX_SYMBOLS[c]);
    }
    if (c === '\\vert' || c === '\\lvert') {
      pos++;
      closingBar++;
      const inner = additive(() => isCmd('\\vert') || isCmd('\\rvert'));
      closingBar--;
      pos++;
      return call('abs', [inner]);
    }
    if (c === '\\overline' || c === '\\bar') {
      pos++;
      return call('conj', [group()]);
    }
    if (c === '\\vec' || c === '\\overrightarrow') {
      pos++;
      const inner = group();
      return inner && inner.t === 'sym' ? sym(inner.v) : inner;
    }
    if (c === '\\lfloor') {
      pos++;
      const inner = additive(() => isCmd('\\rfloor'));
      pos++;
      return call('floor', [inner]);
    }
    if (c === '\\lceil') {
      pos++;
      const inner = additive(() => isCmd('\\rceil'));
      pos++;
      return call('ceil', [inner]);
    }
    if (c === '\\placeholder') {
      throw new ParseError('Ein Feld ist noch leer.');
    }
    if (c === '\\lbrack') {
      pos++;
      const inner = isCmd('\\rbrack') ? null : sequence(() => isCmd('\\rbrack'));
      pos++;
      return { t: 'list', items: listItems(inner) };
    }
    if (c === '\\lbrace' || c === '\\{') {
      pos++;
      const inner = isCmd('\\rbrace') || isCmd('\\}') ? null : sequence(() => isCmd('\\rbrace') || isCmd('\\}'));
      pos++;
      return { t: 'list', items: listItems(inner), kind: 'set' };
    }
    const greek = c.slice(1);
    if (GREEK.has(greek)) {
      pos++;
      return maybeCall(sym(greek === 'varepsilon' ? 'epsilon' : greek === 'varphi' ? 'phi' : greek));
    }
    throw new ParseError('Unbekannter Befehl: ' + c);
  }

  if (!tokens.length) throw new ParseError('Nichts eingegeben.');
  const tree = sequence();
  if (pos < tokens.length) throw new ParseError('Unerwartet: ' + (tokens[pos].v || ''));
  return tree;
}

// Writing Giac

const PRECEDENCE = { rel: 1, '+': 2, '-': 2, '*': 3, '/': 3, neg: 4, '^': 5 };

function precedenceOf(node) {
  if (node.t === 'op') return PRECEDENCE[node.op];
  if (node.t === 'neg') return PRECEDENCE.neg;
  if (node.t === 'rel') return PRECEDENCE.rel;
  if (node.t === 'num' && node.v.startsWith('-')) return PRECEDENCE.neg;
  return 10;
}

/** Plain Giac input for a tree; `rename` maps function names (German commands) to Giac. */
export function toGiac(node, rename = (name) => name) {
  const g = (n) => toGiac(n, rename);
  const wrap = (n, min) => (precedenceOf(n) < min ? '(' + g(n) + ')' : g(n));
  switch (node.t) {
    case 'num':
      return node.v;
    case 'sym':
      return node.v === 'e' ? 'e' : node.v === 'degree' ? '(pi/180)' : node.v;
    case 'str':
      return JSON.stringify(node.v);
    case 'call': {
      if (node.prime) {
        let body = node.f + '(x)';
        for (let n = 0; n < node.prime; n++) body = 'diff(' + body + ',x)';
        if (!node.args.length) return body;
        return '(' + body + ')|(x=' + g(node.args[0]) + ')';
      }
      const name = rename(node.f);
      return name + '(' + node.args.map(g).join(',') + ')';
    }
    case 'op': {
      const p = PRECEDENCE[node.op];
      if (node.op === '^') return wrap(node.a, p + 1) + '^' + wrap(node.b, p + 1);
      const right = node.op === '-' || node.op === '/' ? wrap(node.b, p + 1) : wrap(node.b, p);
      return wrap(node.a, p) + node.op + right;
    }
    case 'neg':
      return '-' + wrap(node.a, PRECEDENCE.neg + 1);
    case 'fact':
      return wrap(node.a, 10) + '!';
    case 'rel':
      return g(node.a) + (node.op === '!=' ? '!=' : node.op) + g(node.b);
    case 'list':
      if (node.seq) return node.items.map(g).join(',');
      if (node.kind === 'set') return 'set[' + node.items.map(g).join(',') + ']';
      if (node.tuple) return '(' + node.items.map(g).join(',') + ')';
      return '[' + node.items.map(g).join(',') + ']';
    case 'interval':
      return g(node.inner);
    case 'unit':
      return g(node.a) + '_' + node.unit;
    default:
      throw new ParseError('Unbekannter Knoten ' + node.t);
  }
}

// Writing school LaTeX

/** A decimal with a comma, and powers of ten for very large or small numbers: 1.5e-11 → 1{,}5·10^{-11}. */
export function latexNumber(text, digits = 10) {
  const s = String(text);
  if (/^-?\d+$/.test(s)) return s;
  const value = Number(s);
  if (!isFinite(value)) return s;
  if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-6)) {
    const [mantissa, exponent] = value.toExponential(digits - 1).split('e');
    return String(Number(mantissa)).replace('.', '{,}') + '\\cdot 10^{' + Number(exponent) + '}';
  }
  return String(Number(value.toPrecision(digits))).replace('.', '{,}');
}

function isNumber(node) {
  return node.t === 'num';
}

function isAtom(node) {
  return node.t === 'num' || node.t === 'sym' || node.t === 'call' || (node.t === 'op' && node.op === '^');
}

function symLatex(name) {
  if (name === 'pi') return '\\pi';
  if (name === 'inf' || name === 'infinity' || name === '+infinity') return '\\infty';
  if (name === '-infinity') return '-\\infty';
  if (name === 'undef') return '\\text{nicht definiert}';
  if (name === 'euler_gamma') return '\\gamma';
  if (GREEK.has(name)) return '\\' + name;
  const sub = /^([A-Za-z]+)_([A-Za-z0-9]+)$/.exec(name);
  if (sub) return symLatex(sub[1]) + '_{' + sub[2] + '}';
  if (/^_.*_$/.test(name)) return '\\text{' + name + '}';
  if (name.length > 1 && !/^[A-Za-z]\d+$/.test(name)) return '\\mathrm{' + name.replace(/_/g, '\\_') + '}';
  if (/^[A-Za-z]\d+$/.test(name)) return name[0] + '_{' + name.slice(1) + '}';
  return name;
}

const LATEX_NAMES = {
  sin: '\\sin', cos: '\\cos', tan: '\\tan', cot: '\\cot', asin: '\\arcsin', acos: '\\arccos', atan: '\\arctan',
  sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh', ln: '\\ln', log: '\\ln', log10: '\\lg', max: '\\max', min: '\\min',
  det: '\\det', gcd: '\\operatorname{ggT}', lcm: '\\operatorname{kgV}', arg: '\\arg', re: '\\operatorname{Re}',
  im: '\\operatorname{Im}',
};

/**
 * School-style LaTeX: 2x instead of 2·x, the number first (8π), fractions, √, |x|, e^x, decimal commas, and ";"
 * between items because the comma is the decimal separator.
 */
export function toLatex(node, options = {}) {
  const digits = options.digits || 10;
  const L = (n) => toLatex(n, options);
  const paren = (s) => '\\left(' + s + '\\right)';
  const wrap = (n, min) => (precedenceOf(n) < min ? paren(L(n)) : L(n));

  switch (node.t) {
    case 'num':
      return node.v.startsWith('-') ? '-' + latexNumber(node.v.slice(1), digits) : latexNumber(node.v, digits);
    case 'sym':
      return symLatex(node.v);
    case 'str':
      return '\\text{' + node.v.replace(/[\\{}]/g, '') + '}';
    case 'call': {
      const args = node.args;
      if (node.prime) return symLatex(node.f) + "'".repeat(node.prime) + (args.length ? paren(args.map(L).join(';\\ ')) : '');
      switch (node.f) {
        case 'sqrt':
          return '\\sqrt{' + L(args[0]) + '}';
        case 'nthroot':
          return '\\sqrt[' + L(args[1]) + ']{' + L(args[0]) + '}';
        case 'abs':
          return '\\left|' + L(args[0]) + '\\right|';
        case 'exp':
          return args[0].t === 'num' && args[0].v === '1' ? 'e' : 'e^{' + L(args[0]) + '}';
        case 'factorial':
          return wrap(args[0], 10) + '!';
        case 'comb':
          return '\\binom{' + L(args[0]) + '}{' + L(args[1]) + '}';
        case 'conj':
          return '\\overline{' + L(args[0]) + '}';
        case 'floor':
          return '\\left\\lfloor ' + L(args[0]) + '\\right\\rfloor';
        case 'ceil':
          return '\\left\\lceil ' + L(args[0]) + '\\right\\rceil';
        case 'integrate':
          if (args.length === 4) return '\\int_{' + L(args[2]) + '}^{' + L(args[3]) + '}' + L(args[0]) + '\\,\\mathrm{d}' + L(args[1]);
          return '\\int ' + L(args[0]) + '\\,\\mathrm{d}' + L(args[1] || { t: 'sym', v: 'x' });
        case 'piecewise': {
          const rows = [];
          for (let i = 0; i + 1 < args.length; i += 2) rows.push(L(args[i + 1]) + ' & \\text{für } ' + L(args[i]));
          if (args.length % 2) rows.push(L(args[args.length - 1]) + ' & \\text{sonst}');
          return '\\begin{cases}' + rows.join('\\\\') + '\\end{cases}';
        }
        default: {
          const name = LATEX_NAMES[node.f] || (node.f.length === 1 ? node.f : '\\operatorname{' + node.f.replace(/_/g, '\\_') + '}');
          return name + paren(args.map(L).join(';\\ '));
        }
      }
    }
    case 'neg':
      return '-' + wrap(node.a, PRECEDENCE.neg + 1);
    case 'fact':
      return wrap(node.a, 10) + '!';
    case 'rel': {
      const names = { '=': '=', '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ', '!=': '\\ne ', ':=': ':=' };
      return L(node.a) + names[node.op] + L(node.b);
    }
    case 'list': {
      if (node.items.length && node.items.every((item) => item.t === 'list' && !item.kind) && node.items.every((item) => item.items.length === node.items[0].items.length)) {
        return '\\begin{pmatrix}' + node.items.map((row) => row.items.map(L).join(' & ')).join('\\\\') + '\\end{pmatrix}';
      }
      if (node.vector) return '\\begin{pmatrix}' + node.items.map(L).join('\\\\') + '\\end{pmatrix}';
      const inner = node.items.map(L).join(';\\ ');
      if (node.kind === 'set') return '\\left\\{' + inner + '\\right\\}';
      if (node.seq) return inner;
      if (node.tuple) return paren(inner);
      return '\\left[' + inner + '\\right]';
    }
    case 'unit':
      return L(node.a) + '\\,\\mathrm{' + node.unit + '}';
    case 'op':
      return opLatex(node, options, L, paren, wrap);
    default:
      return '';
  }
}

function opLatex(node, options, L, paren, wrap) {
  switch (node.op) {
    case '+': {
      // a + (-b) → a - b
      if (node.b.t === 'neg') return L(node.a) + '-' + wrap(node.b.a, PRECEDENCE['+'] + 1);
      if (node.b.t === 'num' && node.b.v.startsWith('-')) return L(node.a) + '-' + latexNumber(node.b.v.slice(1), options.digits || 10);
      if (node.b.t === 'op' && node.b.op === '/' && node.b.a.t === 'neg') return L(node.a) + '-' + L(op('/', node.b.a.a, node.b.b));
      if (node.b.t === 'op' && node.b.op === '*' && node.b.a.t === 'neg') return L(node.a) + '-' + L(op('*', node.b.a.a, node.b.b));
      if (node.b.t === 'op' && node.b.op === '*' && node.b.a.t === 'num' && node.b.a.v.startsWith('-')) {
        return L(node.a) + '-' + L(op('*', num(node.b.a.v.slice(1)), node.b.b));
      }
      return L(node.a) + '+' + L(node.b);
    }
    case '-':
      return L(node.a) + '-' + wrap(node.b, PRECEDENCE['-'] + 1);
    case '/': {
      // -1/6 → -\frac{1}{6}
      if (node.a.t === 'neg') return '-\\frac{' + L(node.a.a) + '}{' + L(node.b) + '}';
      if (node.a.t === 'num' && node.a.v.startsWith('-')) return '-\\frac{' + L(num(node.a.v.slice(1))) + '}{' + L(node.b) + '}';
      return '\\frac{' + L(node.a) + '}{' + L(node.b) + '}';
    }
    case '^': {
      const base = node.a;
      const exponent = node.b;
      // sin(x)^2 → \sin^2(x)
      if (base.t === 'call' && LATEX_NAMES[base.f] && exponent.t === 'num' && /^\d+$/.test(exponent.v) && base.f !== 'log10') {
        return LATEX_NAMES[base.f] + '^{' + exponent.v + '}' + paren(base.args.map(L).join(';\\ '));
      }
      const baseText = base.t === 'num' || base.t === 'sym' ? L(base) : base.t === 'call' && ['sqrt', 'abs'].includes(base.f) ? L(base) : paren(L(base));
      return baseText + '^{' + L(exponent) + '}';
    }
    case '*':
      return productLatex(node, options, L, paren);
    default:
      return '';
  }
}

function factors(node, out = []) {
  if (node.t === 'op' && node.op === '*') {
    factors(node.a, out);
    factors(node.b, out);
  } else out.push(node);
  return out;
}

function productLatex(node, options, L, paren) {
  let list = factors(node);
  let sign = '';
  // Numbers first, as written by hand: π·8 → 8π
  const numbers = list.filter(isNumber);
  const rest = list.filter((f) => !isNumber(f));
  if (numbers.length === 1 && rest.length) list = [numbers[0], ...rest];
  // 1/2·x → \frac{1}{2}x; -1·x → -x
  if (list[0].t === 'num' && list[0].v === '-1' && list.length > 1) {
    sign = '-';
    list = list.slice(1);
  }
  if (list[0].t === 'num' && list[0].v === '1' && list.length > 1) list = list.slice(1);
  if (list[0].t === 'neg') {
    sign = sign ? '' : '-';
    list = [list[0].a, ...list.slice(1)];
  }
  let out = '';
  list.forEach((factor, index) => {
    let text = precedenceOf(factor) < PRECEDENCE['*'] ? paren(L(factor)) : L(factor);
    if (factor.t === 'op' && factor.op === '/' && index > 0) text = paren(text);
    if (index === 0) {
      out = text;
      return;
    }
    const previous = list[index - 1];
    // A dot between two numbers, and before a number; juxtaposition otherwise: 2x, 3√2, x·y stays xy.
    const needsDot = isNumber(factor) || /^\d/.test(text) || text.startsWith('-');
    // Two letters side by side get a thin space so x·y does not read as a name.
    const thin = !isNumber(previous) && /[A-Za-z]$/.test(out) && /^[A-Za-z]/.test(text);
    out += needsDot ? '\\cdot ' + text : thin ? '\\,' + text : text;
  });
  return sign + out;
}

// Numbers for plotting

const JS_FUNCTIONS = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, cot: (x) => 1 / Math.tan(x), asin: Math.asin, acos: Math.acos,
  atan: Math.atan, sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh, asinh: Math.asinh, acosh: Math.acosh,
  atanh: Math.atanh, exp: Math.exp, ln: Math.log, log: Math.log, log10: Math.log10, lg: Math.log10, sqrt: Math.sqrt,
  abs: Math.abs, sign: Math.sign, floor: Math.floor, ceil: Math.ceil, round: Math.round, max: Math.max, min: Math.min,
  nthroot: (x, n) => (x < 0 && n % 2 === 1 ? -Math.pow(-x, 1 / n) : Math.pow(x, 1 / n)),
  frac: (x) => x - Math.floor(x),
  factorial: (n) => {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    let r = 1;
    for (let k = 2; k <= n; k++) r *= k;
    return r;
  },
  comb: (n, k) => {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let j = 1; j <= k; j++) r = (r * (n - k + j)) / j;
    return Math.round(r);
  },
};

/**
 * A JavaScript function of the named variables, for plotting: compile(parse('x^2+a'), ['x'], scope) → x => …
 * `scope.value(name)` gives numbers of other objects, `scope.fn(name)` other functions.
 */
export function compile(node, variables = ['x'], scope = {}) {
  const index = new Map(variables.map((v, i) => [v, i]));
  const fnOf = scope.fn || (() => null);
  const valueOf = scope.value || (() => undefined);
  function build(n) {
    switch (n.t) {
      case 'num': {
        const value = Number(n.v);
        return () => value;
      }
      case 'sym': {
        if (index.has(n.v)) {
          const i = index.get(n.v);
          return (args) => args[i];
        }
        if (n.v === 'pi') return () => Math.PI;
        if (n.v === 'e') return () => Math.E;
        if (n.v === 'inf' || n.v === 'infinity') return () => Infinity;
        const name = n.v;
        return () => {
          const value = valueOf(name);
          return typeof value === 'number' ? value : NaN;
        };
      }
      case 'neg': {
        const a = build(n.a);
        return (args) => -a(args);
      }
      case 'fact': {
        const a = build(n.a);
        return (args) => JS_FUNCTIONS.factorial(a(args));
      }
      case 'op': {
        const a = build(n.a);
        const b = build(n.b);
        switch (n.op) {
          case '+': return (args) => a(args) + b(args);
          case '-': return (args) => a(args) - b(args);
          case '*': return (args) => a(args) * b(args);
          case '/': return (args) => a(args) / b(args);
          case '^': {
            // Odd roots of negative numbers are real at school: (-8)^(1/3) = -2
            const odd = n.b.t === 'op' && n.b.op === '/' && n.b.a.t === 'num' && n.b.b.t === 'num' && Number(n.b.b.v) % 2 === 1
              ? Number(n.b.a.v) / Number(n.b.b.v) : null;
            if (odd !== null) {
              const numerator = Number(n.b.a.v);
              return (args) => {
                const base = a(args);
                if (base >= 0) return Math.pow(base, odd);
                const root = -Math.pow(-base, 1 / Number(n.b.b.v));
                return Math.pow(root, numerator);
              };
            }
            return (args) => Math.pow(a(args), b(args));
          }
          default: return () => NaN;
        }
      }
      case 'call': {
        const argFns = n.args.map(build);
        const known = JS_FUNCTIONS[n.f];
        if (known) return (args) => known(...argFns.map((f) => f(args)));
        return (args) => {
          const user = fnOf(n.f, n.prime || 0);
          if (!user) return NaN;
          return user(...argFns.map((f) => f(args)));
        };
      }
      case 'rel': {
        // An equation as its difference, for implicit curves and root finding
        const a = build(n.a);
        const b = build(n.b);
        return (args) => a(args) - b(args);
      }
      default:
        return () => NaN;
    }
  }
  const fn = build(node);
  return (...args) => fn(args);
}

/** Every symbol a tree uses, except the given bound variables and the built-in constants. */
export function symbols(node, bound = [], out = new Set()) {
  if (!node || typeof node !== 'object') return out;
  if (node.t === 'sym' && !bound.includes(node.v) && !['pi', 'e', 'i', 'inf', 'infinity', 'degree'].includes(node.v)) out.add(node.v);
  if (node.t === 'call' && !MATH_FUNCTIONS.has(node.f)) out.add(node.f);
  for (const key of ['a', 'b', 'inner']) if (node[key]) symbols(node[key], bound, out);
  for (const key of ['args', 'items']) if (node[key]) node[key].forEach((n) => symbols(n, bound, out));
  return out;
}

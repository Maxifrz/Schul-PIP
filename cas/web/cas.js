// Schul-PIP's computer algebra on top of Giac (giacwasm.js). The same file runs in the iOS and Android web view
// and in the Node tests: German commands in, readable German results out, and the numbers for the function plotter.
var CAS = (function () {
  'use strict';

  var caseval = null;
  var output = [];

  // German command → Giac command. Keys are lower case; umlauts may also be written as ae, oe, ue.
  var COMMANDS = {
    'löse': 'solve', 'lösen': 'solve', 'loese': 'solve', 'loesen': 'solve',
    'ableiten': 'diff', 'ableitung': 'diff', 'leiteab': 'diff',
    'integriere': 'integrate', 'integrieren': 'integrate', 'integral': 'integrate',
    'grenzwert': 'limit', 'limes': 'limit',
    'faktorisiere': 'factor', 'faktorisieren': 'factor', 'zerlege': 'factor',
    'vereinfache': 'simplify', 'vereinfachen': 'simplify',
    'ausmultiplizieren': 'expand', 'ausmultipliziere': 'expand', 'expandiere': 'expand',
    'kürze': 'normal', 'kuerze': 'normal', 'kürzen': 'normal', 'kuerzen': 'normal',
    'näherung': 'evalf', 'naeherung': 'evalf', 'dezimal': 'evalf',
    'wurzel': 'sqrt', 'betrag': 'abs', 'ggt': 'gcd', 'kgv': 'lcm',
    'fakultät': 'factorial', 'fakultaet': 'factorial', 'binomialkoeffizient': 'comb', 'nck': 'comb',
    'determinante': 'det', 'inverse': 'inv', 'transponiere': 'tran', 'transponierte': 'tran',
    'mittelwert': 'mean', 'median': 'schulmedian', 'standardabweichung': 'stddev', 'varianz': 'variance',
    'summe': 'sum', 'produkt': 'product', 'unendlich': 'inf', 'lg': 'log10', 'log': 'log10',
    'nullstellen': 'nullstellen', 'tangente': 'tangente',
  };

  // Letters that name unknowns: "x = 3" is an equation, not an assignment.
  var UNKNOWNS = { x: true, y: true, z: true, t: true };

  var ERRORS = [
    [/Not invertible/i, 'Die Matrix ist nicht invertierbar.'],
    [/Bad Argument Value|Bad Argument Type|Invalid dimension/i, 'Ungültige Eingabe für diesen Befehl.'],
    [/Division by 0|Division by zero/i, 'Division durch 0.'],
    [/syntax error/i, 'Syntaxfehler: Klammern, Operatoren und Kommas prüfen.'],
  ];

  function init(evaluator) {
    caseval = evaluator;
    // Giac's median takes the lower middle value; school takes the mean of both.
    run('schulmedian(l):={local s,n; s:=sort(l); n:=size(s); if (irem(n,2)==1) return s[(n-1)/2]; return (s[n/2-1]+s[n/2])/2;}');
    run('angle_radian:=1');
  }

  function captured(line) {
    output.push(String(line));
  }

  function run(command) {
    output = [];
    var value = caseval(command);
    return { value: String(value), output: output.slice() };
  }

  function errorOf(result) {
    var text = result.value;
    var log = result.output.join('\n');
    // string(...) of a failed command can wrap Giac's error message instead of passing it on.
    if (/GIAC_ERROR|Error: /.test(text) || /syntax error/i.test(log) || (text === 'undef' && /error/i.test(log))) {
      var all = text + '\n' + log;
      for (var i = 0; i < ERRORS.length; i++) {
        if (ERRORS[i][0].test(all)) return ERRORS[i][1];
      }
      return 'Das konnte nicht berechnet werden.';
    }
    return null;
  }

  function unquote(text) {
    if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') return text.slice(1, -1);
    return text;
  }

  // Input

  // Splits the arguments of a call at its top-level commas; `text` is what is inside the parentheses.
  function splitArgs(text) {
    var args = [];
    var depth = 0;
    var start = 0;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) {
        args.push(text.slice(start, i).trim());
        start = i + 1;
      }
    }
    var last = text.slice(start).trim();
    if (last || args.length) args.push(last);
    return args;
  }

  // Replaces every call of `name(...)` with what `rewrite(args)` returns, innermost calls included.
  function rewriteCalls(text, name, rewrite) {
    var pattern = new RegExp('(^|[^A-Za-z0-9_])' + name + '\\s*\\(');
    var guard = 0;
    for (;;) {
      var match = pattern.exec(text);
      if (!match || guard++ > 50) return text;
      var start = match.index + match[1].length;
      var open = match.index + match[0].length - 1;
      var depth = 0;
      var close = -1;
      for (var i = open; i < text.length; i++) {
        if (text[i] === '(') depth++;
        else if (text[i] === ')') {
          depth--;
          if (depth === 0) {
            close = i;
            break;
          }
        }
      }
      if (close < 0) return text;
      var inner = rewriteCalls(text.slice(open + 1, close), name, rewrite);
      text = text.slice(0, start) + rewrite(splitArgs(inner)) + text.slice(close + 1);
    }
  }

  function normalizeSymbols(text) {
    return text
      .replace(/[−–]/g, '-')
      .replace(/[×·⋅∙]/g, '*')
      .replace(/÷/g, '/')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/≤/g, '<=')
      .replace(/≥/g, '>=')
      .replace(/≠/g, '!=')
      .replace(/π/g, 'pi')
      .replace(/∞/g, 'inf')
      .replace(/√\s*\(/g, 'sqrt(')
      .replace(/√\s*([0-9.]+|[A-Za-z_][A-Za-z0-9_]*)/g, 'sqrt($1)');
  }

  /**
   * Turns what the student typed into Giac: German commands, school symbols, "a = 5" and "f(x) = x^2" as
   * definitions. Returns the Giac text, the command used at the top, and the name a definition assigns.
   */
  function translate(input) {
    var text = normalizeSymbols(String(input || '').trim());
    text = text.replace(/[A-Za-zÄÖÜäöüß_][A-Za-z0-9ÄÖÜäöüß_]*/g, function (word) {
      var mapped = COMMANDS[word.toLowerCase()];
      return mapped || word;
    });
    text = rewriteCalls(text, 'nullstellen', function (args) {
      var variable = args[1] || 'x';
      return 'solve((' + args[0] + ')=0,' + variable + ')';
    });
    text = rewriteCalls(text, 'tangente', function (args) {
      var f = '(' + args[0] + ')';
      var a = '(' + (args[1] || '0') + ')';
      return 'normal(subst(' + f + ',x=' + a + ')+subst(diff(' + f + ',x),x=' + a + ')*(x-' + a + '))';
    });
    text = rewriteCalls(text, 'factor', function (args) {
      // A whole number is split into primes, like at school.
      return (/^-?\d+$/.test(args[0]) ? 'ifactor(' : 'factor(') + args.join(',') + ')';
    });
    text = rewriteCalls(text, 'diff', function (args) {
      if (args.length === 3 && /^\d+$/.test(args[2])) return 'diff(' + args[0] + ',' + args[1] + '$' + args[2] + ')';
      return 'diff(' + args.join(',') + ')';
    });

    var result = { giac: text, command: null, assigns: null, kind: null, params: null, body: null };
    var head = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(text);
    if (head) result.command = head[1];

    var fn = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*\(\s*([A-Za-z][A-Za-z0-9_]*(?:\s*,\s*[A-Za-z][A-Za-z0-9_]*)*)\s*\)\s*:?=(?![=<>])/.exec(text);
    if (fn && !COMMANDS[fn[1].toLowerCase()] && fn[1].length <= 12) {
      var body = text.slice(fn[0].length).trim();
      var params = fn[2].replace(/\s+/g, '');
      result.giac = fn[1] + '(' + params + '):=' + body;
      result.assigns = fn[1];
      result.kind = 'function';
      result.params = params;
      result.body = body;
      return result;
    }
    var assign = /^\s*([A-Za-z][A-Za-z0-9_]*)\s*(:=|=(?![=<>]))/.exec(text);
    if (assign) {
      var name = assign[1];
      var rhs = text.slice(assign[0].length).trim();
      var mentionsItself = new RegExp('(^|[^A-Za-z0-9_])' + name + '([^A-Za-z0-9_(]|$)').test(rhs);
      if (assign[2] === ':=' || (!UNKNOWNS[name] && !mentionsItself && rhs.length > 0 && text.indexOf('=', assign[0].length) < 0)) {
        result.giac = name + ':=' + rhs;
        result.assigns = name;
        result.kind = 'variable';
        result.body = rhs;
      }
    }
    return result;
  }

  // Output

  function formatNumber(text) {
    var value = Number(text);
    if (!isFinite(value)) return text;
    if (Math.abs(value) >= 1e15 || (value !== 0 && Math.abs(value) < 1e-6)) {
      var parts = value.toExponential(8).split('e');
      var mantissa = String(Number(parts[0]));
      return mantissa.replace('.', ',') + '·10^' + Number(parts[1]);
    }
    var fixed = String(Number(value.toPrecision(10)));
    return fixed.replace('.', ',');
  }

  function superscript(digits) {
    var map = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
    return digits.split('').map(function (c) { return map[c] || c; }).join('');
  }

  /** Giac's answer in school notation: √, π, e, ∞, powers raised, ";" between list items, decimal comma. */
  function pretty(text) {
    var s = String(text);
    s = s.replace(/\blist\[/g, '[').replace(/\bmatrix\[/g, '[');
    // Giac separates with commas; German needs the comma for decimals, so items are separated by "; ".
    s = s.replace(/,/g, '; ');
    s = s.replace(/\d+\.\d+(?:e[+-]?\d+)?|\d+e[+-]?\d+/g, function (number) { return formatNumber(number); });
    s = s.replace(/\bexp\(1\)/g, 'e');
    s = s.replace(/\bsqrt\(([0-9]+|[A-Za-z])\)/g, '√$1');
    s = s.replace(/\bsqrt\(/g, '√(');
    s = s.replace(/\bpi\b/g, 'π');
    s = s.replace(/\+infinity\b/g, '+∞').replace(/-infinity\b/g, '-∞').replace(/\binfinity\b/g, '∞').replace(/\binf\b/g, '∞');
    s = s.replace(/\bundef\b/g, 'nicht definiert');
    s = s.replace(/\^\((-?\d+)\)|\^(\d+)(?![\d,])/g, function (all, inParens, bare) { return superscript(inParens || bare); });
    s = s.replace(/\*/g, '·');
    // 2·x → 2x and 3·√2 → 3√2, like it is written by hand.
    s = s.replace(/(\d)·(?=[A-Za-zπ√(])/g, '$1');
    return s;
  }

  /** The rows of a matrix answer as pretty cells, or null when it is not one. */
  function matrixRows(text) {
    var s = String(text).replace(/^matrix/, '');
    if (!/^\[\[.*\]\]$/.test(s)) return null;
    var inner = s.slice(1, -1);
    var rows = splitArgs(inner);
    var cells = rows.map(function (row) {
      if (!/^\[.*\]$/.test(row)) return null;
      return splitArgs(row.slice(1, -1)).map(pretty);
    });
    if (cells.some(function (row) { return row === null; })) return null;
    var width = cells[0].length;
    if (!cells.every(function (row) { return row.length === width; })) return null;
    return cells;
  }

  function isNumeric(text) {
    return /^[\[\]\s,;0-9.e+\-]*$/.test(text.replace(/\b(list|matrix|infinity)\b/g, '')) && /\d/.test(text);
  }

  // Evaluating

  function approximate(exact) {
    var input = exact.replace(/\blist\[/g, '[').replace(/\bmatrix\[/g, '[');
    var result = run('string(evalf(' + input + '))');
    if (errorOf(result)) return null;
    var approx = unquote(result.value);
    if (!isNumeric(approx)) return null;
    if (approx.replace(/\.0\b/g, '') === exact.replace(/\blist\[/g, '[')) return null;
    return approx;
  }

  function evaluate(input) {
    if (!caseval) return { ok: false, error: 'Der Rechenkern ist noch nicht bereit.' };
    var translated = translate(input);
    if (!translated.giac.trim()) return { ok: false, error: 'Nichts eingegeben.' };
    var answer = { ok: true, input: String(input), giac: translated.giac, assigns: translated.assigns, kind: translated.kind };

    if (translated.kind === 'function') {
      var defined = run(translated.giac);
      var error = errorOf(defined);
      if (error) return { ok: false, error: error, giac: translated.giac };
      var body = unquote(run('string(' + translated.assigns + '(' + translated.params + '))').value);
      answer.exact = translated.assigns + '(' + translated.params + ')=' + body;
      answer.pretty = translated.assigns + '(' + translated.params.replace(/,/g, '; ') + ') = ' + pretty(body);
      answer.approx = null;
      answer.prettyApprox = null;
      return answer;
    }

    var command = translated.kind === 'variable' ? translated.giac : 'string(' + translated.giac + ')';
    var result = run(command);
    var failed = errorOf(result);
    if (failed) return { ok: false, error: failed, giac: translated.giac };
    var exact = translated.kind === 'variable'
      ? unquote(run('string(' + translated.assigns + ')').value)
      : unquote(result.value);
    var approx = approximate(exact);
    var solutions = translated.command === 'solve' && (/^list\[/.test(exact) || exact === '[]');
    answer.exact = exact;
    answer.approx = approx;
    var shown = pretty(exact);
    if (solutions) shown = 'L = {' + shown.slice(1, -1) + '}';
    if (translated.kind === 'variable') shown = translated.assigns + ' = ' + shown;
    answer.pretty = shown;
    answer.prettyApprox = approx === null ? null : (solutions ? 'L ≈ {' + pretty(approx).slice(1, -1) + '}' : pretty(approx));
    answer.matrix = matrixRows(exact);
    return answer;
  }

  function evaluateJSON(input) {
    try {
      return JSON.stringify(evaluate(input));
    } catch (e) {
      return JSON.stringify({ ok: false, error: 'Das konnte nicht berechnet werden.' });
    }
  }

  /** Degrees (true) or radians for sin, cos and tan. */
  function setDegrees(degrees) {
    run('angle_radian:=' + (degrees ? 0 : 1));
  }

  /** Forgets every variable and function the student defined. */
  function forget(names) {
    (names || []).forEach(function (name) {
      if (/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) run('purge(' + name + ')');
    });
  }

  // Plotting

  function numbers(text) {
    var s = unquote(String(text)).trim();
    if (s[0] !== '[' || s[s.length - 1] !== ']') return null;
    return splitArgs(s.slice(1, -1)).map(function (item) {
      var value = Number(item);
      return isFinite(value) ? value : null;
    });
  }

  function sample(expression, xmin, xmax, count) {
    var step = (xmax - xmin) / (count - 1);
    var result = run('seq(evalf(subst(' + expression + ',x=plotx_)),plotx_,' + xmin + ',' + (xmax + step / 2) + ',' + step + ')');
    if (errorOf(result)) return null;
    var values = numbers(result.value);
    if (!values) return null;
    return values.slice(0, count);
  }

  function valueAt(expression, x) {
    var result = run('evalf(subst(' + expression + ',x=' + x + '))');
    var value = Number(result.value);
    return isFinite(value) ? value : null;
  }

  function solveIn(equation, a, b) {
    var result = run('fsolve(' + equation + ',x=' + a + '..' + b + ')');
    if (errorOf(result)) return null;
    var text = result.value.replace(/^list/, '');
    var found = text[0] === '[' ? numbers(text) : [Number(text)];
    if (!found) return null;
    for (var i = 0; i < found.length; i++) {
      if (found[i] !== null && isFinite(found[i]) && found[i] >= a - 1e-9 && found[i] <= b + 1e-9) return found[i];
    }
    return null;
  }

  function round(value) {
    var rounded = Math.round(value * 1e4) / 1e4;
    return Math.abs(rounded) < 1e-10 ? 0 : rounded;
  }

  // Where the values change sign. A value that is 0 up to rounding counts as 0 and is not a change by itself.
  function signChanges(values, xs, zero) {
    var brackets = [];
    var signs = values.map(function (v) { return v === null ? null : (Math.abs(v) <= zero ? 0 : (v > 0 ? 1 : -1)); });
    for (var i = 0; i < values.length; i++) {
      if (signs[i] === 0) {
        // A run of zeros counts once.
        if (i === 0 || signs[i - 1] !== 0) brackets.push([xs[i], xs[i]]);
      } else if (signs[i] !== null && i + 1 < values.length && signs[i + 1] !== null && signs[i + 1] !== 0 && signs[i] !== signs[i + 1]) {
        brackets.push([xs[i], xs[i + 1]]);
      }
    }
    return brackets;
  }

  function findZeros(expression, values, xs, tolerance) {
    var found = [];
    var step = xs.length > 1 ? xs[1] - xs[0] : 1;
    signChanges(values, xs, tolerance * 1e-3).forEach(function (bracket) {
      // Giac leaves out a zero that sits right on the edge of the interval, so it gets a little room.
      var x = solveIn('(' + expression + ')=0', bracket[0] - step / 2, bracket[1] + step / 2);
      if (x === null && bracket[0] === bracket[1]) x = bracket[0];
      if (x === null) return;
      var check = valueAt(expression, x);
      // A jump across a pole changes the sign too, but is no zero.
      if (check === null || Math.abs(check) > tolerance) return;
      if (found.some(function (other) { return Math.abs(other - x) < 1e-6; })) return;
      found.push(x);
    });
    return found;
  }

  function describe(expression) {
    var translated = translate(expression);
    var text = translated.giac;
    if (translated.kind === 'function') {
      run(text);
      return { giac: translated.body, label: translated.assigns + '(x)' };
    }
    var y = /^\s*y\s*=(?![=<>])/.exec(text);
    if (y) text = text.slice(y[0].length);
    return { giac: text.trim(), label: null };
  }

  /**
   * Samples every function between xmin and xmax and finds zeros, extreme points, intersections and where the
   * graphs cross the y axis. Values that are not real numbers are null.
   */
  function plot(expressions, xmin, xmax, count) {
    if (!caseval) return { ok: false, error: 'Der Rechenkern ist noch nicht bereit.' };
    count = count || 401;
    if (!(xmax > xmin)) return { ok: false, error: 'Der x-Bereich ist leer.' };
    var xs = [];
    for (var i = 0; i < count; i++) xs.push(xmin + (xmax - xmin) * i / (count - 1));
    var curves = [];
    for (var c = 0; c < expressions.length; c++) {
      if (!String(expressions[c] || '').trim()) continue;
      var described = describe(expressions[c]);
      var values = sample(described.giac, xmin, xmax, count);
      if (!values) return { ok: false, error: 'Die Funktion ' + (c + 1) + ' lässt sich nicht zeichnen.' };
      curves.push({
        index: c,
        giac: described.giac,
        label: described.label || 'f' + (curves.length + 1) + '(x)',
        pretty: pretty(described.giac),
        values: values,
      });
    }
    if (!curves.length) return { ok: false, error: 'Keine Funktion eingegeben.' };

    var finite = [];
    curves.forEach(function (curve) { curve.values.forEach(function (v) { if (v !== null) finite.push(v); }); });
    finite.sort(function (a, b) { return a - b; });
    var low = finite.length ? finite[Math.floor(finite.length * 0.02)] : -1;
    var high = finite.length ? finite[Math.min(finite.length - 1, Math.floor(finite.length * 0.98))] : 1;
    var scale = Math.max(Math.abs(low), Math.abs(high), 1);
    var tolerance = 1e-6 * scale;

    var roots = [];
    var extrema = [];
    var intercepts = [];
    curves.forEach(function (curve, n) {
      findZeros(curve.giac, curve.values, xs, tolerance).forEach(function (x) {
        roots.push({ curve: n, x: round(x), y: 0 });
      });
      var derivative = unquote(run('string(diff(' + curve.giac + ',x))').value);
      var slopes = sample(derivative, xmin, xmax, count);
      if (slopes) {
        findZeros(derivative, slopes, xs, 1e-6 * Math.max(1, Math.max.apply(null, slopes.filter(function (v) { return v !== null; }).map(Math.abs)))).forEach(function (x) {
          var y = valueAt(curve.giac, x);
          if (y === null) return;
          var before = valueAt(derivative, x - (xmax - xmin) / (count - 1) / 2);
          var after = valueAt(derivative, x + (xmax - xmin) / (count - 1) / 2);
          var kind = before !== null && after !== null && before > after ? 'max' : 'min';
          if (before !== null && after !== null && before * after > 0) return;
          extrema.push({ curve: n, x: round(x), y: round(y), kind: kind });
          // A zero that only touches the axis has no sign change: it shows up as an extreme point at 0.
          if (Math.abs(y) <= tolerance && !roots.some(function (r) { return r.curve === n && Math.abs(r.x - x) < 1e-4; })) {
            roots.push({ curve: n, x: round(x), y: 0 });
          }
        });
      }
      if (xmin <= 0 && xmax >= 0) {
        var y0 = valueAt(curve.giac, 0);
        if (y0 !== null) intercepts.push({ curve: n, x: 0, y: round(y0) });
      }
    });

    var intersections = [];
    for (var a = 0; a < curves.length; a++) {
      for (var b = a + 1; b < curves.length; b++) {
        var difference = '(' + curves[a].giac + ')-(' + curves[b].giac + ')';
        var gaps = curves[a].values.map(function (v, k) {
          var w = curves[b].values[k];
          return v === null || w === null ? null : v - w;
        });
        findZeros(difference, gaps, xs, tolerance).forEach(function (x) {
          var y = valueAt(curves[a].giac, x);
          if (y !== null) intersections.push({ curves: [a, b], x: round(x), y: round(y) });
        });
      }
    }

    var ys = [low, high];
    roots.concat(extrema, intersections, intercepts).forEach(function (p) { ys.push(p.y); });
    var ymin = Math.min.apply(null, ys);
    var ymax = Math.max.apply(null, ys);
    if (ymax - ymin < 1e-9) {
      ymin -= 1;
      ymax += 1;
    }
    var pad = (ymax - ymin) * 0.1;
    return {
      ok: true,
      xmin: xmin,
      xmax: xmax,
      ymin: ymin - pad,
      ymax: ymax + pad,
      curves: curves,
      roots: roots,
      extrema: extrema,
      intersections: intersections,
      intercepts: intercepts,
    };
  }

  function plotJSON(expressionsJSON, xmin, xmax, count) {
    try {
      return JSON.stringify(plot(JSON.parse(expressionsJSON), xmin, xmax, count));
    } catch (e) {
      return JSON.stringify({ ok: false, error: 'Das ließ sich nicht zeichnen.' });
    }
  }

  return {
    init: init,
    captured: captured,
    translate: translate,
    pretty: pretty,
    formatNumber: formatNumber,
    evaluate: evaluate,
    evaluateJSON: evaluateJSON,
    setDegrees: setDegrees,
    forget: forget,
    plot: plot,
    plotJSON: plotJSON,
    get ready() { return caseval !== null; },
  };
})();

if (typeof module !== 'undefined') module.exports = CAS;

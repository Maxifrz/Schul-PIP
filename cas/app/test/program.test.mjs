import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { translateProgram, isProgram, openBlocks } from '../src/program.js';
import { runScript } from '../src/script.js';
import { loadGiac } from './giac.mjs';
import { Engine } from '../src/engine.js';

after(() => setImmediate(() => process.exit(0)));

test('German blocks become Giac programs', () => {
  const p = translateProgram('programm s(n)\n  für k von 1 bis n schritt 2\n    wenn k = 3 dann ausgabe k\n  ende\n  zurück n\nende');
  assert.equal(p.name, 's');
  assert.equal(p.giac, 's(n):={ local k; for (k:=1; k<=n; k:=k+(2)) { if (k == 3) { print(k); } } return n; }');
  assert.ok(isProgram('f(n):={return n;}'));
  assert.ok(!isProgram('f(x) = x^2'));
  assert.equal(openBlocks('programm f(n)\n  solange n > 1'), 2);
  assert.throws(() => translateProgram('programm f(n)\n  wenn n > 1 dann\n    zurück 1\nende'), /ende/);
});

test('programs run with recursion, loops and printing', async () => {
  const engine = new Engine(await loadGiac());
  const run = (text) => engine.evaluate({ text });
  assert.ok(run('programm fib(n)\n  wenn n < 2 dann zurück n\n  zurück fib(n-1) + fib(n-2)\nende').ok);
  assert.equal(run('fib(15)').latex, '610');
  run('programm teiler2(n)\n  lokal t\n  t = []\n  für k von 1 bis n\n    wenn rest(n, k) = 0 dann t = append(t, k)\n  ende\n  zurück t\nende');
  assert.equal(run('teiler2(12)').latex, '\\left[1;\\ 2;\\ 3;\\ 4;\\ 6;\\ 12\\right]');
  run('programm zeige3()\n  wiederhole 3 mal\n    ausgabe 1/2\n  ende\n  zurück 0\nende');
  assert.deepEqual(run('zeige3()').printed, ['\\frac{1}{2}', '\\frac{1}{2}', '\\frac{1}{2}']);
  assert.equal(run('auswählen([1,2,3,4,5,6], x -> rest(x, 3) = 0)').latex, '\\left[3;\\ 6\\right]');
  assert.equal(run('programm mittelwert(n)\nzurück n\nende').ok, false);
});

test('scripts call the app for each line', () => {
  const calls = [];
  const values = { a: 4 };
  const api = {
    value: (e) => Number(String(e).replace(/a/g, values.a).split('+').reduce((s, x) => s + Number(x), 0)),
    test: (e) => /a > 3/.test(e) && values.a > 3,
    set: (n, e) => calls.push(['set', n, e]),
    point: (n, x, y) => calls.push(['point', n, x, y]),
    visible: (n, v) => calls.push(['visible', n, v]),
    create: (t) => calls.push(['create', t]),
    remove: (n) => calls.push(['remove', n]),
    animate: (n, p) => calls.push(['animate', n, p]),
    reset: () => calls.push(['reset']),
    message: (t) => calls.push(['message', t]),
  };
  const failed = runScript('a = a + 1\nsetze P = (1|2)\nverstecke g\nerzeuge Q(1|1)\nlösche Q\nstarte alle\nstoppe a\nzurücksetzen\nmeldung a ist {a+1}\nwenn a > 3 dann zeige g sonst meldung nein\nquatsch', api);
  assert.deepEqual(calls, [['set', 'a', 'a + 1'], ['point', 'P', 1, 2], ['visible', 'g', false], ['create', 'Q(1|1)'], ['remove', 'Q'], ['animate', null, true], ['animate', 'a', false], ['reset'], ['message', 'a ist 5'], ['visible', 'g', true]]);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].line, 11);
});

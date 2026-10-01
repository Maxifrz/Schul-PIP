import test from 'node:test';
import assert from 'node:assert/strict';
import { latexToUnicode } from '../../src/chem/latex.js';
import { L } from '../../src/chem/result.js';

test('copied calculations read like the screen, not like LaTeX', () => {
  assert.equal(latexToUnicode('E = E^\\circ - \\frac{0{,}0592\\,\\mathrm{V}}{5}\\,\\lg Q = 1{,}415\\,\\mathrm{V}'), 'E = E° − (0,0592 V)/5 lg Q = 1,415 V');
  assert.equal(latexToUnicode('H_2SO_4 \\rightarrow Fe^{3+}'), 'H₂SO₄ → Fe³⁺');
  assert.equal(latexToUnicode('1{,}0\\cdot10^{8}'), '1,0·10⁸');
  // a step without its own text gets the converted one
  assert.ok(!L('E^\\circ = 1{,}51\\,\\mathrm{V}').text.includes('\\'));
  assert.equal(L('x', 'own').text, 'own');
});

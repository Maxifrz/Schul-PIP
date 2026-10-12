// Unit 6: vectors (length, dot product, orthogonality, lines, point test, distance between two points).
// A port of MathUpperUnit06.swift.

import { insert, q, UProblems, UQ, UText, uTemplate, type UGen, type UPairItems } from './core';
import { UCalc, UCalc3 } from './support';

type Vec = number[];

/** Whole-number vectors with a whole-number length: (a, b, c, length). */
export const triples: readonly [number, number, number, number][] = [
  [3, 4, 0, 5], [5, 12, 0, 13], [6, 8, 0, 10], [1, 2, 2, 3], [2, 3, 6, 7], [2, 6, 9, 11], [4, 4, 7, 9], [1, 4, 8, 9],
  [2, 10, 11, 15], [6, 6, 7, 11], [3, 4, 12, 13], [4, 8, 8, 12], [8, 9, 12, 17], [2, 2, 1, 3],
];

export function vector(g: UGen, level: number): { v: Vec; length: number } {
  const pool = level === 1 ? triples.slice(0, 3) : level === 2 ? triples.slice(3, 10) : triples.slice(3);
  const t = g.pick(pool);
  const parts = g.shuffled([t[0], t[1], t[2]]).map((x) => x * g.sign());
  return { v: parts, length: t[3] };
}

export function dot(a: readonly number[], b: readonly number[]): number {
  return a.reduce((s, x, i) => s + x * b[i], 0);
}

export function random(g: UGen, lo: number, hi: number): Vec {
  return [0, 1, 2].map(() => g.int(lo, hi));
}

const axes = ['x', 'y', 'z'];
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const same = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);
const isZeroVec = (a: readonly number[]): boolean => a.every((x) => x === 0);
const dotTerms = (a: readonly number[], b: readonly number[]): string =>
  a.map((x, i) => `${UText.signed(x)}·${UCalc3.bracket(b[i])}`).join(' + ');

const norm = uTemplate(
  'v.norm',
  (lv, g) => {
    const { v, length } = vector(g, lv);
    const squares = sum(v.map((x) => x * x));
    const wrongs = UCalc.differing(
      [q(squares), q(sum(v.map((x) => Math.abs(x)))), q(Math.max(...v.map((x) => Math.abs(x)))), q(squares, 2), q(length + 1)],
      q(length),
    );
    return UProblems.numeric({
      key: `v.norm|[${v.join(', ')}]`,
      prompt: `Berechne den Betrag des Vektors a = ${UText.vector(v)}.`,
      answer: q(length),
      wrongs,
      solution: `|a| = √(${v.map((x) => `${UText.signed(x)}²`).join(' + ')}) = √${squares} = ${length}.`,
      explanation: 'Der Betrag ist die Wurzel aus der Summe der Koordinatenquadrate; ohne die Wurzel hättest du den quadrierten Betrag.',
      fact: { t: 'vecNorm', v },
    });
  },
  (_lv, g: UGen): UPairItems | null => {
    const items: UPairItems = [];
    const used = new Set<number>();
    for (let i = 0; i < 60 && items.length < 4; i++) {
      const { v, length } = vector(g, 2);
      if (insert(used, length)) items.push({ front: '|a| mit a = ' + UText.vector(v), back: `${length}` });
    }
    return items.length === 4 ? items : null;
  },
);

function points(g: UGen, level: number): { a: Vec; b: Vec; length: number } {
  const { v, length } = vector(g, level);
  const a = random(g, -3, 3);
  return { a, b: a.map((x, i) => x + v[i]), length };
}

const connecting = uTemplate('v.vecAB', (_lv, g) => {
  const a = random(g, -4, 4);
  const b = random(g, -4, 4);
  const i = g.int(0, 2);
  const answer = b[i] - a[i];
  const wrongs = UCalc.differing([q(a[i] - b[i]), q(a[i] + b[i]), q(b[i]), q(a[i])], q(answer));
  return UProblems.numeric({
    key: `v.vecAB|[${a.join(', ')}]|[${b.join(', ')}]|${i}`,
    prompt: `Gegeben sind ${UText.point('A', a)} und ${UText.point('B', b)}. Welche ${axes[i]}-Komponente hat der Vektor AB?`,
    answer: q(answer),
    wrongs,
    solution: `AB = B − A; ${axes[i]}-Komponente: ${UText.signed(b[i])} − ${UCalc3.bracket(a[i])} = ${answer}.`,
    explanation: 'Verbindungsvektor: Spitze minus Fuß, also B − A, nicht A − B.',
    fact: { t: 'vectorComponent', from: a, to: b, index: i },
  });
});

const distance = uTemplate('v.dist', (lv, g) => {
  const p = points(g, lv);
  const diff = p.a.map((x, i) => p.b[i] - x);
  const squares = sum(diff.map((x) => x * x));
  const wrongs = UCalc.differing([q(squares), q(sum(diff.map((x) => Math.abs(x)))), q(p.length + 1), q(p.length - 1)], q(p.length));
  return UProblems.numeric({
    key: `v.dist|[${p.a.join(', ')}]|[${p.b.join(', ')}]`,
    prompt: `Welchen Abstand haben ${UText.point('A', p.a)} und ${UText.point('B', p.b)}?`,
    answer: q(p.length),
    wrongs,
    solution: `AB = ${UText.vector(diff)}; |AB| = √${squares} = ${p.length}.`,
    explanation: 'Der Abstand zweier Punkte ist der Betrag ihres Verbindungsvektors.',
    fact: { t: 'distance', a: p.a, b: p.b },
  });
});

const midpoint = uTemplate('v.mid', (_lv, g) => {
  const a = random(g, -4, 4);
  const b = a.map((x) => x + 2 * g.int(-3, 3));
  const i = g.int(0, 2);
  const answer = Math.trunc((a[i] + b[i]) / 2) + 0;
  const wrongs = UCalc.differing([q(a[i] + b[i]), q(b[i] - a[i]), q(b[i] - a[i], 2), q(b[i])], q(answer));
  return UProblems.numeric({
    key: `v.mid|[${a.join(', ')}]|[${b.join(', ')}]|${i}`,
    prompt: `Welche ${axes[i]}-Koordinate hat der Mittelpunkt M der Strecke zwischen ${UText.point('A', a)} und ${UText.point('B', b)}?`,
    answer: q(answer),
    wrongs,
    solution: `M = (A + B)/2; ${axes[i]}-Koordinate: (${UText.signed(a[i])} + ${b[i] < 0 ? `(${b[i]})` : `${b[i]}`})/2 = ${answer}.`,
    explanation: 'Den Mittelpunkt erhältst du, indem du die Koordinaten von A und B addierst und halbierst.',
    fact: { t: 'midpoint', a, b, index: i },
  });
});

const dotTemplate = uTemplate('v.dot', (lv, g) => {
  const [lo, hi] = lv === 1 ? [1, 4] : [-4, 4];
  const a = random(g, lo, hi);
  const b = random(g, lo, hi);
  const value = dot(a, b);
  const wrongs = UCalc.differing(
    [
      q(a[0] * b[0] + a[1] * b[1]),
      q(sum(a.map((x, i) => x + b[i]))),
      q(sum(a) * sum(b)),
      q(value - 2 * a[2] * b[2]),
      q(a[0] * b[1] + a[1] * b[2] + a[2] * b[0]),
    ],
    q(value),
  );
  return UProblems.numeric({
    key: `v.dot|[${a.join(', ')}]|[${b.join(', ')}]`,
    prompt: `Berechne das Skalarprodukt von a = ${UText.vector(a)} und b = ${UText.vector(b)}.`,
    answer: q(value),
    wrongs,
    solution: `a·b = ${dotTerms(a, b)} = ${value}.`,
    explanation: 'Das Skalarprodukt multipliziert gleiche Komponenten und addiert; das Ergebnis ist eine Zahl, kein Vektor.',
    fact: { t: 'dot', a, b },
  });
});

/** A vector orthogonal to a: (a2, -a1, 0) in some arrangement. */
export function orthogonalPartner(a: Vec, g: UGen): Vec {
  const order = g.pick([[0, 1, 2], [1, 2, 0], [2, 0, 1]]);
  const [i, j, k] = order;
  const b = [0, 0, 0];
  b[i] = a[j];
  b[j] = -a[i] + 0;
  b[k] = 0;
  return b;
}

const orthogonalChoice = uTemplate('v.orthoChoice', (_lv, g) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const a = random(g, -3, 3);
    const b = orthogonalPartner(a, g);
    if (isZeroVec(b) || isZeroVec(a)) continue;
    let wrongPairs: [Vec, Vec][] = [];
    for (let j = 0; j < 3; j++) {
      for (const delta of [1, -1, 2]) {
        const c = b.slice();
        c[j] += delta;
        if (dot(a, c) !== 0 && !isZeroVec(c) && Math.abs(c[j]) !== Math.abs(b[j])) wrongPairs.push([a, c]);
      }
    }
    wrongPairs = g.shuffled(wrongPairs).slice(0, 3);
    if (wrongPairs.length !== 3) continue;
    const text = (pair: readonly [Vec, Vec]): string => `a = ${UText.vector(pair[0])}, b = ${UText.vector(pair[1])}`;
    return UProblems.choice({
      key: `v.orthoChoice|[${a.join(', ')}]|[${b.join(', ')}]`,
      prompt: 'Bei welchem Paar stehen die Vektoren senkrecht aufeinander?',
      correct: text([a, b]),
      wrong: wrongPairs.map(text),
      solution: `Senkrecht heißt a·b = 0. Hier: ${dotTerms(a, b)} = 0. Bei den anderen Paaren ist das Skalarprodukt nicht 0.`,
      explanation: 'Zwei Vektoren (ungleich dem Nullvektor) sind genau dann orthogonal, wenn ihr Skalarprodukt 0 ist.',
      fact: { t: 'orthogonalPair', right: [a, b], wrong: wrongPairs },
    });
  }
  return null;
});

const orthogonalParameter = uTemplate('v.orthoT', (_lv, g) => {
  for (let attempt = 0; attempt < 300; attempt++) {
    const b = random(g, -4, 4);
    const a = random(g, -4, 4);
    const i = g.int(0, 2);
    if (b[i] === 0) continue;
    const others = sum([0, 1, 2].filter((x) => x !== i).map((x) => a[x] * b[x]));
    if (others % b[i] !== 0) continue;
    const t = Math.trunc(-others / b[i]) + 0;
    const shown = a.slice();
    shown[i] = t;
    const text = [0, 1, 2].map((x) => (x === i ? 't' : UText.signed(a[x]))).join(' | ');
    const wrongs = UCalc.differing(
      [q(others, b[i]), q(-others + b[i], b[i]), q(-a[(i + 1) % 3] * b[(i + 1) % 3], b[i]), q(t + 1)],
      q(t),
    );
    return UProblems.numeric({
      key: `v.orthoT|[${a.join(', ')}]|[${b.join(', ')}]|${i}`,
      prompt: `Für welches t sind a = (${text}) und b = ${UText.vector(b)} orthogonal?`,
      answer: q(t),
      wrongs,
      solution: `a·b = 0: ${others} + ${UCalc3.bracket(b[i])}·t = 0, also t = ${t}.`,
      explanation: 'Orthogonal bedeutet Skalarprodukt 0; die entstehende Gleichung löst du nach t.',
      fact: { t: 'orthoParam', a: shown, b, index: i },
    });
  }
  return null;
});

const angle = uTemplate('v.angle', (lv, g) => {
  const bases: [Vec, Vec, number][] = [
    [[1, 0, 0], [0, 1, 0], 90],
    [[1, 0, 0], [1, 0, 0], 0],
    [[1, 1, 0], [0, 1, 0], 45],
    [[1, 1, 0], [1, 0, 1], 60],
    [[1, 1, 0], [-1, 1, 0], 90],
    [[1, 0, 0], [-1, 0, 0], 180],
    [[1, 1, 0], [-1, 0, 1], 120],
  ];
  const pool = lv === 1 ? bases.slice(0, 3) : bases;
  const [a0, b0, degrees] = g.pick(pool);
  const order = g.shuffled([0, 1, 2]);
  const signs = [g.sign(), g.sign(), g.sign()];
  const ka = g.int(1, 3);
  const kb = g.int(1, 3);
  const a = [0, 1, 2].map((i) => a0[order[i]] * signs[i] * ka + 0);
  const b = [0, 1, 2].map((i) => b0[order[i]] * signs[i] * kb + 0);
  const wrongs = UCalc.differing(
    [q(180 - degrees), q(90 - degrees), q(2 * degrees), q(Math.trunc(degrees / 2)), q(90), q(45)],
    q(degrees),
  );
  const n = dot(a, b);
  return UProblems.numeric({
    key: `v.angle|[${a.join(', ')}]|[${b.join(', ')}]`,
    prompt: `Wie groß ist der Winkel zwischen a = ${UText.vector(a)} und b = ${UText.vector(b)} in Grad?`,
    answer: q(degrees),
    wrongs,
    solution: `cos φ = a·b / (|a|·|b|) mit a·b = ${n}. Das ergibt ${degrees}°.`,
    explanation: 'Der Winkel folgt aus cos φ = a·b / (|a|·|b|); ein Skalarprodukt von 0 bedeutet 90°.',
    fact: { t: 'angle', a, b },
  });
});

const lineText = (a: Vec, u: Vec): string => `g: x = ${UText.vector(a)} + t·${UText.vector(u)}`;

const linePoint = uTemplate('v.linePoint', (lv, g) => {
  const a = random(g, -4, 4);
  let u = random(g, -3, 3);
  if (isZeroVec(u)) u = [1, 2, -1];
  const t = lv === 1 ? g.int(1, 3) : g.nonzero(-3, 3);
  const i = g.int(0, 2);
  const answer = a[i] + t * u[i];
  const wrongs = UCalc.differing(
    [q(t * u[i]), q(a[i] + u[i]), q(a[i] - t * u[i]), q((a[i] + t) * u[i]), q(a[i] * u[i])],
    q(answer),
  );
  return UProblems.numeric({
    key: `v.linePoint|[${a.join(', ')}]|[${u.join(', ')}]|${t}|${i}`,
    prompt: `${lineText(a, u)}. Welche ${axes[i]}-Koordinate hat der Punkt für t = ${UText.signed(t)}?`,
    answer: q(answer),
    wrongs,
    solution: `Setze t ein: ${axes[i]} = ${UText.signed(a[i])} + ${UCalc3.bracket(t)}·${UCalc3.bracket(u[i])} = ${answer}.`,
    explanation: 'Der Ortsvektor des Aufpunkts bleibt, dazu kommt t mal der Richtungsvektor.',
    fact: { t: 'linePoint', a, u, tt: t, index: i },
  });
});

const lineParameter = uTemplate('v.lineT', (_lv, g) => {
  const a = random(g, -4, 4);
  const u = random(g, -3, 3);
  if (u[0] === 0) u[0] = g.nonzero(-3, 3);
  const t = g.nonzero(-3, 3);
  const p = [0, 1, 2].map((i) => a[i] + t * u[i]);
  const wrongs = UCalc.differing([q(-t), q(p[0] - a[0]), q(p[0], u[0]), q(t + 1), q(p[0] + a[0], u[0])], q(t));
  return UProblems.numeric({
    key: `v.lineT|[${a.join(', ')}]|[${u.join(', ')}]|${t}`,
    prompt: `${lineText(a, u)}. Der Punkt ${UText.point('P', p)} liegt auf g. Für welches t?`,
    answer: q(t),
    wrongs,
    solution: `x-Koordinate: ${p[0]} = ${a[0]} + t·${UCalc3.bracket(u[0])}, also t = ${t}. Die anderen Koordinaten passen mit demselben t.`,
    explanation: 'Ein Punkt liegt auf der Geraden, wenn alle Koordinatengleichungen dasselbe t liefern.',
    fact: { t: 'lineParam', a, u, p },
  });
});

export function isOnLine(a: Vec, u: Vec, p: Vec): boolean {
  let t: UQ | null = null;
  for (let i = 0; i < 3; i++) {
    if (u[i] === 0) {
      if (p[i] !== a[i]) return false;
      continue;
    }
    const value = q(p[i] - a[i], u[i]);
    if (t !== null) {
      if (!t.equals(value)) return false;
    } else {
      t = value;
    }
  }
  return true;
}

const pointOnLine = uTemplate('v.onLine', (_lv, g) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const a = random(g, -3, 3);
    let u = random(g, -3, 3);
    if (u.filter((x) => x !== 0).length < 2) u = [1, -2, 2];
    const t = g.nonzero(-3, 3);
    const p = [0, 1, 2].map((i) => a[i] + t * u[i]);
    let wrongs: Vec[] = [];
    for (let j = 0; j < 3; j++) {
      for (const delta of [1, -1, 2]) {
        const c = p.slice();
        c[j] += delta;
        if (Math.abs(c[j]) !== Math.abs(p[j])) wrongs.push(c);
      }
    }
    wrongs = wrongs.filter((w) => !isOnLine(a, u, w));
    const chosen = g.shuffled(wrongs).slice(0, 3);
    if (chosen.length !== 3) continue;
    const text = (r: Vec): string => UText.point('P', r);
    return UProblems.choice({
      key: `v.onLine|[${a.join(', ')}]|[${u.join(', ')}]|${t}`,
      prompt: `${lineText(a, u)}. Welcher Punkt liegt auf g?`,
      correct: text(p),
      wrong: chosen.map(text),
      solution: `Für t = ${t} ergibt sich ${text(p)}. Bei den anderen Punkten liefern die Koordinaten verschiedene t-Werte.`,
      explanation: 'Punktprobe: Setze den Punkt gleich a + t·u; er liegt nur dann auf der Geraden, wenn für jede Koordinate dasselbe t herauskommt.',
      fact: { t: 'onLine', a, u, right: p, wrong: chosen },
    });
  }
  return null;
});

const direction = uTemplate('v.dir', (_lv, g) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const a = random(g, -3, 3);
    const b = random(g, -3, 3);
    const d = a.map((x, i) => b[i] - x);
    if (same(a, b) || new Set(d.map((x) => Math.abs(x))).size !== 3) continue;
    const wrong = [a.map((x, i) => x + b[i]), b, [d[1], d[2], d[0]], [d[2], d[0], d[1]]];
    return UProblems.choice({
      key: `v.dir|[${a.join(', ')}]|[${b.join(', ')}]`,
      prompt: `Welcher Richtungsvektor gehört zur Geraden durch ${UText.point('A', a)} und ${UText.point('B', b)}?`,
      correct: UText.vector(d),
      wrong: wrong.map(UText.vector),
      solution: `Richtungsvektor: AB = B − A = ${UText.vector(d)}. Jedes Vielfache davon geht auch.`,
      explanation: 'Die Richtung der Geraden ist der Verbindungsvektor B − A; die Summe A + B oder der Ortsvektor von B zeigt in eine andere Richtung.',
      fact: { t: 'direction', a, b },
    });
  }
  return null;
});

export const MathUpperUnit06 = {
  templates: [norm, connecting, distance, midpoint, dotTemplate, orthogonalChoice, orthogonalParameter, angle, linePoint, lineParameter, pointOnLine, direction],
  isOnLine,
};

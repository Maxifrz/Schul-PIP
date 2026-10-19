import { UCalc } from './calc';
import { UGen, UPairs, UTemplate, UText, UQ, choiceProblem, numeric, uq, utemplate } from './core';

/** Unit 6: vectors (length, dot product, orthogonality, lines, point test, distance between two points). */

/** Whole-number vectors with a whole-number length: (a, b, c, length). */
const triples: [number, number, number, number][] = [
  [3, 4, 0, 5], [5, 12, 0, 13], [6, 8, 0, 10], [1, 2, 2, 3], [2, 3, 6, 7], [2, 6, 9, 11], [4, 4, 7, 9], [1, 4, 8, 9],
  [2, 10, 11, 15], [6, 6, 7, 11], [3, 4, 12, 13], [4, 8, 8, 12], [8, 9, 12, 17], [2, 2, 1, 3],
];

function vector(g: UGen, level: number): { v: number[]; length: number } {
  const pool = level === 1 ? triples.slice(0, 3) : level === 2 ? triples.slice(3, 10) : triples.slice(3);
  const t = g.pick(pool);
  const parts = g.shuffled([t[0], t[1], t[2]]).map((x) => x * g.sign());
  return { v: parts, length: t[3] };
}

const dotProduct = (a: number[], b: number[]): number => a.reduce((sum, x, i) => sum + x * b[i], 0);
const random = (g: UGen, low: number, high: number): number[] => [0, 1, 2].map(() => g.int(low, high));
const axes = ['x', 'y', 'z'];
const bracket = (n: number): string => (n < 0 ? `(${UText.signed(n)})` : `${n}`);
const isZeroVector = (v: number[]): boolean => v.every((x) => x === 0);
const sameVector = (a: number[], b: number[]): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

function normPairs(_level: number, g: UGen): UPairs | null {
  const items: UPairs = [];
  const used = new Set<number>();
  for (let i = 0; i < 60 && items.length < 4; i++) {
    const { v, length } = vector(g, 2);
    if (!used.has(length)) {
      used.add(length);
      items.push({ front: `|a| mit a = ${UText.vector(v)}`, back: `${length}` });
    }
  }
  return items.length === 4 ? items : null;
}

const norm = utemplate('v.norm', (lv, g) => {
  const { v, length } = vector(g, lv);
  const squares = v.map((x) => x * x).reduce((a, b) => a + b, 0);
  const wrongs = UCalc.differing([uq(squares), uq(v.map((x) => Math.abs(x)).reduce((a, b) => a + b, 0)), uq(Math.max(...v.map((x) => Math.abs(x)))), uq(squares, 2), uq(length + 1)], uq(length));
  return numeric({
    key: `v.norm|${v}`, prompt: `Berechne den Betrag des Vektors a = ${UText.vector(v)}.`, answer: uq(length), wrongs,
    solution: `|a| = √(${v.map((x) => `${UText.signed(x)}²`).join(' + ')}) = √${squares} = ${length}.`,
    explanation: 'Der Betrag ist die Wurzel aus der Summe der Koordinatenquadrate; ohne die Wurzel hättest du den quadrierten Betrag.',
    fact: { k: 'vecNorm', v },
  });
}, normPairs);

function points(g: UGen, level: number): { a: number[]; b: number[]; length: number } {
  const { v, length } = vector(g, level);
  const a = random(g, -3, 3);
  return { a, b: a.map((x, i) => x + v[i]), length };
}

const connecting = utemplate('v.vecAB', (_lv, g) => {
  const a = random(g, -4, 4);
  const b = random(g, -4, 4);
  const i = g.int(0, 2);
  const answer = b[i] - a[i];
  const wrongs = UCalc.differing([uq(a[i] - b[i]), uq(a[i] + b[i]), uq(b[i]), uq(a[i])], uq(answer));
  return numeric({
    key: `v.vecAB|${a}|${b}|${i}`, prompt: `Gegeben sind ${UText.point('A', a)} und ${UText.point('B', b)}. Welche ${axes[i]}-Komponente hat der Vektor AB?`, answer: uq(answer), wrongs,
    solution: `AB = B − A; ${axes[i]}-Komponente: ${UText.signed(b[i])} − ${bracket(a[i])} = ${answer}.`,
    explanation: 'Verbindungsvektor: Spitze minus Fuß, also B − A, nicht A − B.', fact: { k: 'vectorComponent', from: a, to: b, index: i },
  });
});

const distance = utemplate('v.dist', (lv, g) => {
  const p = points(g, lv);
  const diff = p.a.map((x, i) => p.b[i] - x);
  const squares = diff.map((x) => x * x).reduce((a, b) => a + b, 0);
  const wrongs = UCalc.differing([uq(squares), uq(diff.map((x) => Math.abs(x)).reduce((a, b) => a + b, 0)), uq(p.length + 1), uq(p.length - 1)], uq(p.length));
  return numeric({
    key: `v.dist|${p.a}|${p.b}`, prompt: `Welchen Abstand haben ${UText.point('A', p.a)} und ${UText.point('B', p.b)}?`, answer: uq(p.length), wrongs,
    solution: `AB = ${UText.vector(diff)}; |AB| = √${squares} = ${p.length}.`, explanation: 'Der Abstand zweier Punkte ist der Betrag ihres Verbindungsvektors.',
    fact: { k: 'distance', a: p.a, b: p.b },
  });
});

const midpoint = utemplate('v.mid', (_lv, g) => {
  const a = random(g, -4, 4);
  const b = a.map((x) => x + 2 * g.int(-3, 3));
  const i = g.int(0, 2);
  const answer = Math.trunc((a[i] + b[i]) / 2);
  const wrongs = UCalc.differing([uq(a[i] + b[i]), uq(b[i] - a[i]), uq(b[i] - a[i], 2), uq(b[i])], uq(answer));
  return numeric({
    key: `v.mid|${a}|${b}|${i}`, prompt: `Welche ${axes[i]}-Koordinate hat der Mittelpunkt M der Strecke zwischen ${UText.point('A', a)} und ${UText.point('B', b)}?`, answer: uq(answer), wrongs,
    solution: `M = (A + B)/2; ${axes[i]}-Koordinate: (${UText.signed(a[i])} + ${b[i] < 0 ? `(${b[i]})` : `${b[i]}`})/2 = ${answer}.`,
    explanation: 'Den Mittelpunkt erhältst du, indem du die Koordinaten von A und B addierst und halbierst.', fact: { k: 'midpoint', a, b, index: i },
  });
});

const dot = utemplate('v.dot', (lv, g) => {
  const [low, high] = lv === 1 ? [1, 4] : [-4, 4];
  const a = random(g, low, high);
  const b = random(g, low, high);
  const value = dotProduct(a, b);
  const wrongs = UCalc.differing([
    uq(a[0] * b[0] + a[1] * b[1]), uq(a.map((x, i) => x + b[i]).reduce((s, x) => s + x, 0)), uq(a.reduce((s, x) => s + x, 0) * b.reduce((s, x) => s + x, 0)),
    uq(value - 2 * a[2] * b[2]), uq(a[0] * b[1] + a[1] * b[2] + a[2] * b[0]),
  ], uq(value));
  return numeric({
    key: `v.dot|${a}|${b}`, prompt: `Berechne das Skalarprodukt von a = ${UText.vector(a)} und b = ${UText.vector(b)}.`, answer: uq(value), wrongs,
    solution: `a·b = ${a.map((x, i) => `${UText.signed(x)}·${bracket(b[i])}`).join(' + ')} = ${value}.`,
    explanation: 'Das Skalarprodukt multipliziert gleiche Komponenten und addiert; das Ergebnis ist eine Zahl, kein Vektor.', fact: { k: 'dot', a, b },
  });
});

/** A vector orthogonal to a: (a2, -a1, 0) in some arrangement. */
function orthogonalPartner(a: number[], g: UGen): number[] {
  const order = g.pick([[0, 1, 2], [1, 2, 0], [2, 0, 1]]);
  const [i, j, k] = order;
  const b = [0, 0, 0];
  b[i] = a[j];
  b[j] = -a[i] + 0;
  b[k] = 0;
  return b;
}

const orthogonalChoice = utemplate('v.orthoChoice', (_lv, g) => {
  for (let tries = 0; tries < 100; tries++) {
    const a = random(g, -3, 3);
    const b = orthogonalPartner(a, g);
    if (isZeroVector(b) || isZeroVector(a)) continue;
    let wrongPairs: [number[], number[]][] = [];
    for (let j = 0; j < 3; j++) {
      for (const delta of [1, -1, 2]) {
        const c = [...b];
        c[j] += delta;
        if (dotProduct(a, c) !== 0 && !isZeroVector(c) && Math.abs(c[j]) !== Math.abs(b[j])) wrongPairs.push([a, c]);
      }
    }
    wrongPairs = g.shuffled(wrongPairs).slice(0, 3);
    if (wrongPairs.length !== 3) continue;
    const text = (pair: [number[], number[]]) => `a = ${UText.vector(pair[0])}, b = ${UText.vector(pair[1])}`;
    return choiceProblem({
      key: `v.orthoChoice|${a}|${b}`, prompt: 'Bei welchem Paar stehen die Vektoren senkrecht aufeinander?', correct: text([a, b]), wrong: wrongPairs.map(text),
      solution: `Senkrecht heißt a·b = 0. Hier: ${a.map((x, i) => `${UText.signed(x)}·${bracket(b[i])}`).join(' + ')} = 0. Bei den anderen Paaren ist das Skalarprodukt nicht 0.`,
      explanation: 'Zwei Vektoren (ungleich dem Nullvektor) sind genau dann orthogonal, wenn ihr Skalarprodukt 0 ist.',
      fact: { k: 'orthogonalPair', right: [a, b], wrong: wrongPairs },
    });
  }
  return null;
});

const orthogonalParameter = utemplate('v.orthoT', (_lv, g) => {
  for (let tries = 0; tries < 300; tries++) {
    const b = random(g, -4, 4);
    const a = random(g, -4, 4);
    const i = g.int(0, 2);
    if (b[i] === 0) continue;
    const others = [0, 1, 2].filter((x) => x !== i).map((x) => a[x] * b[x]).reduce((s, x) => s + x, 0);
    if (others % b[i] !== 0) continue;
    const t = -others / b[i] + 0;
    const shown = [...a];
    shown[i] = t;
    const text = [0, 1, 2].map((x) => (x === i ? 't' : UText.signed(a[x]))).join(' | ');
    const wrongs = UCalc.differing([uq(others, b[i]), uq(-others + b[i], b[i]), uq(-a[(i + 1) % 3] * b[(i + 1) % 3], b[i]), uq(t + 1)], uq(t));
    return numeric({
      key: `v.orthoT|${a}|${b}|${i}`, prompt: `Für welches t sind a = (${text}) und b = ${UText.vector(b)} orthogonal?`, answer: uq(t), wrongs,
      solution: `a·b = 0: ${others} + ${bracket(b[i])}·t = 0, also t = ${t}.`, explanation: 'Orthogonal bedeutet Skalarprodukt 0; die entstehende Gleichung löst du nach t.',
      fact: { k: 'orthoParam', a: shown, b, index: i },
    });
  }
  return null;
});

const angle = utemplate('v.angle', (lv, g) => {
  const bases: [number[], number[], number][] = [
    [[1, 0, 0], [0, 1, 0], 90], [[1, 0, 0], [1, 0, 0], 0], [[1, 1, 0], [0, 1, 0], 45], [[1, 1, 0], [1, 0, 1], 60],
    [[1, 1, 0], [-1, 1, 0], 90], [[1, 0, 0], [-1, 0, 0], 180], [[1, 1, 0], [-1, 0, 1], 120],
  ];
  const pool = lv === 1 ? bases.slice(0, 3) : bases;
  const [a0, b0, degrees] = g.pick(pool);
  const order = g.shuffled([0, 1, 2]);
  const signs = [g.sign(), g.sign(), g.sign()];
  const ka = g.int(1, 3);
  const kb = g.int(1, 3);
  const a = [0, 1, 2].map((x) => a0[order[x]] * signs[x] * ka);
  const b = [0, 1, 2].map((x) => b0[order[x]] * signs[x] * kb);
  const wrongs = UCalc.differing([uq(180 - degrees), uq(90 - degrees), uq(2 * degrees), uq(Math.trunc(degrees / 2)), uq(90), uq(45)], uq(degrees));
  const n = dotProduct(a, b);
  return numeric({
    key: `v.angle|${a}|${b}`, prompt: `Wie groß ist der Winkel zwischen a = ${UText.vector(a)} und b = ${UText.vector(b)} in Grad?`, answer: uq(degrees), wrongs,
    solution: `cos φ = a·b / (|a|·|b|) mit a·b = ${n}. Das ergibt ${degrees}°.`, explanation: 'Der Winkel folgt aus cos φ = a·b / (|a|·|b|); ein Skalarprodukt von 0 bedeutet 90°.',
    fact: { k: 'angle', a, b },
  });
});

const lineText = (a: number[], u: number[]): string => `g: x = ${UText.vector(a)} + t·${UText.vector(u)}`;

const linePoint = utemplate('v.linePoint', (lv, g) => {
  const a = random(g, -4, 4);
  let u = random(g, -3, 3);
  if (isZeroVector(u)) u = [1, 2, -1];
  const t = lv === 1 ? g.int(1, 3) : g.nonzero(-3, 3);
  const i = g.int(0, 2);
  const answer = a[i] + t * u[i];
  const wrongs = UCalc.differing([uq(t * u[i]), uq(a[i] + u[i]), uq(a[i] - t * u[i]), uq((a[i] + t) * u[i]), uq(a[i] * u[i])], uq(answer));
  return numeric({
    key: `v.linePoint|${a}|${u}|${t}|${i}`, prompt: `${lineText(a, u)}. Welche ${axes[i]}-Koordinate hat der Punkt für t = ${UText.signed(t)}?`, answer: uq(answer), wrongs,
    solution: `Setze t ein: ${axes[i]} = ${UText.signed(a[i])} + ${bracket(t)}·${bracket(u[i])} = ${answer}.`,
    explanation: 'Der Ortsvektor des Aufpunkts bleibt, dazu kommt t mal der Richtungsvektor.', fact: { k: 'linePoint', a, u, t, index: i },
  });
});

const lineParameter = utemplate('v.lineT', (_lv, g) => {
  const a = random(g, -4, 4);
  const u = random(g, -3, 3);
  if (u[0] === 0) u[0] = g.nonzero(-3, 3);
  const t = g.nonzero(-3, 3);
  const p = [0, 1, 2].map((x) => a[x] + t * u[x]);
  const wrongs = UCalc.differing([uq(-t), uq(p[0] - a[0]), uq(p[0], u[0]), uq(t + 1), uq(p[0] + a[0], u[0])], uq(t));
  return numeric({
    key: `v.lineT|${a}|${u}|${t}`, prompt: `${lineText(a, u)}. Der Punkt ${UText.point('P', p)} liegt auf g. Für welches t?`, answer: uq(t), wrongs,
    solution: `x-Koordinate: ${p[0]} = ${a[0]} + t·${bracket(u[0])}, also t = ${t}. Die anderen Koordinaten passen mit demselben t.`,
    explanation: 'Ein Punkt liegt auf der Geraden, wenn alle Koordinatengleichungen dasselbe t liefern.', fact: { k: 'lineParam', a, u, p },
  });
});

function isOnLine(a: number[], u: number[], p: number[]): boolean {
  let t: UQ | null = null;
  for (let i = 0; i < 3; i++) {
    if (u[i] === 0) {
      if (p[i] !== a[i]) return false;
      continue;
    }
    const value = uq(p[i] - a[i], u[i]);
    if (t) {
      if (!t.equals(value)) return false;
    } else t = value;
  }
  return true;
}

const pointOnLine = utemplate('v.onLine', (_lv, g) => {
  for (let tries = 0; tries < 100; tries++) {
    const a = random(g, -3, 3);
    let u = random(g, -3, 3);
    if (u.filter((x) => x !== 0).length < 2) u = [1, -2, 2];
    const t = g.nonzero(-3, 3);
    const p = [0, 1, 2].map((x) => a[x] + t * u[x]);
    let wrongs: number[][] = [];
    for (let j = 0; j < 3; j++) {
      for (const delta of [1, -1, 2]) {
        const c = [...p];
        c[j] += delta;
        if (Math.abs(c[j]) !== Math.abs(p[j])) wrongs.push(c);
      }
    }
    wrongs = wrongs.filter((c) => !isOnLine(a, u, c));
    const chosen = g.shuffled(wrongs).slice(0, 3);
    if (chosen.length !== 3) continue;
    const text = (q: number[]) => UText.point('P', q);
    return choiceProblem({
      key: `v.onLine|${a}|${u}|${t}`, prompt: `${lineText(a, u)}. Welcher Punkt liegt auf g?`, correct: text(p), wrong: chosen.map(text),
      solution: `Für t = ${t} ergibt sich ${text(p)}. Bei den anderen Punkten liefern die Koordinaten verschiedene t-Werte.`,
      explanation: 'Punktprobe: Setze den Punkt gleich a + t·u; er liegt nur dann auf der Geraden, wenn für jede Koordinate dasselbe t herauskommt.',
      fact: { k: 'onLine', a, u, right: p, wrong: chosen },
    });
  }
  return null;
});

const direction = utemplate('v.dir', (_lv, g) => {
  for (let tries = 0; tries < 100; tries++) {
    const a = random(g, -3, 3);
    const b = random(g, -3, 3);
    const d = a.map((x, i) => b[i] - x);
    if (sameVector(a, b) || new Set(d.map((x) => Math.abs(x))).size !== 3) continue;
    const wrong = [a.map((x, i) => x + b[i]), b, [d[1], d[2], d[0]], [d[2], d[0], d[1]]];
    return choiceProblem({
      key: `v.dir|${a}|${b}`, prompt: `Welcher Richtungsvektor gehört zur Geraden durch ${UText.point('A', a)} und ${UText.point('B', b)}?`, correct: UText.vector(d), wrong: wrong.map(UText.vector),
      solution: `Richtungsvektor: AB = B − A = ${UText.vector(d)}. Jedes Vielfache davon geht auch.`,
      explanation: 'Die Richtung der Geraden ist der Verbindungsvektor B − A; die Summe A + B oder der Ortsvektor von B zeigt in eine andere Richtung.',
      fact: { k: 'direction', a, b },
    });
  }
  return null;
});

export const unit06: UTemplate[] = [norm, connecting, distance, midpoint, dot, orthogonalChoice, orthogonalParameter, angle, linePoint, lineParameter, pointOnLine, direction];

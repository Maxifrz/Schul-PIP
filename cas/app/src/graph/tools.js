// Construction tools of the graphics: tap points and objects, and the tool writes the row that constructs the
// result (g = gerade(A, B)), so every construction is also in the CAS and stays editable there.

/**
 * picks: what each tap chooses — 'point' (an existing point, or a new one where tapped), 'object' (a named line,
 * circle, segment or graph), 'glider' (an object, and where on it). `repeat`: points until the first one is tapped
 * again (polygons). kind: what the result is called like (point: A, B …; angle: α, β …; else g, h …).
 */
export const TOOLS = [
  { id: 'move', label: 'Bewegen', picks: [], hint: 'Ziehen verschiebt die Ansicht oder einen Punkt.' },
  { id: 'point', label: 'Punkt', picks: ['point'], kind: 'point', hint: ['Tippe, wo der Punkt hin soll.'] },
  { id: 'segment', label: 'Strecke', picks: ['point', 'point'], kind: 'object', build: ([A, B]) => `strecke(${A},${B})`, hint: ['Tippe den Anfangspunkt.', 'Tippe den Endpunkt.'] },
  { id: 'line', label: 'Gerade', picks: ['point', 'point'], kind: 'object', build: ([A, B]) => `gerade(${A},${B})`, hint: ['Tippe den ersten Punkt der Geraden.', 'Tippe den zweiten Punkt.'] },
  { id: 'ray', label: 'Strahl', picks: ['point', 'point'], kind: 'object', build: ([A, B]) => `strahl(${A},${B})`, hint: ['Tippe den Anfangspunkt.', 'Tippe einen Punkt, durch den er geht.'] },
  { id: 'vector', label: 'Vektor', picks: ['point', 'point'], kind: 'object', build: ([A, B]) => `vektor(${A},${B})`, hint: ['Tippe den Anfangspunkt.', 'Tippe die Spitze.'] },
  { id: 'polygon', label: 'Vieleck', picks: ['point'], repeat: true, kind: 'polygon', build: (points) => `polygon(${points.join(',')})`, hint: ['Tippe die erste Ecke.', 'Tippe die nächste Ecke – zum Schließen wieder die erste.'] },
  { id: 'circle', label: 'Kreis', picks: ['point', 'point'], kind: 'object', build: ([M, P]) => `kreis(${M},${P})`, hint: ['Tippe den Mittelpunkt.', 'Tippe einen Punkt auf dem Kreis.'] },
  { id: 'circle3', label: 'Kreis durch 3', picks: ['point', 'point', 'point'], kind: 'object', build: ([A, B, C]) => `kreis(${A},${B},${C})`, hint: ['Tippe den ersten Punkt.', 'Tippe den zweiten Punkt.', 'Tippe den dritten Punkt.'] },
  { id: 'midpoint', label: 'Mitte', picks: ['point', 'point'], kind: 'point', build: ([A, B]) => `mittelpunkt(${A},${B})`, hint: ['Tippe den ersten Punkt.', 'Tippe den zweiten Punkt.'] },
  { id: 'intersect', label: 'Schnitt', picks: ['object', 'object'], kind: 'point', build: ([g, h]) => `schnittpunkt(${g},${h})`, hint: ['Tippe das erste Objekt.', 'Tippe das zweite Objekt.'] },
  { id: 'parallel', label: 'Parallele', picks: ['object', 'point'], kind: 'object', build: ([g, P]) => `parallele(${g},${P})`, hint: ['Tippe die Gerade.', 'Tippe den Punkt, durch den die Parallele geht.'] },
  { id: 'perpendicular', label: 'Senkrechte', picks: ['object', 'point'], kind: 'object', build: ([g, P]) => `senkrechte(${g},${P})`, hint: ['Tippe die Gerade.', 'Tippe den Punkt, durch den die Senkrechte geht.'] },
  { id: 'bisector', label: 'Mittelsenkrechte', picks: ['point', 'point'], kind: 'object', build: ([A, B]) => `mittelsenkrechte(${A},${B})`, hint: ['Tippe den ersten Punkt.', 'Tippe den zweiten Punkt.'] },
  { id: 'anglebisector', label: 'Winkelhalbierende', picks: ['point', 'point', 'point'], kind: 'object', build: ([A, B, C]) => `winkelhalbierende(${A},${B},${C})`, hint: ['Tippe einen Punkt auf dem ersten Schenkel.', 'Tippe den Scheitel.', 'Tippe einen Punkt auf dem zweiten Schenkel.'] },
  { id: 'angle', label: 'Winkel', picks: ['point', 'point', 'point'], kind: 'angle', build: ([A, B, C]) => `winkel(${A},${B},${C})`, hint: ['Tippe einen Punkt auf dem ersten Schenkel.', 'Tippe den Scheitel.', 'Tippe einen Punkt auf dem zweiten Schenkel.'] },
  { id: 'glider', label: 'Punkt auf Objekt', picks: ['glider'], kind: 'point', build: ([{ name, t }]) => `punktauf(${name},${t})`, hint: ['Tippe auf eine Gerade, einen Kreis oder einen Graphen.'] },
  { id: 'reflect', label: 'Spiegeln', picks: ['any', 'any'], kind: 'same', build: ([X, Y]) => `spiegeln(${X},${Y})`, hint: ['Tippe, was gespiegelt werden soll.', 'Tippe den Spiegelpunkt oder die Spiegelgerade.'] },
];

export function tool(id) {
  return TOOLS.find((t) => t.id === id) || TOOLS[0];
}

const POINT_NAMES = 'ABCDEFGHIJKLMNOPQRSTUVWZ'.split('');
const OBJECT_NAMES = 'ghpqruvwcdjlm'.split('');
const ANGLE_NAMES = ['alpha', 'beta', 'gamma', 'delta', 'epsilon', 'phi', 'psi', 'omega'];
const POLYGON_NAMES = ['vieleck'];

/** The next free name of a kind: A, B … then A_1; g, h … then g_1; α, β … */
export function nextName(kind, taken) {
  const lists = { point: POINT_NAMES, angle: ANGLE_NAMES, polygon: POLYGON_NAMES, object: OBJECT_NAMES };
  const list = lists[kind] || OBJECT_NAMES;
  for (let round = 0; round < 50; round++) {
    for (const base of list) {
      const name = kind === 'polygon' ? base + (round + 1) : round ? `${base}_${round}` : base;
      if (!taken.has(name)) return name;
    }
  }
  return 'objekt' + Date.now();
}

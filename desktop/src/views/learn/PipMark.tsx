// Pip, the cat of the app, drawn as 13 by 13 pixels like the iOS app and the game on the Heute page. The colours are the
// tokens of the app (the pink of the nose and the white of the paws are mixed from them).

const cat = [
  '.............', '.oo.......oo.', '.opo.....opo.', '.offo...offo.', '.offfffffffo.', 'offfffffffffo', 'offeefffeeffo',
  'offeefffeeffo', 'offfffpfffffo', 'offfffffffffo', '.offfffffffo.', '.offwwfffwwo.', '..ooooooooo..',
];

const fills: Record<string, string> = {
  o: 'var(--rail)',
  e: 'var(--rail)',
  f: 'var(--accent)',
  p: 'color-mix(in srgb, var(--danger) 45%, var(--rail-ink))',
  w: 'var(--rail-ink)',
};

export function PipMark({ pixel = 8 }: { pixel?: number }) {
  const cells: JSX.Element[] = [];
  cat.forEach((row, r) => {
    Array.from(row).forEach((value, c) => {
      if (value !== '.') cells.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.02} height={1.02} fill={fills[value]} />);
    });
  });
  return (
    <svg width={13 * pixel} height={13 * pixel} viewBox="0 0 13 13" aria-hidden="true" shapeRendering="crispEdges" className="lrn-pip">
      {cells}
    </svg>
  );
}

import { cat, palette } from '../lib/pipArt';

/** Pip as pixels: the same 13 by 13 grid the Heute tab draws. */
export function PipLogo({ pixel = 6 }: { pixel?: number }) {
  const size = cat.length * pixel;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${cat.length} ${cat.length}`} shapeRendering="crispEdges" aria-hidden="true" style={{ display: 'block' }}>
      {cat.flatMap((row, y) => [...row].map((value, x) => (value === '.' ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={palette[value] ?? '#0a0a08'} />)))}
    </svg>
  );
}

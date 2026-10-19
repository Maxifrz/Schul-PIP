const paths: Record<string, string> = {
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dumbbell: 'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
  seal: 'M12 3l2.2 1.7 2.8-.2 1 2.6 2.4 1.5-.7 2.7 1 2.6-2 2-.3 2.8-2.7.7L12 21l-2.2-1.7-2.8.2-1-2.6L3.6 15.4l.7-2.7-1-2.6 2-2 .3-2.8 2.7-.7zM8.8 12.2l2.2 2.2 4.2-4.4',
  chest: 'M4 9l2-4h12l2 4M4 9h16v10H4zM4 13h16M11 13v3h2v-3',
  flame: 'M12 2.8c.9 3.2 4.7 5.1 4.7 9.7a4.7 4.7 0 0 1-9.4 0c0-1.9.9-3.2 1.7-4 .3 1.4 1 2.1 1.8 2.3-.4-2.7.3-5.7 1.2-8z',
  diamond: 'M7 4h10l4 5-9 11L3 9z M3 9h18',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  book: 'M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  checkCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.3l2.8 2.8L16.2 9.5',
  xCircle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9 9l6 6M15 9l-6 6',
  stack: 'M12 3l9 4.5-9 4.5L3 7.5zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  snowflake: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2',
  doc: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.4.5.8.5 1.1h6c0-.3.1-.7.5-1.1A6 6 0 0 0 12 3z',
  undo: 'M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12',
  x: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.5',
  speaker: 'M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  circle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z',
  // course symbols
  bubble: 'M4 5h16v11H11l-4 4v-4H4z',
  columns: 'M4 8l8-4 8 4M5 9h14M7 10v7M12 10v7M17 10v7M4 19h16',
  text: 'M5 7V5h14v2M12 5v14M9 19h6',
  function: 'M14 4c-3 0-3 3-3 5v6c0 2 0 5-3 5M7 10h8',
  percent: 'M18 6L6 18M8 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM16 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  crown: 'M4 17L3 7l5 4 4-6 4 6 5-4-1 10zM4 20h16',
  music: 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM19 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
};

/** The course symbols the iOS app names after SF Symbols, mapped to the glyphs here. */
export const courseGlyph = (symbol: string): string =>
  ({ 'text.bubble.fill': 'bubble', 'building.columns.fill': 'columns', textformat: 'text', 'book.fill': 'book', function: 'function', percent: 'percent', 'crown.fill': 'crown', 'music.note': 'music', 'doc.text.fill': 'doc', doc: 'doc', globe: 'globe' })[symbol] ?? 'star';

export function Glyph({ name, size = 20, fill = false, stroke = 1.9 }: { name: string; size?: number; fill?: boolean; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}>
      <path d={paths[name] ?? paths.star} />
    </svg>
  );
}

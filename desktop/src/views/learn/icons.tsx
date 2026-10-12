// The small drawn symbols of the Lernen area (the iOS app uses SF Symbols, which do not exist here). Stroke icons on a
// 24 by 24 grid in the current text colour.

const paths = {
  star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  dumbbell: 'M3.5 9.5v5M6.5 7v10M17.5 7v10M20.5 9.5v5M6.5 12h11',
  seal: 'M12 3l2.2 1.6 2.7-.1.9 2.600 2.200 1.600-.8 2.600.8 2.600-2.200 1.600-.9 2.600-2.700-.1L12 21l-2.200-1.600-2.700.1-.9-2.600L3.999 15.300l.8-2.600-.8-2.600L6.200 8.500l.9-2.600 2.700.1z M8.800 12.200l2.200 2.200 4.200-4.400',
  flag: 'M6 21V4M6 5h11l-2.500 3.500L17 12H6',
  chest: 'M4 10h16v9H4zM4 10a8 5 0 0 1 16 0M4 14h16M12 12.500v3',
  book: 'M5 4.500h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10',
  flame: 'M12 3c1 3.500 5 5.500 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 2.500 1.500 2.500C11 9.500 10.500 6 12 3z',
  diamond: 'M7 4h10l4 5-9 11L3 9z M3 9h18 M9.500 4L8 9l4 11 4-11-1.500-5',
  snowflake: 'M12 3v18M4.200 7.500l15.600 9M4.200 16.500l15.600-9M9.500 4.500L12 7l2.500-2.500M9.500 19.500L12 17l2.500 2.500',
  bolt: 'M13 3L5 13.500h6L10 21l8-10.500h-6z',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16.500a4.500 4.500 0 1 0 0-9 4.500 4.500 0 0 0 0 9zM12 12h.01',
  calendar: 'M4.500 6h15v14h-15zM4.500 10h15M8.500 3.500v4M15.500 3.500v4',
  scroll: 'M7 4h11v13a3 3 0 0 1-3 3H6a2 2 0 0 0 2-2v-1H4v-2h3zM10 8h5M10 11.500h5',
  stack: 'M12 4l9 4.500-9 4.500-9-4.500zM3 12.500l9 4.500 9-4.500M3 16.500l9 4.500 9-4.500',
  circle: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17z',
  play: 'M9 6.500l9 5.500-9 5.500z',
  dots: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17z',
  half: 'M12 20.500a8.500 8.500 0 1 0 0-17v17z',
  checkCircle: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17zM8 12.200l2.800 2.800L16.200 9.500',
  redo: 'M19 12a7 7 0 1 1-2.100-5M19 4v4.500h-4.500',
  speaker: 'M4 9.500h3.500L12 6v12l-4.500-3.500H4zM15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11',
  slow: 'M4 15c0-3.500 3.500-6 8-6s8 2.500 8 6zM8 9c0-2 1.500-3.500 4-3.500M5 15l-1.500 3M19 15l1.500 3M9 18l-1 2M15 18l1 2',
  bulb: 'M9 17.500h6M10 20.500h4M12 3.500a6 6 0 0 0-3.500 10.900c.6.500 1 1.200 1 2.100h5c0-.9.400-1.600 1-2.100A6 6 0 0 0 12 3.500z',
  close: 'M6 6l12 12M18 6L6 18',
  info: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17zM12 11v5.500M12 7.700h.01',
  chat: 'M4 5.500h16v11H9.500L5 20v-3.500H4z',
  globe: 'M12 20.500a8.500 8.500 0 1 0 0-17 8.500 8.500 0 0 0 0 17zM3.500 12h17M12 3.500c2.500 2.500 3.500 5.500 3.500 8.500s-1 6-3.500 8.500c-2.500-2.500-3.500-5.500-3.500-8.500s1-6 3.500-8.500z',
  sigma: 'M18 5H7l5.500 7L7 19h11',
  pawn: 'M12 4.500a2.500 2.500 0 1 0 0 5 2.500 2.500 0 0 0 0-5zM10 10.500h4M10.500 11c0 3-1.500 5-3 7.500h9c-1.500-2.500-3-4.500-3-7.500zM7 20h10',
  note: 'M9 18V5.500l10-2V16M9 18a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0zM19 16a2.500 2.500 0 1 1-5 0 2.500 2.500 0 0 1 5 0z',
  chevron: 'M9 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
} as const;

export type IconName = keyof typeof paths;

export function LIcon({ name, size = 20, stroke = 1.8, className }: { name: IconName; size?: number; stroke?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

/** Same icon, filled with the current colour. */
export function LIconFilled({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

/** The symbol of a course by its kind. */
export function courseIconName(kind: string): IconName {
  switch (kind) {
    case 'language':
      return 'chat';
    case 'school':
      return 'book';
    case 'math':
      return 'sigma';
    case 'chess':
      return 'pawn';
    case 'music':
      return 'note';
    default:
      return 'globe';
  }
}

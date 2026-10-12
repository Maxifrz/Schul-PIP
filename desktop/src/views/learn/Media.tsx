// What an exercise shows or plays above its question: a position, a staff, notes to hear, a word to hear, and the
// keyboard to tap a key on. The arithmetic is in geometry.ts.

import { useEffect, useRef, useState } from 'react';
import type { BoardSpec, ToneSpec } from '../../lib/learn/media';
import type { StaffSpec } from '../../lib/learn/music';
import {
  PianoLayout, boardPlacement, germanPieceName, isDarkSquare, layoutStaff, midiFrequency, moveHint, pieceOn, sideToMove, squareAt,
  squareMark, staffDescription, toneButtonLabel, toneEnvelope, toneHarmonics, toneSchedule, voiceFor,
} from './geometry';
import { LIconFilled } from './icons';

// Chess

/** One piece, drawn as a silhouette in a 100 by 100 box: light pieces with a dark edge, dark pieces dark. */
function PieceShape({ kind }: { kind: string }) {
  switch (kind) {
    case 'p':
      return (
        <>
          <circle cx="50" cy="29" r="11" />
          <rect x="38" y="42" width="24" height="6" rx="3" />
          <path d="M41 48Q43 62 34 78H66Q57 62 59 48Z" />
          <rect x="28" y="78" width="44" height="9" rx="3" />
        </>
      );
    case 'r':
      return (
        <>
          <path d="M30 20H38V27H44V20H56V27H62V20H70V40H30Z" />
          <path d="M34 40H66L63 72H37Z" />
          <rect x="27" y="72" width="46" height="13" rx="3" />
        </>
      );
    case 'n':
      return (
        <>
          <path d="M31 84C31 62 38 52 47 45C40 44 34 46 29 51L24 45C29 33 38 23 50 21L53 13L59 21C71 25 73 44 71 57C70 67 69 76 70 84Z" />
          <circle className="eye" cx="55" cy="31" r="2.600" />
        </>
      );
    case 'b':
      return (
        <>
          <circle cx="50" cy="13" r="5" />
          <path d="M50 19C63 29 65 40 57 49H43C35 40 37 29 50 19Z" />
          <path d="M40 49H60L63 72H37Z" />
          <rect x="27" y="72" width="46" height="13" rx="3" />
        </>
      );
    case 'q':
      return (
        <>
          <circle cx="20" cy="27" r="5" />
          <circle cx="36" cy="19" r="5" />
          <circle cx="50" cy="15" r="5" />
          <circle cx="64" cy="19" r="5" />
          <circle cx="80" cy="27" r="5" />
          <path d="M26 72L18 32L36 52L40 26L50 50L60 26L64 52L82 32L74 72Z" />
          <rect x="24" y="72" width="52" height="13" rx="3" />
        </>
      );
    default:
      return (
        <>
          <rect x="46.500" y="8" width="7" height="24" rx="1.500" />
          <rect x="39" y="15" width="22" height="7" rx="1.500" />
          <path d="M33 72Q26 52 36 42Q50 33 64 42Q74 52 67 72Z" />
          <rect x="24" y="72" width="52" height="13" rx="3" />
        </>
      );
  }
}

export function ChessPiece({ piece }: { piece: string }) {
  const white = piece === piece.toUpperCase();
  return (
    <svg className={`lrn-piece ${white ? 'white' : 'black'}`} viewBox="0 0 100 100" aria-hidden="true">
      <PieceShape kind={piece.toLowerCase()} />
    </svg>
  );
}

/** A chess board with the pieces of a position. With `onTap` its squares can be used (to find a move); without it the
 * board only shows the position, with the squares in `spec.marked` ringed. One tab stop, arrow keys move between the
 * squares. */
export function ChessBoard({
  spec, from = null, to = null, correctMoves = [], verdict = null, onTap,
}: {
  spec: BoardSpec;
  from?: string | null;
  to?: string | null;
  correctMoves?: readonly string[];
  verdict?: 'right' | 'wrong' | null;
  onTap?: (square: string) => void;
}) {
  const board = boardPlacement(spec.fen);
  const [cursor, setCursor] = useState({ row: 7, column: 0 });
  const grid = useRef<HTMLDivElement>(null);

  const move = (event: React.KeyboardEvent, row: number, column: number) => {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = delta[event.key];
    if (!step) return;
    event.preventDefault();
    const next = { row: Math.min(7, Math.max(0, row + step[0])), column: Math.min(7, Math.max(0, column + step[1])) };
    setCursor(next);
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-cell="${next.row}-${next.column}"]`)?.focus());
  };

  return (
    <div className="lrn-board" role={onTap ? 'group' : 'img'} aria-label="Schachbrett" ref={grid}>
      {Array.from({ length: 64 }, (_, index) => {
        const row = Math.floor(index / 8);
        const column = index % 8;
        const square = squareAt(row, column, spec.flipped);
        const piece = pieceOn(board, square);
        const mark = squareMark(square, from, to, correctMoves, verdict);
        const label = piece ? `${square}, ${germanPieceName(piece)}` : `${square}, leer`;
        return (
          <button
            key={square}
            type="button"
            className={`sq ${isDarkSquare(row, column) ? 'dark' : 'light'} ${mark ?? ''} ${spec.marked.includes(square) ? 'marked' : ''}`}
            data-square={square}
            data-cell={`${row}-${column}`}
            aria-label={label}
            aria-pressed={onTap ? square === from || square === to : undefined}
            tabIndex={onTap && cursor.row === row && cursor.column === column ? 0 : -1}
            disabled={!onTap}
            onClick={() => onTap?.(square)}
            onFocus={() => onTap && setCursor({ row, column })}
            onKeyDown={(event) => move(event, row, column)}
          >
            {spec.marked.includes(square) && <span className="ring" />}
            {piece && <ChessPiece piece={piece} />}
            {column === 0 && <span className="rank">{square[1]}</span>}
            {row === 7 && <span className="file">{square[0]}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The board of a "find the move" exercise: tap the piece, then the square to move it to. */
export function ChessMove({
  spec, from, to, correctMoves, verdict, onTap,
}: {
  spec: BoardSpec;
  from: string | null;
  to: string | null;
  correctMoves: readonly string[];
  verdict: 'right' | 'wrong' | null;
  onTap: (square: string) => void;
}) {
  const side = sideToMove(spec.fen);
  return (
    <div className="lrn-move">
      {side && <div className="muted small" style={{ fontWeight: 500 }}>{side} ist am Zug</div>}
      <ChessBoard spec={spec} from={from} to={to} correctMoves={correctMoves} verdict={verdict} onTap={verdict === null ? onTap : undefined} />
      <div className="muted small lrn-move-hint" aria-live="polite">{moveHint(from, to, verdict)}</div>
    </div>
  );
}

// Staff

export function StaffView({ spec }: { spec: StaffSpec }) {
  const layout = layoutStaff(spec, 520);
  return (
    <svg className="lrn-staff" viewBox={`0 0 ${layout.width} ${layout.height}`} role="img" aria-label={staffDescription(spec)}>
      {layout.primitives.map((p, i) => {
        switch (p.kind) {
          case 'line':
            return <line key={i} x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeWidth={p.width} stroke="currentColor" strokeLinecap={p.cap} />;
          case 'fill':
            return <path key={i} d={p.d} fill="currentColor" />;
          case 'stroke':
            return <path key={i} d={p.d} fill="none" stroke="currentColor" strokeWidth={p.width} strokeLinecap="round" />;
          case 'ellipse':
            return (
              <ellipse
                key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} transform={`rotate(${p.rotate} ${p.cx} ${p.cy})`}
                fill={p.mode === 'fill' ? 'currentColor' : 'none'} stroke={p.mode === 'stroke' ? 'currentColor' : 'none'} strokeWidth={p.width}
              />
            );
          case 'rect':
            return <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} fill="currentColor" />;
          case 'text':
            return (
              <text key={i} x={p.x} y={p.y} fontSize={p.size} fontWeight={700} textAnchor="middle" dominantBaseline="central" fill="currentColor" style={{ fontFamily: 'var(--sans)' }}>
                {p.text}
              </text>
            );
        }
      })}
    </svg>
  );
}

// Piano

export function PianoKeys({
  correct, choice, verdict, onPick,
}: {
  correct: readonly number[];
  choice: string | null;
  verdict: 'right' | 'wrong' | null;
  onPick: (midi: string) => void;
}) {
  const { low, high } = PianoLayout.range(correct);
  const whites = PianoLayout.whiteKeys(low, high);
  const blacks: number[] = [];
  for (let m = low; m <= high; m++) if (PianoLayout.isBlack(m)) blacks.push(m);
  const stateOf = (midi: number): string => {
    const text = String(midi);
    if (verdict) {
      if (correct.includes(midi)) return verdict === 'right' || choice === text ? 'right' : 'right soft';
      if (choice === text) return 'wrong';
    } else if (choice === text) return 'picked';
    return '';
  };
  const key = (midi: number, black: boolean, style?: React.CSSProperties) => (
    <button
      key={midi} type="button" className={`key ${black ? 'black' : 'white'} ${stateOf(midi)}`} style={style}
      aria-label={PianoLayout.name(midi)} aria-pressed={choice === String(midi)} disabled={verdict !== null}
      onClick={() => onPick(String(midi))}
    />
  );
  return (
    <div className="lrn-piano" role="group" aria-label="Klaviatur">
      <div className="whites">{whites.map((m) => key(m, false))}</div>
      {blacks.map((m) => {
        const width = 100 / whites.length;
        return key(m, true, { left: `${PianoLayout.blackKeyCenter(m, low) * width - width * 0.31}%`, width: `${width * 0.62}%` });
      })}
    </div>
  );
}

// Speech

let speechVoices: SpeechSynthesisVoice[] = [];

function readVoices(): SpeechSynthesisVoice[] {
  try {
    if (typeof speechSynthesis === 'undefined') return [];
    speechVoices = speechSynthesis.getVoices();
  } catch {
    speechVoices = [];
  }
  return speechVoices;
}

/** The system voice for a language, or null while there is none: then the screen has no button. */
export function useVoice(language: string): SpeechSynthesisVoice | null {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => readVoices());
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const update = () => setVoices(readVoices());
    update();
    speechSynthesis.addEventListener?.('voiceschanged', update);
    return () => speechSynthesis.removeEventListener?.('voiceschanged', update);
  }, []);
  return voiceFor(voices, language);
}

function speak(text: string, voice: SpeechSynthesisVoice, slow: boolean): void {
  if (text.trim() === '') return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = slow ? 0.6 : 0.9;
  speechSynthesis.speak(utterance);
}

/** A round speaker button, and a slow one beside it. `autoplay` says the text once when it appears, for exercises that
 * ask what was heard. Nothing is shown when the system has no voice for the language. */
export function SpeakButton({ text, language, autoplay }: { text: string; language: string; autoplay: boolean }) {
  const voice = useVoice(language);
  const played = useRef(false);
  useEffect(() => {
    if (voice && autoplay && !played.current) {
      played.current = true;
      speak(text, voice, false);
    }
    return () => {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    };
  }, [voice, autoplay, text]);
  if (!voice) return null;
  return (
    <div className="lrn-speak">
      <button type="button" className="lrn-roundbtn big" aria-label="Anhören" onClick={() => speak(text, voice, false)}>
        <LIconFilled name="speaker" size={24} />
      </button>
      <button type="button" className="lrn-roundbtn" aria-label="Langsam anhören" onClick={() => speak(text, voice, true)}>
        <LIconFilled name="slow" size={18} />
      </button>
    </div>
  );
}

// Tones

let audio: AudioContext | null = null;
let sounding: Array<{ stop(): void }> = [];

function stopTones(): void {
  for (const node of sounding) {
    try {
      node.stop();
    } catch {
      // already stopped
    }
  }
  sounding = [];
}

/** Plays the notes with oscillators: a few harmonics with a quick attack and a slow decay, computed on the device. */
export function playTones(spec: ToneSpec): void {
  if (spec.midi.length === 0 || typeof AudioContext === 'undefined') return;
  audio ??= new AudioContext();
  void audio.resume();
  stopTones();
  const ctx = audio;
  const { notes } = toneSchedule(spec);
  const t0 = ctx.currentTime + 0.05;
  for (const note of notes) {
    const gain = ctx.createGain();
    const points = 64;
    const curve = new Float32Array(points);
    for (let i = 0; i < points; i++) curve[i] = note.level * 2 * toneEnvelope((i / (points - 1)) * note.length, note.length, note.decay);
    gain.gain.setValueCurveAtTime(curve, t0 + note.start, note.length);
    gain.connect(ctx.destination);
    for (const h of toneHarmonics) {
      const osc = ctx.createOscillator();
      const level = ctx.createGain();
      level.gain.value = h.amplitude;
      osc.frequency.value = midiFrequency(note.midi) * h.factor;
      osc.connect(level);
      level.connect(gain);
      osc.start(t0 + note.start);
      osc.stop(t0 + note.start + note.length + 0.05);
      sounding.push(osc);
    }
  }
}

export function TonePlayButton({ spec }: { spec: ToneSpec }) {
  useEffect(() => stopTones, []);
  if (typeof AudioContext === 'undefined') return null;
  return (
    <button type="button" className="btn accent lrn-play" onClick={() => playTones(spec)} aria-label={toneButtonLabel(spec)}>
      <LIconFilled name="play" size={18} />
      {toneButtonLabel(spec)}
    </button>
  );
}

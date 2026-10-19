import { BoardSpec } from '../../lib/learn/media';
import { LearnVerdict } from '../../lib/learn/exercise';
import { LessonModel } from '../../lib/learn/lessonModel';

const files = 'abcdefgh';
const symbols: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const germanNames: Record<string, string> = { k: 'König', q: 'Dame', r: 'Turm', b: 'Läufer', n: 'Springer', p: 'Bauer' };

/** The pieces of a FEN's first field by square name, like { e1: 'K', e8: 'k' }. */
export function placementOf(fen: string): Record<string, string> {
  const result: Record<string, string> = {};
  const rows = (fen.split(' ')[0] ?? '').split('/');
  rows.forEach((row, index) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) file += Number(ch);
      else {
        if (file < 8 && index < 8) result[`${files[file]}${8 - index}`] = ch;
        file += 1;
      }
    }
  });
  return result;
}

/** "Weiß" or "Schwarz" for the side to move in a FEN. */
export const sideToMoveOf = (fen: string): string | null => {
  const side = fen.split(' ')[1];
  return side === 'w' ? 'Weiß' : side === 'b' ? 'Schwarz' : null;
};

const pieceName = (piece: string) => `${piece === piece.toUpperCase() ? 'weißer' : 'schwarzer'} ${germanNames[piece.toLowerCase()] ?? 'Stein'}`;

/** A chess board with the pieces of a position. With `onTap` its squares can be tapped (to find a move); without it it only shows the position, with the squares in `spec.marked` ringed. */
export function ChessBoard({ spec, from = null, to = null, correctMoves = [], verdict = null, onTap }: {
  spec: BoardSpec; from?: string | null; to?: string | null; correctMoves?: string[]; verdict?: LearnVerdict | null; onTap?: (square: string) => void;
}) {
  const pieces = placementOf(spec.fen);
  const rows = [0, 1, 2, 3, 4, 5, 6, 7];
  const name = (row: number, column: number) => {
    const rank = spec.flipped ? row + 1 : 8 - row;
    const file = spec.flipped ? 7 - column : column;
    return `${files[file]}${rank}`;
  };
  const tint = (square: string): string => {
    if (verdict && (square === from || square === to)) return verdict === 'right' ? 'right' : 'wrong';
    if (verdict === 'wrong' && correctMoves.some((m) => m.startsWith(square) || m.slice(2).startsWith(square))) return 'answer';
    if (square === from || square === to) return 'picked';
    return '';
  };
  return (
    <div className="ln-board" role="group" aria-label="Schachbrett">
      {rows.map((row) => rows.map((column) => {
        const square = name(row, column);
        const piece = pieces[square];
        const dark = (row + column) % 2 === 1;
        const label = piece ? `${square}, ${pieceName(piece)}` : `${square}, leer`;
        const className = `ln-sq ${dark ? 'dark' : 'light'} ${tint(square)}`;
        const content = (
          <>
            {spec.marked.includes(square) && <span className="ln-sq-ring" />}
            {piece && <span className={`ln-piece ${piece === piece.toUpperCase() ? 'white' : 'black'}`}>{symbols[piece.toLowerCase()]}{'︎'}</span>}
            {row === 7 && <span className="ln-sq-file">{square[0]}</span>}
            {column === 0 && <span className="ln-sq-rank">{square[1]}</span>}
          </>
        );
        return onTap ? (
          <button key={square} type="button" className={className} aria-label={label} aria-pressed={square === from} onClick={() => onTap(square)}>{content}</button>
        ) : (
          <div key={square} className={className} role="img" aria-label={label}>{content}</div>
        );
      }))}
    </div>
  );
}

/** The board of a "find the move" exercise: tap the piece, then the square to move it to. */
export function ChessMoveView({ model, spec, correctMoves, revealsSolution }: { model: LessonModel; spec: BoardSpec; correctMoves: string[]; revealsSolution: boolean }) {
  const verdict = model.verdict;
  const side = sideToMoveOf(spec.fen);
  const hint = verdict ? '' : model.moveFrom === null ? 'Tippe auf die Figur, die ziehen soll.' : model.moveTo === null ? 'Tippe auf das Zielfeld.' : 'Klicke auf „Prüfen“, wenn du sicher bist.';
  return (
    <div className="ln-chessmove">
      {side && <span className="muted">{side} ist am Zug</span>}
      <ChessBoard
        spec={spec} from={model.moveFrom} to={model.moveTo} correctMoves={revealsSolution ? correctMoves : []} verdict={verdict}
        onTap={verdict ? undefined : (square) => model.tapSquare(square)}
      />
      <span className="muted" style={{ minHeight: '1.25rem' }}>{hint}</span>
    </div>
  );
}

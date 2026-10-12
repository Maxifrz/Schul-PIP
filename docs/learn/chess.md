# Course: Schach (chess)

Provider: `ChessCourse.provider`. Course id `chess`, subtitle "Vom ersten Zug bis zum Matt", symbol `crown.fill`, color 0xD17A9E.
Code: `Lernwerk/Services/Learn/Chess/`. Tests: `LernwerkTests/ChessRulesTests.swift`, `LernwerkTests/ChessCourseTests.swift`.

## Scope and level

A complete beginner course: no prior knowledge, from the names of the squares to mate in one and the first tactical
motifs. It ends where opening principles and endgame technique would begin; those are out of scope. All student text is
German ("du"), no emojis. Moves use coordinate notation ("e2e4", "e7e8q") as input; solutions are shown in German
standard algebraic notation (K, D, T, L, S, no letter for pawns, x, +, #, O-O, O-O-O).

## Architecture

Part 1, a Foundation-only rules engine: `ChessTypes` (squares, pieces), `ChessPosition` (FEN with all six fields, board,
make move, check, mate, stalemate, insufficient material, fifty-move counter, validation of authored positions),
`ChessMoveGeneration` (legal moves, castling through-check rules, en passant incl. the pinned-rank case, four
promotions), `ChessNotation` (German SAN with disambiguation, forgiving parser), `ChessSearch` (negamax with alpha-beta
plus a capture-exchange helper `ChessExchange`), `ChessAnalysis` (pins, skewers, forks, hanging pieces, discovered
targets).

Part 2, the course: positions are authored as FENs in `ChessSamples`; the accepted moves are never authored. A
`ChessGoal` (all moves of a piece, mate in one, escape from check, best capture by exchange, best move by search at
depth 3) is evaluated by the engine when a lesson is built (`ChessGoals`, cached per position). The course therefore
cannot teach a wrong answer. Randomness comes only from `LearnRandom(seed:)`; the same seed gives the same lesson.

## Units

1. Das Brett: files (Linien), ranks (Reihen), square names, light and dark squares (a1 is dark), diagonals. Items: name a marked square, colour of a square.
2. Die Figuren und ihre Züge: König, Dame, Turm, Läufer, Springer; move a piece to a target (all legal moves accepted), count reachable squares, start squares.
3. Der Bauer: single and double step, diagonal capture, blocked pawns, en passant, Bauernumwandlung.
4. Schach und Matt: is the king in check, how to get out (capture, interpose, move), mate in one, Matt vs. Patt, Remis.
5. Sonderzüge: Rochade (both sides), when it is forbidden (moved pieces, pieces between, king in or through check), en passant and promotion in detail.
6. Werte und Tausch: Bauer 1, Springer 3, Läufer 3, Turm 5, Dame 9; which capture wins most, whether a trade is good (decided by the exchange helper).
7. Matt in einem Zug: Grundreihenmatt, Erstickungsmatt, Schäfermatt, Leitermatt, Dame-und-König patterns; accepted = every legal move that mates.
8. Taktik-Grundlagen: Gabel, Fesselung, Spieß, Abzugsangriff, hängende Figur; accepted = moves proven best by the search.

Each unit has three lessons, a practice round, a checkpoint and a chest. About 237 authored positions; over 60 distinct
boards appear across seeds 1 to 20 (asserted in a test).

## Verification

- Perft from the start position (20, 400, 8902, 197281), Kiwipete (48, 2039, 97862), position 3 (14, 191, 2812, 43238),
  position 4 (6, 264, 9467, plus the colour-mirrored version), position 5 (44, 1486, 62379) and position 6.
- An independent brute-force legal move generator and mate scanner in the tests (naive make-and-test-check); every
  move exercise's accepted set is checked for legality, and mate-in-one sets are compared with the brute-force scan.
- Every authored FEN parses, round-trips, passes `validationProblems()` (kings present, side not to move not in check,
  castling rights consistent with the pieces) and has the same move count as the brute-force generator.
- `CourseAudit.problems` is empty for seeds 1...20; node sizes, mixed exercise kinds, determinism per seed, lesson build time.

## Sources

Research was done from knowledge of these sources; I could not open them from this environment, so the matching of
details is from memory and marked below.

- FIDE Laws of Chess (2023), Articles 2 to 5 (board, moves of the pieces, castling, en passant, promotion, check, mate, stalemate): https://handbook.fide.com/chapter/E012023 . Used for the special-move rules.
- Chessprogramming wiki, Perft Results: https://www.chessprogramming.org/Perft_Results . Used for the test positions and counts given in the task.
- Standard piece values 1/3/3/5/9: common convention in beginner teaching (for example the German Schachbund youth materials and Lichess learn pages). Convention, not a law.
- Topic order follows the usual school and club beginner curriculum (board, pieces, pawn, check and mate, special moves, values, mate patterns, tactics).

## Design decisions and known limits

- Under-promotion answers are accepted only together with queen promotion of the same squares, because the app sends four characters for a plain tap.
- "Best move" goals use a depth-3 material search; positions were chosen so the best move is clear. Positions with a mate or deeper idea beyond material are not used in unit 8.
- Draws by repetition are not modelled (no history in a FEN). Insufficient material covers K vs K, K+minor vs K and same-coloured bishops.
- Not verified against the web in this run: exact wording of the FIDE Laws, and the exact syllabus of any named federation.

## What a teacher should double-check

- The tips of unit 3 and 5 (en passant, castling conditions) against the school's chess book.
- The German terms: Grundreihenmatt, Erstickungsmatt, Schäfermatt, Leitermatt, Spieß, Abzugsangriff, Bauernumwandlung.
- Whether the course's Patt/Remis wording matches the regional curriculum.
- Piece values (Läufer and Springer both 3) as a rule of thumb.

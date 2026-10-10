import SwiftUI

/// A chess board with the pieces of a position. With `onTap` its squares can be tapped (to find a move); without it
/// it only shows the position, with the squares in `spec.marked` ringed.
struct ChessBoardView: View {
    let spec: BoardSpec
    var from: String? = nil
    var to: String? = nil
    /// The right moves ("e2e4"), shown on the board once the answer is wrong.
    var correctMoves: [String] = []
    var verdict: LearnVerdict? = nil
    var onTap: ((String) -> Void)? = nil

    private var placement: BoardPlacement { BoardPlacement(fen: spec.fen) }

    var body: some View {
        let board = placement
        return VStack(spacing: 0) {
            ForEach(0..<8, id: \.self) { row in
                HStack(spacing: 0) {
                    ForEach(0..<8, id: \.self) { column in
                        square(row: row, column: column, board: board)
                    }
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .frame(maxWidth: 440)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Schachbrett")
    }

    // The square at a place of the screen, with White at the bottom unless the board is flipped.
    private func name(row: Int, column: Int) -> String {
        let rank = spec.flipped ? row + 1 : 8 - row
        let file = spec.flipped ? 7 - column : column
        return BoardPlacement.name(file: file, rank: rank)
    }

    private func isDark(row: Int, column: Int) -> Bool {
        (row + column) % 2 == 1
    }

    private func highlight(of square: String) -> Color? {
        if let verdict, square == from || square == to {
            return LearnTone.color(verdict).opacity(0.55)
        }
        if verdict == .wrong, correctMoves.contains(where: { $0.hasPrefix(square) || $0.dropFirst(2).hasPrefix(square) }) {
            return LearnTone.right.opacity(0.45)
        }
        if square == from || square == to {
            return Quill.warn.opacity(0.6)
        }
        return nil
    }

    private func square(row: Int, column: Int, board: BoardPlacement) -> some View {
        let square = name(row: row, column: column)
        let piece = board.piece(on: square)
        let base = isDark(row: row, column: column) ? Quill.accent.opacity(0.55) : Quill.surface2
        return GeometryReader { geometry in
            let size = geometry.size.width
            ZStack {
                base
                if let tint = highlight(of: square) { tint }
                if spec.marked.contains(square) {
                    Circle()
                        .strokeBorder(Quill.warn, lineWidth: max(2, size * 0.09))
                        .padding(size * 0.1)
                }
                if let piece {
                    ChessPieceGlyph(piece: piece, size: size)
                }
                coordinateLabels(row: row, column: column, size: size)
            }
            .frame(width: size, height: size)
            .contentShape(Rectangle())
            .onTapGesture { onTap?(square) }
        }
        .aspectRatio(1, contentMode: .fit)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(piece.map { "\(square), \(BoardPlacement.germanName(of: $0))" } ?? "\(square), leer")
        .accessibilityAddTraits(onTap != nil ? .isButton : [])
        .accessibilityAddTraits(square == from ? .isSelected : [])
    }

    @ViewBuilder
    private func coordinateLabels(row: Int, column: Int, size: CGFloat) -> some View {
        let square = name(row: row, column: column)
        ZStack {
            if row == 7 {
                Text(String(square.first ?? " "))
                    .font(.mono(max(8, size * 0.2), .medium))
                    .foregroundStyle(Quill.ink.opacity(0.55))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(2)
            }
            if column == 0 {
                Text(String(square.last ?? " "))
                    .font(.mono(max(8, size * 0.2), .medium))
                    .foregroundStyle(Quill.ink.opacity(0.55))
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(2)
            }
        }
    }
}

/// One piece as a filled symbol: white pieces light with a dark edge, black pieces dark.
struct ChessPieceGlyph: View {
    let piece: Character
    let size: CGFloat

    private var symbol: String {
        let symbols: [Character: String] = ["k": "♚", "q": "♛", "r": "♜", "b": "♝", "n": "♞", "p": "♟"]
        // The text variant selector keeps the pawn from turning into an emoji.
        return (symbols[Character(piece.lowercased())] ?? "?") + "\u{FE0E}"
    }

    var body: some View {
        let isWhite = piece.isUppercase
        return Text(symbol)
            .font(.system(size: size * 0.8))
            .foregroundStyle(isWhite ? Quill.paper : Quill.paperInk)
            .shadow(color: isWhite ? Quill.paperInk : Quill.paper.opacity(0.0), radius: 0, x: 1, y: 0)
            .shadow(color: isWhite ? Quill.paperInk : Quill.paper.opacity(0.0), radius: 0, x: -1, y: 0)
            .shadow(color: isWhite ? Quill.paperInk : Quill.paper.opacity(0.0), radius: 0, x: 0, y: 1)
            .shadow(color: isWhite ? Quill.paperInk : Quill.paper.opacity(0.0), radius: 0, x: 0, y: -1)
            .minimumScaleFactor(0.5)
            .accessibilityHidden(true)
    }
}

/// The board of a "find the move" exercise: tap the piece, then the square to move it to.
struct ChessMoveView: View {
    let spec: BoardSpec
    let from: String?
    let to: String?
    let correctMoves: [String]
    let verdict: LearnVerdict?
    let onTap: (String) -> Void

    private var hint: String {
        if verdict != nil { return "" }
        if from == nil { return "Tippe auf die Figur, die ziehen soll." }
        if to == nil { return "Tippe auf das Zielfeld." }
        return "Tippe auf „Prüfen“, wenn du sicher bist."
    }

    var body: some View {
        VStack(spacing: 12) {
            if let side = BoardPlacement.sideToMove(fen: spec.fen) {
                Text("\(side) ist am Zug")
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.muted)
            }
            ChessBoardView(
                spec: spec, from: from, to: to, correctMoves: correctMoves, verdict: verdict,
                onTap: verdict == nil ? onTap : nil
            )
            Text(hint)
                .font(.work(14))
                .foregroundStyle(Quill.muted)
                .frame(minHeight: 18)
        }
        .frame(maxWidth: .infinity)
    }
}

#Preview("Brett") {
    ChessMoveView(
        spec: BoardSpec(fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 1", marked: ["f7"]),
        from: "f3", to: nil, correctMoves: ["f3f7"], verdict: nil, onTap: { _ in }
    )
    .padding()
    .background(Quill.bg)
}

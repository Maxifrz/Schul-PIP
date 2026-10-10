import SwiftUI

/// Notes on a staff, drawn with the app's ink color so it fits light and dark mode. Where things go comes from
/// `StaffDrawingRules`; this only paints it. The clefs and the short rests are outlines from `MusicGlyph`.
struct StaffView: View {
    let spec: StaffSpec

    /// The largest distance between two staff lines in points; narrower screens shrink the staff to fit.
    static let maxSpace: CGFloat = 12

    private var description: String {
        let clef: String
        switch spec.clef {
        case .treble: clef = "Violinschlüssel"
        case .bass: clef = "Bassschlüssel"
        case .alto: clef = "Altschlüssel"
        }
        let count = spec.notes.count
        return "Notenzeile im \(clef) mit \(count) \(count == 1 ? "Note" : "Noten")"
    }

    var body: some View {
        Canvas { context, size in
            StaffPainter(spec: spec, size: size).paint(into: context)
        }
        .frame(height: StaffView.maxSpace * 13)
        .frame(maxWidth: 520)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(description)
    }
}

private struct StaffPainter {
    let spec: StaffSpec
    let size: CGSize

    private var ink: Color { Quill.ink }

    private func glyph(for clef: Clef) -> MusicGlyph {
        switch clef {
        case .treble: return .gClef
        case .bass: return .fClef
        case .alto: return .cClef
        }
    }

    private var slotCount: Int {
        spec.chord ? 1 : spec.notes.count
    }

    /// The distance between two staff lines: as large as fits.
    private var space: CGFloat {
        let signs = CGFloat(min(7, abs(spec.keySignature)))
        let time: CGFloat = spec.time == nil ? 0 : 2.4
        let leading = 0.6 + glyph(for: spec.clef).width + signs + time + 1.2
        let needed = leading + CGFloat(max(1, slotCount)) * 3.4 + 1
        return min(StaffView.maxSpace, size.width / needed)
    }

    private var bottomLine: CGFloat { size.height / 2 + 2 * space }

    private func y(_ step: Int) -> CGFloat {
        bottomLine - CGFloat(step) * space / 2
    }

    func paint(into context: GraphicsContext) {
        let s = space
        for line in 0..<5 {
            var path = Path()
            path.move(to: CGPoint(x: 0, y: y(line * 2)))
            path.addLine(to: CGPoint(x: size.width, y: y(line * 2)))
            context.stroke(path, with: .color(ink), lineWidth: max(1, s * 0.09))
        }
        var barline = Path()
        barline.move(to: CGPoint(x: size.width - 1, y: y(0)))
        barline.addLine(to: CGPoint(x: size.width - 1, y: y(8)))
        context.stroke(barline, with: .color(ink), lineWidth: max(1.5, s * 0.16))

        var x = 0.6 * s
        let clef = glyph(for: spec.clef)
        context.fill(clef.path(origin: CGPoint(x: x, y: bottomLine), space: s), with: .color(ink))
        x += clef.width * s

        for sign in StaffDrawingRules.keySignature(spec.keySignature, clef: spec.clef) {
            drawAccidental(sign.sharp ? .sharp : .flat, x: x + s * 0.4, step: sign.step, space: s, in: context)
            x += s
        }
        if let time = spec.time {
            drawTime(time, x: x + s * 0.8, space: s, in: context)
            x += 2.4 * s
        }
        x += 1.2 * s

        let slots = max(1, slotCount)
        let slotWidth = min(6 * s, max(3.4 * s, (size.width - x - s) / CGFloat(slots)))
        for slot in 0..<slotCount {
            let notes = spec.chord ? spec.notes : [spec.notes[slot]]
            drawSlot(notes, x: x + slotWidth * (CGFloat(slot) + 0.5), space: s, in: context)
        }
    }

    // MARK: Notes

    private func drawSlot(_ notes: [StaffNote], x: CGFloat, space s: CGFloat, in context: GraphicsContext) {
        guard let first = notes.first else { return }
        if first.isRest {
            drawRest(first.value, x: x, space: s, in: context)
            return
        }
        let steps = notes.map { StaffDrawingRules.step(of: $0.pitch, clef: spec.clef) }
        let up = StaffDrawingRules.stemUp(steps: steps)
        let moved = StaffDrawingRules.shifted(steps: steps)
        let value = first.value

        for (index, note) in notes.enumerated() {
            let step = steps[index]
            let headX = x + (moved[index] ? (up ? 1.15 * s : -1.15 * s) : 0)
            for ledger in StaffDrawingRules.ledgerSteps(for: step) {
                var line = Path()
                line.move(to: CGPoint(x: headX - 1.0 * s, y: y(ledger)))
                line.addLine(to: CGPoint(x: headX + 1.0 * s, y: y(ledger)))
                context.stroke(line, with: .color(ink), lineWidth: max(1, s * 0.12))
            }
            if let accidental = StaffDrawingRules.accidental(for: note.pitch, key: spec.keySignature) {
                drawAccidental(accidental, x: x - 1.5 * s - CGFloat(index % 2) * 0.0, step: step, space: s, in: context)
            }
            drawHead(value, x: headX, y: y(step), space: s, in: context)
        }

        guard value != .whole else { return }
        let ys = steps.map { y($0) }
        let low = ys.max() ?? 0
        let high = ys.min() ?? 0
        let stemX = x + (up ? 0.6 * s : -0.6 * s)
        var stem = Path()
        let tip: CGFloat
        if up {
            tip = high - 3.3 * s
            stem.move(to: CGPoint(x: stemX, y: low))
            stem.addLine(to: CGPoint(x: stemX, y: tip))
        } else {
            tip = low + 3.3 * s
            stem.move(to: CGPoint(x: stemX, y: high))
            stem.addLine(to: CGPoint(x: stemX, y: tip))
        }
        context.stroke(stem, with: .color(ink), lineWidth: max(1, s * 0.13))

        for flag in 0..<StaffDrawingRules.flags(value) {
            let offset = CGFloat(flag) * 0.9 * s
            let start = CGPoint(x: stemX, y: up ? tip + offset : tip - offset)
            let direction: CGFloat = up ? 1 : -1
            var path = Path()
            path.move(to: start)
            path.addCurve(
                to: CGPoint(x: start.x + 0.95 * s, y: start.y + direction * 2.0 * s),
                control1: CGPoint(x: start.x + 0.1 * s, y: start.y + direction * 0.9 * s),
                control2: CGPoint(x: start.x + 1.2 * s, y: start.y + direction * 0.9 * s)
            )
            context.stroke(path, with: .color(ink), style: StrokeStyle(lineWidth: max(1.2, s * 0.3), lineCap: .round))
        }
    }

    private func drawHead(_ value: NoteValue, x: CGFloat, y: CGFloat, space s: CGFloat, in context: GraphicsContext) {
        var layer = context
        layer.translateBy(x: x, y: y)
        layer.rotate(by: .degrees(-18))
        let wide: CGFloat = value == .whole ? 1.0 : 0.66
        let rect = CGRect(x: -wide * s, y: -0.5 * s, width: 2 * wide * s, height: s)
        let head = Path(ellipseIn: rect)
        switch value {
        case .whole:
            layer.stroke(head, with: .color(ink), lineWidth: max(1.5, s * 0.26))
        case .half:
            layer.stroke(head, with: .color(ink), lineWidth: max(1.5, s * 0.2))
        default:
            layer.fill(head, with: .color(ink))
        }
    }

    private func drawRest(_ value: NoteValue, x: CGFloat, space s: CGFloat, in context: GraphicsContext) {
        switch value {
        case .whole:
            context.fill(Path(CGRect(x: x - 0.65 * s, y: y(6), width: 1.3 * s, height: 0.5 * s)), with: .color(ink))
        case .half:
            context.fill(Path(CGRect(x: x - 0.65 * s, y: y(4) - 0.5 * s, width: 1.3 * s, height: 0.5 * s)), with: .color(ink))
        case .quarter:
            context.fill(MusicGlyph.quarterRest.path(origin: CGPoint(x: x - 0.45 * s, y: bottomLine), space: s), with: .color(ink))
        case .eighth:
            context.fill(MusicGlyph.eighthRest.path(origin: CGPoint(x: x - 0.45 * s, y: bottomLine), space: s), with: .color(ink))
        case .sixteenth:
            context.fill(MusicGlyph.sixteenthRest.path(origin: CGPoint(x: x - 0.6 * s, y: bottomLine), space: s), with: .color(ink))
        }
    }

    // MARK: Signs

    private func drawAccidental(_ accidental: StaffDrawingRules.Accidental, x: CGFloat, step: Int, space s: CGFloat, in context: GraphicsContext) {
        let symbol: String
        var lift: CGFloat = 0
        switch accidental {
        case .sharp: symbol = "♯"
        case .flat:
            symbol = "♭"
            lift = 0.4 * s
        case .natural: symbol = "♮"
        case .doubleSharp: symbol = "♯♯"
        case .doubleFlat:
            symbol = "♭♭"
            lift = 0.4 * s
        }
        let text = Text(symbol).font(.system(size: s * 2.7, weight: .regular)).foregroundStyle(ink)
        context.draw(text, at: CGPoint(x: x, y: y(step) - lift), anchor: .center)
    }

    private func drawTime(_ time: String, x: CGFloat, space s: CGFloat, in context: GraphicsContext) {
        let parts = time.split(separator: "/").map(String.init)
        guard parts.count == 2 else { return }
        for (index, part) in parts.enumerated() {
            let text = Text(part).font(.system(size: s * 2.5, weight: .bold)).foregroundStyle(ink)
            context.draw(text, at: CGPoint(x: x, y: y(index == 0 ? 6 : 2)), anchor: .center)
        }
    }
}

#Preview("Notenzeile") {
    VStack(spacing: 24) {
        StaffView(spec: StaffSpec(
            clef: .treble, keySignature: 2, time: "4/4",
            notes: [
                StaffNote(pitch: Pitch(letter: 0, octave: 4), value: .quarter),
                StaffNote(pitch: Pitch(letter: 2, octave: 4), value: .half),
                StaffNote(pitch: Pitch(letter: 5, octave: 5, alteration: 1), value: .eighth),
                StaffNote(pitch: Pitch(letter: 1, octave: 4), value: .quarter, isRest: true),
            ]
        ))
        StaffView(spec: StaffSpec(
            clef: .bass,
            notes: [
                StaffNote(pitch: Pitch(letter: 0, octave: 3)),
                StaffNote(pitch: Pitch(letter: 2, octave: 3)),
                StaffNote(pitch: Pitch(letter: 4, octave: 3)),
            ],
            chord: true
        ))
    }
    .padding()
    .background(Quill.bg)
}

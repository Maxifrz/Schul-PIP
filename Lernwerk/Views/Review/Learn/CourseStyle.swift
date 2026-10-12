import SwiftData
import SwiftUI

extension Course {
    /// The course's color, from its 0xRRGGBB.
    var tint: Color { Color(QuillUIColor.hex(color)) }

    /// Text and symbols on `tint`.
    var onTint: Color { prefersDarkText ? Quill.paperInk : Quill.paper }
}

extension ReviewCard {
    /// The card as plain values for the Lernpfad.
    var snapshot: CardSnapshot {
        CardSnapshot(front: front, back: back, materialID: materialID, createdAt: createdAt, dueDate: dueDate)
    }
}

/// A button that sinks into its own edge when pressed, like a key.
struct NodeButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .offset(y: configuration.isPressed ? 5 : 0)
            .animation(.easeOut(duration: 0.08), value: configuration.isPressed)
    }
}

/// A node of the path: a coin with an edge below it, in the course's color when it can be played and gray when it
/// is locked.
struct PathNodeView: View {
    let step: PathStep
    let course: Course
    let isCurrent: Bool
    let action: () -> Void

    @State private var bounce = false

    private var symbol: String {
        switch step.node.kind {
        case .lesson: return step.state == .done ? "checkmark" : "star.fill"
        case .practice: return "dumbbell.fill"
        case .checkpoint: return step.state == .done ? "checkmark.seal.fill" : course.symbol
        case .chest: return step.state == .done ? "shippingbox" : "shippingbox.fill"
        }
    }

    private var label: String {
        switch step.node.kind {
        case .lesson: return "Lektion \(step.node.index)"
        case .practice: return "Übungsrunde"
        case .checkpoint: return "Einheitentest"
        case .chest: return "Truhe"
        }
    }

    private var stateText: String {
        switch step.state {
        case .done: return step.node.kind == .chest ? "geöffnet" : "geschafft"
        case .open: return step.node.kind == .chest ? "bereit zum Öffnen" : "offen"
        case .locked: return "gesperrt"
        }
    }

    private var face: Color {
        step.state == .locked ? Quill.surface2 : course.tint
    }

    private var iconColor: Color {
        step.state == .locked ? Quill.faint : course.onTint
    }

    var body: some View {
        Button(action: action) {
            ZStack {
                if isCurrent {
                    Ellipse()
                        .stroke(course.tint.opacity(0.55), lineWidth: 4)
                        .frame(width: 108, height: 90)
                }
                Ellipse()
                    .fill(step.state == .locked ? Quill.line2 : course.tint)
                    .overlay(Ellipse().fill(Quill.paperInk.opacity(step.state == .locked ? 0 : 0.32)))
                    .frame(width: 88, height: 70)
                    .offset(y: 7)
                Ellipse()
                    .fill(face)
                    .frame(width: 88, height: 70)
                Image(systemName: symbol)
                    .font(.system(size: 28, weight: .bold))
                    .foregroundStyle(iconColor)
                    .opacity(step.node.kind == .chest && step.state == .done ? 0.6 : 1)
            }
            .frame(width: 112, height: 98)
            .overlay(alignment: .top) {
                if isCurrent {
                    Text(step.node.kind == .chest ? "ÖFFNEN" : "START")
                        .font(.mono(11, .semibold))
                        .tracking(1)
                        .foregroundStyle(course.tint)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                        .offset(y: bounce ? -26 : -22)
                        .allowsHitTesting(false)
                }
            }
        }
        .buttonStyle(NodeButtonStyle())
        .disabled(step.state == .locked)
        .onAppear {
            guard isCurrent else { return }
            withAnimation(.easeInOut(duration: 0.7).repeatForever(autoreverses: true)) { bounce = true }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label), \(stateText)")
        .accessibilityHint(step.state == .locked ? "Öffnet sich, wenn du die Schritte davor geschafft hast" : "Startet den Schritt")
        .accessibilityAddTraits(step.state == .locked ? [] : .isButton)
    }
}

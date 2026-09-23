import SwiftUI

struct DocumentToolbar: View {
    @Binding var mode: InteractionMode

    var body: some View {
        VStack(spacing: 8) {
            if mode == .mark {
                Text("Zieh einen Rahmen um die Stelle, bei der du Hilfe brauchst.")
                    .font(.work(13))
                    .foregroundStyle(Quill.ink2)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            HStack(spacing: 4) {
                item(.read, label: "Lesen")
                item(.draw(.pen), label: "Stift")
                item(.draw(.highlighter), label: "Marker")
                item(.draw(.eraser), label: "Radierer")
                Rectangle()
                    .fill(Quill.line2)
                    .frame(width: 1, height: 26)
                    .padding(.horizontal, 4)
                helpItem
            }
            .padding(5)
            .background(Quill.surface, in: Capsule())
            .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
            .shadow(color: Color.black.opacity(0.1), radius: 9, y: 6)
        }
        .animation(.easeInOut(duration: 0.2), value: mode)
    }

    private func item(_ target: InteractionMode, label: String) -> some View {
        let isSelected = mode == target
        return Button {
            mode = target
        } label: {
            Text(label)
                .font(.work(14, .medium))
                .tracking(-0.14)
                .foregroundStyle(isSelected ? Quill.bg : Quill.ink)
                .padding(.horizontal, 17)
                .frame(height: 44)
                .background(isSelected ? Quill.ink : Color.clear, in: Capsule())
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    private var helpItem: some View {
        let isSelected = mode == .mark
        return Button {
            mode = .mark
        } label: {
            HStack(spacing: 8) {
                StatusDot()
                Text("Hilfe")
                    .font(.work(14, .medium))
                    .tracking(-0.14)
            }
            .foregroundStyle(isSelected ? Quill.bg : Quill.ink)
            .padding(.horizontal, 18)
            .frame(height: 44)
            .background(isSelected ? Quill.ink : Color.clear, in: Capsule())
            .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Lernhilfe: Bereich markieren")
    }
}

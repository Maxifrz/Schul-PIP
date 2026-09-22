import SwiftUI

struct DocumentToolbar: View {
    @Binding var mode: InteractionMode

    var body: some View {
        VStack(spacing: 8) {
            if mode == .mark {
                Text("Zieh einen Rahmen um die Stelle, bei der du Hilfe brauchst.")
                    .font(.footnote)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(.regularMaterial, in: Capsule())
            }
            HStack(spacing: 4) {
                item(.read, icon: "hand.point.up.left", label: "Lesen")
                item(.draw(.pen), icon: "pencil.tip", label: "Stift")
                item(.draw(.highlighter), icon: "highlighter", label: "Marker")
                item(.draw(.eraser), icon: "eraser", label: "Radierer")
                Divider()
                    .frame(height: 28)
                    .padding(.horizontal, 4)
                item(.mark, icon: "wand.and.stars", label: "Hilfe")
            }
            .padding(6)
            .background(.regularMaterial, in: Capsule())
            .shadow(color: .black.opacity(0.15), radius: 6, y: 2)
        }
        .padding(.bottom, 8)
    }

    private func item(_ target: InteractionMode, icon: String, label: String) -> some View {
        let isSelected = mode == target
        return Button {
            mode = target
        } label: {
            Image(systemName: icon)
                .font(.title3)
                .frame(width: 44, height: 44)
                .foregroundStyle(isSelected ? Color.white : Color.primary)
                .background(isSelected ? Color.accentColor : Color.clear, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

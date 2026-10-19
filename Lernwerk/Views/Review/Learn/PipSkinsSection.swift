import SwiftUI

/// Pip's skins: look at them, buy one with gems, put one on.
struct PipSkinsSection: View {
    @EnvironmentObject private var progress: LearnProgressStore

    var body: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10, alignment: .top)], spacing: 10) {
            ForEach(PipSkin.all) { skin in
                PipSkinRow(
                    skin: skin,
                    owned: progress.progress.owns(skin: skin.id),
                    selected: progress.progress.selectedSkin == skin.id,
                    canAfford: progress.progress.gems >= skin.price,
                    onBuy: { progress.buySkin(skin.id) },
                    onSelect: { progress.selectSkin(skin.id) }
                )
            }
        }
    }
}

private struct PipSkinRow: View {
    let skin: PipSkin
    let owned: Bool
    let selected: Bool
    let canAfford: Bool
    let onBuy: () -> Void
    let onSelect: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            PipLogo(pixel: 5)
                .environment(\.pipSkin, skin)
                .frame(maxWidth: .infinity)
                .padding(.top, 20)
                .frame(height: 96)
                .background(Quill.accentSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(spacing: 2) {
                Text(skin.name)
                    .font(.work(16, .semibold))
                    .foregroundStyle(Quill.ink)
                Text(selected ? "Pip trägt das gerade" : skin.note)
                    .font(.work(12.5))
                    .foregroundStyle(Quill.muted)
                    .multilineTextAlignment(.center)
                    .lineLimit(3, reservesSpace: true)
            }
            action
        }
        .padding(12)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(selected ? Quill.accent : Quill.line, lineWidth: selected ? 2 : 1)
        )
        .accessibilityElement(children: .contain)
    }

    @ViewBuilder private var action: some View {
        if selected {
            Image(systemName: "checkmark")
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(Quill.accent)
                .frame(height: 44)
                .accessibilityLabel("Ausgewählt")
        } else if owned {
            Button(action: onSelect) {
                Text("Auswählen")
                    .font(.work(14, .bold))
                    .foregroundStyle(Quill.accent)
                    .frame(maxWidth: .infinity)
                    .frame(height: 44)
                    .overlay(Capsule().stroke(Quill.accent, lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(skin.name) auswählen")
        } else {
            Button(action: onBuy) {
                VStack(spacing: 1) {
                    Text("Kaufen")
                        .font(.work(14, .bold))
                    HStack(spacing: 3) {
                        Image(systemName: "diamond.fill")
                            .font(.system(size: 11, weight: .semibold))
                        Text("\(skin.price)")
                            .font(.work(12, .semibold))
                    }
                }
                .foregroundStyle(Quill.onAccent)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .background(Quill.accent, in: Capsule())
                .opacity(canAfford ? 1 : 0.4)
            }
            .buttonStyle(.plain)
            .disabled(!canAfford)
            .accessibilityLabel("\(skin.name) kaufen für \(skin.price) Gems")
        }
    }
}

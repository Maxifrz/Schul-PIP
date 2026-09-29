import SwiftUI

/// The design sheet: every design as a preview of the deck's own title slide, and the AI's suggestions with a reason
/// each. Tapping a design restyles the whole deck; a suggestion can bring its motion style along.
struct DesignSheet: View {
    @ObservedObject var model: PresentationEditorModel
    let images: [String: UIImage]
    let client: any LLMClient
    @State private var suggestions: [DesignSuggestion] = []
    @State private var isLoading = true

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PixelCaption(text: "Design")
                ThemePicker(
                    selection: Binding(get: { model.presentation.themeId }, set: { model.setTheme($0) }),
                    slide: model.presentation.slides.first,
                    images: images
                )
                Text("Schriften und Verzierungen gehören zum Design; deine Inhalte bleiben, wie sie sind.")
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
                PixelCaption(text: "Vorschläge der KI")
                if isLoading {
                    HStack(spacing: 8) {
                        PulsingDots()
                        Text("Die KI sucht passende Designs …")
                            .font(.work(13))
                            .foregroundStyle(Quill.faint)
                    }
                }
                ForEach(suggestions, id: \.themeID) { suggestion in
                    row(suggestion)
                }
            }
            .padding(24)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
        .task {
            let result = await DesignAdvisor.suggestions(for: model.presentation, client: client)
            suggestions = result
            isLoading = false
        }
    }

    private func row(_ suggestion: DesignSuggestion) -> some View {
        let theme = SlideTheme.byID(suggestion.themeID)
        return HStack(alignment: .top, spacing: 14) {
            SlideCanvas(slide: model.presentation.slides.first ?? Slide(), theme: theme, images: images, index: 0)
                .frame(width: 168, height: 94.5)
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            VStack(alignment: .leading, spacing: 6) {
                Text(theme.name)
                    .font(.work(15, .medium))
                    .foregroundStyle(Quill.ink)
                Text(suggestion.reason)
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
                HStack(spacing: 8) {
                    Button("Design übernehmen") { model.applyDesign(suggestion, withMotion: false) }
                        .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                    Button("Mit Bewegung: \(suggestion.motion.label)") { model.applyDesign(suggestion, withMotion: true) }
                        .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                }
            }
        }
    }
}

/// "Folie neu gestalten": the same content in a few other looks, each as a preview.
struct VariantSheet: View {
    let slide: Slide
    let theme: SlideTheme
    let images: [String: UIImage]
    let index: Int
    let onPick: (SlideVariant) -> Void

    var body: some View {
        let variants = SlideVariants.variants(for: slide, theme: theme)
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                PixelCaption(text: "Folie neu gestalten")
                if slide.origin == nil {
                    Text("Diese Folie wurde von Hand verändert oder nicht aus der Bibliothek gebaut. Nur Folien im ursprünglichen Layout lassen sich neu gestalten.")
                        .font(.work(14))
                        .foregroundStyle(Quill.muted)
                } else if variants.isEmpty {
                    Text("Für diesen Inhalt gibt es keine weiteren Varianten.")
                        .font(.work(14))
                        .foregroundStyle(Quill.muted)
                } else {
                    Text("Derselbe Inhalt, anders angeordnet. Deine Texte bleiben; Animationen der Elemente werden zurückgesetzt.")
                        .font(.work(13))
                        .foregroundStyle(Quill.muted)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 220), spacing: 16)], alignment: .leading, spacing: 16) {
                        ForEach(variants) { variant in
                            Button {
                                onPick(variant)
                            } label: {
                                VStack(alignment: .leading, spacing: 6) {
                                    SlideCanvas(slide: variant.slide, theme: theme, images: images, index: index)
                                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                                        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                                    Text(variant.label)
                                        .font(.work(12.5, .medium))
                                        .foregroundStyle(Quill.ink)
                                }
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            .padding(24)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
    }
}

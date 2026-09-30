import SwiftUI

/// The module library beside the slide: building blocks for showing data and connections (timelines, comparisons,
/// number rows, matrices, charts …) with a live preview each. Drag one onto the slide, or tap it to put it in the
/// middle. Dropped modules are ordinary shapes and texts tied into a group: they move together and can be edited.
struct ModulePanel: View {
    @ObservedObject var model: PresentationEditorModel
    let onClose: () -> Void

    @State private var query = ""
    @State private var category: ComponentCategory?

    private var modules: [SlideComponent] {
        let source = category.map { SlideModules.modules(in: $0) } ?? SlideModules.all
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return source }
        return source.filter { $0.label.localizedCaseInsensitiveContains(text) || $0.summary.localizedCaseInsensitiveContains(text) }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Module")
                    .font(.work(16, .medium))
                    .foregroundStyle(Quill.ink)
                Spacer()
                Button(action: onClose) {
                    Image(systemName: "xmark")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Quill.muted)
                        .frame(width: 32, height: 32)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Module schließen")
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
            TextField("Modul suchen", text: $query)
                .font(.work(14))
                .padding(.horizontal, 12)
                .frame(height: 34)
                .background(Capsule().fill(Quill.hover))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
            ScrollView(.horizontal) {
                HStack(spacing: 6) {
                    chip("Alle", selected: category == nil) { category = nil }
                    ForEach(SlideModules.categories, id: \.self) { item in
                        chip(item.label, selected: category == item) { category = category == item ? nil : item }
                    }
                }
                .padding(.horizontal, 14)
            }
            .scrollIndicators(.hidden)
            .padding(.bottom, 8)
            QuillDivider(color: Quill.lineSoft)
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(modules, id: \.id) { component in
                        ModuleCard(component: component, theme: model.presentation.theme) {
                            model.addModule(component)
                        }
                    }
                    if modules.isEmpty {
                        Text("Kein Modul gefunden.")
                            .font(.work(13.5))
                            .foregroundStyle(Quill.muted)
                            .padding(.top, 20)
                    }
                    Text("Ziehen oder antippen. Im Modul lässt sich jedes Teil einzeln bearbeiten; „Modul größer“ und „Gruppe lösen“ stehen unter der Folie.")
                        .font(.work(12))
                        .foregroundStyle(Quill.faint)
                        .padding(.top, 4)
                }
                .padding(14)
            }
            .scrollIndicators(.hidden)
        }
        .background(Quill.bg)
    }

    private func chip(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.work(12.5, .medium))
                .foregroundStyle(selected ? Quill.bg : Quill.ink)
                .padding(.horizontal, 11)
                .frame(height: 28)
                .background(Capsule().fill(selected ? Quill.ink : Color.clear))
                .overlay(Capsule().stroke(selected ? Color.clear : Quill.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

/// One module with its preview, drawn in the deck's own design.
private struct ModuleCard: View {
    let component: SlideComponent
    let theme: SlideTheme
    let onInsert: () -> Void
    @State private var slide: Slide?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            preview
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            HStack(alignment: .firstTextBaseline) {
                Text(component.label)
                    .font(.work(13.5, .medium))
                    .foregroundStyle(Quill.ink)
                Spacer()
                Text(component.category.label)
                    .font(.work(11.5))
                    .foregroundStyle(Quill.faint)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onInsert)
        .draggable("module:" + component.id) {
            preview.frame(width: 200)
        }
        .task(id: theme.id) {
            slide = SlideModules.preview(of: component, theme: theme)
        }
        .accessibilityLabel("\(component.label), Modul")
        .accessibilityHint("Auf die Folie ziehen oder antippen")
    }

    @ViewBuilder
    private var preview: some View {
        if let slide {
            SlideCanvas(slide: slide, theme: theme, images: [:], index: 1)
        } else {
            Rectangle()
                .fill(Quill.hover)
                .aspectRatio(16 / 9, contentMode: .fit)
        }
    }
}

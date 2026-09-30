import SwiftUI

/// The module library beside the slide: diagrams, arrangements and slide components for showing data and connections,
/// with a live preview each. Drag one onto the slide, or tap it to put it in the middle. Dropped modules are ordinary
/// shapes, texts and diagrams tied into a group: they move together and can be edited; a diagram's data is changed
/// with a tap on the diagram.
struct ModulePanel: View {
    @ObservedObject var model: PresentationEditorModel
    let onClose: () -> Void

    @State private var query = ""
    @State private var group: ModuleGroup?

    private var modules: [SlideModule] {
        let source = group.map { SlideModules.modules(in: $0) } ?? SlideModules.all
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
                    chip("Alle", selected: group == nil) { group = nil }
                    ForEach(SlideModules.groups, id: \.self) { item in
                        chip(item.label, selected: group == item) { group = group == item ? nil : item }
                    }
                }
                .padding(.horizontal, 14)
            }
            .scrollIndicators(.hidden)
            .padding(.bottom, 8)
            QuillDivider(color: Quill.lineSoft)
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(modules) { module in
                        ModuleCard(module: module, theme: model.presentation.theme) {
                            model.addModule(module)
                        }
                    }
                    if modules.isEmpty {
                        Text("Kein Modul gefunden.")
                            .font(.work(13.5))
                            .foregroundStyle(Quill.muted)
                            .padding(.top, 20)
                    }
                    Text("Ziehen oder antippen. Ein Diagramm bekommt seine Zahlen per Tipp auf das Diagramm; in anderen Modulen lässt sich jedes Teil einzeln bearbeiten. „Modul größer“ und „Gruppe lösen“ stehen unter der Folie.")
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

/// One module with its preview, drawn in the deck's own design. The preview is drawn once into a picture, so
/// scrolling the list stays light.
private struct ModuleCard: View {
    let module: SlideModule
    let theme: SlideTheme
    let onInsert: () -> Void
    @State private var image: UIImage?

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            preview
                .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            HStack(alignment: .firstTextBaseline) {
                Text(module.label)
                    .font(.work(13.5, .medium))
                    .foregroundStyle(Quill.ink)
                Spacer()
                Text(module.group.label)
                    .font(.work(11.5))
                    .foregroundStyle(Quill.faint)
                    .lineLimit(1)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: onInsert)
        .draggable("module:" + module.id) {
            preview.frame(width: 200)
        }
        .task(id: theme.id) {
            let slide = SlideModules.preview(of: module, theme: theme)
            let data = SlideDrawing.png(slide, theme: theme, index: 1, images: [:], width: 640)
            image = UIImage(data: data)
        }
        .accessibilityLabel("\(module.label), Modul")
        .accessibilityHint("Auf die Folie ziehen oder antippen")
    }

    @ViewBuilder
    private var preview: some View {
        if let image {
            Image(uiImage: image)
                .resizable()
                .aspectRatio(16 / 9, contentMode: .fit)
        } else {
            Rectangle()
                .fill(Quill.hover)
                .aspectRatio(16 / 9, contentMode: .fit)
        }
    }
}

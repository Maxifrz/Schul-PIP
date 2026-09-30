import SwiftUI

/// Which diagram the editor sheet is open for.
struct ChartEditRequest: Identifiable {
    let id: String
}

/// Changes a diagram's data, type and options, with the diagram drawn again at every keystroke. One undo step for
/// everything done while the sheet is open.
struct ChartEditorSheet: View {
    @ObservedObject var model: PresentationEditorModel
    let elementID: String
    private let aspect: CGFloat
    @Environment(\.dismiss) private var dismiss
    @State private var spec: ChartSpec

    init(model: PresentationEditorModel, element: SlideElement) {
        self.model = model
        elementID = element.id
        aspect = CGFloat(max(element.width, 40) / max(element.height, 40))
        _spec = State(initialValue: element.chart ?? ChartSpec(type: .column))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Diagramm bearbeiten")
                    .font(.work(16, .medium))
                    .foregroundStyle(Quill.ink)
                Spacer()
                Button("Fertig") { dismiss() }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 34, fontSize: 14))
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 14)
            QuillDivider(color: Quill.lineSoft)
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    ChartPreview(spec: spec, theme: model.presentation.theme, aspect: aspect)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                    typeMenu
                    Text(spec.type.hint)
                        .font(.work(13))
                        .foregroundStyle(Quill.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    TextEditor(text: $spec.data)
                        .font(.system(size: 14, design: .monospaced))
                        .scrollContentBackground(.hidden)
                        .padding(8)
                        .frame(minHeight: 200)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Quill.surface))
                        .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(Quill.line2, lineWidth: 1))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    Button("Beispieldaten laden") { spec.data = spec.type.sample }
                        .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
                    field("Titel", text: $spec.title, prompt: "optional")
                    field("Einheit", text: $spec.unit, prompt: "z. B. %, €, Mio.")
                    Toggle("Werte im Diagramm zeigen", isOn: $spec.showValues)
                        .font(.work(14))
                        .tint(Quill.accent)
                }
                .padding(20)
            }
        }
        .background(Quill.bg)
        .presentationBackground(Quill.bg)
        .onAppear { model.beginGesture() }
        .onChange(of: spec) { _, value in
            model.updateElement(elementID, record: false) { element in
                var updated = element
                updated.chart = value
                return updated
            }
        }
        .onDisappear { model.endGesture() }
    }

    private var typeMenu: some View {
        Menu {
            ForEach([ModuleGroup.diagrams, .distributions, .flows, .special], id: \.self) { group in
                Section(group.label) {
                    ForEach(ChartType.allCases.filter { $0.group == group }) { type in
                        Button(type.label) { change(to: type) }
                    }
                }
            }
        } label: {
            HStack(spacing: 6) {
                Text(spec.type.label)
                    .font(.work(14, .medium))
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 11, weight: .semibold))
            }
            .foregroundStyle(Quill.ink)
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(Capsule().fill(Quill.hover))
        }
    }

    /// Another type; sample data that was never changed is replaced by the new type's own.
    private func change(to type: ChartType) {
        let old = spec.type
        if spec.data == old.sample || spec.data.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            spec.data = type.sample
        }
        spec.type = type
    }

    private func field(_ title: String, text: Binding<String>, prompt: String) -> some View {
        HStack {
            Text(title)
                .font(.work(14))
                .foregroundStyle(Quill.ink2)
                .frame(width: 70, alignment: .leading)
            TextField(prompt, text: text)
                .font(.work(14))
                .padding(.horizontal, 12)
                .frame(height: 36)
                .background(Capsule().fill(Quill.hover))
        }
    }
}

/// The diagram on the slide's background.
struct ChartPreview: View {
    let spec: ChartSpec
    let theme: SlideTheme
    let aspect: CGFloat

    var body: some View {
        Canvas { context, size in
            context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(SlideDrawing.uiColor(theme.background))))
            context.withCGContext { cg in
                UIGraphicsPushContext(cg)
                ChartDrawing.draw(spec, in: CGRect(origin: .zero, size: size).insetBy(dx: 10, dy: 10), theme: theme)
                UIGraphicsPopContext()
            }
        }
        .aspectRatio(aspect, contentMode: .fit)
        .frame(maxWidth: .infinity)
    }
}

/// Diagrams as pictures, for formats that cannot draw them (PowerPoint).
enum ChartExport {
    /// The deck with every diagram replaced by a picture of it, and the pictures' bytes by name.
    static func flattened(_ presentation: Presentation) -> (presentation: Presentation, media: [String: Data]) {
        var result = presentation
        var media: [String: Data] = [:]
        for slideIndex in result.slides.indices {
            for elementIndex in result.slides[slideIndex].elements.indices where result.slides[slideIndex].elements[elementIndex].kind == .chart {
                var element = result.slides[slideIndex].elements[elementIndex]
                guard let spec = element.chart,
                      let data = png(spec, size: CGSize(width: element.width, height: element.height), theme: presentation.theme)
                else { continue }
                let name = "chart-\(element.id).png"
                media[name] = data
                element.kind = .image
                element.image = name
                element.chart = nil
                result.slides[slideIndex].elements[elementIndex] = element
            }
        }
        return (result, media)
    }

    static func png(_ spec: ChartSpec, size: CGSize, theme: SlideTheme) -> Data? {
        guard size.width > 1, size.height > 1 else { return nil }
        let format = UIGraphicsImageRendererFormat()
        format.scale = 3
        format.opaque = false
        return UIGraphicsImageRenderer(size: size, format: format).pngData { _ in
            ChartDrawing.draw(spec, in: CGRect(origin: .zero, size: size), theme: theme)
        }
    }
}

import SwiftData
import SwiftUI

/// The jump bar: Pip's input line for "go to" and search. It finds areas and documents by name.
struct JumpBar: View {
    @Binding var text: String
    /// On the dark hero card the bar is a light line on dark; in the "Mehr" panel it is a grey field.
    var onDark = true
    let onArea: (AppTab) -> Void
    let onDocument: (StudyMaterial) -> Void
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]

    var body: some View {
        HStack(spacing: 10) {
            PipLogo(pixel: 2)
            TextField("", text: $text, prompt: Text("Frag Pip oder springe zu …").foregroundStyle(onDark ? Quill.railMuted : Quill.faint))
                .font(.work(14, .medium))
                .foregroundStyle(onDark ? Quill.railInk : Quill.ink)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit {
                    if let first = JumpHits.find(text, materials: materials).first {
                        JumpHits.go(first, materials: materials, onArea: onArea, onDocument: onDocument)
                    }
                }
            Text("/")
                .font(.mono(10, .medium))
                .foregroundStyle(onDark ? Quill.railMuted : Quill.faint)
                .padding(.horizontal, 5)
                .padding(.vertical, 3)
                .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(onDark ? Quill.railLine : Quill.line2, lineWidth: 1))
        }
        .padding(.leading, 12)
        .padding(.trailing, 14)
        .frame(height: 44)
        .background(onDark ? Quill.railSurface : Quill.surface2, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(onDark ? Quill.railLine : Quill.line, lineWidth: 1))
    }
}

/// The list under the jump bar, on a light card; empty while nothing is typed.
struct JumpResults: View {
    let text: String
    let onArea: (AppTab) -> Void
    let onDocument: (StudyMaterial) -> Void
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]

    var body: some View {
        if !text.trimmingCharacters(in: .whitespaces).isEmpty {
            let hits = JumpHits.find(text, materials: materials)
            VStack(spacing: 0) {
                ForEach(hits) { entry in
                    Button {
                        JumpHits.go(entry, materials: materials, onArea: onArea, onDocument: onDocument)
                    } label: {
                        HStack(spacing: 10) {
                            Text(entry.label)
                                .font(.work(14, .semibold))
                                .lineLimit(1)
                            Spacer(minLength: 6)
                            Text(entry.kindLabel)
                                .font(.mono(10, .medium))
                                .foregroundStyle(Quill.faint)
                        }
                        .foregroundStyle(Quill.ink)
                        .padding(.horizontal, 12)
                        .frame(height: 42)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
                if hits.isEmpty {
                    Text("Pip hat dazu nichts gefunden.")
                        .font(.work(13, .medium))
                        .foregroundStyle(Quill.muted)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                }
            }
            .padding(6)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.line2, lineWidth: 1))
            .shadow(color: .black.opacity(0.3), radius: 16, y: 8)
        }
    }
}

enum JumpHits {
    static func find(_ text: String, materials: [StudyMaterial]) -> [StudioToday.OmniEntry] {
        let areas = AppTab.allCases.map { StudioToday.OmniEntry(id: $0.rawValue, label: $0.title, kind: .area) }
        let documents = materials.filter { !$0.isTrashed }.map {
            StudioToday.OmniEntry(id: $0.id.uuidString, label: $0.title, kind: .document)
        }
        return StudioToday.omni(query: text, areas: areas, documents: documents)
    }

    static func go(
        _ entry: StudioToday.OmniEntry,
        materials: [StudyMaterial],
        onArea: (AppTab) -> Void,
        onDocument: (StudyMaterial) -> Void
    ) {
        switch entry.kind {
        case .area:
            if let tab = AppTab(rawValue: entry.id) { onArea(tab) }
        case .document:
            if let material = materials.first(where: { $0.id.uuidString == entry.id }) { onDocument(material) }
        }
    }
}

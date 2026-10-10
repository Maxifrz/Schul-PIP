import SwiftUI

/// One material in the picker: its cards, and the course its lessons make once it has cards.
struct MaterialRow: Identifiable, Equatable {
    let id: UUID
    let title: String
    let cardCount: Int
    /// The id of the course made of its lessons; nil while it has no cards.
    let courseID: String?
    let lessons: Int
}

/// Where the student picks a course: the languages, the school subjects, maths, chess and music, then their own
/// materials, from which Pip makes lessons on tap.
struct CoursePickerSheet: View {
    let courses: [Course]
    let materials: [MaterialRow]
    let selectedID: String
    let fraction: (String) -> Double
    let xp: (String) -> Int
    let canGenerate: Bool
    let generatingID: UUID?
    let message: String
    let onSelect: (String) -> Void
    let onCreate: (UUID) -> Void
    let onLibrary: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    PixelCaption(text: "Lernen", color: Quill.accent)
                    Text("Kurse")
                        .font(.work(30, .heavy))
                        .tracking(-0.9)
                        .foregroundStyle(Quill.ink)
                }
                Spacer()
                Button("Fertig") { dismiss() }
                    .buttonStyle(QuillOutlineButtonStyle(height: 38, fontSize: 14, weight: .medium))
            }
            .padding(.horizontal, 24)
            .padding(.top, 24)
            .padding(.bottom, 12)
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    ForEach(CourseKind.allCases, id: \.self) { kind in
                        let group = courses.filter { $0.kind == kind }
                        if !group.isEmpty {
                            section(kind.title) {
                                ForEach(group) { course in courseRow(course) }
                            }
                        }
                    }
                    section("Mein Material") { materialSection }
                }
                .frame(maxWidth: 560)
                .padding(.horizontal, 20)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
        }
        .background(Quill.bg.ignoresSafeArea())
        .presentationDetents([.large])
    }

    private func section<Content: View>(_ title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.work(18, .bold))
                .foregroundStyle(Quill.ink)
                .accessibilityAddTraits(.isHeader)
            content()
        }
    }

    private func courseRow(_ course: Course) -> some View {
        let done = fraction(course.id)
        return Button {
            onSelect(course.id)
            dismiss()
        } label: {
            HStack(spacing: 14) {
                Image(systemName: course.symbol)
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(course.onTint)
                    .frame(width: 54, height: 54)
                    .background(course.tint, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                VStack(alignment: .leading, spacing: 3) {
                    Text(course.title)
                        .font(.work(17, .semibold))
                        .foregroundStyle(Quill.ink)
                    Text(course.subtitle)
                        .font(.work(13))
                        .foregroundStyle(Quill.muted)
                        .multilineTextAlignment(.leading)
                    HStack(spacing: 8) {
                        QuillProgressBar(fraction: done)
                            .frame(maxWidth: 120)
                        Text(xp(course.id) > 0 ? "\(Int((done * 100).rounded())) % · \(xp(course.id)) XP" : "\(Int((done * 100).rounded())) %")
                            .font(.mono(11, .medium))
                            .foregroundStyle(Quill.faint)
                    }
                    .padding(.top, 2)
                }
                Spacer(minLength: 8)
                if course.id == selectedID {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundStyle(Quill.link)
                }
            }
            .padding(12)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(course.id == selectedID ? Quill.accent : Quill.line, lineWidth: course.id == selectedID ? 2 : 1)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(course.title), \(course.subtitle), \(Int((done * 100).rounded())) Prozent geschafft")
        .accessibilityAddTraits(course.id == selectedID ? .isSelected : [])
    }

    @ViewBuilder
    private var materialSection: some View {
        if materials.isEmpty {
            VStack(alignment: .leading, spacing: 12) {
                Text("Importiere ein PDF in der Bibliothek. Pip liest die Seiten und macht daraus Lektionen, du musst keine Karten anlegen.")
                    .font(.work(14.5))
                    .lineSpacing(3)
                    .foregroundStyle(Quill.muted)
                    .fixedSize(horizontal: false, vertical: true)
                Button("Zur Bibliothek") {
                    dismiss()
                    onLibrary()
                }
                .buttonStyle(QuillPrimaryButtonStyle(height: 44, fontSize: 15))
            }
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Quill.line, lineWidth: 1))
        } else {
            ForEach(materials) { row in materialRow(row) }
            if !canGenerate {
                Text("Zum Erstellen braucht Pip einen API-Key oder den Demo-Modus, beides in den Einstellungen.")
                    .font(.work(13))
                    .foregroundStyle(Quill.faint)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if !message.isEmpty {
                Text(message)
                    .font(.work(13.5, .medium))
                    .foregroundStyle(Quill.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func materialRow(_ row: MaterialRow) -> some View {
        let running = generatingID == row.id
        return HStack(spacing: 14) {
            Image(systemName: "doc.text.fill")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(Quill.onAccent)
                .frame(width: 54, height: 54)
                .background(Quill.accent, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            VStack(alignment: .leading, spacing: 3) {
                Text(row.title)
                    .font(.work(16.5, .semibold))
                    .foregroundStyle(Quill.ink)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
                Text(row.cardCount == 0 ? "Noch keine Lektionen" : "\(row.cardCount) Karten · \(row.lessons) \(row.lessons == 1 ? "Lektion" : "Lektionen")")
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
            }
            Spacer(minLength: 8)
            if running {
                ProgressView()
            } else {
                if let courseID = row.courseID {
                    Button("Öffnen") {
                        onSelect(courseID)
                        dismiss()
                    }
                    .buttonStyle(QuillOutlineButtonStyle(height: 36, fontSize: 13.5, weight: .medium))
                }
                Button(row.cardCount == 0 ? "Erstellen" : "Mehr") { onCreate(row.id) }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 36, fontSize: 13.5))
                    .disabled(!canGenerate || generatingID != nil)
            }
        }
        .padding(12)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .accessibilityElement(children: .contain)
    }
}

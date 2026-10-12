import SwiftUI

/// One goal for the skills screen: what it is, where it stands, and why it does not stand higher.
struct SkillRow: Identifiable, Equatable {
    let skill: Skill
    let status: SkillStatus
    /// Why the goal is not reached (or not confirmed) yet, in sentences.
    let reasons: [String]
    /// Goals it builds on that are not reached yet.
    let waitingFor: [String]
    var id: String { skill.id }
}

extension SkillStatus {
    var symbol: String {
        switch self {
        case .notStarted: return "circle"
        case .started: return "play.circle"
        case .worked: return "circle.dotted"
        case .practicing: return "circle.lefthalf.filled"
        case .provisional: return "checkmark.circle"
        case .mastered: return "checkmark.seal.fill"
        case .due: return "arrow.clockwise.circle.fill"
        }
    }

    var tone: Color {
        switch self {
        case .notStarted: return Quill.faint
        case .started, .worked: return Quill.muted
        case .practicing: return Quill.ink2
        case .provisional: return Quill.accent
        case .mastered: return Quill.link
        case .due: return Quill.warn
        }
    }
}

/// What the Lernen tab suggests next and why, with one button to do it.
struct AdviceCard: View {
    let advice: Recommendation
    let onGo: () -> Void
    let onSkills: () -> Void

    private var caption: String {
        switch advice.kind {
        case .review: return "Wiederholung fällig"
        case .practice: return "Gezielt üben"
        case .step: return "Als Nächstes"
        case .finished: return "Kurs geschafft"
        }
    }

    private var tone: Color {
        switch advice.kind {
        case .review: return Quill.warn
        case .practice: return Quill.accent
        case .step, .finished: return Quill.link
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            PixelCaption(text: caption, color: tone)
            Text(advice.title)
                .font(.work(18, .bold))
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text(advice.reason)
                .font(.work(14))
                .lineSpacing(3)
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 12) {
                if advice.kind != .finished {
                    Button(advice.kind == .step ? "Starten" : "Los geht’s", action: onGo)
                        .buttonStyle(QuillPrimaryButtonStyle(height: 44, fontSize: 15))
                }
                Button("Fähigkeiten", action: onSkills)
                    .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 14, weight: .medium))
            }
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(tone.opacity(0.6), lineWidth: 1.5))
        .accessibilityElement(children: .contain)
    }
}

/// The goals of the course by unit: where each stands, what is missing, and a button to practise it.
struct SkillsSheet: View {
    let courseTitle: String
    let rows: [SkillRow]
    let onPractice: (SkillRow) -> Void
    @Environment(\.dismiss) private var dismiss

    private var units: [(title: String, number: Int, rows: [SkillRow])] {
        var order: [String] = []
        for row in rows where !order.contains(row.skill.unitID) { order.append(row.skill.unitID) }
        return order.map { id in
            let group = rows.filter { $0.skill.unitID == id }
            return (group[0].skill.unitTitle, group[0].skill.unitNumber, group)
        }
    }

    private var counts: String {
        let reached = rows.filter { $0.status.isReached }.count
        return "\(reached) von \(rows.count) erreicht"
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 6) {
                    PixelCaption(text: "Fähigkeiten", color: Quill.accent)
                    Text(courseTitle)
                        .font(.work(28, .heavy))
                        .tracking(-0.8)
                        .foregroundStyle(Quill.ink)
                    Text(counts)
                        .font(.work(14))
                        .foregroundStyle(Quill.muted)
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
                    Text("Eine Lektion zu bearbeiten reicht nicht: Ein Ziel gilt erst als erreicht, wenn du es ohne Hilfe richtig gemacht hast, auf jeder Stufe, die es verlangt. Beherrscht ist es nach einer guten Runde an einem anderen Tag.")
                        .font(.work(13.5))
                        .lineSpacing(3)
                        .foregroundStyle(Quill.muted)
                        .fixedSize(horizontal: false, vertical: true)
                    ForEach(units, id: \.number) { unit in
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Einheit \(unit.number) · \(unit.title)")
                                .font(.work(17, .bold))
                                .foregroundStyle(Quill.ink)
                                .accessibilityAddTraits(.isHeader)
                            ForEach(unit.rows) { row in card(row) }
                        }
                    }
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

    private func card(_ row: SkillRow) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(row.skill.title)
                    .font(.work(16, .semibold))
                    .foregroundStyle(Quill.ink)
                Spacer(minLength: 8)
                HStack(spacing: 5) {
                    Image(systemName: row.status.symbol)
                        .font(.system(size: 13, weight: .semibold))
                    Text(row.status.title)
                        .font(.work(12.5, .semibold))
                }
                .foregroundStyle(row.status.tone)
            }
            Text(row.skill.goal)
                .font(.work(14))
                .lineSpacing(3)
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
            if !row.waitingFor.isEmpty {
                Text("Baut auf: " + row.waitingFor.joined(separator: ", "))
                    .font(.work(13))
                    .foregroundStyle(Quill.warn)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if row.status != .mastered, row.status != .notStarted {
                ForEach(Array(row.reasons.enumerated()), id: \.offset) { _, reason in
                    Text(reason)
                        .font(.work(13))
                        .foregroundStyle(Quill.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Button(row.status == .due ? "Jetzt wiederholen" : "Gezielt üben") { onPractice(row) }
                    .buttonStyle(QuillOutlineButtonStyle(height: 38, fontSize: 14, weight: .medium))
                    .padding(.top, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(row.status == .due ? Quill.warn : Quill.line, lineWidth: row.status == .due ? 2 : 1))
        .accessibilityElement(children: .contain)
    }
}

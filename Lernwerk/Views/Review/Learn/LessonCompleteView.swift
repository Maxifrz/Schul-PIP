import SwiftUI

/// The end of a lesson: Pip, the XP it brought, how much was right on the first try, the streak and the daily goal.
struct LessonCompleteView: View {
    let result: LessonResult
    let xp: Int
    let streak: Int
    let xpToday: Int
    let dailyGoal: Int
    var rewards = LessonRewards()
    let onDone: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    private var compact: Bool { sizeClass == .compact }
    private var percent: Int { Int((result.accuracy * 100).rounded()) }
    private var goalReached: Bool { xpToday >= dailyGoal }

    private var headline: String {
        switch percent {
        case 100: return "Fehlerfrei!"
        case 80...: return "Stark gemacht!"
        default: return "Lektion geschafft"
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: 26) {
                    PipLogo(pixel: compact ? 7 : 9)
                        .padding(.top, compact ? 36 : 64)
                    VStack(spacing: 10) {
                        PixelCaption(text: "Lernpfad", color: Quill.accent)
                        Text(headline)
                            .font(.work(compact ? 32 : 38, .heavy))
                            .tracking(-1)
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Quill.ink)
                    }
                    HStack(spacing: 10) {
                        stat("+\(xp)", label: "XP", accessibility: "\(xp) XP verdient")
                        stat("\(percent) %", label: "Beim ersten Mal", accessibility: "\(percent) Prozent beim ersten Versuch richtig")
                        stat("\(streak)", label: streak == 1 ? "Tag in Folge" : "Tage in Folge", accessibility: "Serie: \(streak) \(streak == 1 ? "Tag" : "Tage")")
                    }
                    goal
                    extras
                    PipView(isThinking: false)
                        .frame(maxWidth: 360)
                }
                .frame(maxWidth: 560)
                .padding(.horizontal, compact ? 20 : 32)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            Button("Weiter", action: onDone)
                .buttonStyle(QuillPrimaryButtonStyle(height: 52, fontSize: 16))
                .keyboardShortcut(.defaultAction)
                .padding(.top, 10)
                .padding(.bottom, compact ? 16 : 28)
        }
    }

    /// Gems, quests finished and streak freezes used with this lesson.
    @ViewBuilder
    private var extras: some View {
        if rewards.gems > 0 || !rewards.quests.isEmpty || rewards.freezesUsed > 0 {
            VStack(alignment: .leading, spacing: 10) {
                if rewards.gems > 0 {
                    extraRow(symbol: "diamond.fill", text: "+\(rewards.gems) Gems", color: Quill.link)
                }
                ForEach(rewards.quests, id: \.self) { title in
                    extraRow(symbol: "checkmark.seal.fill", text: "Quest geschafft: \(title)", color: Quill.accent)
                }
                if rewards.freezesUsed > 0 {
                    extraRow(
                        symbol: "snowflake",
                        text: rewards.freezesUsed == 1 ? "Ein Streak-Schutz hat deine Serie gerettet" : "\(rewards.freezesUsed) Streak-Schütze haben deine Serie gerettet",
                        color: Quill.warn
                    )
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Quill.line, lineWidth: 1))
            .accessibilityElement(children: .combine)
        }
    }

    private func extraRow(symbol: String, text: String, color: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(color)
                .frame(width: 22)
            Text(text)
                .font(.work(15, .medium))
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func stat(_ value: String, label: String, accessibility: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.jersey(compact ? 40 : 48))
                .lineLimit(1)
                .minimumScaleFactor(0.6)
                .foregroundStyle(Quill.ink)
            Text(label)
                .font(.work(12.5, .medium))
                .multilineTextAlignment(.center)
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, minHeight: 96)
        .padding(.vertical, 12)
        .padding(.horizontal, 8)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibility)
    }

    private var goal: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(goalReached ? "Tagesziel erreicht" : "Tagesziel")
                    .font(.work(15, .semibold))
                    .foregroundStyle(goalReached ? Quill.link : Quill.ink)
                Spacer(minLength: 8)
                Text("\(min(xpToday, 9999)) / \(dailyGoal) XP")
                    .font(.mono(12.5, .medium))
                    .foregroundStyle(Quill.muted)
            }
            QuillProgressBar(fraction: Double(xpToday) / Double(max(1, dailyGoal)))
        }
        .padding(18)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(goalReached ? "Tagesziel erreicht: \(xpToday) von \(dailyGoal) XP" : "Tagesziel: \(xpToday) von \(dailyGoal) XP")
    }
}

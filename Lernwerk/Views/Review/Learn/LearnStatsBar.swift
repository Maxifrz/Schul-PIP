import SwiftUI

/// The numbers at the top of the Lernen tab: the course with its XP, the streak and the day's goal.
struct LearnStatsBar: View {
    let course: Course?
    let courseXP: Int
    let streak: Int
    let xpToday: Int
    let goal: Int
    let onCourse: () -> Void
    let onStreak: () -> Void
    let onGoal: (Int) -> Void
    @Binding var haptics: Bool
    @Environment(\.dynamicTypeSize) private var typeSize

    /// At the largest text sizes the three chips go under each other instead of being cut off.
    private var stacked: Bool { typeSize.isAccessibilitySize }

    var body: some View {
        let layout = stacked ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
            Button(action: onCourse) {
                HStack(spacing: 8) {
                    Image(systemName: course?.symbol ?? "square.grid.2x2.fill")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(course?.onTint ?? Quill.onAccent)
                        .frame(width: 30, height: 30)
                        .background(course?.tint ?? Quill.accent, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                    Text("\(courseXP) XP")
                        .font(.work(16, .bold))
                        .foregroundStyle(Quill.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(course.map { "Kurs \($0.title), \(courseXP) XP. Kurs wechseln" } ?? "Kurs wählen")
            if !stacked { Spacer(minLength: 0) }
            item(
                symbol: "flame.fill", color: streak > 0 ? Quill.accent : Quill.hint, word: "Serie", text: "\(streak)",
                label: "Serie: \(streak) \(streak == 1 ? "Tag" : "Tage"). Öffnet die Serie", action: onStreak
            )
            if !stacked { Spacer(minLength: 0) }
            goalMenu
        }
        .padding(.horizontal, 4)
    }

    private func item(symbol: String, color: Color, word: String, text: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: symbol)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(color)
                Text(word)
                    .font(.work(14))
                    .foregroundStyle(Quill.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text(text)
                    .font(.work(16, .bold))
                    .foregroundStyle(Quill.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(minHeight: 44)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    private var goalMenu: some View {
        Menu {
            Picker("Tagesziel", selection: Binding(get: { goal }, set: { onGoal($0) })) {
                ForEach(LearnProgress.dailyGoals, id: \.self) { Text("\($0) XP am Tag").tag($0) }
            }
            Toggle("Vibration", isOn: $haptics)
        } label: {
            HStack(spacing: 6) {
                ZStack {
                    Circle().stroke(Quill.line2, lineWidth: 3)
                    Circle()
                        .trim(from: 0, to: min(1, Double(xpToday) / Double(max(1, goal))))
                        .stroke(xpToday >= goal ? Quill.link : Quill.accent, style: StrokeStyle(lineWidth: 3, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                .frame(width: 22, height: 22)
                Text("Heute")
                    .font(.work(14))
                    .foregroundStyle(Quill.muted)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("\(min(xpToday, 999))/\(goal)")
                    .font(.work(14, .bold))
                    .foregroundStyle(Quill.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(minHeight: 44)
        }
        .accessibilityLabel("Tagesziel: \(xpToday) von \(goal) XP. Ändern")
    }
}

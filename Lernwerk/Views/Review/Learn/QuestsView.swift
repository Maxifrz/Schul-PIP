import SwiftUI

/// The day's three quests and the week's challenge, with what claiming them pays, and the streak freeze to buy.
struct QuestsView: View {
    let board: QuestBoard
    let gems: Int
    let freezes: Int
    let secondsLeft: TimeInterval
    let onClaim: (String) -> Void
    let onBuyFreeze: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    private var timeLeft: String {
        let minutes = Int(secondsLeft / 60)
        return minutes >= 60 ? "noch \(minutes / 60) Std \(minutes % 60) Min" : "noch \(max(1, minutes)) Min"
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header(title: "Heute", detail: timeLeft)
                ForEach(board.daily) { quest in
                    QuestCard(quest: quest, onClaim: { onClaim(quest.id) })
                }
                if board.allDailyClaimed || board.bonusAvailable || board.bonusClaimed {
                    bonus
                }
                if let weekly = board.weekly {
                    header(title: "Diese Woche", detail: "Wochenziel")
                        .padding(.top, 10)
                    QuestCard(quest: weekly, onClaim: { onClaim(weekly.id) })
                }
                header(title: "Streak-Schutz", detail: "\(freezes) von \(LearnProgress.maxFreezes)")
                    .padding(.top, 10)
                FreezeRow(gems: gems, freezes: freezes, onBuy: onBuyFreeze)
            }
            .frame(maxWidth: 560)
            .padding(.horizontal, sizeClass == .compact ? 16 : 28)
            .padding(.top, 12)
            .padding(.bottom, 40)
            .frame(maxWidth: .infinity)
        }
        .scrollIndicators(.hidden)
    }

    private func header(title: String, detail: String) -> some View {
        HStack {
            Text(title)
                .font(.work(22, .bold))
                .tracking(-0.4)
                .foregroundStyle(Quill.ink)
                .accessibilityAddTraits(.isHeader)
            Spacer(minLength: 8)
            Text(detail)
                .font(.mono(12, .medium))
                .foregroundStyle(Quill.muted)
        }
    }

    private var bonus: some View {
        HStack(spacing: 14) {
            Image(systemName: "shippingbox.fill")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Quill.warn)
                .frame(width: 44, height: 44)
            VStack(alignment: .leading, spacing: 3) {
                Text("Alle drei geschafft")
                    .font(.work(16, .semibold))
                    .foregroundStyle(Quill.ink)
                Text(board.bonusClaimed ? "Bonus abgeholt" : "Dafür gibt es \(QuestBoard.bonusGems) Gems extra")
                    .font(.work(13.5))
                    .foregroundStyle(Quill.muted)
            }
            Spacer(minLength: 8)
            if board.bonusAvailable {
                Button("Abholen") { onClaim(QuestStore.bonusID) }
                    .buttonStyle(QuestClaimStyle())
            } else if board.bonusClaimed {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(Quill.link)
            }
        }
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(board.bonusAvailable ? Quill.warn : Quill.line, lineWidth: board.bonusAvailable ? 2 : 1))
        .accessibilityElement(children: .combine)
    }
}

private struct QuestClaimStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.work(14, .bold))
            .foregroundStyle(Quill.onAccent)
            .padding(.horizontal, 16)
            .frame(height: 38)
            .background(Quill.accent, in: Capsule())
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

/// One quest: what it asks, how far along, what it pays and a button to claim it.
struct QuestCard: View {
    let quest: Quest
    let onClaim: () -> Void

    private var symbol: String {
        switch quest.kind {
        case .xp: return "bolt.fill"
        case .lessons: return "book.closed.fill"
        case .perfect: return "target"
        case .firstTry: return "checkmark.circle.fill"
        case .courses: return "square.stack.fill"
        case .practice: return "dumbbell.fill"
        case .days: return "calendar"
        }
    }

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: symbol)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(quest.isDone ? Quill.link : Quill.accent)
                .frame(width: 44, height: 44)
                .background(Quill.accentSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 8) {
                Text(quest.title)
                    .font(.work(16, .semibold))
                    .foregroundStyle(Quill.ink)
                    .fixedSize(horizontal: false, vertical: true)
                HStack(spacing: 10) {
                    QuillProgressBar(fraction: quest.fraction)
                    Text("\(min(quest.progress, quest.target))/\(quest.target)")
                        .font(.mono(12, .medium))
                        .foregroundStyle(Quill.muted)
                        .fixedSize()
                }
                HStack(spacing: 4) {
                    Image(systemName: "diamond.fill")
                        .font(.system(size: 11, weight: .semibold))
                    Text("\(quest.reward) Gems")
                        .font(.work(12.5, .medium))
                }
                .foregroundStyle(Quill.link)
            }
            if quest.claimed {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 24))
                    .foregroundStyle(Quill.link)
                    .accessibilityLabel("Abgeholt")
            } else if quest.isDone {
                Button("Abholen", action: onClaim)
                    .buttonStyle(QuestClaimStyle())
            }
        }
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .stroke(quest.isDone && !quest.claimed ? Quill.warn : Quill.line, lineWidth: quest.isDone && !quest.claimed ? 2 : 1)
        )
        .accessibilityElement(children: .contain)
    }
}

/// The streak freeze: what it does, how many you have and a button to buy one with gems.
struct FreezeRow: View {
    let gems: Int
    let freezes: Int
    let onBuy: () -> Void

    private var canBuy: Bool { gems >= LearnProgress.freezePrice && freezes < LearnProgress.maxFreezes }

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "snowflake")
                .font(.system(size: 22, weight: .semibold))
                .foregroundStyle(Quill.link)
                .frame(width: 44, height: 44)
                .background(Quill.accentSoft, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            VStack(alignment: .leading, spacing: 4) {
                Text("Streak-Schutz")
                    .font(.work(16, .semibold))
                    .foregroundStyle(Quill.ink)
                Text("Rettet deine Serie, wenn du einen Tag auslässt. Du hast \(freezes) von \(LearnProgress.maxFreezes).")
                    .font(.work(13.5))
                    .foregroundStyle(Quill.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 8)
            Button(action: onBuy) {
                VStack(spacing: 1) {
                    Text("Kaufen")
                        .font(.work(14, .bold))
                    HStack(spacing: 3) {
                        Image(systemName: "diamond.fill")
                            .font(.system(size: 9, weight: .semibold))
                        Text("\(LearnProgress.freezePrice)")
                            .font(.work(12, .semibold))
                    }
                }
                .foregroundStyle(Quill.onAccent)
                .padding(.horizontal, 14)
                .frame(height: 44)
                .background(Quill.accent, in: Capsule())
                .opacity(canBuy ? 1 : 0.4)
            }
            .buttonStyle(.plain)
            .disabled(!canBuy)
            .accessibilityLabel("Streak-Schutz kaufen für \(LearnProgress.freezePrice) Gems")
        }
        .padding(14)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Quill.line, lineWidth: 1))
    }
}

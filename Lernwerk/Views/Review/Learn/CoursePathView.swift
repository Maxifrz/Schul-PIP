import SwiftUI

/// The two small tiles above the path: today's quests and the week's challenge.
struct PathTiles: Equatable {
    var questsDone = 0
    var questsTotal = 0
    /// Until midnight.
    var secondsLeft: TimeInterval = 0
    var weekText = ""
    var weekFraction = 0.0
    var hasUnclaimed = false

    /// "noch 15 Std" or "noch 42 Min".
    var timeLeftText: String {
        let minutes = Int(secondsLeft / 60)
        if minutes >= 60 { return "noch \(minutes / 60) Std" }
        return "noch \(max(1, minutes)) Min"
    }
}

/// The path of a course: a banner per unit that stays at the top while its steps scroll by, and below it the steps in
/// a gentle zigzag, with Pip standing beside the one to do next.
struct CoursePathView<Footer: View>: View {
    let course: Course
    let units: [PathUnit]
    let tiles: PathTiles
    let onStep: (PathStep) -> Void
    let onTip: (CourseUnit) -> Void
    let onQuests: () -> Void
    @ViewBuilder var footer: Footer

    @Environment(\.horizontalSizeClass) private var sizeClass

    private var compact: Bool { sizeClass == .compact }
    private var current: PathStep? { CoursePath.current(in: units) }

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    tilesRow
                        .padding(.bottom, 6)
                    ForEach(Array(units.enumerated()), id: \.element.id) { unitIndex, unit in
                        Section {
                            steps(of: unit, before: units.prefix(unitIndex).reduce(0) { $0 + $1.steps.count })
                        } header: {
                            banner(unit)
                        }
                    }
                    if !units.isEmpty, units.allSatisfy({ $0.isDone }) {
                        finished
                    }
                    footer
                        .padding(.top, 24)
                }
                .frame(maxWidth: 560)
                .padding(.horizontal, compact ? 16 : 28)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            .onAppear {
                guard let current else { return }
                DispatchQueue.main.async { proxy.scrollTo(current.id, anchor: .center) }
            }
        }
    }

    // MARK: Banner

    private func banner(_ unit: PathUnit) -> some View {
        Button { onTip(unit.unit) } label: {
            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("ABSCHNITT \(unit.sectionNumber), EINHEIT \(unit.unit.number)")
                        .font(.mono(11, .semibold))
                        .tracking(1)
                        .opacity(0.8)
                    Text(unit.unit.title)
                        .font(.work(21, .bold))
                        .tracking(-0.4)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Image(systemName: "book.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(course.onTint.opacity(0.5), lineWidth: 1.5))
            }
            .foregroundStyle(course.onTint)
            .padding(.horizontal, 18)
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(course.tint, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Quill.paperInk.opacity(0.28))
                    .offset(y: 4)
            )
        }
        .buttonStyle(.plain)
        .padding(.top, 14)
        .padding(.bottom, 10)
        .background(Quill.bg)
        .accessibilityLabel("Abschnitt \(unit.sectionNumber), Einheit \(unit.unit.number): \(unit.unit.title). Tipps lesen")
    }

    // MARK: Steps

    private func steps(of unit: PathUnit, before offset: Int) -> some View {
        VStack(spacing: 14) {
            ForEach(Array(unit.steps.enumerated()), id: \.element.id) { index, step in
                row(step, position: offset + index)
                    .id(step.id)
            }
        }
        .padding(.top, 16)
        .padding(.bottom, 20)
    }

    /// A gentle wave: right, further right, back, left, further left, back.
    private func shift(_ position: Int) -> CGFloat {
        let wave: [CGFloat] = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55]
        return wave[position % wave.count] * (compact ? 62 : 100)
    }

    private func row(_ step: PathStep, position: Int) -> some View {
        let offset = shift(position)
        let isCurrent = step.id == current?.id
        return ZStack {
            PathNodeView(step: step, course: course, isCurrent: isCurrent) { onStep(step) }
                .offset(x: offset)
            if isCurrent {
                PathPip()
                    .offset(x: offset >= 0 ? -(compact ? 104 : 150) : (compact ? 104 : 150), y: 4)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 100)
        .padding(.top, isCurrent ? 22 : 0)
    }

    /// Pip standing beside the step to do next.
    private struct PathPip: View {
        var body: some View {
            VStack(spacing: 6) {
                PipLogo(pixel: 4)
                Ellipse()
                    .fill(Quill.paperInk.opacity(0.18))
                    .frame(width: 54, height: 12)
            }
            .accessibilityHidden(true)
        }
    }

    // MARK: Tiles and footer

    private var tilesRow: some View {
        HStack(spacing: 10) {
            tile(
                symbol: "scroll.fill", title: "Quests",
                value: "\(tiles.questsDone)/\(tiles.questsTotal)", caption: tiles.timeLeftText,
                fraction: tiles.questsTotal == 0 ? 0 : Double(tiles.questsDone) / Double(tiles.questsTotal),
                highlight: tiles.hasUnclaimed
            )
            tile(
                symbol: "calendar", title: "Woche", value: tiles.weekText, caption: "Wochenziel",
                fraction: tiles.weekFraction, highlight: false
            )
        }
        .padding(.top, 6)
    }

    private func tile(symbol: String, title: String, value: String, caption: String, fraction: Double, highlight: Bool) -> some View {
        Button(action: onQuests) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: symbol)
                        .font(.system(size: 13, weight: .semibold))
                    Text(title.uppercased())
                        .font(.mono(10.5, .semibold))
                        .tracking(0.8)
                    Spacer(minLength: 0)
                    if highlight {
                        StatusDot(color: Quill.warn, size: 8)
                    }
                }
                .foregroundStyle(Quill.muted)
                Text(value.isEmpty ? " " : value)
                    .font(.work(18, .bold))
                    .foregroundStyle(Quill.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                QuillProgressBar(fraction: fraction)
                Text(caption)
                    .font(.work(12))
                    .foregroundStyle(Quill.faint)
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(highlight ? Quill.warn : Quill.line, lineWidth: highlight ? 2 : 1))
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(title): \(value), \(caption)")
    }

    private var finished: some View {
        VStack(spacing: 10) {
            PipLogo(pixel: 5)
            Text("Kurs geschafft")
                .font(.work(24, .bold))
                .foregroundStyle(Quill.ink)
            Text("Du hast alle Einheiten von „\(course.title)“ abgeschlossen. Tippe auf eine Lektion, um sie noch einmal zu üben.")
                .font(.work(14.5))
                .foregroundStyle(Quill.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(24)
        .frame(maxWidth: .infinity)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .padding(.top, 10)
    }
}

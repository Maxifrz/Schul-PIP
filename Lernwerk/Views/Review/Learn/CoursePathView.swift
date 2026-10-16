import SwiftUI

/// What the one line above the path says: today's quests and the week's challenge.
struct PathTiles: Equatable {
    var questsDone = 0
    var questsTotal = 0
    var weekText = ""
    var hasUnclaimed = false
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
    /// What to do next, if the course tracks skills; nil for a course made of the student's own cards.
    let advice: Recommendation?
    let onAdvice: () -> Void
    let onSkills: () -> Void
    /// Where the course's goals stand; nil for a course made of the student's own cards.
    let mastery: PathMastery?
    private let footer: Footer

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    init(
        course: Course,
        units: [PathUnit],
        tiles: PathTiles,
        onStep: @escaping (PathStep) -> Void,
        onTip: @escaping (CourseUnit) -> Void,
        onQuests: @escaping () -> Void,
        advice: Recommendation? = nil,
        onAdvice: @escaping () -> Void = {},
        onSkills: @escaping () -> Void = {},
        mastery: PathMastery? = nil,
        @ViewBuilder footer: () -> Footer
    ) {
        self.course = course
        self.units = units
        self.tiles = tiles
        self.onStep = onStep
        self.onTip = onTip
        self.onQuests = onQuests
        self.advice = advice
        self.onAdvice = onAdvice
        self.onSkills = onSkills
        self.mastery = mastery
        self.footer = footer()
    }

    private var compact: Bool { sizeClass == .compact }
    private var current: PathStep? { CoursePath.current(in: units) }

    /// Wide windows (an iPad, not a Split View sliver) put the advice beside the path instead of above it.
    private var railMinimumWidth: CGFloat { 760 }
    private var railWidth: CGFloat { 340 }

    var body: some View {
        GeometryReader { geometry in
            if sizeClass == .regular, geometry.size.width >= railMinimumWidth {
                HStack(alignment: .top, spacing: 12) {
                    headerContent
                        .frame(width: railWidth)
                        .padding(.leading, 28)
                        .padding(.top, 6)
                    pathScroll(withHeader: false)
                }
            } else {
                VStack(spacing: 0) {
                    // At the largest text sizes the advice would fill the screen, so it scrolls with the path.
                    if !typeSize.isAccessibilitySize {
                        headerContent
                            .frame(maxWidth: 560)
                            .padding(.horizontal, compact ? 16 : 28)
                            .frame(maxWidth: .infinity)
                    }
                    pathScroll(withHeader: typeSize.isAccessibilitySize)
                }
            }
        }
    }

    /// The advice and the quests line stay in view while the path scrolls: above it, or in the rail beside it.
    private var headerContent: some View {
        VStack(spacing: 0) {
            if let advice {
                AdviceCard(advice: advice, onGo: onAdvice, onSkills: onSkills)
                    .padding(.top, 6)
            }
            questsLine
        }
    }

    private func pathScroll(withHeader: Bool) -> some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0, pinnedViews: [.sectionHeaders]) {
                    if withHeader { headerContent }
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
                DispatchQueue.main.async { proxy.scrollTo(current.id, anchor: UnitPoint(x: 0.5, y: 0.6)) }
            }
        }
    }

    // MARK: Banner

    private func banner(_ unit: PathUnit) -> some View {
        let standing = mastery.map { $0.unit(unit.unit) }.flatMap { $0.isEmpty ? nil : $0 }
        return HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 8) {
                Button { onTip(unit.unit) } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ABSCHNITT \(unit.sectionNumber), EINHEIT \(unit.unit.number)")
                            .font(.mono(11, .semibold))
                            .tracking(1)
                            .opacity(0.8)
                            .fixedSize(horizontal: false, vertical: true)
                        Text(unit.unit.title)
                            .font(.work(21, .bold))
                            .tracking(-0.4)
                            .multilineTextAlignment(.leading)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Abschnitt \(unit.sectionNumber), Einheit \(unit.unit.number): \(unit.unit.title). Tipps lesen")
                if let standing {
                    Button(action: onSkills) {
                        HStack(spacing: 8) {
                            HStack(spacing: 4) {
                                ForEach(0..<standing.total, id: \.self) { index in
                                    Circle()
                                        .fill(index < standing.reached ? course.onTint : Color.clear)
                                        .overlay(Circle().stroke(course.onTint.opacity(0.7), lineWidth: 1.5))
                                        .frame(width: 9, height: 9)
                                }
                            }
                            Text(standing.text)
                                .font(.work(13.5, .semibold))
                            Image(systemName: "chevron.right")
                                .font(.system(size: 11, weight: .bold))
                                .opacity(0.8)
                        }
                        .frame(minHeight: 44, alignment: .leading)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Fähigkeiten: \(standing.text). Zeigt die Fähigkeiten")
                }
            }
            Button { onTip(unit.unit) } label: {
                Image(systemName: "book.fill")
                    .font(.system(size: 17, weight: .semibold))
                    .frame(width: 44, height: 44)
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(course.onTint.opacity(0.5), lineWidth: 1.5))
            }
            .buttonStyle(.plain)
            .accessibilityHidden(true)
        }
        .foregroundStyle(course.onTint)
        .padding(.horizontal, 18)
        .padding(.top, 14)
        .padding(.bottom, standing == nil ? 14 : 4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(course.tint, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Quill.scrim)
                .offset(y: 4)
        )
        .padding(.top, 14)
        .padding(.bottom, 10)
        .background(Quill.bg)
        .accessibilityElement(children: .contain)
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
            PathNodeView(step: step, course: course, isCurrent: isCurrent, mastery: mastery?.node(step) ?? .none) { onStep(step) }
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

    // MARK: Quests line and footer

    /// Quests and the week in one quiet line; the page behind it has the rest.
    private var questsLine: some View {
        Button(action: onQuests) {
            Group {
                if typeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 2) { questsLineParts }
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    questsLineRow
                }
            }
            .padding(.horizontal, 4)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Quests heute: \(tiles.questsDone) von \(tiles.questsTotal)" + (tiles.weekText.isEmpty ? "" : ", Woche: \(tiles.weekText)"))
        .accessibilityHint("Öffnet die Quests")
    }

    private var questsLineRow: some View {
        HStack(spacing: 8) {
            questsLineParts
            Spacer(minLength: 0)
            Image(systemName: "chevron.right")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(Quill.faint)
        }
    }

    @ViewBuilder
    private var questsLineParts: some View {
        HStack(spacing: 6) {
            Text("Quests \(tiles.questsDone)/\(tiles.questsTotal)")
                .font(.work(14, .medium))
                .foregroundStyle(Quill.ink2)
            if tiles.hasUnclaimed {
                StatusDot(color: Quill.warn, size: 8)
            }
        }
        if !tiles.weekText.isEmpty {
            Text("Woche \(tiles.weekText)")
                .font(.work(14))
                .foregroundStyle(Quill.muted)
        }
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

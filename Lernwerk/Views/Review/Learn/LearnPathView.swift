import SwiftData
import SwiftUI

extension ReviewCard {
    /// The card as plain values for the Lernpfad.
    var snapshot: CardSnapshot {
        CardSnapshot(front: front, back: back, materialID: materialID, createdAt: createdAt, dueDate: dueDate)
    }
}

/// The Lernpfad: streak, XP of the day and the daily goal on top, below one path of lessons per material. A finished
/// lesson grades only the cards that were due when it started, records XP and streak and opens the next lesson.
struct LearnPathView: View {
    let select: (AppTab) -> Void

    @Query(sort: \ReviewCard.createdAt) private var cards: [ReviewCard]
    @Query private var materials: [StudyMaterial]
    @EnvironmentObject private var progress: LearnProgressStore
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.horizontalSizeClass) private var sizeClass
    @AppStorage("learn.haptics") private var haptics = true
    @State private var active: ActiveLesson?
    @State private var distractors: [String: [String]] = [:]

    /// Cards asked about since launch, so the path asks the model about a card at most once per launch.
    private static var askedThisLaunch: Set<String> = []

    /// A lesson as it was when the student started it.
    struct ActiveLesson: Identifiable {
        let id = UUID()
        let cards: [CardSnapshot]
        let dueKeys: Set<String>
        let deck: [CardSnapshot]
        let distractors: [String: [String]]
    }

    private var compact: Bool { sizeClass == .compact }

    var body: some View {
        let snapshots = cards.map(\.snapshot)
        let units = LearnPath.units(from: snapshots, completed: progress.progress.completedLessons)
        return Group {
            if snapshots.count < LearnPath.minimumCards {
                emptyState(count: snapshots.count)
            } else {
                path(units, deck: snapshots)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .fullScreenCover(item: $active) { lesson in
            LessonView(cards: lesson.cards, dueKeys: lesson.dueKeys, deck: lesson.deck, distractors: lesson.distractors) { result in
                finish(result, dueKeys: lesson.dueKeys)
            }
            .environmentObject(progress)
        }
        .task(id: snapshots.count) {
            await fetchDistractors(for: snapshots)
        }
    }

    // Header

    private var header: some View {
        let now = Date()
        let streak = progress.progress.currentStreak(now: now, calendar: .current)
        let xpToday = progress.progress.xpToday(now: now, calendar: .current)
        let goal = progress.progress.dailyGoal
        return VStack(alignment: .leading, spacing: 16) {
            PageHeader(caption: "Karteikarten", title: "Lernpfad")
            HStack(alignment: .center, spacing: 18) {
                HStack(spacing: 6) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(streak > 0 ? Quill.warn : Quill.hint)
                    Text("\(streak)")
                        .font(.jersey(28))
                        .foregroundStyle(Quill.ink)
                    Text(streak == 1 ? "Tag" : "Tage")
                        .font(.work(13))
                        .foregroundStyle(Quill.muted)
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Serie: \(streak) \(streak == 1 ? "Tag" : "Tage")")

                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        Text("Heute")
                            .font(.work(13, .medium))
                            .foregroundStyle(Quill.muted)
                        Spacer(minLength: 8)
                        Text("\(xpToday) / \(goal) XP")
                            .font(.mono(12, .medium))
                            .foregroundStyle(xpToday >= goal ? Quill.link : Quill.muted)
                    }
                    QuillProgressBar(fraction: Double(xpToday) / Double(max(1, goal)))
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("Tagesziel: \(xpToday) von \(goal) XP")

                optionsMenu(goal: goal)
            }
        }
    }

    private func optionsMenu(goal: Int) -> some View {
        Menu {
            Picker("Tagesziel", selection: Binding(get: { progress.progress.dailyGoal }, set: { progress.setDailyGoal($0) })) {
                ForEach(LearnProgress.dailyGoals, id: \.self) { Text("\($0) XP am Tag").tag($0) }
            }
            Toggle("Vibration", isOn: $haptics)
        } label: {
            HStack(spacing: 4) {
                Text("Ziel \(goal)")
                    .font(.work(13, .medium))
                Image(systemName: "chevron.down")
                    .font(.system(size: 10, weight: .semibold))
            }
            .foregroundStyle(Quill.ink)
            .padding(.horizontal, 12)
            .frame(height: 32)
            .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
            .contentShape(Capsule())
        }
        .accessibilityLabel("Tagesziel ändern, jetzt \(goal) XP")
    }

    // Path

    private func path(_ units: [LearnUnit], deck: [CardSnapshot]) -> some View {
        let next = LearnPath.nextOpenLesson(in: units)?.id
        return ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    ForEach(Array(units.enumerated()), id: \.element.id) { number, unit in
                        unitSection(unit, number: number, deck: deck, next: next)
                    }
                }
                .frame(maxWidth: 760)
                .padding(.horizontal, compact ? 20 : 40)
                .padding(.top, compact ? 16 : 28)
                .padding(.bottom, 40)
                .frame(maxWidth: .infinity)
            }
            .scrollIndicators(.hidden)
            .onAppear {
                guard let next else { return }
                proxy.scrollTo(next, anchor: .center)
            }
        }
    }

    private func unitSection(_ unit: LearnUnit, number: Int, deck: [CardSnapshot], next: String?) -> some View {
        let done = unit.lessons.filter { $0.state == .done }.count
        return VStack(spacing: 22) {
            VStack(alignment: .leading, spacing: 6) {
                PixelCaption(text: "Einheit \(number + 1)", color: Quill.accent)
                Text(title(of: unit))
                    .font(.work(20, .semibold))
                    .tracking(-0.4)
                    .foregroundStyle(Quill.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("\(done) von \(unit.lessons.count) \(unit.lessons.count == 1 ? "Lektion" : "Lektionen") geschafft · \(unit.cards.count) Karten")
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Quill.line, lineWidth: 1))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)

            VStack(spacing: 18) {
                ForEach(unit.lessons) { lesson in
                    lessonNode(lesson, isNext: lesson.id == next, deck: deck)
                        .offset(x: zigzag(lesson.index))
                        .id(lesson.id)
                }
            }
            .frame(maxWidth: .infinity)
        }
    }

    /// A gentle wave: right, further right, back, left, further left, back.
    private func zigzag(_ index: Int) -> CGFloat {
        let wave: [CGFloat] = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55]
        return wave[index % wave.count] * (compact ? 64 : 110)
    }

    private func lessonNode(_ lesson: LearnLesson, isNext: Bool, deck: [CardSnapshot]) -> some View {
        let due = lesson.cards.filter { $0.isDue(at: Date()) }.count
        let style = nodeStyle(lesson.state)
        return Button {
            start(lesson, deck: deck)
        } label: {
            VStack(spacing: 8) {
                ZStack {
                    if isNext {
                        Circle()
                            .stroke(Quill.accent, lineWidth: 3)
                            .frame(width: 88, height: 88)
                    }
                    Circle()
                        .fill(style.fill)
                        .frame(width: 72, height: 72)
                    Circle()
                        .stroke(style.stroke, lineWidth: 1)
                        .frame(width: 72, height: 72)
                    Image(systemName: style.icon)
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(style.iconColor)
                }
                .frame(width: 92, height: 92)
                Text("Lektion \(lesson.index + 1)")
                    .font(.work(13.5, .semibold))
                    .foregroundStyle(lesson.state == .locked ? Quill.faint : Quill.ink)
                Text(due > 0 ? "\(lesson.cards.count) Karten · \(due) fällig" : "\(lesson.cards.count) Karten")
                    .font(.work(12))
                    .foregroundStyle(Quill.muted)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .allowsHitTesting(lesson.state != .locked)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Lektion \(lesson.index + 1), \(lesson.cards.count) Karten, \(stateLabel(lesson.state))\(due > 0 ? ", \(due) fällig" : "")")
        .accessibilityAddTraits(lesson.state == .locked ? [] : .isButton)
        .accessibilityHint(lesson.state == .locked ? "Öffnet sich, wenn die Lektion davor geschafft ist" : "Startet die Lektion")
    }

    private struct NodeStyle {
        let fill: Color
        let stroke: Color
        let icon: String
        let iconColor: Color
    }

    private func nodeStyle(_ state: LessonState) -> NodeStyle {
        switch state {
        case .done: return NodeStyle(fill: Quill.accent, stroke: Quill.accent, icon: "checkmark", iconColor: Quill.onAccent)
        case .open: return NodeStyle(fill: Quill.ink, stroke: Quill.ink, icon: "star.fill", iconColor: Quill.bg)
        case .locked: return NodeStyle(fill: Quill.surface2, stroke: Quill.line2, icon: "lock.fill", iconColor: Quill.faint)
        }
    }

    private func stateLabel(_ state: LessonState) -> String {
        switch state {
        case .done: return "geschafft"
        case .open: return "offen"
        case .locked: return "gesperrt"
        }
    }

    private func title(of unit: LearnUnit) -> String {
        guard let id = unit.materialID, let material = materials.first(where: { $0.id == id }) else {
            return LearnPath.otherUnitTitle
        }
        return material.title
    }

    // Empty

    private func emptyState(count: Int) -> some View {
        VStack(spacing: 14) {
            PipLogo(pixel: 6)
            Text(count == 0 ? "Noch keine Karten" : "Noch zu wenig Karten")
                .font(.work(28, .semibold))
                .tracking(-0.7)
                .foregroundStyle(Quill.ink)
                .padding(.top, 6)
            Text(
                "Der Lernpfad braucht mindestens \(LearnPath.minimumCards) Karteikarten. Karten entstehen, wenn du dir "
                    + "in einem Dokument mit dem Hilfe-Werkzeug etwas erklären lässt, im Lernplan unter „Karteikarten“ "
                    + "oder aus einem geteilten Tafelbild in Kurse."
            )
            .font(.work(15.5))
            .lineSpacing(5)
            .multilineTextAlignment(.center)
            .foregroundStyle(Quill.muted)
            .frame(maxWidth: 440)
            .fixedSize(horizontal: false, vertical: true)
            Button("Zur Bibliothek") { select(.library) }
                .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 15))
                .padding(.top, 8)
        }
        .padding(.horizontal, 32)
        .padding(.bottom, 60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // Flow

    private func start(_ lesson: LearnLesson, deck: [CardSnapshot]) {
        guard lesson.state != .locked, active == nil else { return }
        active = ActiveLesson(
            cards: lesson.cards, dueKeys: LearnPath.dueKeys(lesson.cards, at: Date()), deck: deck, distractors: distractors
        )
    }

    /// Records the lesson and grades its due cards, once per run: a run the store has seen before grades nothing.
    private func finish(_ result: LessonResult, dueKeys: Set<String>) {
        let now = Date()
        guard progress.record(result, now: now, calendar: .current) != nil else { return }
        let byKey = Dictionary(cards.map { ($0.snapshot.key, $0) }, uniquingKeysWith: { first, _ in first })
        for (key, grade) in LessonGrading.gradesToApply(result, dueKeys: dueKeys) {
            byKey[key]?.apply(grade, at: now)
        }
    }

    /// Wrong answers from the tutor model for cards the deck has too few for, fetched in the background while the path
    /// is open and never during a lesson. Without a key, offline or on any error the cards are simply typed.
    private func fetchDistractors(for deck: [CardSnapshot]) async {
        let cache = DistractorCache()
        distractors = cache.all()
        guard deck.count >= LearnPath.minimumCards, settings.demoMode || settings.hasKey(for: settings.tutor.provider) else {
            return
        }
        let wanted = ExerciseBuilder.cardsNeedingDistractors(in: deck)
            .filter { cache.distractors(for: $0.key) == nil && !LearnPathView.askedThisLaunch.contains($0.key) }
        guard !wanted.isEmpty else { return }
        LearnPathView.askedThisLaunch.formUnion(wanted.map(\.key))
        let service = DistractorService(client: settings.makeClient(for: .tutor), cache: cache)
        await service.fetch(for: wanted)
        cache.prune(keeping: Set(deck.map(\.key)))
        distractors = cache.all()
    }
}

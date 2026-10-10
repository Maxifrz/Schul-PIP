import SwiftData
import SwiftUI

/// The Lernen tab: the numbers on top (course, streak, gems, daily goal), then the path of the chosen course, the
/// quests, or the review by typing as before. A course is one of the shipped ones or the lessons of a material of the
/// student; every finished round records XP, streak, gems and quests, and a round of a material grades the cards that
/// were due.
struct LearnHomeView: View {
    let select: (AppTab) -> Void

    @Query(sort: \ReviewCard.createdAt) private var cards: [ReviewCard]
    @Query private var materials: [StudyMaterial]
    @Environment(\.modelContext) private var context
    @Environment(\.horizontalSizeClass) private var sizeClass
    @EnvironmentObject private var progress: LearnProgressStore
    @EnvironmentObject private var quests: QuestStore
    @EnvironmentObject private var settings: AppSettings
    @AppStorage("learn.course") private var storedCourse = ""
    @AppStorage("learn.mode") private var storedMode = Mode.path.rawValue
    @AppStorage("learn.haptics") private var haptics = true
    @StateObject private var generator = MaterialGenerator()
    @StateObject private var fetcher = DistractorFetcher()
    @State private var run: LessonRun?
    @State private var showCourses = false
    @State private var showShop = false
    @State private var tipUnit: CourseUnit?
    @State private var notice: String?

    /// The shipped courses, read once: building a course is not free.
    private static let shipped = CourseCatalog.courses

    enum Mode: String, CaseIterable {
        case path, quests, practice

        var title: String {
            switch self {
            case .path: return "Pfad"
            case .quests: return "Quests"
            case .practice: return "Wiederholen"
            }
        }
    }

    /// A round as it was when the student started it.
    private struct LessonRun: Identifiable {
        enum Content {
            /// A step of a shipped course: its exercises come ready.
            case course(lessonID: String, exercises: [LearnExercise])
            /// A lesson of a material: the cards, which of them were due, and what the exercises are made of.
            case cards(cards: [CardSnapshot], dueKeys: Set<String>, deck: [CardSnapshot], distractors: [String: [String]])
        }

        let id = UUID()
        let courseID: String
        let kind: NodeKind
        let content: Content
    }

    /// What the cards make: a course for each material with enough of them.
    private struct Library {
        var snapshots: [CardSnapshot]
        var entries: [(course: Course, unit: LearnUnit)]
    }

    /// The material cards without a material have no row of their own in the library.
    private static let otherRowID = UUID(uuid: (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1))

    private var compact: Bool { sizeClass == .compact }
    private var mode: Mode { Mode(rawValue: storedMode) ?? .path }

    var body: some View {
        let library = makeLibrary()
        let course = activeCourse(in: library)
        return VStack(spacing: 0) {
            statsBar(course: course)
            Picker("Ansicht", selection: Binding(get: { mode }, set: { storedMode = $0.rawValue })) {
                ForEach(Mode.allCases, id: \.self) { Text($0.title).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(maxWidth: 420)
            .padding(.horizontal, compact ? 16 : 28)
            .padding(.bottom, 8)
            content(course: course, library: library)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .fullScreenCover(item: $run) { lesson in
            lessonView(lesson)
                .environmentObject(progress)
        }
        .sheet(isPresented: $showCourses) { picker(library: library, selected: course?.id ?? "") }
        .sheet(item: $tipUnit) { unit in
            if let course { UnitTipSheet(unit: unit, course: course) }
        }
        .sheet(isPresented: $showShop) {
            ShopSheet(gems: progress.progress.gems, freezes: progress.progress.freezes, onBuyFreeze: { progress.buyFreeze() })
        }
        .alert(
            "Truhe",
            isPresented: Binding(get: { notice != nil }, set: { if !$0 { notice = nil } }),
            actions: { Button("Weiter") {} },
            message: { Text(notice ?? "") }
        )
        .task(id: fetchID(course, library)) {
            guard let course, MaterialCourse.isMaterialCourse(course.id) else { return }
            await fetcher.refresh(deck: library.snapshots, settings: settings)
        }
        .onAppear { quests.refresh(now: Date(), calendar: .current) }
    }

    // MARK: Pieces

    private func statsBar(course: Course?) -> some View {
        let now = Date()
        let state = progress.progress
        return LearnStatsBar(
            course: course,
            courseXP: course.map { state.xp(inCourse: $0.id) } ?? 0,
            streak: state.currentStreak(now: now, calendar: .current),
            gems: state.gems,
            xpToday: state.xpToday(now: now, calendar: .current),
            goal: state.dailyGoal,
            onCourse: { showCourses = true },
            onStreak: { storedMode = Mode.quests.rawValue },
            onGems: { showShop = true },
            onGoal: { progress.setDailyGoal($0) },
            haptics: $haptics
        )
        .padding(.horizontal, compact ? 16 : 28)
        .padding(.top, compact ? 6 : 14)
    }

    @ViewBuilder
    private func content(course: Course?, library: Library) -> some View {
        switch mode {
        case .practice:
            ReviewTypingView()
        case .quests:
            let now = Date()
            QuestsView(
                board: quests.board,
                gems: progress.progress.gems,
                freezes: progress.progress.freezes,
                secondsLeft: QuestBoard.secondsUntilNextDay(now: now, calendar: .current),
                onClaim: { id in progress.addGems(quests.claim(id)) },
                onBuyFreeze: { progress.buyFreeze() }
            )
        case .path:
            if let course {
                CoursePathView(
                    course: course,
                    units: CoursePath.units(of: course, completed: progress.progress.completedLessons),
                    tiles: tiles(),
                    onStep: { start($0, in: course, library: library) },
                    onTip: { tipUnit = $0 },
                    onQuests: { storedMode = Mode.quests.rawValue },
                    footer: {
                        Button("Anderen Kurs wählen") { showCourses = true }
                            .buttonStyle(QuillOutlineButtonStyle(height: 44, fontSize: 14, weight: .medium))
                    }
                )
            } else {
                noCourse
            }
        }
    }

    private var noCourse: some View {
        VStack(spacing: 14) {
            PipLogo(pixel: 6)
            Text("Such dir einen Kurs aus")
                .font(.work(28, .semibold))
                .tracking(-0.7)
                .foregroundStyle(Quill.ink)
                .padding(.top, 6)
            Text("Sprachen, Mathe, Schach, Musik oder dein eigenes Material: Pip macht daraus kurze Lektionen mit XP, Serie und Quests.")
                .font(.work(15.5))
                .lineSpacing(5)
                .multilineTextAlignment(.center)
                .foregroundStyle(Quill.muted)
                .frame(maxWidth: 440)
                .fixedSize(horizontal: false, vertical: true)
            Button("Kurs wählen") { showCourses = true }
                .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 15))
                .padding(.top, 8)
        }
        .padding(.horizontal, 32)
        .padding(.bottom, 60)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func tiles() -> PathTiles {
        let board = quests.board
        let weekly = board.weekly
        return PathTiles(
            questsDone: board.daily.filter(\.isDone).count,
            questsTotal: board.daily.count,
            secondsLeft: QuestBoard.secondsUntilNextDay(now: Date(), calendar: .current),
            weekText: weekly.map { "\(min($0.progress, $0.target)) von \($0.target)" } ?? "",
            weekFraction: weekly?.fraction ?? 0,
            hasUnclaimed: board.hasUnclaimed
        )
    }

    private func picker(library: Library, selected: String) -> some View {
        let all = Dictionary((LearnHomeView.shipped + library.entries.map(\.course)).map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let completed = progress.progress.completedLessons
        return CoursePickerSheet(
            courses: LearnHomeView.shipped,
            materials: materialRows(library),
            selectedID: selected,
            fraction: { id in all[id].map { CoursePath.fraction(of: $0, completed: completed) } ?? 0 },
            xp: { progress.progress.xp(inCourse: $0) },
            canGenerate: settings.demoMode || settings.hasKey(for: settings.plan.provider),
            generatingID: generator.busyID,
            message: generatorMessage,
            onSelect: { id in
                storedCourse = id
                storedMode = Mode.path.rawValue
            },
            onCreate: { create($0) },
            onLibrary: {
                showCourses = false
                select(.library)
            }
        )
    }

    // MARK: Courses

    private func makeLibrary() -> Library {
        let snapshots = cards.map(\.snapshot)
        let units = LearnPath.units(from: snapshots, completed: progress.progress.completedLessons)
        let entries = units.filter { $0.cards.count >= LearnPath.minimumCards }.map { unit in
            (course: MaterialCourse.course(for: unit, title: title(of: unit)), unit: unit)
        }
        return Library(snapshots: snapshots, entries: entries)
    }

    private func title(of unit: LearnUnit) -> String {
        guard let id = unit.materialID, let material = materials.first(where: { $0.id == id }) else {
            return LearnPath.otherUnitTitle
        }
        return material.title
    }

    private func activeCourse(in library: Library) -> Course? {
        LearnHomeView.shipped.first { $0.id == storedCourse } ?? library.entries.first { $0.course.id == storedCourse }?.course
    }

    private func materialRows(_ library: Library) -> [MaterialRow] {
        var rows = materials.sorted { $0.title.localizedStandardCompare($1.title) == .orderedAscending }.map { material in
            let entry = library.entries.first { $0.unit.materialID == material.id }
            return MaterialRow(
                id: material.id, title: material.title, cardCount: library.snapshots.filter { $0.materialID == material.id }.count,
                courseID: entry?.course.id, lessons: entry?.unit.lessons.count ?? 0
            )
        }
        if let other = library.entries.first(where: { $0.unit.materialID == nil }) {
            rows.append(MaterialRow(
                id: LearnHomeView.otherRowID, title: LearnPath.otherUnitTitle, cardCount: other.unit.cards.count,
                courseID: other.course.id, lessons: other.unit.lessons.count
            ))
        }
        return rows
    }

    /// The same while nothing changes in what the model is asked: the course, and how many cards there are.
    private func fetchID(_ course: Course?, _ library: Library) -> String {
        "\(course?.id ?? "")|\(library.snapshots.count)"
    }

    // MARK: Material

    private var generatorMessage: String {
        switch generator.state {
        case .idle: return ""
        case let .running(done, total): return "Pip liest das Material: Abschnitt \(done) von \(total)"
        case let .failed(text), let .finished(text): return text
        }
    }

    private func create(_ id: UUID) {
        guard let material = materials.first(where: { $0.id == id }), !generator.isBusy else { return }
        Task { await generator.generate(material: material, cards: cards, context: context, settings: settings) }
    }

    // MARK: Rounds

    private func start(_ step: PathStep, in course: Course, library: Library) {
        guard step.state != .locked, run == nil else { return }
        let node = step.node
        if node.kind == .chest {
            openChest(node)
            return
        }
        if MaterialCourse.isMaterialCourse(course.id) {
            guard let unit = library.entries.first(where: { $0.course.id == course.id })?.unit,
                  let lesson = MaterialCourse.lesson(for: node, in: unit) else { return }
            run = LessonRun(
                courseID: course.id, kind: node.kind,
                content: .cards(
                    cards: lesson.cards, dueKeys: LearnPath.dueKeys(lesson.cards, at: Date()), deck: library.snapshots,
                    distractors: fetcher.distractors
                )
            )
        } else {
            guard let provider = CourseCatalog.provider(for: course.id) else { return }
            let exercises = provider.exercises(for: node, seed: UInt64.random(in: 1...UInt64.max))
            guard !exercises.isEmpty else { return }
            run = LessonRun(courseID: course.id, kind: node.kind, content: .course(lessonID: node.id, exercises: exercises))
        }
    }

    private func openChest(_ node: CourseNode) {
        guard !progress.progress.isCompleted(node.id) else { return }
        let gems = CoursePath.chestGems(node)
        if progress.openChest(node.id, gems: gems) {
            notice = "Du hast \(gems) Gems gefunden."
        }
    }

    @ViewBuilder
    private func lessonView(_ lesson: LessonRun) -> some View {
        switch lesson.content {
        case let .course(lessonID, exercises):
            LessonView(lessonID: lessonID, exercises: exercises) { finish($0, lesson) }
        case let .cards(cards, dueKeys, deck, distractors):
            LessonView(cards: cards, dueKeys: dueKeys, deck: deck, distractors: distractors) { finish($0, lesson) }
        }
    }

    /// Records the round once (a run the store has seen before counts for nothing), grades the due cards of a material's
    /// lesson, and tells the quests. What it brought goes to the end screen.
    private func finish(_ result: LessonResult, _ lesson: LessonRun) -> LessonRewards {
        let now = Date()
        let calendar = Calendar.current
        guard let reward = progress.record(result, courseID: lesson.courseID, now: now, calendar: calendar) else {
            return LessonRewards()
        }
        if case let .cards(_, dueKeys, _, _) = lesson.content {
            let byKey = Dictionary(cards.map { ($0.snapshot.key, $0) }, uniquingKeysWith: { first, _ in first })
            for (key, grade) in LessonGrading.gradesToApply(result, dueKeys: dueKeys) {
                byKey[key]?.apply(grade, at: now)
            }
        }
        let event = QuestEvent(
            xp: reward.xp, courseID: lesson.courseID, nodeKind: lesson.kind, rightFirstTry: result.rightFirstTry,
            exerciseCount: result.exerciseCount
        )
        let finished = quests.record(event, now: now, calendar: calendar)
        return LessonRewards(
            gems: reward.gems, quests: finished.map(\.title), freezesUsed: reward.freezesUsed, streakExtended: reward.streakExtended
        )
    }
}

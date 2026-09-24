import SwiftData
import SwiftUI

struct PlanDetailView: View {
    let plan: StudyPlan

    @Environment(\.dismiss) private var dismiss
    @Query private var materials: [StudyMaterial]
    @State private var expanded: PersistentIdentifier?

    private let calendar = Calendar.current

    var body: some View {
        VStack(spacing: 0) {
            DetailHeader(backTitle: "Lernplan", title: plan.title, onBack: { dismiss() }) {
                Button("Ab heute neu verteilen", action: reschedule)
                    .buttonStyle(QuillOutlineButtonStyle(weight: .medium))
            }
            ScrollView {
                ContentColumn(top: 36) {
                    progressHeader
                    PlanTools(plan: plan)
                    if plan.isOverbooked {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            StatusDot(color: Quill.warn)
                                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 2 }
                            Text("Bei \(plan.minutesPerDay) Minuten pro Tag passt der Stoff nicht bis zur Prüfung. Erhöh die tägliche Lernzeit oder streich Themen.")
                                .font(.work(14))
                                .lineSpacing(4)
                                .foregroundStyle(Quill.muted)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.vertical, 16)
                        .padding(.horizontal, 2)
                        .overlay(alignment: .bottom) { QuillDivider() }
                    }
                    ForEach(days, id: \.self) { day in
                        VStack(alignment: .leading, spacing: 4) {
                            PixelCaption(text: title(for: day))
                            ForEach(topics(on: day)) { topic in
                                TopicRow(
                                    topic: topic,
                                    material: material(for: topic),
                                    expanded: expanded == topic.persistentModelID,
                                    onExpand: {
                                        withAnimation(.easeInOut(duration: 0.2)) {
                                            expanded = expanded == topic.persistentModelID ? nil : topic.persistentModelID
                                        }
                                    }
                                )
                            }
                        }
                        .padding(.top, 28)
                    }
                }
            }
            .scrollIndicators(.hidden)
        }
        .background(Quill.bg.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }

    private var progressHeader: some View {
        let done = plan.topics.filter(\.isDone).count
        let total = plan.topics.count
        let daysLeft = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: .now),
            to: calendar.startOfDay(for: plan.examDate)
        ).day ?? 0
        return VStack(alignment: .leading, spacing: 10) {
            Text("\(done) von \(total) Themen erledigt")
                .font(.work(30, .light))
                .tracking(-0.75)
                .foregroundStyle(Quill.ink)
            QuillProgressBar(fraction: total == 0 ? 0 : Double(done) / Double(total))
                .padding(.top, 6)
            Text("Prüfung am \(plan.examDate.formatted(date: .long, time: .omitted)) · noch \(max(daysLeft, 0)) Tage")
                .font(.work(13))
                .foregroundStyle(Quill.faint)
        }
        .padding(.bottom, 26)
        .overlay(alignment: .bottom) { QuillDivider() }
    }

    private var days: [Date] {
        Set(plan.topics.map { calendar.startOfDay(for: $0.scheduledDate) }).sorted()
    }

    private func topics(on day: Date) -> [PlanTopic] {
        plan.topics
            .filter { calendar.isDate($0.scheduledDate, inSameDayAs: day) }
            .sorted { $0.order < $1.order }
    }

    private func material(for topic: PlanTopic) -> StudyMaterial? {
        materials.first { $0.id == topic.materialID }
    }

    private func title(for day: Date) -> String {
        if calendar.isDateInToday(day) { return "Heute" }
        if calendar.isDateInTomorrow(day) { return "Morgen" }
        let formatted = day.formatted(.dateTime.weekday(.wide).day().month(.wide))
        return day < calendar.startOfDay(for: .now) ? "Offen seit \(formatted)" : formatted
    }

    /// Missed days happen; this moves every open topic forward from today without losing the order.
    private func reschedule() {
        let open = plan.topics.filter { !$0.isDone }.sorted { $0.order < $1.order }
        let dates = PlanScheduler.assignDates(
            minutes: open.map(\.estimatedMinutes),
            start: .now,
            minutesPerDay: plan.minutesPerDay,
            calendar: calendar
        )
        withAnimation {
            for (topic, date) in zip(open, dates) {
                topic.scheduledDate = date
            }
            plan.isOverbooked = PlanScheduler.isOverbooked(dates: dates, examDate: plan.examDate, calendar: calendar)
        }
        PlanNotifications.update(plan)
    }
}

private struct TopicRow: View {
    let topic: PlanTopic
    let material: StudyMaterial?
    let expanded: Bool
    let onExpand: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            row
            if expanded {
                TopicExtras(topic: topic, material: material)
                    .padding(.leading, 36)
                    .padding(.bottom, 16)
                    .transition(.opacity)
            }
        }
        .overlay(alignment: .bottom) { QuillDivider() }
    }

    private var row: some View {
        HStack(alignment: .top, spacing: 14) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { topic.isDone.toggle() }
                if let plan = topic.plan { PlanNotifications.update(plan) }
            } label: {
                CheckCircle(isOn: topic.isDone)
                    .padding(.top, 1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(topic.isDone ? "Als offen markieren" : "Als erledigt markieren")

            if let material {
                NavigationLink(value: Route.document(
                    material,
                    startPage: max(0, (topic.sourcePages.min() ?? 1) - 1),
                    backTitle: "Lernplan"
                )) {
                    details
                }
                .buttonStyle(.plain)
            } else {
                details
            }
        }
        .padding(.vertical, 15)
        .padding(.horizontal, 2)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(topic.title)
                .font(.work(16))
                .tracking(-0.16)
                .strikethrough(topic.isDone, color: Quill.faint)
                .foregroundStyle(topic.isDone ? Quill.faint : Quill.ink)
            Text(topic.summary)
                .font(.work(14))
                .lineSpacing(3)
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 14) {
                Text("\(topic.estimatedMinutes) min")
                if !topic.pagesLabel.isEmpty {
                    Text(topic.pagesLabel)
                }
                Spacer(minLength: 8)
                Button(action: onExpand) {
                    Text(expanded ? "Lernhilfen ▴" : "Lernhilfen ▾")
                        .font(.work(13, .medium))
                        .foregroundStyle(Quill.link)
                        .padding(.vertical, 4)
                }
                .buttonStyle(.plain)
            }
            .font(.work(12.5))
            .foregroundStyle(Quill.faint)
            .padding(.top, 2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .multilineTextAlignment(.leading)
        .contentShape(Rectangle())
    }
}

/// The daily reminder and the calendar export of a plan.
private struct PlanTools: View {
    @Bindable var plan: StudyPlan

    @State private var exported: ExportedFile?
    @State private var permissionDenied = false

    private static let defaultMinute = 17 * 60

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            QuillRow(label: "Tägliche Erinnerung", verticalPadding: 10) {
                Toggle("", isOn: Binding(get: { plan.reminderMinute != nil }, set: setReminder))
                    .labelsHidden()
                    .tint(Quill.accent)
            }
            if let minute = plan.reminderMinute {
                QuillRow(label: "Um \(String(format: "%02d:%02d", minute / 60, minute % 60)) Uhr", verticalPadding: 10) {
                    QuillStepper(
                        onMinus: { change((minute - 15 + 24 * 60) % (24 * 60)) },
                        onPlus: { change((minute + 15) % (24 * 60)) }
                    )
                }
            }
            if permissionDenied {
                Text("Ohne die Erlaubnis für Mitteilungen kann Schul-PIP nicht erinnern. Du kannst sie in den iOS-Einstellungen unter Mitteilungen erteilen.")
                    .font(.work(14))
                    .foregroundStyle(Quill.ink2)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.vertical, 12)
                    .padding(.horizontal, 2)
            }
            QuillRow(label: "Termine im Kalender", verticalPadding: 10) {
                Button("Als .ics teilen", action: exportCalendar)
                    .buttonStyle(QuillOutlineButtonStyle())
            }
            Text("Die Kalenderdatei enthält jedes Thema an seinem Lerntag und den Prüfungstermin – die Kalender-App, Google Kalender und Outlook können sie importieren. Nach „Ab heute neu verteilen“ einfach neu teilen.")
                .quillFootnote()
        }
        .padding(.bottom, 16)
        .overlay(alignment: .bottom) { QuillDivider() }
        .sheet(item: $exported) { file in
            ShareSheet(url: file.url)
        }
    }

    private func setReminder(_ on: Bool) {
        guard on else {
            change(nil)
            return
        }
        Task { @MainActor in
            if await PlanNotifications.requestPermission() {
                permissionDenied = false
                change(Self.defaultMinute)
            } else {
                permissionDenied = true
            }
        }
    }

    private func change(_ minute: Int?) {
        plan.reminderMinute = minute
        PlanNotifications.update(plan)
    }

    private func exportCalendar() {
        let text = PlanCalendar.ics(
            planKey: PlanNotifications.key(for: plan),
            title: plan.title,
            examDate: plan.examDate,
            topics: plan.topics.map(\.reminderItem)
        )
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent("Exports", isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let name = plan.title.components(separatedBy: CharacterSet(charactersIn: "/\\:?*\"<>|")).joined().trimmingCharacters(in: .whitespaces)
        let url = directory.appendingPathComponent("\(name.isEmpty ? "Lernplan" : name).ics")
        guard (try? Data(text.utf8).write(to: url, options: .atomic)) != nil else { return }
        exported = ExportedFile(url: url)
    }
}

/// Videos, Wikipedia, exercises and flashcards for one topic.
private struct TopicExtras: View {
    @Bindable var topic: PlanTopic
    let material: StudyMaterial?

    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Environment(\.openURL) private var openURL
    @State private var busy: String?
    @State private var problem: String?
    @State private var revealed: Set<String> = []

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Button("▶ Videos") {
                        if let url = StudyAids.videoURL(title: topic.title, suggestion: topic.videoQuery) { openURL(url) }
                    }
                    Button("Wikipedia") { run("Wikipedia", lookUp) }
                        .disabled(busy != nil)
                    Button(topic.exercises.isEmpty ? "Übungsaufgaben" : "Neue Aufgaben") { run("Übungsaufgaben", makeExercises) }
                        .disabled(busy != nil)
                    Button("Karteikarten") { run("Karteikarten", makeCards) }
                        .disabled(busy != nil)
                }
                .buttonStyle(QuillOutlineButtonStyle())
            }
            if let busy {
                HStack(spacing: 10) {
                    PulsingDots()
                    Text(busy == "Wikipedia" ? "Suche auf Wikipedia …" : "Die KI schreibt \(busy) …")
                        .font(.work(13))
                        .foregroundStyle(Quill.muted)
                }
            }
            if let problem {
                HStack(alignment: .firstTextBaseline, spacing: 9) {
                    StatusDot(color: Quill.warn)
                    Text(problem)
                        .font(.work(14))
                        .foregroundStyle(Quill.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            if topic.cardCount > 0 {
                Text(topic.cardCount == 1 ? "1 Karteikarte liegt im Wiederholen-Stapel." : "\(topic.cardCount) Karteikarten liegen im Wiederholen-Stapel.")
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
            }
            if !topic.wikiText.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    PixelCaption(text: "Wikipedia · \(topic.wikiTitle)")
                    Text(topic.wikiText)
                        .font(.work(14))
                        .lineSpacing(3)
                        .foregroundStyle(Quill.ink2)
                        .fixedSize(horizontal: false, vertical: true)
                    if let url = URL(string: topic.wikiURL) {
                        Button("Ganzen Artikel lesen") { openURL(url) }
                            .font(.work(13.5, .medium))
                            .foregroundStyle(Quill.link)
                            .buttonStyle(.plain)
                    }
                }
            }
            let exercises = topic.exercises
            if !exercises.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    PixelCaption(text: "Übungsaufgaben")
                    ForEach(Array(exercises.enumerated()), id: \.offset) { index, exercise in
                        exerciseView(index, exercise)
                    }
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Quill.hoverSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
    }

    private func exerciseView(_ index: Int, _ exercise: Exercise) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("\(index + 1). \(exercise.question)")
                .font(.work(14.5))
                .foregroundStyle(Quill.ink)
                .fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 12) {
                if !exercise.hint.isEmpty {
                    toggle("hint\(index)", on: "Tipp ausblenden", off: "Tipp")
                }
                toggle("solution\(index)", on: "Lösung ausblenden", off: "Lösung zeigen")
            }
            if revealed.contains("hint\(index)") {
                Text("Tipp: \(exercise.hint)")
                    .font(.work(13.5))
                    .foregroundStyle(Quill.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if revealed.contains("solution\(index)") {
                Text(exercise.solution)
                    .font(.work(13.5))
                    .foregroundStyle(Quill.ink2)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func toggle(_ key: String, on: String, off: String) -> some View {
        Button(revealed.contains(key) ? on : off) {
            if revealed.contains(key) { revealed.remove(key) } else { revealed.insert(key) }
        }
        .font(.work(13, .medium))
        .foregroundStyle(Quill.link)
        .buttonStyle(.plain)
    }

    private func run(_ label: String, _ work: @escaping @MainActor () async throws -> Void) {
        guard busy == nil else { return }
        busy = label
        problem = nil
        Task { @MainActor in
            do {
                try await work()
            } catch {
                problem = error.localizedDescription
            }
            busy = nil
        }
    }

    private func pages() async -> String {
        guard let material else { return "" }
        let texts = await MaterialTextIndex.shared.index([material.fileName])[material.fileName]
        return StudyAids.pagesText(sourcePages: topic.sourcePages, pageTexts: texts)
    }

    @MainActor
    private func lookUp() async throws {
        guard let article = try await WikipediaClient().summary(topic.title) else {
            throw StudyAidError.nothingOnWikipedia
        }
        topic.wikiTitle = article.title
        topic.wikiURL = article.url
        topic.wikiText = article.text
    }

    @MainActor
    private func makeExercises() async throws {
        let assistant = TopicAssistant(client: settings.makeClient(for: .plan))
        let exercises = try await assistant.exercises(title: topic.title, summary: topic.summary, pagesLabel: topic.pagesLabel, pages: await pages())
        revealed = []
        topic.exercises = exercises
    }

    @MainActor
    private func makeCards() async throws {
        let assistant = TopicAssistant(client: settings.makeClient(for: .plan))
        let cards = try await assistant.flashcards(title: topic.title, summary: topic.summary, pagesLabel: topic.pagesLabel, pages: await pages())
        let page = topic.sourcePages.min()
        for card in cards {
            modelContext.insert(ReviewCard(front: card.front, back: card.back, materialID: topic.materialID, page: page))
        }
        topic.cardCount += cards.count
    }
}

private enum StudyAidError: LocalizedError {
    case nothingOnWikipedia

    var errorDescription: String? {
        "Wikipedia hat keinen passenden Artikel gefunden."
    }
}

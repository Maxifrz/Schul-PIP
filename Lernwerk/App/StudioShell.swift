import SwiftData
import SwiftUI

/// The areas of the app in the three groups the Studio layout shows as segmented switches.
enum StudioNav {
    struct Cluster: Identifiable {
        let label: String
        let tabs: [AppTab]
        var id: String { label }
    }

    static let clusters = [
        Cluster(label: "Lernen", tabs: [.library, .plans, .review]),
        Cluster(label: "Organisieren", tabs: [.calendar]),
        Cluster(label: "Werkzeuge", tabs: [.calculator, .presentations]),
    ]
}

private struct StudioRailKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True while the Studio rail is on screen next to the content, which then leaves the "continue" row and the
    /// preview to it.
    var studioRailOn: Bool {
        get { self[StudioRailKey.self] }
        set { self[StudioRailKey.self] = newValue }
    }
}

/// The Studio layout: a dark "today" rail on the left in landscape (a strip on top in portrait), the areas as
/// grouped switches above the content, and the Pip jump bar. Documents and the calculator take the whole screen
/// the way they need it.
struct StudioShell<Content: View>: View {
    @Binding var selection: AppTab
    let dueCount: Int
    let openDocument: (StudyMaterial, Int?) -> Void
    @ViewBuilder var content: Content

    var body: some View {
        GeometryReader { geometry in
            let landscape = geometry.size.width > geometry.size.height
            let railOn = landscape && selection != .calculator
            let stripOn = !landscape && selection != .calculator
            HStack(spacing: 0) {
                if railOn {
                    StudioRail(dueCount: dueCount, select: select, openDocument: openDocument)
                        .frame(width: 300)
                        .background(Quill.rail.ignoresSafeArea(edges: .bottom))
                        .transition(.move(edge: .leading))
                }
                VStack(spacing: 0) {
                    StudioTopBar(selection: $selection, reviewBadge: dueCount, portrait: !landscape)
                    if stripOn {
                        StudioStrip(dueCount: dueCount, select: select)
                    }
                    content
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .environment(\.studioRailOn, railOn)
                }
            }
            .animation(.easeOut(duration: 0.2), value: railOn)
        }
    }

    private func select(_ tab: AppTab) {
        withAnimation(.easeOut(duration: 0.2)) { selection = tab }
    }
}

// MARK: - Top bar

private struct StudioTopBar: View {
    @Binding var selection: AppTab
    let reviewBadge: Int
    let portrait: Bool

    var body: some View {
        HStack(alignment: .bottom, spacing: portrait ? 8 : 14) {
            if portrait {
                PipLogo(pixel: 1.8)
                    .frame(width: 44, height: 36)
                    .background(Quill.rail, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            ScrollView(.horizontal) {
                HStack(alignment: .bottom, spacing: portrait ? 8 : 14) {
                    ForEach(StudioNav.clusters) { cluster in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(cluster.label.uppercased())
                                .font(.mono(9, .medium))
                                .tracking(0.9)
                                .foregroundStyle(Quill.faint)
                                .padding(.leading, 4)
                            HStack(spacing: 2) {
                                ForEach(cluster.tabs) { tab in segment(tab) }
                            }
                            .padding(3)
                            .background(Quill.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.line, lineWidth: 1))
                        }
                    }
                }
            }
            .scrollIndicators(.hidden)
            Button {
                withAnimation(.easeOut(duration: 0.2)) { selection = .settings }
            } label: {
                Text(AppTab.settings.title)
                    .font(.work(13, .semibold))
                    .foregroundStyle(selection == .settings ? Quill.onAccent : Quill.ink)
                    .padding(.horizontal, 14)
                    .frame(height: 38)
                    .background(selection == .settings ? Quill.accent : Color.clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.line, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, portrait ? 14 : 22)
        .padding(.vertical, 12)
        .background(Quill.surface)
        .overlay(alignment: .bottom) { QuillDivider() }
    }

    private func segment(_ tab: AppTab) -> some View {
        let on = tab == selection
        return Button {
            withAnimation(.easeOut(duration: 0.2)) { selection = tab }
        } label: {
            HStack(spacing: 7) {
                Text(tab.title)
                    .font(.work(13.5, .semibold))
                    .lineLimit(1)
                if tab == .review, reviewBadge > 0 {
                    Text("\(reviewBadge)")
                        .font(.mono(10, .semibold))
                        .foregroundStyle(Quill.onAccent)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .frame(minWidth: 18)
                        .background(Quill.warn, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                }
            }
            .foregroundStyle(on ? Quill.onAccent : Quill.ink)
            .padding(.horizontal, portrait ? 11 : 14)
            .frame(height: 32)
            .background(on ? Quill.accent : Color.clear, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
            .contentShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

// MARK: - Live data

/// What the rail and the strip read from the study plans and the Klausurenplan.
private enum StudioData {
    static func todayTopics(_ plans: [StudyPlan]) -> [PlanTopic] {
        let calendar = Calendar.current
        return plans.flatMap(\.topics)
            .filter { calendar.isDateInToday($0.scheduledDate) }
            .sorted { $0.order < $1.order }
    }

    static func exam(plans: [StudyPlan], exams: [Exam]) -> StudioToday.ExamSummary? {
        let infos = plans.map { plan in
            StudioToday.PlanInfo(
                examDay: day(plan.examDate),
                done: plan.topics.sorted { $0.order < $1.order }.map(\.isDone)
            )
        }
        return StudioToday.examSummary(plans: infos, exams: exams.map { day($0.date) }, today: .today())
    }

    static func day(_ date: Date) -> CalendarDay {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return CalendarDay(year: parts.year ?? 1970, month: parts.month ?? 1, day: parts.day ?? 1)
    }

    static func minuteOfDay(_ date: Date) -> Int {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }
}

// MARK: - Rail

private struct StudioRail: View {
    let dueCount: Int
    let select: (AppTab) -> Void
    let openDocument: (StudyMaterial, Int?) -> Void

    @Query private var plans: [StudyPlan]
    @Query private var timetable: [TimetableEntry]
    @Query private var exams: [Exam]
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]
    @State private var omni = ""

    private var library: [StudyMaterial] { materials.filter { !$0.isTrashed } }

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            GeometryReader { geometry in
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        omniBar
                            .zIndex(1)
                        todaySection(now: timeline.date)
                        nextTopics
                        if dueCount > 0 { cardsDue }
                        examCard
                        Spacer(minLength: 0)
                        continueCard
                    }
                    .padding(.horizontal, 18)
                    .padding(.top, 6)
                    .padding(.bottom, 16)
                    .frame(minHeight: geometry.size.height)
                }
                .scrollBounceBehavior(.basedOnSize)
                .scrollIndicators(.hidden)
            }
        }
        .foregroundStyle(Quill.railInk)
    }

    // Jump bar

    private var omniResults: [StudioToday.OmniEntry] {
        let areas = (StudioNav.clusters.flatMap(\.tabs) + [AppTab.settings]).map {
            StudioToday.OmniEntry(id: $0.rawValue, label: $0.title, kind: .area)
        }
        let documents = library.map { StudioToday.OmniEntry(id: $0.id.uuidString, label: $0.title, kind: .document) }
        return StudioToday.omni(query: omni, areas: areas, documents: documents)
    }

    private var omniBar: some View {
        HStack(spacing: 10) {
            PipLogo(pixel: 2)
            TextField("", text: $omni, prompt: Text("Frag Pip oder springe zu …").foregroundStyle(Quill.railMuted))
                .font(.work(14, .medium))
                .foregroundStyle(Quill.railInk)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.go)
                .onSubmit { if let first = omniResults.first { jump(first) } }
            Text("/")
                .font(.mono(10, .medium))
                .foregroundStyle(Quill.railMuted)
                .padding(.horizontal, 5)
                .padding(.vertical, 3)
                .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).stroke(Quill.railLine, lineWidth: 1))
        }
        .padding(.leading, 12)
        .padding(.trailing, 14)
        .frame(height: 46)
        .background(Quill.railSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.railLine, lineWidth: 1))
        .overlay(alignment: .topLeading) {
            if !omni.trimmingCharacters(in: .whitespaces).isEmpty {
                omniList.offset(y: 52)
            }
        }
    }

    private var omniList: some View {
        let results = omniResults
        return VStack(spacing: 0) {
            ForEach(results) { entry in
                Button { jump(entry) } label: {
                    HStack(spacing: 10) {
                        Text(entry.label)
                            .font(.work(13.5, .medium))
                            .lineLimit(1)
                        Spacer(minLength: 6)
                        Text(entry.kindLabel)
                            .font(.mono(10, .medium))
                            .foregroundStyle(Quill.faint)
                    }
                    .foregroundStyle(Quill.ink)
                    .padding(.horizontal, 10)
                    .frame(height: 38)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            if results.isEmpty {
                Text("Pip hat dazu nichts gefunden.")
                    .font(.work(13, .medium))
                    .foregroundStyle(Quill.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(10)
            }
        }
        .padding(6)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .shadow(color: .black.opacity(0.35), radius: 16, y: 8)
    }

    private func jump(_ entry: StudioToday.OmniEntry) {
        omni = ""
        switch entry.kind {
        case .area:
            if let tab = AppTab(rawValue: entry.id) { select(tab) }
        case .document:
            if let material = library.first(where: { $0.id.uuidString == entry.id }) {
                openDocument(material, material.lastOpenedPage)
            }
        }
    }

    // Today

    private func todaySection(now: Date) -> some View {
        let day = CalendarDay.today()
        let minute = StudioData.minuteOfDay(now)
        let lessons = timetable
            .filter { $0.weekday == day.weekday }
            .map { StudioToday.Lesson(subject: $0.subject, room: $0.room, start: $0.startMinute, end: $0.endMinute) }
        return VStack(alignment: .leading, spacing: 12) {
            Text(StudioToday.caption(day: day, minute: minute))
                .font(.mono(10, .medium))
                .tracking(0.8)
                .foregroundStyle(Quill.railMuted)
            PixelCard(lines: StudioToday.lines(now: minute, lessons: lessons))
        }
    }

    private var nextTopics: some View {
        let topics = Array(StudioData.todayTopics(plans).prefix(4))
        return VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .firstTextBaseline) {
                Text("ALS NÄCHSTES")
                    .font(.mono(10, .medium))
                    .tracking(0.8)
                    .foregroundStyle(Quill.railMuted)
                Spacer()
                Button { select(.plans) } label: {
                    Text("Lernplan")
                        .font(.work(12, .semibold))
                        .underline()
                        .foregroundStyle(Quill.railMuted)
                }
                .buttonStyle(.plain)
            }
            .padding(.bottom, 8)
            if topics.isEmpty {
                Text("Heute ist nichts geplant.")
                    .font(.work(13.5, .medium))
                    .foregroundStyle(Quill.railMuted)
                    .padding(.vertical, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .overlay(alignment: .top) { Rectangle().fill(Quill.railLine).frame(height: 1) }
            }
            ForEach(topics) { topic in topicRow(topic) }
        }
    }

    private func topicRow(_ topic: PlanTopic) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Button { topic.isDone.toggle() } label: {
                RoundedRectangle(cornerRadius: 5, style: .continuous)
                    .fill(topic.isDone ? Quill.accent : Color.clear)
                    .overlay(
                        RoundedRectangle(cornerRadius: 5, style: .continuous)
                            .stroke(topic.isDone ? Quill.accent : Quill.railInk.opacity(0.4), lineWidth: 1.5)
                    )
                    .overlay {
                        if topic.isDone {
                            Image(systemName: "checkmark")
                                .font(.system(size: 10, weight: .heavy))
                                .foregroundStyle(Quill.onAccent)
                        }
                    }
                    .frame(width: 20, height: 20)
                    .padding(.top, 1)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(topic.isDone ? "Als offen markieren" : "Als erledigt markieren")
            Button {
                if let id = topic.materialID, let material = library.first(where: { $0.id == id }) {
                    openDocument(material, max(0, (topic.sourcePages.min() ?? 1) - 1))
                } else {
                    select(.plans)
                }
            } label: {
                VStack(alignment: .leading, spacing: 4) {
                    Text(topic.title)
                        .font(.work(14.5, .semibold))
                        .strikethrough(topic.isDone)
                        .foregroundStyle(topic.isDone ? Quill.railMuted : Quill.railInk)
                        .multilineTextAlignment(.leading)
                    Text("\(topic.estimatedMinutes) MIN" + (topic.pagesLabel.isEmpty ? "" : " · \(topic.pagesLabel.uppercased())"))
                        .font(.mono(10.5, .medium))
                        .foregroundStyle(Quill.railMuted)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 12)
        .overlay(alignment: .top) { Rectangle().fill(Quill.railLine).frame(height: 1) }
    }

    private var cardsDue: some View {
        Button { select(.review) } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline) {
                    Text("KARTEN FÄLLIG")
                        .font(.mono(10, .medium))
                        .tracking(0.8)
                    Spacer()
                    Text("\(dueCount)")
                        .font(.mono(30, .semibold))
                }
                Text("Üben")
                    .font(.work(13.5, .semibold))
                    .foregroundStyle(Quill.railInk)
                    .frame(maxWidth: .infinity)
                    .frame(height: 38)
                    .background(Quill.rail, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            }
            .foregroundStyle(Quill.onAccent)
            .padding(14)
            .background(Quill.accent, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private var examCard: some View {
        Group {
            if let exam = StudioData.exam(plans: plans, exams: exams) {
                VStack(alignment: .leading, spacing: 0) {
                    Text("PRÜFUNG")
                        .font(.mono(10, .medium))
                        .tracking(0.8)
                        .foregroundStyle(Quill.railMuted)
                    HStack(alignment: .firstTextBaseline, spacing: 10) {
                        Text("\(exam.days)")
                            .font(.mono(40, .semibold))
                        Text("Tage · \(exam.dateLabel)")
                            .font(.work(13, .medium))
                            .foregroundStyle(Quill.railMuted)
                    }
                    .padding(.top, 12)
                    .padding(.bottom, 10)
                    if !exam.blocks.isEmpty {
                        HStack(spacing: 3) {
                            ForEach(Array(exam.blocks.enumerated()), id: \.offset) { _, done in
                                RoundedRectangle(cornerRadius: 2)
                                    .fill(done ? Quill.accent : Quill.railInk.opacity(0.2))
                            }
                        }
                        .frame(height: 6)
                        if let label = exam.progressLabel {
                            Text(label)
                                .font(.work(11.5, .medium))
                                .foregroundStyle(Quill.railMuted)
                                .padding(.top, 9)
                        }
                    }
                }
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.railLine, lineWidth: 1))
            }
        }
    }

    @ViewBuilder
    private var continueCard: some View {
        if let material = library.filter({ $0.lastOpenedAt != nil }).max(by: { ($0.lastOpenedAt ?? .distantPast) < ($1.lastOpenedAt ?? .distantPast) }) {
            Button { openDocument(material, material.lastOpenedPage) } label: {
                HStack(spacing: 12) {
                    RoundedRectangle(cornerRadius: 3)
                        .fill(Subjects.color(material.subject).map { Color(SlideDrawing.uiColor($0)) } ?? Quill.accent)
                        .frame(width: 6, height: 34)
                    VStack(alignment: .leading, spacing: 5) {
                        Text("WEITERLESEN")
                            .font(.mono(10, .medium))
                            .tracking(0.8)
                            .foregroundStyle(Quill.railMuted)
                        Text(material.title)
                            .font(.work(14, .semibold))
                            .lineLimit(1)
                        Text("Weiter bei S. \(material.lastOpenedPage + 1)")
                            .font(.work(12))
                            .foregroundStyle(Quill.railMuted)
                    }
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Quill.railSurface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(Quill.railLine, lineWidth: 1))
            }
            .buttonStyle(.plain)
        }
    }
}

// MARK: - Pixel card

/// A rectangle with stair-stepped corners, like a pixel-art frame; `step` is the size of one pixel.
struct PixelCorners: Shape {
    var step: CGFloat = 3

    func path(in rect: CGRect) -> Path {
        let r = rect
        let s = step
        let points: [CGPoint] = [
            CGPoint(x: 0, y: 2 * s), CGPoint(x: s, y: 2 * s), CGPoint(x: s, y: s), CGPoint(x: 2 * s, y: s), CGPoint(x: 2 * s, y: 0),
            CGPoint(x: r.width - 2 * s, y: 0), CGPoint(x: r.width - 2 * s, y: s), CGPoint(x: r.width - s, y: s),
            CGPoint(x: r.width - s, y: 2 * s), CGPoint(x: r.width, y: 2 * s),
            CGPoint(x: r.width, y: r.height - 2 * s), CGPoint(x: r.width - s, y: r.height - 2 * s),
            CGPoint(x: r.width - s, y: r.height - s), CGPoint(x: r.width - 2 * s, y: r.height - s), CGPoint(x: r.width - 2 * s, y: r.height),
            CGPoint(x: 2 * s, y: r.height), CGPoint(x: 2 * s, y: r.height - s), CGPoint(x: s, y: r.height - s),
            CGPoint(x: s, y: r.height - 2 * s), CGPoint(x: 0, y: r.height - 2 * s),
        ]
        var path = Path()
        path.addLines(points.map { CGPoint(x: $0.x + r.minX, y: $0.y + r.minY) })
        path.closeSubpath()
        return path
    }
}

/// The "today" card: what comes next in the timetable, typed out in the pixel font. Tap to type it again.
private struct PixelCard: View {
    let lines: [StudioToday.PixelLine]
    @State private var typed = 0
    @State private var replay = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The first character index of every line; lines are typed one after the other with a short pause.
    private var spans: [(start: Int, end: Int)] {
        var at = 2
        return lines.map { line in
            let start = at
            at += line.text.count
            let span = (start: start, end: at)
            at += 4
            return span
        }
    }

    private var key: String {
        lines.prefix(2).map(\.text).joined(separator: "|") + "#\(replay)"
    }

    var body: some View {
        Button { replay += 1 } label: {
            VStack(alignment: .leading, spacing: 9) {
                ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                    row(line, span: spans[index], isLast: index == lines.count - 1)
                }
            }
            .padding(16)
            .frame(maxWidth: .infinity, minHeight: 136, alignment: .topLeading)
            .background(Quill.rail)
            .clipShape(PixelCorners())
            .padding(3)
            .background(Quill.accent)
            .clipShape(PixelCorners())
        }
        .buttonStyle(.plain)
        .task(id: key) { await type() }
        .accessibilityLabel(lines.map(\.text).joined(separator: ". "))
    }

    private func row(_ line: StudioToday.PixelLine, span: (start: Int, end: Int), isLast: Bool) -> some View {
        let shown = max(0, min(line.text.count, typed - span.start))
        let cursor = typed >= span.start && (typed < span.end || (isLast && typed >= span.end))
        return HStack(spacing: 5) {
            Text(String(line.text.prefix(shown)))
                .font(.pixel(line.size))
                .tracking(line.size * 0.03)
                .foregroundStyle(color(line.tone))
                .lineLimit(1)
                .fixedSize()
            if cursor {
                TimelineView(.periodic(from: .now, by: 0.5)) { timeline in
                    Rectangle()
                        .fill(Quill.accent)
                        .frame(width: (line.size * 0.6).rounded(), height: line.size)
                        .opacity(Int(timeline.date.timeIntervalSinceReferenceDate * 2) % 2 == 0 ? 1 : 0)
                }
            }
        }
        .frame(minHeight: line.size * 1.15, alignment: .leading)
    }

    private func color(_ tone: StudioToday.Tone) -> Color {
        switch tone {
        case .ink: return Quill.railInk
        case .accent: return Quill.accent
        case .muted: return Quill.railMuted
        }
    }

    @MainActor
    private func type() async {
        let total = (spans.last?.end ?? 0) + 2
        if reduceMotion {
            typed = total
            return
        }
        typed = 0
        while typed < total {
            try? await Task.sleep(nanoseconds: 55_000_000)
            if Task.isCancelled { return }
            typed += 1
        }
    }
}

// MARK: - Portrait strip

/// In portrait the rail is a strip on top of the content: the next topic, the cards due and the exam countdown.
private struct StudioStrip: View {
    let dueCount: Int
    let select: (AppTab) -> Void

    @Query private var plans: [StudyPlan]
    @Query private var exams: [Exam]

    var body: some View {
        let next = StudioData.todayTopics(plans).first { !$0.isDone } ?? StudioData.todayTopics(plans).first
        let exam = StudioData.exam(plans: plans, exams: exams)
        return HStack(spacing: 10) {
            VStack(alignment: .leading, spacing: 6) {
                Text("ALS NÄCHSTES")
                    .font(.mono(9, .medium))
                    .tracking(0.7)
                    .foregroundStyle(Quill.railMuted)
                Text(next?.title ?? "Heute ist nichts geplant.")
                    .font(.work(14, .semibold))
                    .lineLimit(1)
                if let next {
                    Text("\(next.estimatedMinutes) MIN" + (next.pagesLabel.isEmpty ? "" : " · \(next.pagesLabel.uppercased())"))
                        .font(.mono(10.5, .medium))
                        .foregroundStyle(Quill.railMuted)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .layoutPriority(1.4)
            .background(Quill.railSurface, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.railLine, lineWidth: 1))

            Button { select(.review) } label: {
                VStack(alignment: .leading, spacing: 5) {
                    Text("KARTEN")
                        .font(.mono(9, .medium))
                        .tracking(0.7)
                        .opacity(0.8)
                    Text("\(dueCount)")
                        .font(.mono(26, .semibold))
                }
                .foregroundStyle(Quill.onAccent)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Quill.accent, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
            .buttonStyle(.plain)

            if let exam {
                VStack(alignment: .leading, spacing: 5) {
                    Text("PRÜFUNG")
                        .font(.mono(9, .medium))
                        .tracking(0.7)
                        .foregroundStyle(Quill.railMuted)
                    HStack(alignment: .firstTextBaseline, spacing: 3) {
                        Text("\(exam.days)")
                            .font(.mono(26, .semibold))
                        Text("Tage")
                            .font(.work(11, .medium))
                            .foregroundStyle(Quill.railMuted)
                    }
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(Quill.railLine, lineWidth: 1))
            }
        }
        .foregroundStyle(Quill.railInk)
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
        .background(Quill.rail)
    }
}

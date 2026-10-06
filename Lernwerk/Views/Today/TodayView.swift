import SwiftData
import SwiftUI

/// "Heute", the home page of the Dock layout: the timetable's next lesson as a pixel card with Pip, the cards due,
/// the homework Pip asks for after each lesson, today's study-plan topics, the exam countdown and the row to
/// continue reading.
struct TodayView: View {
    let dueCount: Int
    let select: (AppTab) -> Void
    let openDocument: (StudyMaterial, Int?) -> Void

    @Environment(\.modelContext) private var modelContext
    @Query private var plans: [StudyPlan]
    @Query private var timetable: [TimetableEntry]
    @Query private var exams: [Exam]
    @Query private var homework: [Homework]
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]

    @State private var jump = ""
    @State private var replay = 0
    @State private var editing: String?
    @State private var draft = ""
    @State private var flash: String?
    @FocusState private var draftFocused: Bool

    private let gap: CGFloat = 16

    var body: some View {
        TimelineView(.periodic(from: .now, by: 30)) { timeline in
            GeometryReader { geometry in
                let wide = geometry.size.width > geometry.size.height && geometry.size.width >= 800
                let compact = geometry.size.width < 600
                let content = geometry.size.width - (compact ? 32 : 56)
                ScrollView {
                    VStack(spacing: gap) {
                        if wide {
                            let seven = (content - gap) * 7 / 12
                            let five = (content - gap) * 5 / 12
                            HStack(alignment: .top, spacing: gap) {
                                heroCard(now: timeline.date, portrait: false, compact: false).frame(width: seven)
                                cardsTile.frame(width: five)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                            HStack(alignment: .top, spacing: gap) {
                                homeworkCard(now: timeline.date).frame(width: seven)
                                examTile.frame(width: five)
                            }
                            .fixedSize(horizontal: false, vertical: true)
                        } else {
                            heroCard(now: timeline.date, portrait: true, compact: compact)
                            cardsTile
                            homeworkCard(now: timeline.date)
                            examTile
                        }
                        continueCard
                    }
                    .padding(.horizontal, compact ? 16 : 28)
                    .padding(.top, 12)
                    .padding(.bottom, 24)
                }
                .scrollIndicators(.hidden)
            }
        }
    }

    // Live data

    private var today: CalendarDay { .today() }

    private func minuteOfDay(_ date: Date) -> Int {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }

    private var lessons: [StudioToday.Lesson] {
        timetable
            .filter { $0.weekday == today.weekday }
            .map { StudioToday.Lesson(subject: $0.subject, room: $0.room, start: $0.startMinute, end: $0.endMinute) }
    }

    private var todayHomework: [Homework] {
        homework.filter { $0.dayISO == today.iso }
    }

    private var todayTopics: [PlanTopic] {
        let calendar = Calendar.current
        return plans.flatMap(\.topics)
            .filter { calendar.isDateInToday($0.scheduledDate) }
            .sorted { $0.order < $1.order }
    }

    private var library: [StudyMaterial] { materials.filter { !$0.isTrashed } }

    private var exam: StudioToday.ExamSummary? {
        let infos = plans.map { plan in
            StudioToday.PlanInfo(examDay: day(plan.examDate), done: plan.topics.sorted { $0.order < $1.order }.map(\.isDone))
        }
        return StudioToday.examSummary(plans: infos, exams: exams.map { day($0.date) }, today: today)
    }

    private func day(_ date: Date) -> CalendarDay {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return CalendarDay(year: parts.year ?? 1970, month: parts.month ?? 1, day: parts.day ?? 1)
    }

    private func openFromJump(_ material: StudyMaterial) {
        jump = ""
        openDocument(material, material.lastOpenedPage)
    }

    // Hero

    private func heroCard(now: Date, portrait: Bool, compact: Bool) -> some View {
        let minute = minuteOfDay(now)
        let lines = StudioToday.heroLines(now: minute, lessons: lessons, portrait: portrait)
        let caption = StudioToday.caption(day: today, minute: minute)
        return HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 14) {
                Button { replay += 1 } label: {
                    Text(caption)
                        .font(.mono(10.5, .medium))
                        .tracking(0.8)
                        .foregroundStyle(Quill.railMuted)
                }
                .buttonStyle(.plain)
                JumpBar(text: $jump, onDark: true, onArea: { select($0) }, onDocument: openFromJump)
                    .overlay(alignment: .topLeading) {
                        JumpResults(text: jump, onArea: { select($0) }, onDocument: openFromJump)
                            .offset(y: 50)
                    }
                    .padding(.trailing, compact ? 0 : 22)
                    .zIndex(1)
                HeroLines(lines: lines, replay: replay, scale: compact ? 0.62 : 1)
                if compact { pipColumn(now: now, compact: true) }
            }
            .padding(.vertical, 24)
            .padding(.leading, compact ? 20 : 30)
            .padding(.trailing, compact ? 20 : 0)
            .frame(maxWidth: .infinity, alignment: .topLeading)
            if !compact {
                pipColumn(now: now, compact: false)
                    .frame(width: 230)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 290, alignment: .topLeading)
        .background { HeroBackground() }
        .clipShape(PixelCorners(step: 4))
        .padding(4)
        .background(Quill.accent)
        .clipShape(PixelCorners(step: 4))
    }

    /// Pip and what it says: the cards waiting, or, when a lesson is almost over, the question about homework.
    private func pipColumn(now: Date, compact: Bool) -> some View {
        ZStack(alignment: .topLeading) {
            VStack {
                Spacer(minLength: 0)
                ZStack(alignment: .bottomLeading) {
                    DashedGround()
                        .frame(height: 2)
                    PipLogo(pixel: compact ? 5 : 8)
                        .padding(.leading, compact ? 0 : 24)
                }
                .padding(.bottom, compact ? 0 : 26)
            }
            bubble(now: now)
                .padding(.top, compact ? 0 : 24)
                .frame(maxWidth: 196, alignment: .leading)
                .padding(.leading, compact ? 80 : 0)
        }
        .frame(minHeight: compact ? 70 : 0)
    }

    private var pipLine: String {
        if dueCount > 0 { return dueCount == 1 ? "1 Karte wartet. Los?" : "\(dueCount) Karten warten. Los?" }
        return "Alles wiederholt. Mrrp."
    }

    @ViewBuilder
    private func bubble(now: Date) -> some View {
        let blocks = StudioToday.blocks(lessons)
        let answered = Set(todayHomework.map(\.subject))
        let ask = flash == nil ? StudioToday.askBlock(blocks: blocks, answered: answered, now: minuteOfDay(now)) : nil
        VStack(alignment: .leading, spacing: 10) {
            if let flash {
                Text(flash).font(.work(13, .semibold))
            } else if let ask, editing == ask.subject {
                Text("Was ist in \(ask.subject) auf?").font(.work(13, .semibold))
                TextField("", text: $draft, prompt: Text("z. B. S. 42, Nr. 3").foregroundStyle(Quill.onAccent.opacity(0.5)))
                    .font(.work(13, .medium))
                    .foregroundStyle(Quill.onAccent)
                    .focused($draftFocused)
                    .submitLabel(.done)
                    .onSubmit { save(ask) }
                    .padding(.horizontal, 10)
                    .frame(height: 34)
                    .background(Quill.onAccent.opacity(0.12), in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                HStack(spacing: 8) {
                    bubbleButton("OK") { save(ask) }
                    bubbleButton("ZURÜCK") { editing = nil }
                }
            } else if let ask {
                Text(minuteOfDay(now) < ask.end ? "Gleich ist \(ask.subject) aus. Gibt es Hausaufgaben?" : "\(ask.subject) ist vorbei. Gab es Hausaufgaben?")
                    .font(.work(13, .semibold))
                HStack(spacing: 8) {
                    bubbleButton("JA") {
                        draft = ""
                        editing = ask.subject
                    }
                    bubbleButton("NEIN") {
                        modelContext.insert(Homework(subject: ask.subject, dayISO: today.iso, isNone: true))
                    }
                }
            } else {
                Text(pipLine).font(.work(13, .semibold))
            }
        }
        .foregroundStyle(Quill.onAccent)
        .padding(.horizontal, 14)
        .padding(.top, 10)
        .padding(.bottom, 12)
        .background(Quill.accent, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
        .animation(.easeOut(duration: 0.15), value: editing)
        .onChange(of: editing) { _, value in draftFocused = value != nil }
    }

    private func bubbleButton(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.jersey(17))
                .tracking(0.6)
                .foregroundStyle(Quill.accent)
                .padding(.horizontal, 16)
                .frame(height: 30)
                .background(Quill.onAccent, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func save(_ block: StudioToday.Block) {
        let text = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        let week = timetable.map { (weekday: $0.weekday, subject: $0.subject) }
        modelContext.insert(Homework(
            subject: block.subject, dayISO: today.iso, text: text,
            due: StudioToday.dueLabel(subject: block.subject, week: week, today: today)
        ))
        editing = nil
        draft = ""
        flash = "Notiert. Viel Erfolg!"
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 2_800_000_000)
            flash = nil
        }
    }

    // Tiles

    private var cardsTile: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("KARTEN")
                .font(.mono(10.5, .semibold))
                .tracking(1)
            Spacer(minLength: 16)
            Text("\(dueCount)")
                .font(.jersey(150))
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text("fällig zum Wiederholen")
                .font(.work(16, .semibold))
                .padding(.top, 4)
            Spacer(minLength: 16)
            Button { select(.review) } label: {
                Text("Karten üben")
                    .font(.work(15, .bold))
                    .foregroundStyle(Quill.accent)
                    .padding(.horizontal, 24)
                    .frame(height: 46)
                    .background(Quill.rail, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(.plain)
        }
        .foregroundStyle(Quill.onAccent)
        .padding(26)
        .frame(maxWidth: .infinity, minHeight: 290, alignment: .topLeading)
        .background(Quill.accent, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
    }

    private var examTile: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("PRÜFUNG")
                .font(.mono(10.5, .semibold))
                .tracking(1)
                .foregroundStyle(Quill.faint)
            if let exam {
                Spacer(minLength: 12)
                HStack(alignment: .lastTextBaseline, spacing: 14) {
                    Text("\(exam.days)")
                        .font(.jersey(110))
                        .lineLimit(1)
                    Text("Tage bis\n\(exam.dateLabel)")
                        .font(.work(15, .medium))
                        .foregroundStyle(Quill.muted)
                }
                Spacer(minLength: 12)
                if !exam.blocks.isEmpty {
                    HStack(spacing: 4) {
                        ForEach(Array(exam.blocks.enumerated()), id: \.offset) { _, done in
                            RoundedRectangle(cornerRadius: 3)
                                .fill(done ? Quill.accent : Quill.ink.opacity(0.14))
                        }
                    }
                    .frame(height: 10)
                    if let label = exam.progressLabel {
                        Text(label.uppercased())
                            .font(.mono(11, .medium))
                            .foregroundStyle(Quill.faint)
                            .padding(.top, 10)
                    }
                }
            } else {
                Spacer(minLength: 12)
                Text("Kein Termin")
                    .font(.work(18, .bold))
                Text("Trag eine Klausur im Kalender oder ein Prüfungsdatum im Lernplan ein.")
                    .font(.work(14))
                    .foregroundStyle(Quill.muted)
                    .padding(.top, 4)
                Spacer(minLength: 0)
            }
        }
        .foregroundStyle(Quill.ink)
        .padding(26)
        .frame(maxWidth: .infinity, minHeight: 290, alignment: .topLeading)
        .background(Quill.surface2, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Quill.line, lineWidth: 1))
    }

    private func homeworkCard(now: Date) -> some View {
        let blocks = StudioToday.blocks(lessons)
        let minute = minuteOfDay(now)
        let answered = Set(todayHomework.map(\.subject))
        let asking = StudioToday.askBlock(blocks: blocks, answered: answered, now: minute)
        let openCount = todayHomework.filter { !$0.isNone && !$0.isDone }.count
        let topics = Array(todayTopics.prefix(3))
        let minutes = todayTopics.filter { !$0.isDone }.reduce(0) { $0 + $1.estimatedMinutes }
        return VStack(alignment: .leading, spacing: 0) {
            Text("HAUSAUFGABEN · \(openCount) OFFEN")
                .font(.mono(10.5, .semibold))
                .tracking(1)
                .foregroundStyle(Quill.faint)
                .padding(.bottom, 8)
            if blocks.isEmpty {
                Text("Heute kein Unterricht.")
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.muted)
                    .padding(.vertical, 14)
            }
            ForEach(blocks, id: \.start) { block in
                homeworkRow(block, entry: todayHomework.first { $0.subject == block.subject }, asking: asking == block)
            }
            if !topics.isEmpty {
                Text("HEUTE DRAN")
                    .font(.mono(10.5, .semibold))
                    .tracking(1)
                    .foregroundStyle(Quill.faint)
                    .padding(.top, 18)
                    .padding(.bottom, 4)
                ForEach(topics) { topic in topicRow(topic) }
            }
            Spacer(minLength: 12)
            Button { select(.plans) } label: {
                HStack {
                    Text("LERNPLAN HEUTE · \(todayTopics.count) THEMEN" + (minutes > 0 ? " · NOCH \(minutes) MIN." : " · ERLEDIGT"))
                        .font(.mono(10.5, .medium))
                        .tracking(0.6)
                        .foregroundStyle(Quill.faint)
                    Spacer(minLength: 8)
                    Text("Lernplan ›")
                        .font(.work(13.5, .semibold))
                        .foregroundStyle(Quill.link)
                }
                .padding(.top, 14)
                .overlay(alignment: .top) { QuillDivider() }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 26)
        .padding(.vertical, 22)
        .frame(maxWidth: .infinity, minHeight: 290, alignment: .topLeading)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Quill.line, lineWidth: 1))
    }

    private func homeworkRow(_ block: StudioToday.Block, entry: Homework?, asking: Bool) -> some View {
        let color = Subjects.color(block.subject).map { Color(SlideDrawing.uiColor($0)) } ?? Quill.faint
        return HStack(alignment: .center, spacing: 14) {
            RoundedRectangle(cornerRadius: 2).fill(color).frame(width: 4).frame(minHeight: 34)
            VStack(alignment: .leading, spacing: 6) {
                Text(block.subject).font(.work(14, .bold)).foregroundStyle(Quill.ink)
                Text("\(ClockTime.label(block.start))–\(ClockTime.label(block.end))")
                    .font(.mono(10.5, .medium))
                    .foregroundStyle(Quill.faint)
            }
            .frame(width: 112, alignment: .leading)
            VStack(alignment: .leading, spacing: 5) {
                if let entry, entry.isNone {
                    Text("Keine Hausaufgaben").font(.work(14, .medium)).foregroundStyle(Quill.muted)
                } else if let entry {
                    Text(entry.text)
                        .font(.work(14.5, .semibold))
                        .strikethrough(entry.isDone)
                        .foregroundStyle(entry.isDone ? Quill.faint : Quill.ink)
                    Text("FÄLLIG \(entry.due)").font(.mono(10.5, .medium)).foregroundStyle(Quill.faint)
                } else if asking {
                    Text("Antwort an Pip offen").font(.work(14, .bold)).foregroundStyle(Quill.ink)
                } else {
                    Text("Pip fragt am Ende der Stunde").font(.work(14, .medium)).foregroundStyle(Quill.faint)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            if let entry, !entry.isNone {
                Button { entry.isDone.toggle() } label: {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(entry.isDone ? Quill.accent : Color.clear)
                        .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).stroke(entry.isDone ? Quill.accent : Quill.line3, lineWidth: 2))
                        .overlay {
                            if entry.isDone {
                                Image(systemName: "checkmark").font(.system(size: 11, weight: .heavy)).foregroundStyle(Quill.onAccent)
                            }
                        }
                        .frame(width: 24, height: 24)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(entry.isDone ? "Als offen markieren" : "Als erledigt markieren")
            }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, asking ? 10 : 0)
        .background(asking ? Quill.accentSoft : Color.clear, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(alignment: .top) { QuillDivider(color: Quill.lineSoft) }
    }

    private func topicRow(_ topic: PlanTopic) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Button { topic.isDone.toggle() } label: {
                RoundedRectangle(cornerRadius: 6, style: .continuous)
                    .fill(topic.isDone ? Quill.accent : Color.clear)
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(topic.isDone ? Quill.accent : Quill.line3, lineWidth: 1.5))
                    .overlay {
                        if topic.isDone {
                            Image(systemName: "checkmark").font(.system(size: 10, weight: .heavy)).foregroundStyle(Quill.onAccent)
                        }
                    }
                    .frame(width: 20, height: 20)
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
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(topic.title)
                            .font(.work(14.5, .semibold))
                            .strikethrough(topic.isDone)
                            .foregroundStyle(topic.isDone ? Quill.faint : Quill.ink)
                            .multilineTextAlignment(.leading)
                        if !topic.summary.isEmpty {
                            Text(topic.summary)
                                .font(.work(12.5))
                                .foregroundStyle(Quill.muted)
                                .lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    Spacer(minLength: 8)
                    Text("\(topic.estimatedMinutes) MIN")
                        .font(.mono(10.5, .medium))
                        .foregroundStyle(Quill.faint)
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 10)
        .overlay(alignment: .top) { QuillDivider(color: Quill.lineSoft) }
    }

    @ViewBuilder
    private var continueCard: some View {
        if let material = library.filter({ $0.lastOpenedAt != nil }).max(by: { ($0.lastOpenedAt ?? .distantPast) < ($1.lastOpenedAt ?? .distantPast) }) {
            HStack(spacing: 18) {
                MiniCover(material: material)
                VStack(alignment: .leading, spacing: 6) {
                    Text("WEITERLESEN")
                        .font(.mono(10.5, .semibold))
                        .tracking(1)
                        .foregroundStyle(Quill.faint)
                    Text(material.title)
                        .font(.work(18, .bold))
                        .foregroundStyle(Quill.ink)
                        .lineLimit(2)
                    Text("Weiter bei S. \(material.lastOpenedPage + 1)")
                        .font(.mono(11.5, .medium))
                        .foregroundStyle(Quill.faint)
                }
                Spacer(minLength: 8)
                Button { openDocument(material, material.lastOpenedPage) } label: {
                    Text("Öffnen")
                        .font(.work(15, .bold))
                        .foregroundStyle(Quill.bg)
                        .padding(.horizontal, 26)
                        .frame(height: 46)
                        .background(Quill.ink, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 26, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 26, style: .continuous).stroke(Quill.line, lineWidth: 1))
        }
    }
}

// MARK: - Pieces

/// A rectangle with stair-stepped corners, like a pixel-art frame; `step` is the size of one pixel.
struct PixelCorners: Shape {
    var step: CGFloat = 3

    func path(in rect: CGRect) -> Path {
        let s = step
        let w = rect.width
        let h = rect.height
        let points: [CGPoint] = [
            CGPoint(x: 0, y: 2 * s), CGPoint(x: s, y: 2 * s), CGPoint(x: s, y: s), CGPoint(x: 2 * s, y: s), CGPoint(x: 2 * s, y: 0),
            CGPoint(x: w - 2 * s, y: 0), CGPoint(x: w - 2 * s, y: s), CGPoint(x: w - s, y: s), CGPoint(x: w - s, y: 2 * s), CGPoint(x: w, y: 2 * s),
            CGPoint(x: w, y: h - 2 * s), CGPoint(x: w - s, y: h - 2 * s), CGPoint(x: w - s, y: h - s), CGPoint(x: w - 2 * s, y: h - s),
            CGPoint(x: w - 2 * s, y: h), CGPoint(x: 2 * s, y: h), CGPoint(x: 2 * s, y: h - s), CGPoint(x: s, y: h - s),
            CGPoint(x: s, y: h - 2 * s), CGPoint(x: 0, y: h - 2 * s),
        ]
        var path = Path()
        path.addLines(points.map { CGPoint(x: $0.x + rect.minX, y: $0.y + rect.minY) })
        path.closeSubpath()
        return path
    }
}

/// The first page of the document, small, like the cover in the table.
private struct MiniCover: View {
    let material: StudyMaterial
    @State private var cover: UIImage?

    var body: some View {
        Group {
            if let cover {
                Image(uiImage: cover).resizable().scaledToFit()
            } else {
                Quill.paper
            }
        }
        .frame(width: 52, height: 72)
        .clipShape(RoundedRectangle(cornerRadius: 3, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 3, style: .continuous).stroke(Quill.line, lineWidth: 1))
        .task(id: material.fileName) {
            cover = await DocumentCover.firstPage(of: material.fileURL)
        }
    }
}

/// The hero card's text, typed out line by line in Jersey 10; tapping the date replays it.
private struct HeroLines: View {
    let lines: [StudioToday.PixelLine]
    let replay: Int
    var scale: CGFloat = 1
    @State private var typed = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

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
        let spanList = spans
        VStack(alignment: .leading, spacing: 6) {
            ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                row(line, span: spanList[index], isLast: index == lines.count - 1)
            }
        }
        .task(id: key) { await type() }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(lines.map(\.text).joined(separator: ". "))
    }

    private func row(_ line: StudioToday.PixelLine, span: (start: Int, end: Int), isLast: Bool) -> some View {
        let size = line.size * scale
        let shown = max(0, min(line.text.count, typed - span.start))
        let cursor = typed >= span.start && (typed < span.end || (isLast && typed >= span.end))
        return HStack(spacing: 6) {
            Text(String(line.text.prefix(shown)))
                .font(.jersey(size))
                .tracking(size * 0.02)
                .foregroundStyle(color(line.tone))
                .lineLimit(1)
                .fixedSize()
            if cursor {
                TimelineView(.periodic(from: .now, by: 0.5)) { timeline in
                    Rectangle()
                        .fill(Quill.accent)
                        .frame(width: (size * 0.42).rounded(), height: (size * 0.66).rounded())
                        .opacity(Int(timeline.date.timeIntervalSinceReferenceDate * 2) % 2 == 0 ? 1 : 0)
                }
            }
        }
        .frame(minHeight: size * 0.8, alignment: .leading)
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
            try? await Task.sleep(nanoseconds: 48_000_000)
            if Task.isCancelled { return }
            typed += 1
        }
    }
}

/// The dark card with a faint dot grid, like pixel paper.
private struct HeroBackground: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 14
            var y: CGFloat = 7
            while y < size.height {
                var x: CGFloat = 7
                while x < size.width {
                    context.fill(Path(CGRect(x: x, y: y, width: 1.5, height: 1.5)), with: .color(Quill.railInk.opacity(0.07)))
                    x += step
                }
                y += step
            }
        }
        .background(Quill.rail)
    }
}

/// The line Pip stands on.
private struct DashedGround: View {
    var body: some View {
        Canvas { context, size in
            var path = Path()
            path.move(to: CGPoint(x: 0, y: size.height / 2))
            path.addLine(to: CGPoint(x: size.width, y: size.height / 2))
            context.stroke(path, with: .color(Quill.accent.opacity(0.7)), style: StrokeStyle(lineWidth: 2, dash: [6, 5]))
        }
    }
}

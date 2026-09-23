import SwiftData
import SwiftUI

struct PlanDetailView: View {
    let plan: StudyPlan

    @Environment(\.dismiss) private var dismiss
    @Query private var materials: [StudyMaterial]

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
                                TopicRow(topic: topic, material: material(for: topic))
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
    }
}

private struct TopicRow: View {
    let topic: PlanTopic
    let material: StudyMaterial?

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { topic.isDone.toggle() }
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
        .overlay(alignment: .bottom) { QuillDivider() }
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

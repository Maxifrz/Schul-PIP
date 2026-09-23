import SwiftData
import SwiftUI

struct PlanDetailView: View {
    let plan: StudyPlan

    @Query private var materials: [StudyMaterial]

    private let calendar = Calendar.current

    var body: some View {
        List {
            Section {
                progressHeader
            }
            if plan.isOverbooked {
                Section {
                    Label(
                        "Bei \(plan.minutesPerDay) Minuten pro Tag passt der Stoff nicht bis zur Prüfung. Erhöh die tägliche Lernzeit oder streich Themen.",
                        systemImage: "exclamationmark.triangle"
                    )
                    .foregroundStyle(.orange)
                }
            }
            ForEach(days, id: \.self) { day in
                Section {
                    ForEach(topics(on: day)) { topic in
                        TopicRow(topic: topic, material: material(for: topic))
                    }
                } header: {
                    Text(title(for: day))
                }
            }
        }
        .navigationTitle(plan.title)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button("Ab heute neu verteilen", action: reschedule)
            }
        }
    }

    private var progressHeader: some View {
        let done = plan.topics.filter(\.isDone).count
        let daysLeft = calendar.dateComponents(
            [.day],
            from: calendar.startOfDay(for: .now),
            to: calendar.startOfDay(for: plan.examDate)
        ).day ?? 0
        return VStack(alignment: .leading, spacing: 8) {
            Text("\(done) von \(plan.topics.count) Themen erledigt")
                .font(.headline)
            ProgressView(value: Double(done), total: Double(max(plan.topics.count, 1)))
                .tint(.green)
            Text("Prüfung am \(plan.examDate.formatted(date: .long, time: .omitted)) · noch \(max(daysLeft, 0)) Tage")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
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
        for (topic, date) in zip(open, dates) {
            topic.scheduledDate = date
        }
        plan.isOverbooked = PlanScheduler.isOverbooked(dates: dates, examDate: plan.examDate, calendar: calendar)
    }
}

private struct TopicRow: View {
    let topic: PlanTopic
    let material: StudyMaterial?

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Button {
                withAnimation { topic.isDone.toggle() }
            } label: {
                Image(systemName: topic.isDone ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(topic.isDone ? Color.green : Color.secondary)
            }
            .buttonStyle(.borderless)
            .accessibilityLabel(topic.isDone ? "Als offen markieren" : "Als erledigt markieren")

            if let material {
                NavigationLink {
                    DocumentScreen(material: material, startPage: max(0, (topic.sourcePages.min() ?? 1) - 1))
                } label: {
                    details
                }
            } else {
                details
            }
        }
        .padding(.vertical, 2)
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(topic.title)
                .font(.headline)
                .strikethrough(topic.isDone)
                .foregroundStyle(topic.isDone ? Color.secondary : Color.primary)
            Text(topic.summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
            HStack(spacing: 12) {
                Label("\(topic.estimatedMinutes) min", systemImage: "clock")
                if !topic.pagesLabel.isEmpty {
                    Label(topic.pagesLabel, systemImage: "doc.text")
                }
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
    }
}

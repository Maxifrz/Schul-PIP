import SwiftData
import SwiftUI

/// The Klausurenplan: every exam, soonest first, with how many days and how many actual school days are left to
/// prepare — weekends, Feiertage and Ferien do not count towards the school days.
struct ExamsPane: View {
    @Query(sort: \Exam.date) private var allExams: [Exam]
    @Environment(\.modelContext) private var modelContext
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var editing: Exam?
    @State private var isCreating = false

    private var today: CalendarDay { .today() }

    private var upcoming: [Exam] { allExams.filter { $0.calendarDay >= today } }
    private var past: [Exam] { allExams.filter { $0.calendarDay < today }.reversed() }

    var body: some View {
        VStack(spacing: 0) {
            header
            if allExams.isEmpty {
                emptyState
            } else {
                list
            }
        }
        .sheet(item: $editing) { exam in
            ExamSheet(exam: exam) { modelContext.delete(exam) }
        }
        .sheet(isPresented: $isCreating) {
            ExamSheet(exam: nil, onDelete: {})
        }
    }

    private var header: some View {
        HStack {
            Spacer()
            Button {
                isCreating = true
            } label: {
                Label("Klausur", systemImage: "plus")
            }
            .buttonStyle(QuillOutlineButtonStyle(height: 34))
        }
        .padding(.horizontal, sizeClass == .regular ? 40 : 16)
        .padding(.bottom, 10)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Text("Noch keine Klausuren")
                .font(.work(18, .medium))
                .foregroundStyle(Quill.ink)
            Text("Trag deine nächste Klausur ein, um zu sehen, wie viele Schultage bis dahin bleiben.")
                .font(.work(14))
                .foregroundStyle(Quill.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var list: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if settings.bundesland == nil {
                    hint("Wähle unter „Ferien“ dein Bundesland, dann zeigt jede Klausur auch die Schultage bis dahin.")
                }
                ForEach(upcoming) { exam in
                    row(exam)
                }
                if !past.isEmpty {
                    PixelCaption(text: "Vorbei").padding(.top, 22).padding(.bottom, 4)
                    ForEach(past) { exam in
                        row(exam, dimmed: true)
                    }
                }
            }
            .padding(.horizontal, sizeClass == .regular ? 40 : 16)
            .padding(.bottom, 30)
        }
    }

    private func hint(_ text: String) -> some View {
        Text(text)
            .font(.work(13))
            .foregroundStyle(Quill.muted)
            .padding(12)
            .background(Quill.hover, in: RoundedRectangle(cornerRadius: 10))
            .padding(.bottom, 14)
    }

    private func row(_ exam: Exam, dimmed: Bool = false) -> some View {
        Button {
            editing = exam
        } label: {
            HStack(alignment: .top, spacing: 12) {
                Circle()
                    .fill(Subjects.color(exam.subject).map { Color(QuillUIColor.hex($0)) } ?? Quill.accent)
                    .frame(width: 10, height: 10)
                    .padding(.top, 5)
                VStack(alignment: .leading, spacing: 3) {
                    Text(exam.subject.isEmpty ? "Klausur" : exam.subject)
                        .font(.work(16, .medium))
                        .foregroundStyle(Quill.ink)
                    if !exam.topic.isEmpty {
                        Text(exam.topic)
                            .font(.work(14))
                            .foregroundStyle(Quill.ink2)
                    }
                    if !exam.room.isEmpty {
                        Text("Raum \(exam.room)")
                            .font(.work(12.5))
                            .foregroundStyle(Quill.faint)
                    }
                }
                Spacer()
                VStack(alignment: .trailing, spacing: 3) {
                    Text(exam.calendarDay.germanLabel)
                        .font(.work(13.5, .medium))
                        .foregroundStyle(Quill.ink2)
                    Text(ExamCountdown.daysLabel(from: today, to: exam.calendarDay))
                        .font(.work(12.5))
                        .foregroundStyle(Quill.muted)
                    if let state = settings.bundesland, let schoolDays = ExamCountdown.schoolDaysLabel(from: today, to: exam.calendarDay, in: state) {
                        Text(schoolDays)
                            .font(.work(11.5, .medium))
                            .foregroundStyle(Quill.link)
                    }
                }
            }
            .padding(.vertical, 13)
            .opacity(dimmed ? 0.55 : 1)
            .contentShape(Rectangle())
        }
        .buttonStyle(QuillPressStyle())
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }
}

/// Add or edit one exam: subject, topic, date, room.
private struct ExamSheet: View {
    let exam: Exam?
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var subject: String
    @State private var topic: String
    @State private var room: String
    @State private var date: Date
    @State private var showingSubjects = false

    init(exam: Exam?, onDelete: @escaping () -> Void) {
        self.exam = exam
        self.onDelete = onDelete
        _subject = State(initialValue: exam?.subject ?? "")
        _topic = State(initialValue: exam?.topic ?? "")
        _room = State(initialValue: exam?.room ?? "")
        _date = State(initialValue: exam?.date ?? Calendar.current.date(byAdding: .day, value: 7, to: .now) ?? .now)
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    QuillRow(label: "Fach", verticalPadding: 8) {
                        Button {
                            showingSubjects = true
                        } label: {
                            HStack(spacing: 8) {
                                if let color = Subjects.color(subject) {
                                    Circle().fill(Color(QuillUIColor.hex(color))).frame(width: 9, height: 9)
                                }
                                Text(subject.isEmpty ? "Wählen" : subject)
                                    .foregroundStyle(subject.isEmpty ? Quill.faint : Quill.ink)
                            }
                        }
                        .font(.work(15.5))
                    }
                    QuillRow(label: "Thema", verticalPadding: 8) {
                        TextField("optional", text: $topic)
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                            .multilineTextAlignment(.trailing)
                    }
                    QuillRow(label: "Termin", verticalPadding: 8) {
                        DatePicker("Termin", selection: $date, displayedComponents: .date)
                            .labelsHidden()
                            .tint(Quill.accent)
                    }
                    QuillRow(label: "Raum", verticalPadding: 8) {
                        TextField("optional", text: $room)
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                            .multilineTextAlignment(.trailing)
                    }

                    if exam != nil {
                        Button(role: .destructive) {
                            onDelete()
                            dismiss()
                        } label: {
                            Text("Klausur löschen")
                        }
                        .buttonStyle(QuillOutlineButtonStyle(height: 40))
                        .padding(.top, 24)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 20)
                .padding(.bottom, 30)
            }
        }
        .background(Quill.bg.ignoresSafeArea())
        .presentationBackground(Quill.bg)
        .presentationDetents([.medium, .large])
        .sheet(isPresented: $showingSubjects) {
            SubjectPicker { subject = $0 }
        }
    }

    private var header: some View {
        ZStack {
            Text(exam == nil ? "Neue Klausur" : "Klausur bearbeiten")
                .font(.work(16, .medium))
                .foregroundStyle(Quill.ink)
            HStack {
                Button("Abbrechen") { dismiss() }
                    .font(.work(15))
                    .foregroundStyle(Quill.muted)
                Spacer()
                Button("Sichern", action: save)
                    .font(.work(15, .medium))
                    .foregroundStyle(subject.trimmingCharacters(in: .whitespaces).isEmpty ? Quill.faint : Quill.link)
                    .disabled(subject.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }

    private func save() {
        if let exam {
            exam.subject = subject.trimmingCharacters(in: .whitespaces)
            exam.topic = topic.trimmingCharacters(in: .whitespaces)
            exam.room = room.trimmingCharacters(in: .whitespaces)
            exam.date = date
        } else {
            let created = Exam(
                subject: subject.trimmingCharacters(in: .whitespaces),
                topic: topic.trimmingCharacters(in: .whitespaces),
                date: date,
                room: room.trimmingCharacters(in: .whitespaces)
            )
            modelContext.insert(created)
        }
        dismiss()
    }
}

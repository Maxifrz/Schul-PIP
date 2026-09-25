import SwiftData
import SwiftUI

/// The weekly timetable: a grid Monday to Friday (Saturday only if something is scheduled on it), lessons as
/// colored blocks placed and sized by their time, side by side when two overlap.
struct TimetablePane: View {
    @Query(sort: \TimetableEntry.startMinute) private var allEntries: [TimetableEntry]
    @Environment(\.modelContext) private var modelContext
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var editing: TimetableEntry?
    @State private var isCreating = false

    private let minuteHeight: CGFloat = 1.15
    private let hourGutterWidth: CGFloat = 42

    private var days: [Weekday] {
        let present = Set(allEntries.map(\.weekday))
        let base: [Weekday] = [.monday, .tuesday, .wednesday, .thursday, .friday]
        let extra: [Weekday] = [.saturday, .sunday].filter { present.contains($0.rawValue) }
        return base + extra
    }

    private var range: (start: Int, end: Int) {
        TimetableLayout.dayRange(for: allEntries.map { .init(weekday: $0.weekday, start: $0.startMinute, end: $0.endMinute) })
    }

    private var placements: [ObjectIdentifier: TimetableLayout.Placement] {
        let layoutEntries = allEntries.map { TimetableLayout.Entry(weekday: $0.weekday, start: $0.startMinute, end: $0.endMinute) }
        let computed = TimetableLayout.placements(for: layoutEntries)
        var result: [ObjectIdentifier: TimetableLayout.Placement] = [:]
        for (index, entry) in allEntries.enumerated() where index < computed.count {
            result[ObjectIdentifier(entry)] = computed[index]
        }
        return result
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            if allEntries.isEmpty {
                emptyState
            } else {
                grid
            }
        }
        .sheet(item: $editing) { entry in
            TimetableEntrySheet(entry: entry) { modelContext.delete(entry) }
        }
        .sheet(isPresented: $isCreating) {
            TimetableEntrySheet(entry: nil, onDelete: {})
        }
    }

    private var header: some View {
        HStack {
            Spacer()
            Button {
                isCreating = true
            } label: {
                Label("Stunde", systemImage: "plus")
            }
            .buttonStyle(QuillOutlineButtonStyle(height: 34))
        }
        .padding(.horizontal, sizeClass == .regular ? 40 : 16)
        .padding(.bottom, 10)
    }

    private var emptyState: some View {
        VStack(spacing: 10) {
            Text("Noch kein Stundenplan")
                .font(.work(18, .medium))
                .foregroundStyle(Quill.ink)
            Text("Trag deine Fächer mit Wochentag und Uhrzeit ein.")
                .font(.work(14))
                .foregroundStyle(Quill.muted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var grid: some View {
        let (start, end) = range
        let totalHeight = CGFloat(end - start) * minuteHeight
        return ScrollView(.vertical) {
            HStack(alignment: .top, spacing: 0) {
                hourGutter(start: start, end: end, height: totalHeight)
                ForEach(days) { day in
                    dayColumn(day, start: start, height: totalHeight)
                        .frame(minWidth: sizeClass == .regular ? 130 : 92)
                }
            }
            .padding(.horizontal, sizeClass == .regular ? 40 : 16)
            .padding(.bottom, 30)
        }
    }

    private func hourGutter(start: Int, end: Int, height: CGFloat) -> some View {
        ZStack(alignment: .topLeading) {
            ForEach(Array(stride(from: (start / 60) * 60, through: end, by: 60)), id: \.self) { minute in
                Text(ClockTime.label(minute))
                    .font(.work(11))
                    .foregroundStyle(Quill.faint)
                    .offset(y: CGFloat(minute - start) * minuteHeight - 6)
            }
        }
        .frame(width: hourGutterWidth, height: height, alignment: .topLeading)
    }

    private func dayColumn(_ day: Weekday, start: Int, height: CGFloat) -> some View {
        let dayEntries = allEntries.filter { $0.weekday == day.rawValue }
        return VStack(spacing: 4) {
            Text(day.shortLabel)
                .font(.work(12.5, .medium))
                .foregroundStyle(Quill.muted)
            GeometryReader { geometry in
                ZStack(alignment: .topLeading) {
                    hourLines(start: start, height: height)
                    ForEach(dayEntries) { entry in
                        entryBlock(entry, start: start, columnWidth: geometry.size.width)
                    }
                }
            }
            .frame(height: height)
        }
    }

    private func hourLines(start: Int, height: CGFloat) -> some View {
        ZStack(alignment: .top) {
            ForEach(Array(stride(from: (start / 60) * 60, through: start + Int(height / minuteHeight), by: 60)), id: \.self) { minute in
                QuillDivider(color: Quill.lineSoft)
                    .offset(y: CGFloat(minute - start) * minuteHeight)
            }
        }
    }

    private func entryBlock(_ entry: TimetableEntry, start: Int, columnWidth: CGFloat) -> some View {
        let placement = placements[ObjectIdentifier(entry)] ?? .init(index: 0, column: 0, columns: 1)
        let width = columnWidth / CGFloat(placement.columns)
        let color = Subjects.color(entry.subject).map { Color(QuillUIColor.hex($0)) } ?? Quill.accent
        return Button {
            editing = entry
        } label: {
            VStack(alignment: .leading, spacing: 1) {
                Text(entry.subject.isEmpty ? "Fach" : entry.subject)
                    .font(.work(11.5, .semibold))
                    .lineLimit(2)
                if !entry.room.isEmpty {
                    Text(entry.room)
                        .font(.work(10))
                        .lineLimit(1)
                }
            }
            .foregroundStyle(color)
            .padding(.horizontal, 5)
            .padding(.vertical, 3)
            .frame(width: max(width - 3, 20), height: CGFloat(entry.endMinute - entry.startMinute) * minuteHeight, alignment: .topLeading)
            .background(color.opacity(0.16), in: RoundedRectangle(cornerRadius: 6))
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(color.opacity(0.4), lineWidth: 1))
        }
        .buttonStyle(QuillPressStyle())
        .offset(x: CGFloat(placement.column) * width, y: CGFloat(entry.startMinute - start) * minuteHeight)
    }
}

/// Add or edit one lesson: subject (from the library's subject list, or a custom name), weekday, times, room.
private struct TimetableEntrySheet: View {
    let entry: TimetableEntry?
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext

    @State private var subject: String
    @State private var room: String
    @State private var weekday: Weekday
    @State private var start: Date
    @State private var end: Date
    @State private var showingSubjects = false

    init(entry: TimetableEntry?, onDelete: @escaping () -> Void) {
        self.entry = entry
        self.onDelete = onDelete
        _subject = State(initialValue: entry?.subject ?? "")
        _room = State(initialValue: entry?.room ?? "")
        _weekday = State(initialValue: Weekday(rawValue: entry?.weekday ?? Weekday.monday.rawValue) ?? .monday)
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: .now)
        _start = State(initialValue: calendar.date(byAdding: .minute, value: entry?.startMinute ?? ClockTime.minutes(hour: 8, minute: 0), to: today) ?? .now)
        _end = State(initialValue: calendar.date(byAdding: .minute, value: entry?.endMinute ?? ClockTime.minutes(hour: 8, minute: 45), to: today) ?? .now)
    }

    private var minutesOfDay: (start: Int, end: Int) {
        let calendar = Calendar.current
        func minutes(_ date: Date) -> Int {
            let components = calendar.dateComponents([.hour, .minute], from: date)
            return ClockTime.minutes(hour: components.hour ?? 0, minute: components.minute ?? 0)
        }
        return (minutes(start), minutes(end))
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
                    QuillRow(label: "Raum", verticalPadding: 8) {
                        TextField("optional", text: $room)
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                            .multilineTextAlignment(.trailing)
                    }
                    QuillRow(label: "Wochentag", verticalPadding: 8) {
                        Picker("Wochentag", selection: $weekday) {
                            ForEach(Weekday.allCases) { day in
                                Text(day.label).tag(day)
                            }
                        }
                        .tint(Quill.ink)
                    }
                    QuillRow(label: "Von", verticalPadding: 8) {
                        DatePicker("Von", selection: $start, displayedComponents: .hourAndMinute)
                            .labelsHidden()
                            .tint(Quill.accent)
                    }
                    QuillRow(label: "Bis", verticalPadding: 8) {
                        DatePicker("Bis", selection: $end, displayedComponents: .hourAndMinute)
                            .labelsHidden()
                            .tint(Quill.accent)
                    }

                    if entry != nil {
                        Button(role: .destructive) {
                            onDelete()
                            dismiss()
                        } label: {
                            Text("Stunde löschen")
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
            Text(entry == nil ? "Neue Stunde" : "Stunde bearbeiten")
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
                    .disabled(subject.trimmingCharacters(in: .whitespaces).isEmpty || minutesOfDay.end <= minutesOfDay.start)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }

    private func save() {
        let (startMinute, endMinute) = minutesOfDay
        if let entry {
            entry.subject = subject.trimmingCharacters(in: .whitespaces)
            entry.room = room.trimmingCharacters(in: .whitespaces)
            entry.weekday = weekday.rawValue
            entry.startMinute = startMinute
            entry.endMinute = endMinute
        } else {
            let created = TimetableEntry(
                subject: subject.trimmingCharacters(in: .whitespaces),
                room: room.trimmingCharacters(in: .whitespaces),
                weekday: weekday.rawValue,
                startMinute: startMinute,
                endMinute: endMinute
            )
            modelContext.insert(created)
        }
        dismiss()
    }
}

/// The library's subject list, so a lesson's color matches its documents' color.
struct SubjectPicker: View {
    let onPick: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var custom = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Fach").padding(.bottom, 10)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Subjects.all, id: \.name) { subject in
                        Button {
                            onPick(subject.name)
                            dismiss()
                        } label: {
                            HStack(spacing: 12) {
                                Circle().fill(Color(QuillUIColor.hex(subject.color))).frame(width: 10, height: 10)
                                Text(subject.name).font(.work(15.5)).foregroundStyle(Quill.ink)
                                Spacer()
                            }
                            .padding(.vertical, 11)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(QuillPressStyle())
                    }
                }
            }
            HStack {
                TextField("Eigenes Fach", text: $custom)
                    .font(.work(15))
                    .foregroundStyle(Quill.ink)
                Button("Übernehmen") {
                    let trimmed = custom.trimmingCharacters(in: .whitespaces)
                    guard !trimmed.isEmpty else { return }
                    onPick(trimmed)
                    dismiss()
                }
                .font(.work(14, .medium))
                .foregroundStyle(Quill.link)
                .disabled(custom.trimmingCharacters(in: .whitespaces).isEmpty)
            }
            .padding(.top, 10)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
    }
}

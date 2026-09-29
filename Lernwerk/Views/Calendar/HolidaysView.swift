import SwiftUI

/// Ferien and Feiertage for the student's own Bundesland — chosen here, since Schul-PIP cannot know it on its own.
struct HolidaysPane: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var picking = false

    private var today: CalendarDay { .today() }

    var body: some View {
        VStack(spacing: 0) {
            header
            if let state = settings.bundesland {
                content(state)
            } else {
                chooser
            }
        }
        .sheet(isPresented: $picking) {
            BundeslandPicker(selection: settings.bundesland) {
                settings.bundesland = $0
                picking = false
            }
        }
    }

    private var header: some View {
        HStack {
            if let state = settings.bundesland {
                Text(state.name)
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.muted)
            }
            Spacer()
            Button {
                picking = true
            } label: {
                Label(settings.bundesland == nil ? "Bundesland" : "Ändern", systemImage: "mappin.and.ellipse")
            }
            .buttonStyle(QuillOutlineButtonStyle(height: 34))
        }
        .padding(.horizontal, sizeClass == .regular ? 40 : 16)
        .padding(.bottom, 10)
    }

    private var chooser: some View {
        VStack(spacing: 14) {
            Text("Für welches Bundesland?")
                .font(.work(18, .medium))
                .foregroundStyle(Quill.ink)
            Text("Ferien und Feiertage sind je nach Bundesland unterschiedlich; wähl deins, um sie hier und bei den Klausuren zu sehen.")
                .font(.work(14))
                .foregroundStyle(Quill.muted)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            Button("Bundesland wählen") { picking = true }
                .buttonStyle(QuillPrimaryButtonStyle())
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func content(_ state: Bundesland) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                if let current = HolidayCalendar.currentSchoolHoliday(on: today, in: state) {
                    banner("Ferien jetzt: \(current.name), bis \(current.end.germanLabel)")
                }
                PixelCaption(text: "Ferien").padding(.top, current(state) ? 18 : 4).padding(.bottom, 4)
                ForEach(upcomingSchoolHolidays(state)) { holiday in
                    schoolHolidayRow(holiday)
                }
                PixelCaption(text: "Feiertage").padding(.top, 24).padding(.bottom, 4)
                ForEach(upcomingPublicHolidays(state)) { holiday in
                    publicHolidayRow(holiday)
                }
            }
            .padding(.horizontal, sizeClass == .regular ? 40 : 16)
            .padding(.bottom, 30)
        }
    }

    private func current(_ state: Bundesland) -> Bool {
        HolidayCalendar.currentSchoolHoliday(on: today, in: state) != nil
    }

    private func upcomingSchoolHolidays(_ state: Bundesland) -> [SchoolHoliday] {
        Array(HolidayCalendar.schoolHolidays(for: state).filter { $0.end >= today }.prefix(10))
    }

    private func upcomingPublicHolidays(_ state: Bundesland) -> [PublicHoliday] {
        Array(HolidayCalendar.publicHolidays(for: state).filter { $0.date >= today }.prefix(10))
    }

    private func banner(_ text: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "sun.max.fill")
                .foregroundStyle(Quill.accent)
            Text(text)
                .font(.work(14, .medium))
                .foregroundStyle(Quill.ink)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Quill.accent.opacity(0.14), in: RoundedRectangle(cornerRadius: 10))
    }

    private func schoolHolidayRow(_ holiday: SchoolHoliday) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 3) {
                Text(holiday.name)
                    .font(.work(15.5, .medium))
                    .foregroundStyle(Quill.ink)
                Text("\(holiday.start.shortLabel) – \(holiday.end.shortLabel)")
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
            }
            Spacer()
            Text(holiday.contains(today) ? "läuft" : ExamCountdown.daysLabel(from: today, to: holiday.start))
                .font(.work(12.5, .medium))
                .foregroundStyle(Quill.link)
        }
        .padding(.vertical, 11)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }

    private func publicHolidayRow(_ holiday: PublicHoliday) -> some View {
        HStack(alignment: .firstTextBaseline) {
            VStack(alignment: .leading, spacing: 3) {
                Text(holiday.name)
                    .font(.work(15.5, .medium))
                    .foregroundStyle(Quill.ink)
                Text(holiday.date.germanLabel)
                    .font(.work(13))
                    .foregroundStyle(Quill.muted)
            }
            Spacer()
            Text(ExamCountdown.daysLabel(from: today, to: holiday.date))
                .font(.work(12.5, .medium))
                .foregroundStyle(Quill.muted)
        }
        .padding(.vertical, 11)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }
}

/// All 16 Bundesländer, alphabetically.
struct BundeslandPicker: View {
    let selection: Bundesland?
    let onPick: (Bundesland) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Bundesland").padding(.bottom, 10)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(Bundesland.allCases.sorted { $0.name < $1.name }) { state in
                        Button {
                            onPick(state)
                        } label: {
                            HStack(spacing: 12) {
                                Text(state.name).font(.work(15.5)).foregroundStyle(Quill.ink)
                                Spacer()
                                if state == selection {
                                    Image(systemName: "checkmark").foregroundStyle(Quill.accent)
                                }
                            }
                            .padding(.vertical, 11)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(QuillPressStyle())
                    }
                }
            }
            Button("Abbrechen") { dismiss() }
                .font(.work(15))
                .foregroundStyle(Quill.muted)
                .buttonStyle(.plain)
                .padding(.top, 14)
        }
        .padding(24)
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
    }
}

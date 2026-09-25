import SwiftUI

/// Stundenplan, Klausurenplan and Ferien/Feiertage in one tab: the school calendar, separate from the AI study
/// plan, which is about exam preparation rather than the weekly rhythm.
struct CalendarScreen: View {
    @State private var mode = Mode.timetable
    @Environment(\.horizontalSizeClass) private var sizeClass

    enum Mode: String, CaseIterable {
        case timetable = "Stunden"
        case exams = "Klausuren"
        case holidays = "Ferien"
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            switch mode {
            case .timetable: TimetablePane()
            case .exams: ExamsPane()
            case .holidays: HolidaysPane()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        HStack(alignment: .bottom, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                PixelCaption(text: "Schulkalender")
                Text("Kalender")
                    .font(.work(sizeClass == .regular ? 40 : 30, .light))
                    .tracking(-1.1)
                    .foregroundStyle(Quill.ink)
            }
            Spacer(minLength: 0)
            Picker("Ansicht", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(width: 260)
            .padding(.bottom, 4)
        }
        .padding(.horizontal, sizeClass == .regular ? 40 : 16)
        .padding(.top, sizeClass == .regular ? 32 : 16)
        .padding(.bottom, 12)
    }
}

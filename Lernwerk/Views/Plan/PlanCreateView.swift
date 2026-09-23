import SwiftData
import SwiftUI

struct PlanCreateView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @EnvironmentObject private var settings: AppSettings
    @Query(sort: \StudyMaterial.createdAt) private var materials: [StudyMaterial]

    @State private var selection = Set<UUID>()
    @State private var title = "Prüfungsvorbereitung"
    @State private var examDate = Calendar.current.date(byAdding: .day, value: 28, to: .now) ?? .now
    @State private var minutesPerDay = 45
    @State private var isGenerating = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    PixelCaption(text: "Material")
                        .padding(.bottom, 6)
                    if materials.isEmpty {
                        Text("Importiere zuerst ein PDF in der Bibliothek.")
                            .font(.work(15))
                            .foregroundStyle(Quill.faint)
                            .padding(.vertical, 14)
                            .padding(.horizontal, 2)
                            .overlay(alignment: .bottom) { QuillDivider() }
                    }
                    ForEach(materials) { material in
                        Button {
                            toggle(material.id)
                        } label: {
                            HStack(spacing: 14) {
                                Text(material.title)
                                    .font(.work(15.5))
                                    .foregroundStyle(Quill.ink)
                                Spacer()
                                CheckCircle(isOn: selection.contains(material.id))
                            }
                            .padding(.vertical, 15)
                            .padding(.horizontal, 2)
                            .overlay(alignment: .bottom) { QuillDivider() }
                        }
                        .buttonStyle(QuillPressStyle())
                    }

                    PixelCaption(text: "Prüfung")
                        .padding(.top, 28)
                        .padding(.bottom, 6)
                    QuillRow(label: "Titel", verticalPadding: 8) {
                        TextField("Titel", text: $title)
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                            .multilineTextAlignment(.trailing)
                    }
                    QuillRow(label: "Termin", verticalPadding: 8) {
                        DatePicker("Termin", selection: $examDate, in: Date()..., displayedComponents: .date)
                            .labelsHidden()
                            .tint(Quill.accent)
                    }
                    QuillRow(label: "\(minutesPerDay) Minuten pro Tag", verticalPadding: 10) {
                        minutesStepper
                    }

                    if let errorMessage {
                        HStack(alignment: .firstTextBaseline, spacing: 9) {
                            StatusDot(color: Quill.warn)
                                .alignmentGuide(.firstTextBaseline) { $0[.bottom] - 1 }
                            Text(errorMessage)
                                .font(.work(14))
                                .lineSpacing(3)
                                .foregroundStyle(Quill.ink2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                        .padding(.top, 20)
                    }
                }
                .padding(.horizontal, 24)
                .padding(.top, 22)
                .padding(.bottom, 30)
            }
            .scrollIndicators(.hidden)
        }
        .background(Quill.bg.ignoresSafeArea())
        .overlay {
            if isGenerating {
                generatingOverlay
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: isGenerating)
        .interactiveDismissDisabled(isGenerating)
        .presentationBackground(Quill.bg)
        .presentationCornerRadius(24)
    }

    private var header: some View {
        ZStack {
            Text("Neuer Lernplan")
                .font(.work(16, .medium))
                .tracking(-0.24)
                .foregroundStyle(Quill.ink)
            HStack {
                Button("Abbrechen") { dismiss() }
                    .font(.work(15))
                    .foregroundStyle(Quill.muted)
                    .buttonStyle(.plain)
                    .disabled(isGenerating)
                Spacer()
                Button("Erstellen", action: generate)
                    .buttonStyle(QuillPrimaryButtonStyle(height: 34, fontSize: 14))
                    .disabled(selection.isEmpty || isGenerating)
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 18)
        .overlay(alignment: .bottom) { QuillDivider(color: Quill.lineSoft) }
    }

    private var minutesStepper: some View {
        HStack(spacing: 0) {
            Button {
                minutesPerDay = max(15, minutesPerDay - 15)
            } label: {
                Text("−").frame(width: 44, height: 32)
            }
            Rectangle().fill(Quill.line2).frame(width: 1, height: 32)
            Button {
                minutesPerDay = min(240, minutesPerDay + 15)
            } label: {
                Text("+").frame(width: 44, height: 32)
            }
        }
        .font(.work(16))
        .foregroundStyle(Quill.ink)
        .buttonStyle(.plain)
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Quill.line2, lineWidth: 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Minuten pro Tag")
        .accessibilityValue("\(minutesPerDay)")
        .accessibilityAdjustableAction { direction in
            switch direction {
            case .increment: minutesPerDay = min(240, minutesPerDay + 15)
            case .decrement: minutesPerDay = max(15, minutesPerDay - 15)
            @unknown default: break
            }
        }
    }

    private var generatingOverlay: some View {
        ZStack {
            Quill.scrim.ignoresSafeArea()
            VStack(spacing: 12) {
                PulsingDots(size: 6)
                Text("Die KI liest dein Material …")
                    .font(.work(16, .medium))
                    .tracking(-0.16)
                    .foregroundStyle(Quill.ink)
                Text("Je nach Umfang dauert das bis zu zwei Minuten.")
                    .font(.work(12.5))
                    .foregroundStyle(Quill.faint)
            }
            .padding(.horizontal, 32)
            .padding(.vertical, 28)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        }
    }

    private func toggle(_ id: UUID) {
        if selection.contains(id) {
            selection.remove(id)
        } else {
            selection.insert(id)
        }
    }

    private func generate() {
        let chosen = materials.filter { selection.contains($0.id) }
        let client = settings.makeClient(for: .plan)
        let planTitle = title.trimmingCharacters(in: .whitespaces).isEmpty ? "Lernplan" : title
        isGenerating = true
        errorMessage = nil

        Task { @MainActor in
            defer { isGenerating = false }
            do {
                let inputs = try chosen.map { try PlanGenerator.Input(title: $0.title, pdf: Data(contentsOf: $0.fileURL)) }
                let drafts = try await PlanGenerator(client: client).generate(from: inputs)
                let schedule = PlanScheduler.schedule(drafts, start: .now, examDate: examDate, minutesPerDay: minutesPerDay)

                let plan = StudyPlan(
                    title: planTitle,
                    examDate: examDate,
                    minutesPerDay: minutesPerDay,
                    isOverbooked: schedule.isOverbooked
                )
                modelContext.insert(plan)
                for item in schedule.topics {
                    let index = item.draft.materialIndex
                    plan.topics.append(PlanTopic(
                        title: item.draft.title,
                        summary: item.draft.summary,
                        materialID: chosen.indices.contains(index) ? chosen[index].id : nil,
                        sourcePages: item.draft.sourcePages,
                        estimatedMinutes: item.draft.estimatedMinutes,
                        order: item.order,
                        scheduledDate: item.date
                    ))
                }
                dismiss()
            } catch {
                errorMessage = error.localizedDescription
            }
        }
    }
}

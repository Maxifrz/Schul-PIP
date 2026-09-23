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
        NavigationStack {
            Form {
                Section("Material") {
                    if materials.isEmpty {
                        Text("Importiere zuerst ein PDF in der Bibliothek.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(materials) { material in
                        Button {
                            toggle(material.id)
                        } label: {
                            HStack {
                                Text(material.title)
                                    .foregroundStyle(.primary)
                                Spacer()
                                if selection.contains(material.id) {
                                    Image(systemName: "checkmark")
                                        .foregroundStyle(.tint)
                                }
                            }
                        }
                    }
                }
                Section("Prüfung") {
                    TextField("Titel", text: $title)
                    DatePicker("Termin", selection: $examDate, in: Date()..., displayedComponents: .date)
                    Stepper("\(minutesPerDay) Minuten pro Tag", value: $minutesPerDay, in: 15...240, step: 15)
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }
            }
            .disabled(isGenerating)
            .overlay {
                if isGenerating {
                    generatingOverlay
                }
            }
            .navigationTitle("Neuer Lernplan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                        .disabled(isGenerating)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Erstellen", action: generate)
                        .disabled(selection.isEmpty || isGenerating)
                }
            }
        }
    }

    private var generatingOverlay: some View {
        VStack(spacing: 12) {
            ProgressView()
                .controlSize(.large)
            Text("Die KI liest dein Material …")
                .font(.headline)
            Text("Je nach Umfang dauert das bis zu zwei Minuten.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
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

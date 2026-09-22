import SwiftData
import SwiftUI

struct PlanListView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \StudyPlan.createdAt, order: .reverse) private var plans: [StudyPlan]

    @State private var isCreating = false

    var body: some View {
        NavigationStack {
            Group {
                if plans.isEmpty {
                    ContentUnavailableView {
                        Label("Noch kein Lernplan", systemImage: "calendar.badge.plus")
                    } description: {
                        Text("Wähl dein Material und den Prüfungstermin. Die KI zerlegt den Stoff in Lerneinheiten und verteilt sie bis zur Prüfung.")
                    } actions: {
                        Button("Lernplan erstellen") {
                            isCreating = true
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } else {
                    List {
                        ForEach(plans) { plan in
                            NavigationLink {
                                PlanDetailView(plan: plan)
                            } label: {
                                PlanRow(plan: plan)
                            }
                        }
                        .onDelete { offsets in
                            for plan in offsets.map({ plans[$0] }) {
                                modelContext.delete(plan)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Lernplan")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isCreating = true
                    } label: {
                        Label("Neuer Lernplan", systemImage: "plus")
                    }
                }
            }
            .sheet(isPresented: $isCreating) {
                PlanCreateView()
                    .environmentObject(settings)
            }
        }
    }
}

private struct PlanRow: View {
    let plan: StudyPlan

    var body: some View {
        let done = plan.topics.filter(\.isDone).count
        VStack(alignment: .leading, spacing: 6) {
            Text(plan.title)
                .font(.headline)
            Text("Prüfung am \(plan.examDate.formatted(date: .long, time: .omitted))")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            ProgressView(value: Double(done), total: Double(max(plan.topics.count, 1)))
            Text("\(done) von \(plan.topics.count) Themen erledigt")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.vertical, 4)
    }
}

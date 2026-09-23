import SwiftData
import SwiftUI

struct PlanListView: View {
    @EnvironmentObject private var settings: AppSettings
    @Environment(\.modelContext) private var modelContext
    @Query(sort: \StudyPlan.createdAt, order: .reverse) private var plans: [StudyPlan]

    @State private var isCreating = false

    var body: some View {
        ScrollView {
            ContentColumn {
                if plans.isEmpty {
                    emptyState
                } else {
                    PageHeader(caption: countLabel, title: "Lernplan") {
                        Button("Neuer Lernplan") { isCreating = true }
                            .buttonStyle(QuillPrimaryButtonStyle())
                    }
                    .padding(.bottom, 30)

                    VStack(spacing: 0) {
                        QuillDivider()
                        ForEach(plans) { plan in
                            NavigationLink(value: Route.plan(plan)) {
                                PlanRow(plan: plan)
                            }
                            .buttonStyle(QuillPressStyle())
                            .contextMenu {
                                Button(role: .destructive) {
                                    modelContext.delete(plan)
                                } label: {
                                    Label("Löschen", systemImage: "trash")
                                }
                            }
                        }
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        .sheet(isPresented: $isCreating) {
            PlanCreateView()
                .environmentObject(settings)
        }
    }

    private var countLabel: String {
        plans.count == 1 ? "1 Lernplan" : "\(plans.count) Lernpläne"
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Lernplan")
            Text("Noch kein Lernplan")
                .font(.work(34, .light))
                .tracking(-0.85)
                .foregroundStyle(Quill.ink)
                .padding(.top, 16)
            Text("Wähl dein Material und den Prüfungstermin. Die KI zerlegt den Stoff in Lerneinheiten und verteilt sie bis zur Prüfung.")
                .font(.work(15.5))
                .lineSpacing(5)
                .foregroundStyle(Quill.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
                .padding(.bottom, 30)
            Button("Lernplan erstellen") { isCreating = true }
                .buttonStyle(QuillPrimaryButtonStyle(height: 48, fontSize: 15.5))
        }
        .frame(maxWidth: 460, alignment: .leading)
        .padding(.top, 70)
    }
}

private struct PlanRow: View {
    let plan: StudyPlan

    var body: some View {
        let done = plan.topics.filter(\.isDone).count
        let total = plan.topics.count
        VStack(alignment: .leading, spacing: 7) {
            Text(plan.title)
                .font(.work(17, .medium))
                .tracking(-0.25)
                .foregroundStyle(Quill.ink)
            Text("Prüfung am \(plan.examDate.formatted(date: .long, time: .omitted))")
                .font(.work(14))
                .foregroundStyle(Quill.muted)
            QuillProgressBar(fraction: total == 0 ? 0 : Double(done) / Double(total))
                .padding(.top, 6)
                .padding(.bottom, 2)
            Text("\(done) von \(total) Themen erledigt")
                .font(.work(12.5))
                .foregroundStyle(Quill.faint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 20)
        .padding(.horizontal, 2)
        .overlay(alignment: .bottom) { QuillDivider() }
    }
}

import SwiftUI

/// What the student sees while a presentation is being built: the steps, the plan's slides as soon as the plan
/// exists (each with its message), and the written slides turning up in their places one after another.
struct PresentationBuildView: View {
    let stage: PresentationAssistant.Stage
    let step: Int
    let stepCount: Int
    let outline: PresentationPrompt.Outline?
    let draft: Presentation?
    /// How many of the draft's slides are shown so far.
    let revealed: Int
    let images: [String: UIImage]

    private var count: Int { max(outline?.slides.count ?? 0, draft?.slides.count ?? 0) }

    var body: some View {
        VStack(spacing: 0) {
            header
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 220, maximum: 340), spacing: 18, alignment: .top)], alignment: .leading, spacing: 20) {
                    if count == 0 {
                        ForEach(0..<6, id: \.self) { index in
                            placeholder(number: index + 1, role: "", message: "")
                        }
                    } else {
                        ForEach(0..<count, id: \.self) { index in
                            card(index)
                        }
                    }
                }
                .padding(.horizontal, 24)
                .padding(.vertical, 20)
                .animation(.spring(response: 0.45, dampingFraction: 0.85), value: revealed)
            }
            .scrollIndicators(.hidden)
        }
        .background(Quill.bg.ignoresSafeArea())
    }

    // Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                PulsingDots(size: 5)
                Text(outline.map { $0.title.isBlank ? "Deine Präsentation entsteht" : $0.title } ?? "Deine Präsentation entsteht")
                    .font(.work(19, .medium))
                    .tracking(-0.2)
                    .foregroundStyle(Quill.ink)
                    .lineLimit(1)
                Spacer()
                Text("Schritt \(max(step, 1)) von \(max(stepCount, step))")
                    .font(.work(12.5))
                    .foregroundStyle(Quill.faint)
            }
            HStack(spacing: 8) {
                ForEach(PresentationAssistant.Stage.allCases, id: \.rawValue) { item in
                    stageChip(item)
                }
            }
            Text(stage.label)
                .font(.work(13.5))
                .foregroundStyle(Quill.muted)
        }
        .padding(.horizontal, 24)
        .padding(.top, 22)
        .padding(.bottom, 14)
        .overlay(alignment: .bottom) { QuillDivider() }
    }

    private func stageChip(_ item: PresentationAssistant.Stage) -> some View {
        let done = item.rawValue < stage.rawValue
        let current = item == stage
        return HStack(spacing: 5) {
            if done {
                Image(systemName: "checkmark").font(.system(size: 10, weight: .bold))
            }
            Text(short(item)).font(.work(12.5, .medium))
        }
        .foregroundStyle(current ? Quill.onAccent : (done ? Quill.link : Quill.faint))
        .padding(.horizontal, 11)
        .frame(height: 28)
        .background(Capsule().fill(current ? Quill.accent : (done ? Quill.accent.opacity(0.16) : Quill.hover)))
    }

    private func short(_ item: PresentationAssistant.Stage) -> String {
        switch item {
        case .outline: return "Roter Faden"
        case .research: return "Recherche"
        case .slides: return "Folien"
        case .review: return "Prüfung"
        }
    }

    // Slides

    @ViewBuilder
    private func card(_ index: Int) -> some View {
        if let draft, index < draft.slides.count, index < revealed {
            VStack(alignment: .leading, spacing: 7) {
                SlideCanvas(slide: draft.slides[index], theme: draft.theme, images: images, index: index)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line, lineWidth: 1))
                    .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
                Text("\(index + 1)")
                    .font(.work(11.5, .medium))
                    .foregroundStyle(Quill.faint)
            }
            .transition(.scale(scale: 0.9).combined(with: .opacity))
        } else {
            let entry = outline.flatMap { index < $0.slides.count ? $0.slides[index] : nil }
            placeholder(number: index + 1, role: entry?.role ?? "", message: entry?.message ?? "")
        }
    }

    /// A slide that is planned but not written yet: its number, role and message from the plan.
    private func placeholder(number: Int, role: String, message: String) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            TimelineView(.animation(minimumInterval: 1.0 / 20)) { timeline in
                let pulse = 0.5 + 0.5 * sin(timeline.date.timeIntervalSinceReferenceDate * 2.4 + Double(number))
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Quill.surface)
                    RoundedRectangle(cornerRadius: 6, style: .continuous).fill(Quill.accent.opacity(0.05 + 0.07 * pulse))
                    VStack(alignment: .leading, spacing: 8) {
                        if !role.isBlank {
                            PixelCaption(text: role, color: Quill.link, size: 8)
                        }
                        if message.isBlank {
                            RoundedRectangle(cornerRadius: 3).fill(Quill.line2).frame(height: 8)
                            RoundedRectangle(cornerRadius: 3).fill(Quill.line2).frame(width: 90, height: 8)
                        } else {
                            Text(message)
                                .font(.work(13, .medium))
                                .foregroundStyle(Quill.ink2)
                                .lineLimit(4)
                        }
                    }
                    .padding(14)
                }
                .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(Quill.line, style: StrokeStyle(lineWidth: 1, dash: [4, 3])))
            }
            .aspectRatio(16 / 9, contentMode: .fit)
            Text("\(number)")
                .font(.work(11.5, .medium))
                .foregroundStyle(Quill.hint)
        }
    }
}

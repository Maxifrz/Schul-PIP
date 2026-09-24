import SwiftUI

/// Full-screen presenting: tap right/left to move, drag for a laser pointer, notes on demand.
struct PresentView: View {
    let presentation: Presentation
    let images: [String: UIImage]

    @Environment(\.dismiss) private var dismiss
    @State private var index: Int
    @State private var showsNotes = false
    @State private var laser: CGPoint?
    @State private var started = Date()
    @FocusState private var isFocused: Bool

    init(presentation: Presentation, images: [String: UIImage], startIndex: Int) {
        self.presentation = presentation
        self.images = images
        _index = State(initialValue: min(max(startIndex, 0), max(presentation.slides.count - 1, 0)))
    }

    var body: some View {
        VStack(spacing: 0) {
            GeometryReader { geometry in
                let width = min(geometry.size.width, geometry.size.height * 16 / 9)
                ZStack {
                    if presentation.slides.indices.contains(index) {
                        SlideCanvas(slide: presentation.slides[index], theme: presentation.theme, images: images)
                            .id(index)
                            .transition(.opacity)
                    }
                    if let laser {
                        Circle()
                            .fill(RadialGradient(colors: [Color.red.opacity(0.6), Color.red.opacity(0)], center: .center, startRadius: 0, endRadius: 26))
                            .frame(width: 52, height: 52)
                            .overlay(Circle().fill(Color.red).frame(width: 12, height: 12))
                            .position(laser)
                            .allowsHitTesting(false)
                    }
                }
                .frame(width: width, height: width * 9 / 16)
                .contentShape(Rectangle())
                .gesture(
                    DragGesture(minimumDistance: 8)
                        .onChanged { laser = $0.location }
                        .onEnded { _ in laser = nil }
                )
                .onTapGesture(coordinateSpace: .local) { location in
                    if location.x < width / 3 { previous() } else { next() }
                }
                .position(x: geometry.size.width / 2, y: geometry.size.height / 2)
            }
            .overlay(alignment: .topTrailing) {
                HStack(spacing: 8) {
                    chip(showsNotes ? "Notizen aus" : "Notizen") { showsNotes.toggle() }
                    chip("Beenden") { dismiss() }
                }
                .padding(12)
            }
            if showsNotes {
                presenterBar
            }
        }
        .background(Color.black.ignoresSafeArea())
        .animation(.easeInOut(duration: 0.2), value: index)
        .statusBarHidden()
        .persistentSystemOverlays(.hidden)
        // Presenter remotes and keyboards send arrow keys or space.
        .focusable()
        .focused($isFocused)
        .onKeyPress(.rightArrow) { next(); return .handled }
        .onKeyPress(.downArrow) { next(); return .handled }
        .onKeyPress(.space) { next(); return .handled }
        .onKeyPress(.leftArrow) { previous(); return .handled }
        .onKeyPress(.upArrow) { previous(); return .handled }
        .onAppear {
            isFocused = true
            started = Date()
        }
    }

    private func next() {
        index = min(presentation.slides.count - 1, index + 1)
    }

    private func previous() {
        index = max(0, index - 1)
    }

    private func chip(_ label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.work(13, .medium))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(height: 32)
                .background(Color.black.opacity(0.4), in: Capsule())
        }
        .buttonStyle(.plain)
    }

    private var presenterBar: some View {
        HStack(alignment: .top, spacing: 20) {
            TimelineView(.periodic(from: .now, by: 1)) { timeline in
                let elapsed = max(0, Int(timeline.date.timeIntervalSince(started)))
                VStack(alignment: .leading, spacing: 6) {
                    Text("\(index + 1) / \(presentation.slides.count)")
                        .font(.work(28, .light))
                        .foregroundStyle(.white)
                    Text(String(format: "%d:%02d / %d:00", elapsed / 60, elapsed % 60, presentation.minutes))
                        .font(.work(15))
                        .monospacedDigit()
                        .foregroundStyle(elapsed > presentation.minutes * 60 ? Color(SlideDrawing.uiColor(0xD6A762)) : Color(SlideDrawing.uiColor(0x9B978D)))
                }
            }
            .frame(width: 150, alignment: .leading)
            ScrollView {
                VStack(alignment: .leading, spacing: 8) {
                    PixelCaption(text: "Notizen", color: Color(SlideDrawing.uiColor(0x807C73)), size: 9)
                    let notes = presentation.slides.indices.contains(index) ? presentation.slides[index].notes : ""
                    Text(notes.isBlank ? "Keine Notizen für diese Folie." : notes)
                        .font(.work(18))
                        .lineSpacing(9)
                        .foregroundStyle(Color(SlideDrawing.uiColor(0xF1EFE7)))
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
            VStack(alignment: .leading, spacing: 6) {
                PixelCaption(text: "Als Nächstes", color: Color(SlideDrawing.uiColor(0x807C73)), size: 9)
                if presentation.slides.indices.contains(index + 1) {
                    SlideCanvas(slide: presentation.slides[index + 1], theme: presentation.theme, images: images)
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                } else {
                    Text("Ende der Präsentation")
                        .font(.work(14))
                        .foregroundStyle(Color(SlideDrawing.uiColor(0x9B978D)))
                }
            }
            .frame(width: 220)
        }
        .padding(18)
        .frame(height: 200)
        .frame(maxWidth: .infinity)
        .background(Color(SlideDrawing.uiColor(0x16150F)))
    }
}

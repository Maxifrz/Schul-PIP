import Foundation

/// Everything the editor changes goes through here, so every edit can be undone. Gestures preview changes on every
/// frame and record a single undo step when the finger lifts. Mirrors EditorState on Android.
@MainActor
final class PresentationEditorModel: ObservableObject {
    @Published private(set) var presentation: Presentation
    @Published var slideIndex = 0
    @Published var selectedID: String?
    @Published private(set) var editingID: String?
    @Published var verticalGuides: [Double] = []
    @Published var horizontalGuides: [Double] = []
    @Published private(set) var canUndo = false
    @Published private(set) var canRedo = false

    private var undoStack: [Presentation] = [] { didSet { canUndo = !undoStack.isEmpty } }
    private var redoStack: [Presentation] = [] { didSet { canRedo = !redoStack.isEmpty } }
    private var gestureBase: Presentation?
    private let save: @MainActor (Presentation) -> Void

    init(_ presentation: Presentation, save: @escaping @MainActor (Presentation) -> Void) {
        var initial = presentation
        if initial.slides.isEmpty { initial.slides = [SlideLayouts.preset(.title)] }
        self.presentation = initial
        self.save = save
    }

    var slide: Slide { presentation.slides[min(max(slideIndex, 0), presentation.slides.count - 1)] }
    var selected: SlideElement? { slide.elements.first { $0.id == selectedID } }
    var editing: SlideElement? { slide.elements.first { $0.id == editingID } }

    // History

    func commit(_ next: Presentation) {
        guard next != presentation else { return }
        push(presentation)
        presentation = next
        save(next)
    }

    /// A change that is saved but not worth its own undo step, like typing speaker notes.
    func silent(_ next: Presentation) {
        presentation = next
        save(next)
    }

    func beginGesture() {
        if gestureBase == nil { gestureBase = presentation }
    }

    func preview(_ next: Presentation) {
        presentation = next
    }

    func endGesture() {
        guard let base = gestureBase else { return }
        gestureBase = nil
        if base != presentation {
            push(base)
            save(presentation)
        }
    }

    private func push(_ previous: Presentation) {
        undoStack.append(previous)
        if undoStack.count > 80 { undoStack.removeFirst() }
        redoStack.removeAll()
    }

    func undo() {
        finishEditing()
        guard let previous = undoStack.popLast() else { return }
        redoStack.append(presentation)
        presentation = previous
        afterHistoryChange()
    }

    func redo() {
        finishEditing()
        guard let next = redoStack.popLast() else { return }
        undoStack.append(presentation)
        presentation = next
        afterHistoryChange()
    }

    private func afterHistoryChange() {
        slideIndex = min(slideIndex, presentation.slides.count - 1)
        if selected == nil { selectedID = nil }
        save(presentation)
    }

    // Slides

    private func mapSlide(_ transform: (Slide) -> Slide) -> Presentation {
        var next = presentation
        let index = min(max(slideIndex, 0), next.slides.count - 1)
        next.slides[index] = transform(next.slides[index])
        return next
    }

    func updateSlide(record: Bool = true, _ transform: (Slide) -> Slide) {
        let next = mapSlide(transform)
        if record { commit(next) } else { preview(next) }
    }

    func updateElement(_ id: String, record: Bool = true, _ transform: (SlideElement) -> SlideElement) {
        updateSlide(record: record) { slide in
            var copy = slide
            copy.elements = slide.elements.map { $0.id == id ? transform($0) : $0 }
            return copy
        }
    }

    func selectSlide(_ index: Int) {
        finishEditing()
        slideIndex = min(max(index, 0), presentation.slides.count - 1)
        selectedID = nil
    }

    func addSlide(_ layout: SlideLayout) {
        finishEditing()
        var next = presentation
        next.slides.insert(SlideLayouts.preset(layout), at: slideIndex + 1)
        commit(next)
        selectSlide(slideIndex + 1)
    }

    func duplicateSlide(_ index: Int) {
        var copy = presentation.slides[index]
        copy.id = UUID().uuidString
        copy.elements = copy.elements.map { element in
            var duplicate = element
            duplicate.id = UUID().uuidString
            return duplicate
        }
        var next = presentation
        next.slides.insert(copy, at: index + 1)
        commit(next)
        selectSlide(index + 1)
    }

    func deleteSlide(_ index: Int) {
        guard presentation.slides.count > 1 else { return }
        var next = presentation
        next.slides.remove(at: index)
        commit(next)
        selectSlide(min(slideIndex, next.slides.count - 1))
    }

    func moveSlide(_ index: Int, by delta: Int) {
        let target = index + delta
        guard presentation.slides.indices.contains(target) else { return }
        var next = presentation
        next.slides.insert(next.slides.remove(at: index), at: target)
        commit(next)
        selectSlide(target)
    }

    func replaceSlide(_ slide: Slide) {
        commit(mapSlide { _ in slide })
        if selected == nil { selectedID = nil }
    }

    func rename(_ title: String) {
        var next = presentation
        next.title = title.isBlank ? "Präsentation" : title.trimmingCharacters(in: .whitespacesAndNewlines)
        commit(next)
    }

    func setTheme(_ id: String) {
        var next = presentation
        next.themeId = id
        commit(next)
    }

    func setMinutes(_ minutes: Int) {
        var next = presentation
        next.minutes = minutes
        silent(next)
    }

    func setNotes(_ notes: String) {
        silent(mapSlide { slide in
            var copy = slide
            copy.notes = notes
            return copy
        })
    }

    func replacePresentation(_ next: Presentation) {
        commit(next)
        slideIndex = min(slideIndex, presentation.slides.count - 1)
    }

    // Elements

    func addElement(_ element: SlideElement, edit: Bool = false) {
        finishEditing()
        updateSlide { slide in
            var copy = slide
            copy.elements.append(element)
            return copy
        }
        selectedID = element.id
        if edit { startEditing(element.id) }
    }

    func deleteSelected() {
        guard let id = selectedID else { return }
        finishEditing()
        updateSlide { slide in
            var copy = slide
            copy.elements.removeAll { $0.id == id }
            return copy
        }
        selectedID = nil
    }

    func duplicateSelected() {
        guard var copy = selected else { return }
        copy.id = UUID().uuidString
        copy.x += 16
        copy.y += 16
        addElement(copy)
    }

    func reorderSelected(forward: Bool) {
        guard let id = selectedID else { return }
        updateSlide { slide in
            var copy = slide
            guard let index = copy.elements.firstIndex(where: { $0.id == id }) else { return slide }
            let target = forward ? index + 1 : index - 1
            guard copy.elements.indices.contains(target) else { return slide }
            copy.elements.swapAt(index, target)
            return copy
        }
    }

    func startEditing(_ id: String) {
        guard slide.elements.first(where: { $0.id == id })?.kind == .text else { return }
        selectedID = id
        beginGesture()
        editingID = id
    }

    func finishEditing() {
        guard editingID != nil else { return }
        editingID = nil
        endGesture()
    }
}

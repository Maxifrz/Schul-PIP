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
        next.slides[index] = transform(next.slides[index]).editedFrom(next.slides[index])
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

    /// A new slide of a component with its placeholder content, after the current one.
    func addSlide(_ component: SlideComponent) {
        finishEditing()
        var next = presentation
        next.slides.insert(ComponentRegistry.preset(component, theme: presentation.theme), at: slideIndex + 1)
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

    /// One motion style for the whole deck; replaces every transition and animation.
    func setMotion(_ preset: MotionPreset) {
        finishEditing()
        commit(MotionPlanner.apply(preset, to: presentation))
    }

    /// A design suggestion: its theme, and with `withMotion` its motion style too, as one undo step.
    func applyDesign(_ suggestion: DesignSuggestion, withMotion: Bool) {
        finishEditing()
        var next = withMotion ? MotionPlanner.apply(suggestion.motion, to: presentation) : presentation
        next.themeId = suggestion.themeID
        commit(next)
    }

    /// How the current slide comes in; nil for the short cross-fade.
    func setTransition(_ transition: SlideTransition?) {
        updateSlide { slide in
            var copy = slide
            copy.transition = transition
            return copy
        }
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

    /// The selected element and, when it belongs to a group like a dropped module, everything grouped with it.
    var selectedGroup: [SlideElement] {
        guard let element = selected else { return [] }
        guard let group = element.group else { return [element] }
        return slide.elements.filter { $0.group == group }
    }

    func deleteSelected() {
        guard let id = selectedID else { return }
        finishEditing()
        let group = selected?.group
        updateSlide { slide in
            var copy = slide
            copy.elements.removeAll { $0.id == id || (group != nil && $0.group == group) }
            return copy
        }
        selectedID = nil
    }

    func duplicateSelected() {
        guard selected != nil else { return }
        finishEditing()
        let parts = selectedGroup
        let group = parts.first?.group == nil ? nil : UUID().uuidString
        let copies = parts.map { part -> SlideElement in
            var copy = part
            copy.id = UUID().uuidString
            copy.group = group
            copy.x += 16
            copy.y += 16
            return copy
        }
        updateSlide { slide in
            var next = slide
            next.elements.append(contentsOf: copies)
            return next
        }
        selectedID = copies.first?.id
    }

    /// A dragged element takes its group along. `base` is the element as the drag began; the others follow by the
    /// same distance from where they were then.
    func move(_ base: SlideElement, to candidate: SlideElement) {
        guard let group = base.group, let start = gestureBase?.slides[safe: slideIndex] else {
            updateElement(base.id, record: false) { _ in candidate }
            return
        }
        let dx = candidate.x - base.x
        let dy = candidate.y - base.y
        let starts = Dictionary(uniqueKeysWithValues: start.elements.filter { $0.group == group }.map { ($0.id, $0) })
        updateSlide(record: false) { slide in
            var next = slide
            next.elements = slide.elements.map { element in
                guard var first = starts[element.id] else { return element }
                first.x += dx
                first.y += dy
                return first
            }
            return next
        }
    }

    /// A module from the library, dropped with its middle at `center` (slide points) or in the middle of the slide.
    func addModule(_ component: SlideComponent, center: (x: Double, y: Double)? = nil) {
        finishEditing()
        let parts = SlideModules.elements(for: component, theme: presentation.theme, center: center)
        guard !parts.isEmpty else { return }
        updateSlide { slide in
            var next = slide
            next.elements.append(contentsOf: parts)
            return next
        }
        selectedID = parts.first?.id
    }

    /// The selected group bigger or smaller around its middle.
    func scaleSelectedGroup(by factor: Double) {
        guard selected?.group != nil else { return }
        finishEditing()
        let ids = Set(selectedGroup.map(\.id))
        let scaled = SlideModules.scaled(selectedGroup, by: factor)
        let byID = Dictionary(uniqueKeysWithValues: scaled.map { ($0.id, $0) })
        updateSlide { slide in
            var next = slide
            next.elements = slide.elements.map { ids.contains($0.id) ? (byID[$0.id] ?? $0) : $0 }
            return next
        }
    }

    /// Makes the parts of a group single elements again.
    func ungroupSelected() {
        guard let group = selected?.group else { return }
        finishEditing()
        updateSlide { slide in
            var next = slide
            next.elements = slide.elements.map { element in
                guard element.group == group else { return element }
                var single = element
                single.group = nil
                return single
            }
            return next
        }
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

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

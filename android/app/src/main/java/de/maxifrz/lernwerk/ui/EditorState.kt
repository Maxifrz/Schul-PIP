package de.maxifrz.lernwerk.ui

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import de.maxifrz.lernwerk.present.ElementKind
import de.maxifrz.lernwerk.present.Presentation
import de.maxifrz.lernwerk.present.Slide
import de.maxifrz.lernwerk.present.SlideElement
import de.maxifrz.lernwerk.present.SlideLayout
import de.maxifrz.lernwerk.present.SlideLayouts

/**
 * Everything the editor changes goes through here, so every edit can be undone. Gestures preview changes on every
 * frame and record a single undo step when the finger lifts.
 */
class EditorState(initial: Presentation, private val save: (Presentation) -> Unit) {
    var presentation by mutableStateOf(ensureSlides(initial))
        private set
    var slideIndex by mutableIntStateOf(0)
    var selectedId by mutableStateOf<String?>(null)
    var editingId by mutableStateOf<String?>(null)
        private set

    /** Snap guides in slide points while an element is being moved. */
    var verticalGuides by mutableStateOf(emptyList<Float>())
    var horizontalGuides by mutableStateOf(emptyList<Float>())

    private val undoStack = mutableStateListOf<Presentation>()
    private val redoStack = mutableStateListOf<Presentation>()
    private var gestureBase: Presentation? = null

    val slide: Slide get() = presentation.slides[slideIndex.coerceIn(0, presentation.slides.lastIndex)]
    val selected: SlideElement? get() = slide.elements.firstOrNull { it.id == selectedId }
    val editing: SlideElement? get() = slide.elements.firstOrNull { it.id == editingId }
    val canUndo get() = undoStack.isNotEmpty()
    val canRedo get() = redoStack.isNotEmpty()

    // History

    fun commit(next: Presentation) {
        if (next == presentation) return
        push(presentation)
        presentation = next
        save(next)
    }

    /** Applies a change that is saved but not worth its own undo step, like typing speaker notes. */
    fun silent(next: Presentation) {
        presentation = next
        save(next)
    }

    fun beginGesture() {
        if (gestureBase == null) gestureBase = presentation
    }

    fun preview(next: Presentation) {
        presentation = next
    }

    fun endGesture() {
        val base = gestureBase ?: return
        gestureBase = null
        if (base != presentation) {
            push(base)
            save(presentation)
        }
    }

    private fun push(previous: Presentation) {
        undoStack += previous
        if (undoStack.size > 80) undoStack.removeAt(0)
        redoStack.clear()
    }

    fun undo() {
        finishEditing()
        val previous = undoStack.removeLastOrNull() ?: return
        redoStack += presentation
        presentation = previous
        afterHistoryChange()
    }

    fun redo() {
        finishEditing()
        val next = redoStack.removeLastOrNull() ?: return
        undoStack += presentation
        presentation = next
        afterHistoryChange()
    }

    private fun afterHistoryChange() {
        slideIndex = slideIndex.coerceIn(0, presentation.slides.lastIndex)
        if (selected == null) selectedId = null
        save(presentation)
    }

    // Slides

    private fun mapSlide(transform: (Slide) -> Slide) =
        presentation.copy(slides = presentation.slides.mapIndexed { index, slide -> if (index == slideIndex) transform(slide) else slide })

    fun updateSlide(record: Boolean = true, transform: (Slide) -> Slide) {
        val next = mapSlide(transform)
        if (record) commit(next) else preview(next)
    }

    fun updateElement(id: String, record: Boolean = true, transform: (SlideElement) -> SlideElement) {
        updateSlide(record) { slide -> slide.copy(elements = slide.elements.map { if (it.id == id) transform(it) else it }) }
    }

    fun selectSlide(index: Int) {
        finishEditing()
        slideIndex = index.coerceIn(0, presentation.slides.lastIndex)
        selectedId = null
    }

    fun addSlide(layout: SlideLayout) {
        finishEditing()
        val slides = presentation.slides.toMutableList()
        slides.add(slideIndex + 1, SlideLayouts.preset(layout))
        commit(presentation.copy(slides = slides))
        selectSlide(slideIndex + 1)
    }

    fun duplicateSlide(index: Int) {
        val original = presentation.slides[index]
        val copy = original.copy(id = SlideElement.newId(), elements = original.elements.map { it.copy(id = SlideElement.newId()) })
        val slides = presentation.slides.toMutableList().apply { add(index + 1, copy) }
        commit(presentation.copy(slides = slides))
        selectSlide(index + 1)
    }

    fun deleteSlide(index: Int) {
        if (presentation.slides.size <= 1) return
        val slides = presentation.slides.toMutableList().apply { removeAt(index) }
        commit(presentation.copy(slides = slides))
        selectSlide(minOf(slideIndex, slides.lastIndex))
    }

    fun moveSlide(index: Int, delta: Int) {
        val target = index + delta
        if (target !in presentation.slides.indices) return
        val slides = presentation.slides.toMutableList()
        slides.add(target, slides.removeAt(index))
        commit(presentation.copy(slides = slides))
        selectSlide(target)
    }

    fun replaceSlide(slide: Slide) {
        commit(mapSlide { slide })
        if (selected == null) selectedId = null
    }

    fun rename(title: String) = commit(presentation.copy(title = title.trim().ifEmpty { "Präsentation" }))

    fun setTheme(id: String) = commit(presentation.copy(themeId = id))

    fun setMinutes(minutes: Int) = silent(presentation.copy(minutes = minutes))

    fun setNotes(notes: String) = silent(mapSlide { it.copy(notes = notes) })

    fun replacePresentation(next: Presentation) {
        commit(ensureSlides(next))
        slideIndex = slideIndex.coerceIn(0, presentation.slides.lastIndex)
    }

    // Elements

    fun addElement(element: SlideElement, edit: Boolean = false) {
        finishEditing()
        updateSlide { it.copy(elements = it.elements + element) }
        selectedId = element.id
        if (edit) startEditing(element.id)
    }

    fun deleteSelected() {
        val id = selectedId ?: return
        finishEditing()
        updateSlide { slide -> slide.copy(elements = slide.elements.filterNot { it.id == id }) }
        selectedId = null
    }

    fun duplicateSelected() {
        val element = selected ?: return
        addElement(element.copy(id = SlideElement.newId(), x = element.x + 16f, y = element.y + 16f))
    }

    /** Moves the selection one step up (true) or down in the stacking order. */
    fun reorderSelected(forward: Boolean) {
        val id = selectedId ?: return
        updateSlide { slide ->
            val list = slide.elements.toMutableList()
            val index = list.indexOfFirst { it.id == id }
            val target = if (forward) index + 1 else index - 1
            if (index < 0 || target !in list.indices) slide else slide.copy(elements = list.apply { add(target, removeAt(index)) })
        }
    }

    fun startEditing(id: String) {
        if (slide.elements.firstOrNull { it.id == id }?.kind != ElementKind.TEXT) return
        selectedId = id
        beginGesture()
        editingId = id
    }

    fun finishEditing() {
        if (editingId == null) return
        editingId = null
        endGesture()
    }

    private companion object {
        fun ensureSlides(presentation: Presentation) =
            if (presentation.slides.isEmpty()) presentation.copy(slides = listOf(SlideLayouts.preset(SlideLayout.TITLE))) else presentation
    }
}

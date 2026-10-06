import PDFKit
import PencilKit
import UIKit

/// The PDF, the marking frame for the tutor, the laser pointer and the zoom window.
final class NotesContainerView: UIView {
    let pdfView = PDFView()
    let markingView = MarkingOverlayView()
    let laserView = LaserView()
    let zoomPanel = ZoomPanelView()
    private let ownUndoManager = UndoManager()
    static let zoomPanelHeight: CGFloat = 230

    override var undoManager: UndoManager? { ownUndoManager }

    override init(frame: CGRect) {
        super.init(frame: frame)
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = QuillUIColor.canvas
        addSubview(pdfView)
        markingView.isHidden = true
        addSubview(markingView)
        laserView.isUserInteractionEnabled = false
        addSubview(laserView)
        zoomPanel.isHidden = true
        addSubview(zoomPanel)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let panel = zoomPanel.isHidden ? 0 : Self.zoomPanelHeight
        pdfView.frame = CGRect(x: 0, y: 0, width: bounds.width, height: bounds.height - panel)
        markingView.frame = pdfView.frame
        laserView.frame = pdfView.frame
        zoomPanel.frame = CGRect(x: 0, y: bounds.height - panel, width: bounds.width, height: panel)
    }

    func setZoomPanel(visible: Bool) {
        guard zoomPanel.isHidden == visible else { return }
        zoomPanel.isHidden = !visible
        setNeedsLayout()
        layoutIfNeeded()
    }

    func region(for rect: CGRect) -> MarkedRegion? {
        let rectInPDFView = convert(rect, to: pdfView)
        let center = CGPoint(x: rectInPDFView.midX, y: rectInPDFView.midY)
        guard let page = pdfView.page(for: center, nearest: true),
              let document = pdfView.document
        else { return nil }

        let rectOnPage = pdfView.convert(rectInPDFView, to: page)
        return MarkedRegion(
            pageIndex: document.index(for: page),
            selectedText: page.selection(for: rectOnPage)?.string ?? "",
            pageText: page.string ?? "",
            imageJPEG: snapshot(of: rectInPDFView)
        )
    }

    /// Captures what the student sees in the region, including their own handwriting.
    private func snapshot(of rect: CGRect) -> Data? {
        let format = UIGraphicsImageRendererFormat()
        format.scale = min(traitCollection.displayScale, 2)
        let renderer = UIGraphicsImageRenderer(bounds: rect, format: format)
        let image = renderer.image { _ in
            self.pdfView.drawHierarchy(in: self.pdfView.bounds, afterScreenUpdates: false)
        }
        return image.jpegData(compressionQuality: 0.8)
    }
}

struct MarkedRegion {
    var pageIndex: Int
    var selectedText: String
    var pageText: String
    var imageJPEG: Data?
}

/// Everything on one PDF page: typed text, pictures and stickers below the ink, the ink canvas, a drawing instrument
/// and the frame of the zoom window.
final class PageOverlayView: UIView {
    var pageIndex: Int
    weak var controller: NotesController?
    let annotationLayer = UIView()
    let canvas = PKCanvasView()
    let instrumentLayer = InstrumentLayerView()
    let lassoLayer = LassoLayerView()
    private let targetLayer = CAShapeLayer()
    private let mathChip = UIButton(type: .system)
    private var mathChipAction: (() -> Void)?
    private(set) var annotationViews: [String: AnnotationView] = [:]
    let tap = UITapGestureRecognizer()
    private var renderedScale: CGFloat = 0
    /// How much larger than the page the ink canvas is laid out; see `layoutCanvas`.
    private var canvasZoom: CGFloat = 1
    private var canvasLayout: (size: CGSize, zoom: CGFloat)?

    init(pageIndex: Int, controller: NotesController) {
        self.pageIndex = pageIndex
        self.controller = controller
        super.init(frame: .zero)
        backgroundColor = .clear
        annotationLayer.backgroundColor = .clear
        addSubview(annotationLayer)
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.isScrollEnabled = false
        canvas.overrideUserInterfaceStyle = .light
        canvas.drawingPolicy = .default
        addSubview(canvas)
        lassoLayer.controller = controller
        lassoLayer.pageIndex = pageIndex
        lassoLayer.isHidden = true
        addSubview(lassoLayer)
        instrumentLayer.controller = controller
        addSubview(instrumentLayer)
        targetLayer.fillColor = QuillUIColor.hex(0x7FA98C, alpha: 0.08).cgColor
        targetLayer.strokeColor = QuillUIColor.hex(0x7FA98C).cgColor
        targetLayer.lineWidth = 1.5
        targetLayer.lineDashPattern = [5, 4]
        targetLayer.isHidden = true
        layer.addSublayer(targetLayer)
        var chip = UIButton.Configuration.filled()
        chip.baseBackgroundColor = QuillUIColor.hex(0x7FA98C)
        chip.baseForegroundColor = QuillUIColor.hex(0x16150F)
        chip.cornerStyle = .capsule
        chip.contentInsets = NSDirectionalEdgeInsets(top: 6, leading: 12, bottom: 6, trailing: 12)
        mathChip.configuration = chip
        mathChip.isHidden = true
        mathChip.addTarget(self, action: #selector(mathChipTapped), for: .touchUpInside)
        addSubview(mathChip)
        tap.addTarget(self, action: #selector(tapped(_:)))
        tap.cancelsTouchesInView = false
        addGestureRecognizer(tap)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        annotationLayer.frame = bounds
        layoutCanvas()
        lassoLayer.frame = bounds
        instrumentLayer.frame = bounds
        targetLayer.frame = bounds
        controller?.overlayDidLayout(self)
    }

    /// Pens get every touch; in the text and lasso tools text, pictures and stickers come first.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, self.point(inside: point, with: event), let tool = controller?.tool else { return nil }
        // The offered result and the instrument lie on top of everything.
        if !mathChip.isHidden, mathChip.frame.contains(point) { return mathChip }
        if let hit = instrumentLayer.hitTest(convert(point, to: instrumentLayer), with: event) { return hit }
        if tool.editsAnnotations {
            for view in annotationLayer.subviews.reversed() {
                if let hit = view.hitTest(convert(point, to: view), with: event) { return hit }
            }
        }
        if tool.usesCanvas {
            // The selection lasso takes the touches itself; the pencil's own lasso (and every pen) go to the canvas.
            if !lassoLayer.isHidden {
                return lassoLayer.hitTest(convert(point, to: lassoLayer), with: event) ?? lassoLayer
            }
            return canvas.hitTest(convert(point, to: canvas), with: event)
        }
        return tool == .typing || tool == .textBox ? self : nil
    }

    /// The page is enlarged by a transform, which stretches what was drawn at the first size. Telling the views and
    /// layers to draw at the enlarged size keeps ink, text and pictures sharp at any zoom; the size on the glass
    /// (`nativeScale` times the zoom) is capped so memory stays in bounds.
    func renderSharp(at zoom: CGFloat) {
        let native = window?.screen.nativeScale ?? UIScreen.main.nativeScale
        let scale = min(max(native * zoom, native), native * 8)
        // PencilKit draws the ink on its own and ignores the scale factor, so the canvas gets its own treatment.
        let canvasZoom = zoom > 1.5 ? min(zoom.rounded(.up), 8) : 1
        if abs(canvasZoom - self.canvasZoom) > 0.01 {
            self.canvasZoom = canvasZoom
            layoutCanvas()
        }
        guard abs(scale - renderedScale) > 0.01 else { return }
        renderedScale = scale
        Self.apply(scale: scale, to: self, skipping: canvas)
    }

    private static func apply(scale: CGFloat, to view: UIView, skipping skipped: UIView) {
        guard view !== skipped else { return }
        view.contentScaleFactor = scale
        view.layer.contentsScale = scale
        view.subviews.forEach { apply(scale: scale, to: $0, skipping: skipped) }
    }

    /// PDFKit enlarges the page by a transform, and PencilKit renders ink at the size it was first laid out, so ink
    /// turns blurry (and the pen, whose width is in page units, looks fat) when zoomed in. Zoomed in, the canvas is laid
    /// out `canvasZoom` times larger, shown at that zoom scale and shrunk back by the inverse transform: it covers the
    /// same area on the page and the ink keeps its page coordinates, but PencilKit draws it at the larger size.
    private func layoutCanvas() {
        // Layout passes are frequent; touching the canvas in the middle of a stroke is not worth it for nothing.
        if let canvasLayout, canvasLayout.size == bounds.size, canvasLayout.zoom == canvasZoom { return }
        canvasLayout = (bounds.size, canvasZoom)
        canvas.transform = .identity
        canvas.pinchGestureRecognizer?.isEnabled = false
        guard canvasZoom > 1 else {
            canvas.minimumZoomScale = 1
            canvas.maximumZoomScale = 1
            canvas.zoomScale = 1
            canvas.frame = bounds
            return
        }
        let scale = canvasZoom
        canvas.minimumZoomScale = 1
        canvas.maximumZoomScale = 8
        canvas.bounds = CGRect(x: 0, y: 0, width: bounds.width * scale, height: bounds.height * scale)
        canvas.center = CGPoint(x: bounds.midX, y: bounds.midY)
        canvas.contentSize = bounds.size
        canvas.zoomScale = scale
        canvas.contentOffset = .zero
        canvas.transform = CGAffineTransform(scaleX: 1 / scale, y: 1 / scale)
    }

    /// The calculated result offered after a written "=", or nil to take it away.
    func showMathChip(_ text: String?, at point: CGPoint, onTap: (() -> Void)?) {
        mathChipAction = onTap
        guard let text else {
            mathChip.isHidden = true
            return
        }
        var configuration = mathChip.configuration
        configuration?.attributedTitle = AttributedString(NSAttributedString(
            string: "= \(text)   Einfügen",
            attributes: [.font: UIFont.systemFont(ofSize: 15, weight: .semibold)]
        ))
        mathChip.configuration = configuration
        mathChip.transform = .identity
        mathChip.sizeToFit()
        mathChip.frame.origin = CGPoint(x: point.x, y: point.y - mathChip.frame.height / 2)
        // Readable at any zoom: the chip keeps its size on the glass.
        let zoom = max(convert(CGRect(x: 0, y: 0, width: 100, height: 1), to: nil).width / 100, 0.01)
        mathChip.transform = CGAffineTransform(scaleX: 1 / zoom, y: 1 / zoom)
        mathChip.frame.origin = CGPoint(x: point.x, y: point.y - mathChip.frame.height / 2)
        mathChip.isHidden = false
        bringSubviewToFront(mathChip)
    }

    @objc private func mathChipTapped() {
        mathChipAction?()
    }

    @objc private func tapped(_ gesture: UITapGestureRecognizer) {
        controller?.tapOnPage(self, at: gesture.location(in: self))
    }

    func showTarget(_ rect: CGRect?) {
        targetLayer.isHidden = rect == nil
        if let rect { targetLayer.path = UIBezierPath(roundedRect: rect, cornerRadius: 4).cgPath }
    }

    /// Brings the views in line with the annotations of this page; a text being edited keeps its state.
    func reload(_ annotations: [PageAnnotation], editingID: String?) {
        let ids = Set(annotations.map(\.id))
        for (id, view) in annotationViews where !ids.contains(id) {
            view.removeFromSuperview()
            annotationViews[id] = nil
        }
        for annotation in annotations {
            if let view = annotationViews[annotation.id] {
                if annotation.id != editingID { view.update(annotation) }
            } else if let controller {
                let view = AnnotationView(annotation: annotation, controller: controller)
                annotationLayer.addSubview(view)
                annotationViews[annotation.id] = view
                if renderedScale > 0 { Self.apply(scale: renderedScale, to: view) }
            }
        }
        updateHandles()
    }

    func updateHandles() {
        let visible = controller?.tool.editsAnnotations ?? false
        annotationViews.values.forEach { $0.showHandles(visible) }
    }
}

/// A text, picture, sticker or table on a page. Pictures and stickers move by dragging; texts and tables by their
/// handle at the top left; everything resizes with the handle at the bottom right. A long press offers duplicate and
/// delete, and for tables rows and columns.
final class AnnotationView: UIView, UITextViewDelegate, UIContextMenuInteractionDelegate {
    private(set) var annotation: PageAnnotation
    weak var controller: NotesController?
    private(set) var textView: UITextView?
    private var tableGrid: TableGridView?
    private var imageView: UIImageView?
    private var label: UILabel?
    private let moveHandle = UIView()
    private let resizeHandle = UIView()
    private var startFrame: CGRect = .zero

    private var look: NoteRichText.Look { NoteRichText.Look(annotation) }

    init(annotation: PageAnnotation, controller: NotesController) {
        self.annotation = annotation
        self.controller = controller
        super.init(frame: annotation.frame)
        overrideUserInterfaceStyle = .light
        switch annotation.kind {
        case .text:
            let textView = UITextView()
            textView.isScrollEnabled = false
            textView.backgroundColor = .clear
            textView.textContainerInset = UIEdgeInsets(top: 4, left: 4, bottom: 4, right: 4)
            textView.textContainer.lineFragmentPadding = 0
            textView.delegate = self
            textView.inputAccessoryView = NoteFormatBar(
                onBlock: { [weak self] block in self?.applyBlock(block) },
                onTable: { [weak self] in
                    guard let self else { return }
                    self.controller?.insertTable(below: self)
                },
                onDone: { [weak self] in self?.textView?.resignFirstResponder() }
            )
            addSubview(textView)
            self.textView = textView
        case .table:
            let grid = TableGridView()
            grid.onBegin = { [weak self] in
                guard let self else { return }
                self.controller?.didBeginEditing(self)
            }
            grid.onChange = { [weak self] _ in self?.fitTable() }
            grid.onEnd = { [weak self] cells in
                guard let self else { return }
                self.controller?.didEndEditingTable(self, cells: cells)
            }
            addSubview(grid)
            tableGrid = grid
        case .image:
            let imageView = UIImageView()
            imageView.contentMode = .scaleAspectFill
            imageView.clipsToBounds = true
            imageView.layer.cornerRadius = 4
            addSubview(imageView)
            self.imageView = imageView
            let drag = UIPanGestureRecognizer(target: self, action: #selector(dragged(_:)))
            addGestureRecognizer(drag)
        case .sticker:
            let label = UILabel()
            label.textAlignment = .center
            label.adjustsFontSizeToFitWidth = true
            label.minimumScaleFactor = 0.3
            label.clipsToBounds = true
            addSubview(label)
            self.label = label
            let drag = UIPanGestureRecognizer(target: self, action: #selector(dragged(_:)))
            addGestureRecognizer(drag)
        }
        for handle in [moveHandle, resizeHandle] {
            handle.backgroundColor = QuillUIColor.hex(0x7FA98C)
            handle.layer.cornerRadius = 9
            handle.layer.borderColor = UIColor.white.cgColor
            handle.layer.borderWidth = 2
            handle.isHidden = true
            addSubview(handle)
        }
        moveHandle.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(dragged(_:))))
        resizeHandle.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(resized(_:))))
        addInteraction(UIContextMenuInteraction(delegate: self))
        update(annotation)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// Handles reach a little outside the frame, so they must still receive touches.
    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        bounds.insetBy(dx: -14, dy: -14).contains(point)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        textView?.frame = bounds
        tableGrid?.frame = bounds
        imageView?.frame = bounds
        label?.frame = bounds
        moveHandle.frame = CGRect(x: -9, y: -9, width: 18, height: 18)
        resizeHandle.frame = CGRect(x: bounds.width - 9, y: bounds.height - 9, width: 18, height: 18)
    }

    func update(_ annotation: PageAnnotation) {
        self.annotation = annotation
        frame = annotation.frame
        switch annotation.kind {
        case .text:
            guard let textView else { break }
            if textView.isFirstResponder {
                // Being typed: the markers stay visible and the caret stays where it is.
                if textView.text != annotation.text {
                    let selection = textView.selectedRange
                    textView.attributedText = NoteRichText.editing(annotation.text, look: look)
                    textView.selectedRange = NSRange(location: min(selection.location, (annotation.text as NSString).length), length: 0)
                } else {
                    NoteRichText.restyle(textView.textStorage, look: look)
                }
                updateTypingAttributes()
            } else {
                textView.attributedText = NoteRichText.display(annotation.text, look: look)
            }
            layer.borderWidth = annotation.boxed ? 1 : 0
            layer.borderColor = QuillUIColor.hex(0x9A968B).cgColor
            layer.cornerRadius = annotation.boxed ? 4 : 0
        case .table:
            tableGrid?.configure(annotation.cells ?? NoteTable.blank(), header: annotation.hasHeader, look: look)
        case .image:
            imageView?.image = annotation.image.flatMap(MaterialStore.noteImage)
        case .sticker:
            guard let label else { break }
            label.text = annotation.text
            if let color = Stickers.color(for: annotation.text) {
                label.font = UIFont(name: QuillFont.Weight.semibold.postScriptName, size: 20) ?? .boldSystemFont(ofSize: 20)
                label.textColor = .white
                label.backgroundColor = QuillUIColor.hex(color)
                label.layer.cornerRadius = 8
            } else {
                label.font = .systemFont(ofSize: max(12, bounds.height * 0.8))
                label.backgroundColor = .clear
            }
        }
        setNeedsLayout()
    }

    func showHandles(_ visible: Bool) {
        moveHandle.isHidden = !visible || !(annotation.kind == .text || annotation.kind == .table)
        resizeHandle.isHidden = !visible
    }

    func beginEditing() {
        if annotation.kind == .table {
            tableGrid?.beginEditing()
        } else {
            textView?.becomeFirstResponder()
        }
    }

    /// What is typed now: the text with its markers, or nil for anything but a text.
    var currentText: String? { textView?.text }

    /// Grows or shrinks a text to fit what is typed.
    func fitText() {
        guard let textView else { return }
        let size = textView.sizeThatFits(CGSize(width: bounds.width, height: .greatestFiniteMagnitude))
        let height = max(annotation.textSize * 1.6, size.height)
        if abs(height - frame.height) > 0.5 { frame.size.height = height }
    }

    /// A table is as high as its rows.
    func fitTable() {
        guard let tableGrid else { return }
        let height = NoteTableLayout.totalHeight(tableGrid.cells, width: bounds.width, header: annotation.hasHeader, look: look)
        if abs(height - frame.height) > 0.5 { frame.size.height = height }
    }

    @objc private func dragged(_ gesture: UIPanGestureRecognizer) {
        guard let superview else { return }
        switch gesture.state {
        case .began:
            startFrame = frame
            controller?.beginAnnotationChange()
        case .changed:
            let translation = gesture.translation(in: superview)
            frame = startFrame.offsetBy(dx: translation.x, dy: translation.y)
        case .ended:
            controller?.commitFrame(of: annotation.id, frame: frame)
        default:
            frame = startFrame
        }
    }

    @objc private func resized(_ gesture: UIPanGestureRecognizer) {
        guard let superview else { return }
        switch gesture.state {
        case .began:
            startFrame = frame
            controller?.beginAnnotationChange()
        case .changed:
            let translation = gesture.translation(in: superview)
            var size = CGSize(width: max(40, startFrame.width + translation.x), height: max(24, startFrame.height + translation.y))
            switch annotation.kind {
            case .text, .table:
                size.height = startFrame.height
            case .image, .sticker:
                // Pictures and stickers keep their proportions.
                size.height = size.width * startFrame.height / max(startFrame.width, 1)
            }
            frame = CGRect(origin: startFrame.origin, size: size)
            if annotation.kind == .text { fitText() }
            if annotation.kind == .table {
                layoutIfNeeded()
                fitTable()
            }
            if annotation.kind == .sticker, Stickers.color(for: annotation.text) == nil {
                label?.font = .systemFont(ofSize: max(12, size.height * 0.8))
            }
        case .ended:
            controller?.commitFrame(of: annotation.id, frame: frame)
        default:
            frame = startFrame
        }
    }

    // Text

    func textViewDidBeginEditing(_ textView: UITextView) {
        guard textView === self.textView else { return }
        // A text at rest shows bullets and numbers; while it is typed, its markers show.
        textView.attributedText = NoteRichText.editing(annotation.text, look: look)
        textView.selectedRange = NSRange(location: (annotation.text as NSString).length, length: 0)
        updateTypingAttributes()
        controller?.didBeginEditing(self)
    }

    func textViewDidChange(_ textView: UITextView) {
        guard textView === self.textView else { return }
        if textView.markedTextRange == nil {
            let renumbered = NoteMarkup.renumbered(textView.text)
            if renumbered != textView.text { replaceKeepingCaret(with: renumbered) }
            NoteRichText.restyle(textView.textStorage, look: look)
            updateTypingAttributes()
        }
        fitText()
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        guard textView === self.textView else { return }
        controller?.didEndEditing(self, text: textView.text ?? "")
    }

    /// Enter continues a list with the next marker, and ends it on an empty item.
    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        guard textView === self.textView, text == "\n" else { return true }
        let string = textView.text as NSString
        let lineRange = string.lineRange(for: NSRange(location: range.location, length: 0))
        let line = string.substring(with: lineRange).trimmingCharacters(in: .newlines)
        let lineLength = (line as NSString).length
        let parsed = NoteMarkup.parseLine(line)
        let column = range.location - lineRange.location
        // Only after the marker; inside it Enter is an ordinary line break.
        guard column >= (parsed.prefix as NSString).length else { return true }
        switch NoteMarkup.continuation(afterLine: line) {
        case .none:
            return true
        case let .marker(marker):
            textView.textStorage.replaceCharacters(in: range, with: "\n" + marker)
            textView.selectedRange = NSRange(location: range.location + 1 + (marker as NSString).length, length: 0)
            textViewDidChange(textView)
            return false
        case .endList:
            guard range.length == 0, column == lineLength else { return true }
            textView.textStorage.replaceCharacters(in: NSRange(location: lineRange.location, length: lineLength), with: "")
            textView.selectedRange = NSRange(location: lineRange.location, length: 0)
            textViewDidChange(textView)
            return false
        }
    }

    /// Puts a heading, list marker or checkbox in front of the lines the selection touches.
    func applyBlock(_ block: NoteBlock) {
        guard let textView, textView.isFirstResponder else { return }
        let string = textView.text as NSString
        let full = string.lineRange(for: textView.selectedRange)
        var chunk = string.substring(with: full)
        let trailingNewline = chunk.hasSuffix("\n")
        if trailingNewline { chunk.removeLast() }
        let lines = chunk.components(separatedBy: "\n")
        let removing = NoteMarkup.parseLine(lines[0]).block.sameKind(as: block)
        var isCheck = false
        if case .check = block { isCheck = true }
        let changed = lines.map { line -> String in
            let parsed = NoteMarkup.parseLine(line)
            if isCheck, case .check = parsed.block { return NoteMarkup.setBlock(block, on: line) }
            if removing { return parsed.block.sameKind(as: block) ? parsed.content : line }
            return NoteMarkup.marker(for: block) + parsed.content
        }
        let replacement = changed.joined(separator: "\n") + (trailingNewline ? "\n" : "")
        textView.textStorage.replaceCharacters(in: full, with: replacement)
        let end = full.location + (replacement as NSString).length - (trailingNewline ? 1 : 0)
        textView.selectedRange = NSRange(location: max(full.location, end), length: 0)
        textViewDidChange(textView)
    }

    /// The text as new, with the caret kept in its line: renumbering only changes the numbers in front of lines.
    private func replaceKeepingCaret(with newText: String) {
        guard let textView else { return }
        let oldLines = textView.text.components(separatedBy: "\n")
        let newLines = newText.components(separatedBy: "\n")
        let caret = textView.selectedRange.location
        var start = 0
        var newStart = 0
        var target = (newText as NSString).length
        if oldLines.count == newLines.count {
            for (index, oldLine) in oldLines.enumerated() {
                let oldLength = (oldLine as NSString).length
                let newLength = (newLines[index] as NSString).length
                if caret <= start + oldLength {
                    let column = caret - start
                    let oldPrefix = (NoteMarkup.parseLine(oldLine).prefix as NSString).length
                    let shifted = column >= oldPrefix ? column + (newLength - oldLength) : min(column, newLength)
                    target = newStart + min(max(shifted, 0), newLength)
                    break
                }
                start += oldLength + 1
                newStart += newLength + 1
            }
        }
        textView.textStorage.replaceCharacters(in: NSRange(location: 0, length: (textView.text as NSString).length), with: newText)
        textView.selectedRange = NSRange(location: target, length: 0)
    }

    /// Text typed next looks like the line the caret is in.
    private func updateTypingAttributes() {
        guard let textView else { return }
        let string = textView.text as NSString
        let lineRange = string.lineRange(for: NSRange(location: min(textView.selectedRange.location, string.length), length: 0))
        let line = NoteMarkup.parseLine(string.substring(with: lineRange).trimmingCharacters(in: .newlines))
        textView.typingAttributes = NoteRichText.typingAttributes(for: line, look: look)
    }

    // Menu

    func contextMenuInteraction(_ interaction: UIContextMenuInteraction, configurationForMenuAtLocation location: CGPoint) -> UIContextMenuConfiguration? {
        guard controller?.tool.editsAnnotations == true else { return nil }
        let id = annotation.id
        let isTable = annotation.kind == .table
        let hasHeader = annotation.hasHeader
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
            var items: [UIMenuElement] = []
            if isTable {
                items.append(UIMenu(title: "Tabelle", image: UIImage(systemName: "tablecells"), children: [
                    UIAction(title: "Zeile hinzufügen", image: UIImage(systemName: "plus.rectangle")) { _ in self?.controller?.editTable(id, .addRow) },
                    UIAction(title: "Spalte hinzufügen", image: UIImage(systemName: "plus.rectangle.portrait")) { _ in self?.controller?.editTable(id, .addColumn) },
                    UIAction(title: "Letzte Zeile entfernen", image: UIImage(systemName: "minus.rectangle")) { _ in self?.controller?.editTable(id, .removeRow) },
                    UIAction(title: "Letzte Spalte entfernen", image: UIImage(systemName: "minus.rectangle.portrait")) { _ in self?.controller?.editTable(id, .removeColumn) },
                    UIAction(title: "Kopfzeile", image: UIImage(systemName: hasHeader ? "checkmark" : "rectangle.tophalf.filled"), state: hasHeader ? .on : .off) { _ in self?.controller?.toggleTableHeader(id) },
                ]))
            }
            items.append(UIAction(title: "Duplizieren", image: UIImage(systemName: "plus.square.on.square")) { _ in self?.controller?.duplicateAnnotation(id) })
            items.append(UIAction(title: "Löschen", image: UIImage(systemName: "trash"), attributes: .destructive) { _ in self?.controller?.deleteAnnotation(id) })
            return UIMenu(children: items)
        }
    }
}

/// A red dot with a glowing trail that fades, for pointing at things while presenting.
final class LaserView: UIView {
    private let trail = CAShapeLayer()
    private var points: [CGPoint] = []
    private var fade: DispatchWorkItem?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isMultipleTouchEnabled = false
        trail.strokeColor = UIColor.systemRed.cgColor
        trail.fillColor = nil
        trail.lineWidth = 5
        trail.lineCap = .round
        trail.lineJoin = .round
        trail.shadowColor = UIColor.systemRed.cgColor
        trail.shadowRadius = 8
        trail.shadowOpacity = 1
        trail.shadowOffset = .zero
        layer.addSublayer(trail)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        trail.frame = bounds
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        fade?.cancel()
        trail.removeAllAnimations()
        trail.opacity = 1
        points = [touch.location(in: self)]
        redraw()
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
        guard let touch = touches.first else { return }
        let samples = event?.coalescedTouches(for: touch) ?? [touch]
        points += samples.map { $0.location(in: self) }
        redraw()
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
        scheduleFade()
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
        scheduleFade()
    }

    private func redraw() {
        let path = UIBezierPath()
        if let first = points.first {
            path.move(to: first)
            points.dropFirst().forEach { path.addLine(to: $0) }
            if points.count == 1 { path.addLine(to: first) }
        }
        trail.path = path.cgPath
    }

    private func scheduleFade() {
        let work = DispatchWorkItem { [weak self] in
            guard let self else { return }
            CATransaction.begin()
            CATransaction.setCompletionBlock { [weak self] in
                self?.points = []
                self?.trail.path = nil
            }
            let animation = CABasicAnimation(keyPath: "opacity")
            animation.fromValue = 1
            animation.toValue = 0
            animation.duration = 0.4
            self.trail.opacity = 0
            self.trail.add(animation, forKey: "fade")
            CATransaction.commit()
        }
        fade = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }
}

/// The zoom window: writing here lands small on the page inside the frame shown there.
final class ZoomPanelView: UIView {
    let background = UIImageView()
    let canvas = PKCanvasView()
    var onMove: ((CGFloat, CGFloat) -> Void)?
    var onNewLine: (() -> Void)?
    var onClose: (() -> Void)?
    private let buttons = UIStackView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = QuillUIColor.surface
        layer.borderColor = QuillUIColor.line2.cgColor
        layer.borderWidth = 1
        background.backgroundColor = .white
        background.layer.cornerRadius = 8
        background.clipsToBounds = true
        addSubview(background)
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        canvas.isScrollEnabled = false
        canvas.overrideUserInterfaceStyle = .light
        canvas.drawingPolicy = .default
        addSubview(canvas)
        buttons.axis = .vertical
        buttons.distribution = .fillEqually
        buttons.spacing = 4
        let items: [(String, String, Selector)] = [
            ("chevron.up", "Nach oben", #selector(moveUp)),
            ("chevron.left", "Nach links", #selector(moveLeft)),
            ("chevron.right", "Nach rechts", #selector(moveRight)),
            ("chevron.down", "Nach unten", #selector(moveDown)),
            ("return", "Neue Zeile", #selector(startNewLine)),
            ("xmark", "Zoom-Fenster schließen", #selector(closePanel)),
        ]
        for (symbol, label, action) in items {
            let button = UIButton(type: .system)
            button.setImage(UIImage(systemName: symbol), for: .normal)
            button.tintColor = QuillUIColor.ink
            button.accessibilityLabel = label
            button.addTarget(self, action: action, for: .touchUpInside)
            buttons.addArrangedSubview(button)
        }
        addSubview(buttons)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let area = CGRect(x: 14, y: 12, width: bounds.width - 14 - 60, height: bounds.height - 24)
        background.frame = area
        canvas.frame = area
        buttons.frame = CGRect(x: bounds.width - 52, y: 8, width: 44, height: bounds.height - 16)
    }

    @objc private func moveUp() { onMove?(0, -1) }
    @objc private func moveLeft() { onMove?(-1, 0) }
    @objc private func moveRight() { onMove?(1, 0) }
    @objc private func moveDown() { onMove?(0, 1) }
    @objc private func startNewLine() { onNewLine?() }
    @objc private func closePanel() { onClose?() }
}

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

/// Everything on one PDF page: typed text, pictures and stickers below the ink, the ink canvas, and the frame of
/// the zoom window.
final class PageOverlayView: UIView {
    var pageIndex: Int
    weak var controller: NotesController?
    let annotationLayer = UIView()
    let canvas = PKCanvasView()
    private let targetLayer = CAShapeLayer()
    private(set) var annotationViews: [String: AnnotationView] = [:]
    let tap = UITapGestureRecognizer()

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
        targetLayer.fillColor = QuillUIColor.hex(0x7FA98C, alpha: 0.08).cgColor
        targetLayer.strokeColor = QuillUIColor.hex(0x7FA98C).cgColor
        targetLayer.lineWidth = 1.5
        targetLayer.lineDashPattern = [5, 4]
        targetLayer.isHidden = true
        layer.addSublayer(targetLayer)
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
        canvas.frame = bounds
        targetLayer.frame = bounds
        controller?.overlayDidLayout(self)
    }

    /// Pens get every touch; in the text and lasso tools text, pictures and stickers come first.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard isUserInteractionEnabled, !isHidden, self.point(inside: point, with: event), let tool = controller?.tool else { return nil }
        if tool.editsAnnotations {
            for view in annotationLayer.subviews.reversed() {
                if let hit = view.hitTest(convert(point, to: view), with: event) { return hit }
            }
        }
        if tool.usesCanvas {
            return canvas.hitTest(convert(point, to: canvas), with: event)
        }
        return tool == .typing || tool == .textBox ? self : nil
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
            }
        }
        updateHandles()
    }

    func updateHandles() {
        let visible = controller?.tool.editsAnnotations ?? false
        annotationViews.values.forEach { $0.showHandles(visible) }
    }
}

/// A text, picture or sticker on a page. Pictures and stickers move by dragging; texts by their handle at the top
/// left; everything resizes with the handle at the bottom right. A long press offers delete and duplicate.
final class AnnotationView: UIView, UITextViewDelegate, UIContextMenuInteractionDelegate {
    private(set) var annotation: PageAnnotation
    weak var controller: NotesController?
    private(set) var textView: UITextView?
    private var imageView: UIImageView?
    private var label: UILabel?
    private let moveHandle = UIView()
    private let resizeHandle = UIView()
    private var startFrame: CGRect = .zero

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
            addSubview(textView)
            self.textView = textView
        case .image:
            let imageView = UIImageView()
            imageView.contentMode = .scaleAspectFill
            imageView.clipsToBounds = true
            imageView.layer.cornerRadius = 4
            addSubview(imageView)
            self.imageView = imageView
            let drag = UIPanGestureRecognizer(target: self, action: #selector(move(_:)))
            addGestureRecognizer(drag)
        case .sticker:
            let label = UILabel()
            label.textAlignment = .center
            label.adjustsFontSizeToFitWidth = true
            label.minimumScaleFactor = 0.3
            label.clipsToBounds = true
            addSubview(label)
            self.label = label
            let drag = UIPanGestureRecognizer(target: self, action: #selector(move(_:)))
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
        moveHandle.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(move(_:))))
        resizeHandle.addGestureRecognizer(UIPanGestureRecognizer(target: self, action: #selector(resize(_:))))
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
            if textView.text != annotation.text { textView.text = annotation.text }
            textView.font = annotation.style.font
            textView.textColor = QuillUIColor.hex(annotation.color)
            textView.textAlignment = annotation.align.textAlignment
            layer.borderWidth = annotation.boxed ? 1 : 0
            layer.borderColor = QuillUIColor.hex(0x9A968B).cgColor
            layer.cornerRadius = annotation.boxed ? 4 : 0
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
        moveHandle.isHidden = !visible || annotation.kind != .text
        resizeHandle.isHidden = !visible
    }

    func beginEditing() {
        textView?.becomeFirstResponder()
    }

    /// Grows or shrinks a text to fit what is typed.
    func fitText() {
        guard let textView else { return }
        let size = textView.sizeThatFits(CGSize(width: bounds.width, height: .greatestFiniteMagnitude))
        let height = max(annotation.style.size * 1.6, size.height)
        if abs(height - frame.height) > 0.5 { frame.size.height = height }
    }

    @objc private func move(_ gesture: UIPanGestureRecognizer) {
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

    @objc private func resize(_ gesture: UIPanGestureRecognizer) {
        guard let superview else { return }
        switch gesture.state {
        case .began:
            startFrame = frame
            controller?.beginAnnotationChange()
        case .changed:
            let translation = gesture.translation(in: superview)
            var size = CGSize(width: max(40, startFrame.width + translation.x), height: max(24, startFrame.height + translation.y))
            switch annotation.kind {
            case .text:
                size.height = startFrame.height
            case .image, .sticker:
                // Pictures and stickers keep their proportions.
                size.height = size.width * startFrame.height / max(startFrame.width, 1)
            }
            frame = CGRect(origin: startFrame.origin, size: size)
            if annotation.kind == .text { fitText() }
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
        controller?.didBeginEditing(self)
    }

    func textViewDidChange(_ textView: UITextView) {
        fitText()
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        controller?.didEndEditing(self, text: textView.text ?? "")
    }

    // Menu

    func contextMenuInteraction(_ interaction: UIContextMenuInteraction, configurationForMenuAtLocation location: CGPoint) -> UIContextMenuConfiguration? {
        guard controller?.tool.editsAnnotations == true else { return nil }
        let id = annotation.id
        return UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self] _ in
            UIMenu(children: [
                UIAction(title: "Duplizieren", image: UIImage(systemName: "plus.square.on.square")) { _ in self?.controller?.duplicateAnnotation(id) },
                UIAction(title: "Löschen", image: UIImage(systemName: "trash"), attributes: .destructive) { _ in self?.controller?.deleteAnnotation(id) },
            ])
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
            ("chevron.up", "Nach oben", #selector(up)),
            ("chevron.left", "Nach links", #selector(left)),
            ("chevron.right", "Nach rechts", #selector(right)),
            ("chevron.down", "Nach unten", #selector(down)),
            ("return", "Neue Zeile", #selector(newLine)),
            ("xmark", "Zoom-Fenster schließen", #selector(close)),
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

    @objc private func up() { onMove?(0, -1) }
    @objc private func left() { onMove?(-1, 0) }
    @objc private func right() { onMove?(1, 0) }
    @objc private func down() { onMove?(0, 1) }
    @objc private func newLine() { onNewLine?() }
    @objc private func close() { onClose?() }
}

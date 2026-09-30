import UIKit

/// What a loop of the lasso took in.
struct LassoResult {
    /// The frame of the selected ink, texts, pictures and stickers, or of the loop itself when it took in nothing.
    var rect: CGRect
    var hasObjects: Bool
}

/// The selection lasso on one page: draw a loop around ink, texts, pictures or stickers; the frame that appears can
/// be dragged, and a small menu offers a screenshot of it, duplicating and deleting. One finger or the pencil draws;
/// two fingers scroll and zoom the page as usual.
final class LassoLayerView: UIView {
    weak var controller: NotesController?
    var pageIndex = 0

    private let loopLayer = CAShapeLayer()
    private let boxLayer = CAShapeLayer()
    private let floating = UIImageView()
    private let menu = UIStackView()
    private var loop: [CGPoint] = []
    private var result: LassoResult?
    private var dragOrigin: CGRect?
    private var isMoving = false
    private lazy var pan: UIPanGestureRecognizer = {
        let recognizer = UIPanGestureRecognizer(target: self, action: #selector(panned(_:)))
        recognizer.maximumNumberOfTouches = 1
        return recognizer
    }()

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        for layer in [loopLayer, boxLayer] {
            layer.fillColor = nil
            layer.strokeColor = QuillUIColor.hex(0x4F7A63).cgColor
            layer.lineJoin = .round
            layer.isHidden = true
            self.layer.addSublayer(layer)
        }
        loopLayer.fillColor = QuillUIColor.hex(0x7FA98C, alpha: 0.12).cgColor
        floating.isHidden = true
        floating.isUserInteractionEnabled = false
        addSubview(floating)

        menu.axis = .horizontal
        menu.spacing = 2
        menu.isHidden = true
        menu.isLayoutMarginsRelativeArrangement = true
        menu.layoutMargins = UIEdgeInsets(top: 2, left: 4, bottom: 2, right: 4)
        menu.backgroundColor = QuillUIColor.surface
        menu.layer.cornerRadius = 12
        menu.layer.borderColor = QuillUIColor.line2.cgColor
        menu.layer.borderWidth = 1
        menu.layer.shadowColor = UIColor.black.cgColor
        menu.layer.shadowOpacity = 0.14
        menu.layer.shadowRadius = 6
        menu.layer.shadowOffset = CGSize(width: 0, height: 2)
        menu.addArrangedSubview(menuButton("Screenshot", symbol: "camera.viewfinder", tint: QuillUIColor.ink, action: #selector(screenshotTapped)))
        menu.addArrangedSubview(menuButton("Duplizieren", symbol: "plus.square.on.square", tint: QuillUIColor.ink, action: #selector(duplicateTapped)))
        menu.addArrangedSubview(menuButton("Löschen", symbol: "trash", tint: .systemRed, action: #selector(deleteTapped)))
        addSubview(menu)

        addGestureRecognizer(pan)
        addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(tapped)))
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    private func menuButton(_ label: String, symbol: String, tint: UIColor, action: Selector) -> UIButton {
        var configuration = UIButton.Configuration.plain()
        configuration.image = UIImage(systemName: symbol)
        configuration.baseForegroundColor = tint
        configuration.contentInsets = NSDirectionalEdgeInsets(top: 8, leading: 10, bottom: 8, trailing: 10)
        let button = UIButton(configuration: configuration)
        button.accessibilityLabel = label
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    /// How much the page is enlarged on the glass: lines and the menu keep their size regardless.
    private var zoom: CGFloat {
        max(convert(CGRect(x: 0, y: 0, width: 100, height: 1), to: nil).width / 100, 0.01)
    }

    // Drawing a loop and moving the selection

    @objc private func panned(_ gesture: UIPanGestureRecognizer) {
        let location = gesture.location(in: self)
        switch gesture.state {
        case .began:
            let translation = gesture.translation(in: self)
            let start = CGPoint(x: location.x - translation.x, y: location.y - translation.y)
            if let rect = result?.rect, result?.hasObjects == true, rect.insetBy(dx: -10, dy: -10).contains(start) {
                beginMove(from: rect)
            } else {
                clear()
                loop = [start, location]
                showLoop()
            }
        case .changed:
            if isMoving {
                move(by: gesture.translation(in: self))
            } else {
                loop.append(location)
                showLoop()
            }
        case .ended:
            if isMoving {
                endMove(by: gesture.translation(in: self))
            } else {
                finishLoop()
            }
        default:
            if isMoving { cancelMove() } else { clear() }
        }
    }

    @objc private func tapped() {
        clear()
    }

    private func showLoop() {
        let path = UIBezierPath()
        if let first = loop.first {
            path.move(to: first)
            loop.dropFirst().forEach { path.addLine(to: $0) }
        }
        loopLayer.path = path.cgPath
        loopLayer.lineWidth = 1.6 / zoom
        loopLayer.lineDashPattern = [NSNumber(value: 6 / zoom), NSNumber(value: 4 / zoom)]
        loopLayer.isHidden = false
    }

    private func finishLoop() {
        loopLayer.isHidden = true
        guard loop.count >= 6, LassoGeometry.bounds(of: loop).width > 8 || LassoGeometry.bounds(of: loop).height > 8,
              let picked = controller?.lassoSelect(page: pageIndex, loop: loop)
        else {
            clear()
            return
        }
        loop = []
        show(picked)
    }

    /// The frame and the menu around what was taken in.
    func show(_ picked: LassoResult) {
        result = picked
        boxLayer.path = UIBezierPath(roundedRect: picked.rect, cornerRadius: 4).cgPath
        boxLayer.lineWidth = 1.6 / zoom
        boxLayer.lineDashPattern = [NSNumber(value: 6 / zoom), NSNumber(value: 4 / zoom)]
        boxLayer.isHidden = false
        // Duplicating and deleting need something selected; the screenshot works for any framed region.
        menu.arrangedSubviews.dropFirst().forEach { $0.isHidden = !picked.hasObjects }
        menu.isHidden = false
        layoutMenu()
    }

    private func layoutMenu() {
        guard let rect = result?.rect else { return }
        menu.transform = .identity
        let fitted = menu.systemLayoutSizeFitting(UIView.layoutFittingCompressedSize)
        let scale = 1 / zoom
        let size = CGSize(width: fitted.width * scale, height: fitted.height * scale)
        var origin = CGPoint(x: rect.midX - size.width / 2, y: rect.minY - size.height - 8 * scale)
        if origin.y < 0 { origin.y = rect.maxY + 8 * scale }
        origin.x = min(max(0, origin.x), max(0, bounds.width - size.width))
        // The menu keeps its size on the glass at any zoom: scaled down from its top left corner.
        menu.layer.anchorPoint = .zero
        menu.bounds = CGRect(origin: .zero, size: fitted)
        menu.layer.position = origin
        menu.transform = CGAffineTransform(scaleX: scale, y: scale)
        menu.layoutIfNeeded()
    }

    func clear() {
        loop = []
        result = nil
        loopLayer.isHidden = true
        boxLayer.isHidden = true
        menu.isHidden = true
        floating.isHidden = true
        if isMoving { cancelMove() }
        controller?.lassoClear()
    }

    /// Removes the frame without telling the controller: it cleared the selection itself.
    func hideSelection() {
        loop = []
        result = nil
        loopLayer.isHidden = true
        boxLayer.isHidden = true
        menu.isHidden = true
        floating.isHidden = true
        isMoving = false
    }

    private func beginMove(from rect: CGRect) {
        guard let lifted = controller?.lassoLift() else { return }
        isMoving = true
        dragOrigin = rect
        menu.isHidden = true
        if let image = lifted.image {
            floating.image = image
            floating.frame = lifted.rect
            floating.isHidden = false
        }
    }

    private func move(by translation: CGPoint) {
        boxLayer.setAffineTransform(CGAffineTransform(translationX: translation.x, y: translation.y))
        if !floating.isHidden { floating.transform = CGAffineTransform(translationX: translation.x, y: translation.y) }
        controller?.lassoMove(by: translation)
    }

    private func endMove(by translation: CGPoint) {
        isMoving = false
        floating.isHidden = true
        floating.transform = .identity
        boxLayer.setAffineTransform(.identity)
        guard let origin = dragOrigin else { return }
        dragOrigin = nil
        controller?.lassoDrop(by: translation)
        show(LassoResult(rect: origin.offsetBy(dx: translation.x, dy: translation.y), hasObjects: true))
    }

    private func cancelMove() {
        isMoving = false
        floating.isHidden = true
        floating.transform = .identity
        boxLayer.setAffineTransform(.identity)
        dragOrigin = nil
        controller?.lassoCancelMove()
        if let result { show(result) }
    }

    // Menu

    @objc private func screenshotTapped() {
        guard let rect = result?.rect else { return }
        controller?.lassoScreenshot(page: pageIndex, rect: rect, from: menu)
    }

    @objc private func duplicateTapped() {
        controller?.lassoDuplicate()
    }

    @objc private func deleteTapped() {
        controller?.lassoDelete()
    }

    /// The menu's buttons take touches; the rest of the layer draws.
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if !menu.isHidden {
            let inMenu = convert(point, to: menu)
            if let hit = menu.hitTest(inMenu, with: event), hit !== menu { return hit }
        }
        return super.hitTest(point, with: event)
    }
}

import PencilKit
import UIKit
import UIKit.UIGestureRecognizerSubclass

/// The instrument on a page. Fingers move it and turn it with two fingers; the pen draws straight along its edges,
/// rays from the protractor's centre and arcs with the compass. Everything is in the page's canvas coordinates, so
/// the instrument zooms and scrolls with the page.
final class InstrumentLayerView: UIView {
    weak var controller: NotesController?
    private(set) var kind: InstrumentKind?
    private(set) var pose = InstrumentPose(center: .zero, unitsPerCm: Instruments.pointsPerCm)
    private let body = InstrumentBodyView()
    private let compassGuide = CAShapeLayer()
    private let compassArm = CAShapeLayer()
    private let preview = CAShapeLayer()
    private let label = InstrumentLabel()
    private lazy var recognizer = InstrumentTouchRecognizer(layerView: self)

    private enum Stroke {
        case edge(index: Int, start: CGPoint)
        case ray
        case arc(start: Double, previous: Double, sweep: Double)
    }

    private enum CompassGrab { case pin, tip }

    private var fingers: [(touch: UITouch, point: CGPoint)] = []
    private var gestureStart: (pose: InstrumentPose, points: [CGPoint])?
    private var compassGrab: CompassGrab?
    private var penTouch: UITouch?
    private var stroke: Stroke?
    private var strokePoints: [CGPoint] = []

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isHidden = true
        body.isUserInteractionEnabled = false
        addSubview(body)
        compassGuide.fillColor = nil
        compassGuide.strokeColor = QuillUIColor.hex(0x5E8FA8, alpha: 0.7).cgColor
        compassGuide.lineDashPattern = [4, 4]
        compassArm.fillColor = QuillUIColor.hex(0x5E8FA8, alpha: 0.25).cgColor
        compassArm.strokeColor = QuillUIColor.hex(0x1F3B4D).cgColor
        preview.fillColor = nil
        preview.lineCap = .round
        preview.lineJoin = .round
        [compassGuide, compassArm, preview].forEach(layer.addSublayer)
        addSubview(label)
        addGestureRecognizer(recognizer)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        [compassGuide, compassArm, preview].forEach { $0.frame = bounds }
    }

    private var pageIndex: Int? { (superview as? PageOverlayView)?.pageIndex }

    /// How much the page is enlarged on screen, so handles and snapping keep their size on the glass.
    private var zoom: CGFloat {
        let rect = convert(CGRect(x: 0, y: 0, width: 100, height: 1), to: nil)
        return max(rect.width / 100, 0.01)
    }

    private var band: Double { Double(26 / zoom) }

    func show(_ kind: InstrumentKind?, pose: InstrumentPose) {
        let changed = kind != self.kind || pose.unitsPerCm != self.pose.unitsPerCm
        self.kind = kind
        self.pose = pose
        isHidden = kind == nil
        if kind == nil { cancelStroke() }
        if changed {
            body.kind = kind == .compass ? nil : kind
            body.unitsPerCm = pose.unitsPerCm
        }
        layoutInstrument()
        showRotation()
    }

    private func layoutInstrument() {
        guard let kind else { return }
        if kind == .compass {
            body.isHidden = true
            let radius = pose.radiusCm * pose.unitsPerCm
            compassGuide.path = UIBezierPath(arcCenter: pose.center, radius: radius, startAngle: 0, endAngle: 2 * .pi, clockwise: true).cgPath
            compassGuide.lineWidth = 1 / zoom
            let tip = Instruments.compassTip(pose)
            let arm = UIBezierPath()
            arm.move(to: pose.center)
            arm.addLine(to: tip)
            arm.append(UIBezierPath(arcCenter: pose.center, radius: 6 / zoom, startAngle: 0, endAngle: 2 * .pi, clockwise: true))
            arm.append(UIBezierPath(arcCenter: tip, radius: 9 / zoom, startAngle: 0, endAngle: 2 * .pi, clockwise: true))
            compassArm.path = arm.cgPath
            compassArm.lineWidth = 1.5 / zoom
            compassGuide.isHidden = false
            compassArm.isHidden = false
        } else {
            body.isHidden = false
            compassGuide.isHidden = true
            compassArm.isHidden = true
            let local = Instruments.localBounds(kind)
            body.bounds = CGRect(x: 0, y: 0, width: local.width * pose.unitsPerCm, height: local.height * pose.unitsPerCm)
            body.center = Instruments.toPage(CGPoint(x: local.midX, y: local.midY), pose)
            body.transform = CGAffineTransform(rotationAngle: pose.angle)
        }
    }

    // Which touches it takes

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let kind, !isHidden else { return nil }
        let drawing = controller?.instrumentInk != nil
        let grab = Double(30 / zoom)
        switch kind {
        case .compass:
            let distance = Instruments.distance(point, pose.center)
            let radius = pose.radiusCm * pose.unitsPerCm
            if distance <= grab || Instruments.distance(point, Instruments.compassTip(pose)) <= grab { return self }
            if drawing, abs(distance - radius) <= band * 1.6 { return self }
        default:
            if Instruments.contains(point, kind, pose) { return self }
            if drawing, Instruments.nearestEdge(to: point, kind, pose, band: band) != nil { return self }
        }
        return nil
    }

    private func canDraw(with touch: UITouch) -> Bool {
        guard controller?.instrumentInk != nil else { return false }
        return touch.type == .pencil || !UIPencilInteraction.prefersPencilOnlyDrawing
    }

    // Touches, from the recognizer

    fileprivate func began(_ touch: UITouch) {
        guard let kind else { return }
        let point = touch.location(in: self)
        let isFinger = touch.type != .pencil
        if kind == .compass {
            let grab = Double(30 / zoom)
            if isFinger, fingers.isEmpty, penTouch == nil {
                if Instruments.distance(point, Instruments.compassTip(pose)) <= grab {
                    compassGrab = .tip
                } else if Instruments.distance(point, pose.center) <= grab {
                    compassGrab = .pin
                }
                if compassGrab != nil {
                    fingers = [(touch, point)]
                    gestureStart = (pose, [point])
                    return
                }
            }
            if penTouch == nil, canDraw(with: touch) {
                let direction = Instruments.direction(from: pose.center, to: point)
                begin(touch, .arc(start: direction, previous: direction, sweep: 0), at: point)
            }
            return
        }
        let inside = Instruments.contains(point, kind, pose)
        if penTouch == nil, canDraw(with: touch), !(isFinger && inside) {
            if kind == .protractor, Instruments.distance(point, pose.center) <= max(band, 0.8 * pose.unitsPerCm) {
                begin(touch, .ray, at: point)
                return
            }
            if let edge = Instruments.nearestEdge(to: point, kind, pose, band: band) {
                begin(touch, .edge(index: edge, start: point), at: point)
                return
            }
        }
        if isFinger, inside, fingers.count < 2 {
            fingers.append((touch, point))
            restartGesture()
        }
    }

    fileprivate func moved(_ touch: UITouch) {
        let point = touch.location(in: self)
        if touch === penTouch {
            updateStroke(to: point)
        } else if let index = fingers.firstIndex(where: { $0.touch === touch }) {
            fingers[index].point = point
            updateGesture()
        }
    }

    fileprivate func ended(_ touch: UITouch, cancelled: Bool) {
        if touch === penTouch {
            if cancelled { cancelStroke() } else { commitStroke() }
        } else if let index = fingers.firstIndex(where: { $0.touch === touch }) {
            fingers.remove(at: index)
            if fingers.isEmpty {
                compassGrab = nil
                gestureStart = nil
                controller?.instrumentMoved(pose)
            } else {
                restartGesture()
            }
        }
        if penTouch == nil, fingers.isEmpty { showRotation() }
    }

    // Moving and turning

    private func restartGesture() {
        gestureStart = (pose, fingers.map(\.point))
    }

    private func updateGesture() {
        guard let start = gestureStart, let first = fingers.first else { return }
        var next = start.pose
        if let grab = compassGrab {
            switch grab {
            case .pin:
                next.center = CGPoint(x: start.pose.center.x + first.point.x - start.points[0].x, y: start.pose.center.y + first.point.y - start.points[0].y)
            case .tip:
                next.radiusCm = Instruments.compassRadius(to: first.point, start.pose)
                next.angle = Instruments.direction(from: start.pose.center, to: first.point)
            }
        } else if fingers.count > 1, start.points.count > 1 {
            let a0 = start.points[0], b0 = start.points[1]
            let a1 = fingers[0].point, b1 = fingers[1].point
            let turn = Instruments.direction(from: a1, to: b1) - Instruments.direction(from: a0, to: b0)
            let angle = Instruments.snapRotation(start.pose.angle + turn)
            let delta = angle - start.pose.angle
            let startMid = CGPoint(x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2)
            let mid = CGPoint(x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2)
            let dx = Double(start.pose.center.x - startMid.x), dy = Double(start.pose.center.y - startMid.y)
            next.center = CGPoint(x: Double(mid.x) + dx * cos(delta) - dy * sin(delta), y: Double(mid.y) + dx * sin(delta) + dy * cos(delta))
            next.angle = angle
        } else {
            next.center = CGPoint(x: start.pose.center.x + first.point.x - start.points[0].x, y: start.pose.center.y + first.point.y - start.points[0].y)
        }
        pose = next
        layoutInstrument()
        showRotation()
    }

    // Drawing

    private func begin(_ touch: UITouch, _ kind: Stroke, at point: CGPoint) {
        penTouch = touch
        stroke = kind
        if let ink = controller?.instrumentInk {
            preview.strokeColor = ink.ink.color.cgColor
            preview.lineWidth = ink.width
            preview.opacity = ink.ink.inkType == .marker ? 0.5 : 1
        }
        updateStroke(to: point)
    }

    private func updateStroke(to point: CGPoint) {
        guard let stroke, let kind else { return }
        let offset = Double((controller?.instrumentInk?.width ?? 2) / 2 + 1)
        switch stroke {
        case let .edge(index, start):
            let line = Instruments.snappedLine(from: start, to: point, edge: index, kind, pose, offset: offset)
            strokePoints = [line.start, line.end]
            showLabel("\(Instruments.formatCm(Instruments.centimetres(line.length, pose))) · \(Instruments.formatDegrees(Instruments.lineDegrees(line.start, line.end)))", near: point)
        case .ray:
            guard let ray = Instruments.protractorRay(to: point, pose) else { return }
            strokePoints = [pose.center, ray.end]
            showLabel("\(ray.degrees)° · \(Instruments.formatCm(Instruments.centimetres(Instruments.distance(pose.center, ray.end), pose)))", near: point)
        case let .arc(start, previous, sweep):
            let direction = Instruments.direction(from: pose.center, to: point)
            let total = min(max(sweep + Instruments.angleStep(from: previous, to: direction), -2 * .pi), 2 * .pi)
            self.stroke = .arc(start: start, previous: direction, sweep: total)
            strokePoints = Instruments.arc(center: pose.center, radius: pose.radiusCm * pose.unitsPerCm, start: start, sweep: total)
            let degrees = Int((abs(total) * 180 / .pi).rounded())
            showLabel("r = \(Instruments.formatCm(pose.radiusCm)) · \(degrees)°", near: point)
        }
        let path = UIBezierPath()
        if let first = strokePoints.first {
            path.move(to: first)
            strokePoints.dropFirst().forEach { path.addLine(to: $0) }
        }
        preview.path = path.cgPath
    }

    private func commitStroke() {
        defer { cancelStroke() }
        guard let stroke, let page = pageIndex, strokePoints.count > 1 else { return }
        switch stroke {
        case .edge, .ray:
            let line = InstrumentSegment(start: strokePoints[0], end: strokePoints[strokePoints.count - 1])
            guard line.length > 1 else { return }
            controller?.addInstrumentStroke(Instruments.sampled(line, spacing: 2), page: page)
        case let .arc(_, _, sweep):
            guard abs(sweep) > 0.02 else { return }
            controller?.addInstrumentStroke(strokePoints, page: page)
        }
    }

    private func cancelStroke() {
        penTouch = nil
        stroke = nil
        strokePoints = []
        preview.path = nil
    }

    // Labels

    /// The rotation stays in view on rulers, set squares and protractors; the compass shows its opening.
    private func showRotation() {
        guard let kind, penTouch == nil else { return }
        switch kind {
        case .compass:
            let tip = Instruments.compassTip(pose)
            showLabel("r = \(Instruments.formatCm(pose.radiusCm))", at: CGPoint(x: (pose.center.x + tip.x) / 2, y: (pose.center.y + tip.y) / 2 - 18 / zoom))
        case .ruler:
            showLabel(Instruments.formatDegrees(Instruments.rotationDegrees(pose)), at: pose.center)
        case .setSquare:
            showLabel(Instruments.formatDegrees(Instruments.rotationDegrees(pose)), at: Instruments.toPage(CGPoint(x: 0, y: 2.3), pose))
        case .protractor:
            showLabel(Instruments.formatDegrees(Instruments.rotationDegrees(pose)), at: Instruments.toPage(CGPoint(x: 0, y: -2.2), pose))
        }
    }

    private func showLabel(_ text: String, near point: CGPoint) {
        showLabel(text, at: CGPoint(x: point.x, y: point.y - 44 / zoom))
    }

    private func showLabel(_ text: String, at point: CGPoint) {
        label.text = text
        label.transform = .identity
        label.sizeToFit()
        label.bounds.size.width += 16
        label.bounds.size.height += 6
        label.center = point
        label.transform = CGAffineTransform(scaleX: 1 / zoom, y: 1 / zoom)
    }
}

/// Hands every touch on the instrument over right away, before the page could take it for scrolling.
private final class InstrumentTouchRecognizer: UIGestureRecognizer {
    private weak var layerView: InstrumentLayerView?
    private var active = Set<UITouch>()

    init(layerView: InstrumentLayerView) {
        self.layerView = layerView
        super.init(target: nil, action: nil)
        delaysTouchesBegan = false
        delaysTouchesEnded = false
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        for touch in touches {
            active.insert(touch)
            layerView?.began(touch)
        }
        state = state == .possible ? .began : .changed
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        touches.forEach { layerView?.moved($0) }
        state = .changed
    }

    override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
        finish(touches, cancelled: false)
    }

    override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
        finish(touches, cancelled: true)
    }

    private func finish(_ touches: Set<UITouch>, cancelled: Bool) {
        for touch in touches {
            active.remove(touch)
            layerView?.ended(touch, cancelled: cancelled)
        }
        if active.isEmpty { state = cancelled ? .cancelled : .ended }
    }

    override func reset() {
        super.reset()
        for touch in active { layerView?.ended(touch, cancelled: true) }
        active.removeAll()
    }
}

/// The instrument itself, drawn with its scales; it only shows, the layer above handles the touches.
final class InstrumentBodyView: UIView {
    var kind: InstrumentKind? {
        didSet { setNeedsDisplay() }
    }
    var unitsPerCm: Double = Instruments.pointsPerCm {
        didSet { setNeedsDisplay() }
    }

    private let fill = QuillUIColor.hex(0xE4F1F7, alpha: 0.72)
    private let border = QuillUIColor.hex(0x5E8FA8)
    private let tick = QuillUIColor.hex(0x1F3B4D)

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
        // Sharp scales when the page is zoomed in.
        contentScaleFactor = UIScreen.main.scale * 2
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    /// From the instrument's centimetres to this view's points.
    private func pt(_ x: Double, _ y: Double) -> CGPoint {
        guard let kind else { return .zero }
        let local = Instruments.localBounds(kind)
        return CGPoint(x: (x - Double(local.minX)) * unitsPerCm, y: (y - Double(local.minY)) * unitsPerCm)
    }

    override func draw(_ rect: CGRect) {
        guard let kind else { return }
        let outline = UIBezierPath()
        for (index, point) in Instruments.localOutline(kind).enumerated() {
            let p = pt(Double(point.x), Double(point.y))
            if index == 0 { outline.move(to: p) } else { outline.addLine(to: p) }
        }
        outline.close()
        fill.setFill()
        outline.fill()
        border.setStroke()
        outline.lineWidth = 1.2
        outline.stroke()
        switch kind {
        case .ruler: drawRuler()
        case .setSquare: drawSetSquare()
        case .protractor: drawProtractor()
        case .compass: break
        }
    }

    private func line(_ from: CGPoint, _ to: CGPoint, width: CGFloat = 0.8, color: UIColor? = nil) {
        let path = UIBezierPath()
        path.move(to: from)
        path.addLine(to: to)
        path.lineWidth = width
        (color ?? tick).setStroke()
        path.stroke()
    }

    private func text(_ string: String, at center: CGPoint, size: Double, color: UIColor? = nil) {
        let font = UIFont.monospacedDigitSystemFont(ofSize: CGFloat(size * unitsPerCm), weight: .medium)
        let attributed = NSAttributedString(string: string, attributes: [.font: font, .foregroundColor: color ?? tick])
        let bounds = attributed.size()
        attributed.draw(at: CGPoint(x: center.x - bounds.width / 2, y: center.y - bounds.height / 2))
    }

    private func tickLength(_ millimetre: Int) -> Double {
        millimetre % 10 == 0 ? 0.55 : (millimetre % 5 == 0 ? 0.38 : 0.22)
    }

    private func drawRuler() {
        let h = Instruments.rulerHalfHeight
        for mm in 0...160 {
            let x = -8 + Double(mm) / 10
            let length = tickLength(mm)
            line(pt(x, -h), pt(x, -h + length))
            line(pt(x, h), pt(x, h - length))
            if mm % 10 == 0 { text("\(mm / 10)", at: pt(x, -h + 0.85), size: 0.3) }
        }
    }

    private func drawSetSquare() {
        for mm in -70...70 {
            let x = Double(mm) / 10
            line(pt(x, 0), pt(x, tickLength(abs(mm))))
            if mm % 10 == 0 { text("\(abs(mm) / 10)", at: pt(x, 0.85), size: 0.3) }
        }
        // The degree scale around the zero of the long edge.
        let radius = 5.4
        let arc = UIBezierPath(arcCenter: pt(0, 0), radius: CGFloat(radius * unitsPerCm), startAngle: 0, endAngle: .pi, clockwise: true)
        arc.lineWidth = 0.6
        tick.setStroke()
        arc.stroke()
        for degree in 0...180 {
            let angle = Double(degree) * .pi / 180
            let length = degree % 10 == 0 ? 0.45 : (degree % 5 == 0 ? 0.3 : 0.16)
            line(pt(radius * cos(angle), radius * sin(angle)), pt((radius - length) * cos(angle), (radius - length) * sin(angle)), width: 0.6)
            if degree % 10 == 0, degree > 0, degree < 180 {
                text("\(degree)", at: pt((radius - 0.75) * cos(angle), (radius - 0.75) * sin(angle)), size: 0.22)
            }
        }
        let dashed = UIBezierPath()
        dashed.move(to: pt(0, 1.1))
        dashed.addLine(to: pt(0, Instruments.setSquareHalfLength - 0.6))
        dashed.setLineDash([3, 3], count: 2, phase: 0)
        dashed.lineWidth = 0.6
        dashed.stroke()
        tick.setFill()
        UIBezierPath(arcCenter: pt(0, 0), radius: 2.5, startAngle: 0, endAngle: 2 * .pi, clockwise: true).fill()
    }

    private func drawProtractor() {
        let radius = Instruments.protractorRadius
        for degree in 0...180 {
            let angle = Double(degree) * .pi / 180
            let length = degree % 10 == 0 ? 0.55 : (degree % 5 == 0 ? 0.36 : 0.2)
            line(pt(radius * cos(angle), -radius * sin(angle)), pt((radius - length) * cos(angle), -(radius - length) * sin(angle)), width: 0.6)
            if degree % 10 == 0 {
                text("\(degree)", at: pt((radius - 0.95) * cos(angle), -(radius - 0.95) * sin(angle)), size: 0.26)
                text("\(180 - degree)", at: pt((radius - 1.55) * cos(angle), -(radius - 1.55) * sin(angle)), size: 0.19, color: border)
            }
        }
        let inner = UIBezierPath(arcCenter: pt(0, 0), radius: CGFloat(2.4 * unitsPerCm), startAngle: .pi, endAngle: 2 * .pi, clockwise: true)
        inner.lineWidth = 0.6
        border.setStroke()
        inner.stroke()
        line(pt(-0.5, 0), pt(0.5, 0), width: 1)
        line(pt(0, 0), pt(0, -0.5), width: 1)
    }
}

/// A small pill with the angle or length.
private final class InstrumentLabel: UILabel {
    override init(frame: CGRect) {
        super.init(frame: frame)
        font = UIFont.monospacedDigitSystemFont(ofSize: 13, weight: .semibold)
        textColor = .white
        textAlignment = .center
        backgroundColor = QuillUIColor.hex(0x1F3B4D, alpha: 0.85)
        layer.cornerRadius = 9
        layer.masksToBounds = true
        isUserInteractionEnabled = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }
}

enum DeviceScreen {
    /// Pixels per inch of the built-in screen, close enough for a true-to-scale page; UIKit does not tell.
    static var ppi: Double {
        let native = UIScreen.main.nativeBounds.size
        let shortSide = min(native.width, native.height)
        if UIDevice.current.userInterfaceIdiom == .pad {
            // The iPad mini has 326 pixels per inch, the other iPads 264.
            return shortSide == 1488 ? 326 : 264
        }
        return UIScreen.main.nativeScale >= 3 ? 460 : 326
    }
}

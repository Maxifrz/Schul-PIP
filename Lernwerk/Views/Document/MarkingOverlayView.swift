import UIKit

/// Lets the student drag a rectangle around the part of the page they need help with.
final class MarkingOverlayView: UIView {
    var onMark: ((CGRect) -> Void)?

    private let selectionLayer = CAShapeLayer()
    private var anchor: CGPoint?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = QuillUIColor.accent.withAlphaComponent(0.06)

        selectionLayer.fillColor = QuillUIColor.accent.withAlphaComponent(0.14).cgColor
        selectionLayer.strokeColor = QuillUIColor.accent.cgColor
        selectionLayer.lineWidth = 1.5
        selectionLayer.lineDashPattern = [6, 4]
        layer.addSublayer(selectionLayer)

        let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        pan.maximumNumberOfTouches = 1
        addGestureRecognizer(pan)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    func clearSelection() {
        selectionLayer.path = nil
        anchor = nil
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        let location = gesture.location(in: self)
        switch gesture.state {
        case .began:
            let translation = gesture.translation(in: self)
            anchor = CGPoint(x: location.x - translation.x, y: location.y - translation.y)
            updateSelection(to: location)
        case .changed:
            updateSelection(to: location)
        case .ended:
            guard let rect = selectionRect(to: location) else { return }
            anchor = nil
            if rect.width >= 24, rect.height >= 16 {
                onMark?(rect)
            } else {
                clearSelection()
            }
        default:
            clearSelection()
        }
    }

    private func selectionRect(to point: CGPoint) -> CGRect? {
        guard let anchor else { return nil }
        return CGRect(
            x: min(anchor.x, point.x),
            y: min(anchor.y, point.y),
            width: abs(point.x - anchor.x),
            height: abs(point.y - anchor.y)
        )
    }

    private func updateSelection(to point: CGPoint) {
        guard let rect = selectionRect(to: point) else { return }
        selectionLayer.path = UIBezierPath(roundedRect: rect, cornerRadius: 6).cgPath
    }
}

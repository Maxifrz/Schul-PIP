import PDFKit
import PencilKit
import SwiftUI
import UIKit

enum DrawingTool: Equatable {
    case pen
    case highlighter
    case eraser

    var pkTool: any PKTool {
        switch self {
        case .pen:
            return PKInkingTool(.pen, color: .black, width: 3)
        case .highlighter:
            return PKInkingTool(.marker, color: UIColor.systemYellow.withAlphaComponent(0.6), width: 18)
        case .eraser:
            return PKEraserTool(.vector)
        }
    }
}

enum InteractionMode: Equatable {
    case read
    case draw(DrawingTool)
    case mark
}

struct MarkedRegion {
    var pageIndex: Int
    var selectedText: String
    var pageText: String
    var imageJPEG: Data?
}

/// PDFKit renders the material; every page gets its own PencilKit canvas as an overlay.
struct PDFCanvasView: UIViewRepresentable {
    let document: PDFDocument
    let fileName: String
    let mode: InteractionMode
    let startPage: Int
    let onMark: (MarkedRegion) -> Void
    let onPageChange: (Int) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(fileName: fileName)
    }

    func makeUIView(context: Context) -> PDFContainerView {
        let container = PDFContainerView()
        let coordinator = context.coordinator
        coordinator.parent = self
        coordinator.container = container

        // The overlay provider has to be set before the document is assigned.
        container.pdfView.pageOverlayViewProvider = coordinator
        container.pdfView.document = document
        container.markingView.onMark = { [weak coordinator] rect in
            coordinator?.handleMark(rect)
        }
        NotificationCenter.default.addObserver(
            coordinator,
            selector: #selector(Coordinator.pageChanged(_:)),
            name: .PDFViewPageChanged,
            object: container.pdfView
        )
        if let page = document.page(at: startPage) {
            DispatchQueue.main.async {
                container.pdfView.go(to: page)
            }
        }
        coordinator.apply(mode)
        return container
    }

    func updateUIView(_ container: PDFContainerView, context: Context) {
        context.coordinator.parent = self
        context.coordinator.apply(mode)
    }

    static func dismantleUIView(_ container: PDFContainerView, coordinator: Coordinator) {
        NotificationCenter.default.removeObserver(coordinator)
        coordinator.saveNow()
    }

    final class Coordinator: NSObject, PDFPageOverlayViewProvider, PKCanvasViewDelegate {
        var parent: PDFCanvasView?
        weak var container: PDFContainerView?

        private let fileName: String
        private var drawings: [Int: PKDrawing]
        private var canvases: [Int: PKCanvasView] = [:]
        private var mode: InteractionMode = .read
        private var pendingSave: DispatchWorkItem?

        init(fileName: String) {
            self.fileName = fileName
            drawings = MaterialStore.loadDrawings(for: fileName)
            super.init()
        }

        func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
            guard let index = view.document?.index(for: page) else { return nil }
            if let existing = canvases[index] {
                return existing
            }
            let canvas = PKCanvasView()
            canvas.backgroundColor = .clear
            canvas.isOpaque = false
            canvas.isScrollEnabled = false
            canvas.overrideUserInterfaceStyle = .light
            canvas.drawingPolicy = .anyInput
            canvas.drawing = drawings[index] ?? PKDrawing()
            canvas.tag = index
            canvas.delegate = self
            configure(canvas)
            canvases[index] = canvas
            return canvas
        }

        func pdfView(_ pdfView: PDFView, willEndDisplayingOverlayView overlayView: UIView, for page: PDFPage) {
            guard let canvas = overlayView as? PKCanvasView else { return }
            drawings[canvas.tag] = canvas.drawing
            canvases[canvas.tag] = nil
        }

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            drawings[canvasView.tag] = canvasView.drawing
            scheduleSave()
        }

        func apply(_ newMode: InteractionMode) {
            mode = newMode
            guard let container else { return }

            var isDrawing = false
            if case .draw = newMode {
                isDrawing = true
            }
            if container.pdfView.isInMarkupMode != isDrawing {
                container.pdfView.isInMarkupMode = isDrawing
            }

            let isMarking = newMode == .mark
            if !isMarking {
                container.markingView.clearSelection()
            }
            container.markingView.isHidden = !isMarking
            canvases.values.forEach(configure)
        }

        func handleMark(_ rect: CGRect) {
            guard let container, let region = container.region(for: rect) else { return }
            parent?.onMark(region)
        }

        func saveNow() {
            pendingSave?.cancel()
            for (index, canvas) in canvases {
                drawings[index] = canvas.drawing
            }
            MaterialStore.saveDrawings(drawings, for: fileName)
        }

        @objc func pageChanged(_ notification: Notification) {
            guard let pdfView = container?.pdfView,
                  let page = pdfView.currentPage,
                  let document = pdfView.document
            else { return }
            parent?.onPageChange(document.index(for: page))
        }

        private func configure(_ canvas: PKCanvasView) {
            if case let .draw(tool) = mode {
                canvas.isUserInteractionEnabled = true
                canvas.tool = tool.pkTool
            } else {
                canvas.isUserInteractionEnabled = false
            }
        }

        private func scheduleSave() {
            pendingSave?.cancel()
            let work = DispatchWorkItem { [weak self] in
                self?.saveNow()
            }
            pendingSave = work
            DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
        }
    }
}

final class PDFContainerView: UIView {
    let pdfView = PDFView()
    let markingView = MarkingOverlayView()

    override init(frame: CGRect) {
        super.init(frame: frame)
        pdfView.autoScales = true
        pdfView.displayMode = .singlePageContinuous
        pdfView.displayDirection = .vertical
        pdfView.backgroundColor = .systemGray6
        addSubview(pdfView)
        markingView.isHidden = true
        addSubview(markingView)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        pdfView.frame = bounds
        markingView.frame = bounds
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

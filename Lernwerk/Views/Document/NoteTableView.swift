import UIKit

/// The cells of a table on a page: a text view in each cell, a grid and a tinted header row. Enter moves on to the
/// next cell; in the last cell it adds a row.
final class TableGridView: UIView, UITextViewDelegate {
    private(set) var cells: [[String]] = []
    private var header = true
    private var look: NoteRichText.Look?
    private var views: [[UITextView]] = []
    private var isEditing = false

    var onBegin: (() -> Void)?
    var onChange: (([[String]]) -> Void)?
    var onEnd: (([[String]]) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        isOpaque = false
        contentMode = .redraw
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    func configure(_ newCells: [[String]], header: Bool, look: NoteRichText.Look) {
        self.header = header
        self.look = look
        let columns = max(1, newCells.map(\.count).max() ?? 1)
        var normalized = newCells.map { $0 + Array(repeating: "", count: columns - $0.count) }
        if normalized.isEmpty { normalized = NoteTable.blank(rows: 1, columns: 1) }
        let rebuild = views.count != normalized.count || (views.first?.count ?? 0) != columns
        cells = normalized
        if rebuild {
            views.flatMap { $0 }.forEach { $0.removeFromSuperview() }
            views = normalized.map { row in row.map { _ in makeCell() } }
            views.flatMap { $0 }.forEach { addSubview($0) }
        }
        for (rowIndex, row) in views.enumerated() {
            for (columnIndex, view) in row.enumerated() {
                if view.text != normalized[rowIndex][columnIndex] { view.text = normalized[rowIndex][columnIndex] }
                view.font = NoteTableLayout.font(look: look, bold: header && rowIndex == 0)
                view.textColor = look.color
            }
        }
        setNeedsLayout()
        setNeedsDisplay()
    }

    private func makeCell() -> UITextView {
        let view = UITextView()
        view.isScrollEnabled = false
        view.backgroundColor = .clear
        view.textContainerInset = UIEdgeInsets(top: NoteTableLayout.padding, left: NoteTableLayout.padding, bottom: NoteTableLayout.padding, right: NoteTableLayout.padding)
        view.textContainer.lineFragmentPadding = 0
        view.delegate = self
        return view
    }

    private var heights: [CGFloat] {
        guard let look else { return [] }
        return NoteTableLayout.rowHeights(cells, width: bounds.width, header: header, look: look)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        let columns = max(1, views.first?.count ?? 1)
        let columnWidth = bounds.width / CGFloat(columns)
        var y: CGFloat = 0
        let rowHeights = heights
        for (rowIndex, row) in views.enumerated() where rowIndex < rowHeights.count {
            for (columnIndex, view) in row.enumerated() {
                view.frame = CGRect(x: CGFloat(columnIndex) * columnWidth, y: y, width: columnWidth, height: rowHeights[rowIndex])
            }
            y += rowHeights[rowIndex]
        }
        setNeedsDisplay()
    }

    override func draw(_ rect: CGRect) {
        let columns = max(1, views.first?.count ?? 1)
        let columnWidth = bounds.width / CGFloat(columns)
        var y: CGFloat = 0
        QuillUIColor.hex(0x9A968B).setStroke()
        for (rowIndex, height) in heights.enumerated() {
            if header, rowIndex == 0 {
                QuillUIColor.hex(0xEEEDE9).setFill()
                UIBezierPath(rect: CGRect(x: 0, y: y, width: bounds.width, height: height)).fill()
            }
            for column in 0..<columns {
                let border = UIBezierPath(rect: CGRect(x: CGFloat(column) * columnWidth, y: y, width: columnWidth, height: height))
                border.lineWidth = 1
                border.stroke()
            }
            y += height
        }
    }

    /// Puts the caret in the first cell.
    func beginEditing() {
        views.first?.first?.becomeFirstResponder()
    }

    // Editing

    func textViewDidBeginEditing(_ textView: UITextView) {
        guard !isEditing else { return }
        isEditing = true
        onBegin?()
    }

    func textViewDidChange(_ textView: UITextView) {
        guard let (row, column) = position(of: textView) else { return }
        cells[row][column] = textView.text ?? ""
        setNeedsLayout()
        onChange?(cells)
    }

    func textViewDidEndEditing(_ textView: UITextView) {
        // Moving from cell to cell is not the end: only when no cell has the caret any more.
        DispatchQueue.main.async { [weak self] in
            guard let self, self.isEditing, !self.views.flatMap({ $0 }).contains(where: \.isFirstResponder) else { return }
            self.isEditing = false
            self.onEnd?(self.cells)
        }
    }

    func textView(_ textView: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
        guard text == "\n", let (row, column) = position(of: textView) else { return true }
        let columns = views[row].count
        if column + 1 < columns {
            views[row][column + 1].becomeFirstResponder()
        } else if row + 1 < views.count {
            views[row + 1][0].becomeFirstResponder()
        } else if views.count < NoteTable.maxRows {
            // Enter in the last cell: a new row, and the caret goes to its first cell.
            cells = NoteTable.applying(.addRow, to: cells)
            configure(cells, header: header, look: look ?? NoteRichText.Look(PageAnnotation(page: 0, kind: .table, x: 0, y: 0, width: 0, height: 0)))
            layoutIfNeeded()
            onChange?(cells)
            views.last?.first?.becomeFirstResponder()
        } else {
            textView.resignFirstResponder()
        }
        return false
    }

    private func position(of textView: UITextView) -> (Int, Int)? {
        for (rowIndex, row) in views.enumerated() {
            if let columnIndex = row.firstIndex(where: { $0 === textView }) { return (rowIndex, columnIndex) }
        }
        return nil
    }
}

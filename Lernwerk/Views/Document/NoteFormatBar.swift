import UIKit

/// The row above the keyboard while a text is typed: headings, lists, checklist, table, and putting the keyboard away.
final class NoteFormatBar: UIView {
    private let stack = UIStackView()

    init(onBlock: @escaping (NoteBlock) -> Void, onTable: @escaping () -> Void, onDone: @escaping () -> Void) {
        super.init(frame: CGRect(x: 0, y: 0, width: 320, height: 46))
        autoresizingMask = .flexibleWidth
        backgroundColor = QuillUIColor.surface
        let line = UIView()
        line.backgroundColor = QuillUIColor.line2
        line.frame = CGRect(x: 0, y: 0, width: 320, height: 1)
        line.autoresizingMask = [.flexibleWidth, .flexibleBottomMargin]
        addSubview(line)

        stack.axis = .horizontal
        stack.alignment = .center
        stack.spacing = 4
        let items: [(String, String, () -> Void)] = [
            ("textformat.size.larger", "Überschrift 1", { onBlock(.heading1) }),
            ("textformat.size", "Überschrift 2", { onBlock(.heading2) }),
            ("list.bullet", "Aufzählung", { onBlock(.bullet) }),
            ("list.number", "Nummerierte Liste", { onBlock(.numbered) }),
            ("checklist", "Checkliste", { onBlock(.check(done: false)) }),
            ("tablecells", "Tabelle einfügen", onTable),
        ]
        for (symbol, label, action) in items {
            stack.addArrangedSubview(Self.button(symbol: symbol, label: label, action: action))
        }
        let spacer = UIView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        stack.addArrangedSubview(spacer)
        stack.addArrangedSubview(Self.button(symbol: "keyboard.chevron.compact.down", label: "Tastatur ausblenden", action: onDone))
        addSubview(stack)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        stack.frame = CGRect(x: 10, y: 1, width: bounds.width - 20, height: bounds.height - 1)
    }

    private static func button(symbol: String, label: String, action: @escaping () -> Void) -> UIButton {
        let button = UIButton(type: .system)
        button.setImage(UIImage(systemName: symbol), for: .normal)
        button.tintColor = QuillUIColor.ink
        button.accessibilityLabel = label
        button.widthAnchor.constraint(equalToConstant: 44).isActive = true
        button.heightAnchor.constraint(equalToConstant: 40).isActive = true
        button.addAction(UIAction { _ in action() }, for: .touchUpInside)
        return button
    }
}

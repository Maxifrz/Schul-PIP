import Foundation
@testable import Lernwerk

/// Drafts covering every layout, its limits and its fallbacks. The digests of what `SlideLayouts.build` made of them
/// before layouts became components are in `GoldenLayoutDigests`; the component registry has to reproduce them.
enum GoldenLayoutCases {
    struct Case {
        var name: String
        var draft: SlideDraft
        var image: PlacedImage?
        var placeholder = false
    }

    static let picture = PlacedImage(name: "p.jpg", aspect: 1.5)
    static let tall = PlacedImage(name: "t.jpg", aspect: 0.6)
    static let long = String(repeating: "Ein langer Satz mit vielen Wörtern und Zeichen. ", count: 8)

    static func items(_ count: Int, long: Bool = false, icons: Bool = false) -> [DraftItem] {
        (1...count).map { DraftItem(title: long ? "Titel \($0) " + GoldenLayoutCases.long : "Titel \($0)", text: long ? GoldenLayoutCases.long : "Text zu Punkt \($0)", icon: icons ? "🔥" : "") }
    }

    static var all: [Case] {
        var cases: [Case] = []
        func add(_ name: String, _ draft: SlideDraft, image: PlacedImage? = nil, placeholder: Bool = false) {
            cases.append(Case(name: name, draft: draft, image: image, placeholder: placeholder))
        }
        for layout in SlideLayout.allCases {
            add("preset-\(layout.rawValue)", SlideDraft(layout: layout), placeholder: true)
        }
        add("title", SlideDraft(layout: .title, title: "Ein Titel", subtitle: "Untertitel hier"))
        add("title-long", SlideDraft(layout: .title, title: long, subtitle: long))
        add("title-bare", SlideDraft(layout: .title, title: "Nur Titel"))
        add("section", SlideDraft(layout: .section, title: "Abschnitt", subtitle: "Worum es geht"))
        add("section-long", SlideDraft(layout: .section, title: long))
        add("statement", SlideDraft(layout: .statement, title: "Eine klare Aussage", subtitle: "Mit Zusatz"))
        add("statement-long", SlideDraft(layout: .statement, title: long, subtitle: long))
        add("bullets", SlideDraft(layout: .bullets, title: "Punkte", bullets: ["Eins", "Zwei", "Drei"]))
        add("bullets-many", SlideDraft(layout: .bullets, title: long, bullets: (1...14).map { "Stichpunkt \($0) mit etwas mehr Text" }))
        add("bullets-empty", SlideDraft(layout: .bullets, title: "Leer"))
        add("bullets-empty-untitled", SlideDraft(layout: .bullets))
        add("image-text", SlideDraft(layout: .imageText, title: "Bild", bullets: ["Was", "Warum"]), image: picture)
        add("image-text-tall", SlideDraft(layout: .imageText, title: "Bild", bullets: ["Was"]), image: tall)
        add("image-text-missing", SlideDraft(layout: .imageText, title: "Bild", bullets: ["Was", "Warum"]))
        add("image-text-missing-empty", SlideDraft(layout: .imageText, title: "Nur Titel"))
        add("image-full", SlideDraft(layout: .imageFull, title: "Großes Bild", subtitle: "Unterschrift"), image: picture)
        add("image-full-bare", SlideDraft(layout: .imageFull, title: "Großes Bild"), image: tall)
        add("image-full-missing", SlideDraft(layout: .imageFull, title: "Ohne Bild", bullets: ["A"]))
        add("two-columns", SlideDraft(layout: .twoColumns, title: "Vergleich", leftTitle: "Links", left: ["a", "b"], rightTitle: "Rechts", right: ["c", "d"]))
        add("two-columns-untitled", SlideDraft(layout: .twoColumns, title: "Vergleich", left: [long], right: ["x"]))
        for count in [2, 3, 4, 5] {
            add("cards-\(count)", SlideDraft(layout: .cards, title: "Karten", items: items(count)))
        }
        add("cards-long", SlideDraft(layout: .cards, title: "Karten", items: items(4, long: true)))
        add("cards-icons", SlideDraft(layout: .cards, title: "Karten", items: items(3, icons: true)))
        add("cards-one", SlideDraft(layout: .cards, title: "Nur eine", items: items(1)))
        add("cards-none", SlideDraft(layout: .cards, title: "Keine", bullets: ["Rückfall"]))
        for count in [2, 3, 5, 6] {
            add("process-\(count)", SlideDraft(layout: .process, title: "Ablauf", items: items(count)))
        }
        add("process-long", SlideDraft(layout: .process, title: "Ablauf", items: items(5, long: true)))
        add("process-one", SlideDraft(layout: .process, title: "Ablauf", items: items(1)))
        for count in [2, 4, 6, 7] {
            add("timeline-\(count)", SlideDraft(layout: .timeline, title: "Zeit", items: items(count)))
        }
        add("timeline-long", SlideDraft(layout: .timeline, title: "Zeit", items: items(6, long: true)))
        add("big-number", SlideDraft(layout: .bigNumber, title: "Zahl", subtitle: "Erklärung", value: "70 %"))
        add("big-number-bullets", SlideDraft(layout: .bigNumber, title: "Zahl", bullets: ["a", "b"], value: "1.234"))
        add("big-number-long", SlideDraft(layout: .bigNumber, title: "Zahl", subtitle: long, value: "12.345.678,9 Mio."))
        add("big-number-empty", SlideDraft(layout: .bigNumber, title: "Zahl", bullets: ["Nur Text"]))
        add("chart-bar", SlideDraft(layout: .chart, title: "Balken", subtitle: "Quelle", chart: ChartDraft(kind: .bar, labels: ["A", "B", "C"], values: [3, 5, 2], unit: "%")))
        add("chart-line", SlideDraft(layout: .chart, title: "Linie", chart: ChartDraft(kind: .line, labels: ["A", "B", "C", "D"], values: [3, -5, 2, 4], unit: "kg")))
        add("chart-negative", SlideDraft(layout: .chart, title: "Negativ", chart: ChartDraft(kind: .bar, labels: ["A", "B"], values: [-3, -5])))
        add("chart-many", SlideDraft(layout: .chart, title: "Viele", chart: ChartDraft(kind: .bar, labels: (1...14).map { "Label \($0)" }, values: (1...14).map(Double.init))))
        add("chart-one", SlideDraft(layout: .chart, title: "Eins", chart: ChartDraft(kind: .bar, labels: ["A"], values: [3])))
        add("chart-none", SlideDraft(layout: .chart, title: "Keins", bullets: ["Rückfall"]))
        let table = [["Merkmal", "A", "B"], ["Zeile 1", "x", "y"], ["Zeile 2", "z", ""], ["Zeile 3"]]
        add("table", SlideDraft(layout: .table, title: "Tabelle", table: table))
        add("table-tall", SlideDraft(layout: .table, title: "Tabelle", table: [["Kopf", "Wert"]] + (1...9).map { ["Zeile \($0)", "\($0)"] }))
        add("table-wide", SlideDraft(layout: .table, title: "Tabelle", table: [["A", "B", "C", "D", "E", "F", "G"], ["1", "2", "3", "4", "5", "6", "7"]]))
        add("table-long", SlideDraft(layout: .table, title: "Tabelle", table: [["Kopf", "Lang"], ["Zeile", long]]))
        add("table-header-only", SlideDraft(layout: .table, title: "Tabelle", bullets: ["Rückfall"], table: [["Nur Kopf"]]))
        add("quote", SlideDraft(layout: .quote, quote: "Ein Zitat.", attribution: "Jemand"))
        add("quote-title", SlideDraft(layout: .quote, title: "Nur Titel als Zitat"))
        add("quote-long", SlideDraft(layout: .quote, quote: long + long, attribution: long))
        add("blank", SlideDraft(layout: .blank, title: "Egal"))
        return cases
    }

    /// Rounded, so trigonometry that differs in the last bit between platforms does not matter.
    private static func n(_ value: Double) -> String { String(format: "%.4f", value) }

    /// The elements without their random ids, as one line each.
    static func digest(_ elements: [SlideElement]) -> String {
        let lines = elements.map { e in
            [
                "\(e.kind)", n(e.x), n(e.y), n(e.width), n(e.height), n(e.rotation), e.text, n(e.fontSize), "\(e.bold)", "\(e.italic)",
                "\(e.align)", "\(e.anchor)", "\(e.bullets)", e.textColor, "\(e.shape)", e.fill, e.stroke, n(e.strokeWidth), e.image ?? "-", e.font,
            ].joined(separator: "|")
        }
        var hash: UInt64 = 0xcbf2_9ce4_8422_2325
        for byte in lines.joined(separator: "\n").utf8 {
            hash ^= UInt64(byte)
            hash = hash &* 0x100_0000_01b3
        }
        return "\(elements.count):" + String(hash, radix: 16)
    }
}

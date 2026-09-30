import Foundation

/// The kinds of diagrams the module library offers. A diagram is one element on a slide; its data is a few lines of
/// text that can be changed at any time, and its look is drawn from that text.
enum ChartType: String, Codable, CaseIterable, Identifiable {
    case column, bar, line, area, pie, donut
    case scatter, bubble, histogram, boxplot, violin, radar, heatmap
    case sankey, alluvial, funnel, treemap, orgchart
    case geo, network, chord, wordcloud

    var id: String { rawValue }

    var label: String {
        switch self {
        case .column: return "Säulendiagramm"
        case .bar: return "Balkendiagramm"
        case .line: return "Liniendiagramm"
        case .area: return "Flächendiagramm"
        case .pie: return "Kreisdiagramm"
        case .donut: return "Donut-Diagramm"
        case .scatter: return "Streudiagramm"
        case .bubble: return "Blasendiagramm"
        case .histogram: return "Histogramm"
        case .boxplot: return "Boxplot"
        case .violin: return "Violin-Plot"
        case .radar: return "Netzdiagramm"
        case .heatmap: return "Heatmap"
        case .sankey: return "Sankey-Diagramm"
        case .alluvial: return "Alluvial-Diagramm"
        case .funnel: return "Trichter-Diagramm"
        case .treemap: return "Treemap"
        case .orgchart: return "Organigramm"
        case .geo: return "Kachelkarte Deutschland"
        case .network: return "Netzwerk"
        case .chord: return "Chord-Diagramm"
        case .wordcloud: return "Wortwolke"
        }
    }

    /// One line for the gallery: what it shows.
    var summary: String {
        switch self {
        case .column: return "Werte verschiedener Kategorien oder Zeiträume vergleichen"
        case .bar: return "Kategorien mit langen Namen nebeneinander vergleichen"
        case .line: return "Trends und Verläufe über die Zeit"
        case .area: return "Verlauf mit betonter Menge"
        case .pie: return "Anteile an einem Ganzen"
        case .donut: return "Anteile mit Gesamtwert in der Mitte"
        case .scatter: return "Zusammenhang zweier Größen, mit Trendlinie"
        case .bubble: return "Zusammenhang mit einer dritten Größe als Blasengröße"
        case .histogram: return "Häufigkeitsverteilung in Wertebereichen"
        case .boxplot: return "Median, Quartile und Ausreißer je Gruppe"
        case .violin: return "Boxplot mit der genauen Form der Verteilung"
        case .radar: return "Profile über mehrere Achsen vergleichen"
        case .heatmap: return "Stärke von Werten als Farbe im Gitter"
        case .sankey: return "Mengenflüsse, Breite gleich Menge"
        case .alluvial: return "Wechsel von Gruppen über Stufen oder Zeitpunkte"
        case .funnel: return "Stufen eines Prozesses mit Verlust je Stufe"
        case .treemap: return "Anteile und Gruppen als verschachtelte Flächen"
        case .orgchart: return "Hierarchie und Zuständigkeiten"
        case .geo: return "Werte der 16 Bundesländer als Kachelkarte"
        case .network: return "Verbindungen zwischen vielen Elementen"
        case .chord: return "Beziehungen und Übergänge im Kreis"
        case .wordcloud: return "Häufigkeit von Wörtern durch Schriftgröße"
        }
    }

    var group: ModuleGroup {
        switch self {
        case .column, .bar, .line, .area, .pie, .donut: return .diagrams
        case .scatter, .bubble, .histogram, .boxplot, .violin, .radar, .heatmap: return .distributions
        case .sankey, .alluvial, .funnel, .treemap, .orgchart: return .flows
        case .geo, .network, .chord, .wordcloud: return .special
        }
    }

    /// The size the diagram has when dropped on a slide, in slide points.
    var naturalSize: (width: Double, height: Double) {
        switch self {
        case .geo: return (400, 340)
        case .pie, .donut, .radar, .chord: return (500, 340)
        case .orgchart, .sankey, .alluvial: return (600, 340)
        default: return (560, 340)
        }
    }

    /// How the data is written, shown under the text field.
    var hint: String {
        switch self {
        case .column, .bar, .line, .area:
            return "Eine Zeile je Kategorie: Name; Wert. Mehrere Reihen: erste Zeile „; Reihe A; Reihe B“, dann Name; Wert; Wert."
        case .pie, .donut:
            return "Eine Zeile je Anteil: Name; Wert. Die Prozente rechnet die Grafik selbst aus."
        case .scatter:
            return "Eine Zeile je Punkt: x; y. Optional eine Kopfzeile mit den Achsennamen. Ab drei Punkten kommt eine Trendlinie mit r."
        case .bubble:
            return "Eine Zeile je Blase: x; y; Größe; Name (Name ist optional). Optional eine Kopfzeile mit den Achsennamen."
        case .histogram:
            return "Die Messwerte, getrennt durch Leerzeichen, Semikolon oder Zeilenumbruch. Die Klassen bildet die Grafik selbst."
        case .boxplot, .violin:
            return "Eine Zeile je Gruppe: Name; Wert; Wert; Wert … (mindestens drei Werte). Ohne Namen zählt alles als eine Gruppe."
        case .radar:
            return "Erste Zeile „; Reihe A; Reihe B“, dann je Achse: Name; Wert; Wert."
        case .heatmap:
            return "Erste Zeile „; Spalte 1; Spalte 2“, dann je Zeile: Name; Wert; Wert."
        case .sankey:
            return "Eine Zeile je Fluss: Quelle -> Ziel; Menge. Die Spalten ergeben sich aus den Verbindungen."
        case .alluvial:
            return "Eine Zeile je Fluss: Stufe|Gruppe -> Stufe|Gruppe; Menge, zum Beispiel 2015|Partei A -> 2019|Partei B; 12."
        case .funnel:
            return "Eine Zeile je Stufe, von oben nach unten: Name; Wert."
        case .treemap:
            return "Eine Zeile je Fläche: Name; Wert. Mit „Gruppe/Name; Wert“ werden Flächen zu Gruppen zusammengefasst."
        case .orgchart:
            return "Eine Zeile je Kästchen. Eingerückt (zwei Leerzeichen je Ebene) gehört es zum Kästchen darüber."
        case .geo:
            return "Eine Zeile je Bundesland: Name oder Kürzel; Wert, zum Beispiel Bayern; 13,4 oder NW; 18,1."
        case .network:
            return "Eine Zeile je Verbindung: A - B. Mit Gewicht: A - B; 3. Einzelne Namen ohne Verbindung sind auch erlaubt."
        case .chord:
            return "Erste Zeile „; A; B; C“, dann je Zeile: Name; Wert; Wert; Wert (von der Zeile zur Spalte)."
        case .wordcloud:
            return "Eine Zeile je Wort: Wort; Gewicht. Oder einfach ein Text: jedes Wort zählt so oft, wie es vorkommt."
        }
    }

    /// Sample data the module comes with, and what the editor shows when the type is switched.
    var sample: String {
        switch self {
        case .column:
            return "; 2023; 2024\nQ1; 12; 15\nQ2; 18; 21\nQ3; 16; 24\nQ4; 22; 27"
        case .bar:
            return "Deutschland; 84\nFrankreich; 68\nItalien; 59\nSpanien; 48\nPolen; 38"
        case .line:
            return "; Klasse A; Klasse B\nSep; 2,8; 3,1\nOkt; 2,6; 3,0\nNov; 2,4; 2,9\nDez; 2,5; 2,6\nJan; 2,2; 2,5\nFeb; 2,0; 2,4"
        case .area:
            return "Mo; 12\nDi; 18\nMi; 15\nDo; 24\nFr; 30\nSa; 22\nSo; 14"
        case .pie:
            return "Solar; 38\nWind; 31\nWasser; 18\nBiomasse; 9\nSonstige; 4"
        case .donut:
            return "Miete; 850\nEssen; 320\nMobilität; 180\nFreizeit; 140\nSparen; 210"
        case .scatter:
            return "Lernzeit in h; Punkte\n1; 42\n2; 48\n2,5; 55\n3; 53\n4; 64\n4,5; 61\n5; 72\n6; 70\n6,5; 81\n7; 78\n8; 88\n9; 91"
        case .bubble:
            return "Preis in €; Bewertung; Verkäufe; Produkt\n12; 3,8; 300; A\n25; 4,2; 180; B\n40; 4,6; 90; C\n18; 4,0; 260; D\n55; 4,8; 40; E\n30; 3,5; 120; F"
        case .histogram:
            return "62 71 55 80 68 74 59 66 72 77 64 70\n81 69 73 58 65 76 67 71 63 79 60 74\n68 72 66 75 70 61 78 69 73 64 67 71"
        case .boxplot:
            return "Klasse A; 45; 52; 58; 60; 61; 65; 70; 72; 88\nKlasse B; 50; 55; 60; 63; 66; 68; 71; 74; 79\nKlasse C; 30; 41; 48; 55; 57; 62; 66; 90; 95"
        case .violin:
            return "Klasse A; 45; 52; 55; 58; 60; 61; 62; 65; 66; 70; 72; 88\nKlasse B; 50; 55; 58; 60; 63; 64; 66; 68; 70; 71; 74; 79\nKlasse C; 30; 41; 48; 52; 55; 57; 60; 62; 66; 80; 90; 95"
        case .radar:
            return "; Anna; Ben\nMathe; 4; 3\nDeutsch; 3; 5\nEnglisch; 5; 4\nSport; 2; 4\nKunst; 3; 2"
        case .heatmap:
            return "; Mo; Di; Mi; Do; Fr\nVormittag; 3; 5; 2; 6; 4\nMittag; 1; 2; 3; 2; 5\nNachmittag; 4; 6; 8; 5; 2\nAbend; 7; 3; 4; 6; 9"
        case .sankey:
            return "Solar -> Strom; 40\nWind -> Strom; 55\nGas -> Strom; 30\nKohle -> Strom; 35\nGas -> Wärme; 45\nStrom -> Haushalte; 90\nStrom -> Industrie; 70\nWärme -> Haushalte; 45"
        case .alluvial:
            return "2015|Partei A -> 2019|Partei A; 30\n2015|Partei A -> 2019|Partei B; 10\n2015|Partei B -> 2019|Partei B; 25\n2015|Partei B -> 2019|Partei C; 5\n2015|Partei C -> 2019|Partei C; 20\n2019|Partei A -> 2023|Partei A; 28\n2019|Partei A -> 2023|Partei B; 12\n2019|Partei B -> 2023|Partei B; 22\n2019|Partei B -> 2023|Partei C; 13\n2019|Partei C -> 2023|Partei C; 25"
        case .funnel:
            return "Besucher; 10000\nInteressenten; 4200\nWarenkorb; 1300\nKäufer; 520"
        case .treemap:
            return "Europa/Deutschland; 84\nEuropa/Frankreich; 68\nEuropa/Italien; 59\nAsien/Japan; 125\nAsien/Vietnam; 98\nAfrika/Nigeria; 224\nAfrika/Äthiopien; 126"
        case .orgchart:
            return "Schulleitung\n  Sekretariat\n  Mittelstufe\n    Klassenleitungen\n  Oberstufe\n    Tutoren\n    Fachschaften"
        case .geo:
            return "Baden-Württemberg; 11,3\nBayern; 13,4\nBerlin; 3,9\nBrandenburg; 2,6\nBremen; 0,7\nHamburg; 1,9\nHessen; 6,4\nMecklenburg-Vorpommern; 1,6\nNiedersachsen; 8,1\nNordrhein-Westfalen; 18,1\nRheinland-Pfalz; 4,2\nSaarland; 1,0\nSachsen; 4,1\nSachsen-Anhalt; 2,2\nSchleswig-Holstein; 3,0\nThüringen; 2,1"
        case .network:
            return "Anna - Ben\nAnna - Clara\nBen - Clara\nClara - David\nDavid - Eva\nEva - Anna; 2\nEva - Frank\nFrank - David"
        case .chord:
            return "; A; B; C; D\nA; 0; 10; 5; 2\nB; 8; 0; 6; 3\nC; 4; 5; 0; 7\nD; 1; 2; 6; 0"
        case .wordcloud:
            return "Nachhaltigkeit; 10\nKlima; 9\nEnergie; 8\nRecycling; 6\nMobilität; 6\nWasser; 5\nVerzicht; 4\nTechnik; 5\nZukunft; 7\nBildung; 4\nCO2; 6\nWald; 4\nSolar; 5\nWind; 5\nMüll; 3\nBoden; 3\nArtenvielfalt; 4\nStrom; 4"
        }
    }
}

/// A diagram element: its type, the data as text, and a few options.
struct ChartSpec: Codable, Equatable {
    var type: ChartType
    var data: String
    var unit = ""
    var title = ""
    var showValues = true

    init(type: ChartType, data: String? = nil, unit: String = "", title: String = "", showValues: Bool = true) {
        self.type = type
        self.data = data ?? type.sample
        self.unit = unit
        self.title = title
        self.showValues = showValues
    }

    enum CodingKeys: String, CodingKey {
        case type, data, unit, title, showValues
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = (try? c.decode(ChartType.self, forKey: .type)) ?? .column
        data = try c.decodeIfPresent(String.self, forKey: .data) ?? type.sample
        unit = try c.decodeIfPresent(String.self, forKey: .unit) ?? ""
        title = try c.decodeIfPresent(String.self, forKey: .title) ?? ""
        showValues = try c.decodeIfPresent(Bool.self, forKey: .showValues) ?? true
    }
}

// MARK: - Reading the data text

/// Turns the lines a student typed into numbers and tables, forgiving about separators and decimal commas.
enum ChartParse {
    /// "3,5", "3.5", "1.234,5", "12 %", "4 €" as numbers; nil for anything else.
    static func number(_ raw: String) -> Double? {
        var text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return nil }
        for symbol in ["%", "€", "$", "£"] { text = text.replacingOccurrences(of: symbol, with: "") }
        text = text.replacingOccurrences(of: " ", with: "").replacingOccurrences(of: "\u{00A0}", with: "")
        if text.contains(",") && text.contains(".") {
            text = text.replacingOccurrences(of: ".", with: "").replacingOccurrences(of: ",", with: ".")
        } else {
            text = text.replacingOccurrences(of: ",", with: ".")
        }
        guard let value = Double(text), value.isFinite, abs(value) < 1e15 else { return nil }
        return value
    }

    /// The non-empty lines, split into trimmed cells at semicolons or tabs; a line with neither is split at its last
    /// colon if it has one. Lines starting with # are comments.
    static func rows(_ text: String) -> [[String]] {
        var result: [[String]] = []
        for line in text.components(separatedBy: .newlines) {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            if trimmed.isEmpty || trimmed.hasPrefix("#") { continue }
            let cells: [String]
            if trimmed.contains(";") {
                cells = trimmed.components(separatedBy: ";")
            } else if trimmed.contains("\t") {
                cells = trimmed.components(separatedBy: "\t")
            } else if let colon = trimmed.lastIndex(of: ":") {
                cells = [String(trimmed[..<colon]), String(trimmed[trimmed.index(after: colon)...])]
            } else {
                cells = [trimmed]
            }
            result.append(cells.map { $0.trimmingCharacters(in: .whitespaces) })
        }
        return result
    }

    /// Series in columns, categories in rows: the shape of most charts.
    struct Table: Equatable {
        var seriesNames: [String]
        var labels: [String]
        /// values[row][series]; missing or unreadable cells are nil
        var values: [[Double?]]

        var seriesCount: Int { seriesNames.count }
        var isEmpty: Bool { labels.isEmpty || seriesNames.isEmpty }

        var allValues: [Double] { values.flatMap { $0 }.compactMap { $0 } }
    }

    static func table(_ text: String) -> Table {
        let all = rows(text)
        guard !all.isEmpty else { return Table(seriesNames: [], labels: [], values: []) }
        let first = all[0]
        // A header has an empty first cell, or a cell after the first that is not a number.
        let hasHeader = first.count >= 2 && (first[0].isEmpty || first.dropFirst().contains { number($0) == nil })
        let body = hasHeader ? Array(all.dropFirst()) : all
        let width = max(1, (body.map(\.count).max() ?? 2) - 1)
        var names: [String]
        if hasHeader {
            names = Array(first.dropFirst())
            if names.count < width { names += (names.count..<width).map { _ in "" } }
            names = names.enumerated().map { $0.element.isEmpty ? (width == 1 ? "Wert" : "Reihe \($0.offset + 1)") : $0.element }
        } else {
            names = width == 1 ? ["Wert"] : (0..<width).map { "Reihe \($0 + 1)" }
        }
        var labels: [String] = []
        var values: [[Double?]] = []
        for row in body {
            labels.append(row.first ?? "")
            var cells: [Double?] = []
            for index in 0..<width {
                cells.append(index + 1 < row.count ? number(row[index + 1]) : nil)
            }
            values.append(cells)
        }
        return Table(seriesNames: Array(names.prefix(width)), labels: labels, values: values)
    }

    /// Every number in the text, wherever it stands: for a histogram's raw measurements.
    static func numbers(_ text: String) -> [Double] {
        var result: [Double] = []
        for row in text.components(separatedBy: .newlines) {
            let parts = row.components(separatedBy: CharacterSet(charactersIn: "; \t"))
            for part in parts {
                if let value = number(part) { result.append(value) }
            }
        }
        return result
    }

    /// Groups of samples: `Name; v; v; v` per line. A text with no such lines is one group of all its numbers.
    static func groups(_ text: String) -> [(name: String, values: [Double])] {
        var result: [(name: String, values: [Double])] = []
        for row in rows(text) where row.count >= 2 {
            let values = row.dropFirst().compactMap { number($0) }
            if values.count >= 3 || (row.count >= 2 && values.count == row.count - 1 && values.count >= 2) {
                result.append((row[0].isEmpty ? "Gruppe \(result.count + 1)" : row[0], values))
            }
        }
        if !result.isEmpty { return result }
        let all = numbers(text)
        return all.isEmpty ? [] : [("Daten", all)]
    }

    /// Flows `Quelle -> Ziel; Menge` (also `Quelle; Ziel; Menge`); zero and negative amounts are dropped.
    static func flows(_ text: String) -> [(source: String, target: String, value: Double)] {
        var result: [(source: String, target: String, value: Double)] = []
        for row in rows(text) {
            var source = ""
            var target = ""
            var amount: Double?
            if let arrow = row[0].range(of: "->") ?? row[0].range(of: "→") {
                source = row[0][..<arrow.lowerBound].trimmingCharacters(in: .whitespaces)
                target = row[0][arrow.upperBound...].trimmingCharacters(in: .whitespaces)
                amount = row.count > 1 ? number(row[1]) : 1
            } else if row.count >= 3 {
                source = row[0]
                target = row[1]
                amount = number(row[2])
            } else {
                continue
            }
            guard !source.isEmpty, !target.isEmpty, source != target, let amount, amount > 0 else { continue }
            result.append((source, target, amount))
        }
        return result
    }

    /// Connections `A - B` (or `A -- B`, `A – B`) with an optional weight; a line with one name is a lone node.
    static func edges(_ text: String) -> (nodes: [String], edges: [(from: Int, to: Int, weight: Double)]) {
        var names: [String] = []
        var edges: [(from: Int, to: Int, weight: Double)] = []
        func index(_ name: String) -> Int {
            if let found = names.firstIndex(of: name) { return found }
            names.append(name)
            return names.count - 1
        }
        for row in rows(text) {
            let line = row[0]
            let weight = row.count > 1 ? (number(row[1]) ?? 1) : 1
            var parts: [String] = []
            for separator in [" -- ", " – ", " - ", "--", "–"] where line.contains(separator) {
                parts = line.components(separatedBy: separator)
                break
            }
            parts = parts.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
            if parts.count >= 2 {
                let a = index(parts[0])
                let b = index(parts[1])
                if a != b { edges.append((a, b, max(weight, 0.1))) }
            } else if parts.count == 1 || !line.isEmpty {
                _ = index(parts.first ?? line)
            }
        }
        return (names, edges)
    }

    /// Words with weights: `Wort; Gewicht` lines, or plain text whose word frequencies count.
    static func words(_ text: String) -> [(word: String, weight: Double)] {
        let structured = rows(text)
        if !structured.isEmpty, structured.allSatisfy({ $0.count >= 2 && number($0[1]) != nil }) {
            return structured.compactMap { row in
                guard let weight = number(row[1]), weight > 0, !row[0].isEmpty else { return nil }
                return (word: row[0], weight: weight)
            }
        }
        var counts: [String: Double] = [:]
        var order: [String] = []
        let separators = CharacterSet.alphanumerics.inverted
        for token in text.components(separatedBy: separators) where token.count >= 3 {
            let key = token.lowercased()
            if counts[key] == nil { order.append(key) }
            counts[key, default: 0] += 1
        }
        return order.map { (word: $0, weight: counts[$0] ?? 1) }
    }

    /// Lines indented by levels: the tree of a chart of an organisation.
    struct Tree: Equatable {
        var texts: [String]
        var parents: [Int]
        var children: [[Int]]
        var roots: [Int]
    }

    static func tree(_ text: String) -> Tree {
        var texts: [String] = []
        var parents: [Int] = []
        var children: [[Int]] = []
        var roots: [Int] = []
        var stack: [(indent: Int, index: Int)] = []
        for line in text.components(separatedBy: .newlines) {
            let stripped = line.trimmingCharacters(in: .whitespaces)
            if stripped.isEmpty || stripped.hasPrefix("#") { continue }
            var indent = 0
            for character in line {
                if character == " " { indent += 1 } else if character == "\t" { indent += 2 } else { break }
            }
            var name = stripped
            for bullet in ["- ", "• ", "* "] where name.hasPrefix(bullet) { name = String(name.dropFirst(bullet.count)) }
            while let top = stack.last, top.indent >= indent { stack.removeLast() }
            let index = texts.count
            texts.append(name)
            children.append([])
            if let parent = stack.last {
                parents.append(parent.index)
                children[parent.index].append(index)
            } else {
                parents.append(-1)
                roots.append(index)
            }
            stack.append((indent, index))
        }
        return Tree(texts: texts, parents: parents, children: children, roots: roots)
    }
}

// MARK: - The map

/// The sixteen Bundesländer as tiles on a grid, roughly where they lie.
enum GermanyTiles {
    struct Tile: Equatable {
        let code: String
        let name: String
        let column: Int
        let row: Int
    }

    static let columns = 5
    static let rows = 5

    static let all: [Tile] = [
        Tile(code: "SH", name: "Schleswig-Holstein", column: 1, row: 0),
        Tile(code: "MV", name: "Mecklenburg-Vorpommern", column: 3, row: 0),
        Tile(code: "HB", name: "Bremen", column: 0, row: 1),
        Tile(code: "HH", name: "Hamburg", column: 1, row: 1),
        Tile(code: "BB", name: "Brandenburg", column: 3, row: 1),
        Tile(code: "BE", name: "Berlin", column: 4, row: 1),
        Tile(code: "NW", name: "Nordrhein-Westfalen", column: 0, row: 2),
        Tile(code: "NI", name: "Niedersachsen", column: 1, row: 2),
        Tile(code: "ST", name: "Sachsen-Anhalt", column: 2, row: 2),
        Tile(code: "RP", name: "Rheinland-Pfalz", column: 0, row: 3),
        Tile(code: "HE", name: "Hessen", column: 1, row: 3),
        Tile(code: "TH", name: "Thüringen", column: 2, row: 3),
        Tile(code: "SN", name: "Sachsen", column: 3, row: 3),
        Tile(code: "SL", name: "Saarland", column: 0, row: 4),
        Tile(code: "BW", name: "Baden-Württemberg", column: 1, row: 4),
        Tile(code: "BY", name: "Bayern", column: 2, row: 4),
    ]

    private static func key(_ text: String) -> String {
        text.folding(options: [.diacriticInsensitive, .caseInsensitive], locale: Locale(identifier: "de_DE"))
            .replacingOccurrences(of: "ß", with: "ss")
            .filter { $0.isLetter }
    }

    /// The tile a name or a two-letter code stands for.
    static func tile(named text: String) -> Tile? {
        let wanted = key(text)
        guard !wanted.isEmpty else { return nil }
        if let byCode = all.first(where: { key($0.code) == wanted }) { return byCode }
        return all.first { key($0.name) == wanted }
    }

    /// Values by tile code from lines `Name; Wert`.
    static func values(_ text: String) -> [String: Double] {
        var result: [String: Double] = [:]
        for row in ChartParse.rows(text) where row.count >= 2 {
            if let tile = tile(named: row[0]), let value = ChartParse.number(row[1]) { result[tile.code] = value }
        }
        return result
    }
}

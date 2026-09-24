import Foundation

/// Canned answers for the presentation tab in demo mode.
enum DemoPresentation {
    static let deckJSON = """
    {"title":"Die Kettenregel","slides":[
    {"layout":"TITLE","title":"Die Kettenregel","subtitle":"Name · Mathematik","notes":"Hallo zusammen, heute geht es um die Kettenregel – eine der wichtigsten Ableitungsregeln fürs Abi.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"BULLETS","title":"Verkettete Funktionen","bullets":["Äußere Funktion wirkt auf innere","Beispiel: (3x² + 1)⁵","Innen: 3x² + 1, außen: v⁵"],"notes":"Viele Funktionen bestehen aus zwei Teilen: Erst wird innen gerechnet, dann wird das Ergebnis außen weiterverarbeitet.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"QUOTE","title":"Merksatz","quote":"Äußere Ableitung mal innere Ableitung.","attribution":"Demo: Kettenregel, S. 1","notes":"Diesen Satz solltet ihr euch merken – er ist die ganze Regel in einem Satz.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"TWO_COLUMNS","title":"Richtig und falsch","leftTitle":"Richtig","left":["5(3x² + 1)⁴ · 6x","= 30x(3x² + 1)⁴"],"rightTitle":"Typischer Fehler","right":["Nur 5(3x² + 1)⁴","Innere Ableitung vergessen"],"notes":"Der häufigste Fehler ist, die innere Ableitung zu vergessen. Links seht ihr die richtige Lösung.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"BULLETS","title":"Fazit","bullets":["Verkettung erkennen","Außen ableiten, innen stehen lassen","Mit innerer Ableitung multiplizieren"],"notes":"Zusammengefasst: erkennen, außen ableiten, mit der inneren Ableitung multiplizieren.","sourceMaterial":0,"sourcePages":[1,2]},
    {"layout":"BULLETS","title":"Quellen","bullets":["Demo: Kettenregel, S. 1–2"],"notes":"Alle Inhalte stammen aus dem Demo-Material.","sourceMaterial":0,"sourcePages":[1,2]}
    ]}
    """

    static let feedback = """
    **Das gelingt dir schon:**
    - Klarer Aufbau von der Definition über das Beispiel zum Fazit
    - Der Merksatz bekommt eine eigene Folie

    **Fragen zum Weiterdenken:**
    1. Folie 2: Woran erkennt deine Klasse ohne Vorwissen, welcher Teil die *innere* Funktion ist?
    2. Folie 4: Würde ein eigenes Rechenbeispiel Schritt für Schritt helfen, bevor du den Fehler zeigst?
    3. Passen sechs Folien zu deiner geplanten Redezeit, oder bleibt Zeit für eine Übungsaufgabe mit der Klasse?
    """

    private static func prompt(of request: LLMRequest) -> String {
        request.messages.flatMap(\.content).compactMap { content -> String? in
            if case let .text(text) = content { return text }
            return nil
        }.joined(separator: "\n")
    }

    static func slideEdit(_ request: LLMRequest) -> String {
        let text = prompt(of: request)
        if text.hasPrefix("Redesign") {
            return #"{"layout":"BULLETS","title":"Neu gestaltet","bullets":["Kernaussage zuerst","Höchstens drei Punkte"],"notes":"Diese Folie wurde im Demo-Modus neu gestaltet."}"#
        }
        var texts: [[String: String]] = []
        let pattern = try? NSRegularExpression(pattern: #"<text id="([^"]+)"[^>]*>\n([\s\S]*?)\n</text>"#)
        let range = NSRange(text.startIndex..., in: text)
        for match in pattern?.matches(in: text, range: range) ?? [] {
            guard let idRange = Range(match.range(at: 1), in: text), let bodyRange = Range(match.range(at: 2), in: text) else { continue }
            let shortened = text[bodyRange].split(separator: "\n", omittingEmptySubsequences: false).prefix(3)
                .map { $0.split(separator: " ").prefix(5).joined(separator: " ") }
                .joined(separator: "\n")
            texts.append(["id": String(text[idRange]), "text": shortened])
        }
        return encode(["texts": texts])
    }

    static func speakerNotes(_ request: LLMRequest) -> String {
        let count = prompt(of: request).components(separatedBy: "<slide number=").count - 1
        let notes = (0..<max(0, count)).map { index -> [String: Any] in
            ["slide": index + 1, "notes": "Demo-Notiz für Folie \(index + 1): Erkläre in zwei, drei Sätzen, was die Folie zeigt, und schau dabei in die Klasse."]
        }
        return encode(["notes": notes])
    }

    private static func encode(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}

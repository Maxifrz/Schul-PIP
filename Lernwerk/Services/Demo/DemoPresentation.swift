import Foundation

/// Canned answers for the presentation tab in demo mode.
enum DemoPresentation {
    static let deckJSON = """
    {"title":"Die Kettenregel","slides":[
    {"layout":"TITLE","title":"Die Kettenregel","subtitle":"Name · Mathematik","notes":"Hallo zusammen, heute geht es um die Kettenregel – eine der wichtigsten Ableitungsregeln fürs Abi.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"STATEMENT","title":"Wie leitet man (3x² + 1)⁵ ab, ohne auszumultiplizieren?","subtitle":"Genau dafür gibt es die Kettenregel.","notes":"Ausmultiplizieren wäre hier eine Qual. Am Ende des Vortrags könnt ihr diese Aufgabe in einer Zeile lösen.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"CARDS","title":"Verkettete Funktionen haben zwei Teile","items":[{"title":"Innere Funktion","text":"v(x) = 3x² + 1 wird zuerst berechnet","icon":"🎯"},{"title":"Äußere Funktion","text":"u(v) = v⁵ verarbeitet das Ergebnis","icon":"📦"},{"title":"Verkettung","text":"f(x) = u(v(x))","icon":"🔗"}],"notes":"Erst wird innen gerechnet, dann wird das Ergebnis außen weiterverarbeitet. Diese Aufteilung ist der Schlüssel.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"QUOTE","title":"Merksatz","quote":"Äußere Ableitung mal innere Ableitung.","attribution":"Demo: Kettenregel, S. 1","notes":"Diesen Satz solltet ihr euch merken – er ist die ganze Regel in einem Satz.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"PROCESS","title":"In drei Schritten zur Ableitung","items":[{"title":"Zerlegen","text":"Innere und äußere Funktion benennen"},{"title":"Ableiten","text":"u'(v) = 5v⁴ und v'(x) = 6x"},{"title":"Multiplizieren","text":"f'(x) = 5(3x² + 1)⁴ · 6x"}],"notes":"So geht ihr bei jeder Aufgabe vor: zerlegen, beide Teile ableiten, multiplizieren.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"TWO_COLUMNS","title":"Die innere Ableitung wird oft vergessen","leftTitle":"Richtig","left":["5(3x² + 1)⁴ · 6x","= 30x(3x² + 1)⁴"],"rightTitle":"Typischer Fehler","right":["Nur 5(3x² + 1)⁴","Innere Ableitung fehlt"],"notes":"Der häufigste Fehler ist, die innere Ableitung zu vergessen. Links seht ihr die richtige Lösung.","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"CHART","title":"Die innere Funktion wächst schnell","chart":{"kind":"LINE","labels":["x = 0","x = 1","x = 2","x = 3"],"values":[1,4,13,28],"unit":""},"subtitle":"Werte von v(x) = 3x² + 1 aus dem Beispiel","notes":"Weil die innere Funktion schnell wächst, wird auch ihre Steigung wichtig – deshalb multiplizieren wir mit v'(x).","sourceMaterial":0,"sourcePages":[1]},
    {"layout":"TABLE","title":"Die Regel gilt für viele Funktionstypen","table":[["Funktion","Innen","Außen"],["sin(2x)","2x","sin v"],["e^(3x)","3x","eᵛ"],["√(x² + 1)","x² + 1","√v"]],"notes":"Auf Seite 2 findet ihr Übungen mit Sinus-, e- und Wurzelfunktionen. Das Vorgehen ist immer gleich.","sourceMaterial":0,"sourcePages":[2]},
    {"layout":"BULLETS","title":"Fazit: erkennen, ableiten, multiplizieren","bullets":["Verkettung erkennen","Außen ableiten, innen stehen lassen","Mit innerer Ableitung multiplizieren"],"notes":"Und damit ist auch unsere Frage vom Anfang beantwortet: 30x(3x² + 1)⁴.","sourceMaterial":0,"sourcePages":[1,2]},
    {"layout":"BULLETS","title":"Quellen","bullets":["Demo: Kettenregel, S. 1–2"],"notes":"Alle Inhalte stammen aus dem Demo-Material.","sourceMaterial":0,"sourcePages":[1,2]}
    ]}
    """

    static let outlineJSON = """
    {"title":"Die Kettenregel","thesis":"Verkettete Funktionen leitet man ab, indem man äußere und innere Ableitung multipliziert.","slides":[{"role":"title","message":"Die Kettenregel","layout":"TITLE","content":"Name · Mathematik","sourceMaterial":0,"sourcePages":[1]},{"role":"hook","message":"Wie leitet man (3x² + 1)⁵ ab, ohne auszumultiplizieren?","layout":"STATEMENT","content":"Genau dafür gibt es die Kettenregel.","sourceMaterial":0,"sourcePages":[1]},{"role":"context","message":"Verkettete Funktionen haben zwei Teile","layout":"CARDS","content":"Erst wird innen gerechnet, dann wird das Ergebnis außen weit","sourceMaterial":0,"sourcePages":[1]},{"role":"core","message":"Merksatz","layout":"QUOTE","content":"Diesen Satz solltet ihr euch merken – er ist die ganze Regel","sourceMaterial":0,"sourcePages":[1]},{"role":"core","message":"In drei Schritten zur Ableitung","layout":"PROCESS","content":"So geht ihr bei jeder Aufgabe vor: zerlegen, beide Teile abl","sourceMaterial":0,"sourcePages":[1]},{"role":"example","message":"Die innere Ableitung wird oft vergessen","layout":"TWO_COLUMNS","content":"Der häufigste Fehler ist, die innere Ableitung zu vergessen.","sourceMaterial":0,"sourcePages":[1]},{"role":"data","message":"Die innere Funktion wächst schnell","layout":"CHART","content":"Werte von v(x) = 3x² + 1 aus dem Beispiel","sourceMaterial":0,"sourcePages":[1]},{"role":"transfer","message":"Die Regel gilt für viele Funktionstypen","layout":"TABLE","content":"Auf Seite 2 findet ihr Übungen mit Sinus-, e- und Wurzelfunk","sourceMaterial":0,"sourcePages":[2]},{"role":"summary","message":"Fazit: erkennen, ableiten, multiplizieren","layout":"BULLETS","content":"Und damit ist auch unsere Frage vom Anfang beantwortet: 30x(","sourceMaterial":0,"sourcePages":[1,2]},{"role":"sources","message":"Quellen","layout":"BULLETS","content":"Alle Inhalte stammen aus dem Demo-Material.","sourceMaterial":0,"sourcePages":[1,2]}]}
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

    private static func slideIDs(_ request: LLMRequest) -> [String] {
        let text = prompt(of: request)
        let pattern = try? NSRegularExpression(pattern: #"<slide number="\d+" id="([^"]+)""#)
        return (pattern?.matches(in: text, range: NSRange(text.startIndex..., in: text)) ?? []).compactMap { match in
            Range(match.range(at: 1), in: text).map { String(text[$0]) }
        }
    }

    static func chat(_ request: LLMRequest) -> String {
        var changes: [[String: Any]] = []
        if let last = slideIDs(request).last {
            changes.append([
                "action": "set_notes",
                "summary": "Notizen der letzten Folie ergänzt",
                "slideId": last,
                "notes": "Demo: Hier würde die KI deine Anweisung umsetzen. Mit einem echten Modell ändert sie Texte, Folien, Reihenfolge oder Design.",
            ])
        }
        return encode([
            "message": "Im Demo-Modus verstehe ich deine Anweisung nicht wirklich – als Beispiel habe ich die Notizen der letzten Folie ergänzt. Rückgängig geht oben links.",
            "changes": changes,
        ])
    }

    static func critique(_ request: LLMRequest) -> String {
        let ids = slideIDs(request)
        var findings: [[String: Any]] = []
        if ids.count > 1 {
            findings.append([
                "severity": "high",
                "slideId": ids[1],
                "problem": "Die Folie behauptet etwas, ohne es zu begründen oder ein Beispiel zu zeigen.",
                "suggestion": "Ergänze in den Notizen ein kurzes Rechenbeispiel, das du beim Vortrag erklärst.",
                "changes": [[
                    "action": "set_notes",
                    "summary": "Rechenbeispiel in die Notizen",
                    "slideId": ids[1],
                    "notes": "Beispiel: f(x) = (2x + 1)³ → f'(x) = 3(2x + 1)² · 2 = 6(2x + 1)². Innen ableiten nicht vergessen!",
                ]],
            ])
        }
        findings.append([
            "severity": "medium",
            "problem": "Es fehlt eine Übungsfolie, auf der die Klasse selbst etwas ausprobiert.",
            "suggestion": "Füge vor dem Fazit eine Folie mit einer kurzen Aufgabe ein.",
            "changes": [[
                "action": "insert_slide",
                "summary": "Übungsfolie vor dem Fazit einfügen",
                "afterSlideId": ids.isEmpty ? "" : ids[max(0, ids.count - 3)],
                "slide": [
                    "layout": "BULLETS",
                    "title": "Probier es selbst",
                    "bullets": ["Leite ab: (5x − 1)⁴", "Zeit: 1 Minute"],
                    "notes": "Gib der Klasse eine Minute und löse dann gemeinsam.",
                ] as [String: Any],
            ]],
        ])
        findings.append([
            "severity": "low",
            "problem": "Im Demo-Modus prüft kein echtes Modell deine Folien.",
            "suggestion": "Hinterlege in den Einstellungen einen API-Key für eine echte Kritik.",
            "changes": [] as [Any],
        ])
        return encode([
            "verdict": "Demo-Kritik: Der Aufbau ist nachvollziehbar, aber Belege und Beteiligung der Klasse fehlen. Mit einem echten Modell wird die Kritik deutlich genauer.",
            "findings": findings,
        ])
    }

    private static func encode(_ object: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: object) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}

import UIKit

/// Bundled sample material and canned answers so the app can be tried without an API key.
enum DemoContent {
    static let materialTitle = "Demo: Kettenregel"

    private static let pages: [(title: String, body: String)] = [
        (
            "Die Kettenregel",
            """
            Viele Funktionen sind verkettet: Eine äußere Funktion wird auf eine innere Funktion angewendet, \
            zum Beispiel f(x) = (3x² + 1)⁵. Die innere Funktion ist v(x) = 3x² + 1, die äußere u(v) = v⁵.

            Kettenregel: f(x) = u(v(x))  ⇒  f'(x) = u'(v(x)) · v'(x)

            Merksatz: äußere Ableitung mal innere Ableitung.

            Beispiel: f(x) = (3x² + 1)⁵
            u'(v) = 5v⁴ und v'(x) = 6x
            f'(x) = 5(3x² + 1)⁴ · 6x = 30x(3x² + 1)⁴

            Typischer Fehler: Die innere Ableitung wird vergessen. Dann steht dort nur 5(3x² + 1)⁴ – \
            das ist falsch, weil die Änderung der inneren Funktion fehlt.
            """
        ),
        (
            "Übungsaufgaben",
            """
            Bestimme jeweils die erste Ableitung.

            a) f(x) = (2x − 7)³
            b) g(x) = sin(4x)
            c) h(x) = e^(x²)
            d) k(x) = √(5x + 2)

            Tipp: Wenn du feststeckst, wähle unten das Hilfe-Werkzeug und ziehe einen Rahmen um die Aufgabe.
            """
        ),
    ]

    static func makePDF() -> Data {
        let bounds = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: bounds)
        return renderer.pdfData { context in
            for page in pages {
                context.beginPage()
                let title = NSAttributedString(
                    string: page.title,
                    attributes: [.font: UIFont.boldSystemFont(ofSize: 26), .foregroundColor: UIColor.black]
                )
                title.draw(at: CGPoint(x: 56, y: 60))

                let style = NSMutableParagraphStyle()
                style.lineSpacing = 6
                style.paragraphSpacing = 10
                let body = NSAttributedString(
                    string: page.body,
                    attributes: [
                        .font: UIFont.systemFont(ofSize: 15),
                        .foregroundColor: UIColor.black,
                        .paragraphStyle: style,
                    ]
                )
                body.draw(in: CGRect(x: 56, y: 116, width: bounds.width - 112, height: bounds.height - 172))
            }
        }
    }

    static func tutorReply(level: HintLevel, studentTurns: Int) -> String {
        switch level {
        case .question where studentTurns <= 1:
            return """
            Schau dir die Funktion genau an: Welcher Teil wird *zuerst* berechnet, wenn du eine Zahl für x \
            einsetzt – und was passiert danach mit diesem Ergebnis?
            """
        case .question:
            return """
            Guter Gedanke! Du erkennst, dass hier zwei Funktionen ineinanderstecken. Wie würdest du die \
            **äußere** Funktion ableiten, wenn du den inneren Teil erst einmal wie eine einzelne Variable behandelst?
            """
        case .hint:
            return """
            Hinweis: Das ist ein Fall für die **Kettenregel** – äußere Ableitung mal innere Ableitung. \
            Nenne den Teil in der Klammer v. Was ist die Ableitung von v³ nach v, und was ist v'(x)?
            """
        case .explanation:
            return """
            So geht's Schritt für Schritt:
            1. Innere Funktion: v(x) = 2x − 7, also v'(x) = 2
            2. Äußere Funktion: u(v) = v³, also u'(v) = 3v²
            3. Kettenregel: f'(x) = 3(2x − 7)² · 2 = **6(2x − 7)²**

            Skizzen-Tipp: Zeichne zwei Kästen – innen „2x − 7“, außen „( )³“ – und schreib an jeden Kasten seine Ableitung.

            Kurzer Check: Wie lautet die Ableitung von (5x + 1)²?
            """
        }
    }

    static let flashcardJSON = encode(Flashcard(
        front: "Wie leitest du eine verkettete Funktion wie (2x − 7)³ ab?",
        back: "Mit der Kettenregel: äußere Ableitung mal innere Ableitung. Hier 3(2x − 7)² · 2 = 6(2x − 7)²."
    ))

    static let planJSON = encode(PlanResponse(topics: [
        TopicDraft(
            title: "Verkettete Funktionen erkennen",
            summary: "Du kannst bei einer Funktion innere und äußere Funktion benennen.",
            prerequisites: [],
            materialIndex: 0,
            sourcePages: [1],
            estimatedMinutes: 20
        ),
        TopicDraft(
            title: "Kettenregel anwenden",
            summary: "Du leitest verkettete Funktionen mit äußerer mal innerer Ableitung ab.",
            prerequisites: ["Verkettete Funktionen erkennen"],
            materialIndex: 0,
            sourcePages: [1],
            estimatedMinutes: 30
        ),
        TopicDraft(
            title: "Übungsaufgaben zur Kettenregel",
            summary: "Du löst gemischte Aufgaben mit Potenz-, Sinus-, e- und Wurzelfunktionen.",
            prerequisites: ["Kettenregel anwenden"],
            materialIndex: 0,
            sourcePages: [2],
            estimatedMinutes: 45
        ),
    ]))

    private static func encode<T: Encodable>(_ value: T) -> String {
        guard let data = try? JSONEncoder().encode(value) else { return "{}" }
        return String(decoding: data, as: UTF8.self)
    }
}

struct DemoLLMClient: LLMClient {
    var capabilities: LLMCapabilities {
        LLMCapabilities(acceptsImages: true, documentHandling: .nativePDF)
    }

    func complete(_ request: LLMRequest) async throws -> LLMResponse {
        try await Task.sleep(nanoseconds: 700_000_000)
        let text: String
        switch request.purpose {
        case let .tutor(level):
            let studentTurns = request.messages.filter { $0.role == .user }.count
            text = DemoContent.tutorReply(level: level, studentTurns: studentTurns)
        case .flashcard:
            text = DemoContent.flashcardJSON
        case .studyPlan:
            text = DemoContent.planJSON
        case .presentation:
            text = DemoPresentation.deckJSON
        case .slideRewrite:
            text = DemoPresentation.slideEdit(request)
        case .speakerNotes:
            text = DemoPresentation.speakerNotes(request)
        case .presentationFeedback:
            text = DemoPresentation.feedback
        case .presentationChat:
            text = DemoPresentation.chat(request)
        case .presentationCritique:
            text = DemoPresentation.critique(request)
        }
        return LLMResponse(text: text, stopReason: "end_turn", model: "demo")
    }
}

import Foundation
import SwiftUI

/// The calculator tab: what is typed, the history, the angle unit, and the graphs.
@MainActor
final class CalculatorModel: ObservableObject {
    @Published var input = CalculatorInput()
    @Published private(set) var history: CalculatorHistory
    @Published private(set) var isBusy = false

    @Published var functions = ["", "", ""]
    @Published var xmin = "-5"
    @Published var xmax = "5"
    @Published private(set) var plot: CASPlot?
    @Published private(set) var plotError: String?
    @Published private(set) var isPlotting = false

    let engine: CASEngine

    private static var fileURL: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base.appendingPathComponent("calculator.json")
    }

    init(engine: CASEngine = .shared) {
        self.engine = engine
        let saved = (try? Data(contentsOf: Self.fileURL)).flatMap { try? JSONDecoder().decode(CalculatorHistory.self, from: $0) }
        history = saved ?? CalculatorHistory()
        engine.restore(definitions: history.definitions, degrees: history.degrees)
        engine.warmUp()
    }

    var degrees: Bool {
        get { history.degrees }
        set {
            history.degrees = newValue
            save()
            Task { await engine.setDegrees(newValue) }
        }
    }

    func submit() {
        let text = input.text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, !isBusy else { return }
        isBusy = true
        Task {
            let answer: CASAnswer
            do {
                answer = try await engine.evaluate(history.resolvingAns(text))
            } catch {
                answer = CASAnswer(ok: false, error: error.localizedDescription)
            }
            history.record(input: text, answer: answer)
            if answer.ok { input.clear() }
            isBusy = false
            save()
        }
    }

    /// Puts an earlier input back into the line.
    func reuse(_ entry: CalculatorEntry) {
        input.set(entry.input)
    }

    /// Inserts an earlier result at the cursor.
    func insertResult(_ entry: CalculatorEntry) {
        guard let exact = entry.exact else { return }
        input.insert("(" + exact.replacingOccurrences(of: "list[", with: "[").replacingOccurrences(of: "matrix[", with: "[") + ")")
    }

    func forget(_ name: String) {
        history.forget(name)
        save()
        Task { await engine.forget([name]) }
    }

    func clearHistory() {
        history.entries.removeAll()
        save()
    }

    private func save() {
        guard let data = try? JSONEncoder().encode(history) else { return }
        try? data.write(to: Self.fileURL, options: .atomic)
    }

    // Graphs

    private func number(_ text: String) -> Double? {
        Double(text.replacingOccurrences(of: ",", with: ".").trimmingCharacters(in: .whitespaces))
    }

    func drawGraphs() {
        let expressions = functions.map { $0.trimmingCharacters(in: .whitespaces) }
        guard expressions.contains(where: { !$0.isEmpty }) else {
            plotError = "Gib mindestens eine Funktion ein, zum Beispiel x^2 - 2."
            return
        }
        guard let low = number(xmin), let high = number(xmax), high > low else {
            plotError = "Der x-Bereich braucht einen Anfang, der kleiner ist als das Ende."
            return
        }
        isPlotting = true
        plotError = nil
        Task {
            do {
                let result = try await engine.plot(expressions, xmin: low, xmax: high)
                if result.ok {
                    plot = result
                } else {
                    plotError = result.error ?? "Das ließ sich nicht zeichnen."
                }
            } catch {
                plotError = error.localizedDescription
            }
            isPlotting = false
        }
    }
}

/// A key of the calculator's keyboard: what it shows and what it types, "|" marking where the cursor goes.
struct CalculatorKey: Identifiable, Hashable {
    enum Action: Hashable {
        case type(String)
        case left, right, delete, clear, submit
    }

    let label: String
    let action: Action
    var isCommand = false

    var id: String { label }

    static func type(_ label: String, _ template: String? = nil) -> CalculatorKey {
        CalculatorKey(label: label, action: .type(template ?? label))
    }

    /// German commands with their templates, in the order school needs them.
    static let commands: [CalculatorKey] = [
        CalculatorKey(label: "löse", action: .type("löse(|, x)"), isCommand: true),
        CalculatorKey(label: "ableiten", action: .type("ableiten(|)"), isCommand: true),
        CalculatorKey(label: "integriere", action: .type("integriere(|, x)"), isCommand: true),
        CalculatorKey(label: "grenzwert", action: .type("grenzwert(|, x, unendlich)"), isCommand: true),
        CalculatorKey(label: "nullstellen", action: .type("nullstellen(|)"), isCommand: true),
        CalculatorKey(label: "faktorisiere", action: .type("faktorisiere(|)"), isCommand: true),
        CalculatorKey(label: "vereinfache", action: .type("vereinfache(|)"), isCommand: true),
        CalculatorKey(label: "ausmultiplizieren", action: .type("ausmultiplizieren(|)"), isCommand: true),
        CalculatorKey(label: "tangente", action: .type("tangente(|, 1)"), isCommand: true),
        CalculatorKey(label: "Matrix", action: .type("[[|, ], [, ]]"), isCommand: true),
        CalculatorKey(label: "det", action: .type("det(|)"), isCommand: true),
        CalculatorKey(label: "inverse", action: .type("inverse(|)"), isCommand: true),
        CalculatorKey(label: "mittelwert", action: .type("mittelwert([|])"), isCommand: true),
        CalculatorKey(label: "median", action: .type("median([|])"), isCommand: true),
        CalculatorKey(label: "standardabweichung", action: .type("standardabweichung([|])"), isCommand: true),
    ]

    static let rows: [[CalculatorKey]] = [
        [.type("x"), .type("y"), .type("("), .type(")"), .type("xⁿ", "^"), .type("√", "√(|)")],
        [.type("7"), .type("8"), .type("9"), .type("÷", "/"), .type("π"), .type("e")],
        [.type("4"), .type("5"), .type("6"), .type("×", "*"), .type("sin", "sin(|)"), .type("cos", "cos(|)")],
        [.type("1"), .type("2"), .type("3"), .type("−", "-"), .type("tan", "tan(|)"), .type("ln", "ln(|)")],
        [.type("0"), .type(".", "."), .type(",", ", "), .type("+"), .type("="), .type("ans")],
        [CalculatorKey(label: "←", action: .left), CalculatorKey(label: "→", action: .right), CalculatorKey(label: "⌫", action: .delete),
         CalculatorKey(label: "AC", action: .clear), .type("x²", "^2"), CalculatorKey(label: "Rechnen", action: .submit)],
    ]
}

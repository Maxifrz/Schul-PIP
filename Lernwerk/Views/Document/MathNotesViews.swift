import Charts
import SwiftUI
import UIKit

/// Reads handwritten maths with the configured vision model, or on the device when there is none, and calculates it
/// with the computer algebra core. The model only transcribes; every number comes from the engine.
@MainActor
enum MathReader {
    static func read(_ jpeg: Data, hint: String, client: any LLMClient) async -> MathNotes.Recognition? {
        if client.capabilities.acceptsImages,
           let recognition = try? await StructuredOutput.complete(
               request: MathNotes.request(imageJPEG: jpeg, hint: hint),
               client: client,
               parse: MathNotes.parse
           ),
           !recognition.lines.isEmpty || recognition.table != nil {
            return recognition
        }
        // Without a vision model: Apple's text recognition, which reads handwriting too.
        let text = await TextRecognizer.recognize(jpeg)
        let lines = text.components(separatedBy: .newlines).map(MathNotes.clean).filter { !$0.isEmpty }
        return lines.isEmpty ? nil : MathNotes.Recognition(kind: nil, lines: lines, table: nil)
    }

    /// What the last line asks, calculated after the definitions above it.
    static func calculate(_ recognition: MathNotes.Recognition, engine: CASEngine) async -> (expression: String, answer: CASAnswer)? {
        let split = MathNotes.split(recognition.lines)
        guard let expression = split.expression else { return nil }
        for definition in split.definitions {
            _ = try? await engine.evaluate(definition)
        }
        guard let answer = try? await engine.evaluate(expression) else { return nil }
        return (expression, answer)
    }
}

/// What the calculate tool found in a framed region: the recognized lines to check and correct, and the results,
/// a graph or a chart to put onto the page.
struct MathRegionSheet: View {
    let request: MathRegionRequest
    let client: any LLMClient
    /// Writes a result below the region; the number counts the results written so far.
    let onWrite: (String, Int) -> Void
    let onImage: (UIImage) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var reading = true
    @State private var text = ""
    @State private var table: MathNotes.Recognition.Table?
    @State private var results: [Result] = []
    @State private var written = 0
    @State private var plot: CASPlot?
    @State private var xmin = "-5"
    @State private var xmax = "5"
    @State private var working = false
    @State private var message: String?

    struct Result: Identifiable {
        let id = UUID()
        var input: String
        var answer: CASAnswer
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    if let image = UIImage(data: request.imageJPEG) {
                        Image(uiImage: image)
                            .resizable()
                            .scaledToFit()
                            .frame(maxHeight: 150)
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Quill.line, lineWidth: 1))
                    }
                    if reading {
                        HStack(spacing: 10) {
                            ProgressView()
                            Text("Die Handschrift wird gelesen …")
                                .font(.work(15))
                                .foregroundStyle(Quill.muted)
                        }
                    } else {
                        recognized
                        actions
                        resultList
                        graphSection
                    }
                    if let message {
                        Text(message)
                            .font(.work(13.5))
                            .foregroundStyle(Quill.warn)
                    }
                }
                .padding(20)
            }
            .background(Quill.bg)
            .navigationTitle("Rechnen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fertig") { dismiss() }
                }
            }
        }
        .task { await read() }
    }

    private var lines: [String] {
        text.components(separatedBy: .newlines).map(MathNotes.clean).filter { !$0.isEmpty }
    }

    private var recognized: some View {
        VStack(alignment: .leading, spacing: 8) {
            PixelCaption(text: "Erkannt – bei Bedarf korrigieren")
            TextEditor(text: $text)
                .font(.system(size: 16, design: .monospaced))
                .frame(minHeight: 90)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(Quill.surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Quill.line2, lineWidth: 1))
            if let table, let data = MathNotes.chartData(table) {
                PixelCaption(text: "Wertetabelle: \(table.rows.count) Zeilen, \(data.columns.count) Zahlenspalte\(data.columns.count == 1 ? "" : "n")")
            }
        }
    }

    private var actions: some View {
        HStack(spacing: 10) {
            Button("Ausrechnen") { Task { await calculate() } }
                .buttonStyle(QuillPrimaryButtonStyle(height: 38))
                .disabled(working || lines.isEmpty)
            Button("Graph") { Task { await drawGraph() } }
                .buttonStyle(QuillOutlineButtonStyle(height: 38))
                .disabled(working || lines.isEmpty)
            if let table, MathNotes.chartData(table) != nil {
                Button("Diagramm einfügen") { insertChart() }
                    .buttonStyle(QuillOutlineButtonStyle(height: 38))
            }
            if working { ProgressView() }
        }
    }

    @ViewBuilder
    private var resultList: some View {
        ForEach(results) { result in
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(result.input)
                        .font(.system(size: 13, design: .monospaced))
                        .foregroundStyle(Quill.muted)
                    if result.answer.ok {
                        Text(result.answer.pretty ?? "")
                            .font(.work(20))
                            .foregroundStyle(Quill.ink)
                        if let approx = result.answer.prettyApprox {
                            Text(approx.hasPrefix("L ≈") ? approx : "≈ " + approx)
                                .font(.work(14))
                                .foregroundStyle(Quill.link)
                        }
                    } else {
                        Text(result.answer.error ?? "Das konnte nicht berechnet werden.")
                            .font(.work(14))
                            .foregroundStyle(Quill.warn)
                    }
                }
                Spacer(minLength: 0)
                if result.answer.ok, let shown = MathNotes.resultText(pretty: result.answer.pretty, approx: result.answer.prettyApprox) {
                    Button("Aufschreiben") {
                        onWrite(result.answer.assigns == nil ? "\(result.input) = \(shown)" : shown, written)
                        written += 1
                    }
                    .buttonStyle(QuillOutlineButtonStyle(height: 32))
                }
            }
            .padding(12)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 10))
        }
    }

    @ViewBuilder
    private var graphSection: some View {
        if let plot {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Text("x von").font(.work(13.5)).foregroundStyle(Quill.muted)
                    TextField("", text: $xmin).frame(width: 56).textFieldStyle(.roundedBorder)
                    Text("bis").font(.work(13.5)).foregroundStyle(Quill.muted)
                    TextField("", text: $xmax).frame(width: 56).textFieldStyle(.roundedBorder)
                    Button("Neu zeichnen") { Task { await drawGraph() } }
                        .buttonStyle(QuillOutlineButtonStyle(height: 30))
                }
                GraphCanvas(plot: plot)
                    .frame(height: 260)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 10))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                PointList(plot: plot)
                Button("Graph auf die Seite") { insertGraph(plot) }
                    .buttonStyle(QuillPrimaryButtonStyle(height: 38))
            }
        }
    }

    // Work

    private func read() async {
        guard reading else { return }
        let recognition = await MathReader.read(request.imageJPEG, hint: MathNotes.regionHint, client: client)
        text = recognition?.lines.joined(separator: "\n") ?? ""
        table = recognition?.table
        reading = false
        if recognition == nil {
            message = "Hier war keine Rechnung zu erkennen. Du kannst sie oben eintippen."
        }
    }

    private func calculate() async {
        working = true
        message = nil
        results = []
        for line in lines {
            var input = line
            while input.hasSuffix("=") || input.hasSuffix("?") { input = String(input.dropLast()).trimmingCharacters(in: .whitespaces) }
            guard !input.isEmpty else { continue }
            do {
                results.append(Result(input: input, answer: try await CASEngine.shared.evaluate(input)))
            } catch {
                message = error.localizedDescription
                break
            }
        }
        working = false
    }

    /// Functions are the lines that define one or use x without being an equation.
    private var functions: [String] {
        lines.filter { line in
            let definition = line.range(of: #"^\s*([A-Za-z]\w*\(x\)|y)\s*="#, options: .regularExpression) != nil
            let usesX = line.range(of: #"(^|[^A-Za-z])x([^A-Za-z]|$)"#, options: .regularExpression) != nil
            return definition || (usesX && !line.contains("="))
        }
        .prefix(3)
        .map { $0 }
    }

    private func drawGraph() async {
        guard !functions.isEmpty else {
            message = "Für einen Graphen braucht es eine Funktion wie f(x) = x^2 oder y = 2x + 1."
            return
        }
        let low = Double(xmin.replacingOccurrences(of: ",", with: ".")) ?? -5
        let high = Double(xmax.replacingOccurrences(of: ",", with: ".")) ?? 5
        working = true
        message = nil
        do {
            let result = try await CASEngine.shared.plot(functions, xmin: min(low, high - 0.1), xmax: high)
            if result.ok { plot = result } else { message = result.error }
        } catch {
            message = error.localizedDescription
        }
        working = false
    }

    private func insertGraph(_ plot: CASPlot) {
        let renderer = ImageRenderer(content: GraphCanvas(plot: plot).frame(width: 800, height: 560).background(Color.white))
        renderer.scale = 2
        guard let image = renderer.uiImage else { return }
        onImage(image)
        dismiss()
    }

    private func insertChart() {
        guard let table, let data = MathNotes.chartData(table) else { return }
        let renderer = ImageRenderer(content: TableChart(data: data).frame(width: 800, height: 520))
        renderer.scale = 2
        guard let image = renderer.uiImage else { return }
        onImage(image)
        dismiss()
    }
}

/// A value table as a chart: lines over x when the first column counts up, otherwise bars per row.
struct TableChart: View {
    let data: MathNotes.ChartData

    struct Point: Identifiable {
        let id: Int
        var series: String
        var label: String
        var x: Double
        var value: Double
    }

    private var points: [Point] {
        var result: [Point] = []
        for column in data.columns {
            for (index, value) in column.values.enumerated() {
                guard let value else { continue }
                let x = data.numericX && index < data.xValues.count ? data.xValues[index] : Double(index)
                result.append(Point(id: result.count, series: column.name, label: data.labels[index], x: x, value: value))
            }
        }
        return result
    }

    var body: some View {
        chart
            .chartLegend(data.columns.count > 1 ? .visible : .hidden)
            .padding(24)
            .background(Color.white)
            .environment(\.colorScheme, .light)
    }

    @ViewBuilder
    private var chart: some View {
        if data.numericX {
            Chart(points) { point in
                LineMark(x: .value("x", point.x), y: .value("Wert", point.value))
                    .foregroundStyle(by: .value("Reihe", point.series))
                PointMark(x: .value("x", point.x), y: .value("Wert", point.value))
                    .foregroundStyle(by: .value("Reihe", point.series))
            }
        } else {
            Chart(points) { point in
                BarMark(x: .value("Kategorie", point.label), y: .value("Wert", point.value))
                    .foregroundStyle(by: .value("Reihe", point.series))
                    .position(by: .value("Reihe", point.series))
            }
        }
    }
}

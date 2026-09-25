import SwiftData
import SwiftUI
import UIKit

/// Up to three functions, their graphs with zeros, extreme points and intersections, and a button that puts the
/// graph into a document as a new page.
struct GraphPane: View {
    @ObservedObject var model: CalculatorModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var choosingDocument = false
    @State private var inserted: String?

    var body: some View {
        let controls = VStack(alignment: .leading, spacing: 10) {
            ForEach(0..<3, id: \.self) { index in
                HStack(spacing: 10) {
                    Circle()
                        .fill(GraphCanvas.color(index))
                        .frame(width: 10, height: 10)
                    Text("f\(index + 1)(x) =")
                        .font(.work(14, .medium))
                        .foregroundStyle(Quill.ink2)
                    TextField(index == 0 ? "x^3 - 3x" : "", text: $model.functions[index])
                        .font(.system(size: 16, design: .monospaced))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .onSubmit(model.drawGraphs)
                }
                .padding(.horizontal, 12)
                .frame(height: 42)
                .background(Quill.surface, in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Quill.line2, lineWidth: 1))
            }
            HStack(spacing: 10) {
                Text("x von")
                    .font(.work(14))
                    .foregroundStyle(Quill.muted)
                rangeField($model.xmin)
                Text("bis")
                    .font(.work(14))
                    .foregroundStyle(Quill.muted)
                rangeField($model.xmax)
                Spacer(minLength: 0)
            }
            HStack(spacing: 10) {
                Button {
                    model.drawGraphs()
                } label: {
                    HStack(spacing: 8) {
                        if model.isPlotting { ProgressView().tint(Quill.bg) }
                        Text("Zeichnen")
                    }
                }
                .buttonStyle(QuillPrimaryButtonStyle(height: 40))
                .disabled(model.isPlotting)
                Button("In Dokument einfügen") { choosingDocument = true }
                    .buttonStyle(QuillOutlineButtonStyle(height: 40))
                    .disabled(model.plot == nil)
            }
            if let error = model.plotError {
                Text(error)
                    .font(.work(13.5))
                    .foregroundStyle(Quill.warn)
            }
            if let inserted {
                Text(inserted)
                    .font(.work(13.5))
                    .foregroundStyle(Quill.link)
            }
            if let plot = model.plot {
                ScrollView {
                    PointList(plot: plot)
                }
            }
        }

        Group {
            if sizeClass == .regular {
                HStack(alignment: .top, spacing: 24) {
                    controls.frame(width: 360)
                    graph
                }
                .padding(.horizontal, 40)
                .padding(.bottom, 24)
            } else {
                ScrollView {
                    VStack(spacing: 14) {
                        graph.frame(height: 320)
                        controls
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 16)
                }
            }
        }
        .sheet(isPresented: $choosingDocument) {
            DocumentChooser { material in
                choosingDocument = false
                insert(into: material)
            }
        }
    }

    private var graph: some View {
        Group {
            if let plot = model.plot {
                GraphCanvas(plot: plot)
            } else {
                Text("Gib eine Funktion ein und tippe auf „Zeichnen“.")
                    .font(.work(15))
                    .foregroundStyle(Quill.muted)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Quill.paper, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Quill.line, lineWidth: 1))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func rangeField(_ text: Binding<String>) -> some View {
        TextField("", text: text)
            .font(.system(size: 15, design: .monospaced))
            .keyboardType(.numbersAndPunctuation)
            .multilineTextAlignment(.center)
            .frame(width: 70, height: 36)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 8))
            .overlay(RoundedRectangle(cornerRadius: 8).stroke(Quill.line2, lineWidth: 1))
    }

    /// The graph with its legend and points, drawn big on white, as a new page after the one last read.
    private func insert(into material: StudyMaterial) {
        guard let plot = model.plot else { return }
        let page = VStack(alignment: .leading, spacing: 18) {
            GraphCanvas(plot: plot)
                .frame(width: 1000, height: 720)
            PointList(plot: plot, printing: true)
                .frame(width: 1000, alignment: .leading)
        }
        .padding(40)
        .background(Color.white)
        let renderer = ImageRenderer(content: page)
        renderer.scale = 2
        guard let image = renderer.uiImage else {
            inserted = "Das Bild des Graphen ließ sich nicht erzeugen."
            return
        }
        let after = material.lastOpenedPage
        if MaterialStore.insertImagePage(image, in: material, after: after) {
            inserted = "Als Seite \(after + 2) in „\(material.title)“ eingefügt."
        } else {
            inserted = "„\(material.title)“ ließ sich nicht ändern."
        }
    }
}

/// Axes with round ticks, the graphs, and their special points, always black on white like paper.
struct GraphCanvas: View {
    let plot: CASPlot

    static let colors: [UInt32] = [0x1F4E9C, 0xC23B3B, 0x2E7D4F]

    static func color(_ index: Int) -> Color {
        Color(QuillUIColor.hex(colors[index % colors.count]))
    }

    var body: some View {
        Canvas { context, size in
            guard let xmin = plot.xmin, let xmax = plot.xmax, let ymin = plot.ymin, let ymax = plot.ymax,
                  xmax > xmin, ymax > ymin
            else { return }
            let inset: CGFloat = 8
            let area = CGRect(x: inset, y: inset, width: size.width - inset * 2, height: size.height - inset * 2)
            func px(_ x: Double) -> CGFloat { area.minX + CGFloat((x - xmin) / (xmax - xmin)) * area.width }
            func py(_ y: Double) -> CGFloat { area.maxY - CGFloat((y - ymin) / (ymax - ymin)) * area.height }
            let ink = Color(QuillUIColor.hex(0x16150F))
            let grid = Color(QuillUIColor.hex(0x16150F, alpha: 0.07))
            let label = Color(QuillUIColor.hex(0x6E6B62))

            let xTicks = CASFormat.ticks(from: xmin, to: xmax, count: max(4, Int(area.width / 70)))
            let yTicks = CASFormat.ticks(from: ymin, to: ymax, count: max(4, Int(area.height / 50)))
            var lines = Path()
            for x in xTicks {
                lines.move(to: CGPoint(x: px(x), y: area.minY))
                lines.addLine(to: CGPoint(x: px(x), y: area.maxY))
            }
            for y in yTicks {
                lines.move(to: CGPoint(x: area.minX, y: py(y)))
                lines.addLine(to: CGPoint(x: area.maxX, y: py(y)))
            }
            context.stroke(lines, with: .color(grid), lineWidth: 1)

            // Axes, at zero when it is in view, otherwise at the edge.
            let axisY = py(min(max(0, ymin), ymax))
            let axisX = px(min(max(0, xmin), xmax))
            var axes = Path()
            axes.move(to: CGPoint(x: area.minX, y: axisY))
            axes.addLine(to: CGPoint(x: area.maxX, y: axisY))
            axes.move(to: CGPoint(x: axisX, y: area.minY))
            axes.addLine(to: CGPoint(x: axisX, y: area.maxY))
            context.stroke(axes, with: .color(ink.opacity(0.7)), lineWidth: 1.2)
            for x in xTicks where abs(x) > 1e-12 {
                context.draw(Text(CASFormat.number(x)).font(.work(10.5)).foregroundColor(label),
                             at: CGPoint(x: px(x), y: min(axisY + 4, area.maxY - 12)), anchor: .top)
            }
            for y in yTicks where abs(y) > 1e-12 {
                context.draw(Text(CASFormat.number(y)).font(.work(10.5)).foregroundColor(label),
                             at: CGPoint(x: max(axisX - 4, area.minX + 24), y: py(y)), anchor: .trailing)
            }
            context.draw(Text("x").font(.work(12, .medium)).foregroundColor(ink), at: CGPoint(x: area.maxX - 4, y: axisY - 4), anchor: .bottomTrailing)
            context.draw(Text("y").font(.work(12, .medium)).foregroundColor(ink), at: CGPoint(x: axisX + 6, y: area.minY + 2), anchor: .topLeading)

            var clipped = context
            clipped.clip(to: Path(area))
            let span = ymax - ymin
            for (index, curve) in (plot.curves ?? []).enumerated() {
                var path = Path()
                var drawing = false
                var previous: Double?
                for (i, value) in curve.values.enumerated() {
                    guard let y = value, y.isFinite else {
                        drawing = false
                        previous = nil
                        continue
                    }
                    let point = CGPoint(x: px(plot.x(at: i, count: curve.values.count)), y: py(max(min(y, ymax + span * 4), ymin - span * 4)))
                    // A jump across a pole is not drawn as a steep line.
                    if drawing, let previous, abs(y - previous) < span * 1.5 {
                        path.addLine(to: point)
                    } else {
                        path.move(to: point)
                    }
                    drawing = true
                    previous = y
                }
                clipped.stroke(path, with: .color(Self.color(index)), style: StrokeStyle(lineWidth: 2.2, lineCap: .round, lineJoin: .round))
            }

            func dot(_ point: CASPlot.Point, filled: Bool, color: Color) {
                let center = CGPoint(x: px(point.x), y: py(point.y))
                guard area.insetBy(dx: -2, dy: -2).contains(center) else { return }
                let circle = Path(ellipseIn: CGRect(x: center.x - 4.5, y: center.y - 4.5, width: 9, height: 9))
                if filled {
                    context.fill(circle, with: .color(color))
                } else {
                    context.fill(circle, with: .color(.white))
                    context.stroke(circle, with: .color(color), lineWidth: 2)
                }
            }
            for root in plot.roots ?? [] { dot(root, filled: false, color: Self.color(root.curve ?? 0)) }
            for extremum in plot.extrema ?? [] { dot(extremum, filled: true, color: Self.color(extremum.curve ?? 0)) }
            for crossing in plot.intersections ?? [] { dot(crossing, filled: true, color: ink) }
        }
    }
}

/// The special points in school notation: N(…), H(…), T(…), S(…).
struct PointList: View {
    let plot: CASPlot
    var printing = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            ForEach(Array((plot.curves ?? []).enumerated()), id: \.offset) { index, curve in
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 8) {
                        Circle().fill(GraphCanvas.color(index)).frame(width: 9, height: 9)
                        Text("\(curve.label) = \(curve.pretty)")
                            .font(.work(printing ? 20 : 14, .medium))
                            .foregroundColor(ink)
                    }
                    line("Nullstellen", points(plot.roots, curve: index, name: "N"))
                    line("Extrempunkte", extrema(for: index))
                    line("y-Achse", points(plot.intercepts, curve: index, name: "Sᵧ"))
                }
            }
            line("Schnittpunkte", (plot.intersections ?? []).enumerated().map { number, point in
                let names = (point.curves ?? []).map { plot.curves?[$0].label ?? "f" }.joined(separator: " und ")
                return CASFormat.point("S\(lowered(number + 1))", x: point.x, y: point.y) + " (\(names))"
            })
        }
    }

    private var ink: Color { printing ? .black : Quill.ink }

    @ViewBuilder
    private func line(_ title: String, _ items: [String]) -> some View {
        if !items.isEmpty {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(.work(printing ? 17 : 12.5))
                    .foregroundColor(printing ? .gray : Quill.muted)
                    .frame(width: printing ? 170 : 100, alignment: .leading)
                Text(items.joined(separator: "   "))
                    .font(.work(printing ? 17 : 13.5))
                    .foregroundColor(ink)
                    .textSelection(.enabled)
            }
        }
    }

    private func points(_ list: [CASPlot.Point]?, curve: Int, name: String) -> [String] {
        let matching = (list ?? []).filter { $0.curve == curve }.sorted { $0.x < $1.x }
        return matching.enumerated().map { number, point in
            CASFormat.point(matching.count > 1 ? name + lowered(number + 1) : name, x: point.x, y: point.y)
        }
    }

    private func extrema(for curve: Int) -> [String] {
        (plot.extrema ?? []).filter { $0.curve == curve }.sorted { $0.x < $1.x }.map { point in
            CASFormat.point(point.kind == "max" ? "H" : "T", x: point.x, y: point.y)
        }
    }

    private func lowered(_ number: Int) -> String {
        let digits = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"]
        return String(number).compactMap { $0.wholeNumberValue.map { digits[$0] } }.joined()
    }
}

/// The library's documents, newest first, to pick where a graph goes.
private struct DocumentChooser: View {
    let onChoose: (StudyMaterial) -> Void
    @Query(sort: \StudyMaterial.createdAt, order: .reverse) private var materials: [StudyMaterial]
    @Environment(\.dismiss) private var dismiss

    private var shown: [StudyMaterial] {
        materials.filter { !$0.isTrashed }.sorted { ($0.lastOpenedAt ?? $0.createdAt) > ($1.lastOpenedAt ?? $1.createdAt) }
    }

    var body: some View {
        NavigationStack {
            List(shown) { material in
                Button {
                    onChoose(material)
                } label: {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(material.title)
                            .font(.work(16))
                            .foregroundStyle(Quill.ink)
                        Text("Neue Seite nach Seite \(material.lastOpenedPage + 1)")
                            .font(.work(12.5))
                            .foregroundStyle(Quill.muted)
                    }
                }
            }
            .overlay {
                if shown.isEmpty {
                    Text("Noch keine Dokumente in der Bibliothek.")
                        .font(.work(15))
                        .foregroundStyle(Quill.muted)
                }
            }
            .navigationTitle("In welches Dokument?")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Abbrechen") { dismiss() }
                }
            }
        }
    }
}

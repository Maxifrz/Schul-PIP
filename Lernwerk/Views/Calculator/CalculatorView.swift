import SwiftData
import SwiftUI
import UIKit

/// The calculator tab: exact and rounded results with Giac, German commands, variables across lines, and a
/// function plotter whose graphs go into documents.
struct CalculatorView: View {
    @StateObject private var model = CalculatorModel()
    @ObservedObject private var engine = CASEngine.shared
    @State private var mode = Mode.calculate
    @Environment(\.horizontalSizeClass) private var sizeClass

    enum Mode: String, CaseIterable {
        case calculate = "Rechnen"
        case graph = "Graph"
    }

    var body: some View {
        VStack(spacing: 0) {
            header
            switch mode {
            case .calculate: CalculatorPane(model: model)
            case .graph: GraphPane(model: model)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var header: some View {
        HStack(alignment: .bottom, spacing: 16) {
            VStack(alignment: .leading, spacing: 10) {
                PixelCaption(text: engineCaption, color: engineCaptionColor)
                Text("Rechner")
                    .font(.work(sizeClass == .regular ? 40 : 30, .light))
                    .tracking(-1.1)
                    .foregroundStyle(Quill.ink)
            }
            Spacer(minLength: 0)
            Picker("Modus", selection: $mode) {
                ForEach(Mode.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .frame(width: 180)
            .padding(.bottom, 4)
        }
        .padding(.horizontal, sizeClass == .regular ? 40 : 16)
        .padding(.top, sizeClass == .regular ? 32 : 16)
        .padding(.bottom, 12)
    }

    private var engineCaption: String {
        switch engine.state {
        case .idle, .loading: return "Rechenkern lädt"
        case .ready: return "Giac · exakt und gerundet"
        case .failed: return "Rechenkern nicht verfügbar"
        }
    }

    private var engineCaptionColor: Color {
        if case .failed = engine.state { return Quill.warn }
        return Quill.hint
    }
}

// MARK: - Calculating

private struct CalculatorPane: View {
    @ObservedObject var model: CalculatorModel
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var typing = false
    @FocusState private var fieldFocused: Bool

    var body: some View {
        if sizeClass == .regular {
            HStack(alignment: .top, spacing: 24) {
                VStack(spacing: 12) {
                    historyList
                    definitions
                    inputLine
                }
                keyboard
                    .frame(width: 430)
            }
            .padding(.horizontal, 40)
            .padding(.bottom, 24)
        } else {
            VStack(spacing: 10) {
                historyList
                definitions
                inputLine
                keyboard
            }
            .padding(.horizontal, 12)
            .padding(.bottom, 10)
        }
    }

    // History

    private var historyList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) {
                    if model.history.entries.isEmpty {
                        emptyHint
                    }
                    ForEach(model.history.entries) { entry in
                        HistoryRow(entry: entry)
                            .contentShape(Rectangle())
                            .onTapGesture { model.insertResult(entry) }
                            .contextMenu {
                                Button {
                                    model.reuse(entry)
                                } label: {
                                    Label("Eingabe übernehmen", systemImage: "arrow.uturn.down")
                                }
                                if entry.exact != nil {
                                    Button {
                                        model.insertResult(entry)
                                    } label: {
                                        Label("Ergebnis einfügen", systemImage: "text.insert")
                                    }
                                }
                                Button {
                                    UIPasteboard.general.string = entry.pretty ?? entry.input
                                } label: {
                                    Label("Kopieren", systemImage: "doc.on.doc")
                                }
                            }
                            .id(entry.id)
                        QuillDivider(color: Quill.lineSoft)
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14))
            .overlay(RoundedRectangle(cornerRadius: 14).stroke(Quill.line, lineWidth: 1))
            .onChange(of: model.history.entries.count) { _, _ in
                if let last = model.history.entries.last {
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo(last.id, anchor: .bottom) }
                }
            }
            .onAppear {
                if let last = model.history.entries.last { proxy.scrollTo(last.id, anchor: .bottom) }
            }
            .overlay(alignment: .topTrailing) {
                if !model.history.entries.isEmpty {
                    Menu {
                        Button(role: .destructive) {
                            model.clearHistory()
                        } label: {
                            Label("Verlauf leeren", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .font(.system(size: 17))
                            .foregroundStyle(Quill.muted)
                            .frame(width: 40, height: 40)
                    }
                }
            }
        }
    }

    private var emptyHint: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tippe eine Rechnung oder einen Befehl, zum Beispiel:")
                .font(.work(14))
                .foregroundStyle(Quill.muted)
            ForEach(["löse(x^2 - 5x + 6 = 0, x)", "ableiten(x^3 · sin(x))", "integriere(x^2, x, 0, 3)", "a = 5  ·  f(x) = a·x^2"], id: \.self) { example in
                Text(example)
                    .font(.system(size: 14, design: .monospaced))
                    .foregroundStyle(Quill.ink2)
            }
            Text("Tippe auf ein Ergebnis, um es weiterzuverwenden; gedrückt halten für mehr.")
                .font(.work(12.5))
                .foregroundStyle(Quill.faint)
                .padding(.top, 4)
        }
        .padding(18)
    }

    // Definitions

    @ViewBuilder
    private var definitions: some View {
        if !model.history.definitions.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    PixelCaption(text: "Variablen")
                    ForEach(model.history.definitions, id: \.name) { definition in
                        Button {
                            model.input.insert(definition.name)
                        } label: {
                            Text(definition.pretty)
                                .font(.work(13.5))
                                .foregroundStyle(Quill.ink)
                                .padding(.horizontal, 12)
                                .frame(height: 30)
                                .background(Quill.hover, in: Capsule())
                        }
                        .buttonStyle(QuillPressStyle())
                        .contextMenu {
                            Button(role: .destructive) {
                                model.forget(definition.name)
                            } label: {
                                Label("\(definition.name) vergessen", systemImage: "xmark")
                            }
                        }
                    }
                }
            }
        }
    }

    // Input

    private var inputLine: some View {
        HStack(spacing: 10) {
            Group {
                if typing {
                    TextField("Rechnung", text: Binding(get: { model.input.text }, set: { model.input.set($0) }))
                        .font(.system(size: 20, design: .monospaced))
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .focused($fieldFocused)
                        .onSubmit(model.submit)
                } else {
                    (Text(model.input.beforeCursor).foregroundColor(Quill.ink)
                        + Text("|").foregroundColor(Quill.accent)
                        + Text(model.input.afterCursor).foregroundColor(Quill.ink))
                        .font(.system(size: 20, design: .monospaced))
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                        .onTapGesture {
                            typing = true
                            fieldFocused = true
                        }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 36, alignment: .leading)
            Button {
                typing.toggle()
                fieldFocused = typing
            } label: {
                Image(systemName: typing ? "keyboard.chevron.compact.down" : "keyboard")
                    .font(.system(size: 16))
                    .foregroundStyle(Quill.muted)
                    .frame(width: 36, height: 36)
            }
            .buttonStyle(QuillPressStyle())
            .accessibilityLabel(typing ? "Rechnertastatur" : "Systemtastatur")
            if model.isBusy {
                ProgressView()
                    .frame(width: 36, height: 36)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Quill.surface, in: RoundedRectangle(cornerRadius: 14))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Quill.line2, lineWidth: 1))
    }

    // Keyboard

    private var keyboard: some View {
        VStack(spacing: 8) {
            HStack {
                Picker("Winkel", selection: Binding(get: { model.degrees }, set: { model.degrees = $0 })) {
                    Text("Bogenmaß").tag(false)
                    Text("Grad").tag(true)
                }
                .pickerStyle(.segmented)
                .frame(width: 200)
                Spacer()
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(CalculatorKey.commands) { key in
                        Button {
                            press(key)
                        } label: {
                            Text(key.label)
                                .font(.work(13.5, .medium))
                                .foregroundStyle(Quill.link)
                                .padding(.horizontal, 12)
                                .frame(height: 34)
                                .background(Quill.accent.opacity(0.14), in: Capsule())
                        }
                        .buttonStyle(QuillPressStyle())
                    }
                }
            }
            Grid(horizontalSpacing: 6, verticalSpacing: 6) {
                ForEach(Array(CalculatorKey.rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(row) { key in
                            keyButton(key)
                        }
                    }
                }
            }
        }
    }

    private func keyButton(_ key: CalculatorKey) -> some View {
        let isSubmit = key.action == .submit
        let isDigit = key.label.count == 1 && key.label.first?.isNumber == true
        return Button {
            press(key)
        } label: {
            Text(key.label)
                .font(.work(isSubmit ? 15 : 18, isSubmit ? .semibold : .regular))
                .foregroundStyle(isSubmit ? Quill.onAccent : Quill.ink)
                .frame(maxWidth: .infinity)
                .frame(height: sizeClass == .regular ? 52 : 44)
                .background(
                    isSubmit ? Quill.accent : (isDigit ? Quill.surface : Quill.hover),
                    in: RoundedRectangle(cornerRadius: 10)
                )
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Quill.line, lineWidth: isDigit ? 1 : 0))
        }
        .buttonStyle(QuillPressStyle())
        .disabled(isSubmit && model.isBusy)
        .accessibilityLabel(key.label)
    }

    private func press(_ key: CalculatorKey) {
        switch key.action {
        case let .type(template): model.input.insert(template)
        case .left: model.input.moveLeft()
        case .right: model.input.moveRight()
        case .delete: model.input.backspace()
        case .clear: model.input.clear()
        case .submit: model.submit()
        }
    }
}

private struct HistoryRow: View {
    let entry: CalculatorEntry

    var body: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(entry.input)
                .font(.system(size: 14, design: .monospaced))
                .foregroundStyle(Quill.muted)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let error = entry.error {
                Text(error)
                    .font(.work(15))
                    .foregroundStyle(Quill.warn)
            } else if let matrix = entry.matrix {
                MatrixView(rows: matrix)
            } else {
                Text(entry.pretty ?? "")
                    .font(.work(22))
                    .foregroundStyle(Quill.ink)
                    .multilineTextAlignment(.trailing)
                    .textSelection(.enabled)
            }
            if let approx = entry.prettyApprox {
                Text(approx.hasPrefix("L ≈") ? approx : "≈ " + approx)
                    .font(.work(15))
                    .foregroundStyle(Quill.link)
            }
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 12)
    }
}

/// A matrix between brackets, column by column.
private struct MatrixView: View {
    let rows: [[String]]

    var body: some View {
        HStack(spacing: 8) {
            bracket(left: true)
            Grid(horizontalSpacing: 16, verticalSpacing: 6) {
                ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
                    GridRow {
                        ForEach(Array(row.enumerated()), id: \.offset) { _, cell in
                            Text(cell)
                                .font(.work(18))
                                .foregroundStyle(Quill.ink)
                        }
                    }
                }
            }
            bracket(left: false)
        }
        .fixedSize()
    }

    private func bracket(left: Bool) -> some View {
        GeometryReader { geometry in
            Path { path in
                let w = geometry.size.width, h = geometry.size.height
                if left {
                    path.move(to: CGPoint(x: w, y: 0))
                    path.addLine(to: CGPoint(x: 0, y: 0))
                    path.addLine(to: CGPoint(x: 0, y: h))
                    path.addLine(to: CGPoint(x: w, y: h))
                } else {
                    path.move(to: CGPoint(x: 0, y: 0))
                    path.addLine(to: CGPoint(x: w, y: 0))
                    path.addLine(to: CGPoint(x: w, y: h))
                    path.addLine(to: CGPoint(x: 0, y: h))
                }
            }
            .stroke(Quill.ink, lineWidth: 1.5)
        }
        .frame(width: 6)
    }
}

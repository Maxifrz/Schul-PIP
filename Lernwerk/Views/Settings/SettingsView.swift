import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings

    @State private var pickerTask: LLMTask?

    var body: some View {
        ScrollView {
            ContentColumn(maxWidth: 680) {
                PageHeader(caption: "Version \(appVersion)", title: "Einstellungen")
                    .padding(.bottom, 34)

                ModelSection(
                    header: "Lernhilfe & Karteikarten",
                    selection: $settings.tutor,
                    task: .tutor,
                    hasKey: settings.demoMode || settings.hasKey(for: settings.tutor.provider),
                    footer: "Empfohlen: NVIDIA NIM, gratis. Text und Handschrift im markierten Bereich erkennt das iPad selbst. Formeln liest die Texterkennung oft falsch – dafür hilft ein Modell, das Bilder versteht.",
                    onPickModel: { pickerTask = .tutor }
                )
                ModelSection(
                    header: "Lernplan",
                    selection: $settings.plan,
                    task: .plan,
                    hasKey: settings.demoMode || settings.hasKey(for: settings.plan.provider),
                    footer: "Empfohlen: OpenRouter. Die App liest PDFs selbst aus, eingescannte Seiten per Texterkennung auf dem iPad (offline). Nur was dabei unlesbar bleibt, geht an die Texterkennung von OpenRouter (braucht Guthaben, ca. 2 $ pro 1.000 Seiten) oder bei NVIDIA als Bild (höchstens \(PlanGenerator.maxScannedPageImages) Seiten).",
                    onPickModel: { pickerTask = .plan }
                )

                VStack(alignment: .leading, spacing: 0) {
                    PixelCaption(text: "API-Keys")
                        .padding(.bottom, 6)
                    ForEach(LLMProvider.allCases) { provider in
                        APIKeyRow(provider: provider)
                    }
                    Text("Keys liegen nur im Schlüsselbund dieses Geräts. Ein Claude-Pro-Abo enthält keinen API-Zugang.")
                        .quillFootnote()
                }
                .padding(.bottom, 34)

                VStack(alignment: .leading, spacing: 0) {
                    QuillDivider()
                    QuillRow(label: "Demo-Modus") {
                        Toggle("Demo-Modus", isOn: $settings.demoMode)
                            .labelsHidden()
                            .tint(Quill.accent)
                    }
                    Text("Antwortet mit vorbereiteten Beispielen statt einer echten KI – zum Ausprobieren ohne Key.")
                        .quillFootnote()
                }
                .padding(.bottom, 34)

                PixelCaption(text: "Über")
                    .padding(.bottom, 6)
                QuillRow(label: "Version", verticalPadding: 15) {
                    Text(appVersion)
                        .font(.work(14))
                        .foregroundStyle(Quill.faint)
                }
            }
        }
        .scrollIndicators(.hidden)
        .sheet(item: $pickerTask) { task in
            ModelPickerSheet(selection: task == .tutor ? $settings.tutor : $settings.plan)
        }
    }

    private var appVersion: String {
        let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "–"
        let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "–"
        return "\(version) (Build \(build))"
    }
}

extension LLMTask: Identifiable {
    var id: Self { self }
}

private struct ModelSection: View {
    let header: String
    @Binding var selection: ModelSelection
    let task: LLMTask
    let hasKey: Bool
    let footer: String
    let onPickModel: () -> Void

    private var option: ModelOption? {
        selection.provider.option(for: selection.model)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: header)
                .padding(.bottom, 6)

            QuillRow(label: "Anbieter") {
                HStack(spacing: 6) {
                    ForEach(LLMProvider.allCases) { provider in
                        providerPill(provider)
                    }
                }
            }

            Button(action: onPickModel) {
                HStack(spacing: 14) {
                    Text("Modell")
                        .font(.work(15.5))
                        .foregroundStyle(Quill.ink)
                    Spacer(minLength: 8)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(option?.name ?? (selection.model.isEmpty ? "Eigene Modell-ID" : selection.model))
                            .font(.work(14.5))
                            .foregroundStyle(Quill.ink)
                            .lineLimit(1)
                        Text(option?.note ?? "Eigenes Modell")
                            .font(.work(12.5))
                            .foregroundStyle(Quill.faint)
                    }
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Quill.hint)
                }
                .padding(.vertical, 15)
                .padding(.horizontal, 2)
                .overlay(alignment: .bottom) { QuillDivider() }
            }
            .buttonStyle(QuillPressStyle())

            if option == nil {
                TextField("Modell-ID, z. B. meta/llama-3.2-90b-vision-instruct", text: $selection.model)
                    .font(.system(size: 13, design: .monospaced))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 14)
                    .frame(height: 40)
                    .background(Quill.surface, in: Capsule())
                    .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                    .padding(.vertical, 12)
                    .padding(.horizontal, 2)
                    .overlay(alignment: .bottom) { QuillDivider() }
            }

            if selection.provider != .anthropic {
                QuillRow(label: "Bilder mitschicken") {
                    Toggle("Bilder mitschicken", isOn: $selection.sendsImages)
                        .labelsHidden()
                        .tint(Quill.accent)
                }
            }

            if !hasKey {
                HStack(spacing: 9) {
                    StatusDot(color: Quill.warn)
                    Text("Für \(selection.provider.name) ist noch kein API-Key hinterlegt.")
                        .font(.work(14))
                        .foregroundStyle(Quill.muted)
                }
                .padding(.vertical, 13)
                .padding(.horizontal, 2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .bottom) { QuillDivider() }
            }

            Text(footer)
                .quillFootnote()
        }
        .padding(.bottom, 34)
    }

    private func providerPill(_ provider: LLMProvider) -> some View {
        let isSelected = provider == selection.provider
        return Button {
            guard !isSelected else { return }
            withAnimation(.easeInOut(duration: 0.2)) {
                selection = .defaultSelection(for: task, provider: provider)
            }
        } label: {
            Text(provider.name)
                .font(.work(13.5))
                .foregroundStyle(isSelected ? Quill.bg : Quill.ink)
                .padding(.horizontal, 14)
                .frame(height: 34)
                .background(isSelected ? Quill.ink : Color.clear, in: Capsule())
                .overlay(Capsule().stroke(isSelected ? Color.clear : Quill.line2, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

private struct ModelPickerSheet: View {
    @Binding var selection: ModelSelection
    @Environment(\.dismiss) private var dismiss

    private static let customID = "__custom__"

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PixelCaption(text: "Modell · \(selection.provider.name)")
                .padding(.bottom, 10)
            ScrollView {
                VStack(spacing: 0) {
                    ForEach(selection.provider.models) { option in
                        row(id: option.id, name: option.name, note: option.note)
                    }
                    row(id: Self.customID, name: "Eigene Modell-ID", note: "Jedes Modell aus dem Katalog des Anbieters")
                }
            }
            .scrollIndicators(.hidden)
        }
        .padding(.horizontal, 24)
        .padding(.top, 22)
        .padding(.bottom, 26)
        .presentationDetents([.medium, .large])
        .presentationBackground(Quill.bg)
        .presentationCornerRadius(24)
    }

    private var isCustom: Bool {
        selection.provider.option(for: selection.model) == nil
    }

    private func row(id: String, name: String, note: String) -> some View {
        let isSelected = id == Self.customID ? isCustom : id == selection.model
        return Button {
            pick(id)
        } label: {
            HStack(alignment: .top, spacing: 13) {
                ZStack {
                    Circle().strokeBorder(isSelected ? Quill.accent : Quill.line3, lineWidth: 1.5)
                    if isSelected {
                        Circle().fill(Quill.accent).frame(width: 9, height: 9)
                    }
                }
                .frame(width: 18, height: 18)
                .padding(.top, 1)
                VStack(alignment: .leading, spacing: 3) {
                    Text(name)
                        .font(.work(15.5, .medium))
                        .tracking(-0.15)
                        .foregroundStyle(Quill.ink)
                    Text(note)
                        .font(.work(13.5))
                        .foregroundStyle(Quill.faint)
                }
                Spacer(minLength: 0)
            }
            .padding(.vertical, 14)
            .padding(.horizontal, 2)
            .overlay(alignment: .bottom) { QuillDivider() }
        }
        .buttonStyle(QuillPressStyle())
    }

    private func pick(_ id: String) {
        if id == Self.customID {
            if !isCustom { selection.model = "" }
        } else {
            selection.model = id
            if let option = selection.provider.option(for: id) {
                selection.sendsImages = option.vision
            }
        }
        dismiss()
    }
}

private struct APIKeyRow: View {
    let provider: LLMProvider

    @EnvironmentObject private var settings: AppSettings
    @State private var input = ""
    @State private var saveFailed = false

    var body: some View {
        Group {
            if settings.hasKey(for: provider) {
                HStack(spacing: 14) {
                    HStack(spacing: 9) {
                        StatusDot()
                        Text(provider.name)
                            .font(.work(15.5))
                            .foregroundStyle(Quill.ink)
                    }
                    Spacer()
                    Button("Entfernen") {
                        settings.deleteKey(for: provider)
                    }
                    .font(.work(14, .medium))
                    .foregroundStyle(Quill.muted)
                    .buttonStyle(.plain)
                }
            } else {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .firstTextBaseline) {
                        Text(provider.name)
                            .font(.work(15.5, .medium))
                            .tracking(-0.15)
                            .foregroundStyle(Quill.ink)
                        Spacer()
                        Link("Key holen", destination: provider.keyPortal)
                            .font(.work(14))
                            .foregroundStyle(Quill.link)
                            .tint(Quill.link)
                    }
                    HStack(spacing: 8) {
                        SecureField(provider.keyPlaceholder, text: $input)
                            .font(.work(14.5))
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .padding(.vertical, 8)
                        Button("Speichern") {
                            saveFailed = !settings.saveKey(input, for: provider)
                            if !saveFailed { input = "" }
                        }
                        .buttonStyle(QuillPrimaryButtonStyle(height: 32, fontSize: 13.5))
                        .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    .padding(.leading, 16)
                    .padding(4)
                    .background(Quill.surface, in: Capsule())
                    .overlay(Capsule().stroke(Quill.line2, lineWidth: 1))
                    if saveFailed {
                        Text("Der Key konnte nicht gespeichert werden.")
                            .font(.work(12.5))
                            .foregroundStyle(Quill.warn)
                    }
                }
            }
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 2)
        .overlay(alignment: .bottom) { QuillDivider() }
    }
}

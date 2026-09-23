import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    ModelSelectionEditor(
                        selection: $settings.tutor,
                        task: .tutor,
                        hasKey: settings.demoMode || settings.hasKey(for: settings.tutor.provider)
                    )
                } header: {
                    Text("Lernhilfe & Karteikarten")
                } footer: {
                    Text("Empfohlen: NVIDIA NIM, gratis. Das Modell sollte Bilder verstehen, damit es auch deine Handschrift im markierten Bereich lesen kann.")
                }

                Section {
                    ModelSelectionEditor(
                        selection: $settings.plan,
                        task: .plan,
                        hasKey: settings.demoMode || settings.hasKey(for: settings.plan.provider)
                    )
                } header: {
                    Text("Lernplan")
                } footer: {
                    Text("Empfohlen: OpenRouter. PDFs mit Text liest die App selbst aus. Eingescannte PDFs wandelt OpenRouter per Texterkennung um – das braucht Guthaben (ca. 2 $ pro 1.000 Seiten). Mit NVIDIA gehen höchstens \(PlanGenerator.maxScannedPageImages) eingescannte Seiten, als Bilder.")
                }

                Section {
                    ForEach(LLMProvider.allCases) { provider in
                        APIKeyRow(provider: provider)
                    }
                } header: {
                    Text("API-Keys")
                } footer: {
                    Text("Keys liegen nur im Schlüsselbund dieses Geräts. Ein Claude-Pro-Abo enthält keinen API-Zugang.")
                }

                Section {
                    Toggle("Demo-Modus", isOn: $settings.demoMode)
                } footer: {
                    Text("Antwortet mit vorbereiteten Beispielen statt einer echten KI – zum Ausprobieren ohne Key.")
                }

                Section("Über") {
                    LabeledContent("Version", value: appVersion)
                }
            }
            .navigationTitle("Einstellungen")
        }
    }

    private var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "–"
    }
}

private struct ModelSelectionEditor: View {
    @Binding var selection: ModelSelection
    let task: LLMTask
    let hasKey: Bool

    private static let customTag = "__custom__"

    private var isCustom: Bool {
        selection.provider.option(for: selection.model) == nil
    }

    var body: some View {
        Picker("Anbieter", selection: providerBinding) {
            ForEach(LLMProvider.allCases) { provider in
                Text(provider.name).tag(provider)
            }
        }

        Picker("Modell", selection: modelBinding) {
            ForEach(selection.provider.models) { option in
                VStack(alignment: .leading) {
                    Text(option.name)
                    Text(option.note)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .tag(option.id)
            }
            Text("Eigene Modell-ID").tag(Self.customTag)
        }
        .pickerStyle(.navigationLink)

        if isCustom {
            TextField("Modell-ID, z. B. meta/llama-3.2-90b-vision-instruct", text: $selection.model)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .font(.callout.monospaced())
        }

        if selection.provider != .anthropic {
            Toggle("Bilder mitschicken", isOn: $selection.sendsImages)
        }

        if !hasKey {
            Label("Für \(selection.provider.name) ist noch kein API-Key hinterlegt.", systemImage: "key")
                .font(.callout)
                .foregroundStyle(.orange)
        }
    }

    private var providerBinding: Binding<LLMProvider> {
        Binding(
            get: { selection.provider },
            set: { provider in
                guard provider != selection.provider else { return }
                selection = .defaultSelection(for: task, provider: provider)
            }
        )
    }

    private var modelBinding: Binding<String> {
        Binding(
            get: { isCustom ? Self.customTag : selection.model },
            set: { value in
                if value == Self.customTag {
                    if !isCustom { selection.model = "" }
                } else {
                    selection.model = value
                    if let option = selection.provider.option(for: value) {
                        selection.sendsImages = option.vision
                    }
                }
            }
        )
    }
}

private struct APIKeyRow: View {
    let provider: LLMProvider

    @EnvironmentObject private var settings: AppSettings
    @State private var input = ""
    @State private var saveFailed = false

    var body: some View {
        if settings.hasKey(for: provider) {
            HStack {
                Label(provider.name, systemImage: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                Spacer()
                Button("Entfernen", role: .destructive) {
                    settings.deleteKey(for: provider)
                }
                .buttonStyle(.borderless)
            }
        } else {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(provider.name)
                        .font(.headline)
                    Spacer()
                    Link("Key holen", destination: provider.keyPortal)
                        .font(.subheadline)
                }
                HStack {
                    SecureField(provider.keyPlaceholder, text: $input)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Speichern") {
                        saveFailed = !settings.saveKey(input, for: provider)
                        if !saveFailed { input = "" }
                    }
                    .buttonStyle(.borderless)
                    .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty)
                }
                if saveFailed {
                    Text("Der Key konnte nicht gespeichert werden.")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            }
            .padding(.vertical, 4)
        }
    }
}

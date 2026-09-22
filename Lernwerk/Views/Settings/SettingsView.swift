import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings

    @State private var keyInput = ""
    @State private var keyError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    if settings.hasAPIKey {
                        Label("API-Key gespeichert", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                        Button("Key entfernen", role: .destructive) {
                            settings.deleteAPIKey()
                        }
                    } else {
                        SecureField("sk-ant-…", text: $keyInput)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                        Button("Speichern") {
                            keyError = settings.saveAPIKey(keyInput) ? nil : "Der Key konnte nicht gespeichert werden."
                            keyInput = ""
                        }
                        .disabled(keyInput.trimmingCharacters(in: .whitespaces).isEmpty)
                    }
                    if let keyError {
                        Text(keyError)
                            .foregroundStyle(.red)
                    }
                } header: {
                    Text("Claude API")
                } footer: {
                    Text("Der Key liegt nur im Schlüsselbund dieses Geräts. Du bekommst ihn in der Anthropic Console; abgerechnet wird pro Anfrage.")
                }

                Section("Modell") {
                    Picker("Modell", selection: $settings.model) {
                        ForEach(AppSettings.models) { option in
                            VStack(alignment: .leading) {
                                Text(option.name)
                                Text(option.note)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .tag(option.id)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                }

                Section {
                    Toggle("Demo-Modus", isOn: $settings.demoMode)
                } footer: {
                    Text("Antwortet mit vorbereiteten Beispielen statt der echten KI – zum Ausprobieren ohne Key.")
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

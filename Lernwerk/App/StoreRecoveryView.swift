import SwiftUI

/// Shown instead of the app when the database cannot be opened: the student decides to start over, and nothing is lost
/// for good because the old files are only renamed.
struct StoreRecoveryView: View {
    let onReset: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            PipLogo(pixel: 6)
            Text("Die Daten lassen sich nicht öffnen")
                .font(.work(26, .semibold))
                .foregroundStyle(Quill.ink)
                .multilineTextAlignment(.center)
            Text("Schul-PIP kann die gespeicherte Datenbank nicht lesen. Deine PDFs, Notizen und Zeichnungen sind noch da. Du kannst die Datenbank beiseitelegen und neu starten: Karten, Lernplan und Stundenplan sind dann leer. Die alte Datenbank bleibt als Datei auf dem Gerät erhalten.")
                .font(.work(15.5))
                .lineSpacing(4)
                .foregroundStyle(Quill.muted)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 460)
                .fixedSize(horizontal: false, vertical: true)
            Button("Beiseitelegen und neu starten", action: onReset)
                .buttonStyle(QuillPrimaryButtonStyle(height: 50, fontSize: 16))
                .padding(.top, 6)
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Quill.bg.ignoresSafeArea())
    }
}

import AVFoundation
import SwiftUI

/// Speaks a word or sentence with the system voice for its language. The voices come with iOS and work offline once
/// downloaded; without one for the language the system's default is used.
final class Speaker: NSObject, ObservableObject {
    static let shared = Speaker()

    private let synthesizer = AVSpeechSynthesizer()

    func speak(_ text: String, language: String, slow: Bool = false) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        synthesizer.stopSpeaking(at: .immediate)
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language)
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * (slow ? 0.6 : 0.9)
        synthesizer.speak(utterance)
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
    }
}

/// A round speaker button, and a slow one beside it, that say the text aloud. `autoplay` says it once when it appears,
/// for exercises that ask what was heard.
struct SpeakButton: View {
    let text: String
    let language: String
    var autoplay = false

    var body: some View {
        HStack(spacing: 14) {
            button(symbol: "speaker.wave.3.fill", label: "Anhören", slow: false, size: 64)
            button(symbol: "tortoise.fill", label: "Langsam anhören", slow: true, size: 44)
        }
        .onAppear {
            if autoplay { Speaker.shared.speak(text, language: language) }
        }
        .onDisappear { Speaker.shared.stop() }
    }

    private func button(symbol: String, label: String, slow: Bool, size: CGFloat) -> some View {
        Button {
            Speaker.shared.speak(text, language: language, slow: slow)
        } label: {
            Image(systemName: symbol)
                .font(.system(size: size * 0.38, weight: .semibold))
                .foregroundStyle(Quill.onAccent)
                .frame(width: size, height: size)
                .background(Quill.accent, in: Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

import AVFoundation
import SwiftUI

/// Plays notes: a soft piano-like tone made of a few harmonics with a quick attack and a slow decay, computed on the
/// device, so no sound files are needed. Notes come one after the other or as a chord.
final class ToneSynth {
    static let shared = ToneSynth()

    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private let sampleRate = 44_100.0
    private let format: AVAudioFormat

    private init() {
        format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)
            ?? AVAudioFormat(commonFormat: .pcmFormatFloat32, sampleRate: sampleRate, channels: 1, interleaved: false)!
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
    }

    func play(_ spec: ToneSpec) {
        guard !spec.midi.isEmpty else { return }
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        if player.isPlaying { player.stop() }
        guard let buffer = makeBuffer(spec) else { return }
        if !engine.isRunning { try? engine.start() }
        player.scheduleBuffer(buffer, at: nil, options: [], completionHandler: nil)
        player.play()
    }

    func stop() {
        if player.isPlaying { player.stop() }
    }

    private static func frequency(of midi: Int) -> Double {
        440 * pow(2, Double(midi - 69) / 12)
    }

    private func makeBuffer(_ spec: ToneSpec) -> AVAudioPCMBuffer? {
        let noteSeconds = spec.together ? 1.8 : 0.75
        let gap = spec.together ? 0.0 : 0.05
        let count = spec.together ? 1 : spec.midi.count
        let total = Double(count) * (noteSeconds + gap) + 0.2
        let frames = AVAudioFrameCount(total * sampleRate)
        guard let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: frames),
              let samples = buffer.floatChannelData?[0] else { return nil }
        buffer.frameLength = frames
        for index in 0..<Int(frames) { samples[index] = 0 }
        let notes = spec.together ? [spec.midi] : spec.midi.map { [$0] }
        let loudness = Float(0.5 / Double(max(1, notes.first?.count ?? 1)))
        for (position, group) in notes.enumerated() {
            let start = Int(Double(position) * (noteSeconds + gap) * sampleRate)
            let length = Int(noteSeconds * sampleRate)
            for midi in group {
                let omega: Double = 2.0 * Double.pi * ToneSynth.frequency(of: midi)
                let decayRate: Double = spec.together ? 1.6 : 3.2
                for step in 0..<length where start + step < Int(frames) {
                    let t = Double(step) / sampleRate
                    let attack = min(1.0, t / 0.01)
                    let decay = exp(-t * decayRate)
                    let release = max(0.0, min(1.0, (noteSeconds - t) / 0.05))
                    let wave1: Double = sin(omega * t)
                    let wave2: Double = 0.4 * sin(2.0 * omega * t)
                    let wave3: Double = 0.18 * sin(3.0 * omega * t)
                    let wave4: Double = 0.08 * sin(4.0 * omega * t)
                    let envelope: Double = attack * decay * release
                    let value: Double = (wave1 + wave2 + wave3 + wave4) * envelope / 1.66
                    samples[start + step] += Float(value) * loudness * 2
                }
            }
        }
        return buffer
    }
}

/// A round button that plays the notes of an ear exercise.
struct TonePlayButton: View {
    let spec: ToneSpec
    var autoplay = false

    var body: some View {
        Button {
            ToneSynth.shared.play(spec)
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "play.fill")
                    .font(.system(size: 18, weight: .bold))
                Text(spec.together ? "Klang anhören" : (spec.midi.count > 1 ? "Töne anhören" : "Ton anhören"))
                    .font(.work(16, .semibold))
            }
            .foregroundStyle(Quill.onAccent)
            .padding(.horizontal, 24)
            .frame(height: 56)
            .background(Quill.accent, in: Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(spec.together ? "Klang anhören" : "Töne anhören")
        .onAppear {
            if autoplay { ToneSynth.shared.play(spec) }
        }
        .onDisappear { ToneSynth.shared.stop() }
    }
}

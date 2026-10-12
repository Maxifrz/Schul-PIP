import SwiftUI

/// What an exercise shows or plays above its question: a speaker button, a staff, notes to hear or a position. The
/// board of a "find the move" exercise is part of its own view, so it is left out here.
struct ExerciseMediaView: View {
    let exercise: LearnExercise

    var body: some View {
        switch exercise.media {
        case let .speech(text, language)?:
            // When the question does not show the words, they are said once on their own.
            SpeakButton(text: text, language: language, autoplay: !exercise.prompt.contains(text))
                .frame(maxWidth: .infinity)
        case let .staff(spec)?:
            StaffView(spec: spec)
                .frame(maxWidth: .infinity)
        case let .tones(spec)?:
            TonePlayButton(spec: spec)
                .frame(maxWidth: .infinity)
        case let .board(spec)? where exercise.kind != .chessMove:
            ChessBoardView(spec: spec)
                .frame(maxWidth: .infinity)
        default:
            EmptyView()
        }
    }
}

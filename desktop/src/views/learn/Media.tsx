import { LearnExercise } from '../../lib/learn/exercise';
import { LessonModel } from '../../lib/learn/lessonModel';
import { Glyph } from '../../ui/glyph';
import { ChessBoard, ChessMoveView } from './ChessBoard';
import { PianoView, StaffView, TonePlayButton } from './Music';

/** Speaks a word or sentence in the language of the course; no voice for it, no button. */
function SpeakButton({ text, language }: { text: string; language: string }) {
  if (typeof speechSynthesis === 'undefined') return null;
  const speak = () => {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(language.slice(0, 2).toLowerCase()));
    if (voice) utterance.voice = voice;
    speechSynthesis.speak(utterance);
  };
  return <button className="btn outline" onClick={speak} aria-label="Anhören"><Glyph name="speaker" size={18} />Anhören</button>;
}

/** Something to look at or listen to above the question. */
export function MediaView({ exercise }: { exercise: LearnExercise }) {
  const media = exercise.media;
  if (!media) return null;
  switch (media.kind) {
    case 'speech': return <div><SpeakButton text={media.text} language={media.language} /></div>;
    case 'board': return exercise.kind === 'chessMove' ? null : <div className="ln-center"><ChessBoard spec={media.board} /></div>;
    case 'staff': return <div className="ln-center"><StaffView spec={media.staff} /></div>;
    case 'tones': return <div className="ln-center"><TonePlayButton spec={media.tones} /></div>;
    default: return null;
  }
}

/** The kinds that need their own pictures (the chess board, the piano). */
export function SpecialExercise({ model, exercise, revealsSolution }: { model: LessonModel; exercise: LearnExercise; revealsSolution: boolean }) {
  if (exercise.kind === 'chessMove' && exercise.media?.kind === 'board') {
    return <ChessMoveView model={model} spec={exercise.media.board} correctMoves={exercise.correctAnswers} revealsSolution={revealsSolution} />;
  }
  if (exercise.kind === 'pianoKey') return <PianoView model={model} correct={exercise.correctAnswers.map(Number)} revealsSolution={revealsSolution} />;
  return <p className="muted">Diese Aufgabe gibt es auf dem PC noch nicht.</p>;
}

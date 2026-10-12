// One round of the Lernpfad, in the whole pane: progress at the top, the exercise in the middle and, after each answer,
// a bar with the verdict. The finished round is recorded once by the store; the end screen shows what it brought.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { LearnProgress, type LessonModel, type LearnExercise, type LessonResult, type LessonRewards, type ExerciseKind } from '../../lib/learn';
import { calendar, closeRun, finishRun, learn, learnUi, now } from '../../store/learn';
import { Caption, ConfirmDialog } from '../../ui/kit';
import { MatchPairs, MultipleChoice, TypeAnswer, WordBank } from './Exercises';
import { LIcon, LIconFilled } from './icons';
import { ChessBoard, ChessMove, PianoKeys, SpeakButton, StaffView, TonePlayButton } from './Media';
import { PipMark } from './PipMark';

const captions: Record<ExerciseKind, string> = {
  multipleChoice: 'Wähle die richtige Antwort',
  matchPairs: 'Finde die Paare',
  wordBank: 'Bilde die Antwort',
  typeAnswer: 'Schreib die Antwort',
  chessMove: 'Finde den Zug',
  pianoKey: 'Tippe die Taste',
};

function Media({ exercise }: { exercise: LearnExercise }) {
  const media = exercise.media;
  if (!media) return null;
  switch (media.type) {
    case 'speech':
      // When the question does not show the words, they are said once on their own.
      return <SpeakButton key={exercise.id} text={media.text} language={media.language} autoplay={!exercise.prompt.includes(media.text)} />;
    case 'staff':
      return <StaffView spec={media.staff} />;
    case 'tones':
      return <TonePlayButton spec={media.tones} />;
    case 'board':
      return exercise.kind === 'chessMove' ? null : <ChessBoard spec={media.board} />;
  }
}

export function LessonPlayer() {
  const active = learnUi.use().active;
  if (!active) return null;
  return <Player key={active.id} />;
}

function Player() {
  const active = learnUi.get().active!;
  const { model } = active;
  const [, force] = useReducer((n: number) => n + 1, 0);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState<{ result: LessonResult; rewards: LessonRewards } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const exercise = model.current;

  const reportIfFinished = useCallback(() => {
    const result = model.takeResult();
    if (result) setDone({ result, rewards: finishRun(result) });
  }, [model]);

  const check = useCallback(() => {
    if (model.check()) force();
  }, [model]);
  const next = useCallback(() => {
    model.advance();
    force();
    reportIfFinished();
  }, [model, reportIfFinished]);

  useEffect(reportIfFinished, [reportIfFinished]);

  // A new exercise: the screen reader starts at its question; typing exercises take the cursor themselves.
  useEffect(() => {
    if (exercise && exercise.kind !== 'typeAnswer') heading.current?.focus({ preventScroll: true });
  }, [exercise?.id, model.session.position]);

  // Keyboard: Enter checks and goes on, the number keys choose.
  useEffect(() => {
    if (done || confirming) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.repeat) return;
      const current = model.current;
      if (!current) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirming(true);
        return;
      }
      if (event.key === 'Enter') {
        if (model.verdict !== null) {
          event.preventDefault();
          next();
        } else if (model.canCheck) {
          event.preventDefault();
          check();
        } else if (!(target?.classList.contains('sq') || target?.tagName === 'BUTTON')) {
          event.preventDefault();
        }
        return;
      }
      if (typing || !model.isAnswering) return;
      if (/^[1-9]$/.test(event.key)) {
        const index = Number(event.key) - 1;
        if (current.kind === 'multipleChoice' && index < current.options.length) {
          model.choice = current.options[index];
          force();
        } else if (current.kind === 'wordBank') {
          const free = current.options.map((_, i) => i).filter((i) => !model.tiles.includes(i));
          if (index < free.length) {
            model.addTile(free[index]);
            force();
          }
        }
      } else if (event.key === 'Backspace' && current.kind === 'wordBank' && model.tiles.length > 0) {
        model.removeTile(model.tiles[model.tiles.length - 1]);
        force();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [model, done, confirming, check, next]);

  const progress = done ? 1 : model.session.progress;
  const percent = Math.round(progress * 100);

  return (
    <div className="lrn-lesson">
      <div className="lrn-lesson-top">
        <button type="button" className="lrn-close" aria-label="Lektion abbrechen" onClick={() => setConfirming(true)}>
          <LIcon name="close" size={20} />
        </button>
        <div className="lrn-bar grow" role="progressbar" aria-label="Fortschritt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <i style={{ width: `${percent}%` }} />
        </div>
      </div>
      {done ? (
        <Complete result={done.result} rewards={done.rewards} />
      ) : exercise ? (
        <>
          <div className="lrn-lesson-body">
            <div className="lrn-exercise">
              <div className="row gap-s">
                <span className="kind">{captions[exercise.kind]}</span>
                {model.session.isRetry && <span className="kind" style={{ color: 'var(--warn)' }}>Nochmal</span>}
              </div>
              {exercise.kind !== 'matchPairs' && (
                <h2 className="lrn-prompt" tabIndex={-1} ref={heading}>{exercise.prompt}</h2>
              )}
              {exercise.kind === 'matchPairs' && <h2 className="visually-hidden" tabIndex={-1} ref={heading}>{captions.matchPairs}</h2>}
              <Media exercise={exercise} />
              <ExerciseArea exercise={exercise} model={model} force={force} />
              {model.hintsShown.length > 0 && (
                <div className="lrn-hints" aria-label={`Hinweis: ${model.hintsShown.join('. ')}`}>
                  {model.hintsShown.map((text, i) => (
                    <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
                      <LIcon name="bulb" size={18} className="lrn-hint-icon" />
                      <span>{text}</span>
                    </div>
                  ))}
                  <div className="small faint">Mit Hinweis zählt die Antwort nur halb für deinen Kompetenzstand.</div>
                </div>
              )}
            </div>
          </div>
          {model.verdict !== null ? (
            <FeedbackBar exercise={exercise} model={model} onNext={next} force={force} />
          ) : exercise.kind !== 'matchPairs' ? (
            <div className="lrn-foot">
              <div className="lrn-foot-inner">
                {model.hasMoreHints && (
                  <button type="button" className="btn outline lrn-big" onClick={() => { model.showHint(); force(); }}
                    title="Zeigt eine Hilfe. Die Antwort zählt dann weniger für deinen Kompetenzstand.">
                    Hinweis {model.hintsShown.length + 1}/{model.hintTotal}
                  </button>
                )}
                <button type="button" className="btn lrn-big grow" disabled={!model.canCheck} onClick={check}>Prüfen</button>
              </div>
            </div>
          ) : (
            <div className="lrn-foot">
              <div className="lrn-foot-inner">
                {model.hasMoreHints && (
                  <button type="button" className="btn outline lrn-big" onClick={() => { model.showHint(); force(); }}>
                    Hinweis {model.hintsShown.length + 1}/{model.hintTotal}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="lrn-lesson-body" />
      )}
      {confirming && (
        <ConfirmDialog
          title="Lektion abbrechen?"
          text="Was du in dieser Lektion beantwortet hast, wird nicht gezählt."
          confirm="Lektion abbrechen"
          onConfirm={closeRun}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function ExerciseArea({ exercise, model, force }: { exercise: LearnExercise; model: LessonModel; force: () => void }) {
  const verdict = model.verdict;
  switch (exercise.kind) {
    case 'multipleChoice':
      return (
        <MultipleChoice
          options={exercise.options} correct={exercise.correctAnswers[0] ?? ''} choice={model.choice} verdict={verdict}
          onPick={(option) => { if (model.isAnswering) { model.choice = option; force(); } }}
        />
      );
    case 'matchPairs':
      return <MatchPairs exercise={exercise} model={model} onChange={() => { force(); }} />;
    case 'wordBank':
      return (
        <WordBank
          options={exercise.options} chosen={model.tiles} verdict={verdict}
          onAdd={(i) => { model.addTile(i); force(); }} onRemove={(i) => { model.removeTile(i); force(); }}
        />
      );
    case 'typeAnswer':
      return <TypeAnswer value={model.typed} verdict={verdict} mode={exercise.mode} onChange={(text) => { model.typed = text; force(); }} />;
    case 'chessMove':
      return exercise.media?.type === 'board' ? (
        <ChessMove
          spec={exercise.media.board} from={model.moveFrom} to={model.moveTo} correctMoves={exercise.correctAnswers} verdict={verdict}
          onTap={(square) => { model.tapSquare(square); force(); }}
        />
      ) : null;
    case 'pianoKey':
      return (
        <PianoKeys
          correct={exercise.correctAnswers.map(Number).filter((n) => Number.isFinite(n))} choice={model.choice} verdict={verdict}
          onPick={(midi) => { if (model.isAnswering) { model.choice = midi; force(); } }}
        />
      );
  }
}

/** The verdict after an answer: green or red, the right answer after a wrong one and "Weiter". */
function FeedbackBar({
  exercise, model, onNext, force,
}: {
  exercise: LearnExercise;
  model: LessonModel;
  onNext: () => void;
  force: () => void;
}) {
  const verdict = model.verdict!;
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => next.current?.focus({ preventScroll: true }), []);
  const wrong = verdict === 'wrong';
  return (
    <div className={`lrn-feedback ${verdict}`} role="status" aria-live="assertive">
      <div className="lrn-feedback-inner">
        <div className="lrn-verdict">
          <LIcon name={wrong ? 'close' : 'checkCircle'} size={26} stroke={2} />
          <span>{wrong ? 'Falsch' : 'Richtig'}</span>
        </div>
        {wrong && (
          <div>
            <div className="kind lrn-tone">Richtige Antwort</div>
            <div className="lrn-solution">{exercise.solution}</div>
          </div>
        )}
        {model.coachNote !== '' && <div className="lrn-note">{model.coachNote}</div>}
        {exercise.explanation !== '' && <div className="muted">{exercise.explanation}</div>}
        {wrong && !model.session.isRetry && <div className="muted small">Diese Aufgabe kommt am Ende noch einmal.</div>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 16 }}>
          {wrong && exercise.kind === 'typeAnswer' && (
            <button type="button" className="link muted" onClick={() => { model.overrule(); force(); }}>War doch richtig</button>
          )}
          <span className="grow" />
          <button type="button" className="btn lrn-big" ref={next} onClick={onNext}>Weiter</button>
        </div>
      </div>
    </div>
  );
}

/** The end of a round: Pip, the XP it brought, how much was right on the first try, the streak and the daily goal. */
function Complete({ result, rewards }: { result: LessonResult; rewards: LessonRewards }) {
  const { progress } = learn();
  const state = progress.progress;
  const cal = calendar();
  const t = now();
  const xp = LearnProgress.xp(result);
  const streak = state.currentStreak(t, cal);
  const xpToday = state.xpToday(t, cal);
  const goal = state.dailyGoal;
  const percent = Math.round(result.accuracy * 100);
  const headline = percent === 100 ? 'Fehlerfrei!' : percent >= 80 ? 'Stark gemacht!' : 'Lektion geschafft';
  const reached = xpToday >= goal;
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.repeat) {
        event.preventDefault();
        closeRun();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const hasExtras = rewards.gems > 0 || rewards.quests.length > 0 || rewards.freezesUsed > 0 || rewards.notes.length > 0;
  return (
    <>
      <div className="lrn-lesson-body">
        <div className="lrn-complete">
          <PipMark pixel={9} />
          <div className="col" style={{ alignItems: 'center', gap: 6 }}>
            <Caption>Lernpfad</Caption>
            <h2 className="lrn-headline" tabIndex={-1}>{headline}</h2>
          </div>
          <div className="lrn-stats3">
            <div className="lrn-stat"><b>+{xp}</b><span>XP</span></div>
            <div className="lrn-stat"><b>{percent} %</b><span>Beim ersten Mal</span></div>
            <div className="lrn-stat"><b>{streak}</b><span>{streak === 1 ? 'Tag in Folge' : 'Tage in Folge'}</span></div>
          </div>
          <div className="card lrn-goalcard">
            <div className="row">
              <strong className="grow" style={{ color: reached ? 'var(--link)' : undefined }}>{reached ? 'Tagesziel erreicht' : 'Tagesziel'}</strong>
              <span className="mono small muted">{Math.min(xpToday, 9999)} / {goal} XP</span>
            </div>
            <div className="lrn-bar"><i style={{ width: `${Math.min(100, (xpToday / Math.max(1, goal)) * 100)}%` }} /></div>
          </div>
          {hasExtras && (
            <div className="card lrn-extras">
              {rewards.gems > 0 && <div className="row"><LIconFilled name="diamond" size={18} className="lrn-ico-link" /><span>+{rewards.gems} Gems</span></div>}
              {rewards.quests.map((title) => (
                <div key={title} className="row"><LIcon name="seal" size={18} className="lrn-ico-accent" /><span>Quest geschafft: {title}</span></div>
              ))}
              {rewards.notes.map((note) => (
                <div key={note} className="row" style={{ alignItems: 'flex-start' }}><LIcon name="info" size={18} className="lrn-ico-muted" /><span>{note}</span></div>
              ))}
              {rewards.freezesUsed > 0 && (
                <div className="row">
                  <LIcon name="snowflake" size={18} className="lrn-ico-warn" />
                  <span>{rewards.freezesUsed === 1 ? 'Ein Streak-Schutz hat deine Serie gerettet' : `${rewards.freezesUsed} Streak-Schütze haben deine Serie gerettet`}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="lrn-foot">
        <div className="lrn-foot-inner">
          <button type="button" className="btn lrn-big grow" ref={button} onClick={closeRun}>Weiter</button>
        </div>
      </div>
    </>
  );
}

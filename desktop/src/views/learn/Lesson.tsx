import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CardSnapshot } from '../../lib/learn/cards';
import type { CourseNode, CourseUnit, NodeKind } from '../../lib/learn/course';
import { AnswerMode, LearnAnswer, LearnExercise, LearnVerdict } from '../../lib/learn/exercise';
import { Coach, LessonModel, LessonRewards, noRewards } from '../../lib/learn/lessonModel';
import { xpFor } from '../../lib/learn/progress';
import { LessonResult, accuracyOf } from '../../lib/learn/session';
import { localCalendar } from '../../lib/learn/calendar';
import { Glyph } from '../../ui/glyph';
import { ConfirmDialog } from '../../ui/kit';
import { PipLogo } from '../../ui/pip';
import { Bar } from './Quests';
import { MediaView, SpecialExercise } from './Media';
import { newSessionID, randomSeed } from './shared';
import { learn } from '../../store/learn';

/** A round as it was when the student started it. */
export interface LessonRun {
  id: string;
  courseID: string;
  kind: NodeKind;
  /** The step the round belongs to; null for a round on chosen goals. */
  node: CourseNode | null;
  /** Whether finishing it marks the step as done. */
  completes: boolean;
  /** The unit whose test this is, for skipping it. */
  testOut?: CourseUnit;
  content:
    | { type: 'course'; lessonID: string; exercises: LearnExercise[]; coach: Coach | null }
    | { type: 'cards'; cards: CardSnapshot[]; dueKeys: Set<string>; deck: CardSnapshot[]; distractors: Record<string, string[]> };
}

const useModel = (model: LessonModel) => useSyncExternalStore(model.subscribe, model.snapshot);

const caption = (kind: LearnExercise['kind']) =>
  ({ multipleChoice: 'Wähle die richtige Antwort', matchPairs: 'Finde die Paare', wordBank: 'Bilde die Antwort', typeAnswer: 'Schreib die Antwort', chessMove: 'Finde den Zug', pianoKey: 'Tippe die Taste' })[kind];

export function LessonScreen({ run, onFinish, onClose }: { run: LessonRun; onFinish: (result: LessonResult) => LessonRewards; onClose: () => void }) {
  const model = useMemo(
    () =>
      run.content.type === 'cards'
        ? LessonModel.ofCards(run.content.cards, run.content.deck, run.content.distractors, randomSeed(), newSessionID())
        : new LessonModel(run.content.lessonID, [], run.content.exercises, newSessionID(), run.content.coach),
    [run.id],
  );
  useModel(model);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [rewards, setRewards] = useState<LessonRewards>(noRewards());
  const [confirming, setConfirming] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const report = () => {
    if (result) return;
    const finished = model.takeResult();
    if (!finished) return;
    setRewards(onFinish(finished));
    setResult(finished);
  };
  useEffect(report, []);

  const check = () => {
    model.check();
  };
  const next = () => {
    model.advance();
    report();
  };

  const exercise = model.current;
  const verdict = model.verdict;

  // Enter does what the main button says, 1 to 4 pick an option, Escape asks whether to leave.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (result || confirming) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        setConfirming(true);
        return;
      }
      const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (event.key === 'Enter' && !typing) {
        event.preventDefault();
        if (verdict === null) check();
        else if (verdict === 'wrong' && !model.solutionShown) model.tryAgain();
        else next();
      } else if (!typing && exercise?.kind === 'multipleChoice' && model.isAnswering && /^[1-9]$/.test(event.key)) {
        const option = exercise.options[Number(event.key) - 1];
        if (option !== undefined) model.pick(option);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (exercise?.kind === 'typeAnswer' && model.isAnswering) input.current?.focus();
  }, [model.session.position, verdict]);

  if (result) {
    return (
      <div className="ln-lesson">
        <Complete result={result} rewards={rewards} onDone={onClose} />
      </div>
    );
  }

  const revealsSolution = verdict !== 'wrong' || model.solutionShown;
  return (
    <div className="ln-lesson" role="dialog" aria-label="Lektion">
      <div className="ln-top">
        <button className="ln-x" onClick={() => setConfirming(true)} aria-label="Lektion abbrechen"><Glyph name="x" size={18} /></button>
        <div className="grow"><Bar fraction={model.session.progress} /></div>
      </div>
      {exercise ? (
        <>
          <div className="ln-scroll">
            <div className="ln-exercise" key={model.session.position}>
              <div className="row" style={{ gap: 10 }}>
                <span className="ln-caption" style={{ color: 'var(--accent)' }}>{caption(exercise.kind)}</span>
                {model.session.isRetry && <span className="ln-caption">Nochmal</span>}
              </div>
              {exercise.kind !== 'matchPairs' && <h2 className="ln-prompt">{exercise.prompt}</h2>}
              <MediaView exercise={exercise} />
              <ExerciseBody model={model} exercise={exercise} revealsSolution={revealsSolution} inputRef={input} onCheck={check} />
              {model.isAnswering && model.coachNote !== '' && <div className="ln-note"><Glyph name="undo" size={15} /><span>{model.coachNote}</span></div>}
              {model.hintsShown.length > 0 && (
                <div className="ln-note hint">
                  <div className="col" style={{ gap: 8 }}>{model.hintsShown.map((h, i) => <div key={i} className="row" style={{ alignItems: 'flex-start' }}><span style={{ color: 'var(--accent)' }}><Glyph name="bulb" size={15} fill /></span><span>{h}</span></div>)}</div>
                </div>
              )}
            </div>
          </div>
          {verdict ? (
            <FeedbackBar
              verdict={verdict}
              solution={verdict === 'wrong' && model.solutionShown ? exercise.solution : null}
              note={verdict === 'wrong' ? model.retryNote : ''}
              explanation={verdict === 'wrong' && !model.solutionShown ? '' : exercise.explanation}
              comesBack={verdict === 'wrong' && model.solutionShown && !model.session.isRetry}
              canOverrule={verdict === 'wrong' && exercise.kind === 'typeAnswer'}
              canRetry={verdict === 'wrong' && !model.solutionShown}
              onOverrule={() => model.overrule()}
              onRetry={() => model.tryAgain()}
              onShowSolution={() => model.showSolution()}
              onNext={next}
            />
          ) : exercise.kind !== 'matchPairs' ? (
            <div className="ln-bottom">
              {model.hasMoreHints && <button className="btn outline" onClick={() => model.showHint()}>Hinweis {model.hintsShown.length + 1}/{model.hintTotal}</button>}
              <button className="btn" disabled={!model.canCheck} onClick={check}>Prüfen</button>
            </div>
          ) : <div style={{ height: 24 }} />}
        </>
      ) : <div className="grow" />}
      {confirming && (
        <ConfirmDialog title="Lektion abbrechen?" text="Was du in dieser Lektion beantwortet hast, wird nicht gezählt." confirm="Lektion abbrechen" onConfirm={onClose} onClose={() => setConfirming(false)} />
      )}
    </div>
  );
}

function ExerciseBody({ model, exercise, revealsSolution, inputRef, onCheck }: { model: LessonModel; exercise: LearnExercise; revealsSolution: boolean; inputRef: React.RefObject<HTMLInputElement>; onCheck: () => void }) {
  const verdict = model.verdict;
  switch (exercise.kind) {
    case 'multipleChoice':
      return <Choice options={exercise.options} correct={revealsSolution ? (exercise.correctAnswers[0] ?? '') : ''} choice={model.choice} verdict={verdict} onPick={(o) => model.pick(o)} />;
    case 'matchPairs':
      return <Pairs model={model} exercise={exercise} />;
    case 'wordBank':
      return <Bank options={exercise.options} chosen={model.tiles} verdict={verdict} onAdd={(i) => model.addTile(i)} onRemove={(i) => model.removeTile(i)} />;
    case 'typeAnswer':
      return <TypeAnswer model={model} mode={exercise.mode} inputRef={inputRef} onSubmit={onCheck} />;
    default:
      return <SpecialExercise model={model} exercise={exercise} revealsSolution={revealsSolution} />;
  }
}

function Choice({ options, correct, choice, verdict, onPick }: { options: string[]; correct: string; choice: string | null; verdict: LearnVerdict | null; onPick: (o: string) => void }) {
  return (
    <div className="col" style={{ gap: 10 }}>
      {options.map((option, index) => {
        let state = choice === option ? 'picked' : '';
        let mark: string | null = null;
        if (verdict !== null) {
          if (option === correct) { state = 'right'; mark = 'check'; }
          else if (option === choice) { state = 'wrong'; mark = 'x'; }
          else state = '';
        }
        return (
          <button key={index} className={`ln-option ${state}`} onClick={() => verdict === null && onPick(option)} aria-label={`${index + 1}: ${option}`}>
            <span className="mono ln-key">{index + 1}</span>
            <span className="grow" style={{ textAlign: 'left' }}>{option}</span>
            {mark && <Glyph name={mark} size={16} stroke={2.4} />}
          </button>
        );
      })}
    </div>
  );
}

function Pairs({ model, exercise }: { model: LessonModel; exercise: LearnExercise }) {
  const locked = !model.isAnswering;
  const frontState = (key: string) => (model.matched.has(key) ? 'matched' : model.lastMiss?.key === key ? 'missed' : model.pickedFront === key ? 'picked' : '');
  const backState = (i: number) => (model.matchedBacks.has(i) ? 'matched' : model.lastMiss?.back === i ? 'missed' : model.pickedBack === i ? 'picked' : '');
  return (
    <div className="ln-pairs">
      <div className="col" style={{ gap: 10 }}>
        {exercise.pairs.map((pair) => <button key={pair.key} className={`ln-tile ${frontState(pair.key)}`} disabled={locked || model.matched.has(pair.key)} onClick={() => model.pickFront(pair.key)}>{pair.front}</button>)}
      </div>
      <div className="col" style={{ gap: 10 }}>
        {exercise.options.map((back, i) => <button key={i} className={`ln-tile ${backState(i)}`} disabled={locked || model.matchedBacks.has(i)} onClick={() => model.pickBack(i)}>{back}</button>)}
      </div>
    </div>
  );
}

function Bank({ options, chosen, verdict, onAdd, onRemove }: { options: string[]; chosen: number[]; verdict: LearnVerdict | null; onAdd: (i: number) => void; onRemove: (i: number) => void }) {
  return (
    <div className="col" style={{ gap: 26 }}>
      <div className={`ln-answer-line ${verdict ?? ''}`}>
        {chosen.map((i) => <button key={i} className="ln-word" onClick={() => verdict === null && onRemove(i)}>{options[i] ?? ''}</button>)}
      </div>
      <div className="ln-words">
        {options.map((word, i) => chosen.includes(i) ? <span key={i} className="ln-word ghost">{word}</span> : <button key={i} className="ln-word" onClick={() => verdict === null && onAdd(i)}>{word}</button>)}
      </div>
    </div>
  );
}

function TypeAnswer({ model, mode, inputRef, onSubmit }: { model: LessonModel; mode: AnswerMode; inputRef: React.RefObject<HTMLInputElement>; onSubmit: () => void }) {
  return (
    <input
      ref={inputRef}
      className={`ln-input ${model.verdict ?? ''}`}
      placeholder="Deine Antwort"
      value={model.typed}
      disabled={model.verdict !== null}
      inputMode={mode === 'number' ? 'decimal' : 'text'}
      autoCapitalize={mode === 'text' ? 'sentences' : 'off'}
      spellCheck={mode === 'text'}
      onChange={(e) => model.setTyped(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit(); } }}
    />
  );
}

function FeedbackBar({ verdict, solution, note, explanation, comesBack, canOverrule, canRetry, onOverrule, onRetry, onShowSolution, onNext }: {
  verdict: LearnVerdict; solution: string | null; note: string; explanation: string; comesBack: boolean; canOverrule: boolean; canRetry: boolean;
  onOverrule: () => void; onRetry: () => void; onShowSolution: () => void; onNext: () => void;
}) {
  return (
    <div className={`ln-feedback ${verdict}`}>
      <div className="ln-feedback-inner">
        <div className="row ln-verdict" style={{ gap: 10 }}><Glyph name={verdict === 'right' ? 'checkCircle' : 'xCircle'} size={26} />{verdict === 'right' ? 'Richtig' : 'Falsch'}</div>
        {solution && <div className="col" style={{ gap: 6 }}><div className="ln-caption" style={{ color: 'inherit' }}>Richtige Antwort</div><div className="ln-solution">{solution}</div></div>}
        {note !== '' && <div className="ln-feedback-note">{note}</div>}
        {explanation !== '' && <div className="small muted">{explanation}</div>}
        {comesBack && <div className="small muted">Diese Aufgabe kommt am Ende noch einmal.</div>}
        <div className="row" style={{ gap: 16 }}>
          {canOverrule && <button className="link muted" onClick={onOverrule}>War doch richtig</button>}
          <span className="grow" />
          {canRetry ? (
            <>
              <button className="btn outline" onClick={onShowSolution}>Lösung zeigen</button>
              <button className="btn" autoFocus onClick={onRetry}>Nochmal versuchen</button>
            </>
          ) : <button className="btn" autoFocus onClick={onNext}>Weiter</button>}
        </div>
      </div>
    </div>
  );
}

function Complete({ result, rewards, onDone }: { result: LessonResult; rewards: LessonRewards; onDone: () => void }) {
  const { progress } = learn.use();
  const now = Date.now();
  const percent = Math.round(accuracyOf(result) * 100);
  const streak = progress.currentStreak(now, localCalendar);
  const xpToday = progress.xpTodayAt(now, localCalendar);
  const goal = progress.dailyGoal;
  const reached = xpToday >= goal;
  const headline = percent === 100 ? 'Fehlerfrei!' : percent >= 80 ? 'Stark gemacht!' : 'Lektion geschafft';
  const extras = rewards.gems > 0 || rewards.quests.length > 0 || rewards.freezesUsed > 0 || rewards.notes.length > 0;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === 'Escape') onDone();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const stat = (value: string, label: string) => <div className="ln-card ln-stat"><div className="ln-stat-value">{value}</div><div className="small muted">{label}</div></div>;
  return (
    <div className="ln-complete">
      <div className="ln-scroll">
        <div className="ln-complete-inner">
          <div style={{ marginTop: 40 }}><PipLogo pixel={9} /></div>
          <div className="col" style={{ gap: 10, alignItems: 'center' }}>
            <div className="ln-caption" style={{ color: 'var(--accent)' }}>Lernpfad</div>
            <h1 className="ln-headline">{headline}</h1>
          </div>
          <div className="row" style={{ gap: 10, width: '100%' }}>
            {stat(`+${xpFor(result)}`, 'XP')}
            {stat(`${percent} %`, 'Beim ersten Mal')}
            {stat(`${streak}`, streak === 1 ? 'Tag in Folge' : 'Tage in Folge')}
          </div>
          <div className="ln-card col" style={{ gap: 10, width: '100%' }}>
            <div className="row"><span className="ln-strong grow" style={{ color: reached ? 'var(--link)' : undefined }}>{reached ? 'Tagesziel erreicht' : 'Tagesziel'}</span><span className="mono small muted">{Math.min(xpToday, 9999)} / {goal} XP</span></div>
            <Bar fraction={xpToday / Math.max(1, goal)} />
          </div>
          {extras && (
            <div className="ln-card col" style={{ gap: 10, width: '100%' }}>
              {rewards.gems > 0 && <div className="row"><span style={{ color: 'var(--accent)' }}><Glyph name="diamond" size={16} fill /></span>+{rewards.gems} Gems</div>}
              {rewards.quests.map((t) => <div key={t} className="row"><span style={{ color: 'var(--accent)' }}><Glyph name="seal" size={16} /></span>Quest geschafft: {t}</div>)}
              {rewards.notes.map((t) => <div key={t} className="row" style={{ alignItems: 'flex-start' }}><span className="muted"><Glyph name="info" size={16} /></span>{t}</div>)}
              {rewards.freezesUsed > 0 && <div className="row"><span style={{ color: 'var(--accent)' }}><Glyph name="snowflake" size={16} /></span>{rewards.freezesUsed === 1 ? 'Ein Streak-Schutz hat deine Serie gerettet' : `${rewards.freezesUsed} Streak-Schütze haben deine Serie gerettet`}</div>}
            </div>
          )}
        </div>
      </div>
      <div className="ln-bottom"><button className="btn" autoFocus onClick={onDone}>Weiter</button></div>
    </div>
  );
}

export type { LearnAnswer };

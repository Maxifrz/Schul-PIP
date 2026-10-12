// The answer areas of the exercise kinds: choosing, pairing, putting words together and typing.

import { useEffect, useRef } from 'react';
import type { AnswerMode, LearnExercise, LearnVerdict } from '../../lib/learn';
import type { LessonModel } from '../../lib/learn';
import { LIcon } from './icons';

export function MultipleChoice({
  options, correct, choice, verdict, onPick,
}: {
  options: string[];
  correct: string;
  choice: string | null;
  verdict: LearnVerdict | null;
  onPick: (option: string) => void;
}) {
  const state = (option: string): string => {
    if (verdict === null) return choice === option ? 'picked' : '';
    if (option === correct) return 'right';
    if (option === choice) return 'wrong';
    return '';
  };
  return (
    <div className="lrn-options" role="group" aria-label="Antworten">
      {options.map((option, index) => (
        <button
          key={index} type="button" className={`lrn-option ${state(option)}`} aria-pressed={choice === option}
          aria-label={`Antwort ${index + 1} von ${options.length}: ${option}`} disabled={verdict !== null}
          onClick={() => onPick(option)}
        >
          <span className="num">{index + 1}</span>
          <span className="grow">{option}</span>
          {verdict !== null && option === correct && <LIcon name="check" size={18} />}
          {verdict !== null && option !== correct && option === choice && <LIcon name="close" size={18} />}
        </button>
      ))}
    </div>
  );
}

export function MatchPairs({ exercise, model, onChange }: { exercise: LearnExercise; model: LessonModel; onChange: (outcome: ReturnType<LessonModel['pickFront']>) => void }) {
  const front = (key: string): string => {
    if (model.matched.has(key)) return 'matched';
    if (model.lastMiss?.key === key) return 'missed';
    return model.pickedFront === key ? 'picked' : '';
  };
  const back = (index: number): string => {
    if (model.matchedBacks.has(index)) return 'matched';
    if (model.lastMiss?.back === index) return 'missed';
    return model.pickedBack === index ? 'picked' : '';
  };
  const locked = !model.isAnswering;
  return (
    <div className="lrn-pairs">
      <div className="col" role="group" aria-label="Fragen">
        {exercise.pairs.map((pair) => (
          <button
            key={pair.key} type="button" className={`lrn-tile ${front(pair.key)}`} aria-label={`Frage: ${pair.front}`}
            aria-pressed={model.pickedFront === pair.key} disabled={locked || model.matched.has(pair.key)}
            onClick={() => onChange(model.pickFront(pair.key))}
          >
            {pair.front}
          </button>
        ))}
      </div>
      <div className="col" role="group" aria-label="Antworten">
        {exercise.options.map((text, index) => (
          <button
            key={index} type="button" className={`lrn-tile ${back(index)}`} aria-label={`Antwort: ${text}`}
            aria-pressed={model.pickedBack === index} disabled={locked || model.matchedBacks.has(index)}
            onClick={() => onChange(model.pickBack(index))}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function WordBank({
  options, chosen, verdict, onAdd, onRemove,
}: {
  options: string[];
  chosen: number[];
  verdict: LearnVerdict | null;
  onAdd: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="lrn-bank">
      <div className={`lrn-line ${verdict ?? ''}`} role="group" aria-label={chosen.length === 0 ? 'Deine Antwort, noch leer' : 'Deine Antwort'}>
        {chosen.map((index) => (
          <button
            key={index} type="button" className="lrn-word" disabled={verdict !== null}
            aria-label={`In deiner Antwort: ${options[index] ?? ''}. Nimmt das Wort wieder heraus`} onClick={() => onRemove(index)}
          >
            {options[index] ?? ''}
          </button>
        ))}
      </div>
      <div className="lrn-words" role="group" aria-label="Wörter">
        {options.map((word, index) =>
          chosen.includes(index) ? (
            <span key={index} className="lrn-word gone" aria-hidden="true">{word}</span>
          ) : (
            <button
              key={index} type="button" className="lrn-word" disabled={verdict !== null}
              aria-label={`Wort: ${word}. Fügt das Wort deiner Antwort hinzu`} onClick={() => onAdd(index)}
            >
              {word}
            </button>
          ),
        )}
      </div>
    </div>
  );
}

export function TypeAnswer({
  value, verdict, mode, onChange,
}: {
  value: string;
  verdict: LearnVerdict | null;
  mode: AnswerMode;
  onChange: (text: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (verdict === null) input.current?.focus();
  }, [verdict]);
  return (
    <input
      ref={input}
      className={`field lrn-type ${verdict ?? ''}`}
      aria-label="Deine Antwort"
      placeholder="Deine Antwort"
      value={value}
      disabled={verdict !== null}
      autoComplete="off"
      autoCapitalize={mode === 'text' ? 'sentences' : 'off'}
      spellCheck={mode === 'text'}
      inputMode={mode === 'number' ? 'decimal' : 'text'}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

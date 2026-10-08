import { useMemo, useReducer, useRef, useState } from 'react';
import { ReviewFlow, dueCards, newCard } from '../lib/review';
import { addCards, cardStore, removeCard, updateCard } from '../store/app';
import { PageHeader, Caption } from '../ui/kit';

/** Flashcards by typing: the student answers, the app says "Richtig" or "Falsch" (compared on the device, no AI). */
export function Review() {
  const { list, repeatWrong } = cardStore.use();
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const flow = useMemo(() => new ReviewFlow(() => cardStore.get().list, updateCard), []);
  const input = useRef<HTMLInputElement>(null);
  const [adding, setAdding] = useState(false);
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const due = dueCards(list).length;
  const card = flow.current;

  const act = (action: () => void) => {
    action();
    redraw();
    setTimeout(() => input.current?.focus(), 0);
  };

  const check = () => {
    flow.answer = input.current?.value ?? flow.answer;
    act(() => flow.check());
  };

  return (
    <div className="page">
      <PageHeader caption="Karteikarten" title="Wiederholen">
        <div className="col" style={{ alignItems: 'flex-end', gap: 6 }}>
          <span className="muted small">{due === 1 ? '1 fällig' : `${due} fällig`}</span>
          <label className="row small muted" style={{ gap: 8 }}>
            <input type="checkbox" checked={repeatWrong} onChange={(e) => cardStore.set({ repeatWrong: e.target.checked })} />
            Bei falsch gleich nochmal
          </label>
        </div>
      </PageHeader>

      {card ? (
        <div className="review" key={card.id + flow.reviewedThisSession}>
          <Caption>{flow.reviewedThisSession > 0 ? `${flow.reviewedThisSession} geschafft` : ' '}</Caption>
          <div className="front">{card.front}</div>
          {flow.verdict === null ? (
            <>
              <input
                ref={input}
                autoFocus
                className="field"
                style={{ textAlign: 'center', fontSize: 18, height: 54 }}
                placeholder="Deine Antwort"
                defaultValue=""
                onKeyDown={(e) => e.key === 'Enter' && check()}
              />
              <button className="btn" style={{ height: 50, padding: '0 36px' }} onClick={check}>Prüfen</button>
            </>
          ) : (
            <>
              <div className="verdict" style={{ color: flow.isCorrect ? 'var(--link)' : 'var(--danger)' }}>{flow.isCorrect ? 'Richtig' : 'Falsch'}</div>
              {flow.solutionShown && (
                <div className="col" style={{ width: '100%' }}>
                  <hr className="line" />
                  <div style={{ fontSize: 18, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{card.back}</div>
                </div>
              )}
              <div className="row">
                {!flow.isCorrect && repeatWrong ? (
                  <>
                    <button className="btn" autoFocus onClick={() => act(() => flow.retry())}>Nochmal versuchen</button>
                    <button className="btn outline" onClick={() => act(() => flow.next())}>Weiter</button>
                  </>
                ) : (
                  <button className="btn" autoFocus onClick={() => act(() => flow.next())}>Weiter</button>
                )}
              </div>
              {!flow.isCorrect && (
                <div className="row muted small" style={{ gap: 22 }}>
                  {!flow.solutionShown && <button className="link muted" onClick={() => act(() => flow.showSolution())}>Lösung ansehen</button>}
                  <button className="link muted" onClick={() => act(() => flow.overrule())}>War doch richtig</button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="review">
          <h2 style={{ margin: 0, fontSize: 30, letterSpacing: '-0.02em' }}>Alles wiederholt</h2>
          <p className="muted" style={{ margin: 0 }}>
            {flow.reviewedThisSession > 0
              ? `Stark – ${flow.reviewedThisSession} Karten in dieser Runde richtig.`
              : list.length === 0
                ? 'Leg unten eine Karte an oder erzeuge Karten aus einem Tafelbild im Kurse-Tab.'
                : 'Die nächste Karte ist noch nicht fällig.'}
          </p>
        </div>
      )}

      <h2 className="section" style={{ marginTop: 56 }}>Alle Karten ({list.length})</h2>
      <div className="row" style={{ marginBottom: 14 }}>
        <button className="btn outline small" onClick={() => setAdding(!adding)}>{adding ? 'Schließen' : 'Neue Karte'}</button>
      </div>
      {adding && (
        <div className="card col" style={{ marginBottom: 14 }}>
          <input className="field" placeholder="Frage" value={front} onChange={(e) => setFront(e.target.value)} />
          <textarea className="field" placeholder="Antwort" value={back} onChange={(e) => setBack(e.target.value)} />
          <div className="row">
            <button
              className="btn"
              disabled={front.trim() === '' || back.trim() === ''}
              onClick={() => {
                addCards([newCard(front, back)]);
                setFront('');
                setBack('');
              }}
            >
              Karte speichern
            </button>
          </div>
        </div>
      )}
      <div className="col gap-s">
        {list.map((c) => (
          <div key={c.id} className="card row" style={{ padding: '12px 16px' }}>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{c.front}</div>
              <div className="muted small">{c.back}</div>
            </div>
            <span className="faint mono small">{c.dueAt <= Date.now() ? 'fällig' : new Date(c.dueAt).toLocaleDateString('de-DE')}</span>
            <button className="link muted" onClick={() => removeCard(c.id)} aria-label="Karte löschen">Löschen</button>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Quest, QuestBoard, bonusGems, questDone, questFraction, questTitle, secondsUntilNextDay } from '../../lib/learn/quests';
import { freezePrice, maxFreezes } from '../../lib/learn/progress';
import { localCalendar } from '../../lib/learn/calendar';
import { Glyph } from '../../ui/glyph';
import { buyFreeze, claimQuest } from '../../store/learn';

export const Bar = ({ fraction }: { fraction: number }) => (
  <div className="bar">
    <i className="on" style={{ width: `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%` }} />
  </div>
);

const questGlyph = (kind: Quest['kind']) =>
  ({ xp: 'bolt', lessons: 'book', perfect: 'target', firstTry: 'checkCircle', courses: 'stack', practice: 'dumbbell', days: 'calendar' })[kind];

export function QuestCard({ quest }: { quest: Quest }) {
  const done = questDone(quest);
  return (
    <div className={`ln-card ln-quest ${done && !quest.claimed ? 'ready' : ''}`}>
      <div className="ln-icon" style={{ color: done ? 'var(--link)' : 'var(--accent)' }}><Glyph name={questGlyph(quest.kind)} size={20} /></div>
      <div className="grow col" style={{ gap: 8 }}>
        <div className="ln-strong">{questTitle(quest)}</div>
        <div className="row" style={{ gap: 10 }}>
          <div className="grow"><Bar fraction={questFraction(quest)} /></div>
          <span className="mono small muted">{Math.min(quest.progress, quest.target)}/{quest.target}</span>
        </div>
        <div className="row small muted" style={{ gap: 4 }}><span style={{ color: 'var(--accent)' }}><Glyph name="diamond" size={12} /></span>{quest.reward} Gems</div>
      </div>
      {quest.claimed ? (
        <span style={{ color: 'var(--link)' }}><Glyph name="checkCircle" size={24} /></span>
      ) : done ? (
        <button className="btn accent small" onClick={() => claimQuest(quest.id)}>Abholen</button>
      ) : null}
    </div>
  );
}

export function FreezeRow({ gems, freezes }: { gems: number; freezes: number }) {
  const canBuy = gems >= freezePrice && freezes < maxFreezes;
  return (
    <div className="ln-card ln-quest">
      <div className="ln-icon" style={{ color: 'var(--accent)' }}><Glyph name="snowflake" size={22} /></div>
      <div className="grow col" style={{ gap: 4 }}>
        <div className="ln-strong">Streak-Schutz</div>
        <div className="small muted">Rettet deine Serie, wenn du einen Tag auslässt. Du hast {freezes} von {maxFreezes}.</div>
      </div>
      <button className="btn accent" disabled={!canBuy} onClick={() => buyFreeze()} style={{ flexDirection: 'column', gap: 0, height: 48 }}>
        <span>Kaufen</span>
        <span className="row" style={{ gap: 3, fontSize: 12 }}><Glyph name="diamond" size={11} />{freezePrice}</span>
      </button>
    </div>
  );
}

const timeLeft = (seconds: number) => {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `noch ${Math.floor(minutes / 60)} Std ${minutes % 60} Min` : `noch ${Math.max(1, minutes)} Min`;
};

export function QuestsView({ board, gems, freezes }: { board: QuestBoard; gems: number; freezes: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const header = (title: string, detail: string, first = false) => (
    <div className="row" style={{ marginTop: first ? 0 : 14 }}>
      <h2 className="ln-h2 grow">{title}</h2>
      <span className="mono small muted">{detail}</span>
    </div>
  );
  return (
    <div className="ln-column col" style={{ gap: 14 }}>
      {header('Heute', timeLeft(secondsUntilNextDay(now, localCalendar)), true)}
      {board.daily.map((quest) => <QuestCard key={quest.id} quest={quest} />)}
      {(board.allDailyClaimed || board.bonusAvailable || board.bonusClaimed) && (
        <div className={`ln-card ln-quest ${board.bonusAvailable ? 'ready' : ''}`}>
          <div className="ln-icon" style={{ color: 'var(--warn)' }}><Glyph name="chest" size={22} /></div>
          <div className="grow col" style={{ gap: 3 }}>
            <div className="ln-strong">Alle drei geschafft</div>
            <div className="small muted">{board.bonusClaimed ? 'Bonus abgeholt' : `Dafür gibt es ${bonusGems} Gems extra`}</div>
          </div>
          {board.bonusAvailable ? <button className="btn accent small" onClick={() => claimQuest('bonus')}>Abholen</button> : board.bonusClaimed ? <span style={{ color: 'var(--link)' }}><Glyph name="checkCircle" size={22} /></span> : null}
        </div>
      )}
      {board.weekly && (<>{header('Diese Woche', 'Wochenziel')}<QuestCard quest={board.weekly} /></>)}
      {header('Streak-Schutz', `${freezes} von ${maxFreezes}`)}
      <FreezeRow gems={gems} freezes={freezes} />
    </div>
  );
}

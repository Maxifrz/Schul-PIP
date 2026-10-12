// The quests page, the streak freeze and the skills page.

import { type Quest, QuestBoard, LearnProgress, questFraction, questIsDone, questTitle, skillStatusIsReached, skillStatusTitle, type SkillRow, type SkillStatus } from '../../lib/learn';
import { timeLeftLong } from './geometry';
import { type IconName, LIcon, LIconFilled } from './icons';

const questIcon: Record<Quest['kind'], IconName> = {
  xp: 'bolt', lessons: 'book', perfect: 'target', firstTry: 'checkCircle', courses: 'stack', practice: 'dumbbell', days: 'calendar',
};

export function QuestCard({ quest, onClaim }: { quest: Quest; onClaim: () => void }) {
  const done = questIsDone(quest);
  return (
    <div className={`card lrn-quest ${done && !quest.claimed ? 'ready' : ''}`}>
      <span className={`lrn-qicon ${done ? 'done' : ''}`}><LIcon name={questIcon[quest.kind]} size={20} stroke={2} /></span>
      <div className="grow col" style={{ gap: 8 }}>
        <div style={{ fontWeight: 600 }}>{questTitle(quest)}</div>
        <div className="row">
          <div className="lrn-bar grow" role="progressbar" aria-label={questTitle(quest)} aria-valuemin={0} aria-valuemax={quest.target} aria-valuenow={Math.min(quest.progress, quest.target)}>
            <i style={{ width: `${questFraction(quest) * 100}%` }} />
          </div>
          <span className="mono small muted">{Math.min(quest.progress, quest.target)}/{quest.target}</span>
        </div>
        <div className="row gap-s lrn-gemline"><LIconFilled name="diamond" size={12} /><span className="small" style={{ fontWeight: 500 }}>{quest.reward} Gems</span></div>
      </div>
      {quest.claimed ? (
        <span className="lrn-ico-link" role="img" aria-label="Abgeholt"><LIcon name="checkCircle" size={26} /></span>
      ) : done ? (
        <button type="button" className="btn accent" onClick={onClaim}>Abholen</button>
      ) : null}
    </div>
  );
}

/** The streak freeze: what it does, how many you have and a button to buy one with gems. */
export function FreezeRow({ gems, freezes, onBuy }: { gems: number; freezes: number; onBuy: () => void }) {
  const canBuy = gems >= LearnProgress.freezePrice && freezes < LearnProgress.maxFreezes;
  return (
    <div className="card lrn-quest">
      <span className="lrn-qicon"><LIcon name="snowflake" size={22} stroke={2} /></span>
      <div className="grow">
        <div style={{ fontWeight: 600 }}>Streak-Schutz</div>
        <div className="muted small">Rettet deine Serie, wenn du einen Tag auslässt. Du hast {freezes} von {LearnProgress.maxFreezes}.</div>
      </div>
      <button type="button" className="btn accent lrn-buy" disabled={!canBuy} onClick={onBuy} aria-label={`Streak-Schutz kaufen für ${LearnProgress.freezePrice} Gems`}>
        <span>Kaufen</span>
        <span className="row gap-s small"><LIconFilled name="diamond" size={10} />{LearnProgress.freezePrice}</span>
      </button>
    </div>
  );
}

function Header({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="row" style={{ marginTop: 10 }}>
      <h2 className="lrn-h2 grow">{title}</h2>
      <span className="mono small muted">{detail}</span>
    </div>
  );
}

/** The day's three quests and the week's challenge, with what claiming them pays, and the streak freeze to buy. */
export function QuestsView({
  board, gems, freezes, secondsLeft, onClaim, onBuyFreeze,
}: {
  board: QuestBoard;
  gems: number;
  freezes: number;
  secondsLeft: number;
  onClaim: (id: string) => void;
  onBuyFreeze: () => void;
}) {
  return (
    <div className="lrn-narrow col" style={{ gap: 14 }}>
      <Header title="Heute" detail={timeLeftLong(secondsLeft)} />
      {board.daily.map((q) => <QuestCard key={q.id} quest={q} onClaim={() => onClaim(q.id)} />)}
      {(board.allDailyClaimed || board.bonusAvailable || board.bonusClaimed) && (
        <div className={`card lrn-quest ${board.bonusAvailable ? 'ready' : ''}`}>
          <span className="lrn-qicon lrn-ico-warn"><LIcon name="chest" size={22} stroke={2} /></span>
          <div className="grow">
            <div style={{ fontWeight: 600 }}>Alle drei geschafft</div>
            <div className="muted small">{board.bonusClaimed ? 'Bonus abgeholt' : `Dafür gibt es ${QuestBoard.bonusGems} Gems extra`}</div>
          </div>
          {board.bonusAvailable ? (
            <button type="button" className="btn accent" onClick={() => onClaim('bonus')}>Abholen</button>
          ) : board.bonusClaimed ? (
            <span className="lrn-ico-link" role="img" aria-label="Abgeholt"><LIcon name="checkCircle" size={26} /></span>
          ) : null}
        </div>
      )}
      {board.weekly && (
        <>
          <Header title="Diese Woche" detail="Wochenziel" />
          <QuestCard quest={board.weekly} onClaim={() => onClaim(board.weekly!.id)} />
        </>
      )}
      <Header title="Streak-Schutz" detail={`${freezes} von ${LearnProgress.maxFreezes}`} />
      <FreezeRow gems={gems} freezes={freezes} onBuy={onBuyFreeze} />
    </div>
  );
}

const statusIcon: Record<SkillStatus, IconName> = {
  notStarted: 'circle', started: 'play', worked: 'dots', practicing: 'half', provisional: 'checkCircle', mastered: 'seal', due: 'redo',
};

/** The goals of the course by unit: where each stands, what is missing, and a button to practise it. */
export function SkillsView({ courseTitle, rows, onPractice }: { courseTitle: string; rows: SkillRow[]; onPractice: (row: SkillRow) => void }) {
  const order: string[] = [];
  for (const row of rows) if (!order.includes(row.skill.unitID)) order.push(row.skill.unitID);
  const units = order.map((id) => {
    const group = rows.filter((r) => r.skill.unitID === id);
    return { id, title: group[0].skill.unitTitle, number: group[0].skill.unitNumber, rows: group };
  });
  const reached = rows.filter((r) => skillStatusIsReached(r.status)).length;
  return (
    <div className="lrn-narrow col" style={{ gap: 22 }}>
      <div>
        <h2 className="lrn-h2" style={{ margin: 0 }}>Fähigkeiten</h2>
        <div className="muted">{courseTitle} · {reached} von {rows.length} erreicht</div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        Eine Lektion zu bearbeiten reicht nicht: Ein Ziel gilt erst als erreicht, wenn du es ohne Hilfe richtig gemacht hast, auf jeder Stufe, die es
        verlangt. Beherrscht ist es nach einer guten Runde an einem anderen Tag.
      </p>
      {units.map((unit) => (
        <section key={unit.id} className="col">
          <h3 className="lrn-h3">Einheit {unit.number} · {unit.title}</h3>
          {unit.rows.map((row) => (
            <div key={row.skill.id} className={`card lrn-skill ${row.status}`} data-skill={row.skill.id}>
              <div className="row">
                <strong className="grow">{row.skill.title}</strong>
                <span className={`lrn-status ${row.status}`}><LIcon name={statusIcon[row.status]} size={14} stroke={2.2} />{skillStatusTitle(row.status)}</span>
              </div>
              <div className="muted small">{row.skill.goal}</div>
              {row.waitingFor.length > 0 && <div className="small lrn-waiting">Baut auf: {row.waitingFor.join(', ')}</div>}
              {row.status !== 'mastered' && row.status !== 'notStarted' && (
                <>
                  {row.reasons.map((reason, i) => <div key={i} className="small" style={{ color: 'var(--ink2)' }}>{reason}</div>)}
                  <div><button type="button" className="btn outline small" onClick={() => onPractice(row)}>{row.status === 'due' ? 'Jetzt wiederholen' : 'Gezielt üben'}</button></div>
                </>
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

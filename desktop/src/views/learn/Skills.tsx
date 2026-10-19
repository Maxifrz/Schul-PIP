import type { Recommendation } from '../../lib/learn/advisor';
import type { Skill, SkillStatus } from '../../lib/learn/skills';
import { isReached, skillStatusTitle } from '../../lib/learn/skills';
import { Glyph } from '../../ui/glyph';

export interface SkillRow {
  skill: Skill;
  status: SkillStatus;
  reasons: string[];
  waitingFor: string[];
}

const statusGlyph: Record<SkillStatus, string> = {
  notStarted: 'circle', started: 'circle', worked: 'circle', practicing: 'circle', provisional: 'checkCircle', mastered: 'seal', due: 'undo',
};
const statusTone: Record<SkillStatus, string> = {
  notStarted: 'var(--faint)', started: 'var(--muted)', worked: 'var(--muted)', practicing: 'var(--ink2)', provisional: 'var(--accent)', mastered: 'var(--link)', due: 'var(--warn)',
};

export function AdviceCard({ advice, onGo, onSkills }: { advice: Recommendation; onGo: () => void; onSkills: () => void }) {
  const caption = { review: 'Wiederholung fällig', practice: 'Gezielt üben', step: 'Als Nächstes', finished: 'Kurs geschafft' }[advice.kind];
  const tone = advice.kind === 'review' ? 'var(--warn)' : advice.kind === 'practice' ? 'var(--accent)' : 'var(--link)';
  return (
    <div className="ln-card ln-advice" style={{ borderColor: tone }}>
      <div className="ln-caption" style={{ color: tone }}>{caption}</div>
      <div className="ln-advice-title">{advice.title}</div>
      <div className="small muted">{advice.reason}</div>
      <div className="row wrap" style={{ marginTop: 2 }}>
        {advice.kind !== 'finished' && <button className="btn small" onClick={onGo}>{advice.kind === 'step' ? 'Starten' : 'Los geht’s'}</button>}
        <button className="btn outline small" onClick={onSkills}>Fähigkeiten</button>
      </div>
    </div>
  );
}

export function SkillsView({ courseTitle, rows, onPractice }: { courseTitle: string; rows: SkillRow[]; onPractice: (row: SkillRow) => void }) {
  if (rows.length === 0) {
    return <p className="muted ln-empty">Zu „{courseTitle}“ gibt es keine Fähigkeiten, nur Karten. Wähle einen Kurs, um zu sehen, was schon sitzt.</p>;
  }
  const order: string[] = [];
  for (const row of rows) if (!order.includes(row.skill.unitID)) order.push(row.skill.unitID);
  const reached = rows.filter((r) => isReached(r.status)).length;
  return (
    <div className="ln-column col" style={{ gap: 22 }}>
      <div className="col" style={{ gap: 6 }}>
        <div className="ln-big">{reached} von {rows.length} erreicht</div>
        <div className="small muted">Eine Lektion zu bearbeiten reicht nicht: Ein Ziel gilt erst als erreicht, wenn du es ohne Hilfe richtig gemacht hast, auf jeder Stufe, die es verlangt. Beherrscht ist es nach einer guten Runde an einem anderen Tag.</div>
      </div>
      {order.map((unitID) => {
        const group = rows.filter((r) => r.skill.unitID === unitID);
        return (
          <div key={unitID} className="col" style={{ gap: 10 }}>
            <div className="ln-strong" style={{ fontSize: 17 }}>Einheit {group[0].skill.unitNumber} · {group[0].skill.unitTitle}</div>
            {group.map((row) => (
              <div key={row.skill.id} className="ln-card col" style={{ gap: 8, borderColor: row.status === 'due' ? 'var(--warn)' : undefined, borderWidth: row.status === 'due' ? 2 : undefined }}>
                <div className="row">
                  <div className="ln-strong grow">{row.skill.title}</div>
                  <div className="row small" style={{ gap: 5, color: statusTone[row.status], fontWeight: 600 }}><Glyph name={statusGlyph[row.status]} size={14} />{skillStatusTitle(row.status)}</div>
                </div>
                <div className="small muted">{row.skill.goal}</div>
                {row.waitingFor.length > 0 && <div className="small muted">Baut auf: {row.waitingFor.join(', ')}</div>}
                {row.status !== 'mastered' && row.status !== 'notStarted' && (<>
                  {row.reasons.map((reason, i) => <div key={i} className="small" style={{ color: 'var(--ink2)' }}>{reason}</div>)}
                  <div><button className="btn outline small" onClick={() => onPractice(row)}>{row.status === 'due' ? 'Jetzt wiederholen' : 'Gezielt üben'}</button></div>
                </>)}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

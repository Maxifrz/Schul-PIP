import { CourseKind, Course, CourseUnit, courseKindTitle, courseKinds } from '../../lib/learn/course';
import { Dialog, useDialogClose } from '../../ui/kit';
import { Glyph, courseGlyph } from '../../ui/glyph';
import { PipLogo } from '../../ui/pip';
import { FreezeRow, Bar } from './Quests';
import type { MaterialRow } from './library';
import { onTint, tint } from './shared';

export function UnitTipSheet({ unit, onClose, onTestOut }: { unit: CourseUnit; onClose: () => void; onTestOut: (() => void) | null }) {
  const paragraphs = unit.tip.split('\n\n').map((p) => p.trim()).filter((p) => p !== '');
  return (
    <Dialog onClose={onClose}>
      <TipBody unit={unit} paragraphs={paragraphs} onTestOut={onTestOut} />
    </Dialog>
  );
}

function TipBody({ unit, paragraphs, onTestOut }: { unit: CourseUnit; paragraphs: string[]; onTestOut: (() => void) | null }) {
  const close = useDialogClose();
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="ln-caption">Einheit {unit.number} · Tipps</div>
      <div className="ln-big">{unit.title}</div>
      {unit.summary !== '' && <div className="muted">{unit.summary}</div>}
      <hr className="line" />
      {paragraphs.map((p, i) => <p key={i} style={{ margin: 0, lineHeight: 1.55 }}>{p}</p>)}
      {onTestOut && (
        <div className="col" style={{ gap: 6, alignItems: 'center', marginTop: 6 }}>
          <button className="btn outline" onClick={() => { close(); onTestOut(); }}>Einheit überspringen: Test machen</button>
          <div className="small muted" style={{ textAlign: 'center' }}>Ab 85 % richtig, ohne Hilfe, zählt die Einheit als bearbeitet. Als Fähigkeit zählt nur, was der Test zeigt.</div>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={close}>Verstanden</button></div>
    </div>
  );
}

export function StreakSheet({ days, longest, gems, freezes, onClose }: { days: number; longest: number; gems: number; freezes: number; onClose: () => void }) {
  const daysText = (n: number) => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
  return (
    <Dialog onClose={onClose}>
      <div className="col" style={{ gap: 16 }}>
        <div className="ln-caption">Serie</div>
        <div className="ln-big" style={{ fontSize: 34 }}>{daysText(days)}</div>
        <div className="muted">{days === 0 ? 'Eine Lektion pro Tag startet deine Serie.' : `Eine Lektion pro Tag hält deine Serie am Laufen. Dein längster Lauf: ${daysText(Math.max(longest, days))}.`}</div>
        <FreezeRow gems={gems} freezes={freezes} />
        <div className="row small muted" style={{ gap: 6 }}><span style={{ color: 'var(--accent)' }}><Glyph name="diamond" size={13} /></span>{gems} Gems</div>
      </div>
    </Dialog>
  );
}

export function CoursePicker({ courses, materials, selectedID, fraction, xp, canGenerate, generatingID, message, onSelect, onCreate, onLibrary, onClose }: {
  courses: Course[];
  materials: MaterialRow[];
  selectedID: string;
  fraction: (id: string) => number;
  xp: (id: string) => number;
  canGenerate: boolean;
  generatingID: string | null;
  message: string;
  onSelect: (id: string) => void;
  onCreate: (id: string) => void;
  onLibrary: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog onClose={onClose}>
      <PickerBody {...{ courses, materials, selectedID, fraction, xp, canGenerate, generatingID, message, onSelect, onCreate, onLibrary }} />
    </Dialog>
  );
}

function PickerBody({ courses, materials, selectedID, fraction, xp, canGenerate, generatingID, message, onSelect, onCreate, onLibrary }: Omit<Parameters<typeof CoursePicker>[0], 'onClose'>) {
  const close = useDialogClose();
  const section = (title: string, children: React.ReactNode) => (
    <div className="col" style={{ gap: 10 }}><div className="ln-strong" style={{ fontSize: 18 }}>{title}</div>{children}</div>
  );
  return (
    <div className="col" style={{ gap: 20 }}>
      <div className="row"><div className="grow"><div className="ln-caption">Lernen</div><div className="ln-big">Kurse</div></div><button className="btn outline small" onClick={close}>Fertig</button></div>
      {courseKinds.map((kind: CourseKind) => {
        const group = courses.filter((c) => c.kind === kind);
        if (group.length === 0) return null;
        return (
          <div key={kind}>
            {section(courseKindTitle(kind), group.map((course) => {
              const done = fraction(course.id);
              return (
                <button key={course.id} className={`ln-card ln-course ${course.id === selectedID ? 'selected' : ''}`} onClick={() => { onSelect(course.id); close(); }}>
                  <span className="ln-course-icon" style={{ background: tint(course), color: onTint(course) }}><Glyph name={courseGlyph(course.symbol)} size={22} stroke={2.2} /></span>
                  <span className="grow col" style={{ gap: 3, textAlign: 'left' }}>
                    <span className="ln-strong">{course.title}</span>
                    <span className="small muted">{course.subtitle}</span>
                    <span className="row" style={{ gap: 8 }}>
                      <span style={{ width: 120 }}><Bar fraction={done} /></span>
                      <span className="mono small faint">{Math.round(done * 100)} %{xp(course.id) > 0 ? ` · ${xp(course.id)} XP` : ''}</span>
                    </span>
                  </span>
                  {course.id === selectedID && <span style={{ color: 'var(--link)' }}><Glyph name="checkCircle" size={22} /></span>}
                </button>
              );
            }))}
          </div>
        );
      })}
      {section('Mein Material', materials.length === 0 ? (
        <div className="ln-card col" style={{ gap: 12, alignItems: 'flex-start' }}>
          <div className="muted">Importiere ein PDF in der Bibliothek. Pip liest die Seiten und macht daraus Lektionen, du musst keine Karten anlegen.</div>
          <button className="btn small" onClick={() => { close(); onLibrary(); }}>Zur Bibliothek</button>
        </div>
      ) : (
        <>
          {materials.map((row) => (
            <div key={row.id} className="ln-card ln-course">
              <span className="ln-course-icon" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}><Glyph name="doc" size={20} stroke={2.2} /></span>
              <span className="grow col" style={{ gap: 3 }}>
                <span className="ln-strong">{row.title}</span>
                <span className="small muted">{row.cardCount === 0 ? 'Noch keine Lektionen' : `${row.cardCount} Karten · ${row.lessons} ${row.lessons === 1 ? 'Lektion' : 'Lektionen'}`}</span>
              </span>
              {generatingID === row.id ? <span className="small muted">Pip liest …</span> : (
                <>
                  {row.courseID && <button className="btn outline small" onClick={() => { onSelect(row.courseID!); close(); }}>Öffnen</button>}
                  {row.id !== 'sonstiges' && <button className="btn small" disabled={!canGenerate || generatingID !== null} onClick={() => onCreate(row.id)}>{row.cardCount === 0 ? 'Erstellen' : 'Mehr'}</button>}
                </>
              )}
            </div>
          ))}
          {!canGenerate && <div className="small faint">Zum Erstellen braucht Pip einen API-Key, beides in den Einstellungen.</div>}
          {message !== '' && <div className="small" style={{ color: 'var(--ink2)', fontWeight: 500 }}>{message}</div>}
        </>
      ))}
    </div>
  );
}

export { PipLogo };

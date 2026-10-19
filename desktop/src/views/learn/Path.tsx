import { useEffect, useRef } from 'react';
import { Recommendation } from '../../lib/learn/advisor';
import { Course, PathStep, PathUnit, CourseUnit, pathUnitDone } from '../../lib/learn/course';
import { CoursePath } from '../../lib/learn/course';
import { NodeMastery, PathMastery, unitMasteryText } from '../../lib/learn/skills';
import { Glyph } from '../../ui/glyph';
import { PipLogo } from '../../ui/pip';
import { AdviceCard } from './Skills';
import { onTint, tint } from './shared';

export interface PathTiles {
  questsDone: number;
  questsTotal: number;
  weekText: string;
  hasUnclaimed: boolean;
}

const wave = [0, 0.55, 0.85, 0.55, 0, -0.55, -0.85, -0.55];

function nodeGlyph(step: PathStep, course: Course): string {
  switch (step.node.kind) {
    case 'lesson': return step.state === 'done' ? 'check' : 'star';
    case 'practice': return 'dumbbell';
    case 'checkpoint': return step.state === 'done' ? 'seal' : (course.symbol === 'doc' ? 'doc' : 'seal');
    case 'chest': return 'chest';
  }
}

function nodeLabel(step: PathStep, mastery: NodeMastery): string {
  const name = { lesson: `Lektion ${step.node.index}`, practice: 'Übungsrunde', checkpoint: 'Einheitentest', chest: 'Truhe' }[step.node.kind];
  const state =
    step.state === 'done'
      ? mastery === 'sits' ? 'geschafft, sitzt' : mastery === 'due' ? 'geschafft, Wiederholung fällig' : step.node.kind === 'chest' ? 'geöffnet' : 'geschafft'
      : step.state === 'open' ? (step.node.kind === 'chest' ? 'bereit zum Öffnen' : 'offen') : 'gesperrt';
  return `${name}, ${state}`;
}

export function PathNode({ step, course, isCurrent, mastery, onStep, onRef }: { step: PathStep; course: Course; isCurrent: boolean; mastery: NodeMastery; onStep: (s: PathStep) => void; onRef?: (el: HTMLButtonElement | null) => void }) {
  const locked = step.state === 'locked';
  return (
    <button
      ref={onRef}
      className={`ln-node ${locked ? 'locked' : ''} ${isCurrent ? 'current' : ''} ${mastery === 'sits' ? 'sits' : ''} ${mastery === 'due' ? 'due' : ''}`}
      style={{ ['--tint' as string]: tint(course), ['--on' as string]: onTint(course) }}
      disabled={locked}
      onClick={() => onStep(step)}
      aria-label={nodeLabel(step, mastery)}
    >
      {isCurrent && <span className="ln-start">{step.node.kind === 'chest' ? 'ÖFFNEN' : 'START'}</span>}
      <span className="ln-coin-edge" />
      <span className="ln-coin"><Glyph name={nodeGlyph(step, course)} size={28} fill={step.node.kind === 'lesson' && step.state !== 'done'} stroke={2.2} /></span>
    </button>
  );
}

function Banner({ unit, course, mastery, onTip, onSkills }: { unit: PathUnit; course: Course; mastery: PathMastery | null; onTip: (u: CourseUnit) => void; onSkills: () => void }) {
  const standing = mastery ? mastery.unit(unit.unit.id) : null;
  const show = standing && standing.total > 0 ? standing : null;
  return (
    <div className="ln-banner-wrap">
      <div className="ln-banner" style={{ background: tint(course), color: onTint(course) }}>
        <div className="grow col" style={{ gap: 8 }}>
          <button className="ln-banner-title" onClick={() => onTip(unit.unit)} aria-label={`Abschnitt ${unit.sectionNumber}, Einheit ${unit.unit.number}: ${unit.unit.title}. Tipps lesen`}>
            <span className="ln-banner-cap">ABSCHNITT {unit.sectionNumber}, EINHEIT {unit.unit.number}</span>
            <span className="ln-banner-name">{unit.unit.title}</span>
          </button>
          {show && (
            <button className="ln-banner-skills" onClick={onSkills}>
              <span className="row" style={{ gap: 4 }}>
                {Array.from({ length: show.total }, (_, i) => <i key={i} className={i < show.reached ? 'on' : ''} />)}
              </span>
              {unitMasteryText(show)}
              <Glyph name="chevron" size={12} stroke={2.4} />
            </button>
          )}
        </div>
        <button className="ln-banner-book" onClick={() => onTip(unit.unit)} aria-hidden="true" tabIndex={-1}><Glyph name="book" size={18} fill /></button>
      </div>
    </div>
  );
}

export function PathView({ course, units, tiles, advice, mastery, onStep, onTip, onQuests, onAdvice, onSkills, footer }: {
  course: Course;
  units: PathUnit[];
  tiles: PathTiles;
  advice: Recommendation | null;
  mastery: PathMastery | null;
  onStep: (step: PathStep) => void;
  onTip: (unit: CourseUnit) => void;
  onQuests: () => void;
  onAdvice: () => void;
  onSkills: () => void;
  footer?: React.ReactNode;
}) {
  const current = CoursePath.current(units);
  const currentRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' });
  }, [course.id]);

  let position = 0;
  return (
    <div className="ln-path-layout">
      <aside className="ln-rail">
        {advice && <AdviceCard advice={advice} onGo={onAdvice} onSkills={onSkills} />}
        <button className="ln-quests-line" onClick={onQuests} aria-label={`Quests heute: ${tiles.questsDone} von ${tiles.questsTotal}${tiles.weekText ? `, Woche: ${tiles.weekText}` : ''}`}>
          <span className="ln-strong" style={{ fontWeight: 500, color: 'var(--ink2)' }}>Quests {tiles.questsDone}/{tiles.questsTotal}</span>
          {tiles.hasUnclaimed && <i className="ln-dot" />}
          {tiles.weekText && <span className="muted">Woche {tiles.weekText}</span>}
          <span className="grow" />
          <Glyph name="chevron" size={14} />
        </button>
      </aside>
      <div className="ln-path">
        {units.map((unit) => (
          <section key={unit.unit.id}>
            <Banner unit={unit} course={course} mastery={mastery} onTip={onTip} onSkills={onSkills} />
            <div className="ln-steps">
              {unit.steps.map((step) => {
                const shift = wave[position % wave.length] * 100;
                position += 1;
                const isCurrent = step.node.id === current?.node.id;
                return (
                  <div key={step.node.id} className={`ln-row ${isCurrent ? 'current' : ''}`}>
                    <div style={{ transform: `translateX(${shift}px)` }} className="ln-row-inner">
                      <PathNode step={step} course={course} isCurrent={isCurrent} mastery={mastery?.node(step) ?? 'none'} onStep={onStep} onRef={isCurrent ? (el) => { currentRef.current = el; } : undefined} />
                      {isCurrent && <div className="ln-pip" style={{ [shift >= 0 ? 'right' : 'left']: '100%' }}><PipLogo pixel={4} /><i /></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {units.length > 0 && units.every(pathUnitDone) && (
          <div className="ln-card ln-finished">
            <PipLogo pixel={5} />
            <div className="ln-big">Kurs geschafft</div>
            <p className="muted small" style={{ margin: 0 }}>Du hast alle Einheiten von „{course.title}“ abgeschlossen. Tippe auf eine Lektion, um sie noch einmal zu üben.</p>
          </div>
        )}
        {footer && <div style={{ marginTop: 24 }}>{footer}</div>}
      </div>
    </div>
  );
}

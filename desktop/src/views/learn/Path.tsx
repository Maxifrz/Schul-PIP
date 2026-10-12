// The path of a course: a banner per unit that stays at the top while its steps scroll by, the steps in a gentle zigzag
// (strictly one after the other: done, the one open, the rest locked), and Pip beside the one to do next.

import { type CSSProperties, useEffect, useRef } from 'react';
import {
  type Course, type CourseNode, type PathStep, type PathUnit, type Recommendation, prefersDarkText,
} from '../../lib/learn';
import { pathShift } from './geometry';
import { type IconName, LIcon, LIconFilled } from './icons';
import { PipMark } from './PipMark';

/** The course's colour as a CSS variable, with the token for text on it. The only colour outside the tokens. */
export function courseStyle(course: Course): CSSProperties {
  return {
    ['--course' as string]: '#' + course.color.toString(16).padStart(6, '0'),
    ['--on-course' as string]: prefersDarkText(course) ? 'var(--on-accent)' : 'var(--rail-ink)',
  };
}

export function stepLabel(node: CourseNode): string {
  switch (node.kind) {
    case 'lesson':
      return `Lektion ${node.index}`;
    case 'practice':
      return 'Übungsrunde';
    case 'checkpoint':
      return 'Einheitentest';
    case 'chest':
      return 'Truhe';
  }
}

export function stateText(step: PathStep): string {
  if (step.state === 'done') return step.node.kind === 'chest' ? 'geöffnet' : 'geschafft';
  if (step.state === 'open') return step.node.kind === 'chest' ? 'bereit zum Öffnen' : 'offen';
  return 'gesperrt';
}

function nodeIcon(step: PathStep, course: Course): IconName {
  switch (step.node.kind) {
    case 'lesson':
      return step.state === 'done' ? 'check' : 'star';
    case 'practice':
      return 'dumbbell';
    case 'checkpoint':
      return step.state === 'done' ? 'seal' : 'flag';
    case 'chest':
      return 'chest';
  }
}

function PathNode({ step, course, current, onStep }: { step: PathStep; course: Course; current: boolean; onStep: (step: PathStep) => void }) {
  const locked = step.state === 'locked';
  const icon = nodeIcon(step, course);
  return (
    <button
      type="button"
      className={`lrn-node ${step.state} ${current ? 'current' : ''} ${step.node.kind}`}
      disabled={locked}
      data-step={step.id}
      aria-label={`${stepLabel(step.node)}, ${stateText(step)}`}
      title={locked ? 'Öffnet sich, wenn du die Schritte davor geschafft hast' : `${stepLabel(step.node)}: Startet den Schritt`}
      onClick={() => onStep(step)}
    >
      {current && <span className="ring" />}
      <span className="coin">
        {step.node.kind === 'chest' || step.node.kind === 'lesson' && step.state !== 'done' ? <LIconFilled name={icon} size={30} /> : <LIcon name={icon} size={30} stroke={2.4} />}
      </span>
      {current && <span className="start">{step.node.kind === 'chest' ? 'ÖFFNEN' : 'START'}</span>}
    </button>
  );
}

export function PathView({
  course, units, onStep, onTip, onFooter,
}: {
  course: Course;
  units: PathUnit[];
  onStep: (step: PathStep) => void;
  onTip: (unit: PathUnit) => void;
  onFooter: () => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const current = units.flatMap((u) => u.steps).find((s) => s.state === 'open') ?? null;
  const first = useRef(true);
  useEffect(() => {
    if (!first.current) return;
    first.current = false;
    const element = root.current?.querySelector<HTMLElement>('.lrn-node.current');
    element?.scrollIntoView({ block: 'center' });
  }, [course.id]);

  let position = 0;
  return (
    <div className="lrn-path" ref={root} style={courseStyle(course)}>
      {units.map((unit, unitIndex) => {
        const startsSection = unitIndex === 0 || units[unitIndex - 1].section.id !== unit.section.id;
        return (
          <section key={unit.id} aria-label={`Einheit ${unit.unit.number}: ${unit.unit.title}`}>
            {startsSection && <h2 className="lrn-section">{unit.section.title}</h2>}
            <button type="button" className="lrn-banner" onClick={() => onTip(unit)} aria-label={`Abschnitt ${unit.sectionNumber}, Einheit ${unit.unit.number}: ${unit.unit.title}. Tipps lesen`}>
              <span className="grow">
                <span className="cap">ABSCHNITT {unit.sectionNumber}, EINHEIT {unit.unit.number}</span>
                <span className="ttl">{unit.unit.title}</span>
              </span>
              <span className="tip"><LIcon name="book" size={20} /></span>
            </button>
            <div className="lrn-steps">
              {unit.steps.map((step) => {
                const isCurrent = current?.id === step.id;
                const shift = pathShift(position++);
                return (
                  <div key={step.id} className={`lrn-row ${isCurrent ? 'current' : ''}`}>
                    <div className="lrn-slot" style={{ ['--shift' as string]: shift }}>
                      <PathNode step={step} course={course} current={isCurrent} onStep={onStep} />
                      {isCurrent && (
                        <span className={`lrn-pipbeside ${shift >= 0 ? 'left' : 'right'}`}>
                          <PipMark pixel={4} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
      {units.length > 0 && units.every((u) => u.isDone) && (
        <div className="card lrn-finished">
          <PipMark pixel={5} />
          <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Kurs geschafft</h3>
          <p className="muted" style={{ margin: 0 }}>Du hast alle Einheiten von „{course.title}“ abgeschlossen. Klick auf eine Lektion, um sie noch einmal zu üben.</p>
        </div>
      )}
      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <button type="button" className="btn outline" onClick={onFooter}>Anderen Kurs wählen</button>
      </div>
    </div>
  );
}

/** What the Lernen area suggests next and why, with one button to do it. */
export function AdviceCard({ advice, onGo, onSkills }: { advice: Recommendation; onGo: () => void; onSkills: () => void }) {
  const caption = { review: 'Wiederholung fällig', practice: 'Gezielt üben', step: 'Als Nächstes', finished: 'Kurs geschafft' }[advice.kind];
  return (
    <div className={`card lrn-advice ${advice.kind}`}>
      <div className="kind lrn-tone">{caption}</div>
      <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700 }}>{advice.title}</h3>
      <p className="muted small" style={{ margin: 0 }}>{advice.reason}</p>
      <div className="row wrap">
        {advice.kind !== 'finished' && <button type="button" className="btn" onClick={onGo}>{advice.kind === 'step' ? 'Starten' : 'Los geht’s'}</button>}
        <button type="button" className="btn outline" onClick={onSkills}>Fähigkeiten</button>
      </div>
    </div>
  );
}

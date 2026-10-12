// The Lernen area: the numbers on top (course, streak, gems, daily goal), then the path of the chosen course, the
// quests or the skills. A port of LearnHomeView.swift; the round itself is in LessonPlayer.tsx.

import { useEffect, useRef, useState } from 'react';
import {
  CoursePath, LearnProgress, QuestBoard, SkillAdvisor, SkillMaps, ALL_COURSE_KINDS, courseKindTitle, courses, providerForCourse,
  type Course, type PathUnit, type SkillRow,
} from '../../lib/learn';
import {
  buyFreeze, calendar, canTestOut, claimQuest, learn, learnUi, now, refreshTime, selectCourse, setDailyGoal, setMode, startLearn,
  startPractice, startStep, startTestOut, type LearnMode,
} from '../../store/learn';
import { Caption, Dialog, useDialogClose } from '../../ui/kit';
import { LessonPlayer } from './LessonPlayer';
import { type IconName, LIcon, LIconFilled, courseIconName } from './icons';
import { timeLeftShort } from './geometry';
import { AdviceCard, PathView, courseStyle } from './Path';
import { FreezeRow, QuestsView, SkillsView } from './Panels';
import { PipMark } from './PipMark';

export function Learn() {
  const state = learnUi.use();
  useEffect(() => {
    void startLearn();
  }, []);
  // A day can pass while the window waits: look at the clock every half minute and when the window is shown again.
  useEffect(() => {
    const timer = setInterval(refreshTime, 30000);
    const visible = () => document.visibilityState === 'visible' && refreshTime();
    document.addEventListener('visibilitychange', visible);
    refreshTime();
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [state.ready]);

  if (!state.ready) return <div className="page"><span className="muted">Lade …</span></div>;
  if (state.active) return <LessonPlayer />;
  return <Home />;
}

function GoalRing({ fraction, reached }: { fraction: number; reached: boolean }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" stroke="var(--line2)" strokeWidth="3" />
      <circle
        cx="12" cy="12" r={r} fill="none" stroke={reached ? 'var(--link)' : 'var(--accent)'} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${c * fraction} ${c}`} transform="rotate(-90 12 12)"
      />
    </svg>
  );
}

function CourseTile({ course, size = 34 }: { course: Course | null; size?: number }) {
  return (
    <span className="lrn-tile-icon" style={{ ...(course ? courseStyle(course) : {}), width: size, height: size }}>
      <LIcon name={course ? courseIconName(course.kind) : 'stack'} size={size * 0.55} stroke={2.2} />
    </span>
  );
}

function StatsBar({ course, onCourse, onShop }: { course: Course | null; onCourse: () => void; onShop: () => void }) {
  const { progress } = learn();
  const state = progress.progress;
  const cal = calendar();
  const t = now();
  const streak = state.currentStreak(t, cal);
  const xpToday = state.xpToday(t, cal);
  const goal = state.dailyGoal;
  const [menu, setMenu] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) setMenu(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);
  return (
    <div className="lrn-stats">
      <button type="button" className="lrn-stat-btn" onClick={onCourse} aria-label={course ? `Kurs ${course.title}, ${state.xpInCourse(course.id)} XP. Kurs wechseln` : 'Kurs wählen'}>
        <CourseTile course={course} />
        <b>{course ? state.xpInCourse(course.id) : 0}</b>
        <span className="muted small">{course ? course.title : 'Kurs wählen'}</span>
      </button>
      <span className="grow" />
      <button type="button" className={`lrn-stat-btn ${streak > 0 ? 'warn' : 'dim'}`} onClick={() => setMode('quests')} aria-label={`Serie: ${streak} ${streak === 1 ? 'Tag' : 'Tage'}`}>
        <LIconFilled name="flame" size={18} /><b>{streak}</b>
      </button>
      <button type="button" className="lrn-stat-btn link" onClick={onShop} aria-label={`${state.gems} Gems. Zum Streak-Schutz`}>
        <LIconFilled name="diamond" size={18} /><b>{state.gems}</b>
      </button>
      <div className="lrn-goal" ref={box}>
        <button type="button" className="lrn-stat-btn" aria-haspopup="true" aria-expanded={menu} onClick={() => setMenu(!menu)} aria-label={`Tagesziel: ${xpToday} von ${goal} XP. Ändern`}>
          <GoalRing fraction={Math.min(1, xpToday / Math.max(1, goal))} reached={xpToday >= goal} />
          <b>{Math.min(xpToday, 999)}/{goal}</b>
        </button>
        {menu && (
          <div className="lrn-menu" role="menu" aria-label="Tagesziel">
            {LearnProgress.dailyGoals.map((g) => (
              <button key={g} type="button" role="menuitemradio" aria-checked={g === goal} className={g === goal ? 'on' : ''} onClick={() => { setDailyGoal(g); setMenu(false); }}>
                {g} XP am Tag
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CoursePicker({ selectedID, onClose }: { selectedID: string; onClose: () => void }) {
  const { progress } = learn();
  const completed = progress.progress.completedLessons;
  return (
    <Dialog onClose={onClose}>
      <PickerBody selectedID={selectedID} completed={completed} xp={(id) => progress.progress.xpInCourse(id)} />
    </Dialog>
  );
}

function PickerBody({ selectedID, completed, xp }: { selectedID: string; completed: ReadonlySet<string>; xp: (id: string) => number }) {
  const close = useDialogClose();
  const all = courses();
  return (
    <div className="col" style={{ gap: 18 }}>
      <div className="row">
        <div className="grow">
          <Caption>Lernen</Caption>
          <h2 className="lrn-h2" style={{ margin: 0 }}>Kurse</h2>
        </div>
        <button type="button" className="btn outline small" onClick={close}>Fertig</button>
      </div>
      {all.length === 0 && <p className="muted">Es sind noch keine Kurse da.</p>}
      {ALL_COURSE_KINDS.map((kind) => {
        const group = all.filter((c) => c.kind === kind);
        if (group.length === 0) return null;
        return (
          <section key={kind} className="col">
            <h3 className="lrn-h3">{courseKindTitle(kind)}</h3>
            {group.map((course) => {
              const done = CoursePath.fraction(course, completed);
              const percent = Math.round(done * 100);
              const points = xp(course.id);
              const selected = course.id === selectedID;
              return (
                <button
                  key={course.id} type="button" className={`card lrn-course ${selected ? 'on' : ''}`} data-course={course.id}
                  aria-pressed={selected} aria-label={`${course.title}, ${course.subtitle}, ${percent} Prozent geschafft`}
                  onClick={() => { selectCourse(course.id); close(); }}
                >
                  <CourseTile course={course} size={52} />
                  <span className="grow col" style={{ gap: 3 }}>
                    <strong>{course.title}</strong>
                    <span className="muted small">{course.subtitle}</span>
                    <span className="row">
                      <span className="lrn-bar" style={{ width: 120 }}><i style={{ width: `${percent}%` }} /></span>
                      <span className="mono small faint">{points > 0 ? `${percent} % · ${points} XP` : `${percent} %`}</span>
                    </span>
                  </span>
                  {selected && <span className="lrn-ico-link"><LIcon name="checkCircle" size={24} /></span>}
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

function ShopDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <ShopBody />
    </Dialog>
  );
}

function ShopBody() {
  const close = useDialogClose();
  const state = learnUi.use();
  void state.tick;
  const p = learn().progress.progress;
  return (
    <div className="col" style={{ gap: 16 }}>
      <div className="row">
        <div className="grow">
          <Caption>Gems</Caption>
          <div className="row" style={{ gap: 8 }}>
            <span className="lrn-ico-link"><LIconFilled name="diamond" size={26} /></span>
            <span className="lrn-big-number">{p.gems}</span>
          </div>
        </div>
        <button type="button" className="btn outline small" onClick={close}>Fertig</button>
      </div>
      <p className="muted" style={{ margin: 0 }}>Gems bekommst du für Lektionen, Quests, Truhen und dein Tagesziel.</p>
      <FreezeRow gems={p.gems} freezes={p.freezes} onBuy={() => buyFreeze()} />
    </div>
  );
}

function TipDialog({ unit, course, onClose }: { unit: PathUnit; course: Course; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <TipBody unit={unit} course={course} />
    </Dialog>
  );
}

function TipBody({ unit, course }: { unit: PathUnit; course: Course }) {
  const close = useDialogClose();
  const paragraphs = unit.unit.tip.split('\n\n').map((p) => p.trim()).filter((p) => p !== '');
  const testOut = canTestOut(unit.unit);
  return (
    <div className="col" style={{ gap: 14 }} data-course={course.id}>
      <Caption>{`Einheit ${unit.unit.number} · Tipps`}</Caption>
      <h2 className="lrn-h2" style={{ margin: 0, fontSize: '1.75rem' }}>{unit.unit.title}</h2>
      {unit.unit.summary !== '' && <div className="muted">{unit.unit.summary}</div>}
      <hr className="line" />
      {paragraphs.map((p, i) => <p key={i} className="lrn-tip">{p}</p>)}
      {testOut && (
        <div className="col" style={{ gap: 6, alignItems: 'center' }}>
          <button type="button" className="btn outline" onClick={() => { close(); startTestOut(unit.unit); }}>Einheit überspringen: Test machen</button>
          <span className="muted small" style={{ textAlign: 'center' }}>Ab 85 % richtig, ohne Hilfe, zählt die Einheit als bearbeitet. Als Fähigkeit zählt nur, was der Test zeigt.</span>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn" onClick={close}>Verstanden</button>
      </div>
    </div>
  );
}

const modes: Array<{ id: LearnMode; label: string }> = [
  { id: 'path', label: 'Pfad' },
  { id: 'quests', label: 'Quests' },
  { id: 'skills', label: 'Fähigkeiten' },
];

function Home() {
  const state = learnUi.use();
  void state.tick;
  const { progress, quests, skills, controller } = learn();
  const [picker, setPicker] = useState(false);
  const [shop, setShop] = useState(false);
  const [tip, setTip] = useState<PathUnit | null>(null);
  const provider = state.courseID ? providerForCourse(state.courseID) : undefined;
  const course = provider?.course ?? null;
  const cal = calendar();
  const t = now();
  const completed = progress.progress.completedLessons;
  const units = course ? CoursePath.units(course, completed) : [];
  const mode = course ? state.mode : 'path';

  const advice = provider && course
    ? SkillAdvisor.recommend(SkillMaps.map(provider), skills.records, units, completed, t, cal)
    : null;
  const follow = () => {
    if (!advice) return;
    if (advice.kind === 'step' && advice.step) startStep(advice.step);
    else if (advice.kind === 'review' || advice.kind === 'practice') startPractice(advice.skillIDs);
  };

  const board = quests.board;
  const weekly = board.weekly;
  const secondsLeft = QuestBoard.secondsUntilNextDay(t, cal);

  return (
    <div className="lrn-home">
      <div className="lrn-top">
        <div className="lrn-top-inner">
          <StatsBar course={course} onCourse={() => setPicker(true)} onShop={() => setShop(true)} />
          {course && (
            <div className="tabs" role="tablist" aria-label="Ansicht">
              {modes.map((m) => (
                <button key={m.id} type="button" role="tab" aria-selected={mode === m.id} className={`pill ${mode === m.id ? 'on' : ''}`} onClick={() => setMode(m.id)}>
                  {m.label}
                  {m.id === 'quests' && board.hasUnclaimed && <span className="lrn-dot" aria-label="Es wartet eine Belohnung" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="lrn-scroll">
        {!course && (
          <div className="lrn-empty">
            <PipMark pixel={6} />
            <h2 style={{ margin: '6px 0 0', fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.03em' }}>Such dir einen Kurs aus</h2>
            <p className="muted" style={{ maxWidth: 440, margin: 0 }}>
              Sprachen, Mathe, Schach oder Musik: Pip macht daraus kurze Lektionen mit XP, Serie und Quests.
            </p>
            <button type="button" className="btn" onClick={() => setPicker(true)}>Kurs wählen</button>
          </div>
        )}
        {course && provider && mode === 'path' && (
          <div className="lrn-cols">
            <aside className="lrn-aside">
              {advice && <AdviceCard advice={advice} onGo={follow} onSkills={() => setMode('skills')} />}
              <button type="button" className={`card lrn-tilebtn ${board.hasUnclaimed ? 'ready' : ''}`} onClick={() => setMode('quests')} aria-label={`Quests: ${board.dailyDone} von ${board.daily.length}, ${timeLeftShort(secondsLeft)}`}>
                <span className="kind" style={{ color: 'var(--muted)' }}>Quests</span>
                <b className="lrn-tile-value">{board.dailyDone}/{board.daily.length}</b>
                <span className="lrn-bar"><i style={{ width: `${board.daily.length === 0 ? 0 : (board.dailyDone / board.daily.length) * 100}%` }} /></span>
                <span className="small faint">{timeLeftShort(secondsLeft)}</span>
              </button>
              <button type="button" className="card lrn-tilebtn" onClick={() => setMode('quests')} aria-label={`Woche: ${weekly ? `${Math.min(weekly.progress, weekly.target)} von ${weekly.target}` : ''}`}>
                <span className="kind" style={{ color: 'var(--muted)' }}>Woche</span>
                <b className="lrn-tile-value">{weekly ? `${Math.min(weekly.progress, weekly.target)} von ${weekly.target}` : ' '}</b>
                <span className="lrn-bar"><i style={{ width: `${weekly && weekly.target > 0 ? Math.min(1, weekly.progress / weekly.target) * 100 : 0}%` }} /></span>
                <span className="small faint">Wochenziel</span>
              </button>
            </aside>
            <PathView course={course} units={units} onStep={startStep} onTip={setTip} onFooter={() => setPicker(true)} />
          </div>
        )}
        {course && mode === 'quests' && (
          <QuestsView
            board={board} gems={progress.progress.gems} freezes={progress.progress.freezes} secondsLeft={secondsLeft}
            onClaim={claimQuest} onBuyFreeze={() => buyFreeze()}
          />
        )}
        {course && provider && mode === 'skills' && (
          <SkillsView courseTitle={course.title} rows={controller.skillRows(provider) as SkillRow[]} onPractice={(row) => startPractice([row.skill.id])} />
        )}
      </div>
      {picker && <CoursePicker selectedID={state.courseID} onClose={() => setPicker(false)} />}
      {shop && <ShopDialog onClose={() => setShop(false)} />}
      {tip && course && <TipDialog unit={tip} course={course} onClose={() => setTip(null)} />}
    </div>
  );
}

export type { IconName };

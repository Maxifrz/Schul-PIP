import { useEffect, useMemo, useRef, useState } from 'react';
import { SkillPractice, TestOut, recommend } from '../../lib/learn/advisor';
import '../../lib/learn/allCourses';
import { providerFor, courses as shippedCourses } from '../../lib/learn/catalog';
import { Course, CourseNode, CourseProvider, CourseUnit, CoursePath, PathStep, lessonExercises } from '../../lib/learn/course';
import { localCalendar } from '../../lib/learn/calendar';
import { LearnPath } from '../../lib/learn/cards';
import { cardsNeedingDistractors } from '../../lib/learn/builder';
import { fetchDistractors } from '../../lib/learn/distractors';
import { MaterialCourse } from '../../lib/learn/materialCourse';
import { PathMastery, Skill, SkillAssessor, emptyRecord, skillMapOf } from '../../lib/learn/skills';
import { ask, checkEndpoint } from '../../lib/llm';
import { doFetch, secrets } from '../../lib/platform';
import { cardStore, keyAccount, libraryStore, say, settingsStore, ui } from '../../store/app';
import { LearnMode, beginNode, finishRound, learn, openChest, refreshQuests, setCourse, setGoal, setMode } from '../../store/learn';
import { dismissGeneratorMessage, generateCards, generator } from '../../store/material';
import { Glyph, courseGlyph } from '../../ui/glyph';
import { PipLogo } from '../../ui/pip';
import { Pills } from '../../ui/kit';
import { Dialog, useDialogClose } from '../../ui/kit';
import { Review } from '../Review';
import { LessonRun, LessonScreen } from './Lesson';
import { PathView } from './Path';
import { QuestsView } from './Quests';
import { SkillRow, SkillsView } from './Skills';
import { CoursePicker, StreakSheet, UnitTipSheet } from './Sheets';
import { makeLibrary, materialRows } from './library';
import { newSessionID, onTint, randomSeed, tint } from './shared';

const modes: Array<{ id: LearnMode; label: string }> = [
  { id: 'path', label: 'Pfad' },
  { id: 'skills', label: 'Fähigkeiten' },
  { id: 'quests', label: 'Quests' },
  { id: 'practice', label: 'Wiederholen' },
];

/** Which distractors were asked for since launch, so the model is asked about a card at most once per launch. */
const askedThisLaunch = new Set<string>();

const goalFraction = (xp: number, goal: number) => Math.min(1, xp / Math.max(1, goal));

function GoalSheet({ goal, onClose }: { goal: number; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <GoalBody goal={goal} />
    </Dialog>
  );
}

function GoalBody({ goal }: { goal: number }) {
  const close = useDialogClose();
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="ln-caption">Tagesziel</div>
      <div className="muted">Wie viele XP willst du am Tag sammeln?</div>
      <Pills items={[20, 50, 100].map((g) => ({ id: String(g), label: `${g} XP` }))} value={String(goal)} onChange={(id) => setGoal(Number(id))} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={close}>Fertig</button></div>
    </div>
  );
}

export function Learn() {
  const { progress, quests, skills, courseID, mode, distractors } = learn.use();
  const { list: cards } = cardStore.use();
  const { items: materials } = libraryStore.use();
  const generating = generator.use();
  const settings = settingsStore.use();
  const [run, setRun] = useState<LessonRun | null>(null);
  const [showCourses, setShowCourses] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [tipUnit, setTipUnit] = useState<CourseUnit | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const now = Date.now();
  const shipped = useMemo(() => shippedCourses(), []);

  useEffect(() => {
    refreshQuests();
    const onVisible = () => document.visibilityState === 'visible' && refreshQuests();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const completed = progress.completedLessons;
  const library = useMemo(() => makeLibrary(cards, materials, completed), [cards, materials, completed]);
  const course: Course | undefined = shipped.find((c) => c.id === courseID) ?? library.entries.find((e) => e.course.id === courseID)?.course;
  const isMaterial = !!course && MaterialCourse.isMaterialCourse(course.id);
  const provider: CourseProvider | undefined = course && !isMaterial ? providerFor(course.id) : undefined;

  // The model's wrong answers for the cards of a material course, in the background while its path is open.
  const fetchKey = `${course?.id ?? ''}|${library.snapshots.length}`;
  useEffect(() => {
    if (!isMaterial || library.snapshots.length < LearnPath.minimumCards) return;
    const provider = settings.selection.provider;
    if (provider !== 'custom' && !settings.providersWithKey.includes(provider)) return;
    let cancelled = false;
    const needing = cardsNeedingDistractors(library.snapshots).filter((c) => distractors[c.key] === undefined && !askedThisLaunch.has(c.key));
    if (needing.length === 0) return;
    needing.forEach((c) => askedThisLaunch.add(c.key));
    void (async () => {
      const { selection, customUrl } = settingsStore.get();
      const apiKey = (await secrets.get(keyAccount(selection.provider))) ?? '';
      const endpoint = checkEndpoint(customUrl);
      const fetched = await fetchDistractors(needing, (system, user) =>
        ask({ provider: selection.provider, apiKey, model: selection.model, endpoint: endpoint.kind === 'valid' ? endpoint.url : undefined, system, user, maxTokens: 1500 }, doFetch),
      );
      if (cancelled) {
        needing.filter((c) => fetched[c.key] === undefined).forEach((c) => askedThisLaunch.delete(c.key));
      }
      if (Object.keys(fetched).length > 0) {
        const keep = new Set(library.snapshots.map((c) => c.key));
        learn.set((s) => ({ ...s, distractors: Object.fromEntries(Object.entries({ ...s.distractors, ...fetched }).filter(([k]) => keep.has(k))) }));
      }
    })();
    return () => { cancelled = true; };
  }, [fetchKey]);

  const startRound = (next: LessonRun) => setRun((current) => current ?? next);
  const coachOf = (p: CourseProvider) => (p.feedback ? (item: Parameters<NonNullable<CourseProvider['feedback']>>[0], answer: Parameters<NonNullable<CourseProvider['feedback']>>[1]) => p.feedback!(item, answer) : null);

  const start = (step: PathStep) => {
    if (!course || step.state === 'locked' || run) return;
    const node = step.node;
    if (node.kind === 'chest') {
      const gems = openChest(node);
      if (gems > 0) setNotice(`Du hast ${gems} Gems gefunden.`);
      return;
    }
    if (isMaterial) {
      const entry = library.entries.find((e) => e.course.id === course.id);
      const lesson = entry && MaterialCourse.lesson(node, entry.unit);
      if (!lesson) return;
      startRound({
        id: newSessionID(), courseID: course.id, kind: node.kind, node, completes: true,
        content: { type: 'cards', cards: lesson.cards, dueKeys: LearnPath.dueKeys(lesson.cards, Date.now()), deck: library.snapshots, distractors },
      });
    } else if (provider) {
      const exercises = lessonExercises(provider, node, randomSeed());
      if (exercises.length === 0) return;
      beginNode(course.id, node);
      startRound({ id: newSessionID(), courseID: course.id, kind: node.kind, node, completes: true, content: { type: 'course', lessonID: node.id, exercises, coach: coachOf(provider) } });
    }
  };

  const startPractice = (targets: string[]) => {
    if (run || !course || !provider) return;
    const exercises = SkillPractice.exercises(provider, skillMapOf(provider), targets, skills, randomSeed());
    if (exercises.length === 0) {
      setNotice('Dazu gibt es gerade nichts zu üben.');
      return;
    }
    startRound({ id: newSessionID(), courseID: course.id, kind: 'practice', node: null, completes: false, content: { type: 'course', lessonID: `practice.${course.id}`, exercises, coach: coachOf(provider) } });
  };

  const testOutOf = (unit: CourseUnit): (() => void) | null => {
    if (!course || !provider) return null;
    const units = CoursePath.units(course, completed);
    const node = unit.nodes.find((n) => n.kind === 'checkpoint');
    if (TestOut.candidate(units)?.unit.id !== unit.id || !node) return null;
    return () => {
      if (run) return;
      const exercises = lessonExercises(provider, node, randomSeed());
      if (exercises.length === 0) return;
      startRound({ id: newSessionID(), courseID: course.id, kind: 'checkpoint', node, completes: false, testOut: unit, content: { type: 'course', lessonID: node.id, exercises, coach: coachOf(provider) } });
    };
  };

  const finish = (result: Parameters<typeof finishRound>[0]) =>
    finishRound(result, {
      courseID: run!.courseID, nodeKind: run!.kind, node: run!.node, completes: run!.completes, testOut: run!.testOut,
      dueKeys: run!.content.type === 'cards' ? run!.content.dueKeys : undefined,
    });

  const canGenerate = settings.selection.provider === 'custom' || settings.providersWithKey.includes(settings.selection.provider);
  const message = generating.state.type === 'running' ? `Pip liest das Material: Abschnitt ${generating.state.done} von ${generating.state.total}` : generating.state.type === 'idle' ? '' : generating.state.text;

  const picker = showCourses && (
    <CoursePicker
      courses={shipped}
      materials={materialRows(library, materials)}
      selectedID={course?.id ?? ''}
      fraction={(id) => { const c = shipped.find((x) => x.id === id) ?? library.entries.find((e) => e.course.id === id)?.course; return c ? CoursePath.fraction(c, completed) : 0; }}
      xp={(id) => progress.xpInCourse(id)}
      canGenerate={canGenerate}
      generatingID={generating.busyID}
      message={message}
      onSelect={(id) => setCourse(id)}
      onCreate={(id) => void generateCards(id)}
      onLibrary={() => ui.set({ tab: 'library' })}
      onClose={() => { setShowCourses(false); dismissGeneratorMessage(); }}
    />
  );

  const skillRows = (p: CourseProvider): SkillRow[] => {
    const map = skillMapOf(p);
    const statusOf = (skill: Skill) => SkillAssessor.status(skills[skill.id], skill, completed, now, localCalendar);
    return map.skills.map((skill) => {
      const state = statusOf(skill);
      const waiting = skill.prerequisites.map((id) => map.skill(id)).filter((s): s is Skill => !!s).filter((s) => !['provisional', 'mastered', 'due'].includes(statusOf(s))).map((s) => `${s.title} (Einheit ${s.unitNumber})`);
      const reasons = state === 'mastered' ? [] : state === 'due' ? ['Die Wiederholung ist fällig, damit du es nicht vergisst.'] : SkillAssessor.missing(skills[skill.id] ?? emptyRecord(), skill);
      return { skill, status: state, reasons, waitingFor: waiting };
    });
  };

  const content = () => {
    if (mode === 'practice') return <Review />;
    if (mode === 'quests') return <QuestsView board={quests} gems={progress.gems} freezes={progress.freezes} />;
    if (!course) return <NoCourse onPick={() => setShowCourses(true)} />;
    if (mode === 'skills') return <SkillsView courseTitle={course.title} rows={provider ? skillRows(provider) : []} onPractice={(row) => startPractice([row.skill.id])} />;
    const units = CoursePath.units(course, completed);
    const map = provider ? skillMapOf(provider) : null;
    const advice = provider && map ? recommend(map, skills, units, completed, now, localCalendar) : null;
    const mastery = provider && map ? PathMastery.from(map, skills, completed, now, localCalendar) : null;
    const follow = () => {
      if (!advice) return;
      if (advice.kind === 'step' && advice.step) start(advice.step);
      else if (advice.kind === 'review' || advice.kind === 'practice') startPractice(advice.skillIDs);
    };
    return (
      <PathView
        course={course} units={units} advice={advice} mastery={mastery}
        tiles={{ questsDone: quests.dailyDone, questsTotal: quests.daily.length, weekText: quests.weekly ? `${Math.min(quests.weekly.progress, quests.weekly.target)} von ${quests.weekly.target}` : '', hasUnclaimed: quests.hasUnclaimed }}
        onStep={start} onTip={setTipUnit} onQuests={() => setMode('quests')} onAdvice={follow} onSkills={() => setMode('skills')}
        footer={<button className="btn outline" onClick={() => setShowCourses(true)}>Anderen Kurs wählen</button>}
      />
    );
  };

  const xpToday = progress.xpTodayAt(now, localCalendar);
  const streak = progress.currentStreak(now, localCalendar);
  const goal = progress.dailyGoal;

  return (
    <div className="ln-page">
      <div className="ln-stats">
        <button className="ln-chip" onClick={() => setShowCourses(true)} aria-label={course ? `Kurs ${course.title}, ${progress.xpInCourse(course.id)} XP. Kurs wechseln` : 'Kurs wählen'}>
          <span className="ln-chip-icon" style={{ background: course ? tint(course) : 'var(--accent)', color: course ? onTint(course) : 'var(--on-accent)' }}><Glyph name={course ? courseGlyph(course.symbol) : 'grid'} size={16} stroke={2.3} /></span>
          <strong>{course ? progress.xpInCourse(course.id) : 0} XP</strong>
        </button>
        <button className="ln-chip" onClick={() => setShowStreak(true)} aria-label={`Serie: ${streak} ${streak === 1 ? 'Tag' : 'Tage'}. Öffnet die Serie`}>
          <span style={{ color: streak > 0 ? 'var(--accent)' : 'var(--hint)' }}><Glyph name="flame" size={18} fill /></span><span className="muted">Serie</span><strong>{streak}</strong>
        </button>
        <button className="ln-chip" onClick={() => setShowGoal(true)} aria-label={`Tagesziel: ${xpToday} von ${goal} XP. Ändern`}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="8.5" fill="none" stroke="var(--line2)" strokeWidth="3" /><circle cx="11" cy="11" r="8.5" fill="none" stroke={xpToday >= goal ? 'var(--link)' : 'var(--accent)'} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${goalFraction(xpToday, goal) * 53.4} 53.4`} transform="rotate(-90 11 11)" /></svg>
          <span className="muted">Heute</span><strong>{Math.min(xpToday, 999)}/{goal}</strong>
        </button>
        <span className="grow" />
        <Pills items={modes} value={mode} onChange={setMode} />
      </div>
      <div className="ln-content">{content()}</div>
      {run && <LessonScreen key={run.id} run={run} onFinish={finish} onClose={() => setRun(null)} />}
      {picker}
      {showStreak && <StreakSheet days={streak} longest={progress.longestStreak} gems={progress.gems} freezes={progress.freezes} onClose={() => setShowStreak(false)} />}
      {showGoal && <GoalSheet goal={goal} onClose={() => setShowGoal(false)} />}
      {tipUnit && <UnitTipSheet unit={tipUnit} onTestOut={testOutOf(tipUnit)} onClose={() => setTipUnit(null)} />}
      {notice && <NoticeDialog text={notice} onClose={() => setNotice(null)} />}
    </div>
  );
}

function NoticeDialog({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <Dialog onClose={onClose}>
      <NoticeBody text={text} />
    </Dialog>
  );
}

function NoticeBody({ text }: { text: string }) {
  const close = useDialogClose();
  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="ln-caption">Pip</div>
      <div>{text}</div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" autoFocus onClick={close}>Weiter</button></div>
    </div>
  );
}

function NoCourse({ onPick }: { onPick: () => void }) {
  return (
    <div className="ln-nocourse">
      <PipLogo pixel={6} />
      <h2 className="ln-big" style={{ margin: 0 }}>Such dir einen Kurs aus</h2>
      <p className="muted" style={{ margin: 0, maxWidth: 440, textAlign: 'center' }}>Sprachen, Mathe, Schach, Musik oder dein eigenes Material: Pip macht daraus kurze Lektionen mit XP, Serie und Quests.</p>
      <button className="btn" onClick={onPick}>Kurs wählen</button>
    </div>
  );
}

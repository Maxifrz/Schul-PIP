import { localCalendar } from '../lib/learn/calendar';
import { CardSnapshot, snapshot } from '../lib/learn/cards';
import { providerFor } from '../lib/learn/catalog';
import { CourseNode, CoursePath } from '../lib/learn/course';
import { LearnProgress } from '../lib/learn/progress';
import { QuestBoard, QuestEvent, bonusID, questTitle } from '../lib/learn/quests';
import { LessonRewards, noRewards } from '../lib/learn/lessonModel';
import { LessonResult, gradesToApply } from '../lib/learn/session';
import { SkillAssessor, SkillRecords, decodeRecords, skillMapOf } from '../lib/learn/skills';
import { TestOut } from '../lib/learn/advisor';
import type { CourseUnit } from '../lib/learn/course';
import { Card, applyGrade } from '../lib/review';
import { cardStore, updateCard } from './app';
import { createStore, persist } from './createStore';

/** The card as plain values for the Lernen tab. */
export const cardSnapshot = (card: Card): CardSnapshot => snapshot(card.front, card.back, card.materialID ?? null, card.createdAt, card.dueAt);

export type LearnMode = 'path' | 'skills' | 'quests' | 'practice';

/** The Lernen tab's state: progress, quests, skills, the model's wrong answers and which course and view are open. Each part is replaced, never changed in place, so the screens see it change. */
export const learn = createStore({
  progress: new LearnProgress(),
  quests: new QuestBoard(),
  skills: {} as SkillRecords,
  distractors: {} as Record<string, string[]>,
  courseID: '',
  mode: 'path' as LearnMode,
});

let started = false;

export async function startLearn(): Promise<void> {
  if (started) return;
  started = true;
  await persist(
    learn,
    'learn',
    (s) => ({ progress: s.progress, quests: s.quests, skills: { records: s.skills }, distractors: s.distractors, courseID: s.courseID, mode: s.mode }),
    (stored, s) => {
      const data = (stored ?? {}) as Record<string, unknown>;
      const modes: LearnMode[] = ['path', 'skills', 'quests', 'practice'];
      const distractors: Record<string, string[]> = {};
      if (typeof data.distractors === 'object' && data.distractors !== null) {
        for (const [key, value] of Object.entries(data.distractors)) {
          if (Array.isArray(value)) distractors[key] = value.filter((v): v is string => typeof v === 'string');
        }
      }
      return {
        ...s,
        progress: LearnProgress.fromJSON(data.progress),
        quests: QuestBoard.fromJSON(data.quests),
        skills: decodeRecords(data.skills),
        distractors,
        courseID: typeof data.courseID === 'string' ? data.courseID : '',
        mode: modes.includes(data.mode as LearnMode) ? (data.mode as LearnMode) : 'path',
      };
    },
  );
  refreshQuests();
}

export const setCourse = (courseID: string) => learn.set({ courseID, mode: 'path' });
export const setMode = (mode: LearnMode) => learn.set({ mode });

export function refreshQuests(now = Date.now()): void {
  const board = learn.get().quests.clone();
  board.refresh(now, localCalendar);
  if (JSON.stringify(board.toJSON()) !== JSON.stringify(learn.get().quests.toJSON())) learn.set({ quests: board });
}

export function setGoal(goal: number): void {
  const progress = learn.get().progress.clone();
  progress.setDailyGoal(goal);
  learn.set({ progress });
}

export function buyFreeze(): boolean {
  const progress = learn.get().progress.clone();
  if (!progress.buyFreeze()) return false;
  learn.set({ progress });
  return true;
}

/** Opens a chest once and pays its gems; false if it was open already. */
export function openChest(node: CourseNode): number {
  const gems = CoursePath.chestGems(node);
  const progress = learn.get().progress.clone();
  if (!progress.openChest(node.id, gems)) return 0;
  learn.set({ progress });
  return gems;
}

/** Claims a quest (or the day's bonus) and pays its gems. */
export function claimQuest(id: string): number {
  const quests = learn.get().quests.clone();
  const gems = id === bonusID ? quests.claimBonus() : quests.claim(id);
  if (gems <= 0) return 0;
  const progress = learn.get().progress.clone();
  progress.addGems(gems);
  learn.set({ quests, progress });
  return gems;
}

/** A step of a shipped course was opened. */
export function beginNode(courseID: string, node: CourseNode): void {
  const provider = providerFor(courseID);
  if (!provider) return;
  const skills = structuredClone(learn.get().skills);
  SkillAssessor.begin(node, skillMapOf(provider), skills);
  learn.set({ skills });
}

export interface RoundInfo {
  courseID: string;
  nodeKind: CourseNode['kind'];
  /** The step the round belongs to; null for a round on chosen goals. */
  node: CourseNode | null;
  /** Whether finishing it marks the step as done. */
  completes: boolean;
  /** The unit whose test this is, for skipping it. */
  testOut?: CourseUnit;
  /** For a round of the student's own cards: which of them were due when it started. */
  dueKeys?: Set<string>;
}

/**
 * Records a finished round once (a run the store has seen before counts for nothing): XP and streak, the evidence for
 * the skills, the due cards of a material's lesson, the quests, and, for a unit test, whether the unit is skipped. What
 * it brought goes to the end screen.
 */
export function finishRound(result: LessonResult, round: RoundInfo): LessonRewards {
  const now = Date.now();
  const progress = learn.get().progress.clone();
  const reward = progress.record(result, { courseID: round.courseID, completes: round.completes, now, calendar: localCalendar });
  if (!reward) return noRewards();

  if (round.dueKeys) {
    const list = cardStore.get().list;
    for (const { key, grade } of gradesToApply(result, round.dueKeys)) {
      const original = list.find((c) => cardSnapshot(c).key === key);
      if (original) updateCard(applyGrade(original, grade, now));
    }
  }

  const provider = providerFor(round.courseID);
  let skills = learn.get().skills;
  if (provider) {
    skills = structuredClone(skills);
    SkillAssessor.record(result.outcomes, round.node, skillMapOf(provider), skills, now, localCalendar);
  }

  const notes: string[] = [];
  if (round.testOut) {
    if (TestOut.passed(result)) {
      progress.complete(TestOut.nodesToComplete(round.testOut));
      notes.push(`Einheit übersprungen: ${round.testOut.title}. Als Fähigkeit zählt nur, was der Test gezeigt hat.`);
    } else {
      notes.push('Für das Überspringen brauchst du 85 % richtig, ohne Hilfe. Lern die Einheit jetzt Schritt für Schritt.');
    }
  }

  const quests = learn.get().quests.clone();
  const event: QuestEvent = { xp: reward.xp, courseID: round.courseID, nodeKind: round.nodeKind, rightFirstTry: result.rightFirstTry, exerciseCount: result.exerciseCount };
  const finished = quests.apply(event, now, localCalendar);

  learn.set({ progress, skills, quests });
  return { gems: reward.gems, quests: finished.map(questTitle), freezesUsed: reward.freezesUsed, streakExtended: reward.streakExtended, notes };
}

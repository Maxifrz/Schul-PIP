# Learn: the logic core of the Lernen tab

Plain TypeScript, no React, no clock, no `Math.random`. A port of the Foundation-only Swift code in
`Lernwerk/Services/Learn/` (the Swift code is the specification; the names are the Swift names in camelCase). Courses
(languages, chess, maths, music) are added later by registering a provider.

## Module map

| File | Swift source | What |
| --- | --- | --- |
| `random.ts` | `SplitMix`, `LearnRandom` | SplitMix64 and the Swift stdlib routines on top (bounded ints, `shuffle`, `randomElement`, `randomDouble`). Seeds are `bigint`. |
| `day.ts` | `LearnDay`, `Calendar` calls | `LearnCalendar {timeZone, firstWeekday}`, `dayOf`, `daysTo`, `adding`, `weekStart`, `secondsUntilNextDay`, `localToMs`. |
| `numberCheck.ts` | `NumberCheck.swift` | `Rational` (bigint with int64 overflow gives `null`) and `NumberCheck.parse/matches`. |
| `music.ts`, `media.ts` | `MusicTypes.swift`, `ExerciseMedia.swift` | `Clef`, `Pitch`, `StaffSpec`, `BoardSpec`, `ToneSpec`, `ExerciseMedia`. |
| `exercise.ts`, `exerciseConstants.ts`, `exercises.ts` | `Exercise.swift`, `Exercises.swift`, constants of `ExerciseBuilder` | `LearnExercise`, `LearnAnswer`, `missedKeys`, and the `Exercises` factory (`choice`, `typed`, `bank`, `pairs`, `move`, `key`, `seed`, `arrange`, `tiles`). |
| `course.ts`, `coursePath.ts`, `audit.ts`, `catalog.ts` | `Course.swift`, `CoursePath.swift`, `CourseAudit.swift` | `Course`, `CourseProvider`, `structureProblems`, `CoursePath`, `CourseAudit`, and the provider registry. |
| `session.ts` | `LessonSession.swift` | `LessonSession`, `LessonResult`, `LessonGrading`. |
| `lessonController.ts` | `LessonModel.swift`, `LearnHomeView.swift` | `LessonModel` (drafts, tiles, pairs, chess squares, coach) and `LearnController` (start a step, practice round, test-out, chest, `finish` = record into progress, skills and quests). |
| `progress.ts` | `LearnProgress.swift` | `LearnProgress`: XP, goal, streak, freezes, gems, `record`, `openChest`, `complete`, `buyFreeze`. |
| `quests.ts` | `QuestBoard.swift` | `QuestBoard`: the same SplitMix selection of daily and weekly quests, `apply`, `claim`, `claimBonus`, `refresh`. |
| `skills/skill.ts` | `Skill.swift` | `CompetenceLevel`, `SkillFacet`, `SkillMap`, and the defaults of a provider (`skillFacets`, `skillTag`, `feedback`, `lessonExercises`, `skillMap`). |
| `skills/assessor.ts` | `SkillAssessor.swift` | `SkillRecord`, `SkillAssessor` (all constants, statuses, the `missing()` sentences). |
| `skills/advisor.ts` | `SkillAdvisor.swift` | `SkillAdvisor.recommend`, `SkillPractice`, `TestOut`. |
| `store.ts` | the three `*Store` classes, `SkillStore.swift` | `KeyValueStore`, `LearnProgressStore`, `QuestStore`, `SkillStore`, `SkillMaps`. |
| `decode.ts`, `util.ts` | | Tolerant JSON decoding helpers, `deepEqual`. |

Everything is exported from `index.ts`.

## Time, zone and random are injected

* **Time** is an epoch in milliseconds (`now: number`) passed into every call that needs it (`progress.record(result, {now,
  calendar})`, `quests.apply(event, now, calendar)`, `SkillAssessor.status(..., now, calendar)`). The UI reads
  `Date.now()` and passes it; the controller takes a `clock: () => number`.
* **Zone** is a `LearnCalendar {timeZone: 'Europe/Berlin', firstWeekday: 2}` (IANA name, Foundation numbering: 1 = Sunday,
  2 = Monday). A day is the civil date in that zone (via `Intl.DateTimeFormat`), so daylight saving time, zone changes and
  dates that go backwards behave as in the Swift tests. `localToMs(calendar, y, m, d, h, mi)` turns a wall-clock time
  into an instant (for tests and for the quest timer).
* **Random**: `LearnRandom(seed: bigint)` is the only generator. `Exercises.choice/bank/pairs` take it as the last
  argument. `LearnController` takes `newSeed: () => bigint`; the UI supplies a random one.

## Persistence

`KeyValueStore {get(key): string | null; set(key, value)}`, e.g. `webStore(localStorage)` or `MemoryStore`. The JSON has
the Swift Codable field names, so a save can move between the apps.

| Class | Key |
| --- | --- |
| `LearnProgressStore` | `learn.progress` |
| `QuestStore` | `learn.quests` |
| `SkillStore` | `learn.skills` |

Decoding is tolerant (`LearnProgress.fromJSON`, `QuestBoard.fromJSON`, `SkillProgress.fromJSON`): a missing, null or
wrongly typed field takes its default, broken JSON gives an empty state. Sets are written as sorted arrays.

## Tests

`desktop/test/learn/`: ports of the Swift tests (same inputs and expectations) plus two differential tests against the Swift code
(`parity.test.ts`, `factoryParity.test.ts`; their fixtures are written by the Swift programs next to them in
`fixtures/*.swift.txt`), the random fixture (`content/fixtures/random.json`) and the quests fixture
(`content/fixtures/quests.json`).

## Not ported

The card-based lessons (`ExerciseBuilder`, `LearnPath`, `DistractorService`, `Material*`, `CardSnapshot`) and the grading of
due cards. Known limitation: `daysTo` and `adding` use civil-date arithmetic; Foundation differs only in a zone that skipped
a whole calendar day (Samoa, 30 December 2011).

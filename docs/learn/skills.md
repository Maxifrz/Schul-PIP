# Skills: learning goals, mastery and what to practise next

The Lernen tab used to know one thing about a student: which steps of a path were finished. Finishing a lesson says
that the exercises were worked through, not that the goal behind them is known. This layer adds the missing half:
**goals with prerequisites**, **evidence per goal**, a **status that only answers can raise**, **spaced review** of
what was reached, and **advice** on what to do next. XP, streak, gems and quests stay as they were and are separate
from it.

Code: `Lernwerk/Services/Learn/Skills/` (Foundation only, tested on Linux), screens in
`Lernwerk/Views/Review/Learn/SkillViews.swift` and `LearnHomeView.swift`.

## The model

* **Skill** (a Lernziel): `unit id + "." + facet key`, e.g. `es.u03.vocab`, `chess.u07.board`. Ids are stable; progress
  is stored by id. A skill has a title, a goal sentence, the **levels** its exercises have, **prerequisites** (other
  skills) and the steps of its unit that show evidence of it.
* **Facet**: what a course declares for a unit (`CourseProvider.skillFacets(of:)`). The default is one skill per unit,
  which the maths, music and any new course get for free. Engines override it.
* **Level** (`CompetenceLevel`): *recognise* (pick the answer), *recall* (produce it from memory), *apply* (use it:
  build a sentence, find a move). Every exercise carries its skill and level (`LearnExercise.skill/level`, set by
  `CourseProvider.lessonExercises` from `skillTag(for:node:)`; a tag for a facet the unit does not declare is dropped).
* **SkillMap**: the skills of a course; `problems()` rejects duplicate ids, unknown or circular prerequisites, skills
  without levels or steps. Every shipped course has a sound map (test).

### Language courses (`LanguageSkills.swift`)

Per unit, as far as the unit has the material: **Wortschatz** (recognise, recall; both directions where the course
types), **Sätze und Satzbau** (recognise, apply: tiles, translating), **Grammatik** (recognise, apply: forms, fills,
rules), **Hören** (recognise a heard word, apply: type a heard sentence; only with a voice). `sentences`, `grammar` and
`listening` build on `vocab` of the same unit; `vocab` builds on `vocab` of the unit before. The tag comes from the
engine's own exercise ids, so it is exact.

### Chess (`ChessSkills.swift`)

Per unit two goals, so that knowing is not mistaken for doing: **Wissen** (names, counting, judging; recognise, recall)
and **Am Brett** (find the move; apply), the second building on the first. Unit 4 has nothing typed, so its "Wissen"
asks for recognising only.

## Status

`SkillStatus`: *notStarted*, *started* (a lesson opened), *worked* (a step finished: this is all that finishing a
lesson gives), *practicing*, *provisional* (criteria met once), *mastered*, *due* (reached before, review due).

Evidence per answer (`SkillAssessor`): only the **first attempt** of an exercise counts; a retry changes nothing. Points
for a right answer: recognise 1, recall 2, apply 2, **half** if a hint was shown, none if wrong.

* *practicing*: at least 4 points.
* *provisional* (criteria): at least 8 attempts and 8 points, where recognising counts for at most 4 points if the skill
  also asks for typing or applying (10 if it does not); **at least 2 points at every higher level the skill declares**;
  and 75 % of the last 10 answers right without a hint.
* one round adds at most 12 points to a skill, and an exercise counts once per round.
* *mastered*: provisional **and** a good day (at least 85 % right without help, at least 3 answers) on a **later day**,
  with the recent answers still at 75 %.
* *due*: the spaced review of a reached skill is due. Reviews reuse SM-2 (`SpacedRepetition`): one step per skill and
  day, worked out from all of that day's answers (a day with fewer than 3 answers for the skill takes no step; a second
  round the same day adds evidence but does not push the review away). A bad day (under 60 %) is a lapse: confirmations
  and "reached" are lost until earned again.

So clicking through easy choices never reaches a skill that asks for typing or applying (tested), a single day never
masters anything (tested), and a student who answers everything right masters every goal of every language and the
chess course within a few days of path plus the practice rounds the advice suggests (tested for all six).

`SkillAssessor.missing` turns the gap into sentences ("Du hast noch zu wenig aus dem Kopf getippt, ohne Auswahl."), which
the skills screen shows.

## What the student sees

* **Advice card** on the path (`SkillAdvisor.recommend`): 1. a review that is due, the longest overdue first; 2. a shaky
  prerequisite of the next unit; 3. a goal of a finished unit that went badly; 4. the next step; 5. "Kurs geschafft".
  Nothing is locked by it: the path keeps its order, and the advice says when another round helps more.
* **Fähigkeiten** sheet: every goal by unit with status, goal sentence, what it builds on, what is missing, and a button
  "Gezielt üben" / "Jetzt wiederholen".
* **Gezielt üben** (`SkillPractice`): a round of up to 10 exercises of the chosen goals, drawn from the unit's steps with a
  seeded generator; levels the student answers badly or never met are drawn about three times as often as ones answered
  well. A goal with few exercises gets company from the same unit. A round on chosen goals earns XP and counts for the
  quests, and marks no step as done (`LearnProgress.record(completes: false)`).
* **Einheit überspringen**: the first unit that is untouched can be skipped by passing its test (at least 10 exercises,
  85 % right on the first try). The steps count as worked; the goals are credited only with what the test showed.
* **Hints** (`LearnExercise.hints`, shown one by one): chess move exercises get two, computed from the goal and the
  engine's accepted moves ("Suche Züge, die Schach bieten …", "Es zieht die Figur auf g1."). A hint halves the points of
  that answer.
* **Why a move fails** (`ChessCoach`, via `CourseProvider.feedback`): not your piece, no piece there, the way is blocked,
  own piece on the square, the move would leave the king in check, you are in check and this does not end it, the move
  gives check but the opponent can defend (with an example), it takes nothing, the captured piece is covered. Every
  sentence is derived from the position by the move generator; a test runs the coach over wrong moves of every move
  exercise in the lessons.
* **Typed answers in a language** (`LanguageAnswerAdvice`): right word with the wrong ending, right words in the wrong
  order, a word missing or too many. Only for strict answers the check rejected, and only when it is sure.

## Persistence and migration

`SkillStore` keeps one JSON value in UserDefaults (`learn.skills`), decoded tolerantly: missing fields take their
defaults, a broken value starts empty, records of skills that no longer exist are never read. Nothing in SwiftData
changed. Steps finished before this layer existed show their goals as *worked* (a finished lesson), never as more;
the student earns the rest with answers. A run is counted once (the run id is remembered by the progress store, and
skills are only recorded for a run it accepted).

## Finished, prepared, not done

Finished: everything above for the six practising courses (Spanisch, Französisch, Latein, Deutsch als Fremdsprache,
Deutsch, Schach); the default one-goal-per-unit model for maths and music (levels from exercise kinds, test-out,
advice and practice work; they have no hints or coaching); persistence, tests, screens.

Prepared: a new subject only needs `skillFacets`, `skillTag` and optionally `feedback`; chess goals are an enum
(`ChessGoal`) the coach reads, so a different goal, or an analysis engine behind `.bestMove`, plugs in without touching
the core. Curated chess positions are computed by the in-house move generator and a material search (`depth` in
`.bestMove`); it does not judge positions it was not asked about.

Not done, and why:
* **Reading comprehension, dialogues, writing free text** in the language courses: the engine has no text or dialogue
  item; a free answer cannot be checked without a model, and the app must work offline.
* **Pronunciation by microphone**: needs microphone and speech-recognition permissions and a recogniser, and cannot be
  verified here; listening and speaking aloud are covered by speech output and typing what was heard.
* **Chess content beyond tactics**: opening principles, king safety in the middlegame, basic endgames, strategy,
  analysing a game and giving reasons are not in the course yet; the lines of the map are there to add them to.
* **Cards and "Mein Material"** keep their own SM-2 schedule per card and have no skill map.
* iOS only, like the rest of the Lernen tab.

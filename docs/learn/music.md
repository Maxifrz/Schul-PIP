# Course: Musik (id `music`)

Provider: `MusicCourse.provider` (`Lernwerk/Services/Learn/Music/`). Title "Musik", subtitle "Noten lesen, hören, verstehen",
kind `.music`, color 0x9E6B8E, symbol `music.note`.

## Scope and level

Notenlehre as taught in German Gymnasium classes 5 to 8 and in the first grades of a graded theory syllabus: reading the treble and
bass clef, note and rest values, accidentals, major scales up to two signs and natural minor, diatonic intervals up to the octave,
major and minor triads, key signatures and the circle of fifths. No harmony beyond triads, no dotted notes, triplets, tempo or
dynamics terms, no harmonic minor scale in the exercises (the theory code supports it and is tested).

Every note name, interval, scale and chord that an exercise shows is computed by the theory code (`MusicTheory.swift`,
`MusicHarmony.swift`, `MusicRhythm.swift`) from letter distance plus half steps, so spelling is correct by construction. The tests then
re-check the exercises against hand-written tables.

## Units

Eight units, three lessons, a practice round, a checkpoint and a chest each. Lessons have 10 to 12 exercises, checkpoints 14.
Practice rounds of units 2 to 8 end with questions from earlier units.

1. **Notenlinien und Violinschlüssel**: five lines, counting from below, G clef, notes C4 to A5 with ledger lines. Staff reading,
   typed note names, position matching (note to "2. Linie"), ordering note names for a short melody, term pairs.
2. **Bassschlüssel und Klaviatur**: F clef, bass notes E2 to C4, the same position in both clefs ("compare"), the piano keyboard,
   octave names (große, kleine, eingestrichene Oktave). Piano key exercises: "Tippe das eingestrichene c" (exactly MIDI 60), "Tippe ein
   F" (every F of the keyboard), "Tippe diese Note" (from a staff).
3. **Notenwerte und Pausen**: whole to sixteenth notes and rests, beats in 4/4, ratios ("Wie viele Achtelnoten passen in eine Halbe
   Note"), ordering by length, filling a 4/4 or 3/4 bar, counting the beats of a bar.
4. **Vorzeichen**: Kreuz, Be, Auflösungszeichen, names with -is and -es (Es, As, B), black keys, Halbton and Ganzton (also by ear),
   enharmonic pairs (Cis/Des ...), raising and lowering typed.
5. **Tonleitern**: step pattern, C-, G-, F-, D-, B-Dur, natural A-, E-, D-Moll, "which tone is missing", n-th degree typed, building
   a scale from tiles, signs of each scale, Dur or Moll.
6. **Intervalle**: counting both notes, names with quality, half steps per interval, building intervals above a note (letters first,
   then sign), inversion, ordering by size, hearing intervals.
7. **Dreiklänge**: Dur and Moll triads (root, third, fifth), reading a chord on the staff, building from tiles, missing tone, typed
   third and fifth, hearing Dur against Moll.
8. **Tonarten und Quintenzirkel**: reading a key signature (up to four signs), a note under a key signature, order of sharps and flats,
   key of n sharps or flats, fifth up or down in the circle, relative minor and major (Paralleltonart).

Rough content size: about 95 exercise templates (plus about 70 fixed questions), and about 2000 distinct exercises over 20 seeds.

## Exercise forms and rules

Only `StaffSpec`, `ToneSpec` and the exercise kinds multiple choice, piano key, typed answer, word bank and pairs are used.

- Ear exercises (units 4, 6, 7) play only what the lessons so far have named: halftone or whole tone in unit 4 (from lesson 2 on);
  in unit 6 lesson 2 {große Sekunde, kleine/große Terz, Quarte, Quinte, Oktave}, lesson 3 adds sixths and sevenths; the tritone is
  never played. Unit 7 plays Dur and Moll triads together, never in lesson 1 (only Dur is known there).
- Wrong options come from the material: neighbouring letters, the same letter with another sign, the note's reading in the other
  clef, the other quality of an interval, the inverted interval, a neighbouring key. A wrong option never sounds like the right
  answer (tested). Before unit 4 no wrong option has a sign.
- Typed note names are compared letter by letter (`AnswerMode.exact`), capitals do not matter: "cis" and "Cis" are right, a neighbour
  is wrong. Typed interval names accept the plain size for the pure intervals ("Quinte" for "reine Quinte"). Typed beat counts
  accept "1/2", "0,5" and "0.5".
- German note names follow the German convention: B is H flat, H is the natural. Minor keys are written with a capital:
  "Fis-Moll", "A-Moll".
- Seeds change the pitches, the intervals and the order. The same seed gives the same exercises.

## Sources

Research was done with web searches (no page was copied; the facts used are standard theory):

- Bavarian LehrplanPLUS Gymnasium Musik Jahrgangsstufe 5, https://www.lehrplanplus.bayern.de/fachlehrplan/gymnasium/5/musik:
  clefs, note and rest values to the sixteenth, major scales, whole and half steps, diatonic intervals, sharps/flats/naturals, the
  basic major triad. Used for the scope and the order of units 1 to 7. (Only the search summary of the page was read; the full
  curriculum text was not opened.)
- Musisches Gymnasium Grundwissen Musik (Camerloher-Gymnasium, Stand 2024),
  https://www.camerloher-gymnasium.de/download_file/view/96167d6d-18be-443e-bd0a-6a5ae773d47b/307: diatonic intervals (rein, groß,
  klein). Used for the interval naming. (Search summary only.)
- Lehrplan Musik 5/6 (oegym.de), https://oegym.de/lehrplan_musik: Notenlehre, major scales, circle of fifths, intervals, triads,
  time signatures. Used for the order scales, intervals, triads, circle of fifths. (Search summary only; the document is from 2004.)
- Rudolf-Hildebrand-Schule Lehrplan Musiklehre 5 bis 12, https://www.rudolf-hildebrand-schule.de/assets/downloads/Musiklehre%20Lehrplan%205-12.pdf:
  note names, octave ranges, accidentals, intervals up to the octave, major scale in grade 5. (Search summary only.)
- ABRSM Music Theory Grades 1 and 2 as described on third-party course pages (https://mymusictheory.com/exam-boards/abrsm/abrsm-grade-2-music-theory):
  Grade 1 clefs, note values, key signatures and scales of C, G, D and F major, tonic triads; Grade 2 adds B flat and E flat major,
  A, E, D minor, intervals by number. Used for the choice of keys (C, G, F, D, B; A, E, D minor) and the grading of topics. These are
  not the official ABRSM syllabus, which was not read.

## Design decisions

- Theory first: the facts are computed, not typed in, wherever a rule exists (spelling by letter distance, circle of fifths, triads).
  Fixed questions (about 70) are the only hand-written facts.
- Staff exercises never use rests as decoration except in unit 8, where a whole rest carries the key signature so that nothing
  gives the key away.
- Wording "Be" for flats is used for all numbers ("3 Be").
- Chords on the staff are drawn with `chord: true`; intervals as two notes one after the other.
- Ids are built from the content (e.g. `music.u06.name.C4.E4`), cards are the items (e.g. `music.note.treble.G4`) so that a
  missed note is practised again in the next rounds.

## Known limits

- The course expects the staff drawing to show accidentals from the pitch's alteration and the key signature (as `StaffDrawingRules`
  does), and a whole rest on a staff with a key signature (unit 8).
- No inversions of triads, no diminished or augmented triads, no harmonic minor, no alto clef in exercises.
- Piano key answers list every key of the 88-key range (21 to 108); a keyboard drawn with fewer keys simply cannot tap the others.
- Hearing intervals needs the tone player to play two notes one after the other and a triad together; not tested here.

## What a teacher should double-check

- Octave names in the keyboard unit: C2 "große Oktave", C3 "kleine Oktave", C4 "eingestrichene Oktave" (c1), and the lower-case
  writing "das eingestrichene c" in prompts.
- "B" for H flat in the options and in the key signature order (B, Es, As, Des, Ges, Ces, Fes).
- The wording of the pure/large/small interval names (the pure ones are accepted without "rein" when typed).
- Plural "Be" in "2 Be", "3 Be".
- Tip in unit 6: "Alle meine Entchen" begins with seconds upward and "O Tannenbaum" with an upward fourth (from memory, not verified
  against a score).
- Paralleltonart used for the relative minor/major; minor keys written with a capital letter (Fis-Moll) as the task asked, many
  school books write them in lower case (fis-Moll).
- The fact that a Vorzeichen holds until the end of the bar for the same pitch (stated in unit 4 as "bis zum Ende des Taktes").
- The statement "Das C liegt links neben der Gruppe aus zwei schwarzen Tasten" and the other key-finding hints.

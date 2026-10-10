# Mathe Mittelstufe (course id `mathm`)

Provider: `MathMiddleCourse.provider`. Code: `Lernwerk/Services/Learn/MathMiddle/`. Tests: `LernwerkTests/MathCourseMiddle*.swift`.

## Scope and level

Klasse 5 to 10, up to the level of the Mittlerer Schulabschluss. Ten units, each with three lessons, a practice round,
a checkpoint and a chest. The course is a problem generator, not a fixed list: every unit has 9 to 11 problem templates
(103 in total) that draw numbers from a seeded generator (`LearnRandom`) at three levels.

- Lesson 1 asks at level 1, lesson 2 at level 2, lesson 3 at level 3. Lessons 2 and 3 start with a review of the earlier lessons.
- Practice mixes the levels and takes four of ten problems from earlier units.
- The checkpoint asks every template of the unit at level 3.
- A lesson has 10 exercises, a checkpoint 12. The same seed gives the same exercises.

All right answers are computed exactly with `Rational` (via the wrapper `MathMiddleQ`, which marks a division by zero or
an overflow as invalid so such a draw is dropped). No floating point is used for an answer. Numbers are chosen so that
results are whole numbers, simple fractions or terminating decimals.

## Units and sample items

1. Brüche verstehen: part of a quantity, mixed numbers, expanding, reducing, comparing. Example: "Kürze 18/24" (typed answers must be fully reduced and the prompt says so).
2. Bruchrechnung: + − · : with common denominators, with unlike denominators, mixed numbers, order of operations.
3. Dezimalzahlen und Prozent: conversions, Prozentwert, Grundwert, Prozentsatz, Zu- und Abnahme, Mehrwertsteuer.
4. Terme und lineare Gleichungen: evaluating, collecting terms, brackets, equivalence transformations, checking a solution.
5. Dreisatz und Proportionalität: proportional and antiproportional, Dreisatz, Maßstab, Verhältnisse.
6. Lineare Funktionen: slope, y-intercept, zero, line through two points, point test, parallel lines.
7. Potenzen und Wurzeln: laws of powers, negative exponents, squares, roots, powers of ten.
8. Geometrie: perimeter, area, volume, angle sums, circle, Pythagoras and its converse, units.
9. Quadratische Gleichungen und Funktionen: vertex form, shifts, function values, extremum, x² = c, factored form, zeros from vertex form, pq-formula, discriminant, dividing by the leading coefficient, vertex from the normal form.
10. Wahrscheinlichkeit: Laplace on dice and bags, relative frequency, what a probability can be, Gegenereignis, two dice, expected counts, tree diagrams with and without replacement, the sum rule over two paths, "mindestens einmal".

## Exercise forms

Multiple choice, a round of matching pairs, and typed answers (`.number`, so "3/4", "0,75" and "6/8" are all accepted by
value). Where an unreduced fraction would be wrong ("Kürze vollständig") the exercise is a multiple choice or the prompt
says what is wanted. Terms and expressions are multiple choice. Typed prompts say the wanted form ("Gib das Ergebnis als
Bruch oder Dezimalzahl an."). Typed answers stay below 1000 because a German "1.250" is read as a decimal by the answer check.

Wrong options are computed from typical mistakes: adding numerators and denominators, forgetting to flip the divisor,
percent of versus percent more, sign errors, mixing up rise and run, squaring a sum, forgetting the second root,
not halving p, forgetting to replace or not to reduce the second draw, odds instead of probability, adding instead of
taking the complement. Options that equal the right answer in value are dropped automatically; options that differ only
by a sign are avoided, because the exercise factory compares letters and digits only.

## Sources

I could not open the official curricula as full texts in this environment; the web search returned only landing pages
and summaries. What I used and what it gave:

- KMK, Bildungsstandards im Fach Mathematik für den Mittleren Schulabschluss (2003/2004, newer edition 2022), as described in search results from IQB and Landesinstituten, e.g. https://www.iqb.hu-berlin.de and https://www.lis.bremen.de (Bremen Bildungsplan 2026, which cites KMK 2022). Used: the five Leitideen Zahl, Messen, Raum und Form, Funktionaler Zusammenhang, Daten und Zufall, which decide the scope (fractions and percent, geometry, functions, probability).
- Kernlehrplan Mathematik Sekundarstufe I, Nordrhein-Westfalen (https://www.lehrplannavigator.nrw.de). Not opened. Only the existence and the portal were confirmed; no topic order was taken from it.
- Rahmenlehrplan Berlin-Brandenburg Teil C Mathematik, Jahrgangsstufen 1-10, and the LISUM Planungshilfen 7 bis 10 (https://bildungsserver.berlin-brandenburg.de/...Mathematik_PH_gesamt_7bis10_2024-09-02.pdf). Found, not read in full. The idea that Zuordnungen and Funktionen belong to one Leitidee with equations was taken from the search summary.
- Rahmenpläne Mecklenburg-Vorpommern (https://bildung-mv.de, RP_MA_MR_7-10.pdf), found but not read.
- Klett Stoffverteilungspläne for Lambacher Schweizer (https://assets.klett.de), found but not read in full.

The unit order (fractions, then percent, equations, proportionality, linear functions, powers, geometry, quadratics,
probability) follows the common German Gymnasium order from my own knowledge of such curricula and school books. I did
not verify it against a table of contents. It is a deliberate simplification: in a real school year, probability and
geometry are spread over several years, and Pythagoras usually comes in Klasse 8 or 9, before the quadratic functions.

## Design decisions

- Templates are plain closures `(level, generator) -> MathMiddleProblem?`; a draw that gives ugly numbers returns nil and is drawn again.
- The builder (`MathMiddleBuilder`) plans the form per position: five choices, a round of pairs, then typed answers; `Exercises.arrange` orders easy to hard.
- A repeat of the same problem inside a node is prevented by a key of prompt and right answer.
- Each unit has a `tip` with the rules and worked examples; each exercise has an explanation and a worked solution.

## Verification

- `MathCourseMiddleTests` runs `CourseAudit` for seeds 1...20, checks determinism, node sizes, form mix, review of earlier units, and for every template at every level over seeds 1...300: no `Optional`, no ASCII operators, no minus zero, no duplicate or equal-valued wrong options, a typed answer under 1000, enough variety.
- `MathCourseMiddleUnit01Tests` to `Unit10Tests` read each prompt back and recompute the answer by another route: brute-force gcd/lcm, Double arithmetic, plugging solutions into the equation, coefficients of quadratics from three function values with the roots by the quadratic formula, ordered draws of balls by index, all 36 dice pairs, all success/failure sequences for "mindestens einmal". Wrong options must not be right by the same recomputation.
- Typed forms are tested: unreduced fractions and decimals are accepted for probabilities.

## Known limits

- Content is by templates; the variety is large but the sentences are repetitive.
- No diagrams: slope, angles and tree diagrams are described in words and numbers only.
- No exercises with irrational answers (roots are exact only for perfect squares); no graphs of functions to read.
- Percent and probability answers are never above 999 in typed form.
- Wording (Prozentwert, Grundwert, Wachstumsfaktor, Diskriminante D = (p/2)² − q) follows common school books; some Bundesländer use other names.

## What a teacher should double-check

- The unit order against the local Lehrplan (Klasse of each topic differs by Land and school type).
- Whether the discriminant is expected as b² − 4ac with the abc-formula; the course only uses the pq-formula and D = (p/2)² − q.
- The approach to the Laplace probability of two dice and of drawing without replacement (ordered draws, each ball its own outcome).
- The sample sentences in the tips, and the use of "Kugeln im Beutel" as the stock model.
- Rounding: the course avoids rounded answers entirely.

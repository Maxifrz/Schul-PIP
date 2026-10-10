# Mathe Oberstufe (course id `matho`)

Provider: `MathUpperCourse.provider` (`Lernwerk/Services/Learn/MathUpper/`). Tests: `LernwerkTests/MathCourseUpper*.swift`.

## Scope and level

A course for the Qualifikationsphase (Jahrgang 11/12, Abitur) with seven units in three sections: Analysis (units 1 to 5),
Analytische Geometrie (unit 6) and Stochastik (unit 7). Each unit has three lessons, a practice round, a checkpoint and a
chest. Lessons have 10 exercises, practice 10, the checkpoint 12. The course trains calculation and understanding of
the core techniques; it is not a full Abitur preparation (no modelling tasks, no proofs, no graphs to read).

Course data: title "Mathe Oberstufe", subtitle "Analysis, Vektoren, Stochastik", kind `.math`, color `0x5A5AA8`, symbol `function`.

## Units, topics and sample items

1. **Ableitung** - power, sum and factor rule; f'(a); slope of the tangent; tangent line asked as a number (t, or its value at another x); where the slope is m; horizontal tangent; 1/x^n and the square root as powers.
   Samples: "Berechne f'(2) für f(x) = x^3 - 2x", "Die Tangente an f bei x = 1 hat die Gleichung y = m x + t. Wie groß ist t?".
2. **Kurvendiskussion** - y-intercept, roots (quadratic, cubic with a factor x), root test, symmetry, x and y of extrema, kind of a stationary point (maximum, minimum, saddle point), inflection point, monotonicity intervals, meaning of the sign of f'.
   Samples: "Bei welchem x liegt der Hochpunkt von f(x) = 2x^3 - 6x^2 - 18x + 4?", "In welchem Bereich ist f streng monoton fallend?".
3. **Integralrechnung** - antiderivative (multiple choice with + C), definite integral, why C drops out, signed integral between roots, area between graph and x-axis (one and two lobes), rules (additivity, factor, swapped bounds, linear combination), mean value, upper limit from an integral value.
   Samples: "Berechne das Integral von (3x^2 + 2x) dx von 1 bis 3", "Wie groß ist der Flächeninhalt zwischen dem Graphen von f und der x-Achse?".
4. **e-Funktion und Logarithmus** - derivative and antiderivative of a e^(kx) (chain-rule factor), f(0) and f'(0) of mixed functions, ln/e as inverse functions, (ln x)', log_b values, the logarithm laws (statements and calculations), exponential equations with equal bases, e^(kx) = a solved exactly.
5. **Trigonometrie** - degrees and radians (both ways), exact values of sin, cos, tan including other quadrants, signs by quadrant, sin^2 + cos^2 = 1, derivative of a sin(kx) and a cos(kx), f'(x0) at multiples of pi/2, solving sin x = c, period, amplitude/maximum/minimum/midline, number of roots in [0; 2 pi], integrals of sin(kx) and cos(kx).
6. **Vektoren** - length, connecting vector, distance, midpoint, dot product, orthogonality (choice of a pair, parameter t), angle between vectors (table of exact angles), points of a line for a given t, parameter of a given point, point test, direction vector through two points.
7. **Stochastik** - Laplace (two dice, urn with and without replacement), n over k, binomial P(X = k), P(X <= k), P(X >= k), at least once, expected value (n p, table, game), standard deviation, Vierfeldertafel, conditional probability, independence, tree diagram (total probability and Bayes).

## Design decisions

- **Generators with exact arithmetic.** `UQ` is an exact fraction, `UPoly` a polynomial with fraction coefficients (evaluate, derive, integrate, print as "3x^2 - 4x + 1" with Unicode superscripts). Functions are built backwards from chosen roots, extrema, derivatives or integer antiderivatives, so every answer is a whole number, a half or a short fraction. Problems are drawn per level 1 to 3 from templates (`UTemplate`) with a seeded `LearnRandom`; the same seed gives the same exercises.
- **No terms are typed.** The answer check cannot judge equivalent terms, so students type numbers only (mode `.number`); terms appear only as multiple-choice options.
- **Wrong options come from mistakes.** The polynomial templates compute the wrong terms by applying typical mistakes (`UMistake`: exponent lowered without multiplying, factor taken but exponent kept, constant kept, integrated instead of differentiated, divided by the old exponent). Other wrong options are the results of confusing f(a) and f'(a), forgetting the chain-rule factor 1/k or k, mixing P(A and B) with P(A|B) and P(B|A), forgetting the binomial coefficient, using the wrong bound, summing instead of taking the complement, and so on.
- **Probabilities** are asked so the exact value is a fraction or a short decimal; both "0,375" and "3/8" are accepted (`NumberCheck`). Irrational results (square roots in exact trigonometric values, ln of a number) are asked only as multiple choice.
- **Sign-only and operator-only differences cannot be shown as options.** The shared check `LearnExercise.folded` keeps only letters and digits, so it drops signs and operators (+, −, ·, /, <, >); so "x^2 + C" and "-x^2 + C" would count as the same option. Sign mistakes are therefore tested in typed number questions (signed integral, f'(pi), swapped integral bounds), not as multiple-choice distractors. Statements about logarithm laws and independence are therefore worded with labels ("Summe: ...", "Produkt: ...", "ist größer als"). A wrong option that reads like the right one is dropped; a question without two remaining wrong options is not used.
- **Progression.** Lesson 1 starts at level 1 and ends at level 2, lesson 2 spans levels 1 to 3, lesson 3 levels 2 and 3. Lessons 2 and 3 repeat three exercises of earlier lessons of the unit. The practice round mixes all templates of the unit and three exercises of earlier units; the checkpoint covers the whole unit at levels 2 and 3.
- **Forms.** Each unit has multiple choice, typed numbers and pairs (term and derivative, degrees and radians, norms of vectors, n over k and value, ...). A new item meets the student first in multiple choice and later typed.
- Every exercise has a worked solution (`solution`) and a one-sentence rule (`explanation`).

## Verification

`MathCourseUpperKit.swift` re-computes the answers independently over seeds 1...300 and three levels for every template:
central-difference derivatives against the symbolic ones, Simpson integration (areas with the absolute value) against antiderivatives, roots plugged into f, f' = 0 and the sign of f'' at extrema, saddle points by the sign pattern of f', inflection points by f'' and f''', symmetry by f(-x), period by shifting the function, amplitude and zero count by sampling a dense grid, trigonometric values against Foundation `sin`/`cos`/`tan`, vector lengths, dot products, angles and line points by direct computation, dice and urns by enumerating all outcomes, n over k against Pascal's triangle, binomial probabilities against a Double implementation (and the pmf sums to 1), tables and tree prompts re-read from the prompt text. Further checks: no equal options, no wrong option equal to the right one, no non-nice answers, no zero vector or `n < k`, no ASCII hyphen used as a minus sign, each node has at least two exercise forms. `CourseAudit` runs for seeds 1...20.

## Sources

The research was done with web search; I could not open every primary document, so the use below is stated honestly.

- KMK, *Bildungsstandards im Fach Mathematik für die Allgemeine Hochschulreife* (decision of 18 October 2012; basis for the Abitur from 2016/17 in all Länder). Search results confirmed adoption date, status and the six general mathematical competences (argumentieren, Probleme lösen, modellieren, Darstellungen verwenden, mit symbolischen/formalen/technischen Elementen umgehen, kommunizieren). Copies: <https://www.didaktik.mathematik.uni-mainz.de/files/2015/12/Mathe-Standards-Sek-II-2012.pdf>, <https://mathe.web.leuphana.de/geo/!LehrplanGeo/BiSt-SekII-Gym-gesamt.pdf>. Used for: the split into Analysis, Analytische Geometrie/Lineare Algebra and Stochastik (Leitideen Algorithmus und Zahl, Messen, Raum und Form, funktionaler Zusammenhang, Daten und Zufall - this list is from memory and not verified in the PDF). Not verified: the exact wording of the Leitideen and of the Kompetenzen.
- Niedersachsen, *Kerncurriculum für das Gymnasium - gymnasiale Oberstufe, Mathematik* (2018) and the Abitur hints, <https://bildungsportal-niedersachsen.de/fileadmin/4_Allgemeinbildung/Zentrale_Arbeiten/2023/14MathematikHinweise2023_072022.pdf>. The Abitur hints name the Sachgebiete Analysis, Lineare Algebra/Analytische Geometrie, Stochastik. The content list of the KC was read through the publisher's mapping below.
- Klett, *Stoffverteilungsplan Lambacher Schweizer Oberstufe, Niedersachsen (Kerncurriculum 2018)*, <https://assets.klett.de/assets/5828796fd11ff7373aaca03862726b96bdb4a2c776f85719cfec9025e96d01da/Stoffverteilungsplan_Niedersachsen_GK_LK_735661_735665.docx>. Read in full as a textbook table of contents. Used for the order inside the units: Einführungsphase (Ableitungsregeln, Tangente, Monotonie, Extremstellen, Krümmung, Wendestellen), Qualifikationsphase Analysis (Kettenregel, Ableitung von Sinus und Kosinus, natürliche Exponentialfunktion und Logarithmus, Exponentialgleichungen, Integralrechnung: bestimmtes Integral, Hauptsatz, Stammfunktionen, Integral und Flächeninhalt), Vektoren und Geraden im Raum, Skalarprodukt, Winkel, bedingte Wahrscheinlichkeit und Unabhängigkeit, Bernoulli-Experiment, Binomialkoeffizient, Binomialverteilung, kumulierte Wahrscheinlichkeiten, Erwartungswert, Standardabweichung.
- Sachsen-Anhalt, *Fachlehrplan Mathematik Gymnasium/Fachgymnasium* (2014/2015), <https://www.bildung-lsa.de/pool/RRL_Lehrplaene/Erprobung/Gymnasium/FLP_Mathematik_FachGym_LT.pdf>: the PDF requires a login ("Zugriff verweigert"), so its content was **not read**. The LISA Abitur information (<https://lisa.sachsen-anhalt.de/fileadmin/Bibliothek/Politik_und_Verwaltung/MK/LISA/Unterricht/ZLE/Abi_Info/FaecherTeil2.pdf>) was seen as a search result only: the written Abitur has tasks from Analysis, Analytische Geometrie and Stochastik, with a non-graphing scientific calculator without CAS. This supports the choice of by-hand-friendly numbers; it does not verify the topic list of Sachsen-Anhalt.
- Hamburg/Rheinland-Pfalz supplements to the Bildungsstandards (search results only) and the NRW statement on the Qualifikationsphase (analysis, linear algebra, stochastics) were seen as search results; nothing was taken from them beyond that structure.

## Known limits

- No chain rule for polynomials such as (2x + 1)^3, no product rule, no quotient rule, no planes, no normal distribution, no hypothesis tests, no Wertebereich/Grenzwert questions, no graph reading. Each of these is in the books but needs figures or typed terms.
- Exact irrational values and ln values appear only as multiple-choice options.
- Multiple-choice options differing only in a sign are not possible (see design decisions).
- Typed decimals must be exact: long decimals such as a binomial probability with seven or more digits are accepted only as a fraction ("781/1024"); the prompt asks for "Bruch oder Dezimalzahl".
- The unit text for unit 5 mentions the integral rules for sin and cos, which the Klett table places in the integral chapter; they are used only in the last lesson.
- The vector notation is a row "(1 | 2 | 3)", not a column, because the app has no column-vector layout.

## What a teacher should double-check

- Notation: school books in your Land may write column vectors, `P(X <= k)` as F(k), "Krümmung" vs "Wendepunkt" wording, "Hochpunkt/Tiefpunkt" vs "Maximum/Minimum" and the symbol for conditional probability (P_A(B) in some Länder instead of P(B|A)). The course uses P(B|A).
- Whether your Land treats the saddle point ("Sattelpunkt") as a special case of an inflection point with horizontal tangent (as here) and requires f''' != 0 for inflection points.
- The wording of the logarithm laws (ln only) and of the exercises about e^(kx) = a (answers like "x = ln(6)/4").
- That the topic order fits your Kurs: the course teaches e-functions and trigonometry before vectors; some Länder teach vectors in Jahrgang 11 and integrals later.
- That the exact-value table (0, 30, 45, 60, 90 degrees and the symmetric angles) matches what is required without a formula sheet.
- The Leitideen wording and the Sachsen-Anhalt Fachlehrplan, which were not verified from the primary documents.

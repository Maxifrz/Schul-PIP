# Spanish course (A1, for German speakers)

Course id `es`, provider `SpanishCourse.provider`, text in `Lernwerk/Services/Learn/Languages/Spanish/SpanishCourse.swift`
(format: see `language-engine.md`). Instruction language German, "du" form. Standard Spanish of Spain, with tú and vosotros.

## Scope and level

CEFR A1 (first year of Spanish as 2nd or 3rd foreign language in Germany). Ten units in three sections instead of the
eight proposed: the planned "Numbers, age, colours" was split, colours moved to the adjectives unit, numbers 11 to 20 and
school things became their own unit "En clase", and the clock/days and months/date topics each got a unit, because
a unit above 32 items would be too big for the engine's lessons.

| # | Unit | Grammar / topic | Sample items |
|---|------|-----------------|--------------|
| 1 | Saludos y presentarse | ser, ¿ ¡, written accent, tú/usted | hola, me llamo, soy, eres |
| 2 | La familia | articles el/la/un/una, tener, mi/tu/su | el hermano, tengo, tienes |
| 3 | Los números y la edad | 0 to 10, age with tener, plural -s | tengo diez años |
| 4 | En clase | 11 to 20, plural -es and z to c | el lápiz, los lápices |
| 5 | Comida y bebida | unos/unas, gustar (gusta/gustan), el agua | me gustan las manzanas |
| 6 | La ciudad | estar, hay, en, cerca de, al lado del | ¿Dónde está el cine? |
| 7 | Mi día | regular -ar/-er/-ir, por la mañana | hablo, comes, vivimos |
| 8 | Descripciones | adjective agreement, colours, muy | una mochila roja |
| 9 | La hora y los días | Son las / Es la una, y media, menos cuarto, weekdays | Son las tres y media |
| 10 | Los meses y la fecha | months, el cinco de mayo, cumpleaños | ¿Cuándo es tu cumpleaños? |

Totals: 138 words, 74 sentences, 57 forms, 21 fills, 11 facts. Every unit has 3 to 5 tip paragraphs.

## Sources

I could not fetch web pages while finishing this course (the earlier run was cut off and the work was completed offline),
so the following was used from my own knowledge and NOT re-checked online in this session:

- Instituto Cervantes, Plan curricular, nivel A1 (gramática, funciones, léxico: saludar, presentarse, familia, números,
  hora, días, meses, comida, ciudad). Used as the topic frame.
- The usual table of contents of German school books for Spanisch as 2./3. Fremdsprache (for example the Encuentros and
  ¡Vamos! style: greetings and introductions, family, school, food, town, daily routine, describing). Topic order only.
- Frequency of words: common high-frequency words were preferred (tener, ser, estar, hay, hablar, comer, vivir).

All sentences, notes and tips are written freshly.

## Design decisions

- Written accents and ¿ ¡ are taught in unit 1. Typed answers ignore accents and capitals (engine behaviour), so the
  tip teaches the accent.
- Pairs that differ only by accent (tú/tu, él/el, sí/si) are never both taught as words; they appear in notes.
- Clock times, dates and gustar are taught as forms because they follow a pattern.
- "ella", "él" forms use `él` for "él / ella" and `ellos` for "ellos / ellas" in verb tables.

## Known limits

- Coverage of A1 is not complete: no ser vs estar for adjectives, no reflexive verbs beyond me llamo, no irregular
  verbs beyond ser, tener, estar, no ir/querer/poder, no ordinal numbers, no numbers above 20, no demonstratives.
- Each word is shown at most three or four times per play, because a node holds at most 12 exercises. The test of
  three exercise forms per word therefore looks at eight seeds (plays), not one.
- "alto" is glossed "hoch; hochgewachsen" (note: bei Personen groß), because "grande" already means groß and no meaning
  may belong to two words.

## What a teacher should double-check

- Glosses: "buenas tardes = guten Tag; guten Nachmittag" (in Spain the usage from lunch until about 20 h or dusk),
  "buenas noches = guten Abend; gute Nacht", "el zumo = der Saft" (Spain, not jugo), "el bocadillo", "la manzana = der Apfel".
- The tip claim that "buenos días" is used until lunch and "buenas tardes" after (typically about 14 h in Spain).
- Unit 2 tip about the e to ie change in tener, unit 5 on el agua / las aguas.
- Date: "el uno de enero" and "el primero de enero" are both accepted; other days use cardinal numbers.
- Time: "y media" is explained as 30 minutes after the hour (3:30 is "tres y media", German "halb vier").
- Adjective "viejo = alt" and "nuevo = neu" in their normal postnominal position.
- Sentences with "Berlín", "Goya" (a Madrid street), and names (Ana, Luis, Marta, Rosa, Lucía) are in `known:` lines.
- "mi, mis" as one word card and "su, sus = sein; ihr" (su also means Ihr/ihr plural; not taught).

## Tests

`LernwerkTests/SpanishCourseTests.swift` (shape, audit over seeds 1 to 12, header, exposure, speech) and
`LernwerkTests/SpanishCourseFactTests.swift` (gender of articles vs notes, plural rule vs notes and forms, adjective
endings, verb endings of ser/tener/estar and the regular classes, verb agreement in sentences, no repeated sentences,
clock and date forms, no shared meanings, no leftover Spanish in German translations).

Run: `scratchpad/lh.sh spanish --own Languages=Spanish SpanishCourseTests SpanishCourseFactTests`.

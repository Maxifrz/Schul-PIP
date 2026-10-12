# French course (Französisch, A1)

## Scope and level

French for German speakers, level A1 of the CEFR (DELF A1, the usual first year of a school course in Germany),
standard metropolitan French. The course is a text in the language engine's format
(`Lernwerk/Services/Learn/Languages/French/FrenchCourse.swift`, provider `FrenchCourse.provider`). Prompts and tips are
German ("du"), the French uses the plain apostrophe `'` so that typing works.

Size: 8 units, 105 words, 56 sentences, 40 forms, 25 fills, 14 facts.

## Units

1. Salutations et se présenter: bonjour, salut, tu/vous, personal pronouns, être, s'appeler, de + city.
2. La famille: avoir, family nouns with article and gender, mon/ma/mes, ton/ta/tes, son/sa/ses.
3. Nombres, âge et couleurs: numbers 1 to 20, age with avoir, the four basic colors, colors after the noun.
4. Articles, genre et pluriel: le/la/les, un/une/des, l', plural -s, feminine adjectives, c'est, voilà.
5. Les verbes en -er: parler, aimer, habiter and others; endings; language without article after parler; à + city.
6. Manger et boire: manger (nous mangeons), boire, partitive du / de la / de l' / des, avoir faim/soif, je voudrais.
7. La ville: aller, à + le = au, de + le = du, place prepositions, chez, il y a.
8. La négation, l'heure et les questions: ne ... pas, de after negation, est-ce que, question words, quel, the time.

## Sources

Not fetched live in this run (the earlier run was cut off by a usage limit). The order and scope follow my knowledge of
the DELF A1 referentiel, the "Niveau A1 pour le français" inventory and the usual tables of contents of German
textbooks (Découvertes, À plus!, Tous ensemble): greetings, family, numbers, articles, -er verbs, food, town, negation
and time. This is unverified against the documents themselves.

## Design decisions

- Every noun is taught with article and a gender note; elided nouns (l'ami, l'amie, l'école, l'eau) carry m or f.
- `mon, ma, mes` style entries merge the paradigm into one word so that no meaning is shared by two words.
- Numbers 11 to 20 are taught as forms (the unit's tip lists them) and used in sentences.
- Sentences are at most 8 words. Names (Léa, Paul, Marie, Anne) and a few inflected forms are in `known:` lines.

## Tests

`LernwerkTests/FrenchCourseTests.swift` (30 tests): parse and content problems, coverage, CourseAudit for seeds 1 to 12,
counts, verb tables recomputed from the endings, gender and article agreement, possessives, numbers and colors, no
repeated sentences, no leftover French in German translations, accents, elision, tips cover every drilled form.

## What a teacher should double-check

- The unit 2 to 8 tips are my own explanations; check phrasing, especially liaison and pronunciation remarks.
- `son/sa/ses` glossed "seine; ihre" and the fact "son père = sein oder ihr Vater".
- "blanche", "bleue" and the feminine-adjective tip in unit 4 (before adjective agreement is taught fully).
- Time: "et demie" glossed as "und eine halbe Stunde"; the fact on "trois heures et demie".
- "à" is glossed "nach; zu; in einer Stadt", "dans" "in; drinnen", so that "in" belongs to one word only.
- Sentence "Voilà les livres de Paul" accepts "Da sind" and "Hier sind".
- Pronunciation notes are in IPA/approximations written by hand.

## Known limits

No inversion questions to produce, no passé composé, no adjectives beyond four colors and a few forms, no numbers above 20.

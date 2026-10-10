# Deutsch als Fremdsprache (daf, A1)

## Scope and level

German as a foreign language for speakers of English, CEFR level A1 (Goethe-Zertifikat Start Deutsch 1). It is a
separate course from the school subject Deutsch. Prompts, tips and glosses are English; words and sentences are German
(standard German, no regional variants). The course is a text in the language engine's format
(`Lernwerk/Services/Learn/Languages/German/GermanForeignCourse.swift`, provider `GermanForeignCourse.provider`,
course id `daf`). The app around it stays German.

Size: 8 units, 101 words, 62 sentences, 48 forms, 16 fills, 13 facts. Every unit has 22 to 30 items, five lessons and
four tip paragraphs.

## Units

1. Hello and goodbye: hallo, guten Tag, tschüss, auf Wiedersehen, du and Sie, ich/du/er/sie, sein, heißen, Wie geht's?
2. Numbers, age and the alphabet: 0 to 10 as words, 11 to 20 as forms (elf, zwölf, -zehn, sechzehn, siebzehn, zwanzig),
   Wie alt bist du?, ja/nein, umlauts, ß, letter names (W, V, J, Z).
3. Family: Vater, Mutter, Eltern, Geschwister and the rest, haben (full table), mein/dein with -e for feminine and plural,
   Ihr for Sie, und.
4. Articles and plural: der, die, das, ein, kein, classroom nouns, plural patterns (-e, umlaut + -e, -n, umlaut + -er, -s),
   capital letters for nouns, Das ist / Das sind.
5. Food and drink: möchten, essen (du isst), trinken, nine foods and drinks, the accusative (den, einen, keinen),
   bitte, was.
6. My day: regular verb endings, the -e- after a stem in -t, wir/ihr, verb second (also with Heute first), Woher? Wo?,
   aus, in, heute.
7. Time, days and months: Wie spät ist es?, ein Uhr, Viertel nach/vor, halb (half to the next hour), the seven days with
   am, um, wann; the twelve months in the tip (im Mai) and in two facts.
8. The city: eight places, gehen, Wo? + in + dative (in der Schule, im Park), Wohin? + in + accusative (in den Park,
   ins Kino), nach + city, zu (zum Bahnhof), wohin, dort.

## Sources

The environment had no reliable network use in this run, so no page was fetched live. The scope and the order follow my
knowledge of: the Goethe-Institut "Start Deutsch 1 / A1" Wortliste, the Profile deutsch A1 functions (greeting, giving
name and age, naming family, ordering food, telling the time, asking the way), the Council of Europe A1 descriptors
(Companion Volume: introduce yourself, ask and answer simple personal questions) and the usual tables of contents of
Menschen A1, Schritte plus and Netzwerk (greetings and names, numbers and personal data, family, objects and plural,
food and the accusative, daily routine and verb position, time and weekdays, the city and prepositions). All of this is
unverified against the documents themselves. The sentences are my own.

## Design decisions

- Nouns are taught with their article ("der Vater") and a note: `pl. die Väter`, `plural only` or `no plural`. The
  weekdays carry `all days are masculine`.
- Verbs carry a table in the note (`forms: ich bin, du bist, ...`) with all six persons; the forms drilled are in `form:` lines.
- `der`, `die`, `das`, `ein`, `kein` are words; `eine`, `keine`, `einen` and the others appear in forms and `known:` lines.
- Digits are avoided in sentences; the clock times are form prompts ("time, 3:30").
- The months are taught in tip and facts and used in no sentence; that keeps the word count in range.
- Possessives mein/dein are one word each, with the -e form in the note and drilled by forms.
- No two words share a meaning; `sie` means "she; they" and the formal Sie is explained in the note and the tip.

## Tests

`LernwerkTests/DafCourseTests.swift` (27 tests): parse and content problems, coverage, CourseAudit for seeds 1 to 12,
size, glosses of all words typed again, verb tables recomputed from the endings, forms of verbs, plural, accusative,
possessives, numbers, clock times and prepositions recomputed from rules, article and possessive agreement in every
text, capital letters for nouns, sentence length and no repeated sentence, no German left in translations, no shared
meaning, fills with exactly one right form.

## Known limits

- Level A1 only, about 100 words (the full Wortliste has about 600); no adjectives beyond gut and alt, no modal verbs
  other than möchten, no separable verbs, no perfect tense.
- Separable verbs (aufstehen, einkaufen) are not in the course: the engine has no place for the split verb in a form
  line and the vocabulary budget per unit was full. They would be a natural unit 9.
- The typed-answer check treats ae/oe/ue as umlauts; the tips teach ä ö ü ß and do not rely on it.
- The mixed audit generates sentences from other sentences; "What is your name? (formal)" is a deliberate label.

## What a teacher should double-check

- "guten Tag" glossed as "good day; hello (formal)" and "hallo" as "hello; hi".
- "Wie geht's?" glossed "How are you?"; "Gut, danke." glossed "Fine, thank you."
- Unit 3 uses "eine Schwester" and "einen Bruder" before articles are explained (set phrases; unit 4 and 5 explain).
- "Ihr" capitalised for Sie in the tip and a fact of unit 3.
- Unit 5: "Du isst einen Apfel", "Ich esse keinen Käse", the explanation that only masculine nouns change.
- Unit 7: "halb vier" for 3:30; "Es ist ein Uhr."; "Viertel nach/vor". Regional "Viertel drei" is not taught.
- Unit 8: dative after Wo? and accusative after Wohin?; "zum Bahnhof", "ins Kino", "im Park".
- Plurals: Väter, Mütter, Brüder, Schwestern, Familien, Großväter, Großmütter, Bücher, Tische, Taschen, Stühle, Hefte,
  Handys, Brote, Kaffees, Äpfel, Eier, Uhren, Monate, Städte, Bahnhöfe, Schulen, Supermärkte, Kinos, Parks, Straßen, Häuser.
- The meaning of "die" as "the (feminine, plural)" and the use of "der" as dative feminine in unit 8.

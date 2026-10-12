# The language engine

One engine builds the lessons of every course that is made of words, sentences, forms and facts: Spanisch, Französisch,
Latein, Deutsch als Fremdsprache and the school subject Deutsch. A course is a text in a small format
(`Lernwerk/Services/Learn/Languages/LanguageDSL.swift` documents it line by line); `LanguageCourseProvider` turns it into
exercises. Nothing in a course is code, so a teacher can read and correct it.

## The format in short

```
course: es                      id; every node id starts with it
title: Spanisch
subtitle: Für Deutschsprachige · A1
kind: language                  language | school
color: D9903A                   six hex digits
symbol: text.bubble.fill        an SF Symbol
speech: es-ES                   optional: the voice for the speaker button
instruction: de                 de | en: the language of the prompts
target-name: Spanisch           "Wie sagt man „Haus“ auf Spanisch?"
into-name: Spanische            "Übersetze ins Spanische:"
produce: yes                    no for a course that only reads (Latin)

section: A1 · Erste Schritte
unit: Hallo und Tschüss | Begrüßen und sich vorstellen
tip: A paragraph of the unit's guide (more tip lines are more paragraphs).
known: Ana, Madrid              words sentences may use without a word: line
word: hola = hallo
word: adiós = tschüss; auf Wiedersehen        every meaning is accepted when typed
word: la casa = das Haus | f                  after | a grammar note, shown as the explanation
sentence: Me llamo Ana. = Ich heiße Ana.
form: ser, yo = soy ## why           the text before the comma names the verb or noun
fill: Yo ___ Ana. = soy | eres | es          the first choice is right
fact: Welcher Fall folgt auf „mit“? = Dativ | Akkusativ | Genitiv ## Mit verlangt den Dativ.
```

## How lessons come out of it

- A unit's items are ordered by how far along each kind is (the first word, sentence, form, fill and fact, then the
  second of each, and so on) and cut into 3 to 5 lessons of about six new items; the number of lessons follows from
  the number of items. **Write items in the order they should be taught; later sentences may use earlier words.**
- Every item meets the student in up to three stages: **recognise** (a choice), **assemble or hear** (the other
  direction as a choice, word tiles, listening), **produce** (typed). A lesson gives each new item two exercises and
  warms up with two older items; practice mixes the whole unit and earlier units; the checkpoint leans on typing.
- Wrong answers come from the course's own words and sentences (never from a word with the same meaning), forms from
  the same verb, fills and facts from the author's choices.
- Typing in the language being learned is strict: capitals, accents and punctuation are forgiven, a changed letter or
  word order is not ("hermana" is not "hermano"). Typing a meaning in the known language is forgiving (typos, word
  order, endings, articles), and every `;`-separated meaning is accepted.
- A school course (`kind: school`) asks "Was bedeutet …?" for a term and its definition and has no translation prompts.
- A reading course (`produce: no`) asks no free production in the language: the student translates into the known
  language and types forms.

## Checks every course must pass

`LanguageCourseProvider.make(source:).errors` is empty (parse errors and content problems: a meaning shared by two
words, a word twice, a fill without a blank or a wrong choice, a unit without a tip, fewer than 8 items),
`LanguageCoverage.gaps(in:)` is empty (every word of every sentence was taught in an earlier or the same unit, or is
listed in `known:`; it does not apply to school courses), and `CourseAudit.problems(of:)` is empty.

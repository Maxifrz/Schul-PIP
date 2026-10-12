# Deutsch (school subject, native speakers)

Course id `de`, text in `Lernwerk/Services/Learn/Languages/German/GermanSchoolCourse.swift` (language engine format,
`kind: school`), tests in `LernwerkTests/GermanCourseTests.swift`. Provider: `GermanSchoolCourse.provider`.

## Scope and level

Spelling, punctuation, grammar and style for native speakers, Sekundarstufe I up to the start of the Oberstufe. It is
separate from Deutsch als Fremdsprache. The course asks terms ("Was bedeutet ...?" and "Welcher Begriff ist gemeint?"),
fills, facts and forms. There are no sentences, so no translation prompts. 11 units, 26 to 29 items each.

## Units

1. das oder dass: Konjunktion, Artikel, Relativpronomen, Ersatzprobe, Komma vor dass.
2. Groß- und Kleinschreibung: Nominalisierung, Signalwörter, Nachsilben, Tageszeiten, Anrede Sie.
3. s, ss und ß: Lang-/Kurzvokal, Diphthong, stimmhaft/stimmlos, Verlängerungsprobe, ist/isst, weiß/wies.
4. Lange und kurze Vokale: Doppelkonsonant, ie, Dehnungs-h, Doppelvokal, Stammprinzip, Homophone (Meer/mehr, Stall/Stahl).
5. Kommasetzung: Aufzählung, Nebensatz, Infinitivgruppe (only the obligatory cases), wörtliche Rede.
6. Wortarten: ten word classes, Adjektivendungen, Steigerung.
7. Satzglieder und die vier Fälle: Umstellprobe, Objekte, Adverbiale, Präpositionen mit Kasus, Artikelformen.
8. Zeiten, Aktiv und Passiv: six tenses, Perfekt with haben/sein, Vorgangspassiv.
9. Konjunktiv I und II: indirekte Rede, irrealer Bedingungssatz, Höflichkeit.
10. Stilmittel: Metapher, Vergleich, Personifikation, Alliteration, Anapher, Antithese, Ironie, Hyperbel, Euphemismus, rhetorische Frage.
11. Textanalyse: Gattungen, lyrisches Ich, Strophe, Vers, Reimschemata, These, Erzählperspektive.

## Design decisions

- The answer check ignores case, umlauts, ß/ss and punctuation (`LearnExercise.folded`). Options that differ only by
  these would count as identical, so the course never asks "Fuß or Fuss", "groß or klein" or "where is the comma" as
  the same words with a different spelling. Instead it asks about real alternative words (Fuß/Fluss, Meer/mehr, isst/ist),
  rules ("Wann schreibt man ß?"), and positions ("Vor dass / nach dass"). A typed answer cannot tell ß from ss.
- Where the rule allows two spellings the course does not ask (du in letters, optional Kommas at Infinitivgruppen,
  heute abend vs Abend not asked, zu Hause not asked).
- Fills about the Konjunktiv begin with "Konjunktiv I:" or "Konjunktiv II:" so that the colloquial indicative is not
  an issue.
- Forms are chosen so that distractors are not accepted by the answer check (no pure article changes within one noun).

## Sources

- Rat für deutsche Rechtschreibung, Amtliches Regelwerk 2024 (https://www.rechtschreibrat.com/DOX/RfdR_Amtliches-Regelwerk_2024.pdf):
  only the search result summary was read (valid since 1 July 2024). Rules were written from knowledge of the Regelwerk.
- KMK / IQB Bildungsstandards Deutsch, Mittlerer Schulabschluss and Kompetenzstufenmodell Sprache und Sprachgebrauch
  untersuchen (https://www.iqb.hu-berlin.de/bista/ksm/KSM_Deutsch_Spra.pdf): used for the competence area, not read in full.
- Niedersachsen Kerncurriculum Deutsch Sekundarbereich I (https://www.mk.niedersachsen.de/download/212300/Kerncurriculum_Deutsch_fuer_den_Sekundarbereich_I.pdf):
  only the table of contents (3.5 Sprache und Sprachgebrauch untersuchen) was seen.
- Sachsen-Anhalt Lehrplan and a Deutschbuch table of contents were NOT consulted (not found in the time available).
  The unit order follows typical school books from memory.

## Verified how

`GermanCourseTests` parse and audit the course for seeds 1 to 12, check counts per unit, and compare content against
tables typed again in the tests: das/dass fills, relative pronouns, nominalisation suffixes, s-forms, plurals,
zu-infinitives, comparison, case articles and fills, tense forms, subjunctive forms, rhyme schemes.

## What a teacher should double-check

- Unit 1: the rule for "dass" fills and the wording of the Ersatzprobe.
- Unit 2: "heute Abend", "morgen früh", Ableitungen auf -er (Hamburger Hafen), the nominalised "etwas Neues".
- Unit 4: the claim that Dehnungs-h stands especially before l, m, n, r; the Homophon pairs.
- Unit 5: the obligatory Kommas at Infinitivgruppen (um/ohne/statt/anstatt/außer/als, Nomen, Hinweiswort) against the Regelwerk 2024.
- Unit 6: that the course follows the school's list of ten word classes; possessive words were left out on purpose
  (Possessivartikel vs Possessivpronomen differs between books).
- Unit 7: "wegen" with Genitiv (colloquially Dativ); genitive "des Manns" accepted as an alternative.
- Unit 9: the choice of Konjunktiv I in fills, and "Umschreibung mit würde" as a term.
- Unit 10 and 11: term definitions (Anapher, Euphemismus, These) and the Gattung overview.
- All terms use one definition each; books differ in details.

## Known limits

No sources were read in full, Bundesländer comparisons are thin, there are no free-writing tasks, and spelling
choices that differ only in case or ß/ss cannot be asked as options by the engine.

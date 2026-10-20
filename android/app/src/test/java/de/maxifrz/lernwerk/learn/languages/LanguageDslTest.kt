package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Port of LanguageDSLTests.swift (parser part) and the parser/data/coverage parts of LanguageCourseTests.swift. */
class LanguageDslTest {
    private fun parse(vararg lines: String) = LanguageDSL.parse(lines.joinToString("\n"))

    @Test fun parsesTheSampleWithoutProblems() {
        val (data, errors) = LanguageDSL.parse(sampleSource)
        assertEquals(emptyList<String>(), errors)
        assertEquals(emptyList<String>(), data.problems())
        assertEquals("sample", data.id)
        assertEquals(CourseKind.LANGUAGE, data.kind)
        assertEquals(0xd9903a, data.color)
        assertEquals("es-ES", data.speech)
        assertEquals(LanguageInstruction.DE, data.instruction)
        assertEquals("Deutsche", data.knownName)
        assertEquals(2, data.units.size)
        val first = data.units[0]
        assertEquals("Hallo und Tschüss", first.title)
        assertEquals("Begrüßen und sich vorstellen", first.summary)
        assertEquals("A1 · Erste Schritte", first.sectionTitle)
        assertEquals(12, first.words.size)
        assertEquals(8, first.sentences.size)
        assertEquals(4, first.forms.size)
        assertEquals(3, first.fills.size)
        assertEquals(2, first.facts.size)
        assertEquals(29, first.itemCount)
        assertEquals(2, first.tip.split("\n\n").size)
        assertEquals(LanguageWord("adiós", listOf("tschüss", "auf Wiedersehen"), "", ""), first.words[1])
        assertEquals("f", data.units[1].words[0].note)
        assertEquals("Mit „yo“ steht „soy“.", first.forms[0].why)
        assertEquals("ser", formGroup(first.forms[0]))
        assertEquals(listOf("soy", "eres", "es"), first.fills[0].options)
        assertEquals("¿", first.facts[1].answer)
        assertEquals(listOf("!", "?"), first.facts[1].wrong)
    }

    @Test fun reportsEveryProblemWithItsLine() {
        val errors = parse(
            "course: x", "title: X", "subtitle: s", "color: 12", "symbol: globe", "word: hola = hallo", "unit: Eins",
            "word: hola", "word: = nichts", "fill: Yo soy = a | b", "fill: Yo ___ = nur", "fact: Frage? = nur eine Antwort",
            "colour: red", "tip:", "no colon here", "unit:",
        ).errors
        for (text in listOf(
            "line 6: word before the first unit",
            "line 8: word needs \" = \"",
            "line 9: word needs \" = \"",
            "line 10: fill without ___",
            "line 11: fill needs a right and a wrong choice",
            "line 12: fact needs an answer and a wrong answer",
            "line 13: unknown key \"colour\"",
            "line 14: empty tip",
            "line 15: no \"key: value\"",
            "line 16: unit without a title",
            "color must be six hex digits",
        )) assertTrue(text, errors.contains(text))
    }

    @Test fun findsContentProblems() {
        val parsed = parse(
            "course: x", "title: X", "subtitle: s", "color: 336699", "symbol: globe", "unit: Eins | s", "tip: Tipp",
            "word: el coche = das Auto", "word: el auto = das Auto", "word: el coche = der Wagen", "word: a = b",
            "word: c = d", "word: e = f", "word: g = h", "sentence: Hola. = Hallo.", "sentence: Hola. = Hallo!",
        )
        assertEquals(emptyList<String>(), parsed.errors)
        val found = parsed.data.problems()
        assertTrue(found.any { it.contains("\"das Auto\" means both el coche and el auto") })
        assertTrue(found.any { it.contains("el coche twice") })
        assertTrue(found.any { it.contains("sentence twice: Hola.") })
    }

    @Test fun alsoReportsAUnitWithoutATipAndSoOn() {
        val found = parse("course: x", "title: X", "subtitle: s", "color: 336699", "symbol: g", "unit: Eins", "fill: a = b | c").data.problems()
        assertTrue(found.contains("unit 1: no tip"))
        assertTrue(found.contains("unit 1: only 1 items"))
        assertTrue(found.contains("unit 1: no blank in a"))
    }

    @Test fun groupsUnitsInSectionsInOrderAndSchoolCoursesNeedNoSpeech() {
        val data = parse(
            "course: de", "title: Deutsch", "subtitle: Schulfach", "kind: school", "color: C46A55", "symbol: book.fill",
            "section: Rechtschreibung", "unit: Das oder dass | s", "tip: Tipp", "fact: A? = a | b",
            "section: Grammatik", "unit: Fälle | s", "tip: Tipp", "fact: B? = a | b", "unit: Zeiten | s", "tip: Tipp",
            "fact: C? = a | b",
        ).data
        assertEquals(CourseKind.SCHOOL, data.kind)
        assertNull(data.speech)
        assertEquals(listOf("Rechtschreibung", "Grammatik", "Grammatik"), data.units.map { it.sectionTitle })
        assertEquals(listOf("Das oder dass", "Fälle", "Zeiten"), data.units.map { it.title })
    }

    @Test fun supportsEnglishInstructions() {
        val data = parse(
            "course: daf", "title: Deutsch als Fremdsprache", "subtitle: For English speakers · A1", "color: B8A04A",
            "symbol: textformat", "speech: de-DE", "instruction: en", "target-name: German", "into-name: German",
            "unit: Hello | Greetings", "tip: In German, nouns are capitalised.", "word: Hallo = hello",
        ).data
        assertEquals(LanguageInstruction.EN, data.instruction)
        assertEquals("English", data.knownName)
        val texts = LanguageTexts.make(data)
        assertEquals("How do you say “house” in German?", fillTemplate(texts.askTarget, "house"))
        assertEquals("Translate into English:\nHaus", fillTemplate(texts.translateFrom, "Haus"))
        assertEquals("Match the pairs", texts.pairs)
        val german = LanguageTexts.make(LanguageDSL.parse(sampleSource).data)
        assertEquals("Wie sagt man „Haus“ auf Spanisch?", fillTemplate(german.askTarget, "Haus"))
        assertEquals("Übersetze ins Spanische:\nHaus", fillTemplate(german.translateInto, "Haus"))
        assertEquals("Finde die Paare", german.pairs)
    }

    @Test fun readsTheLatinVariantAndTheSchoolSource() {
        val latin = LanguageDSL.parse(latinSource)
        assertEquals(emptyList<String>(), latin.errors)
        assertEquals(emptyList<String>(), latin.data.problems())
        assertFalse(latin.data.produces)
        assertNull(latin.data.speech)
        assertEquals(listOf("Marcus", "Roma", "aquam", "terram", "habitant"), latin.data.units[0].known)
        assertEquals(LanguageWord("puella", listOf("das Mädchen"), "-ae f.", ""), latin.data.units[0].words[0])
        assertEquals("puella", formGroup(latin.data.units[0].forms[0]))
        val school = LanguageDSL.parse(schoolSource)
        assertEquals(emptyList<String>(), school.errors)
        assertEquals(emptyList<String>(), school.data.problems())
        assertEquals(CourseKind.SCHOOL, school.data.kind)
        assertEquals("Welcher Begriff ist gemeint?\n{x}", LanguageTexts.make(school.data).askTarget)
    }

    @Test fun keepsTheEdgeCasesOfTheSwiftParser() {
        val errors = LanguageDSL.parse("kind: x\nproduce: maybe\ninstruction: fr\ncolor: GG0000\nspeech:").errors
        assertTrue(errors.contains("kind must be language or school"))
        assertTrue(errors.contains("produce must be yes or no"))
        assertTrue(errors.contains("instruction must be de or en"))
        assertTrue(errors.contains("color must be six hex digits"))
        assertTrue(errors.contains("no units"))
        assertTrue(errors.contains("missing \"course:\""))
        // every newline character is a line break, so "\r\n" counts two lines like Swift's .newlines
        assertEquals(listOf("line 1: no \"key: value\"", "line 3: no \"key: value\""), LanguageDSL.parse("a\r\nb").errors.take(2))
        assertEquals("ser", formGroup(LanguageForm("ser , yo", emptyList(), "")))
        assertEquals("nosotros", formGroup(LanguageForm("nosotros", emptyList(), "")))
    }

    @Test fun coverageFindsSentencesWithWordsNotTaughtYet() {
        assertEquals(emptyList<CoverageGap>(), LanguageCoverage.gaps(LanguageDSL.parse(latinSource).data))
        val gaps = LanguageCoverage.gaps(LanguageDSL.parse(sampleSource).data)
        assertTrue(gaps.isNotEmpty())
        assertTrue(gaps.any { it.sentence == "Me llamo Ana." && it.words.contains("llamo") })
        assertFalse(gaps.any { it.sentence == "No, gracias." })
        assertEquals(listOf("como", "te", "llamas"), LanguageCoverage.tokens("¿Cómo te llamas? 12"))
    }

    @Test fun theSharedTextsHaveTheFiveCourses() {
        assertEquals(listOf("es", "fr", "la", "daf", "de"), LanguageCourses.ids)
        for (id in LanguageCourses.ids) assertTrue(courseFile(id).isFile)
    }

    private fun shared(id: String) {
        val (data, errors) = LanguageDSL.parse(LanguageTexts5.text(id))
        assertEquals(emptyList<String>(), errors)
        assertEquals(id, data.id)
        assertEquals(emptyList<String>(), data.problems())
        if (data.kind != CourseKind.SCHOOL) {
            assertEquals(emptyList<String>(), LanguageCoverage.gaps(data).map { "${it.unit}: ${it.sentence} ${it.words.joinToString(",")}" })
        }
        assertTrue(data.units.isNotEmpty())
    }

    @Test fun esParses() = shared("es")
    @Test fun frParses() = shared("fr")
    @Test fun laParses() = shared("la")
    @Test fun dafParses() = shared("daf")
    @Test fun deParses() = shared("de")
}

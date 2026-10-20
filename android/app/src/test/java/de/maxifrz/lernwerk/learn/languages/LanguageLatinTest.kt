package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** Port of LatinCourseTests.swift. */
class LanguageLatinTest {
    private val made = LanguageCourseProvider.make(LanguageTexts5.text("la"))
    private val data = made.first.data
    private val units = data.units
    private val words = units.flatMap { it.words }
    private val sentences = units.flatMap { it.sentences }
    private val forms = units.flatMap { it.forms }

    private val aEndings = mapOf(
        "Nominativ Singular" to "a", "Nominativ Plural" to "ae", "Genitiv Singular" to "ae", "Genitiv Plural" to "arum",
        "Dativ Singular" to "ae", "Dativ Plural" to "is", "Akkusativ Singular" to "am", "Akkusativ Plural" to "as",
        "Ablativ Singular" to "a", "Ablativ Plural" to "is",
    )
    private val oEndings = mapOf(
        "Genitiv Singular" to "i", "Genitiv Plural" to "orum", "Dativ Singular" to "o", "Dativ Plural" to "is",
        "Akkusativ Singular" to "um", "Akkusativ Plural" to "os", "Ablativ Singular" to "o", "Ablativ Plural" to "is",
        "Nominativ Plural" to "i",
    )
    private val nStem = mapOf(
        "puella" to "puell", "femina" to "femin", "agricola" to "agricol", "nauta" to "naut", "rosa" to "ros", "via" to "vi",
        "villa" to "vill", "domina" to "domin",
    )
    private val oMasc = mapOf("servus" to "serv", "hortus" to "hort", "dominus" to "domin", "amicus" to "amic")
    private val oNeut = mapOf("templum" to "templ")
    private val gender = mapOf(
        "puella" to "f", "femina" to "f", "amica" to "f", "dea" to "f", "agricola" to "m", "nauta" to "m", "rosa" to "f", "aqua" to "f",
        "villa" to "f", "via" to "f", "silva" to "f", "terra" to "f", "amicus" to "m", "servus" to "m", "dominus" to "m", "filius" to "m",
        "equus" to "m", "hortus" to "m", "templum" to "n", "oppidum" to "n", "bellum" to "n", "donum" to "n", "schola" to "f", "porta" to "f",
        "insula" to "f", "murus" to "m", "discipulus" to "m", "domina" to "f", "fabula" to "f", "pecunia" to "f", "gloria" to "f",
        "gladius" to "m", "vita" to "f",
    )
    private val verbStem = mapOf("amare" to "am", "habere" to "hab", "audire" to "aud", "monere" to "mon", "venire" to "ven")
    private val personEnd = mapOf("1. Person Singular" to 0, "2. Person Singular" to 1, "1. Person Plural" to 3, "2. Person Plural" to 4)
    private val conj = mapOf(
        "amare" to listOf("o", "as", "at", "amus", "atis", "ant"),
        "habere" to listOf("eo", "es", "et", "emus", "etis", "ent"),
        "audire" to listOf("io", "is", "it", "imus", "itis", "iunt"),
    )
    private val esse = listOf("sum", "es", "est", "sumus", "estis", "sunt")

    private fun split(prompt: String): Pair<String, String>? {
        val i = prompt.indexOf(", ")
        return if (i < 0) null else prompt.substring(0, i) to prompt.substring(i + 2)
    }

    @Test fun parsesWithoutProblems() = assertEquals(emptyList<String>(), made.second)

    @Test fun hasTheHeader() {
        assertEquals("la", data.id)
        assertEquals("Latein", data.title)
        assertEquals(CourseKind.LANGUAGE, data.kind)
        assertEquals(0x9a7b5b, data.color)
        assertNull(data.speech)
        assertFalse(data.produces)
        assertEquals(LanguageInstruction.DE, data.instruction)
    }

    @Test fun hasFullCoverageAndACleanAudit() {
        assertEquals(emptyList<String>(), LanguageCoverage.gaps(data).map { LanguageCoverage.describe(it) })
        assertEquals(emptyList<String>(), CourseAudit.problems(made.first, (1..5).map { it.toULong() }))
        assertEquals("la", Languages.la.course.id)
    }

    @Test fun hasTheSizes() {
        assertEquals(8, units.size)
        assertTrue(words.size >= 85)
        assertTrue(sentences.size >= 60)
        assertTrue(forms.size >= 40)
        units.forEachIndexed { i, unit ->
            assertTrue("unit ${i + 1} has ${unit.itemCount} items", unit.itemCount in 22..30)
            assertTrue("unit ${i + 1} tips", unit.tip.split("\n\n").size in 3..5)
            assertTrue(unit.sentences.all { it.target.split(" ").size <= 10 })
        }
    }

    @Test fun givesNounGendersInTheNote() {
        for (word in words) {
            val g = gender[word.target] ?: continue
            assertTrue("${word.target}: ${word.note}", word.note.endsWith(" $g."))
            val expectedEnding = if (word.target.endsWith("a")) "-ae" else if (word.target.endsWith("um")) "-i" else if (word.target.endsWith("us")) "-i" else "?"
            assertTrue("${word.target}: ${word.note}", word.note.startsWith(expectedEnding))
        }
        val nounWords = words.filter { it.note.endsWith(" f.") || it.note.endsWith(" m.") || it.note.endsWith(" n.") }
        for (noun in nounWords) assertNotNull("${noun.target} missing in reference list", gender[noun.target])
    }

    @Test fun formsDeclensionsByTheEndings() {
        var checked = 0
        for (form in forms) {
            val s = split(form.prompt)
            val answer = form.answers.firstOrNull()
            if (s == null || answer == null) continue
            val (lemma, info) = s
            if (nStem[lemma] != null && aEndings[info] != null) {
                assertEquals(form.prompt, nStem[lemma] + aEndings[info], answer)
                checked++
            } else {
                val stem = oMasc[lemma] ?: oNeut[lemma]
                val end = oEndings[info]
                if (stem != null && end != null) {
                    var ending: String = end
                    if (oNeut[lemma] != null) {
                        if (info == "Nominativ Plural" || info == "Akkusativ Plural") ending = "a"
                        if (info == "Akkusativ Singular") ending = "um"
                    }
                    assertEquals(form.prompt, stem + ending, answer)
                    checked++
                }
            }
        }
        assertTrue(checked >= 18)
    }

    @Test fun formsVerbsByTheTables() {
        var checked = 0
        for (form in forms) {
            val s = split(form.prompt)
            val answer = form.answers.firstOrNull()
            if (s == null || answer == null) continue
            val (verb, info) = s
            val i = personEnd[info]
            if (verb == "esse" && i != null) {
                assertEquals(esse[i], answer)
                checked++
            } else if (verb == "amare" && i != null) {
                assertEquals(form.prompt, listOf("amo", "amas", "amat", "amamus", "amatis", "amant")[i], answer)
                checked++
            } else if (conj[verb] != null && verbStem[verb] != null && i != null) {
                assertEquals(form.prompt, verbStem[verb] + conj[verb]!![i], answer)
                checked++
            }
        }
        assertTrue(checked >= 14)
    }

    @Test fun hasTheImperatives() {
        val expected = mapOf(
            "amare, Imperativ Singular" to "ama", "amare, Imperativ Plural" to "amate", "audire, Imperativ Plural" to "audite",
            "venire, Imperativ Plural" to "venite",
        )
        for ((prompt, answer) in expected) assertEquals(prompt, answer, forms.firstOrNull { it.prompt == prompt }?.answers?.get(0))
        for (form in forms) {
            if (form.prompt.contains("Imperativ Plural")) assertTrue(form.answers[0].endsWith("te"))
            if (form.prompt.contains("Imperativ Singular")) assertFalse(form.answers[0].endsWith("te"))
        }
    }

    @Test fun givesEveryVerbWordAThirdPersonPairWithTheRightEndings() {
        for (word in words) {
            if (!(word.note.contains("konjugation") && word.target.contains(", "))) continue
            val parts = word.target.split(", ")
            assertEquals(word.target, 2, parts.size)
            assertTrue(word.target, parts[0].endsWith("t"))
            assertTrue(word.target, parts[1].endsWith("nt"))
            assertEquals(word.target, dropLast(parts[0], 1), dropLast(parts[1], 2).replace("iu", "i"))
        }
    }

    @Test fun repeatsNoSentenceAndLeavesNoLatinInTheTranslations() {
        val seen = HashSet<String>()
        val names = setOf("marcus", "iulia")
        val latinWords = sentences.flatMap { lettersOnly(it.target) }.toSet().filter { it !in names && count(it) >= 4 }.toSet()
        for (sentence in sentences) {
            val key = sentence.target.lowercase()
            assertTrue(sentence.target, seen.add(key))
            for (meaning in sentence.meanings) {
                for (token in lettersOnly(meaning)) if (token in latinWords) fail("${sentence.target} -> $meaning contains $token")
                assertTrue(meaning, meaning.endsWith(".") || meaning.endsWith("!") || meaning.endsWith("?"))
            }
            assertEquals(sentence.target, lastChar(sentence.meanings[0]), lastChar(sentence.target))
        }
    }

    @Test fun keepsFillsAndFormsConsistent() {
        for (unit in units) {
            for (fill in unit.fills) {
                assertEquals(fill.sentence, fill.options.size, fill.options.toSet().size)
                assertNotEquals(fill.sentence, "", fill.why)
            }
            val answers = unit.forms.map { it.answers[0] }
            assertEquals(unit.forms.size, unit.forms.map { it.prompt }.toSet().size)
            assertEquals("a unit repeats a form answer", answers.size, answers.toSet().size)
        }
    }

    @Test fun hasNoLongVowelMarksAndNoSpecialCharacters() {
        val macrons = Regex("[āēīōūĀĒĪŌŪ]")
        fun ascii(t: String) = chars(t).all { it.codePointAt(0) < 128 }
        for (word in words) {
            assertFalse(macrons.containsMatchIn(word.target))
            assertTrue(word.target, ascii(word.target))
        }
        for (sentence in sentences) assertTrue(sentence.target, ascii(sentence.target))
        for (form in forms) assertTrue(form.answers.all { a -> chars(a).all { Regex("^\\p{Ll}$").matches(it) } })
    }

    @Test fun hasTheGermanMeaningsOfKeyWords() {
        val gloss = mapOf(
            "puella" to "mädchen", "agricola" to "bauer", "nauta" to "seemann", "servus" to "sklave", "dominus" to "herr", "templum" to "tempel",
            "cum" to "mit", "sine" to "ohne", "ad" to "zu", "per" to "durch", "et" to "und", "non" to "nicht", "sed" to "aber", "ubi" to "wo",
            "cur" to "warum", "quid" to "was", "ego" to "ich", "tu" to "du", "nos" to "wir", "vos" to "ihr", "magnus, -a, -um" to "groß",
            "parvus, -a, -um" to "klein", "bonus, -a, -um" to "gut", "malus, -a, -um" to "schlecht", "longus, -a, -um" to "lang",
            "amat, amant" to "lieben", "portat, portant" to "tragen", "dat, dant" to "geben", "audit, audiunt" to "hören",
            "dormit, dormiunt" to "schlafen", "venit, veniunt" to "kommen", "videt, vident" to "sehen", "est, sunt" to "sein",
            "habet, habent" to "haben", "tacet, tacent" to "schweigen", "hodie" to "heute", "semper" to "immer", "etiam" to "auch",
        )
        for ((latin, stem) in gloss) {
            val word = words.firstOrNull { it.target == latin }
            assertNotNull(latin, word)
            assertTrue(latin, word!!.meanings[0].lowercase().contains(stem))
        }
    }
}

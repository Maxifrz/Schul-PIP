package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.folded
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/** Port of GermanCourseTests.swift (the school course Deutsch). */
class LanguageGermanTest {
    private val source = LanguageTexts5.text("de")
    private val made = LanguageCourseProvider.make(source)
    private val provider = made.first
    private val units = provider.data.units
    private val words = units.flatMap { it.words }
    private val forms = units.flatMap { it.forms }
    private val fills = units.flatMap { it.fills }
    private val facts = units.flatMap { it.facts }

    private fun nonEmptyParts(text: String) = text.split(" ").filter { it.isNotEmpty() }

    @Test fun parsesWithoutErrors() {
        assertEquals(emptyList<String>(), made.second)
        assertEquals(CourseKind.SCHOOL, provider.data.kind)
        assertEquals("de", provider.data.id)
        assertEquals("Deutsch", provider.data.title)
        assertEquals(LanguageInstruction.DE, provider.data.instruction)
    }

    @Test fun needsNoCoverageAndHasNoSentences() = assertTrue(units.all { it.sentences.isEmpty() })

    @Test fun passesTheAudit() = assertEquals(emptyList<String>(), CourseAudit.problems(provider, (1..3).map { it.toULong() }))

    @Test fun hasTheMinimumCounts() {
        assertTrue(units.size >= 10)
        assertTrue(words.size >= 80)
        assertTrue(forms.size >= 40)
        assertTrue(fills.size >= 90)
        assertTrue(facts.size >= 60)
    }

    @Test fun givesEveryUnitTheRightSize() {
        units.forEachIndexed { index, unit ->
            val place = "unit ${index + 1} ${unit.title}"
            assertTrue("$place: ${unit.itemCount} items", unit.itemCount in 22..30)
            assertTrue("$place: terms", unit.words.size in 6..10)
            assertTrue("$place: fills", unit.fills.size in 6..10)
            assertTrue("$place: facts", unit.facts.size in 4..8)
            assertTrue("$place: forms", unit.forms.size in 3..6)
            val tips = unit.tip.split("\n\n")
            assertTrue("$place: ${tips.size} tips", tips.size in 3..5)
            for (tip in tips) assertTrue("$place: a tip is too short", count(tip) > 100)
        }
    }

    @Test fun explainsEveryFillAndFactAndHasSoundChoices() {
        for (fill in fills) {
            assertNotEquals(fill.sentence, "", fill.why)
            assertEquals("one blank: ${fill.sentence}", 2, fill.sentence.split("___").size)
            val f = fill.options.map { folded(it) }
            assertEquals("options that read the same: ${fill.sentence}", f.size, f.toSet().size)
            assertTrue(fill.sentence, fill.options.size in 2..4)
        }
        for (fact in facts) {
            assertNotEquals(fact.question, "", fact.why)
            val all = listOf(fact.answer) + fact.wrong
            assertEquals("options that read the same: ${fact.question}", all.size, all.map { folded(it) }.toSet().size)
            assertTrue(fact.question, all.size in 2..4)
        }
        for (form in forms) assertNotEquals(form.prompt, "", form.why)
    }

    @Test fun hasNoTermDefinitionThatContainsItsOwnTerm() {
        for (word in words) {
            val term = folded(word.target)
            assertTrue(word.target, word.meanings.isNotEmpty())
            for (meaning in word.meanings) assertFalse("${word.target} is in its definition", folded(meaning).contains(term))
        }
    }

    @Test fun hasNoOldSpellingAndNoStraightQuotes() {
        for (old in listOf("daß", "muß", "läßt", "Fluß", "Kuß", "Schloß", "bißchen", "Gemse", "Stengel")) assertFalse(old, source.contains(old))
        assertFalse("use the German quotation marks", source.contains("\""))
        assertFalse("double spaces", source.contains("  "))
    }

    @Test fun asksNoQuestionOrFillTwice() {
        val questions = facts.map { folded(it.question + it.answer) }
        assertEquals(questions.size, questions.toSet().size)
        val sentences = fills.map { folded(it.sentence) }
        assertEquals(sentences.size, sentences.toSet().size)
        val prompts = forms.map { folded(it.prompt) }
        assertEquals(prompts.size, prompts.toSet().size)
    }

    @Test fun unit1DasOrDassFills() {
        val expected = mapOf(
            "Ich weiß, ___ du kommst." to "dass", "___ Buch liegt auf dem Tisch." to "Das",
            "Das Kind, ___ dort steht, ist mein Bruder." to "das", "Er sagt, ___ es regnet." to "dass",
            "Das ist das Haus, ___ wir kaufen wollen." to "das", "Ich hoffe, ___ wir gewinnen." to "dass",
            "___ er schon da ist, freut mich." to "Dass", "Sie hat das Fahrrad, ___ ich mir wünsche." to "das",
            "Es ist schön, ___ du da bist." to "dass", "Wir wissen, ___ ihr Hilfe braucht." to "dass",
        )
        assertEquals(expected.size, units[0].fills.size)
        for (fill in units[0].fills) assertEquals(fill.sentence, expected[fill.sentence], fill.options[0])
        for (fill in units[0].fills) if (fill.options[0].lowercase() == "dass") assertTrue(fill.sentence, fill.why.contains("dass"))
    }

    @Test fun unit1RelativePronounsFollowTheGenderOfTheirNoun() {
        val gender = mapOf("das Mädchen" to "das", "der Mann" to "der", "die Frau" to "die")
        assertEquals(3, units[0].forms.size)
        for (form in units[0].forms) {
            val noun = form.prompt.split(", ").last()
            assertEquals(form.prompt, gender[noun], form.answers[0])
        }
    }

    @Test fun unit2NominalisationSuffixes() {
        for (form in units[1].forms) {
            val parts = form.prompt.split(", Nomen auf -")
            assertEquals(form.prompt, 2, parts.size)
            val (base, suf) = parts
            val answer = form.answers[0]
            assertTrue("$answer should end in $suf", answer.endsWith(suf))
            assertTrue("$answer is a noun", isUpper(firstChar(answer)))
            val stem = if (base.endsWith("en")) dropLast(base, 2) else base
            assertTrue("$answer comes from $base", answer.lowercase().startsWith(stem))
        }
        for (fill in units[1].fills) {
            val rest = nonEmptyParts(fill.sentence.split("___")[0]).lastOrNull() ?: ""
            val word = rest + fill.options[0]
            assertTrue("the filled word $word is a noun", isUpper(firstChar(word)))
            assertTrue(fill.sentence, fill.options[0] in listOf("schaft", "heit", "keit", "nis"))
            assertTrue(word, word in listOf("Freundschaft", "Krankheit", "Höflichkeit", "Gedächtnis", "Verständnis", "Heiterkeit"))
        }
    }

    @Test fun unit3SSounds() {
        val table = mapOf("essen, Präteritum ich" to "aß", "lesen, Präteritum ich" to "las", "wissen, Präsens ich" to "weiß", "fließen, Präteritum es" to "floss")
        for (form in units[2].forms) assertEquals(form.prompt, table[form.prompt], form.answers[0])
        assertEquals(table.size, units[2].forms.size)
        val withEsszet = listOf("Fuß", "Gruß", "Straße", "heißen", "draußen", "groß")
        val withDoubleS = listOf("Fluss", "Wasser", "wissen", "müssen", "Rasse", "Gasse", "Fass", "muss")
        for (fact in units[2].facts) {
            if (fact.question.startsWith("Welches Wort wird mit ß")) {
                assertTrue(fact.question, fact.answer in withEsszet)
                assertTrue(fact.question, fact.wrong.all { it in withDoubleS })
            }
            if (fact.question.startsWith("Welches Wort wird mit ss")) {
                assertTrue(fact.question, fact.answer in withDoubleS)
                assertTrue(fact.question, fact.wrong.all { it in withEsszet })
            }
        }
    }

    @Test fun unit4PluralForms() {
        val plural = mapOf(
            "der Baum" to "die Bäume", "der Zahn" to "die Zähne", "die Hand" to "die Hände", "der Hals" to "die Hälse",
            "die Metapher" to "die Metaphern", "die Hyperbel" to "die Hyperbeln", "die Alliteration" to "die Alliterationen",
            "der Vergleich" to "die Vergleiche", "das Gedicht" to "die Gedichte", "der Vers" to "die Verse",
            "die Strophe" to "die Strophen", "das Drama" to "die Dramen",
        )
        var seen = 0
        for (form in forms) {
            if (!form.prompt.endsWith(", Plural")) continue
            val noun = form.prompt.split(", Plural").joinToString("")
            assertEquals(form.prompt, plural[noun], form.answers[0])
            seen++
        }
        assertEquals(plural.size, seen)
    }

    @Test fun unit5ZuInfinitive() {
        val separable = listOf("auf", "mit", "an", "ab", "aus", "ein")
        for (form in units[4].forms) {
            val verb = form.prompt.split(", ").last()
            val prefix = separable.firstOrNull { verb.startsWith(it) }
            val expected = if (prefix != null) prefix + "zu" + dropFirst(verb, count(prefix)) else "zu $verb"
            assertEquals(form.prompt, expected, form.answers[0])
        }
    }

    @Test fun unit6Comparison() {
        val table = mapOf(
            "schnell, Komparativ" to "schneller", "schnell, Superlativ" to "am schnellsten", "gut, Komparativ" to "besser",
            "gut, Superlativ" to "am besten", "hoch, Komparativ" to "höher",
        )
        for (form in units[5].forms) assertEquals(form.prompt, table[form.prompt], form.answers[0])
        assertEquals(table.size, units[5].forms.size)
        for (form in units[5].forms) {
            if (!form.prompt.endsWith("Superlativ")) continue
            assertTrue(form.prompt, form.answers.any { it.startsWith("am ") })
            assertTrue("the bare form is accepted too", form.answers.any { !it.startsWith("am ") })
        }
    }

    @Test fun unit7Cases() {
        val articles = mapOf(
            "der" to mapOf("Nominativ" to "der", "Genitiv" to "des", "Dativ" to "dem", "Akkusativ" to "den"),
            "die" to mapOf("Nominativ" to "die", "Genitiv" to "der", "Dativ" to "der", "Akkusativ" to "die"),
            "das" to mapOf("Nominativ" to "das", "Genitiv" to "des", "Dativ" to "dem", "Akkusativ" to "das"),
        )
        for (form in units[6].forms) {
            val parts = form.prompt.split(", ")
            assertEquals(form.prompt, 2, parts.size)
            val noun = nonEmptyParts(parts[0])
            val article = noun[0]
            val stem = noun[1]
            val caseName = parts[1]
            val wanted = articles[article]?.get(caseName)
            for (answer in form.answers) {
                val w = nonEmptyParts(answer)
                assertEquals(answer, 2, w.size)
                assertEquals(answer, wanted, w[0])
                if (caseName == "Genitiv" && article != "die") assertTrue(answer, w[1] == stem + "es" || w[1] == stem + "s")
                else assertEquals(answer, stem, w[1])
            }
        }
        assertEquals(5, units[6].forms.size)
        val expected = mapOf(
            "Ich gebe ___ Kind einen Apfel." to "dem", "Er sieht ___ Hund im Garten." to "den",
            "Wir fahren mit ___ Bus zur Schule." to "dem", "Das ist das Auto ___ Lehrers." to "des",
            "Sie wartet auf ___ Zug." to "den", "Ich danke ___ für die Hilfe." to "dir",
            "Wegen ___ Regens fällt das Spiel aus." to "des", "Er hilft ___ Freundin bei den Hausaufgaben." to "seiner",
        )
        assertEquals(expected.size, units[6].fills.size)
        for (fill in units[6].fills) assertEquals(fill.sentence, expected[fill.sentence], fill.options[0])
        val accusative = listOf("für", "durch", "gegen", "ohne", "um")
        val dative = listOf("mit", "aus", "bei", "nach", "von", "zu", "seit")
        val genitive = listOf("wegen", "trotz", "während", "statt")
        for (fact in units[6].facts) {
            if (fact.question.startsWith("Welcher Fall folgt auf")) {
                val preposition = fact.question.split("„")[1].split("“")[0]
                val exp = if (preposition in accusative) "Akkusativ" else if (preposition in dative) "Dativ" else if (preposition in genitive) "Genitiv" else "?"
                assertEquals(preposition, exp, fact.answer)
            }
            if (fact.question.startsWith("Welche Präposition verlangt den Genitiv")) {
                assertTrue(fact.answer in genitive)
                assertTrue(fact.wrong.all { it !in genitive })
            }
        }
    }

    private class Stem(val past: String, val participle: String, val aux: String)

    @Test fun unit8Tenses() {
        val stems = mapOf(
            "gehen" to Stem("ging", "gegangen", "sein"), "bringen" to Stem("brachte", "gebracht", "haben"),
            "schreiben" to Stem("schrieb", "geschrieben", "haben"), "lesen" to Stem("las", "gelesen", "haben"),
            "kommen" to Stem("kam", "gekommen", "sein"),
        )
        for (form in units[7].forms) {
            val parts = form.prompt.split(", ")
            val verb = parts[0]
            val tense = parts[1]
            val answer = form.answers[0]
            val entry = stems[verb]
            if (entry == null) { fail(form.prompt); return }
            when (tense) {
                "Präteritum ich" -> assertEquals(form.prompt, entry.past, answer)
                "Partizip II" -> assertEquals(form.prompt, if (verb == "bringen") "gebracht" else entry.participle, answer)
                "Perfekt ich" -> assertEquals(form.prompt, (if (entry.aux == "sein") "bin " else "habe ") + entry.participle, answer)
                "Plusquamperfekt ich" -> assertEquals(form.prompt, (if (entry.aux == "sein") "war " else "hatte ") + entry.participle, answer)
                else -> fail("unknown tense $tense")
            }
        }
        for (fill in units[7].fills) {
            val sentence = fill.sentence.split("___").joinToString(fill.options[0])
            if (sentence.contains("gefahren")) assertEquals("sind", fill.options[0])
            if (sentence.contains("geschlafen") || sentence.contains("gelesen") || sentence.contains("gemacht")) {
                assertTrue(sentence, fill.options[0] in listOf("habe", "hat"))
            }
        }
    }

    @Test fun unit9Konjunktiv() {
        val table = mapOf(
            "sein, Konjunktiv I er" to "sei", "sein, Konjunktiv II ich" to "wäre", "haben, Konjunktiv II ich" to "hätte",
            "kommen, Konjunktiv II ich" to "käme", "werden, Konjunktiv II ich" to "würde", "können, Konjunktiv II ich" to "könnte",
        )
        for (form in units[8].forms) assertEquals(form.prompt, table[form.prompt], form.answers[0])
        assertEquals(table.size, units[8].forms.size)
        for (form in units[8].forms) {
            if (form.prompt.contains("Konjunktiv II")) assertTrue(form.prompt, chars(form.answers[0]).any { "äöü".contains(it) })
        }
        for (fill in units[8].fills) {
            assertTrue(fill.sentence, fill.sentence.startsWith("Konjunktiv I:") || fill.sentence.startsWith("Konjunktiv II:"))
            val first = fill.options[0]
            if (fill.sentence.startsWith("Konjunktiv I:")) assertTrue(fill.sentence, first in listOf("sei", "seien", "habe"))
            else assertTrue(fill.sentence, first in listOf("hätte", "wäre", "Könntest"))
        }
    }

    @Test fun units10And11TermsAndRhymeSchemes() {
        val terms = units[9].words.map { it.target }.toSet()
        for (fill in units[9].fills) for (option in fill.options) assertTrue("$option is not a term of the unit", option in terms)
        val letters = mapOf("Paarreim" to "aabb", "Kreuzreim" to "abab")
        for (word in units[10].words) if (letters[word.target] != null) assertEquals(letters[word.target], word.note)
        for (fill in units[10].fills) {
            if (!fill.sentence.startsWith("Reimschema")) continue
            val line = fill.sentence.split("„")[1].split("“")[0]
            val w = line.split(", ")
            assertEquals(4, w.size)
            fun devoiced(word: String): String {
                var text = word.lowercase()
                if (text.endsWith("d")) text = dropLast(text) + "t"
                if (text.endsWith("g")) text = dropLast(text) + "k"
                return text
            }
            fun rhymes(a: String, b: String) = suffix(devoiced(a), 2) == suffix(devoiced(b), 2)
            val scheme = if (rhymes(w[0], w[1]) && rhymes(w[2], w[3])) "Paarreim" else if (rhymes(w[0], w[2]) && rhymes(w[1], w[3])) "Kreuzreim" else "?"
            assertEquals(fill.sentence, scheme, fill.options[0])
        }
    }
}

package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.AnswerMode
import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.ExerciseKind
import de.maxifrz.lernwerk.learn.ExerciseMedia
import de.maxifrz.lernwerk.learn.LearnAnswer
import de.maxifrz.lernwerk.learn.LearnExercise
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.folded
import de.maxifrz.lernwerk.learn.missedKeys
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private val numberNames = listOf(
    "cero" to "null", "uno" to "eins", "dos" to "zwei", "tres" to "drei", "cuatro" to "vier", "cinco" to "fünf",
    "seis" to "sechs", "siete" to "sieben", "ocho" to "acht", "nueve" to "neun", "diez" to "zehn", "once" to "elf",
    "doce" to "zwölf", "trece" to "dreizehn", "catorce" to "vierzehn", "quince" to "fünfzehn", "dieciséis" to "sechzehn",
    "diecisiete" to "siebzehn", "dieciocho" to "achtzehn", "diecinueve" to "neunzehn", "veinte" to "zwanzig",
)

/** Port of SpanishCourseTests.swift and SpanishCourseFactTests.swift. */
class LanguageSpanishTest {
    private val made = LanguageCourseProvider.make(LanguageTexts5.text("es"))
    private val provider = made.first
    private val data = provider.data
    private val words = data.units.flatMap { it.words }
    private val sentences = data.units.flatMap { it.sentences }
    private val forms = data.units.flatMap { it.forms }
    private val fills = data.units.flatMap { it.fills }
    private fun plainTokens(text: String) = lettersOnly(text)
    private val persons = listOf("yo", "tú", "él", "nosotros", "vosotros", "ellos")
    private fun nonEmptyParts(text: String) = text.split(" ").filter { it.isNotEmpty() }

    private fun personOf(form: LanguageForm): Int? {
        val parts = form.prompt.split(", ")
        if (parts.size != 2) return null
        val i = persons.indexOf(parts[1])
        return if (i < 0) null else i
    }

    // shape

    @Test fun parsesWithoutErrors() = assertEquals(emptyList<String>(), made.second)

    @Test fun usesOnlyTaughtWordsInSentences() =
        assertEquals(emptyList<String>(), LanguageCoverage.gaps(data).map { LanguageCoverage.describe(it) })

    @Test fun hasACleanCourseAudit() = assertEquals(emptyList<String>(), CourseAudit.problems(Languages.es, (1..3).map { it.toULong() }))

    @Test fun describesTheSpanishCourseForGermanSpeakers() {
        assertEquals("es", data.id)
        assertEquals("Spanisch", data.title)
        assertEquals("Für Deutschsprachige · A1", data.subtitle)
        assertEquals(CourseKind.LANGUAGE, data.kind)
        assertEquals(0xd9903a, data.color)
        assertEquals("text.bubble.fill", data.symbol)
        assertEquals("es-ES", data.speech)
        assertEquals(LanguageInstruction.DE, data.instruction)
        assertEquals("Spanisch", data.targetName)
        assertEquals("Spanische", data.intoName)
        assertTrue(data.produces)
        assertEquals("es", Languages.es.course.id)
    }

    @Test fun isLargeEnoughAndEveryUnitHasTheRightSize() {
        assertTrue(data.units.size >= 8)
        assertTrue(words.size >= 120)
        assertTrue(sentences.size >= 60)
        assertTrue(forms.size >= 50)
        assertTrue(fills.size >= 18)
        assertTrue(data.units.flatMap { it.facts }.size >= 10)
        data.units.forEachIndexed { index, unit ->
            val place = "unit ${index + 1} ${unit.title}"
            assertTrue("$place: ${unit.itemCount} items", unit.itemCount in 22..32)
            assertTrue("$place: words", unit.words.size in 10..15)
            assertTrue("$place: sentences", unit.sentences.size in 6..10)
            assertTrue("$place: forms", unit.forms.size in 3..8)
            assertTrue("$place: fills", unit.fills.size in 2..4)
            assertTrue("$place: facts", unit.facts.size in 1..3)
            val paragraphs = unit.tip.split("\n\n")
            assertTrue("$place: ${paragraphs.size} tip paragraphs", paragraphs.size in 3..5)
            for (p in paragraphs) assertTrue("$place: a tip paragraph is too short", count(p) > 80)
            assertEquals("$place: 25 or more items make five lessons", 5, Languages.es.course.units[index].nodes.count { it.kind == NodeKind.LESSON })
        }
    }

    @Test fun teachesWithExamplesFromTheUnitsOwnWordsInEveryTip() {
        data.units.forEachIndexed { index, unit ->
            val tipTokens = LanguageCoverage.tokens(unit.tip).toSet()
            val own = unit.words.flatMap { LanguageCoverage.tokens(it.target) }.filter { count(it) >= 4 }
            assertTrue("unit ${index + 1}: the tip should use the unit's own words", own.count { it in tipTokens } >= 3)
        }
        val first = data.units[0].tip
        for (mark in listOf("¿", "¡", "á", "é", "í", "ó", "ú", "ñ")) assertTrue("the first unit teaches $mark", first.contains(mark))
    }

    @Test fun meetsTheStudentWithEveryWordInAtLeastThreeFormsAcrossItsUnit() {
        data.units.forEachIndexed { unitIndex, unit ->
            val seen = formsByCard(Languages.es, unitIndex, (1..5).toList())
            unit.words.forEachIndexed { index, word ->
                val forms3 = seen["w$unitIndex-$index"] ?: emptySet()
                assertTrue("${word.target}: ${forms3.sorted()}", forms3.size >= 3)
            }
        }
    }

    @Test fun showsEverySentenceFormFillAndFactInTheUnitsExercises() {
        data.units.forEachIndexed { unitIndex, unit ->
            val seen = HashSet<String>()
            val nodes = Languages.es.course.units[unitIndex].nodes.filter { it.kind != NodeKind.CHEST }
            for (node in nodes) for (seed in 1..4) for (e in provider.exercises(node, seed.toULong())) seen.add(e.cardKeys.firstOrNull() ?: "")
            val expected = unit.words.indices.map { "w$unitIndex-$it" } + unit.sentences.indices.map { "s$unitIndex-$it" } +
                unit.forms.indices.map { "f$unitIndex-$it" } + unit.fills.indices.map { "g$unitIndex-$it" } +
                unit.facts.indices.map { "q$unitIndex-$it" }
            for (key in expected) assertTrue("unit ${unitIndex + 1}: $key never comes up", key in seen)
        }
    }

    @Test fun speaksWithTheSpanishVoiceOfSpain() {
        val node = provider.course.nodes.first { it.id == "es.u01.p" }
        val list = (1..4).flatMap { provider.exercises(node, it.toULong()) }
        val speech = list.mapNotNull { (it.media as? ExerciseMedia.Speech)?.language }
        assertTrue(speech.isNotEmpty())
        assertTrue(speech.all { it == "es-ES" })
    }

    @Test fun isStrictAboutLettersButForgivesAccentsAndCapitalsWhenTyped() {
        val node = provider.course.nodes.first { it.id == "es.u02.t" }
        val pool = (1..40).flatMap { provider.exercises(node, it.toULong()) }
        val typed = pool.filter { it.kind == ExerciseKind.TYPE_ANSWER && it.mode == AnswerMode.EXACT }
        val brother = typed.firstOrNull { it.correctAnswers == listOf("el hermano") }
        assertNotNull(brother)
        assertEquals(emptySet<String>(), brother!!.missedKeys(LearnAnswer.Typed("El Hermano")))
        assertEquals(setOf(brother.cardKeys[0]), brother.missedKeys(LearnAnswer.Typed("el hermana")))
        val sister = typed.firstOrNull { it.correctAnswers == listOf("la hermana") }
        assertNotNull(sister)
        assertEquals(setOf(sister!!.cardKeys[0]), sister.missedKeys(LearnAnswer.Typed("la hermano")))
    }

    @Test fun hasWordBankTilesWithoutSpanishPunctuationMarks() {
        data.units.forEachIndexed { unit, _ ->
            val node = provider.course.nodes.first { it.id == "es.u${(unit + 1).toString().padStart(2, '0')}.p" }
            for (e in provider.exercises(node, 3uL)) {
                if (e.kind != ExerciseKind.WORD_BANK) continue
                for (tile in e.options) assertFalse("${e.id}: $tile", chars(tile).any { "¿?¡!.,".contains(it) })
            }
        }
    }

    // verb tables

    @Test fun hasTheIrregularVerbsWithAllSixPersonsAndTheRightForms() {
        val tables = mapOf(
            "ser" to listOf("soy", "eres", "es", "somos", "sois", "son"),
            "tener" to listOf("tengo", "tienes", "tiene", "tenemos", "tenéis", "tienen"),
            "estar" to listOf("estoy", "estás", "está", "estamos", "estáis", "están"),
        )
        for ((verb, expected) in tables) {
            val own = forms.filter { formGroup(it) == verb }
            assertEquals("$verb is taught with six forms", 6, own.size)
            val found = arrayOfNulls<String>(6)
            for (form in own) {
                val index = personOf(form)
                if (index == null) { fail("${form.prompt}: no person"); continue }
                assertNull("$verb: person ${persons[index]} twice", found[index])
                found[index] = form.answers.firstOrNull()
                assertEquals(form.prompt, 1, form.answers.size)
            }
            assertEquals(verb, expected, found.map { it ?: "" })
        }
    }

    @Test fun followsTheTipWithTheEndingsOfTheRegularVerbs() {
        val endings = mapOf(
            "ar" to listOf("o", "as", "a", "amos", "áis", "an"), "er" to listOf("o", "es", "e", "emos", "éis", "en"),
            "ir" to listOf("o", "es", "e", "imos", "ís", "en"),
        )
        val regular = forms.filter { formGroup(it) in listOf("hablar", "comer", "vivir") }
        assertTrue(regular.size >= 8)
        val groups = HashSet<String>()
        for (form in regular) {
            val infinitive = formGroup(form)
            val group = suffix(infinitive, 2)
            groups.add(group)
            val index = personOf(form)
            val table = endings[group]
            if (index == null || table == null) { fail(form.prompt); continue }
            assertEquals(form.prompt, listOf(dropLast(infinitive, 2) + table[index]), form.answers)
        }
        assertEquals(setOf("ar", "er", "ir"), groups)
        val tip = data.units[6].tip
        for ((group, table) in endings) {
            assertTrue(group, tip.contains("Verben auf -$group: " + table.joinToString(", ") { "-$it" }))
        }
    }

    @Test fun hasTheEndingTheNoteSaysOnTheRegularVerbs() {
        for (word in words) {
            if (!word.note.startsWith("Verb auf -")) continue
            val ending = chars(word.note.substring("Verb auf -".length)).take(2).joinToString("")
            assertTrue("${word.target}: ${word.note}", word.target.endsWith(ending))
        }
        for (word in words) {
            if (suffix(word.target, 2) in listOf("ar", "er", "ir") && !word.target.contains(" ")) {
                assertTrue("${word.target} needs a note", word.note.startsWith("Verb auf -") || word.note == "unregelmäßig")
            }
        }
    }

    @Test fun matchesGustarFormsToPersonAndNumber() {
        val pronouns = mapOf("a mí" to "me", "a ti" to "te", "a ella" to "le", "a él" to "le")
        val gustar = forms.filter { formGroup(it) == "gustar" }
        assertTrue(gustar.size >= 4)
        for (form in gustar) {
            val rest = form.prompt.split(", ")[1].split(" + ")
            assertEquals(form.prompt, 2, rest.size)
            val pronoun = if (rest.size == 2) pronouns[rest[0]] else null
            if (pronoun == null) { fail(form.prompt); continue }
            assertEquals(form.prompt, listOf("$pronoun ${if (rest[1] == "Singular") "gusta" else "gustan"}"), form.answers)
        }
        assertTrue(gustar.any { it.answers == listOf("me gusta") } && gustar.any { it.answers == listOf("te gustan") })
    }

    // nouns

    /** The plural of "el amigo" as the rules of the unit say. */
    private fun plural(phrase: String): String {
        val parts = phrase.split(" ")
        val article = if (parts[0] == "el") "los" else "las"
        var noun = parts.drop(1).joinToString(" ")
        val lastC = lastChar(noun)
        if (noun.endsWith("z")) noun = dropLast(noun) + "ces"
        else if (lastC != null && "aeiouáéíóú".contains(lastC)) noun += "s"
        else if (noun.endsWith("s")) noun += ""
        else noun += "es"
        return "$article $noun"
    }

    @Test fun givesEveryNounWithAnArticleTheGenderOfItsArticle() {
        var checked = 0
        for (word in words) {
            if (!(word.target.startsWith("el ") || word.target.startsWith("la "))) continue
            val masculine = word.target.startsWith("el ")
            val note = word.note
            if (word.target == "el agua") assertTrue("agua is feminine", note.startsWith("f"))
            else {
                assertTrue("${word.target}: $note", note.startsWith(if (masculine) "m" else "f"))
                assertFalse("${word.target}: $note", note.startsWith(if (masculine) "f" else "m"))
            }
            checked++
        }
        assertTrue(checked > 40)
        assertTrue(words.firstOrNull { it.target == "el día" }?.note?.startsWith("m") == true)
        assertNull(words.firstOrNull { it.target == "la mano" })
    }

    @Test fun followsTheRuleInPluralNotesAndPluralForms() {
        var checkedNotes = 0
        for (word in words) {
            if (!(word.target.startsWith("el ") || word.target.startsWith("la "))) continue
            val at = word.note.indexOf("Pl. ")
            if (at < 0) continue
            var written = word.note.substring(at + 4)
            val bracket = written.indexOf(" (")
            if (bracket >= 0) written = written.substring(0, bracket)
            assertEquals(word.target, if (word.target == "el agua") "las aguas" else plural(word.target), written)
            checkedNotes++
        }
        assertTrue(checkedNotes > 35)
        var checkedForms = 0
        for (form in forms) {
            if (!form.prompt.endsWith(", Plural")) continue
            val singular = form.prompt.split(", ")[0]
            if (!(singular.startsWith("el ") || singular.startsWith("la "))) continue
            assertEquals(form.prompt, listOf(plural(singular)), form.answers)
            checkedForms++
        }
        assertTrue(checkedForms >= 8)
    }

    @Test fun formsAdjectivesByTheEndings() {
        fun agree(adjective: String, feminine: Boolean, pl: Boolean): String {
            var result = adjective
            if (result.endsWith("o") && feminine) result = dropLast(result) + "a"
            if (pl) result += if ("aeiou".contains(lastChar(result) ?: "")) "s" else "es"
            return result
        }
        val adjectives = forms.filter {
            !it.prompt.startsWith("gustar") && (it.prompt.contains(", weiblich") || (it.prompt.contains("Plural") && !it.prompt.startsWith("el ") && !it.prompt.startsWith("la ")))
        }
        assertTrue(adjectives.size >= 6)
        for (form in adjectives) {
            val parts = form.prompt.split(", ")
            val expected = when (parts[1]) {
                "weiblich" -> agree(parts[0], true, false)
                "Plural" -> agree(parts[0], false, true)
                "weiblicher Plural" -> agree(parts[0], true, true)
                else -> { fail(form.prompt); continue }
            }
            assertEquals(form.prompt, listOf(expected), form.answers)
        }
        for (word in data.units[7].words) {
            if (!(word.note.contains(", ") && word.note.contains(word.target))) continue
            val listed = word.note.split("; ").last().split(", ")
            val stem = dropLast(word.target)
            assertEquals(word.target, 4, listed.size)
            assertEquals(word.target, listOf(word.target, stem + "a", stem + "os", stem + "as"), listed)
        }
    }

    // numbers, days, months

    @Test fun hasTheNumberWordsInCountingOrder() {
        val taught = words.filter { w -> numberNames.any { it.first == w.target } }
        assertEquals("0 to 20, each once, in counting order", numberNames.map { it.first }, taught.map { it.target })
        for (word in taught) assertEquals(word.target, numberNames.first { it.first == word.target }.second, word.meanings[0])
        assertEquals(21, numberNames.size)
    }

    @Test fun hasNumbersInSentencesMatchingTheirTranslationAndRightSums() {
        val values = HashMap<String, Int>()
        numberNames.forEachIndexed { i, (es, _) -> values[es] = i }
        var checked = 0
        for (sentence in sentences) {
            val tokens = plainTokens(sentence.target)
            val german = plainTokens(sentence.meanings[0])
            for (token in tokens) {
                if (token == "uno") continue
                val value = values[token] ?: continue
                val name = numberNames[value].second
                assertTrue("${sentence.target}: $name missing in ${sentence.meanings[0]}", german.any { it.startsWith(name) })
                checked++
            }
            val plus = tokens.indexOf("más")
            val sum = tokens.indexOf("son")
            if (plus > 0 && sum >= 0 && sum + 1 < tokens.size) {
                val a = values[tokens[plus - 1]]
                val b = tokens.getOrNull(plus + 1)?.let { values[it] }
                val c = values[tokens[sum + 1]]
                if (a != null && b != null && c != null) {
                    assertEquals(sentence.target, c, a + b)
                    checked++
                }
            }
        }
        assertTrue(checked > 15)
        for (fill in fills) {
            if (!fill.sentence.contains(" más ___ ")) continue
            val tokens = plainTokens(fill.sentence.split("___").joinToString(fill.options[0]))
            val plus = tokens.indexOf("más")
            val a = if (plus > 0) values[tokens[plus - 1]] else null
            val b = if (plus >= 0) tokens.getOrNull(plus + 1)?.let { values[it] } else null
            val c = if (plus >= 0) tokens.getOrNull(plus + 3)?.let { values[it] } else null
            if (a != null && b != null && c != null) assertEquals(fill.sentence, c, a + b) else fail(fill.sentence)
            for (wrong in fill.options.drop(1)) {
                val other = plainTokens(fill.sentence.split("___").joinToString(wrong))
                val p = other.indexOf("más")
                val x = if (p > 0) values[other[p - 1]] else null
                val y = if (p >= 0) other.getOrNull(p + 1)?.let { values[it] } else null
                val z = if (p >= 0) other.getOrNull(p + 3)?.let { values[it] } else null
                if (x != null && y != null && z != null) assertNotEquals("$wrong would be right too", z, x + y)
            }
        }
    }

    @Test fun hasTheDaysAndMonthsInOrder() {
        val days = listOf("lunes" to "Montag", "martes" to "Dienstag", "miércoles" to "Mittwoch", "jueves" to "Donnerstag", "viernes" to "Freitag", "sábado" to "Samstag", "domingo" to "Sonntag")
        val months = listOf(
            "enero" to "Januar", "febrero" to "Februar", "marzo" to "März", "abril" to "April", "mayo" to "Mai", "junio" to "Juni",
            "julio" to "Juli", "agosto" to "August", "septiembre" to "September", "octubre" to "Oktober", "noviembre" to "November", "diciembre" to "Dezember",
        )
        for (table in listOf(days, months)) {
            val taught = words.filter { w -> table.any { it.first == w.target } }
            assertEquals(table.map { it.first }, taught.map { it.target })
            for (word in taught) assertEquals(table.first { it.first == word.target }.second, word.meanings[0])
            for (word in taught) assertEquals("written small", word.target.lowercase(), word.target)
        }
    }

    // clock and calendar

    private fun spanishTime(hour: Int, minute: Int): String? {
        fun name(h: Int) = numberNames[h].first
        fun lead(h: Int) = if (h == 1) "Es la una" else "Son las ${name(h)}"
        return when (minute) {
            0 -> lead(hour) + "."
            10 -> lead(hour) + " y diez."
            15 -> lead(hour) + " y cuarto."
            30 -> lead(hour) + " y media."
            45 -> lead((hour % 12) + 1) + " menos cuarto."
            else -> null
        }
    }

    @Test fun hasEveryClockFormAsTheTimeItAsksFor() {
        val clock = forms.filter { it.prompt.startsWith("Uhrzeit auf Spanisch, ") }
        assertTrue(clock.size >= 5)
        val kinds = HashSet<Int>()
        for (form in clock) {
            val digits = form.prompt.split(", ")[1].split(" Uhr").joinToString("").split(":")
            val hour = digits[0].toIntOrNull()
            val minute = digits.getOrNull(1)?.toIntOrNull()
            if (digits.size != 2 || hour == null || minute == null) { fail(form.prompt); continue }
            assertEquals(form.prompt, listOf(spanishTime(hour, minute) ?: "?"), form.answers)
            kinds.add(minute)
        }
        assertEquals("full hours and every kind of minutes the tip names", setOf(0, 10, 15, 30, 45), kinds)
        assertTrue("one o'clock is singular", clock.any { it.answers.firstOrNull()?.startsWith("Es la una") == true })
    }

    @Test fun hasEveryDateFormAsTheDateItAsksFor() {
        val months = mapOf(
            "Januar" to "enero", "Februar" to "febrero", "März" to "marzo", "April" to "abril", "Mai" to "mayo", "Juni" to "junio",
            "Juli" to "julio", "August" to "agosto", "September" to "septiembre", "Oktober" to "octubre", "November" to "noviembre",
            "Dezember" to "diciembre",
        )
        val dates = forms.filter { it.prompt.startsWith("Datum auf Spanisch, ") }
        assertTrue(dates.size >= 4)
        for (form in dates) {
            val parts = form.prompt.split(", ")[1].split(". ")
            val day = parts[0].toIntOrNull()
            val month = if (parts.size == 2) months[parts[1]] else null
            if (parts.size != 2 || day == null || day !in 1..20 || month == null) { fail(form.prompt); continue }
            val expected = "el ${numberNames[day].first} de $month"
            assertTrue(form.prompt, form.answers.contains(expected))
            if (day == 1) assertEquals(setOf(expected, "el primero de $month"), form.answers.toSet())
            else assertEquals(listOf(expected), form.answers)
        }
    }

    @Test fun writesWeekdayAndMonthPhrasesInSentencesSmall() {
        val names = listOf(
            "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo", "enero", "febrero", "marzo", "abril", "mayo",
            "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
        )
        for (sentence in sentences) {
            for (token in nonEmptyParts(sentence.target).drop(1)) {
                val bare = trimWith(token) { isPunct(it) }
                assertFalse("${sentence.target}: $bare", bare.lowercase() in names && bare != bare.lowercase())
            }
        }
    }

    // sentences

    @Test fun punctuatesCorrectlyAndKeepsSentencesShort() {
        fun n(t: String, c: String) = chars(t).count { it == c }
        for (sentence in sentences) {
            val target = sentence.target
            assertEquals(target, n(target, "?"), n(target, "¿"))
            assertEquals(target, n(target, "!"), n(target, "¡"))
            assertTrue(target, ".?!".contains(lastChar(target)!!))
            val first = firstChar(target)!!
            assertTrue(target, first == "¿" || first == "¡" || isUpper(first))
            assertTrue(target, nonEmptyParts(target).size <= 10)
            val german = sentence.meanings[0]
            assertEquals("$target: the question mark of the translation", lastChar(german) == "?", lastChar(target) == "?")
            assertNotEquals(german.lowercase(), target.lowercase())
            assertEquals("$target: one translation is the one the tiles ask for", 1, sentence.meanings.size)
        }
    }

    @Test fun repeatsNoSentenceOfAnEarlierUnit() {
        val seen = HashSet<String>()
        for (unit in data.units) for (sentence in unit.sentences) {
            assertTrue("twice: ${sentence.target}", seen.add(folded(sentence.target)))
        }
        val fillSentences = fills.map { folded(it.sentence.split("___").joinToString(it.options[0])) }.toSet()
        assertFalse("a fill must not be a sentence of the course with its blank filled", fillSentences.any { it in seen })
    }

    @Test fun leavesNoSpanishInTheTranslations() {
        val names = listOf("Lucía", "Berlín", "Madrid")
        val spanishMarks = chars("áéíóúñ¿¡").toSet()
        val spanishWords = words.flatMap { LanguageCoverage.tokens(it.target) }.filter { count(it) >= 4 }.toSet()
        val germanWords = setOf("gusto", "plus", "mich", "nett", "casa", "sehr", "gut", "ist", "der", "die", "das")
        for (sentence in sentences) {
            var german = sentence.meanings[0]
            for (name in names) german = german.split(name).joinToString("")
            assertTrue(german, chars(german).all { it !in spanishMarks })
            for (token in LanguageCoverage.tokens(german)) {
                if (token in spanishWords && token !in germanWords) {
                    val t = LanguageCoverage.tokens(sentence.target)
                    assertFalse("$german: $token is Spanish", t.isNotEmpty() && t.contains(token))
                }
            }
        }
        for (word in words) for (meaning in word.meanings) assertFalse(meaning, chars(meaning).any { it in spanishMarks })
    }

    @Test fun letsTheVerbAgreeWithTheSubjectInEverySentence() {
        val singular = setOf("mi", "tu", "su", "el", "la", "él", "ella", "nuestra", "nuestro")
        val pluralSet = setOf("mis", "tus", "sus", "los", "las", "nosotros", "ellos", "ellas")
        val singularVerbs = setOf("es", "tiene", "está", "gusta", "trabaja")
        val pluralVerbs = setOf("son", "tienen", "están", "gustan", "trabajan")
        var checked = 0
        for (sentence in sentences) {
            val tokens = plainTokens(sentence.target)
            val first = tokens.firstOrNull()
            if (first == null || !(first in singular || first in pluralSet)) continue
            val verb = tokens.firstOrNull { it in singularVerbs || it in pluralVerbs } ?: continue
            assertEquals(sentence.target, verb in pluralVerbs, first in pluralSet)
            checked++
        }
        assertTrue(checked > 15)
    }

    @Test fun letsAdjectivesAgreeWithTheirNounInTheDescriptionSentences() {
        val gender = HashMap<String, Boolean>()
        for (word in words) {
            val parts = word.target.split(" ")
            if (parts.size == 2 && (parts[0] == "el" || parts[0] == "la")) {
                gender[parts[1]] = parts[0] == "el"
                gender[parts[1] + "s"] = parts[0] == "el"
            }
        }
        gender["lápices"] = true; gender["chicos"] = true; gender["libros"] = true; gender["mochila"] = false; gender["mochilas"] = false
        var checked = 0
        for (sentence in data.units[7].sentences) {
            val tokens = plainTokens(sentence.target)
            val isPlural = listOf("son", "mis", "dos").any { it in tokens }
            val lastT = tokens.lastOrNull()
            if (lastT == null || !(lastT.endsWith("o") || lastT.endsWith("a") || lastT.endsWith("os") || lastT.endsWith("as") || lastT.endsWith("es") || lastT.endsWith("l"))) continue
            val noun = tokens.firstOrNull { gender[it] != null } ?: continue
            val masculine = gender[noun]!!
            if (lastT.endsWith("os") || lastT.endsWith("as")) {
                assertEquals(sentence.target, masculine, lastT.endsWith("os"))
                assertTrue(sentence.target, isPlural)
            }
            if (lastT.endsWith("o")) assertTrue(sentence.target, masculine && !isPlural)
            if (lastT.endsWith("a") && !lastT.endsWith("as") && lastT !in listOf("tengo", "tienes")) assertTrue(sentence.target, !masculine || !isPlural)
            checked++
        }
        assertTrue(checked >= 4)
    }

    // fills, facts and words

    @Test fun hasFillsWithOneRightChoiceNoneAlsoASentenceOfTheCourse() {
        val known = sentences.map { folded(it.target) }.toSet()
        for (fill in fills) {
            assertTrue(fill.sentence, fill.options.size in 2..4)
            assertEquals("choices that read the same: ${fill.sentence}", fill.options.size, fill.options.map { folded(it) }.toSet().size)
            assertEquals("one blank: ${fill.sentence}", 2, fill.sentence.split("___").size)
            for (wrong in fill.options.drop(1)) {
                assertFalse("${fill.sentence} with $wrong is a sentence of the course", folded(fill.sentence.split("___").joinToString(wrong)) in known)
            }
            assertNotEquals("${fill.sentence} needs a reason", "", fill.why)
        }
    }

    @Test fun asksTheVerbFillsForTheFormTheParadigmGives() {
        fun find(s: String) = fills.firstOrNull { it.sentence == s }?.options?.get(0)
        assertEquals("soy", find("Yo ___ Marta."))
        assertEquals("eres", find("¿De dónde ___ tú?"))
        assertEquals("tiene", find("Mi padre ___ un hermano."))
        assertEquals("vivimos", find("Nosotros ___ en Madrid."))
        assertEquals("está", find("El parque ___ cerca de mi casa."))
        for (fill in fills) {
            if (plainTokens(fill.sentence).firstOrNull() == "yo" && fill.options[0] in listOf("soy", "tengo", "estoy")) assertEquals(fill.sentence, "soy", fill.options[0])
        }
    }

    @Test fun hasFactsWithOneRightAnswerAndRealWrongOnes() {
        for (fact in data.units.flatMap { it.facts }) {
            assertNotEquals(fact.question, 0, fact.wrong.size)
            assertTrue(fact.question, fact.wrong.size <= 3)
            val all = (listOf(fact.answer) + fact.wrong).map { folded(it) }
            assertEquals("answers that read the same: ${fact.question}", all.size, all.toSet().size)
            assertFalse("an answer of only punctuation reads empty to the engine: ${fact.question}", all.contains(""))
            assertNotEquals(fact.question, "", fact.why)
        }
    }

    @Test fun sharesNoMeaningBetweenTwoWordsAndTeachesNoWordTwice() {
        val owner = HashMap<String, String>()
        val targets = HashSet<String>()
        for (word in words) {
            assertTrue("twice: ${word.target}", targets.add(folded(word.target)))
            for (meaning in word.meanings) {
                val key = folded(meaning)
                assertTrue("$meaning: ${owner[key] ?: ""} and ${word.target}", owner[key] == null || owner[key] == word.target)
                owner[key] = word.target
            }
        }
    }

    @Test fun doesNotTeachBothWordsOfAnAccentPair() {
        for ((accented, plain) in listOf("tú" to "tu", "él" to "el", "sí" to "si", "mí" to "mi", "qué" to "que")) {
            assertTrue("$accented and $plain", words.count { it.target == accented || it.target == plain } <= 1)
        }
        assertTrue(words.any { it.target == "tú" } && words.any { it.target == "él" })
    }

    @Test fun meansWhatTheGreetingsShouldAtTheRightTimeOfDay() {
        fun meanings(t: String) = words.firstOrNull { it.target == t }?.meanings ?: emptyList()
        assertEquals(listOf("guten Morgen"), meanings("buenos días"))
        assertTrue(meanings("buenas tardes").contains("guten Tag"))
        assertTrue(meanings("buenas noches").contains("gute Nacht"))
        assertTrue(meanings("¿qué tal?").contains("wie geht's?"))
        assertEquals("bis zum Mittagessen", words.firstOrNull { it.target == "buenos días" }?.note)
    }

    @Test fun hasTheFamilyWordsInPairsOfOneGenderEach() {
        val pairs = listOf("el padre" to "la madre", "el hermano" to "la hermana", "el abuelo" to "la abuela", "el hijo" to "la hija", "el amigo" to "la amiga", "el chico" to "la chica")
        for ((man, woman) in pairs) {
            assertNotNull(man, words.firstOrNull { it.target == man })
            assertNotNull(woman, words.firstOrNull { it.target == woman })
        }
        for ((man, woman) in pairs.filter { it.first != "el padre" }) {
            assertEquals("$man / $woman share a stem", dropLast(dropFirst(woman, 3)), dropLast(dropFirst(man, 3)))
            assertTrue(man.endsWith("o") && woman.endsWith("a"))
        }
    }
}

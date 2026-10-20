package de.maxifrz.lernwerk.learn.languages

import de.maxifrz.lernwerk.learn.CourseAudit
import de.maxifrz.lernwerk.learn.CourseKind
import de.maxifrz.lernwerk.learn.NodeKind
import de.maxifrz.lernwerk.learn.folded
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

private val persons = listOf("ich", "du", "er", "wir", "ihr", "sie")
private val irregular = mapOf(
    "sein" to listOf("bin", "bist", "ist", "sind", "seid", "sind"),
    "haben" to listOf("habe", "hast", "hat", "haben", "habt", "haben"),
    "essen" to listOf("esse", "isst", "isst", "essen", "esst", "essen"),
    "möchten" to listOf("möchte", "möchtest", "möchte", "möchten", "möchtet", "möchten"),
)
private val regularVerbs = listOf("heißen", "trinken", "kommen", "wohnen", "lernen", "arbeiten", "machen", "spielen", "gehen")

private fun conjugation(verb: String): List<String>? {
    val table = irregular[verb]
    if (table != null) return table
    if (verb !in regularVerbs || !verb.endsWith("en")) return null
    val stem = dropLast(verb, 2)
    val needsE = stem.endsWith("t") || stem.endsWith("d")
    val sibilant = stem.endsWith("s") || stem.endsWith("ß") || stem.endsWith("z") || stem.endsWith("x")
    val du = if (sibilant) stem + "t" else stem + (if (needsE) "est" else "st")
    val er = stem + (if (needsE) "et" else "t")
    return listOf(stem + "e", du, er, verb, er, verb)
}

private val gloss = mapOf(
    "hallo" to "hello",
    "guten Tag" to "good day",
    "tschüss" to "bye",
    "auf Wiedersehen" to "goodbye",
    "danke" to "thank you",
    "ich" to "I",
    "du" to "you (informal)",
    "er" to "he",
    "sie" to "she",
    "wie" to "how",
    "gut" to "good",
    "sein" to "to be",
    "heißen" to "to be called",
    "null" to "zero",
    "eins" to "one",
    "zwei" to "two",
    "drei" to "three",
    "vier" to "four",
    "fünf" to "five",
    "sechs" to "six",
    "sieben" to "seven",
    "acht" to "eight",
    "neun" to "nine",
    "zehn" to "ten",
    "alt" to "old",
    "ja" to "yes",
    "nein" to "no",
    "die Familie" to "family",
    "der Vater" to "father",
    "die Mutter" to "mother",
    "der Bruder" to "brother",
    "die Schwester" to "sister",
    "die Eltern" to "parents",
    "die Geschwister" to "siblings",
    "der Großvater" to "grandfather",
    "die Großmutter" to "grandmother",
    "mein" to "my",
    "dein" to "your (informal)",
    "haben" to "to have",
    "und" to "and",
    "der" to "the (masculine)",
    "die" to "the (feminine, plural)",
    "das" to "the (neuter)",
    "ein" to "a",
    "kein" to "not a",
    "das Buch" to "book",
    "der Tisch" to "table",
    "die Tasche" to "bag",
    "der Stuhl" to "chair",
    "das Heft" to "notebook",
    "das Handy" to "mobile phone",
    "hier" to "here",
    "bitte" to "please",
    "möchten" to "would like",
    "essen" to "to eat",
    "trinken" to "to drink",
    "das Brot" to "bread",
    "das Wasser" to "water",
    "die Milch" to "milk",
    "der Kaffee" to "coffee",
    "der Apfel" to "apple",
    "der Käse" to "cheese",
    "das Ei" to "egg",
    "was" to "what",
    "wir" to "we",
    "ihr" to "you (plural)",
    "kommen" to "to come",
    "wohnen" to "to live",
    "lernen" to "to learn",
    "arbeiten" to "to work",
    "machen" to "to do",
    "spielen" to "to play",
    "aus" to "from",
    "woher" to "where from",
    "wo" to "where",
    "in" to "in",
    "heute" to "today",
    "der Montag" to "Monday",
    "der Dienstag" to "Tuesday",
    "der Mittwoch" to "Wednesday",
    "der Donnerstag" to "Thursday",
    "der Freitag" to "Friday",
    "der Samstag" to "Saturday",
    "der Sonntag" to "Sunday",
    "die Uhr" to "o'clock",
    "spät" to "late",
    "wann" to "when",
    "um" to "at (a time)",
    "der Monat" to "month",
    "die Stadt" to "city",
    "der Bahnhof" to "train station",
    "die Schule" to "school",
    "der Supermarkt" to "supermarket",
    "das Kino" to "cinema",
    "der Park" to "park",
    "die Straße" to "street",
    "das Haus" to "house",
    "gehen" to "to go",
    "nach" to "to (a city or country)",
    "wohin" to "where to",
    "dort" to "there",
)

private class Noun(val gender: String, val plural: String?)
private val nouns = mapOf(
    "Vater" to Noun("m", "Väter"),
    "Mutter" to Noun("f", "Mütter"),
    "Bruder" to Noun("m", "Brüder"),
    "Schwester" to Noun("f", "Schwestern"),
    "Familie" to Noun("f", "Familien"),
    "Eltern" to Noun("f", "-"),
    "Geschwister" to Noun("n", "-"),
    "Großvater" to Noun("m", "Großväter"),
    "Großmutter" to Noun("f", "Großmütter"),
    "Buch" to Noun("n", "Bücher"),
    "Tisch" to Noun("m", "Tische"),
    "Tasche" to Noun("f", "Taschen"),
    "Stuhl" to Noun("m", "Stühle"),
    "Heft" to Noun("n", "Hefte"),
    "Handy" to Noun("n", "Handys"),
    "Brot" to Noun("n", "Brote"),
    "Wasser" to Noun("n", null),
    "Milch" to Noun("f", null),
    "Kaffee" to Noun("m", "Kaffees"),
    "Apfel" to Noun("m", "Äpfel"),
    "Käse" to Noun("m", null),
    "Ei" to Noun("n", "Eier"),
    "Montag" to Noun("m", null),
    "Dienstag" to Noun("m", null),
    "Mittwoch" to Noun("m", null),
    "Donnerstag" to Noun("m", null),
    "Freitag" to Noun("m", null),
    "Samstag" to Noun("m", null),
    "Sonntag" to Noun("m", null),
    "Uhr" to Noun("f", "Uhren"),
    "Monat" to Noun("m", "Monate"),
    "Stadt" to Noun("f", "Städte"),
    "Bahnhof" to Noun("m", "Bahnhöfe"),
    "Schule" to Noun("f", "Schulen"),
    "Supermarkt" to Noun("m", "Supermärkte"),
    "Kino" to Noun("n", "Kinos"),
    "Park" to Noun("m", "Parks"),
    "Straße" to Noun("f", "Straßen"),
    "Haus" to Noun("n", "Häuser"),
)

private val days = listOf("Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag")
private val articleOf = mapOf("m" to "der", "f" to "die", "n" to "das")

private val pluralForms: Set<String> =
    nouns.values.mapNotNull { it.plural }.filter { it != "-" }.map { it.lowercase() }.toSet() + setOf("eltern", "geschwister")
private val singularGender: Map<String, String> =
    nouns.entries.filter { it.value.plural != "-" }.associate { it.key.lowercase() to it.value.gender }

private val numberWords = mapOf(
    0 to "null", 1 to "ein", 2 to "zwei", 3 to "drei", 4 to "vier", 5 to "fünf", 6 to "sechs", 7 to "sieben", 8 to "acht", 9 to "neun",
    10 to "zehn", 11 to "elf", 12 to "zwölf", 13 to "dreizehn", 14 to "vierzehn", 15 to "fünfzehn", 16 to "sechzehn",
    17 to "siebzehn", 18 to "achtzehn", 19 to "neunzehn", 20 to "zwanzig",
)

/** The words of a German text as written (case kept), without the punctuation around them; inner apostrophes stay. */
private fun germanTokens(text: String): List<String> =
    text.split(Regex("\\p{IsWhite_Space}+")).filter { it.isNotEmpty() }
        .map { p -> trimWith(p) { c -> c != "'" && (isPunct(c) || c == "\t" || Regex("^\\p{Zs}$").matches(c)) } }
        .filter { it.isNotEmpty() }

private fun nounOf(subject: String): Pair<String, String>? {
    val parts = subject.split(" ").filter { it.isNotEmpty() }
    if (parts.size != 2 || parts[0] !in listOf("der", "die", "das", "ein", "kein", "eine")) return null
    return parts[0] to parts[1]
}

private fun groupAndSubject(form: LanguageForm): Pair<String, String>? {
    val comma = form.prompt.indexOf(',')
    if (comma < 0) return null
    return form.prompt.substring(0, comma) to form.prompt.substring(comma + 2)
}

/** Port of DafCourseTests.swift (German for English speakers). */
class LanguageDafTest {
    private val source = LanguageTexts5.text("daf")
    private val made = LanguageCourseProvider.make(source)
    private val provider = made.first
    private val data = provider.data
    private val units = data.units
    private val words = units.flatMap { it.words }
    private val sentences = units.flatMap { it.sentences }
    private val forms = units.flatMap { it.forms }
    private val fills = units.flatMap { it.fills }
    private val facts = units.flatMap { it.facts }

    private val germanTexts: List<String> =
        words.map { it.target } + sentences.map { it.target } + forms.flatMap { it.answers } +
            fills.filter { it.options.isNotEmpty() }.map { it.sentence.split("___").joinToString(it.options[0]) }

    // shape

    @Test fun parsesAndHasNoContentProblems() = assertEquals(emptyList<String>(), made.second)

    @Test fun hasTheHeaderAndProviderTheCatalogExpects() {
        assertEquals("daf", data.id)
        assertEquals("Deutsch als Fremdsprache", data.title)
        assertEquals("German for English speakers · A1", data.subtitle)
        assertEquals(CourseKind.LANGUAGE, data.kind)
        assertEquals(0xb8a04a, data.color)
        assertEquals("textformat", data.symbol)
        assertEquals("de-DE", data.speech)
        assertEquals(LanguageInstruction.EN, data.instruction)
        assertEquals("German", data.targetName)
        assertEquals("German", data.intoName)
        assertEquals("English", data.knownName)
        assertTrue(data.produces)
        assertEquals("daf", Languages.daf.course.id)
        assertEquals(8, Languages.daf.course.units.size)
        assertEquals(units.map { it.title }, Languages.daf.course.units.map { it.title })
    }

    @Test fun passesTheEngineAudit() = assertEquals(emptyList<String>(), CourseAudit.problems(Languages.daf, (1..3).map { it.toULong() }))

    @Test fun teachesEveryWordOfASentenceBefore() =
        assertEquals(emptyList<String>(), LanguageCoverage.gaps(data).map { LanguageCoverage.describe(it) })

    @Test fun hasTheAgreedSize() {
        assertEquals(8, units.size)
        assertTrue(words.size >= 95)
        assertTrue(sentences.size >= 60)
        assertTrue(forms.size >= 40)
        assertTrue(fills.size >= 16)
        assertTrue(facts.size >= 12)
        units.forEachIndexed { index, unit ->
            val place = "unit ${index + 1} ${unit.title}"
            assertTrue("$place: ${unit.itemCount} items", unit.itemCount in 22..30)
            assertTrue("$place: words", unit.words.size in 10..14)
            assertTrue("$place: sentences", unit.sentences.size in 6..10)
            assertTrue("$place: forms", unit.forms.size in 3..7)
            assertTrue("$place: fills", unit.fills.size in 2..4)
            assertTrue("$place: facts", unit.facts.size in 1..3)
            assertEquals(place, 5, LanguageCourseProvider.lessonCount(unit))
            val tips = unit.tip.split("\n\n")
            assertTrue("$place: ${tips.size} tip paragraphs", tips.size in 3..5)
            for (tip in tips) {
                assertTrue("$place: too short", count(tip) > 120)
                assertTrue("$place: too long", count(tip) < 800)
            }
        }
    }

    @Test fun explainsEveryRuleBasedItem() {
        for (f in forms) assertNotEquals("form without explanation: ${f.prompt}", "", f.why)
        for (f in fills) assertNotEquals("fill without explanation: ${f.sentence}", "", f.why)
        for (f in facts) assertNotEquals("fact without explanation: ${f.question}", "", f.why)
        for (item in forms.map { it.why } + fills.map { it.why } + facts.map { it.why }) {
            assertTrue("an explanation is a sentence: $item", item.endsWith("."))
        }
    }

    @Test fun hasTheGlossOfEveryWordATeacherExpects() {
        val seen = HashSet<String>()
        for (word in words) {
            val expected = gloss[word.target]
            assertNotNull("a word the test does not know: ${word.target}", expected)
            if (expected == null) continue
            assertEquals(word.target, expected, word.meanings[0])
            seen.add(word.target)
        }
        assertEquals("the test lists a word the course does not teach", gloss.size, seen.size)
    }

    // verbs

    @Test fun hasAllSixPersonsAndTheRightFormsInEveryVerbTable() {
        var tables = 0
        for (word in words) {
            if (!word.note.startsWith("forms: ")) continue
            val verb = word.target
            val entries = word.note.substring("forms: ".length).split(", ")
            assertEquals("$verb: a full table has six persons", 6, entries.size)
            val expected = conjugation(verb)
            assertNotNull("a verb the test does not know: $verb", expected)
            if (expected == null) continue
            entries.forEachIndexed { index, entry ->
                if (index < 6) assertEquals("$verb: $entry", "${persons[index]} ${expected[index]}", entry)
            }
            tables++
        }
        assertEquals("every verb of the course has a table", 13, tables)
        val verbs = words.filter { it.note.startsWith("forms: ") }.map { it.target }.toSet()
        assertEquals(irregular.keys + regularVerbs, verbs)
    }

    @Test fun hasTheRightFormForItsPersonInEveryVerbForm() {
        var checked = 0
        for (form in forms) {
            val parts = form.prompt.split(", ")
            if (parts.size != 2 || parts[1] !in persons) continue
            val table = conjugation(parts[0])
            assertNotNull("a form of a verb the test does not know: ${form.prompt}", table)
            if (table == null) continue
            assertEquals(form.prompt, table[persons.indexOf(parts[1])], form.answers[0])
            checked++
        }
        assertTrue(checked >= 17)
    }

    @Test fun showsEveryDrilledVerbFormInATip() {
        units.forEachIndexed { index, unit ->
            for (form in unit.forms) {
                val parts = form.prompt.split(", ")
                if (parts.size != 2 || parts[1] !in persons || form.answers.isEmpty()) continue
                val tips = units.take(index + 1).joinToString(" ") { it.tip }
                assertTrue("unit ${index + 1}: no tip shows ${form.answers[0]} (${form.prompt})", tips.contains(form.answers[0]))
            }
        }
    }

    @Test fun hasExactlyTheRightFormForTheSubjectInFillsWithVerbs() {
        val byForm = HashMap<String, MutableSet<Int>>()
        fun add(form: String, i: Int) { byForm.getOrPut(form) { mutableSetOf() }.add(i) }
        for (verb in irregular.keys + regularVerbs) conjugation(verb)?.forEachIndexed { i, form -> add(form, i) }
        add("bin", 0)
        val subjects = mapOf("ich" to 0, "du" to 1, "er" to 2, "wir" to 3, "ihr" to 4)
        var checked = 0
        for (fill in fills) {
            val tokens = germanTokens(fill.sentence.split("___").joinToString("BLANK"))
            val blank = tokens.indexOf("BLANK")
            if (blank < 0) { fail("no blank: ${fill.sentence}"); continue }
            var person: Int? = null
            if (blank > 0 && subjects[tokens[blank - 1].lowercase()] != null) person = subjects[tokens[blank - 1].lowercase()]
            else if (blank > 0 && tokens[blank - 1] == "Sie" && blank == 1) person = 2
            else if (blank + 1 < tokens.size && tokens[blank + 1] == "Sie" && blank > 0) person = 5
            else if (blank + 1 < tokens.size && subjects[tokens[blank + 1].lowercase()] != null) person = subjects[tokens[blank + 1].lowercase()]
            if (person == null || !fill.options.all { it in byForm }) continue
            assertTrue("${fill.sentence}: ${fill.options[0]} does not fit", byForm[fill.options[0]]?.contains(person) == true)
            for (wrong in fill.options.drop(1)) assertFalse("${fill.sentence}: $wrong also fits", byForm[wrong]?.contains(person) == true)
            checked++
        }
        assertTrue(checked >= 6)
    }

    // nouns, genders, plurals

    @Test fun givesEveryNounItsArticleAndAPluralNoteThatAgree() {
        var checked = 0
        for (word in words) {
            val parts = word.target.split(" ").filter { it.isNotEmpty() }
            if (parts.size != 2 || parts[0] !in listOf("der", "die", "das")) continue
            val name = parts[1]
            val info = nouns[name]
            assertNotNull("a noun the test does not know: ${word.target}", info)
            if (info == null) continue
            assertEquals("${word.target} has the wrong article", if (info.plural == "-") "die" else articleOf[info.gender], parts[0])
            if (info.plural == null) assertEquals(word.target, if (name in days) "all days are masculine" else "no plural", word.note)
            else if (info.plural == "-") assertEquals(word.target, "plural only", word.note)
            else assertEquals(word.target, "pl. die ${info.plural}", word.note)
            checked++
        }
        assertEquals("number of nouns taught with an article", nouns.size, checked)
    }

    @Test fun teachesEveryNounWithItsArticle() {
        val targets = words.map { it.target }.toSet()
        for (name in nouns.keys) assertFalse("$name is taught without its article", name in targets)
        val taught = HashSet<String>()
        for (word in words) {
            val parts = word.target.split(" ").filter { it.isNotEmpty() }
            if (parts.size == 2 && parts[0] in listOf("der", "die", "das")) taught.add(parts[1])
        }
        assertEquals(nouns.keys, taught)
    }

    @Test fun formsPluralsByTheTable() {
        var checked = 0
        for (form in forms) {
            val gs = groupAndSubject(form)
            if (gs == null || gs.first != "Plural") continue
            val n = nounOf(gs.second)
            val plural = if (n != null) nouns[n.second]?.plural else null
            if (n == null || plural == null || plural == "-") continue
            assertEquals(form.prompt, "die $plural", form.answers[0])
            checked++
        }
        assertEquals(4, checked)
    }

    @Test fun changesOnlyMasculineNounsInTheAccusative() {
        var checked = 0
        val changes = mapOf("der" to "den", "ein" to "einen", "kein" to "keinen")
        for (form in forms) {
            val gs = groupAndSubject(form)
            if (gs == null || gs.first != "accusative") continue
            val n = nounOf(gs.second)
            val info = if (n != null) nouns[n.second] else null
            if (n == null || info == null) continue
            assertEquals("${form.prompt}: the drill is about the one gender that changes", "m", info.gender)
            assertEquals(form.prompt, "${changes[n.first] ?: "?"} ${n.second}", form.answers[0])
            checked++
        }
        assertEquals(3, checked)
    }

    @Test fun makesPossessiveAndIndefiniteFormsAgreeWithTheNoun() {
        var checked = 0
        for (form in forms) {
            val gs = groupAndSubject(form)
            if (gs == null || gs.first !in listOf("mein", "dein", "ein", "kein")) continue
            val n = nounOf(gs.second)
            val info = if (n != null) nouns[n.second] else null
            if (n == null || info == null) continue
            val plural = gs.second.startsWith("die ") && info.plural == "-"
            val ending = if (info.gender == "f" || plural) "e" else ""
            assertEquals(form.prompt, "${gs.first}$ending ${n.second}", form.answers[0])
            checked++
        }
        assertEquals(5, checked)
    }

    @Test fun spellsNumbersAsTheRulesSay() {
        val seen = HashSet<Int>()
        for (form in forms) {
            val gs = groupAndSubject(form)
            if (gs == null || gs.first != "in words" || !Regex("^[+-]?\\d+$").matches(gs.second)) continue
            val value = gs.second.toInt()
            assertEquals(form.prompt, if (numberWords[value] == "ein") "eins" else numberWords[value], form.answers[0])
            if (value in 13..19 && value != 16 && value != 17) assertEquals(numberWords[value - 10] + "zehn", form.answers[0])
            seen.add(value)
        }
        assertEquals(setOf(11, 12, 13, 16, 17, 20), seen)
        val taught = words.filter { !it.target.contains(" ") }.map { it.target }
        for ((value, name) in numberWords) {
            if (value > 10) continue
            val target = if (name == "ein") "eins" else name
            assertTrue("the number $value is not taught: $target", target in taught)
        }
    }

    @Test fun computesClockTimesFromTheDigits() {
        val hours = mapOf(1 to "ein", 2 to "zwei", 3 to "drei", 4 to "vier", 5 to "fünf", 6 to "sechs", 7 to "sieben", 8 to "acht", 9 to "neun", 10 to "zehn", 11 to "elf", 12 to "zwölf")
        var checked = 0
        for (form in forms) {
            val gs = groupAndSubject(form)
            if (gs == null || gs.first != "time") continue
            val parts = gs.second.split(":").mapNotNull { it.toIntOrNull() }
            assertEquals(form.prompt, 2, parts.size)
            val (hour, minute) = parts
            val next = (hour % 12) + 1
            val expected = when (minute) {
                0 -> "Es ist ${hours[hour]} Uhr."
                15 -> "Es ist Viertel nach ${hours[hour]}."
                30 -> "Es ist halb ${hours[next]}."
                45 -> "Es ist Viertel vor ${hours[next]}."
                else -> "?"
            }
            assertEquals(form.prompt, expected, form.answers[0])
            checked++
        }
        assertEquals(4, checked)
    }

    @Test fun followsTheCasesInContractionsAndPrepositionForms() {
        var checked = 0
        for (form in forms) {
            val gs = groupAndSubject(form) ?: continue
            val n = nounOf(gs.second)
            val info = if (n != null) nouns[n.second] else null
            if (n == null || info == null) continue
            val name = n.second
            when (gs.first) {
                "Wo? in" -> assertEquals(form.prompt, if (info.gender == "f") "in der $name" else "im $name", form.answers[0])
                "Wohin? in" -> assertEquals(form.prompt, if (info.gender == "m") "in den $name" else if (info.gender == "n") "ins $name" else "in die $name", form.answers[0])
                "zu" -> assertEquals(form.prompt, if (info.gender == "f") "zur $name" else "zum $name", form.answers[0])
                "on" -> {
                    assertEquals(form.prompt, "am $name", form.answers[0])
                    assertTrue(form.prompt, name in days)
                }
                else -> continue
            }
            checked++
        }
        assertEquals(7, checked)
    }

    // agreement in every text

    @Test fun letsArticlesAndPossessivesAgreeWithTheirNounsEverywhere() {
        fun kind(token: String): String? {
            val key = token.lowercase()
            if (key in pluralForms) return "p"
            return singularGender[key]
        }
        var checked = 0
        for (text in germanTexts) {
            val tokens = germanTokens(text)
            for (index in 0 until tokens.size - 1) {
                val token = tokens[index]
                val next = kind(tokens[index + 1]) ?: continue
                val previous = if (index > 0) tokens[index - 1].lowercase() else ""
                val lower = token.lowercase()
                val after = tokens[index + 1]
                if (lower == "ein" && after == "Uhr") continue // "ein Uhr" is the clock form of eins
                if (lower in listOf("ein", "kein", "mein", "dein")) assertTrue("$text: $token before $after", next == "m" || next == "n")
                else if (lower in listOf("eine", "keine", "meine", "deine")) assertTrue("$text: $token before $after", next == "f" || next == "p")
                else if (lower == "einen" || lower == "keinen") assertEquals("$text: $token before $after", "m", next)
                else if (lower == "den") assertTrue("$text: den before $after", next == "m")
                else if (lower == "der") assertTrue("$text: der before $after", next == "m" || (next == "f" && previous in listOf("in", "zu")))
                else if (lower == "die") assertTrue("$text: die before $after", next == "f" || next == "p")
                else if (lower == "das") assertEquals("$text: das before $after", "n", next)
                else if (lower == "im" || lower == "zum") assertTrue("$text: $token before $after", next == "m" || next == "n")
                else if (lower == "ins") assertEquals("$text: ins before $after", "n", next)
                else if (lower == "zur") assertEquals("$text: zur before $after", "f", next)
                else continue
                checked++
            }
        }
        assertTrue(checked >= 80)
    }

    @Test fun writesEveryNounWithACapitalLetter() {
        val all = nouns.keys.map { it.lowercase() }.toSet() + pluralForms
        for (text in germanTexts) {
            for (token in germanTokens(text)) {
                if (token.lowercase() in all) assertTrue("$text: $token is a noun and needs a capital", isUpper(firstChar(token)))
            }
        }
    }

    // sentences and glosses

    @Test fun hasShortWellFormedSentencesThatAreNeverRepeated() {
        val seen = HashSet<String>()
        units.forEachIndexed { index, unit ->
            for (sentence in unit.sentences) {
                val tokens = germanTokens(sentence.target)
                assertTrue("unit ${index + 1}: too long to type: ${sentence.target}", tokens.size <= 8)
                assertTrue("starts with a capital: ${sentence.target}", isUpper(firstChar(sentence.target)))
                assertTrue("ends with a mark: ${sentence.target}", ".?!".contains(lastChar(sentence.target) ?: "x"))
                assertTrue("repeated: ${sentence.target}", seen.add(folded(sentence.target)))
                assertTrue(sentence.meanings.isNotEmpty())
                for (meaning in sentence.meanings) {
                    val bare = meaning.split(" (formal)").joinToString("")
                    assertTrue("the translation ends with a mark: $meaning", ".?!".contains(lastChar(bare) ?: "x"))
                }
            }
        }
    }

    @Test fun leavesNoGermanInTheTranslations() {
        val german = setOf(
            "ich", "du", "er", "wir", "ihr", "ist", "sind", "bin", "bist", "und", "der", "die", "das", "ein", "eine", "einen",
            "nicht", "kein", "keine", "mein", "meine", "habe", "hat", "hast", "heißt", "heiße", "wie", "wo", "was", "gut",
            "danke", "hallo", "nach", "aus", "im", "ins", "zum", "heute", "dort", "hier",
        )
        val names = setOf("müller", "weber", "anna", "max", "peter", "julia", "berlin")
        for (sentence in sentences) {
            for (meaning in sentence.meanings) {
                for (token in germanTokens(meaning)) {
                    val lower = token.lowercase()
                    assertFalse("$meaning: $token is German", lower in german)
                    if (lower !in names) assertFalse("$meaning: $token has a German letter", chars(lower).any { "äöüß".contains(it) })
                }
            }
        }
        for (word in words) {
            for (meaning in word.meanings) {
                if (meaning.contains("Sie")) continue
                assertFalse("${word.target}: $meaning", chars(meaning).any { "äöüß".contains(it) })
            }
        }
    }

    @Test fun sharesNoMeaningBetweenTwoWords() {
        val owner = HashMap<String, String>()
        for (word in words) for (meaning in word.meanings) {
            val key = folded(meaning)
            val other = owner[key]
            if (other != null && other != word.target) fail("\"$meaning\" means $other and ${word.target}")
            owner[key] = word.target
        }
    }

    @Test fun hasFillsWithOneRightChoiceAndFactsAsQuestions() {
        for (fill in fills) {
            assertEquals("exactly one blank: ${fill.sentence}", 2, fill.sentence.split("___").size)
            assertEquals("a choice twice: ${fill.sentence}", fill.options.size, fill.options.toSet().size)
            assertTrue("three choices are enough: ${fill.sentence}", fill.options.size in 3..4)
        }
        for (fact in facts) {
            assertEquals("a choice twice: ${fact.question}", fact.wrong.size + 1, (listOf(fact.answer) + fact.wrong).toSet().size)
            assertTrue(fact.question, fact.question.endsWith("?"))
        }
    }

    @Test fun isTaughtInEnglishWithGermanExamples() {
        for (unit in units) {
            for (phrase in listOf("Dies ist", "Das bedeutet", "Man sagt", "Beachte")) assertFalse("${unit.title}: $phrase", unit.tip.contains(phrase))
            assertNotEquals("", unit.title)
            assertNotEquals("", unit.summary)
        }
        assertFalse(source.contains("😀"))
    }

    @Test fun coversAUnitsNewItemsInItsLessons() {
        for (number in 1..8) {
            val unit = Languages.daf.course.units[number - 1]
            assertEquals(unit.title, 5, unit.nodes.count { it.kind == NodeKind.LESSON })
            for (node in unit.nodes) {
                if (node.kind == NodeKind.CHEST) continue
                val exercises = Languages.daf.exercises(node, 7uL)
                assertTrue(node.id, exercises.size >= 8)
                assertTrue(node.id, exercises.map { it.kind }.toSet().size >= 2)
            }
        }
    }
}

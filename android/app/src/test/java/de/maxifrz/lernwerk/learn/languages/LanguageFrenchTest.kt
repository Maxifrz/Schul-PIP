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

// Independent reference data (typed here again, not read from the course)
private val persons = listOf("je", "tu", "il", "nous", "vous", "ils")
private val endings = mapOf("je" to "e", "tu" to "es", "il" to "e", "nous" to "ons", "vous" to "ez", "ils" to "ent")
private val irregular: Map<String, Map<String, String>> = mapOf(
    "être" to mapOf("je" to "suis", "tu" to "es", "il" to "est", "nous" to "sommes", "vous" to "êtes", "ils" to "sont"),
    "avoir" to mapOf("je" to "j'ai", "tu" to "as", "il" to "a", "nous" to "avons", "vous" to "avez", "ils" to "ont"),
    "aller" to mapOf("je" to "vais", "tu" to "vas", "il" to "va", "nous" to "allons", "vous" to "allez", "ils" to "vont"),
    "boire" to mapOf("je" to "bois", "tu" to "bois", "il" to "boit", "nous" to "buvons", "vous" to "buvez", "ils" to "boivent"),
    "s'appeler" to mapOf("je" to "m'appelle", "tu" to "t'appelles", "il" to "s'appelle", "nous" to "nous appelons", "vous" to "vous appelez", "ils" to "s'appellent"),
)
private val regularVerbs = listOf("parler", "habiter", "aimer", "écouter", "regarder", "travailler", "jouer", "manger")

private val nouns = mapOf(
    "mère" to "f",
    "père" to "m",
    "frère" to "m",
    "sœur" to "f",
    "fils" to "m",
    "fille" to "f",
    "grand-père" to "m",
    "grand-mère" to "f",
    "parents" to "p",
    "chat" to "m",
    "livre" to "m",
    "table" to "f",
    "stylo" to "m",
    "chaise" to "f",
    "cahier" to "m",
    "trousse" to "f",
    "sac" to "m",
    "école" to "f",
    "ami" to "m",
    "amie" to "f",
    "pain" to "m",
    "eau" to "f",
    "café" to "m",
    "fromage" to "m",
    "lait" to "m",
    "viande" to "f",
    "pomme" to "f",
    "gare" to "f",
    "parc" to "m",
    "poste" to "f",
    "cinéma" to "m",
    "ville" to "f",
    "rue" to "f",
    "boulangerie" to "f",
    "maison" to "f",
    "français" to "m",
    "allemand" to "m",
)

private val gloss = mapOf(
    "bonjour" to "tag",
    "je" to "ich",
    "salut" to "hallo",
    "tu" to "du",
    "ça va" to "geht",
    "merci" to "danke",
    "être" to "sein",
    "oui" to "ja",
    "nous" to "wir",
    "vous" to "sie",
    "il" to "er",
    "elle" to "sie",
    "au revoir" to "wiedersehen",
    "avoir" to "haben",
    "la mère" to "mutter",
    "le père" to "vater",
    "mon, ma, mes" to "mein",
    "le frère" to "bruder",
    "la sœur" to "schwester",
    "ton, ta, tes" to "dein",
    "le fils" to "sohn",
    "la fille" to "tochter",
    "les parents" to "eltern",
    "le grand-père" to "großvater",
    "la grand-mère" to "großmutter",
    "son, sa, ses" to "seine",
    "le chat" to "katze",
    "deux" to "zwei",
    "ans" to "jahre",
    "trois" to "drei",
    "quel âge" to "alt",
    "quatre" to "vier",
    "cinq" to "fünf",
    "six" to "sechs",
    "sept" to "sieben",
    "huit" to "acht",
    "neuf" to "neun",
    "dix" to "zehn",
    "rouge" to "rot",
    "bleu" to "blau",
    "blanc" to "weiß",
    "noir" to "schwarz",
    "le livre" to "buch",
    "c'est" to "das ist",
    "la table" to "tisch",
    "voilà" to "da ist",
    "le stylo" to "kugelschreiber",
    "la chaise" to "stuhl",
    "le cahier" to "heft",
    "la trousse" to "mäppchen",
    "le sac" to "tasche",
    "l'école" to "schule",
    "l'ami" to "freund",
    "l'amie" to "freundin",
    "parler" to "sprechen",
    "le français" to "französisch",
    "habiter" to "wohnen",
    "à" to "nach",
    "aimer" to "mögen",
    "beaucoup" to "viel",
    "l'allemand" to "deutsch",
    "bien" to "gut",
    "écouter" to "zuhören",
    "regarder" to "anschauen",
    "travailler" to "arbeiten",
    "jouer" to "spielen",
    "manger" to "essen",
    "le pain" to "brot",
    "boire" to "trinken",
    "l'eau" to "wasser",
    "avoir faim" to "hunger",
    "avoir soif" to "durst",
    "le café" to "kaffee",
    "le fromage" to "käse",
    "s'il vous plaît" to "bitte",
    "je voudrais" to "möchte",
    "le lait" to "milch",
    "la viande" to "fleisch",
    "la pomme" to "apfel",
    "aller" to "gehen",
    "le cinéma" to "kino",
    "la gare" to "bahnhof",
    "le parc" to "park",
    "dans" to "in",
    "chez" to "bei",
    "la poste" to "post",
    "la ville" to "stadt",
    "à côté de" to "neben",
    "il y a" to "gibt",
    "la boulangerie" to "bäckerei",
    "la rue" to "straße",
    "la maison" to "haus",
    "ne … pas" to "nicht",
    "comment" to "wie",
    "où" to "wo",
    "qui" to "wer",
    "quand" to "wann",
    "pourquoi" to "warum",
    "parce que" to "weil",
    "combien" to "wie viel",
    "quelle heure" to "spät",
    "et demie" to "halbe",
    "midi" to "zwölf",
    "et quart" to "viertel nach",
    "moins le quart" to "viertel vor",
)

private val numbers = mapOf(
    "deux" to "zwei",
    "trois" to "drei",
    "quatre" to "vier",
    "cinq" to "fünf",
    "six" to "sechs",
    "sept" to "sieben",
    "huit" to "acht",
    "neuf" to "neun",
    "dix" to "zehn",
    "onze" to "elf",
    "douze" to "zwölf",
    "quinze" to "fünfzehn",
    "vingt" to "zwanzig",
)

private val colors = mapOf(
    "rouge" to "rot",
    "bleu" to "blau",
    "bleue" to "blau",
    "blanc" to "weiß",
    "blanche" to "weiß",
    "noir" to "schwarz",
    "noire" to "schwarz",
)


/** Port of FrenchCourseTests.swift. */
class LanguageFrenchTest {
    private val made = LanguageCourseProvider.make(LanguageTexts5.text("fr"))
    private val provider = Languages.fr
    private val data = provider.data
    private val units = data.units
    private val words = units.flatMap { it.words }
    private val sentences = units.flatMap { it.sentences }
    private val forms = units.flatMap { it.forms }
    private val fills = units.flatMap { it.fills }
    private val facts = units.flatMap { it.facts }

    /** The words of a French text, lower case, without the punctuation around them; apostrophes inside stay. */
    private fun frenchWords(text: String): List<String> =
        text.split(Regex("\\p{IsWhite_Space}+")).filter { it.isNotEmpty() }
            .map { p -> trimWith(p) { c -> c != "'" && (isPunct(c) || c == "\t" || Regex("^\\p{Zs}$").matches(c)) }.lowercase() }
            .filter { it.isNotEmpty() }

    private fun expectedForm(verb: String, person: String): String? {
        val table = irregular[verb]
        if (table != null) return table[person]
        val ending = endings[person]
        if (!verb.endsWith("er") || ending == null) return null
        var stem = dropLast(verb, 2)
        if (person == "nous" && stem.endsWith("g")) stem += "e"
        val first = firstChar(stem)
        if (person == "je" && first != null && "aeiouéèêàâîôûh".contains(first)) return "j'$stem$ending"
        return stem + ending
    }

    /** Every text a student reads in French: words, sentences, form answers, fills with their right choice put in. */
    private val frenchTexts: List<String> =
        words.map { it.target } + sentences.map { it.target } + forms.flatMap { it.answers } +
            fills.filter { it.options.isNotEmpty() }.map { it.sentence.split("___").joinToString(it.options[0]) }

    private fun negated(sentence: String): String {
        val tokens = sentence.split(" ").filter { it.isNotEmpty() }.toMutableList()
        var subject = tokens.removeAt(0)
        val verb: String
        if (subject.startsWith("j'")) {
            verb = dropFirst(subject, 2)
            subject = "je"
        } else {
            verb = tokens.removeAt(0)
        }
        val vowel = "aeiouéèêh".contains(firstChar(verb) ?: "x")
        val rest = tokens
        if (rest.isNotEmpty() && rest[0] in listOf("un", "une", "du", "des")) rest[0] = "de"
        return (listOf(subject, if (vowel) "n'$verb" else "ne $verb", "pas") + rest).joinToString(" ")
    }

    // shape

    @Test fun parsesAndHasNoContentProblems() = assertEquals(emptyList<String>(), made.second)

    @Test fun hasTheHeaderAndProviderTheCatalogExpects() {
        assertEquals("fr", data.id)
        assertEquals("Französisch", data.title)
        assertEquals("Für Deutschsprachige · A1", data.subtitle)
        assertEquals(CourseKind.LANGUAGE, data.kind)
        assertEquals(0x5a7fc4, data.color)
        assertEquals("text.bubble.fill", data.symbol)
        assertEquals("fr-FR", data.speech)
        assertEquals(LanguageInstruction.DE, data.instruction)
        assertEquals("Französisch", data.targetName)
        assertEquals("Französische", data.intoName)
        assertTrue(data.produces)
        assertEquals("fr", provider.course.id)
        assertEquals(8, provider.course.units.size)
        assertEquals(units.map { it.title }, provider.course.units.map { it.title })
    }

    @Test fun passesTheEngineAudit() = assertEquals(emptyList<String>(), CourseAudit.problems(provider, (1..3).map { it.toULong() }))

    @Test fun teachesEveryWordOfASentenceBefore() =
        assertEquals(emptyList<String>(), LanguageCoverage.gaps(data).map { LanguageCoverage.describe(it) })

    @Test fun hasTheAgreedSize() {
        assertEquals(8, units.size)
        assertTrue(words.size >= 100)
        assertTrue(sentences.size >= 50)
        assertTrue(forms.size >= 35)
        assertTrue(fills.size >= 20)
        assertTrue(facts.size >= 12)
        units.forEachIndexed { index, unit ->
            val place = "unit ${index + 1} ${unit.title}"
            assertTrue("$place: ${unit.itemCount} items", unit.itemCount in 22..30)
            assertTrue("$place: words", unit.words.size in 10..16)
            assertTrue("$place: sentences", unit.sentences.size in 6..10)
            assertTrue("$place: forms", unit.forms.size in 3..6)
            assertTrue("$place: fills", unit.fills.size in 2..4)
            assertTrue("$place: facts", unit.facts.size in 1..3)
            assertEquals(place, 5, LanguageCourseProvider.lessonCount(unit))
            val tips = unit.tip.split("\n\n")
            assertTrue("$place: ${tips.size} tip paragraphs", tips.size in 3..5)
            for (tip in tips) {
                assertTrue("$place: a tip paragraph that is too short", count(tip) > 120)
                assertTrue("$place: a tip paragraph that is too long", count(tip) < 800)
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

    // verbs

    @Test fun hasTheRightFormForEveryPerson() {
        var checked = 0
        for (form in forms) {
            val p = form.prompt.split(", ")
            if (p.size != 2 || p[1] !in persons) continue
            val expected = expectedForm(p[0], p[1])
            assertNotNull("a form of a verb the test does not know: ${form.prompt}", expected)
            assertEquals(form.prompt, expected, form.answers[0])
            checked++
        }
        assertTrue(checked >= 20)
    }

    @Test fun hasEveryVerbTableOfAWordNoteWithSixPersonsAndTheRightForms() {
        var tables = 0
        for (word in words) {
            val colon = word.note.indexOf(':')
            if (colon < 0 || !(word.note.startsWith("unregelmäßig") || word.note.startsWith("Verb auf -er"))) continue
            val verb = word.target
            val entries = word.note.substring(colon + 1).split(", ").map { it.trim() }
            if (word.note.startsWith("unregelmäßig")) {
                assertEquals("$verb: a full table has six persons", 6, entries.size)
                assertTrue("$verb is not in the reference table", irregular[verb] != null)
            }
            for (entry in entries) {
                val person: String
                val form: String
                if (entry.startsWith("j'")) {
                    person = "je"
                    form = entry
                } else {
                    val space = entry.indexOf(' ')
                    val pieces = if (space < 0) listOf(entry) else listOf(entry.substring(0, space), entry.substring(space + 1))
                    assertEquals("$verb: $entry", 2, pieces.size)
                    if (pieces.size != 2) continue
                    person = pieces[0]
                    form = pieces[1]
                }
                assertEquals("$verb: $entry", expectedForm(verb, person), form)
            }
            if (word.note.startsWith("unregelmäßig")) {
                val order = entries.map { if (it.startsWith("j'")) "je" else it.split(" ")[0] }
                assertEquals("$verb: the persons come in the usual order", persons, order)
            }
            tables++
        }
        assertTrue(tables >= 7)
    }

    @Test fun showsEveryDrilledVerbFormInTheUnitTip() {
        units.forEachIndexed { index, unit ->
            for (form in unit.forms) {
                val p = form.prompt.split(", ")
                if (p.size != 2 || p[1] !in persons || form.answers.isEmpty()) continue
                assertTrue("unit ${index + 1}: the tip never shows ${form.answers[0]} (${form.prompt})", unit.tip.contains(form.answers[0]))
            }
        }
    }

    // derived forms

    @Test fun everyDerivedFormFollowsItsRule() {
        val numberWords = mapOf("11" to "onze", "12" to "douze", "13" to "treize", "14" to "quatorze", "15" to "quinze", "16" to "seize", "20" to "vingt")
        val feminine = mapOf("noir" to "noire", "blanc" to "blanche", "bleu" to "bleue", "rouge" to "rouge", "vert" to "verte")
        val seen = HashSet<String>()
        for (form in forms) {
            val comma = form.prompt.indexOf(',')
            if (comma < 0 || form.answers.isEmpty()) continue
            val answer = form.answers[0]
            val group = form.prompt.substring(0, comma)
            val subject = form.prompt.substring(comma + 2)
            seen.add(group)
            when (group) {
                "Plural" -> {
                    val noun = if (subject.startsWith("l'")) dropFirst(subject, 2) else subject.split(" ").drop(1).joinToString(" ")
                    assertEquals(form.prompt, "les ${noun}s", answer)
                }
                "weiblich" -> assertEquals(form.prompt, feminine[subject], answer)
                "Teilungsartikel" ->
                    if (subject.startsWith("le ")) assertEquals(form.prompt, "du " + dropFirst(subject, 3), answer)
                    else if (subject.startsWith("la ")) assertEquals(form.prompt, "de la " + dropFirst(subject, 3), answer)
                    else if (subject.startsWith("l'")) assertEquals(form.prompt, "de l'" + dropFirst(subject, 2), answer)
                    else fail("unexpected: ${form.prompt}")
                "à + Artikel" ->
                    if (subject.startsWith("le ")) assertEquals(form.prompt, "au " + dropFirst(subject, 3), answer)
                    else if (subject.startsWith("la ")) assertEquals(form.prompt, "à la " + dropFirst(subject, 3), answer)
                    else if (subject.startsWith("l'")) assertEquals(form.prompt, "à l'" + dropFirst(subject, 2), answer)
                    else if (subject.startsWith("les ")) assertEquals(form.prompt, "aux " + dropFirst(subject, 4), answer)
                    else fail("unexpected: ${form.prompt}")
                "Zahl in Worten" -> assertEquals(form.prompt, numberWords[subject], answer)
                "Frage mit est-ce que" -> assertEquals(form.prompt, "est-ce que $subject", answer)
                "verneinen" -> assertEquals(form.prompt, negated(subject), answer)
                else -> {}
            }
        }
        for (group in listOf("Plural", "weiblich", "Teilungsartikel", "à + Artikel", "Zahl in Worten", "Frage mit est-ce que", "verneinen")) {
            assertTrue("no form drills $group", group in seen)
        }
    }

    @Test fun fillsWithVerbsHaveExactlyTheRightFormForTheirSubject() {
        val subjects = mapOf(
            "je" to "je", "tu" to "tu", "il" to "il", "elle" to "il", "léa" to "il", "paul" to "il", "frère" to "il", "sœur" to "il",
            "nous" to "nous", "vous" to "vous", "ils" to "ils", "elles" to "ils", "amis" to "ils", "parents" to "ils",
        )
        val byForm = HashMap<String, MutableSet<String>>()
        fun add(form: String, person: String) { byForm.getOrPut(form) { mutableSetOf() }.add(person) }
        for (table in irregular.values) for ((person, form) in table) add(form, person)
        for (verb in regularVerbs) for (person in persons) {
            val form = expectedForm(verb, person)
            if (form != null) add(form, person)
        }
        var checked = 0
        for (fill in fills) {
            val blank = fill.sentence.indexOf("___")
            if (blank < 0) continue
            val lastWord = frenchWords(fill.sentence.substring(0, blank)).lastOrNull() ?: continue
            val person = subjects[lastWord] ?: continue
            if (fill.options.size < 2) continue
            val right = fill.options[0]
            assertTrue("${fill.sentence}: $right does not go with $lastWord", byForm[right]?.contains(person) == true)
            val matching = fill.options.filter { byForm[it]?.contains(person) == true }
            if (matching.size == 1) assertEquals("${fill.sentence}: a wrong choice also fits $lastWord", listOf(right), matching)
            checked++
        }
        assertTrue(checked >= 12)
    }

    // nouns, genders, agreement

    @Test fun givesEveryNounItsGenderNoteAndAnArticleThatAgrees() {
        var checked = 0
        for (word in words) {
            val target = word.target
            val article: String
            val noun: String
            val space = target.indexOf(' ')
            if (target.startsWith("l'")) {
                article = "l'"
                noun = dropFirst(target, 2)
            } else if (space >= 0 && target.substring(0, space) in listOf("le", "la", "les")) {
                article = target.substring(0, space)
                noun = target.substring(space + 1)
            } else continue
            val gender = nouns[noun]
            assertNotNull("a noun the test does not know: $target", gender)
            if (gender == null) continue
            val note = word.note.split(";")[0].trim()
            if (gender == "m") {
                assertEquals(target, "m", note)
                assertTrue("$target is masculine", article == "le" || article == "l'")
            } else if (gender == "f") {
                assertEquals(target, "f", note)
                assertTrue("$target is feminine", article == "la" || article == "l'")
            } else {
                assertEquals(target, "Plural", note)
                assertEquals("les", article)
            }
            checked++
        }
        assertTrue(checked >= 35)
    }

    @Test fun teachesNoNounWithoutItsArticle() {
        for (word in words) assertNull("${word.target} is taught without its article", nouns[word.target])
    }

    @Test fun letsPossessivesAndArticlesAgreeWithTheirNounsInEveryText() {
        val masculine = nouns.filterValues { it == "m" }.keys
        val feminine = nouns.filterValues { it == "f" }.keys
        val vowels = "aeiouéèêh"
        for (text in frenchTexts) {
            val tokens = frenchWords(text)
            tokens.dropLast(1).forEachIndexed { index, token ->
                val next = tokens[index + 1]
                when (token) {
                    "ma", "ta", "sa" -> {
                        assertFalse("$text: before a vowel it is mon/ton/son", vowels.contains(firstChar(next) ?: "x"))
                        assertFalse("$text: $token before masculine $next", next in masculine)
                    }
                    "mon", "ton", "son" ->
                        assertFalse("$text: $token before feminine $next", next in feminine && !vowels.contains(firstChar(next) ?: "x"))
                    "un" -> assertFalse("$text: un before feminine $next", next in feminine)
                    "une" -> assertFalse("$text: une before masculine $next", next in masculine)
                    else -> {}
                }
            }
        }
    }

    // spelling, elision, contractions

    @Test fun hasNoBrokenElisionOrContraction() {
        val vowelStart = "aeiouéèêâîôûàh"
        for (text in frenchTexts) {
            val tokens = frenchWords(text)
            tokens.forEachIndexed { index, token ->
                if (index + 1 >= tokens.size) return@forEachIndexed
                val next = tokens[index + 1]
                if (token in listOf("je", "ne", "me", "te", "se", "le", "la", "de", "que", "ce", "si") && vowelStart.contains(firstChar(next) ?: "x")) {
                    fail("$text: $token $next needs an apostrophe")
                }
                if (token == "de" && (next == "le" || next == "les")) fail("$text: de $next is du/des")
                if (token == "à" && (next == "le" || next == "les")) fail("$text: à $next is au/aux")
            }
            assertFalse("$text: use the plain apostrophe so that typing works", text.contains("’"))
            assertFalse("$text: double space", text.contains("  "))
        }
    }

    @Test fun missesNoAccent() {
        val unaccented = setOf(
            "etre", "pere", "mere", "frere", "soeur", "cafe", "ecole", "voila", "cinema", "age", "francais", "plait", "ecoute",
            "ecouter", "ecoutons", "cote", "ca", "lecole", "meme", "ete", "deja", "tres", "apres", "bientot", "grandpere",
            "grandmere", "lecole",
        )
        for (text in frenchTexts + fills.flatMap { it.options }) {
            for (token in lettersOnly(text)) if (token in unaccented) fail("$text: $token needs its accent")
        }
    }

    @Test fun keepsSentencesShortWellFormedAndEndingInPunctuation() {
        for (sentence in sentences) {
            val n = frenchWords(sentence.target).size
            assertTrue("${sentence.target}: $n words", n <= 8)
            assertTrue(sentence.target, isUpper(firstChar(sentence.target)))
            assertTrue(sentence.target, ".?!".contains(lastChar(sentence.target) ?: "x"))
            if (sentence.target.endsWith(" ?") || sentence.target.endsWith(" !")) continue
            assertFalse("French puts a space before ? and !: ${sentence.target}", sentence.target.endsWith("?") || sentence.target.endsWith("!"))
        }
    }

    @Test fun repeatsNoSentenceAcrossTheCourse() {
        val seen = HashSet<String>()
        for (sentence in sentences) assertTrue("repeated: ${sentence.target}", seen.add(folded(sentence.target)))
        val answers = forms.flatMap { it.answers }.map { folded(it) }.toSet()
        for (sentence in sentences) assertFalse("a form answer is also a sentence: ${sentence.target}", folded(sentence.target) in answers)
    }

    // German side

    @Test fun hasNoLeftoverFrenchAndMatchesInPunctuation() {
        val frenchOnlyLetters = chars("àâçèêëîïôùûœ").toSet()
        val frenchFunctionWords = setOf(
            "le", "la", "les", "un", "une", "je", "tu", "il", "elle", "nous", "vous", "ils", "elles", "est", "et", "de", "pas", "ne",
            "au", "aux", "dans", "chez", "sont", "suis", "oui", "non", "mon", "ma", "mes", "ton", "ta", "tes", "sa", "ses",
            "merci", "bonjour", "salut", "voilà", "c", "j", "l", "qu",
        )
        val names = listOf("Léa", "Léas")
        fun check(meaning: String, context: String) {
            var text = meaning
            for (name in names) text = text.split(name).joinToString("")
            assertEquals("$context: French letters in the German: $meaning", emptyList<String>(), chars(text).filter { it in frenchOnlyLetters })
            assertEquals(context, trimWith(meaning) { it == "\t" || Regex("^\\p{Zs}$").matches(it) }, meaning)
            for (token in lettersOnly(text)) if (token in frenchFunctionWords) fail("$context: leftover French word \"$token\" in $meaning")
        }
        for (sentence in sentences) {
            for (meaning in sentence.meanings) {
                check(meaning, sentence.target)
                assertEquals("${sentence.target} / $meaning: the sentence ends the same way", lastChar(sentence.target), lastChar(meaning))
            }
        }
        for (word in words) for (meaning in word.meanings) if (!meaning.startsWith("Viertel")) check(meaning, word.target)
    }

    @Test fun letsTheSubjectOfASentenceSurviveTranslation() {
        val german = mapOf("je" to listOf("ich"), "j" to listOf("ich"), "tu" to listOf("du"), "nous" to listOf("wir"), "vous" to listOf("sie", "ihr"))
        var checked = 0
        for (sentence in sentences) {
            val first = lettersOnly(sentence.target).firstOrNull() ?: ""
            val expected = german[first]
            val meaning = sentence.meanings.firstOrNull()
            if (expected == null || meaning == null) continue
            assertTrue("${sentence.target} / $meaning", lettersOnly(meaning).any { it in expected })
            checked++
        }
        assertTrue(checked >= 20)
    }

    @Test fun translatesNumbersAndColorsWithTheRightWord() {
        var checked = 0
        for (sentence in sentences) {
            val meaning = sentence.meanings.firstOrNull()?.lowercase() ?: continue
            for (token in lettersOnly(sentence.target)) {
                val number = numbers[token]
                if (number != null) { assertTrue("${sentence.target} / $meaning", meaning.contains(number)); checked++ }
                val color = colors[token]
                if (color != null) { assertTrue("${sentence.target} / $meaning", meaning.contains(color)); checked++ }
            }
        }
        assertTrue(checked >= 8)
        for (word in words) {
            val number = numbers[word.target]
            if (number != null) assertEquals(number, word.meanings[0])
            val color = colors[word.target]
            if (color != null) assertEquals(color, word.meanings[0])
        }
    }

    @Test fun hasTheGermanKeyWordInEveryFirstMeaning() {
        for (word in words) {
            val stem = gloss[word.target]
            assertNotNull("a word the test has no gloss for: ${word.target}", stem)
            if (stem == null) continue
            assertTrue("${word.target}: ${word.meanings}", word.meanings.firstOrNull()?.lowercase()?.contains(stem) == true)
        }
        assertEquals("the reference list and the course list the same words", words.size, gloss.size)
    }

    @Test fun saysAgeWithAvoirAndCountsTimeTheFrenchWay() {
        for (sentence in sentences.filter { "ans" in lettersOnly(it.target) }) {
            val tokens = lettersOnly(sentence.target)
            assertFalse(sentence.target, tokens.contains("suis") || tokens.contains("est"))
            assertTrue(sentence.meanings[0], sentence.meanings[0].contains("Jahre alt"))
        }
        val demie = facts.firstOrNull { it.question.contains("trois heures et demie") }
        assertEquals("3:30 Uhr", demie?.answer)
        assertEquals(1, facts.count { it.question.contains("trois heures et demie") })
    }

    // fills and facts

    @Test fun hasOneBlankAndDistinctChoicesInEveryFill() {
        for (fill in fills) {
            assertEquals(fill.sentence, 2, fill.sentence.split("___").size)
            assertTrue(fill.sentence, fill.options.size in 2..4)
            assertEquals("${fill.sentence}: choices that read the same", fill.options.size, fill.options.map { folded(it) }.toSet().size)
            for (text in fill.options.drop(1).map { fill.sentence.split("___").joinToString(it) }) {
                assertFalse("a wrong choice is a sentence of the course: $text", sentences.any { folded(it.target) == folded(text) })
            }
        }
    }

    @Test fun hasDistinctAnswersInEveryFact() {
        for (fact in facts) {
            val all = listOf(fact.answer) + fact.wrong
            assertTrue(fact.question, all.size in 2..4)
            assertEquals("${fact.question}: answers that read the same", all.size, all.map { folded(it) }.toSet().size)
        }
    }

    // teaching order and the engine

    private class Entry(val position: Double, val order: Int, val kind: Int, val index: Int)

    /** Which lesson (0 based) teaches an item, worked out as the engine cuts a unit. */
    private fun lesson(index: Int, kind: Int, unit: LanguageUnitData): Int {
        val counts = listOf(unit.words.size, unit.sentences.size, unit.forms.size, unit.fills.size, unit.facts.size)
        val all = mutableListOf<Entry>()
        counts.forEachIndexed { order, c -> for (i in 0 until c) all.add(Entry((i + 0.5) / c, order, order, i)) }
        val sorted = all.sortedWith { a, b -> if (a.position != b.position) a.position.compareTo(b.position) else a.order.compareTo(b.order) }
        val lessons = LanguageCourseProvider.lessonCount(unit)
        val place = maxOf(0, sorted.indexOfFirst { it.kind == kind && it.index == index })
        val found = (0..lessons - 1).firstOrNull { l -> place < sorted.size * (l + 1) / lessons }
        return found ?: (lessons - 1)
    }

    @Test fun letsASentenceOnlyUseWordsTaughtInItsLessonOrEarlier() {
        var known = HashSet<String>()
        for (unit in units) {
            val lessons = LanguageCourseProvider.lessonCount(unit)
            val taught = List(lessons) { HashSet<String>() }
            unit.words.forEachIndexed { i, w -> LanguageCoverage.tokens(w.target).forEach { taught[lesson(i, 0, unit)].add(it) } }
            unit.forms.forEachIndexed { i, f -> f.answers.flatMap { LanguageCoverage.tokens(it) }.forEach { taught[lesson(i, 2, unit)].add(it) } }
            unit.fills.forEachIndexed { i, f -> if (f.options.isNotEmpty()) LanguageCoverage.tokens(f.options[0]).forEach { taught[lesson(i, 3, unit)].add(it) } }
            val unitKnown = unit.known.flatMap { LanguageCoverage.tokens(it) }.toSet()
            unit.sentences.forEachIndexed { i, sentence ->
                val place = lesson(i, 1, unit)
                val available = HashSet<String>(known)
                available.addAll(unitKnown)
                for (l in 0..place) available.addAll(taught[l])
                val late = LanguageCoverage.tokens(sentence.target).filter { it !in available }
                assertEquals("${unit.title}, lesson ${place + 1}: ${sentence.target} uses words taught later", emptyList<String>(), late)
            }
            known = HashSet(known + unitKnown)
            for (tokens in taught) known.addAll(tokens)
        }
    }

    @Test fun meetsTheStudentWithEveryWordAndSentenceInAtLeastThreeFormsWithinTheUnit() {
        units.forEachIndexed { index, unit ->
            val seen = formsByCard(provider, index, listOf(1, 2, 3, 4))
            unit.words.forEachIndexed { i, w -> assertTrue(w.target, (seen["w$index-$i"]?.size ?: 0) >= 3) }
            unit.sentences.forEachIndexed { i, s -> assertTrue(s.target, (seen["s$index-$i"]?.size ?: 0) >= 3) }
            unit.forms.forEachIndexed { i, f -> assertTrue(f.prompt, (seen["f$index-$i"]?.size ?: 0) >= 2) }
        }
    }

    @Test fun forgivesAccentsAndApostrophesInTypedFrenchButNotLetters() {
        fun typed(answer: String, unit: Int): LearnExercise {
            val node = provider.course.nodes.first { it.id == "fr.u${unit.toString().padStart(2, '0')}.t" }
            val pool = (1..80).flatMap { provider.exercises(node, it.toULong()) }
            val found = pool.firstOrNull { it.kind == ExerciseKind.TYPE_ANSWER && it.mode == AnswerMode.EXACT && it.correctAnswers == listOf(answer) }
            assertNotNull(answer, found)
            return found!!
        }
        fun miss(e: LearnExercise, text: String) = e.missedKeys(LearnAnswer.Typed(text)).size
        val etes = typed("êtes", 1)
        assertEquals(0, miss(etes, "etes"))
        assertEquals(0, miss(etes, "Êtes"))
        assertNotEquals(0, miss(etes, "êtez"))
        val jai = typed("j'ai", 2)
        assertEquals(0, miss(jai, "j'ai"))
        assertEquals(0, miss(jai, "jai"))
        assertNotEquals(0, miss(jai, "je ai"))
        val sentence = typed("Je vais à la gare.", 7)
        assertEquals(0, miss(sentence, "je vais a la gare"))
        assertNotEquals(0, miss(sentence, "je vais a la garage"))
        assertNotEquals("word order matters", 0, miss(sentence, "a la gare je vais"))
    }

    @Test fun usesTheFrenchVoiceForEverySpokenExercise() {
        var spoken = 0
        for (node in provider.course.nodes) {
            if (node.kind == NodeKind.CHEST) continue
            for (exercise in provider.exercises(node, 3uL)) {
                val m = exercise.media
                if (m is ExerciseMedia.Speech) {
                    assertEquals("fr-FR", m.language)
                    assertNotEquals("", m.text)
                    spoken++
                }
            }
        }
        assertTrue(spoken > 100)
    }

    @Test fun givesTheSameLessonForTheSameSeedAndBringsEarlierUnitsBackInPractice() {
        val lessonNode = provider.course.nodes.first { it.id == "fr.u03.l2" }
        assertEquals(provider.exercises(lessonNode, 5uL), provider.exercises(lessonNode, 5uL))
        val practice = provider.course.nodes.first { it.id == "fr.u06.p" }
        val ids = (1..10).flatMap { seed -> provider.exercises(practice, seed.toULong()).map { it.id } }
        assertTrue(ids.any { it.contains("#w5-") || it.contains("#s5-") })
        assertTrue(ids.any { id -> listOf("#w0-", "#w1-", "#s0-", "#s1-", "#w2-", "#w3-", "#w4-").any { id.contains(it) } })
    }
}

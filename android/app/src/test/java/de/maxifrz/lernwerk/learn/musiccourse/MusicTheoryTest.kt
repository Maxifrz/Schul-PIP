package de.maxifrz.lernwerk.learn.musiccourse

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.NoteValue
import de.maxifrz.lernwerk.learn.Pitch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Port of LernwerkTests/MusicCourseTheoryTests.swift. */
class MusicTheoryTest {
    private val C = 0
    private val D = 1
    private val E = 2
    private val F = 3
    private val G = 4
    private val A = 5
    private val H = 6

    private fun p(letter: Int, octave: Int = 4, alteration: Int = 0) = Pitch(letter, octave, alteration)
    private fun names(notes: List<Pitch>) = notes.map { it.germanName }
    private fun iv(a: Pitch, b: Pitch) = MusicInterval.between(a, b)

    @Test fun midiNumbers() {
        assertEquals(60, p(C).midi)
        assertEquals(69, p(A).midi)
        assertEquals(72, p(C, 5).midi)
        assertEquals(59, p(H, 3).midi)
        assertEquals(61, p(C, 4, 1).midi)
        assertEquals(60, p(H, 3, 1).midi)
        assertEquals(21, p(A, 0).midi)
        assertEquals(108, p(C, 8).midi)
    }

    @Test fun germanNames() {
        val all = listOf(
            p(C), p(C, 4, 1), p(D, 4, -1), p(D), p(D, 4, 1), p(E, 4, -1), p(E), p(F), p(F, 4, 1), p(G, 4, -1), p(G), p(G, 4, 1),
            p(A, 4, -1), p(A), p(A, 4, 1), p(H, 4, -1), p(H),
        )
        assertEquals(listOf("C", "Cis", "Des", "D", "Dis", "Es", "E", "F", "Fis", "Ges", "G", "Gis", "As", "A", "Ais", "B", "H"), names(all))
        assertEquals("His", p(H, 4, 1).germanName)
        assertEquals("Ces", p(C, 4, -1).germanName)
        assertEquals("Fisis", p(F, 4, 2).germanName)
        assertEquals("Heses", p(H, 4, -2).germanName)
        assertEquals("Eses", p(E, 4, -2).germanName)
        assertEquals("Asas", p(A, 4, -2).germanName)
    }

    @Test fun nameParsing() {
        for (name in listOf("C", "Cis", "Des", "Es", "As", "B", "H", "Fis", "Ges", "Gis", "Ais", "Ces", "His")) {
            val parsed = MusicNames.parse(name)
            assertNotNull(name, parsed)
            assertEquals(name, Pitch(parsed!!.letter, 4, parsed.alteration).germanName)
            assertNotNull(MusicNames.parse(name.lowercase()))
        }
        assertNull(MusicNames.parse("Xis"))
        assertNull(MusicNames.parse("Hes"))
        assertNull(MusicNames.parse(""))
    }

    @Test fun spellingFromMidi() {
        assertEquals("Cis", spelled(61).germanName)
        assertEquals("Des", spelled(61, true).germanName)
        assertEquals("B", spelled(70, true).germanName)
        assertEquals("Ais", spelled(70).germanName)
        for (midi in 21..108) {
            assertEquals(midi, spelled(midi).midi)
            assertEquals(midi, spelled(midi, true).midi)
        }
        assertTrue(p(C, 4, 1).isEnharmonic(p(D, 4, -1)))
    }

    @Test fun octaveNames() {
        assertEquals("eingestrichene Oktave", octaveName(4))
        assertEquals("kleine Oktave", octaveName(3))
        assertEquals("große Oktave", octaveName(2))
        assertEquals("C4", p(C, 4).scientificName)
    }

    @Test fun intervalNamesAndSizes() {
        val cg = iv(p(C), p(G))
        assertEquals("reine Quinte", cg.name)
        assertEquals(7, cg.semitones)
        assertEquals(5, cg.number)
        assertEquals("große Terz", iv(p(C), p(E)).name)
        assertEquals("kleine Terz", iv(p(E), p(G)).name)
        assertEquals("große Sekunde", iv(p(C), p(D)).name)
        assertEquals("kleine Sekunde", iv(p(E), p(F)).name)
        assertEquals("reine Quarte", iv(p(C), p(F)).name)
        assertEquals("übermäßige Quarte", iv(p(F), p(H)).name)
        assertEquals("verminderte Quinte", iv(p(H), p(F, 5)).name)
        assertTrue(iv(p(F), p(H)).isTritone)
        assertTrue(iv(p(C), p(G, 4, -1)).isTritone)
        assertEquals("große Sexte", iv(p(C), p(A)).name)
        assertEquals("kleine Sexte", iv(p(E), p(C, 5)).name)
        assertEquals("große Septime", iv(p(C), p(H)).name)
        assertEquals("kleine Septime", iv(p(D), p(C, 5)).name)
        assertEquals("reine Oktave", iv(p(C), p(C, 5)).name)
        assertEquals("reine Prim", iv(p(C), p(C)).name)
        assertEquals("übermäßige Prim", iv(p(C), p(C, 4, 1)).name)
        assertTrue(iv(p(C), p(G, 4, -1)).name != iv(p(C), p(F, 4, 1)).name)
    }

    @Test fun intervalSemitoneTable() {
        val expected = listOf(
            "reine Prim" to 0, "kleine Sekunde" to 1, "große Sekunde" to 2, "kleine Terz" to 3, "große Terz" to 4, "reine Quarte" to 5,
            "reine Quinte" to 7, "kleine Sexte" to 8, "große Sexte" to 9, "kleine Septime" to 10, "große Septime" to 11, "reine Oktave" to 12,
        )
        assertEquals(expected.size, MusicInterval.standard.size)
        MusicInterval.standard.forEachIndexed { k, i ->
            assertEquals(expected[k].first, i.name)
            assertEquals(expected[k].second, i.semitones)
        }
    }

    @Test fun buildingIntervalsSpellsByLetter() {
        val majorThird = MusicInterval(2, 4)
        assertEquals("Fis", majorThird.above(p(D)).germanName)
        assertEquals("A", majorThird.above(p(F)).germanName)
        assertEquals("G", majorThird.above(p(E, 4, -1)).germanName)
        assertEquals("F", MusicInterval(2, 3).above(p(D)).germanName)
        assertEquals("Fis", MusicInterval(4, 7).above(p(H)).germanName)
        assertEquals("C", MusicInterval(4, 7).above(p(F)).germanName)
        assertEquals("As", MusicInterval(4, 7).above(p(D, 4, -1)).germanName)
        assertEquals("F", MusicInterval(4, 7).below(p(C)).germanName)
        assertEquals("H", MusicInterval(3, 6).above(p(F)).germanName)
        assertEquals("Ces", MusicInterval(4, 6).above(p(F)).germanName)
    }

    @Test fun inversion() {
        for (i in MusicInterval.standard) {
            assertEquals(i, i.inverted.inverted)
            assertEquals(9, i.number + i.inverted.number)
            assertEquals(12, i.semitones + i.inverted.semitones)
        }
        assertEquals("kleine Sexte", MusicInterval(2, 4).inverted.name)
        assertEquals("reine Quarte", MusicInterval(4, 7).inverted.name)
        assertEquals("kleine Septime", MusicInterval(1, 2).inverted.name)
    }

    @Test fun majorScales() {
        fun s(t: Pitch) = names(MusicScale(t, MusicScaleKind.MAJOR).notes)
        assertEquals(listOf("C", "D", "E", "F", "G", "A", "H", "C"), s(p(C)))
        assertEquals(listOf("G", "A", "H", "C", "D", "E", "Fis", "G"), s(p(G)))
        assertEquals(listOf("F", "G", "A", "B", "C", "D", "E", "F"), s(p(F)))
        assertEquals(listOf("D", "E", "Fis", "G", "A", "H", "Cis", "D"), s(p(D)))
        assertEquals(listOf("B", "C", "D", "Es", "F", "G", "A", "B"), s(p(H, 4, -1)))
        assertEquals(listOf("Es", "F", "G", "As", "B", "C", "D", "Es"), s(p(E, 4, -1)))
        assertEquals(listOf("Fis", "Gis", "Ais", "H", "Cis", "Dis", "Eis", "Fis"), s(p(F, 4, 1)))
        assertEquals(listOf("Des", "Es", "F", "Ges", "As", "B", "C", "Des"), s(p(D, 4, -1)))
        assertEquals("G-Dur", MusicScale(p(G), MusicScaleKind.MAJOR).name)
    }

    @Test fun minorScales() {
        fun s(t: Pitch, k: MusicScaleKind) = names(MusicScale(t, k).notes)
        assertEquals(listOf("A", "H", "C", "D", "E", "F", "G", "A"), s(p(A), MusicScaleKind.NATURAL_MINOR))
        assertEquals(listOf("A", "H", "C", "D", "E", "F", "Gis", "A"), s(p(A), MusicScaleKind.HARMONIC_MINOR))
        assertEquals(listOf("E", "Fis", "G", "A", "H", "C", "D", "E"), s(p(E), MusicScaleKind.NATURAL_MINOR))
        assertEquals(listOf("D", "E", "F", "G", "A", "B", "C", "D"), s(p(D), MusicScaleKind.NATURAL_MINOR))
        assertEquals(listOf("D", "E", "F", "G", "A", "B", "Cis", "D"), s(p(D), MusicScaleKind.HARMONIC_MINOR))
        assertEquals("A-Moll", MusicScale(p(A), MusicScaleKind.NATURAL_MINOR).name)
    }

    @Test fun scaleOctaveAndIntervals() {
        for (count in -6..6) {
            val notes = MusicScale(MusicKey.majorTonic(count), MusicScaleKind.MAJOR).notes
            assertEquals(8, notes.size)
            assertEquals(12, notes[7].midi - notes[0].midi)
            assertEquals(7, notes.dropLast(1).map { it.letter }.toSet().size)
            assertEquals("große Terz", iv(notes[0], notes[2]).name)
            assertEquals("reine Quinte", iv(notes[0], notes[4]).name)
        }
    }

    @Test fun keySignatures() {
        assertEquals(listOf("Fis"), names(MusicKey.accidentals(1)))
        assertEquals(listOf("Fis", "Cis", "Gis", "Dis", "Ais", "Eis", "His"), names(MusicKey.accidentals(7)))
        assertEquals(listOf("B"), names(MusicKey.accidentals(-1)))
        assertEquals(listOf("B", "Es", "As", "Des", "Ges", "Ces", "Fes"), names(MusicKey.accidentals(-7)))
        assertTrue(MusicKey.accidentals(0).isEmpty())
    }

    @Test fun circleOfFifths() {
        val range = (0..7).toList()
        assertEquals(listOf("C-Dur", "G-Dur", "D-Dur", "A-Dur", "E-Dur", "H-Dur", "Fis-Dur", "Cis-Dur"), range.map { MusicKey.majorName(it) })
        assertEquals(listOf("C-Dur", "F-Dur", "B-Dur", "Es-Dur", "As-Dur", "Des-Dur", "Ges-Dur", "Ces-Dur"), range.map { MusicKey.majorName(-it) })
        assertEquals("A-Moll", MusicKey.minorName(0))
        assertEquals("E-Moll", MusicKey.minorName(1))
        assertEquals("Fis-Moll", MusicKey.minorName(3))
        assertEquals("D-Moll", MusicKey.minorName(-1))
        assertEquals("C-Moll", MusicKey.minorName(-3))
        assertEquals("G-Moll", MusicKey.minorName(-2))
        assertEquals(2, MusicKey.countOfMajorTonic(p(D)))
        assertEquals(-3, MusicKey.countOfMajorTonic(p(E, 4, -1)))
        assertEquals(0, MusicKey.countOfMinorTonic(p(A)))
        assertEquals(3, MusicKey.countOfMinorTonic(p(F, 4, 1)))
    }

    @Test fun keySignatureAgreesWithScales() {
        for (count in -7..7) {
            val s = MusicScale(MusicKey.majorTonic(count), MusicScaleKind.MAJOR)
            for (note in s.notes) assertEquals("${s.name} ${note.germanName}", MusicKey.alteration(note.letter, count), note.alteration)
            assertEquals(count, s.accidentalCount)
            val minor = MusicScale(MusicKey.minorTonic(count), MusicScaleKind.NATURAL_MINOR)
            assertEquals(count, minor.accidentalCount)
            val majorNotes = s.notes.dropLast(1)
            assertEquals(
                (0..6).map { majorNotes[(it + 5) % 7].pitchClass },
                minor.notes.dropLast(1).map { it.pitchClass },
            )
        }
    }

    @Test fun triads() {
        fun t(root: Pitch, q: MusicTriadQuality) = names(MusicTriad(root, q).notes)
        assertEquals(listOf("C", "E", "G"), t(p(C), MusicTriadQuality.MAJOR))
        assertEquals(listOf("Es", "G", "B"), t(p(E, 4, -1), MusicTriadQuality.MAJOR))
        assertEquals(listOf("A", "C", "E"), t(p(A), MusicTriadQuality.MINOR))
        assertEquals(listOf("D", "Fis", "A"), t(p(D), MusicTriadQuality.MAJOR))
        assertEquals(listOf("G", "B", "D"), t(p(G), MusicTriadQuality.MINOR))
        assertEquals(listOf("F", "As", "C"), t(p(F), MusicTriadQuality.MINOR))
        assertEquals(listOf("H", "D", "F"), t(p(H), MusicTriadQuality.DIMINISHED))
        assertEquals(listOf("C", "E", "Gis"), t(p(C), MusicTriadQuality.AUGMENTED))
        assertEquals(listOf("Fis", "A", "Cis"), t(p(F, 4, 1), MusicTriadQuality.MINOR))
        assertEquals("Es-Dur", MusicTriad(p(E, 4, -1), MusicTriadQuality.MAJOR).name)
        assertEquals(listOf(60, 64, 67), MusicTriad(p(C), MusicTriadQuality.MAJOR).notes.map { it.midi })
        assertEquals(listOf(60, 63, 67), MusicTriad(p(C), MusicTriadQuality.MINOR).notes.map { it.midi })
    }

    @Test fun noteValues() {
        assertEquals(listOf(16, 8, 4, 2, 1), orderedNoteValues.map { it.sixteenths })
        val m44 = MusicMeter.parse("4/4")!!
        val m34 = MusicMeter.parse("3/4")!!
        val m68 = MusicMeter.parse("6/8")!!
        assertEquals(16, m44.barSixteenths)
        assertEquals(12, m34.barSixteenths)
        assertEquals(12, m68.barSixteenths)
        assertEquals(4 to 1, m44.beats(NoteValue.WHOLE))
        assertEquals(2 to 1, m44.beats(NoteValue.HALF))
        assertEquals(1 to 1, m44.beats(NoteValue.QUARTER))
        assertEquals(1 to 2, m44.beats(NoteValue.EIGHTH))
        assertEquals(1 to 4, m44.beats(NoteValue.SIXTEENTH))
        assertEquals(1 to 1, m68.beats(NoteValue.EIGHTH))
        assertEquals(2 to 1, m68.beats(NoteValue.QUARTER))
        assertTrue(m44.isFull(listOf(NoteValue.HALF, NoteValue.QUARTER, NoteValue.EIGHTH, NoteValue.EIGHTH)))
        assertFalse(m34.isFull(listOf(NoteValue.HALF, NoteValue.HALF)))
        assertTrue(m34.isFull(listOf(NoteValue.HALF, NoteValue.QUARTER)))
        assertNull(MusicMeter.parse("4/5"))
        assertNull(MusicMeter.parse("x"))
        assertEquals("Achtelpause", NoteValue.EIGHTH.restName)
        assertEquals("Halbe Note", NoteValue.HALF.noteName)
    }

    @Test fun staffPositions() {
        fun tp(q: Pitch) = q.staffPosition(Clef.TREBLE)
        fun bp(q: Pitch) = q.staffPosition(Clef.BASS)
        assertEquals(0, tp(p(E, 4)).step)
        assertEquals(2, tp(p(G, 4)).index)
        assertTrue(tp(p(G, 4)).isLine)
        assertEquals(8, tp(p(F, 5)).step)
        assertEquals("1. Zwischenraum", tp(p(F, 4)).description)
        assertEquals(-2, tp(p(C, 4)).step)
        assertEquals(1, tp(p(C, 4)).ledgerLines)
        assertEquals(0, tp(p(D, 4)).ledgerLines)
        assertEquals(2, tp(p(A, 3)).ledgerLines)
        assertEquals(1, tp(p(A, 5)).ledgerLines)
        assertEquals(0, tp(p(G, 5)).ledgerLines)
        assertEquals(2, tp(p(C, 6)).ledgerLines)
        assertEquals(0, bp(p(G, 2)).step)
        assertEquals(8, bp(p(A, 3)).step)
        assertEquals(4, bp(p(F, 3)).index)
        assertEquals(1, bp(p(C, 4)).ledgerLines)
        assertEquals("1. Hilfslinie oben", bp(p(C, 4)).description)
        assertEquals(1, bp(p(E, 2)).ledgerLines)
        for (clef in listOf(Clef.TREBLE, Clef.BASS)) {
            for (step in -6..14) assertEquals(step, pitchAtStep(step, clef).staffPosition(clef).step)
        }
        assertEquals("G", pitchAtStep(0, Clef.BASS).germanName)
        assertEquals(30, Clef.TREBLE.bottomLineDiatonic)
    }

    @Test fun pianoKeys() {
        assertEquals(24, MusicNames.keys(0)[0])
        assertTrue(MusicNames.keys(0).contains(60))
        assertEquals(8, MusicNames.keys(9).size)
        assertTrue(MusicNames.isBlackKey(61))
        assertFalse(MusicNames.isBlackKey(60))
    }
}

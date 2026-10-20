package de.maxifrz.lernwerk.ui.learn

import de.maxifrz.lernwerk.learn.Clef
import de.maxifrz.lernwerk.learn.NoteValue
import de.maxifrz.lernwerk.learn.Pitch
import de.maxifrz.lernwerk.learn.StaffNote
import de.maxifrz.lernwerk.learn.StaffSpec
import de.maxifrz.lernwerk.learn.ToneSpec
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

// The arithmetic behind the chess board, the staff, the keyboard, the tones and the times of the Lernen screens. Plain
// Kotlin without Compose or Android, so the tests check it on the JVM; the composables only draw what these return.
// A port of desktop/src/views/learn/geometry.ts (itself a port of MediaRules.swift, StaffView.swift and ToneSynth.swift).

// Chess

/** The pieces of a position, read from the first field of a FEN. Rank 8 first; null is an empty square. */
fun boardPlacement(fen: String): List<List<Char?>> {
    val field = fen.split(' ').firstOrNull { it.isNotEmpty() } ?: fen
    val rows = mutableListOf<List<Char?>>()
    for (part in field.split('/').filter { it.isNotEmpty() }) {
        val row = mutableListOf<Char?>()
        for (character in part) {
            if (character in '1'..'9') repeat(character - '0') { row.add(null) } else row.add(character)
        }
        val eight = row.take(8).toMutableList()
        while (eight.size < 8) eight.add(null)
        rows.add(eight)
    }
    while (rows.size < 8) rows.add(List(8) { null })
    return rows.take(8)
}

/** File 0 to 7 (a to h) and rank 1 to 8 of a square name like "e4"; null for anything else. */
fun squareCoordinates(square: String): Pair<Int, Int>? {
    if (square.length != 2) return null
    val file = "abcdefgh".indexOf(square[0])
    val rank = square[1] - '0'
    if (file < 0 || rank < 1 || rank > 8) return null
    return file to rank
}

fun squareName(file: Int, rank: Int): String = "abcdefgh"[file].toString() + rank

/** The piece on a square, as a FEN letter (uppercase is White). */
fun pieceOn(board: List<List<Char?>>, square: String): Char? {
    val (file, rank) = squareCoordinates(square) ?: return null
    return board[8 - rank][file]
}

/** The square at a place of the screen (row 0 is the top), with White at the bottom unless the board is flipped. */
fun squareAt(row: Int, column: Int, flipped: Boolean): String {
    val rank = if (flipped) row + 1 else 8 - row
    val file = if (flipped) 7 - column else column
    return squareName(file, rank)
}

/** The square under a touch at (x, y) on a board of `size` pixels; null outside the board. */
fun squareAtOffset(x: Float, y: Float, size: Float, flipped: Boolean): String? {
    if (size <= 0f || x < 0f || y < 0f || x >= size || y >= size) return null
    val cell = size / 8f
    return squareAt((y / cell).toInt().coerceIn(0, 7), (x / cell).toInt().coerceIn(0, 7), flipped)
}

fun isDarkSquare(row: Int, column: Int): Boolean = (row + column) % 2 == 1

/** "Weiß" or "Schwarz", from the second field of the FEN; null when it is missing. */
fun sideToMove(fen: String): String? {
    val fields = fen.split(' ').filter { it.isNotEmpty() }
    if (fields.size < 2) return null
    return when (fields[1]) {
        "b" -> "Schwarz"
        "w" -> "Weiß"
        else -> null
    }
}

/** German name of a piece for a screen reader: "weißer Springer". */
fun germanPieceName(piece: Char): String {
    val kind = piece.lowercaseChar()
    val names = mapOf('k' to "König", 'q' to "Dame", 'r' to "Turm", 'b' to "Läufer", 'n' to "Springer", 'p' to "Bauer")
    val color = if (piece.isUpperCase()) "weiß" else "schwarz"
    // Dame is feminine: "weiße Dame", but "weißer Turm".
    return color + (if (kind == 'q') "e" else "er") + " " + (names[kind] ?: "Figur")
}

enum class SquareMark { VERDICT_RIGHT, VERDICT_WRONG, SOLUTION, PICK }

/**
 * How a square is tinted: the squares of the move after the verdict (green or red), the right move after a wrong
 * answer, and the picked squares before the check.
 */
fun squareMark(square: String, from: String?, to: String?, correctMoves: List<String>, verdict: Boolean?): SquareMark? {
    val picked = square == from || square == to
    if (verdict != null && picked) return if (verdict) SquareMark.VERDICT_RIGHT else SquareMark.VERDICT_WRONG
    if (verdict == false && correctMoves.any { it.startsWith(square) || it.drop(2).startsWith(square) }) return SquareMark.SOLUTION
    if (picked) return SquareMark.PICK
    return null
}

/** The hint under the board while a move is being found. */
fun moveHint(from: String?, to: String?, verdict: Boolean?): String {
    if (verdict != null) return ""
    if (from == null) return "Tippe auf die Figur, die ziehen soll."
    if (to == null) return "Tippe auf das Zielfeld."
    return "Tippe auf „Prüfen“, wenn du sicher bist."
}

// Piano

object PianoLayout {
    fun isBlack(midi: Int): Boolean = Math.floorMod(midi, 12) in listOf(1, 3, 6, 8, 10)

    fun whiteKeys(low: Int, high: Int): List<Int> = (low..high).filter { !isBlack(it) }

    /**
     * The keys shown for an exercise: from the C below the lowest right key to the C above the highest, at least two
     * octaves, within the piano.
     */
    fun range(correct: List<Int>): Pair<Int, Int> {
        if (correct.isEmpty()) return 60 to 84
        val low = correct.min()
        val high = correct.max()
        var start = Math.floorDiv(low, 12) * 12
        var end = Math.floorDiv(high + 11, 12) * 12
        if (end <= high) end += 12
        if (end - start < 24) end = start + 24
        start = max(12, start)
        end = min(108, max(end, start + 12))
        return start to end
    }

    /**
     * Where a black key's center lies, in white-key widths from the left edge of the range: between its two
     * neighbouring white keys, a little off center for the groups of three.
     */
    fun blackKeyCenter(midi: Int, low: Int): Double {
        val whitesBefore = whiteKeys(low, midi).size
        val offset = when (Math.floorMod(midi, 12)) {
            1 -> -0.06
            3 -> 0.06
            6 -> -0.08
            10 -> 0.08
            else -> 0.0
        }
        return whitesBefore + offset
    }

    /** The note's name for a screen reader: "C4", "F♯3". */
    fun name(midi: Int): String {
        val names = listOf("C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "H")
        return names[Math.floorMod(midi, 12)] + (Math.floorDiv(midi, 12) - 1)
    }
}

// Staff

enum class Accidental { SHARP, FLAT, NATURAL, DOUBLE_SHARP, DOUBLE_FLAT }

object StaffRules {
    /** The diatonic number (octave * 7 + letter) of the bottom line: E4 in the treble clef, G2 in the bass clef, F3 in the alto clef. */
    fun bottomLine(clef: Clef): Int = when (clef) {
        Clef.TREBLE -> 4 * 7 + 2
        Clef.BASS -> 2 * 7 + 4
        Clef.ALTO -> 3 * 7 + 3
    }

    /** Half staff spaces above the bottom line: 0 is the bottom line, 1 the first space, 8 the top line. */
    fun step(pitch: Pitch, clef: Clef): Int = pitch.diatonic - bottomLine(clef)

    /** The even steps with a ledger line for a note on `step`: below the staff -2, -4, ... or above it 10, 12, ... */
    fun ledgerSteps(step: Int): List<Int> {
        val steps = mutableListOf<Int>()
        if (step <= -2) {
            var s = -2
            while (s >= step) { steps.add(s); s -= 2 }
        } else if (step >= 10) {
            var s = 10
            while (s <= step) { steps.add(s); s += 2 }
        }
        return steps
    }

    val sharpLetters = listOf(3, 0, 4, 1, 5, 2, 6)
    val flatLetters = listOf(6, 2, 5, 1, 4, 0, 3)

    data class KeySign(val step: Int, val sharp: Boolean)

    /** Where the signs of a key signature sit: the step of each, in the order they are drawn. */
    fun keySignature(count: Int, clef: Clef): List<KeySign> {
        val n = min(7, abs(count))
        if (n == 0) return emptyList()
        val sharpSteps = listOf(8, 5, 9, 6, 3, 7, 4)
        val flatSteps = listOf(4, 7, 3, 6, 2, 5, 1)
        val shift = when (clef) { Clef.TREBLE -> 0; Clef.BASS -> -2; Clef.ALTO -> -1 }
        val steps = if (count > 0) sharpSteps else flatSteps
        return List(n) { KeySign(steps[it] + shift, count > 0) }
    }

    /** The alteration the key signature gives a letter: +1, -1 or 0. */
    fun keyAlteration(letter: Int, key: Int): Int {
        val n = min(7, abs(key))
        if (n == 0) return 0
        val letters = if (key > 0) sharpLetters else flatLetters
        return if (letters.take(n).contains(letter)) (if (key > 0) 1 else -1) else 0
    }

    /** The sign written before a note: none when the key signature already gives its alteration. */
    fun accidental(pitch: Pitch, key: Int): Accidental? {
        if (pitch.alteration == keyAlteration(pitch.letter, key)) return null
        return when (pitch.alteration) {
            1 -> Accidental.SHARP
            -1 -> Accidental.FLAT
            2 -> Accidental.DOUBLE_SHARP
            -2 -> Accidental.DOUBLE_FLAT
            else -> Accidental.NATURAL
        }
    }

    /** Stems go up for notes below the middle line and down from it (a chord follows its middle). */
    fun stemUp(steps: List<Int>): Boolean {
        if (steps.isEmpty()) return true
        return (steps.min() + steps.max()) / 2.0 < 4
    }

    /**
     * Chord notes a second apart cannot share a side of the stem; the upper one goes to the other side. One flag per
     * note, in the order given: true for the note that is moved.
     */
    fun shifted(steps: List<Int>): List<Boolean> {
        val order = steps.mapIndexed { index, step -> step to index }.sortedWith(compareBy({ it.first }, { it.second }))
        val result = MutableList(steps.size) { false }
        var previousShifted = false
        var previousStep: Int? = null
        for ((step, index) in order) {
            if (previousStep != null && step - previousStep == 1 && !previousShifted) {
                result[index] = true
                previousShifted = true
            } else {
                previousShifted = false
            }
            previousStep = step
        }
        return result
    }

    /** Flags a stem gets: one for an eighth, two for a sixteenth. */
    fun flags(value: NoteValue): Int = when (value) {
        NoteValue.EIGHTH -> 1
        NoteValue.SIXTEENTH -> 2
        else -> 0
    }
}

/** One segment of a drawn outline. */
sealed interface PathSeg {
    data class Move(val x: Float, val y: Float) : PathSeg
    data class Line(val x: Float, val y: Float) : PathSeg
    data class Quad(val cx: Float, val cy: Float, val x: Float, val y: Float) : PathSeg
    data class Cubic(val c1x: Float, val c1y: Float, val c2x: Float, val c2y: Float, val x: Float, val y: Float) : PathSeg
    data object Close : PathSeg
}

/** The width in staff spaces of a clef or rest glyph, for placing what follows. */
val glyphWidth: Map<MusicGlyph, Float> = mapOf(
    MusicGlyph.G_CLEF to 2.6f, MusicGlyph.F_CLEF to 3.0f, MusicGlyph.C_CLEF to 2.8f,
    MusicGlyph.QUARTER_REST to 1.1f, MusicGlyph.EIGHTH_REST to 1.2f, MusicGlyph.SIXTEENTH_REST to 1.5f,
)

private const val UNITS_PER_SPACE = 250f

/** The outline of a glyph with its origin (the bottom staff line, at the glyph's left) at (ox, oy). */
fun glyphPath(glyph: MusicGlyph, ox: Float, oy: Float, space: Float): List<PathSeg> {
    val scale = space / UNITS_PER_SPACE
    val values = GlyphData.outlines.getValue(glyph)
    fun px(i: Int) = ox + values[i] * scale
    fun py(i: Int) = oy - values[i] * scale
    val segments = mutableListOf<PathSeg>()
    var i = 0
    while (i < values.size) {
        when (values[i]) {
            0 -> { segments.add(PathSeg.Move(px(i + 1), py(i + 2))); i += 3 }
            1 -> { segments.add(PathSeg.Line(px(i + 1), py(i + 2))); i += 3 }
            2 -> { segments.add(PathSeg.Quad(px(i + 1), py(i + 2), px(i + 3), py(i + 4))); i += 5 }
            else -> { segments.add(PathSeg.Close); i += 1 }
        }
    }
    return segments
}

sealed interface StaffPrimitive {
    data class Line(val x1: Float, val y1: Float, val x2: Float, val y2: Float, val width: Float, val round: Boolean = false) : StaffPrimitive
    data class Fill(val path: List<PathSeg>) : StaffPrimitive
    data class Stroke(val path: List<PathSeg>, val width: Float) : StaffPrimitive
    data class Ellipse(val cx: Float, val cy: Float, val rx: Float, val ry: Float, val rotate: Float, val fill: Boolean, val width: Float) : StaffPrimitive
    data class Rect(val x: Float, val y: Float, val width: Float, val height: Float) : StaffPrimitive
    data class Text(val x: Float, val y: Float, val size: Float, val text: String) : StaffPrimitive
}

class StaffLayout(val width: Float, val height: Float, val space: Float, val primitives: List<StaffPrimitive>)

/** The largest distance between two staff lines; narrower staves shrink to fit. */
const val STAFF_MAX_SPACE = 12f
const val STAFF_HEIGHT = STAFF_MAX_SPACE * 13

private fun clefGlyph(clef: Clef): MusicGlyph = when (clef) {
    Clef.TREBLE -> MusicGlyph.G_CLEF
    Clef.BASS -> MusicGlyph.F_CLEF
    Clef.ALTO -> MusicGlyph.C_CLEF
}

/** The distance between two staff lines: as large as fits. */
fun staffSpace(spec: StaffSpec, width: Float): Float {
    val slots = if (spec.chord) 1 else spec.notes.size
    val signs = min(7, abs(spec.keySignature))
    val time = if (spec.time == null) 0f else 2.4f
    val leading = 0.6f + glyphWidth.getValue(clefGlyph(spec.clef)) + signs + time + 1.2f
    val needed = leading + max(1, slots) * 3.4f + 1f
    return min(STAFF_MAX_SPACE, width / needed)
}

private fun r(n: Float): Float = (n * 100f).roundToInt() / 100f

private fun accidentalPrimitives(kind: Accidental, x: Float, y: Float, s: Float): List<StaffPrimitive> {
    fun line(x1: Float, y1: Float, x2: Float, y2: Float, w: Float): StaffPrimitive =
        StaffPrimitive.Line(x + x1 * s, y + y1 * s, x + x2 * s, y + y2 * s, w * s)
    fun sharp(dx: Float) = listOf(
        line(dx - 0.22f, -1.5f, dx - 0.22f, 1.3f, 0.1f),
        line(dx + 0.22f, -1.3f, dx + 0.22f, 1.5f, 0.1f),
        line(dx - 0.5f, -0.1f, dx + 0.5f, -0.45f, 0.26f),
        line(dx - 0.5f, 0.55f, dx + 0.5f, 0.2f, 0.26f),
    )
    fun flat(dx: Float): List<StaffPrimitive> = listOf(
        line(dx - 0.3f, -1.9f, dx - 0.3f, 0.6f, 0.1f),
        StaffPrimitive.Stroke(
            listOf(
                PathSeg.Move(x + (dx - 0.3f) * s, y + 0.6f * s),
                PathSeg.Cubic(x + (dx + 0.1f) * s, y + 0.45f * s, x + (dx + 0.65f) * s, y + 0.05f * s, x + (dx + 0.55f) * s, y - 0.35f * s),
                PathSeg.Cubic(x + (dx + 0.45f) * s, y - 0.75f * s, x + dx * s, y - 0.65f * s, x + (dx - 0.3f) * s, y - 0.2f * s),
            ),
            0.17f * s,
        ),
    )
    return when (kind) {
        Accidental.SHARP -> sharp(0f)
        Accidental.FLAT -> flat(-0.1f)
        Accidental.NATURAL -> listOf(
            line(-0.28f, -1.4f, -0.28f, 0.7f, 0.1f),
            line(0.28f, -0.7f, 0.28f, 1.4f, 0.1f),
            line(-0.28f, -0.25f, 0.28f, -0.45f, 0.24f),
            line(-0.28f, 0.45f, 0.28f, 0.25f, 0.24f),
        )
        Accidental.DOUBLE_SHARP -> listOf(line(-0.5f, -0.5f, 0.5f, 0.5f, 0.3f), line(0.5f, -0.5f, -0.5f, 0.5f, 0.3f))
        Accidental.DOUBLE_FLAT -> flat(-0.45f) + flat(0.25f)
    }
}

private fun placedAccidental(kind: Accidental, x: Float, y: Float, s: Float): List<StaffPrimitive> {
    // The flats sit a little higher than the line they belong to.
    val lift = if (kind == Accidental.FLAT || kind == Accidental.DOUBLE_FLAT) 0.4f * s else 0f
    return accidentalPrimitives(kind, x, y - lift, s)
}

/**
 * Everything a staff draws, as primitives in a box of the given width: lines, glyph outlines, note heads, stems,
 * flags, signs and the time signature.
 */
fun layoutStaff(spec: StaffSpec, width: Float): StaffLayout {
    val height = STAFF_HEIGHT
    val s = staffSpace(spec, width)
    val bottom = height / 2 + 2 * s
    fun y(step: Int): Float = bottom - step * s / 2f
    val out = mutableListOf<StaffPrimitive>()

    for (line in 0 until 5) out.add(StaffPrimitive.Line(0f, y(line * 2), width, y(line * 2), max(1f, s * 0.09f)))
    out.add(StaffPrimitive.Line(width - 1, y(0), width - 1, y(8), max(1.5f, s * 0.16f)))

    var x = 0.6f * s
    val clef = clefGlyph(spec.clef)
    out.add(StaffPrimitive.Fill(glyphPath(clef, x, bottom, s)))
    x += glyphWidth.getValue(clef) * s

    for (sign in StaffRules.keySignature(spec.keySignature, spec.clef)) {
        out.addAll(placedAccidental(if (sign.sharp) Accidental.SHARP else Accidental.FLAT, x + s * 0.4f, y(sign.step), s))
        x += s
    }
    val time = spec.time
    if (time != null) {
        val parts = time.split("/")
        if (parts.size == 2) parts.forEachIndexed { index, part -> out.add(StaffPrimitive.Text(x + s * 0.8f, y(if (index == 0) 6 else 2), s * 2.5f, part)) }
        x += 2.4f * s
    }
    x += 1.2f * s

    val slotCount = if (spec.chord) 1 else spec.notes.size
    val slots = max(1, slotCount)
    val slotWidth = min(6 * s, max(3.4f * s, (width - x - s) / slots))
    for (slot in 0 until slotCount) {
        val notes = if (spec.chord) spec.notes else listOf(spec.notes[slot])
        out.addAll(slotPrimitives(spec, notes, x + slotWidth * (slot + 0.5f), s, bottom, ::y))
    }
    return StaffLayout(width, height, s, out)
}

private fun slotPrimitives(spec: StaffSpec, notes: List<StaffNote>, x: Float, s: Float, bottom: Float, y: (Int) -> Float): List<StaffPrimitive> {
    val first = notes.firstOrNull() ?: return emptyList()
    val out = mutableListOf<StaffPrimitive>()
    if (first.isRest) {
        when (first.value) {
            NoteValue.WHOLE -> out.add(StaffPrimitive.Rect(x - 0.65f * s, y(6), 1.3f * s, 0.5f * s))
            NoteValue.HALF -> out.add(StaffPrimitive.Rect(x - 0.65f * s, y(4) - 0.5f * s, 1.3f * s, 0.5f * s))
            NoteValue.QUARTER -> out.add(StaffPrimitive.Fill(glyphPath(MusicGlyph.QUARTER_REST, x - 0.45f * s, bottom, s)))
            NoteValue.EIGHTH -> out.add(StaffPrimitive.Fill(glyphPath(MusicGlyph.EIGHTH_REST, x - 0.45f * s, bottom, s)))
            NoteValue.SIXTEENTH -> out.add(StaffPrimitive.Fill(glyphPath(MusicGlyph.SIXTEENTH_REST, x - 0.6f * s, bottom, s)))
        }
        return out
    }
    val steps = notes.map { StaffRules.step(it.pitch, spec.clef) }
    val up = StaffRules.stemUp(steps)
    val moved = StaffRules.shifted(steps)
    val value = first.value

    notes.forEachIndexed { index, note ->
        val step = steps[index]
        val headX = x + (if (moved[index]) (if (up) 1.15f * s else -1.15f * s) else 0f)
        for (ledger in StaffRules.ledgerSteps(step)) {
            out.add(StaffPrimitive.Line(headX - s, y(ledger), headX + s, y(ledger), max(1f, s * 0.12f)))
        }
        val accidental = StaffRules.accidental(note.pitch, spec.keySignature)
        if (accidental != null) out.addAll(placedAccidental(accidental, x - 1.5f * s, y(step), s))
        val wide = if (value == NoteValue.WHOLE) 1.0f else 0.66f
        out.add(
            StaffPrimitive.Ellipse(
                headX, y(step), wide * s, 0.5f * s, -18f,
                fill = !(value == NoteValue.WHOLE || value == NoteValue.HALF),
                width = if (value == NoteValue.WHOLE) max(1.5f, s * 0.26f) else max(1.5f, s * 0.2f),
            ),
        )
    }

    if (value == NoteValue.WHOLE) return out
    val ys = steps.map { y(it) }
    val low = ys.max()
    val high = ys.min()
    val stemX = x + (if (up) 0.6f * s else -0.6f * s)
    val tip = if (up) high - 3.3f * s else low + 3.3f * s
    out.add(StaffPrimitive.Line(stemX, if (up) low else high, stemX, tip, max(1f, s * 0.13f)))
    val direction = if (up) 1f else -1f
    for (flag in 0 until StaffRules.flags(value)) {
        val offset = flag * 0.9f * s
        val sy = if (up) tip + offset else tip - offset
        out.add(
            StaffPrimitive.Stroke(
                listOf(
                    PathSeg.Move(r(stemX), r(sy)),
                    PathSeg.Cubic(
                        r(stemX + 0.1f * s), r(sy + direction * 0.9f * s), r(stemX + 1.2f * s), r(sy + direction * 0.9f * s),
                        r(stemX + 0.95f * s), r(sy + direction * 2.0f * s),
                    ),
                ),
                max(1.2f, s * 0.3f),
            ),
        )
    }
    return out
}

/** "Notenzeile im Violinschlüssel mit 3 Noten", for a screen reader. */
fun staffDescription(spec: StaffSpec): String {
    val clef = when (spec.clef) { Clef.TREBLE -> "Violinschlüssel"; Clef.BASS -> "Bassschlüssel"; Clef.ALTO -> "Altschlüssel" }
    val count = spec.notes.size
    return "Notenzeile im $clef mit $count ${if (count == 1) "Note" else "Noten"}"
}

// Tones

data class ToneNote(val midi: Int, val start: Double, val length: Double, val decay: Double, val level: Double)

fun midiFrequency(midi: Int): Double = 440.0 * 2.0.pow((midi - 69) / 12.0)

/** When each note of an ear exercise sounds: one after the other, or all at once as a chord, with the loudness shared between the notes of a chord. */
fun toneSchedule(spec: ToneSpec): Pair<List<ToneNote>, Double> {
    val noteSeconds = if (spec.together) 1.8 else 0.75
    val gap = if (spec.together) 0.0 else 0.05
    val decay = if (spec.together) 1.6 else 3.2
    val groups = if (spec.together) listOf(spec.midi) else spec.midi.map { listOf(it) }
    val level = 0.5 / max(1, groups.firstOrNull()?.size ?: 1)
    val notes = mutableListOf<ToneNote>()
    groups.forEachIndexed { position, group ->
        for (midi in group) notes.add(ToneNote(midi, position * (noteSeconds + gap), noteSeconds, decay, level))
    }
    return notes to (groups.size * (noteSeconds + gap) + 0.2)
}

/** The harmonics of the soft piano-like tone: frequency factor and amplitude, the sum scaled to 1. */
val toneHarmonics: List<Pair<Double, Double>> = listOf(1.0 to 1 / 1.66, 2.0 to 0.4 / 1.66, 3.0 to 0.18 / 1.66, 4.0 to 0.08 / 1.66)

/** The loudness of a note at time t (seconds since its start): a quick attack, an exponential decay and a short release at the end. */
fun toneEnvelope(t: Double, length: Double, decay: Double): Double {
    if (t < 0 || t > length) return 0.0
    val attack = min(1.0, t / 0.01)
    val release = max(0.0, min(1.0, (length - t) / 0.05))
    return attack * exp(-t * decay) * release
}

/** The samples (16-bit, mono) of the notes of an ear exercise, computed on the device. */
fun synthesizeTones(spec: ToneSpec, sampleRate: Int = 22050): ShortArray {
    val (notes, total) = toneSchedule(spec)
    val count = (total * sampleRate).toInt()
    val mix = DoubleArray(count)
    for (note in notes) {
        val first = (note.start * sampleRate).toInt()
        val length = (note.length * sampleRate).toInt()
        val frequency = midiFrequency(note.midi)
        for (i in 0 until length) {
            val index = first + i
            if (index >= count) break
            val t = i.toDouble() / sampleRate
            var sample = 0.0
            for ((factor, amplitude) in toneHarmonics) sample += amplitude * sin(2 * PI * frequency * factor * t)
            mix[index] += note.level * 2 * toneEnvelope(t, note.length, note.decay) * sample
        }
    }
    return ShortArray(count) { (mix[it].coerceIn(-1.0, 1.0) * Short.MAX_VALUE).roundToInt().toShort() }
}

/** "Töne anhören", "Ton anhören" or "Klang anhören". */
fun toneButtonLabel(spec: ToneSpec): String = if (spec.together) "Klang anhören" else if (spec.midi.size > 1) "Töne anhören" else "Ton anhören"

// Times and the path

/** "noch 15 Std" or "noch 42 Min", for the quest tile. */
fun timeLeftShort(secondsLeft: Double): String {
    val minutes = (secondsLeft / 60).toInt()
    if (minutes >= 60) return "noch ${minutes / 60} Std"
    return "noch ${max(1, minutes)} Min"
}

/** "noch 3 Std 12 Min" or "noch 42 Min", on the quest page. */
fun timeLeftLong(secondsLeft: Double): String {
    val minutes = (secondsLeft / 60).toInt()
    return if (minutes >= 60) "noch ${minutes / 60} Std ${minutes % 60} Min" else "noch ${max(1, minutes)} Min"
}

private val WAVE = doubleArrayOf(0.0, 0.55, 0.85, 0.55, 0.0, -0.55, -0.85, -0.55)

/** The sideways shift of a step on the path in units of the wave width: a gentle wave, right, further right, back, left, further left, back. */
fun pathShift(position: Int): Double = WAVE[position % WAVE.size]

/** The language code of a BCP 47 tag with an underscore or dash ("es_ES" gives "es"); "" for none. */
fun primaryLanguage(tag: String): String = tag.replace('_', '-').substringBefore('-').lowercase()

package de.maxifrz.lernwerk.data

import java.io.ByteArrayInputStream
import java.util.UUID
import java.util.zip.ZipInputStream

/**
 * Reads a GoodNotes 6 document (`.goodnotes`): a ZIP of protocol-buffer logs. Its own PDF export leaves pages that
 * are photos or imported PDFs white; here every page comes back with its background, pictures and handwriting.
 *
 * - `index.events.pb`: the notebook's history. Pages (field 2) name their background (a resource, field 4) and size
 *   (field 8); resources (field 6) point at files in `attachments/`; page list entries (field 54) hold a page and a
 *   position string, sorted as text; field 56 with 1 in field 3 removes an entry.
 * - `notes/<entry + 1>`: the ink of the page list entry whose UUID is one less. Strokes (field 7) carry their points
 *   as an Apple LZ4 block of a typed binary record (start point, then quadratic Bézier segments), their colour
 *   (field 4, RGBA floats), their offset (field 6) and straight lines as point lists (field 9); field 14 or a
 *   tombstone record (field 3 = 1) removes one. Pictures on a page are records with a single field 1.
 * - Coordinates are PDF points times 11/6.
 */
object GoodNotes {
    const val SCALE = 11f / 6f

    class Notebook(val pages: List<Page>)

    class Page(val width: Float, val height: Float, val background: Background?, val images: List<PlacedImage>, val strokes: List<Stroke>)

    sealed interface Background {
        class Pdf(val bytes: ByteArray, val pageIndex: Int) : Background
        class Image(val bytes: ByteArray) : Background
    }

    /** A picture placed on a page, in PDF points from the top left. */
    class PlacedImage(val bytes: ByteArray, val x: Float, val y: Float, val width: Float, val height: Float)

    /**
     * A stroke in PDF points from the top left: [start], then [segments] as quadratic Bézier pieces (control x, y, end
     * x, y), or a straight [polyline] (x, y, …).
     */
    class Stroke(val red: Float, val green: Float, val blue: Float, val alpha: Float, val width: Float, val start: FloatArray, val segments: FloatArray, val polyline: FloatArray?)

    fun isGoodNotes(name: String?) = name?.substringAfterLast('.', "")?.lowercase() == "goodnotes"

    fun read(zip: ByteArray): Notebook = read(unzip(zip))

    fun unzip(bytes: ByteArray): Map<String, ByteArray> {
        val files = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            var entry = zip.nextEntry
            while (entry != null) {
                if (!entry.isDirectory) files[entry.name.trimStart('/')] = zip.readBytes()
                entry = zip.nextEntry
            }
        }
        return files
    }

    fun read(files: Map<String, ByteArray>): Notebook {
        val events = files["index.events.pb"] ?: throw IllegalArgumentException("Das ist keine GoodNotes-Datei.")
        class PageInfo(val resource: String?, val number: Int, val width: Float, val height: Float)
        class Entry(var page: String? = null, var position: String = "")
        val pages = mutableMapOf<String, PageInfo>()
        val resources = mutableMapOf<String, String>()
        val entries = linkedMapOf<String, Entry>()
        val removed = mutableSetOf<String>()
        for (record in Proto.delimited(events)) {
            for (field in Proto.parse(record).drop(1)) {
                val body = field.bytes ?: continue
                val m = Proto.fields(body)
                when (field.number) {
                    2 -> {
                        val id = m.string(2) ?: continue
                        val size = m.message(8)
                        pages[id] = PageInfo(m.string(4), m.long(5)?.toInt() ?: 1, size?.float(1) ?: 1091.64f, size?.float(2) ?: 1543.08f)
                    }
                    6 -> {
                        val id = m.string(1) ?: continue
                        m.string(2)?.let { resources[id] = it }
                    }
                    54 -> {
                        val id = m.string(2) ?: continue
                        val entry = entries.getOrPut(id) { Entry() }
                        m.message(3)?.string(1)?.let { entry.page = it }
                        m.message(4)?.string(1)?.let { entry.position = it }
                    }
                    56 -> {
                        val id = m.string(2) ?: continue
                        if (m.message(3)?.long(1) == 1L) removed += id
                    }
                }
            }
        }
        val order = entries.entries.filter { it.key !in removed && it.value.page != null }.sortedBy { it.value.position }
        val result = order.mapNotNull { (id, entry) ->
            val info = pages[entry.page] ?: return@mapNotNull null
            val file = info.resource?.let { resources[it] ?: it }?.let { files["attachments/$it"] }
            val background = when {
                file == null -> null
                file.size > 4 && String(file, 0, 4, Charsets.ISO_8859_1) == "%PDF" -> Background.Pdf(file, (info.number - 1).coerceAtLeast(0))
                else -> Background.Image(file)
            }
            val notes = files["notes/" + nextUuid(id)]
            val (images, strokes) = if (notes != null) ink(notes, files) else emptyList<PlacedImage>() to emptyList()
            Page(info.width / SCALE, info.height / SCALE, background, images, strokes)
        }
        return Notebook(result)
    }

    /** The UUID one greater, as the ink file of a page list entry is named. */
    fun nextUuid(id: String): String {
        val uuid = UUID.fromString(id)
        var low = uuid.leastSignificantBits + 1
        var high = uuid.mostSignificantBits
        if (low == 0L) high += 1
        return UUID(high, low).toString().uppercase()
    }

    private fun ink(notes: ByteArray, files: Map<String, ByteArray>): Pair<List<PlacedImage>, List<Stroke>> {
        val removed = mutableSetOf<String>()
        val strokeFields = mutableListOf<Proto.Message>()
        val images = mutableListOf<PlacedImage>()
        for (record in Proto.delimited(notes)) {
            val fields = Proto.parse(record)
            val numbers = fields.map { it.number }
            when {
                numbers.firstOrNull() == 7 -> fields.first().bytes?.let { strokeFields += Proto.fields(it) }
                numbers == listOf(1) -> {
                    val m = Proto.fields(fields.first().bytes ?: continue)
                    val frame = m.message(2) ?: continue
                    val origin = frame.message(1)
                    val size = frame.message(2)
                    val bytes = m.string(4)?.let { files["attachments/$it"] } ?: continue
                    images += PlacedImage(
                        bytes,
                        (origin?.float(1) ?: 0f) / SCALE, (origin?.float(2) ?: 0f) / SCALE,
                        (size?.float(1) ?: 0f) / SCALE, (size?.float(2) ?: 0f) / SCALE,
                    )
                }
                3 in numbers -> {
                    val m = Proto.fields(record)
                    if (m.long(3) == 1L) m.string(1)?.let { removed += it }
                }
            }
        }
        val strokes = strokeFields.mapNotNull { m ->
            if (m.has(14) || m.string(1) in removed) return@mapNotNull null
            runCatching { stroke(m) }.getOrNull()
        }
        return images to strokes
    }

    private fun stroke(m: Proto.Message): Stroke? {
        val offset = m.message(6)
        val dx = offset?.float(1) ?: 0f
        val dy = offset?.float(2) ?: 0f
        val colour = m.message(4)
        val red = colour?.float(1) ?: 0f
        val green = colour?.float(2) ?: 0f
        val blue = colour?.float(3) ?: 0f
        val alpha = colour?.float(4) ?: 1f
        val shape = m.message(9)
        if (shape != null && shape.has(1)) {
            val points = mutableListOf<Float>()
            for (line in shape.messages(1)) for (point in line.messages(1)) {
                points += ((point.float(1) ?: 0f) + dx) / SCALE
                points += ((point.float(2) ?: 0f) + dy) / SCALE
            }
            if (points.size < 4) return null
            val width = (shape.float(15) ?: 0.52f) / SCALE
            return Stroke(red, green, blue, alpha, width, floatArrayOf(points[0], points[1]), FloatArray(0), points.toFloatArray())
        }
        val blob = m.bytes(2) ?: return null
        val values = Typed.decode(AppleLz4.decode(blob))
        // v u A(v) A(S(uu)) A(S(uuuu)) v A(f): version, width, flags, start point, segments, …
        if (values.size < 5) return null
        val width = java.lang.Float.intBitsToFloat((values[1] as Long).toInt()) / SCALE
        @Suppress("UNCHECKED_CAST")
        val start = (values[3] as List<List<Long>>).firstOrNull() ?: return null
        @Suppress("UNCHECKED_CAST")
        val segments = values[4] as List<List<Long>>
        fun coordinate(bits: Long, shift: Float) = (java.lang.Float.intBitsToFloat(bits.toInt()) + shift) / SCALE
        val startPoint = floatArrayOf(coordinate(start[0], dx), coordinate(start[1], dy))
        val flat = FloatArray(segments.size * 4)
        segments.forEachIndexed { i, s ->
            flat[i * 4] = coordinate(s[0], dx)
            flat[i * 4 + 1] = coordinate(s[1], dy)
            flat[i * 4 + 2] = coordinate(s[2], dx)
            flat[i * 4 + 3] = coordinate(s[3], dy)
        }
        return Stroke(red, green, blue, alpha, maxOf(width, 0.2f), startPoint, flat, null)
    }
}

/** A small protocol-buffer reader: enough for field numbers, varints, 32-bit floats and nested messages. */
object Proto {
    class Field(val number: Int, val wire: Int, val varint: Long, val bytes: ByteArray?)

    class Message(val fields: List<Field>) {
        private fun first(n: Int) = fields.firstOrNull { it.number == n }
        fun has(n: Int) = fields.any { it.number == n }
        fun long(n: Int) = first(n)?.takeIf { it.wire == 0 }?.varint
        fun bytes(n: Int) = first(n)?.bytes
        fun string(n: Int) = first(n)?.takeIf { it.wire == 2 }?.bytes?.toString(Charsets.UTF_8)
        fun float(n: Int) = first(n)?.takeIf { it.wire == 5 }?.bytes?.let {
            java.lang.Float.intBitsToFloat((it[0].toInt() and 0xff) or ((it[1].toInt() and 0xff) shl 8) or ((it[2].toInt() and 0xff) shl 16) or ((it[3].toInt() and 0xff) shl 24))
        }
        fun message(n: Int) = first(n)?.bytes?.let { runCatching { fields(it) }.getOrNull() }
        fun messages(n: Int) = fields.filter { it.number == n }.mapNotNull { f -> f.bytes?.let { runCatching { fields(it) }.getOrNull() } }
    }

    fun fields(bytes: ByteArray) = Message(parse(bytes))

    fun parse(bytes: ByteArray): List<Field> {
        val out = mutableListOf<Field>()
        var i = 0
        while (i < bytes.size) {
            val (key, afterKey) = varint(bytes, i)
            i = afterKey
            val number = (key ushr 3).toInt()
            when (val wire = (key and 7).toInt()) {
                0 -> {
                    val (value, next) = varint(bytes, i)
                    out += Field(number, wire, value, null)
                    i = next
                }
                1 -> {
                    require(i + 8 <= bytes.size)
                    out += Field(number, wire, 0, bytes.copyOfRange(i, i + 8))
                    i += 8
                }
                2 -> {
                    val (length, next) = varint(bytes, i)
                    val end = next + length.toInt()
                    require(length >= 0 && end <= bytes.size)
                    out += Field(number, wire, 0, bytes.copyOfRange(next, end))
                    i = end
                }
                5 -> {
                    require(i + 4 <= bytes.size)
                    out += Field(number, wire, 0, bytes.copyOfRange(i, i + 4))
                    i += 4
                }
                else -> throw IllegalArgumentException("wire type $wire")
            }
        }
        return out
    }

    /** Records each preceded by their length, as GoodNotes writes its logs */
    fun delimited(bytes: ByteArray): List<ByteArray> {
        val out = mutableListOf<ByteArray>()
        var i = 0
        while (i < bytes.size) {
            val (length, next) = varint(bytes, i)
            val end = next + length.toInt()
            if (length < 0 || end > bytes.size) break
            out += bytes.copyOfRange(next, end)
            i = end
        }
        return out
    }

    fun varint(bytes: ByteArray, start: Int): Pair<Long, Int> {
        var result = 0L
        var shift = 0
        var i = start
        while (true) {
            require(i < bytes.size && shift < 64)
            val b = bytes[i++].toInt() and 0xff
            result = result or ((b and 0x7f).toLong() shl shift)
            if (b < 0x80) return result to i
            shift += 7
        }
    }
}

/** Apple's LZ4 frames (`bv41` compressed, `bv4-` stored, `bv4$` end) as the Compression framework writes them. */
object AppleLz4 {
    fun decode(data: ByteArray): ByteArray {
        val out = java.io.ByteArrayOutputStream()
        var i = 0
        while (i + 4 <= data.size) {
            val tag = String(data, i, 4, Charsets.ISO_8859_1)
            when (tag) {
                "bv4$" -> return out.toByteArray()
                "bv41" -> {
                    val size = le32(data, i + 4)
                    val compressed = le32(data, i + 8)
                    out.write(block(data, i + 12, compressed, size))
                    i += 12 + compressed
                }
                "bv4-" -> {
                    val size = le32(data, i + 4)
                    out.write(data, i + 8, size)
                    i += 8 + size
                }
                else -> throw IllegalArgumentException("LZ4 frame $tag")
            }
        }
        return out.toByteArray()
    }

    private fun le32(b: ByteArray, i: Int) = (b[i].toInt() and 0xff) or ((b[i + 1].toInt() and 0xff) shl 8) or ((b[i + 2].toInt() and 0xff) shl 16) or ((b[i + 3].toInt() and 0xff) shl 24)

    /** An LZ4 block: literals and back references. */
    fun block(src: ByteArray, start: Int, length: Int, size: Int): ByteArray {
        val out = ByteArray(size)
        var o = 0
        var i = start
        val end = start + length
        while (i < end) {
            val token = src[i++].toInt() and 0xff
            var literals = token ushr 4
            if (literals == 15) {
                while (true) {
                    val b = src[i++].toInt() and 0xff
                    literals += b
                    if (b != 255) break
                }
            }
            System.arraycopy(src, i, out, o, literals)
            i += literals
            o += literals
            if (i >= end) break
            val offset = (src[i].toInt() and 0xff) or ((src[i + 1].toInt() and 0xff) shl 8)
            i += 2
            var match = (token and 15) + 4
            if (match == 19) {
                while (true) {
                    val b = src[i++].toInt() and 0xff
                    match += b
                    if (b != 255) break
                }
            }
            require(offset in 1..o)
            // Byte by byte: a reference may overlap what it writes.
            for (k in 0 until match) out[o + k] = out[o - offset + k]
            o += match
        }
        return out
    }
}

/**
 * GoodNotes' typed records: `tpl\0`, the total length, a type string such as `vuA(v)A(S(uu))` and the values in
 * order — v a 16-bit number, u and f 32 bits (as raw bits here), A(…) a count and that many items, S(…) a group.
 */
object Typed {
    fun decode(data: ByteArray): List<Any> {
        require(data.size > 8 && String(data, 0, 4, Charsets.ISO_8859_1) == "tpl\u0000")
        var end = 8
        while (data[end].toInt() != 0) end++
        val types = String(data, 8, end - 8, Charsets.US_ASCII)
        val reader = Reader(data, end + 1)
        val out = mutableListOf<Any>()
        var t = 0
        while (t < types.length) {
            val (value, next) = reader.read(types, t)
            out += value
            t = next
        }
        return out
    }

    private class Reader(val data: ByteArray, var i: Int) {
        fun u16(): Long = ((data[i].toInt() and 0xff) or ((data[i + 1].toInt() and 0xff) shl 8)).toLong().also { i += 2 }
        fun u32(): Long = ((data[i].toLong() and 0xff) or ((data[i + 1].toLong() and 0xff) shl 8) or ((data[i + 2].toLong() and 0xff) shl 16) or ((data[i + 3].toLong() and 0xff) shl 24)).also { i += 4 }

        /** Reads the value of the type at [t]; returns it and where the next type starts. */
        fun read(types: String, t: Int): Pair<Any, Int> = when (types[t]) {
            'v' -> u16() to t + 1
            'u', 'f' -> u32() to t + 1
            'A' -> {
                val count = u32().toInt()
                val inner = t + 2
                var next = skip(types, inner)
                val items = ArrayList<Any>(count)
                repeat(count) { items += read(types, inner).first }
                if (count == 0) next = skip(types, inner)
                items to next + 1
            }
            'S' -> {
                var k = t + 2
                val items = mutableListOf<Any>()
                while (types[k] != ')') {
                    val (value, next) = read(types, k)
                    items += value
                    k = next
                }
                items to k + 1
            }
            else -> throw IllegalArgumentException("type ${types[t]}")
        }

        /** Where the type starting at [t] ends, without reading. */
        fun skip(types: String, t: Int): Int = when (types[t]) {
            'v', 'u', 'f' -> t + 1
            'A' -> skip(types, t + 2) + 1
            'S' -> {
                var k = t + 2
                while (types[k] != ')') k = skip(types, k)
                k + 1
            }
            else -> throw IllegalArgumentException("type ${types[t]}")
        }
    }
}

import Foundation

/// Reads a GoodNotes 6 notebook (`.goodnotes`): a ZIP of protocol-buffer logs, or an older version's package folder.
/// GoodNotes' own PDF export leaves pages that are photos or imported PDFs white; here every page comes back with its
/// background, pictures and handwriting. Kept free of UIKit so it runs in the tests; `GoodNotesRenderer` draws it.
///
/// - `index.events.pb`: pages (field 2) name their background resource (field 4) and size (field 8); resources
///   (field 6) point at files in `attachments/`; page list entries (field 54) hold a page and a position string,
///   sorted as text; field 56 with 1 in field 3 removes an entry.
/// - `notes/<entry + 1>`: the ink of the page list entry whose UUID is one less. Strokes (field 7) carry their points
///   as an Apple LZ4 block of a typed record (start point, then quadratic Bézier segments), their colour (field 4,
///   RGBA floats), their offset (field 6) and straight lines as point lists (field 9); field 14 or a tombstone
///   (field 3 = 1) removes one. Pictures on a page are records with a single field 1.
/// - Coordinates are PDF points times 11/6.
enum GoodNotes {
    static let scale: Float = 11 / 6

    enum GoodNotesError: Error {
        case notGoodNotes
        case noPages
    }

    struct Notebook {
        var pages: [Page]
    }

    struct Page {
        var width: Float
        var height: Float
        var background: Background?
        var images: [PlacedImage]
        var strokes: [Stroke]
    }

    enum Background {
        case pdf(Data, pageIndex: Int)
        case image(Data)
    }

    /// A picture placed on a page, in PDF points from the top left.
    struct PlacedImage {
        var data: Data
        var x: Float
        var y: Float
        var width: Float
        var height: Float
    }

    /// In PDF points from the top left: `start`, then `segments` as quadratic Bézier pieces (control x, y, end x, y),
    /// or a straight `polyline` (x, y, …).
    struct Stroke {
        var red: Float
        var green: Float
        var blue: Float
        var alpha: Float
        var width: Float
        var start: [Float]
        var segments: [Float]
        var polyline: [Float]?
    }

    static func isGoodNotes(_ url: URL) -> Bool {
        url.pathExtension.lowercased() == "goodnotes"
    }

    /// The notebook at `url`: a ZIP file, or a package folder of an older version.
    static func read(url: URL) throws -> Notebook {
        var isDirectory: ObjCBool = false
        if FileManager.default.fileExists(atPath: url.path, isDirectory: &isDirectory), isDirectory.boolValue {
            var files: [String: Data] = [:]
            let root = url.standardizedFileURL.path
            if let walker = FileManager.default.enumerator(atPath: root) {
                for case let relative as String in walker {
                    let path = (root as NSString).appendingPathComponent(relative)
                    var directory: ObjCBool = false
                    if FileManager.default.fileExists(atPath: path, isDirectory: &directory), !directory.boolValue {
                        files[relative] = try Data(contentsOf: URL(fileURLWithPath: path))
                    }
                }
            }
            return try read(files: files)
        }
        return try read(files: ZipArchive.files(Data(contentsOf: url)))
    }

    static func read(files: [String: Data]) throws -> Notebook {
        guard let events = files["index.events.pb"] else { throw GoodNotesError.notGoodNotes }
        struct PageInfo {
            var resource: String?
            var number: Int
            var width: Float
            var height: Float
        }
        var pages: [String: PageInfo] = [:]
        var resources: [String: String] = [:]
        var entries: [String: (page: String?, position: String)] = [:]
        var removed: Set<String> = []
        for record in Proto.delimited(events) {
            guard let fields = try? Proto.parse(record) else { continue }
            for field in fields.dropFirst() {
                guard let body = field.bytes, let m = try? Proto.Message(body) else { continue }
                switch field.number {
                case 2:
                    guard let id = m.string(2) else { continue }
                    let size = m.message(8)
                    pages[id] = PageInfo(resource: m.string(4), number: Int(m.int(5) ?? 1), width: size?.float(1) ?? 1091.64, height: size?.float(2) ?? 1543.08)
                case 6:
                    if let id = m.string(1), let file = m.string(2) { resources[id] = file }
                case 54:
                    guard let id = m.string(2) else { continue }
                    var entry = entries[id] ?? (nil, "")
                    if let page = m.message(3)?.string(1) { entry.page = page }
                    if let position = m.message(4)?.string(1) { entry.position = position }
                    entries[id] = entry
                case 56:
                    if let id = m.string(2), m.message(3)?.int(1) == 1 { removed.insert(id) }
                default:
                    break
                }
            }
        }
        let order = entries.filter { !removed.contains($0.key) && $0.value.page != nil }
            .sorted { $0.value.position.utf8.lexicographicallyPrecedes($1.value.position.utf8) }
        var result: [Page] = []
        for (id, entry) in order {
            guard let pageID = entry.page, let info = pages[pageID] else { continue }
            let file = info.resource.flatMap { files["attachments/" + (resources[$0] ?? $0)] }
            var background: Background?
            if let file {
                background = file.prefix(4) == Data("%PDF".utf8) ? .pdf(file, pageIndex: max(info.number - 1, 0)) : .image(file)
            }
            var images: [PlacedImage] = []
            var strokes: [Stroke] = []
            if let next = nextUUID(id), let notes = files["notes/" + next] {
                (images, strokes) = ink(notes, files: files)
            }
            result.append(Page(width: info.width / scale, height: info.height / scale, background: background, images: images, strokes: strokes))
        }
        guard !result.isEmpty else { throw GoodNotesError.noPages }
        return Notebook(pages: result)
    }

    /// The UUID one greater, as the ink file of a page list entry is named.
    static func nextUUID(_ id: String) -> String? {
        guard let uuid = UUID(uuidString: id) else { return nil }
        var bytes = withUnsafeBytes(of: uuid.uuid) { Array($0) }
        for i in stride(from: 15, through: 0, by: -1) {
            bytes[i] = bytes[i] &+ 1
            if bytes[i] != 0 { break }
        }
        let t = (bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7], bytes[8], bytes[9], bytes[10], bytes[11], bytes[12], bytes[13], bytes[14], bytes[15])
        return UUID(uuid: t).uuidString
    }

    private static func ink(_ notes: Data, files: [String: Data]) -> ([PlacedImage], [Stroke]) {
        var removed: Set<String> = []
        var strokeMessages: [Proto.Message] = []
        var images: [PlacedImage] = []
        for record in Proto.delimited(notes) {
            guard let fields = try? Proto.parse(record), let first = fields.first else { continue }
            let numbers = fields.map(\.number)
            if first.number == 7, let body = first.bytes, let m = try? Proto.Message(body) {
                strokeMessages.append(m)
            } else if numbers == [1], let body = first.bytes, let m = try? Proto.Message(body) {
                guard let frame = m.message(2), let name = m.string(4), let data = files["attachments/" + name] else { continue }
                let origin = frame.message(1)
                let size = frame.message(2)
                images.append(PlacedImage(
                    data: data,
                    x: (origin?.float(1) ?? 0) / scale, y: (origin?.float(2) ?? 0) / scale,
                    width: (size?.float(1) ?? 0) / scale, height: (size?.float(2) ?? 0) / scale
                ))
            } else if numbers.contains(3), let m = try? Proto.Message(record), m.int(3) == 1, let id = m.string(1) {
                removed.insert(id)
            }
        }
        let strokes = strokeMessages.compactMap { m -> Stroke? in
            if m.has(14) { return nil }
            if let id = m.string(1), removed.contains(id) { return nil }
            return try? stroke(m)
        }
        return (images, strokes)
    }

    private static func stroke(_ m: Proto.Message) throws -> Stroke? {
        let offset = m.message(6)
        let dx = offset?.float(1) ?? 0
        let dy = offset?.float(2) ?? 0
        let colour = m.message(4)
        let red = colour?.float(1) ?? 0
        let green = colour?.float(2) ?? 0
        let blue = colour?.float(3) ?? 0
        let alpha = colour?.float(4) ?? 1
        if let shape = m.message(9), shape.has(1) {
            var points: [Float] = []
            for line in shape.messages(1) {
                for point in line.messages(1) {
                    points.append(((point.float(1) ?? 0) + dx) / scale)
                    points.append(((point.float(2) ?? 0) + dy) / scale)
                }
            }
            guard points.count >= 4 else { return nil }
            return Stroke(red: red, green: green, blue: blue, alpha: alpha, width: (shape.float(15) ?? 0.52) / scale, start: Array(points.prefix(2)), segments: [], polyline: points)
        }
        guard let blob = m.bytes(2) else { return nil }
        let values = try Typed.decode(AppleLZ4.decode(blob))
        // v u A(v) A(S(uu)) A(S(uuuu)) v A(f): version, width, flags, start point, segments, …
        guard values.count >= 5, case let .number(widthBits) = values[1],
              case let .list(starts) = values[3], case let .list(start)? = starts.first,
              case let .list(segments) = values[4] else { return nil }
        func coordinate(_ value: Typed.Value, _ shift: Float) -> Float {
            guard case let .number(bits) = value else { return 0 }
            return (Float(bitPattern: UInt32(truncatingIfNeeded: bits)) + shift) / scale
        }
        guard start.count >= 2 else { return nil }
        var flat: [Float] = []
        for case let .list(s) in segments where s.count >= 4 {
            flat += [coordinate(s[0], dx), coordinate(s[1], dy), coordinate(s[2], dx), coordinate(s[3], dy)]
        }
        let width = Float(bitPattern: UInt32(truncatingIfNeeded: widthBits)) / scale
        return Stroke(red: red, green: green, blue: blue, alpha: alpha, width: max(width, 0.2), start: [coordinate(start[0], dx), coordinate(start[1], dy)], segments: flat, polyline: nil)
    }
}

/// A small protocol-buffer reader: field numbers, varints, 32-bit floats and nested messages.
enum Proto {
    enum ProtoError: Error {
        case truncated
        case wireType(Int)
    }

    struct Field {
        var number: Int
        var wire: Int
        var varint: UInt64
        var bytes: Data?
    }

    struct Message {
        var fields: [Field]

        init(_ data: Data) throws {
            fields = try Proto.parse(data)
        }

        private func first(_ n: Int) -> Field? { fields.first { $0.number == n } }
        func has(_ n: Int) -> Bool { fields.contains { $0.number == n } }
        func int(_ n: Int) -> UInt64? { first(n).flatMap { $0.wire == 0 ? $0.varint : nil } }
        func bytes(_ n: Int) -> Data? { first(n)?.bytes }
        func string(_ n: Int) -> String? { first(n).flatMap { $0.wire == 2 ? $0.bytes.flatMap { String(data: $0, encoding: .utf8) } : nil } }
        func float(_ n: Int) -> Float? {
            guard let f = first(n), f.wire == 5, let b = f.bytes, b.count == 4 else { return nil }
            let a = Array(b)
            return Float(bitPattern: UInt32(a[0]) | UInt32(a[1]) << 8 | UInt32(a[2]) << 16 | UInt32(a[3]) << 24)
        }
        func message(_ n: Int) -> Message? { first(n)?.bytes.flatMap { try? Message($0) } }
        func messages(_ n: Int) -> [Message] { fields.filter { $0.number == n }.compactMap { $0.bytes.flatMap { try? Message($0) } } }
    }

    static func parse(_ data: Data) throws -> [Field] {
        let b = Array(data)
        var out: [Field] = []
        var i = 0
        while i < b.count {
            let key = try varint(b, &i)
            let number = Int(key >> 3)
            let wire = Int(key & 7)
            switch wire {
            case 0:
                out.append(Field(number: number, wire: wire, varint: try varint(b, &i), bytes: nil))
            case 1:
                guard i + 8 <= b.count else { throw ProtoError.truncated }
                out.append(Field(number: number, wire: wire, varint: 0, bytes: Data(b[i ..< i + 8])))
                i += 8
            case 2:
                let length = Int(try varint(b, &i))
                guard length >= 0, i + length <= b.count else { throw ProtoError.truncated }
                out.append(Field(number: number, wire: wire, varint: 0, bytes: Data(b[i ..< i + length])))
                i += length
            case 5:
                guard i + 4 <= b.count else { throw ProtoError.truncated }
                out.append(Field(number: number, wire: wire, varint: 0, bytes: Data(b[i ..< i + 4])))
                i += 4
            default:
                throw ProtoError.wireType(wire)
            }
        }
        return out
    }

    /// Records each preceded by their length, as GoodNotes writes its logs.
    static func delimited(_ data: Data) -> [Data] {
        let b = Array(data)
        var out: [Data] = []
        var i = 0
        while i < b.count {
            guard let length = try? varint(b, &i), Int(length) >= 0, i + Int(length) <= b.count else { break }
            out.append(Data(b[i ..< i + Int(length)]))
            i += Int(length)
        }
        return out
    }

    static func varint(_ b: [UInt8], _ i: inout Int) throws -> UInt64 {
        var result: UInt64 = 0
        var shift: UInt64 = 0
        while true {
            guard i < b.count, shift < 64 else { throw ProtoError.truncated }
            let byte = b[i]
            i += 1
            result |= UInt64(byte & 0x7f) << shift
            if byte < 0x80 { return result }
            shift += 7
        }
    }
}

/// Apple's LZ4 frames (`bv41` compressed, `bv4-` stored, `bv4$` end), decoded here so it also runs off Apple
/// platforms in the tests.
enum AppleLZ4 {
    enum LZ4Error: Error {
        case frame
        case block
    }

    static func decode(_ data: Data) throws -> [UInt8] {
        let b = Array(data)
        var out: [UInt8] = []
        var i = 0
        func le32(_ at: Int) -> Int { Int(b[at]) | Int(b[at + 1]) << 8 | Int(b[at + 2]) << 16 | Int(b[at + 3]) << 24 }
        while i + 4 <= b.count {
            let tag = String(decoding: b[i ..< i + 4], as: UTF8.self)
            switch tag {
            case "bv4$":
                return out
            case "bv41":
                guard i + 12 <= b.count else { throw LZ4Error.frame }
                let size = le32(i + 4)
                let compressed = le32(i + 8)
                guard i + 12 + compressed <= b.count else { throw LZ4Error.frame }
                out += try block(Array(b[i + 12 ..< i + 12 + compressed]), size: size)
                i += 12 + compressed
            case "bv4-":
                let size = le32(i + 4)
                guard i + 8 + size <= b.count else { throw LZ4Error.frame }
                out += b[i + 8 ..< i + 8 + size]
                i += 8 + size
            default:
                throw LZ4Error.frame
            }
        }
        return out
    }

    /// An LZ4 block: literals and back references.
    static func block(_ src: [UInt8], size: Int) throws -> [UInt8] {
        var out: [UInt8] = []
        out.reserveCapacity(size)
        var i = 0
        while i < src.count {
            let token = Int(src[i])
            i += 1
            var literals = token >> 4
            if literals == 15 {
                while true {
                    guard i < src.count else { throw LZ4Error.block }
                    let byte = Int(src[i])
                    i += 1
                    literals += byte
                    if byte != 255 { break }
                }
            }
            guard i + literals <= src.count else { throw LZ4Error.block }
            out += src[i ..< i + literals]
            i += literals
            if i >= src.count { break }
            guard i + 2 <= src.count else { throw LZ4Error.block }
            let offset = Int(src[i]) | Int(src[i + 1]) << 8
            i += 2
            var match = (token & 15) + 4
            if match == 19 {
                while true {
                    guard i < src.count else { throw LZ4Error.block }
                    let byte = Int(src[i])
                    i += 1
                    match += byte
                    if byte != 255 { break }
                }
            }
            guard offset > 0, offset <= out.count else { throw LZ4Error.block }
            // Byte by byte: a reference may overlap what it writes.
            let from = out.count - offset
            for k in 0 ..< match { out.append(out[from + k]) }
        }
        return out
    }
}

/// GoodNotes' typed records: `tpl\0`, the total length, a type string such as `vuA(v)A(S(uu))` and the values —
/// v a 16-bit number, u and f 32 bits (kept as raw bits), A(…) a count and that many items, S(…) a group.
enum Typed {
    indirect enum Value {
        case number(UInt32)
        case list([Value])
    }

    enum TypedError: Error {
        case header
        case type
        case truncated
    }

    static func decode(_ data: [UInt8]) throws -> [Value] {
        guard data.count > 8, Array(data[0 ..< 4]) == Array("tpl\u{0}".utf8) else { throw TypedError.header }
        var end = 8
        while end < data.count, data[end] != 0 { end += 1 }
        guard end < data.count else { throw TypedError.header }
        let types = Array(data[8 ..< end])
        var i = end + 1
        var t = 0
        var out: [Value] = []
        while t < types.count {
            let (value, next) = try read(types, t, data, &i)
            out.append(value)
            t = next
        }
        return out
    }

    private static func read(_ types: [UInt8], _ t: Int, _ data: [UInt8], _ i: inout Int) throws -> (Value, Int) {
        switch types[t] {
        case UInt8(ascii: "v"):
            guard i + 2 <= data.count else { throw TypedError.truncated }
            let v = UInt32(data[i]) | UInt32(data[i + 1]) << 8
            i += 2
            return (.number(v), t + 1)
        case UInt8(ascii: "u"), UInt8(ascii: "f"):
            guard i + 4 <= data.count else { throw TypedError.truncated }
            let v = UInt32(data[i]) | UInt32(data[i + 1]) << 8 | UInt32(data[i + 2]) << 16 | UInt32(data[i + 3]) << 24
            i += 4
            return (.number(v), t + 1)
        case UInt8(ascii: "A"):
            guard i + 4 <= data.count else { throw TypedError.truncated }
            let count = Int(UInt32(data[i]) | UInt32(data[i + 1]) << 8 | UInt32(data[i + 2]) << 16 | UInt32(data[i + 3]) << 24)
            i += 4
            let inner = t + 2
            var items: [Value] = []
            items.reserveCapacity(min(count, 100_000))
            for _ in 0 ..< count { items.append(try read(types, inner, data, &i).0) }
            return (.list(items), try skip(types, inner) + 1)
        case UInt8(ascii: "S"):
            var k = t + 2
            var items: [Value] = []
            while k < types.count, types[k] != UInt8(ascii: ")") {
                let (value, next) = try read(types, k, data, &i)
                items.append(value)
                k = next
            }
            return (.list(items), k + 1)
        default:
            throw TypedError.type
        }
    }

    private static func skip(_ types: [UInt8], _ t: Int) throws -> Int {
        guard t < types.count else { throw TypedError.type }
        switch types[t] {
        case UInt8(ascii: "v"), UInt8(ascii: "u"), UInt8(ascii: "f"):
            return t + 1
        case UInt8(ascii: "A"):
            return try skip(types, t + 2) + 1
        case UInt8(ascii: "S"):
            var k = t + 2
            while k < types.count, types[k] != UInt8(ascii: ")") { k = try skip(types, k) }
            return k + 1
        default:
            throw TypedError.type
        }
    }
}

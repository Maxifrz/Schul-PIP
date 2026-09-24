import Foundation
#if canImport(Compression)
import Compression
#endif

/// Reads the files of a ZIP archive (stored or deflated entries), enough for Office files. Pure Swift, so it
/// behaves the same on every platform and needs no system library.
enum ZipArchive {
    enum ZipError: Error {
        case notAZip
        case unsupportedMethod(Int)
        case corrupt
    }

    /// Every file in the archive by its path; folders are left out.
    static func files(_ data: Data) throws -> [String: Data] {
        let bytes = [UInt8](data)
        guard let end = endOfCentralDirectory(bytes) else { throw ZipError.notAZip }
        let count = Int(u16(bytes, end + 10))
        var offset = Int(u32(bytes, end + 16))
        var result: [String: Data] = [:]
        for _ in 0..<count {
            guard offset + 46 <= bytes.count, u32(bytes, offset) == 0x0201_4B50 else { throw ZipError.corrupt }
            let method = Int(u16(bytes, offset + 10))
            let compressedSize = Int(u32(bytes, offset + 20))
            let size = Int(u32(bytes, offset + 24))
            let nameLength = Int(u16(bytes, offset + 28))
            let extraLength = Int(u16(bytes, offset + 30))
            let commentLength = Int(u16(bytes, offset + 32))
            let localOffset = Int(u32(bytes, offset + 42))
            guard offset + 46 + nameLength <= bytes.count else { throw ZipError.corrupt }
            let name = String(decoding: bytes[(offset + 46)..<(offset + 46 + nameLength)], as: UTF8.self)
            offset += 46 + nameLength + extraLength + commentLength

            if name.hasSuffix("/") { continue }
            guard localOffset + 30 <= bytes.count, u32(bytes, localOffset) == 0x0403_4B50 else { throw ZipError.corrupt }
            let start = localOffset + 30 + Int(u16(bytes, localOffset + 26)) + Int(u16(bytes, localOffset + 28))
            guard start + compressedSize <= bytes.count else { throw ZipError.corrupt }
            let body = Array(bytes[start..<(start + compressedSize)])
            let path = name.hasPrefix("/") ? String(name.drop { $0 == "/" }) : name
            switch method {
            case 0: result[path] = Data(body)
            case 8: result[path] = try inflate(body, size: size)
            default: throw ZipError.unsupportedMethod(method)
            }
        }
        return result
    }

    private static func inflate(_ body: [UInt8], size: Int) throws -> Data {
        #if canImport(Compression)
        // Apple's decoder is much faster for large pictures; COMPRESSION_ZLIB is raw DEFLATE.
        if size > 0, !body.isEmpty {
            var output = [UInt8](repeating: 0, count: size)
            let written = body.withUnsafeBufferPointer { source in
                output.withUnsafeMutableBufferPointer { target in
                    compression_decode_buffer(target.baseAddress!, size, source.baseAddress!, body.count, nil, COMPRESSION_ZLIB)
                }
            }
            if written == size { return Data(output) }
        }
        #endif
        return Data(try Inflate.inflate(body, expectedSize: size))
    }

    private static func endOfCentralDirectory(_ bytes: [UInt8]) -> Int? {
        guard bytes.count >= 22 else { return nil }
        // The record is at the end, followed by a comment of at most 65535 bytes.
        let lowest = max(0, bytes.count - 22 - 65535)
        var index = bytes.count - 22
        while index >= lowest {
            if u32(bytes, index) == 0x0605_4B50 { return index }
            index -= 1
        }
        return nil
    }

    private static func u16(_ bytes: [UInt8], _ at: Int) -> UInt16 {
        UInt16(bytes[at]) | UInt16(bytes[at + 1]) << 8
    }

    private static func u32(_ bytes: [UInt8], _ at: Int) -> UInt32 {
        UInt32(bytes[at]) | UInt32(bytes[at + 1]) << 8 | UInt32(bytes[at + 2]) << 16 | UInt32(bytes[at + 3]) << 24
    }
}

/// Raw DEFLATE decompression (RFC 1951), following zlib's reference decoder "puff".
enum Inflate {
    enum InflateError: Error {
        case corrupt
    }

    private struct Huffman {
        var counts = [Int](repeating: 0, count: 16)
        var symbols: [Int]

        init(lengths: ArraySlice<Int>) {
            symbols = [Int](repeating: 0, count: lengths.count)
            for length in lengths { counts[length] += 1 }
            var offsets = [Int](repeating: 0, count: 16)
            for bits in 1..<15 { offsets[bits + 1] = offsets[bits] + counts[bits] }
            for (symbol, length) in lengths.enumerated() where length != 0 {
                symbols[offsets[length]] = symbol
                offsets[length] += 1
            }
        }
    }

    private struct Reader {
        let input: [UInt8]
        var position = 0
        var buffer = 0
        var count = 0
        var output: [UInt8] = []

        init(_ input: [UInt8]) {
            self.input = input
        }

        mutating func bits(_ need: Int) throws -> Int {
            var value = buffer
            while count < need {
                guard position < input.count else { throw InflateError.corrupt }
                value |= Int(input[position]) << count
                position += 1
                count += 8
            }
            buffer = value >> need
            count -= need
            return value & ((1 << need) - 1)
        }

        mutating func decode(_ huffman: Huffman) throws -> Int {
            var code = 0
            var first = 0
            var index = 0
            for length in 1..<16 {
                code |= try bits(1)
                let count = huffman.counts[length]
                if code - count < first { return huffman.symbols[index + (code - first)] }
                index += count
                first += count
                first <<= 1
                code <<= 1
            }
            throw InflateError.corrupt
        }
    }

    private static let lengthBase = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258]
    private static let lengthExtra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0]
    private static let distanceBase = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577]
    private static let distanceExtra = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13]
    private static let codeLengthOrder = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]

    private static let fixed: (Huffman, Huffman) = {
        var lengths = [Int](repeating: 0, count: 288 + 30)
        for symbol in 0..<144 { lengths[symbol] = 8 }
        for symbol in 144..<256 { lengths[symbol] = 9 }
        for symbol in 256..<280 { lengths[symbol] = 7 }
        for symbol in 280..<288 { lengths[symbol] = 8 }
        for symbol in 288..<318 { lengths[symbol] = 5 }
        return (Huffman(lengths: lengths[0..<288]), Huffman(lengths: lengths[288..<318]))
    }()

    static func inflate(_ input: [UInt8], expectedSize: Int = 0) throws -> [UInt8] {
        var reader = Reader(input)
        reader.output.reserveCapacity(expectedSize)
        var last = 0
        repeat {
            last = try reader.bits(1)
            switch try reader.bits(2) {
            case 0: try stored(&reader)
            case 1: try codes(&reader, fixed.0, fixed.1)
            case 2:
                let (lengths, distances) = try dynamic(&reader)
                try codes(&reader, lengths, distances)
            default: throw InflateError.corrupt
            }
        } while last == 0
        return reader.output
    }

    private static func stored(_ reader: inout Reader) throws {
        reader.buffer = 0
        reader.count = 0
        guard reader.position + 4 <= reader.input.count else { throw InflateError.corrupt }
        let length = Int(reader.input[reader.position]) | Int(reader.input[reader.position + 1]) << 8
        let complement = Int(reader.input[reader.position + 2]) | Int(reader.input[reader.position + 3]) << 8
        guard length == (~complement & 0xFFFF) else { throw InflateError.corrupt }
        reader.position += 4
        guard reader.position + length <= reader.input.count else { throw InflateError.corrupt }
        reader.output.append(contentsOf: reader.input[reader.position..<(reader.position + length)])
        reader.position += length
    }

    private static func codes(_ reader: inout Reader, _ lengths: Huffman, _ distances: Huffman) throws {
        while true {
            let symbol = try reader.decode(lengths)
            if symbol < 256 {
                reader.output.append(UInt8(symbol))
            } else if symbol == 256 {
                return
            } else {
                let index = symbol - 257
                guard index < 29 else { throw InflateError.corrupt }
                let length = lengthBase[index] + (try reader.bits(lengthExtra[index]))
                let distanceSymbol = try reader.decode(distances)
                guard distanceSymbol < 30 else { throw InflateError.corrupt }
                let distance = distanceBase[distanceSymbol] + (try reader.bits(distanceExtra[distanceSymbol]))
                guard distance <= reader.output.count else { throw InflateError.corrupt }
                let start = reader.output.count - distance
                for offset in 0..<length { reader.output.append(reader.output[start + offset]) }
            }
        }
    }

    private static func dynamic(_ reader: inout Reader) throws -> (Huffman, Huffman) {
        let literalCount = try reader.bits(5) + 257
        let distanceCount = try reader.bits(5) + 1
        let codeCount = try reader.bits(4) + 4
        guard literalCount <= 286, distanceCount <= 30 else { throw InflateError.corrupt }
        var codeLengths = [Int](repeating: 0, count: 19)
        for index in 0..<codeCount { codeLengths[codeLengthOrder[index]] = try reader.bits(3) }
        let codeHuffman = Huffman(lengths: codeLengths[0..<19])

        var lengths = [Int](repeating: 0, count: literalCount + distanceCount)
        var index = 0
        while index < literalCount + distanceCount {
            var symbol = try reader.decode(codeHuffman)
            if symbol < 16 {
                lengths[index] = symbol
                index += 1
                continue
            }
            var repeated = 0
            if symbol == 16 {
                guard index > 0 else { throw InflateError.corrupt }
                repeated = lengths[index - 1]
                symbol = 3 + (try reader.bits(2))
            } else if symbol == 17 {
                symbol = 3 + (try reader.bits(3))
            } else {
                symbol = 11 + (try reader.bits(7))
            }
            guard index + symbol <= literalCount + distanceCount else { throw InflateError.corrupt }
            for _ in 0..<symbol {
                lengths[index] = repeated
                index += 1
            }
        }
        guard lengths[256] != 0 else { throw InflateError.corrupt }
        return (Huffman(lengths: lengths[0..<literalCount]), Huffman(lengths: lengths[literalCount..<(literalCount + distanceCount)]))
    }
}

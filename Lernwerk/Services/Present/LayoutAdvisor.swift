import Foundation

/// Decides, before a slide is built, whether its content fits one slide. Nothing is cut: what does not fit moves into
/// columns or onto follow-up slides. Works on drafts, so the layouts stay the only place that knows geometry.
enum LayoutAdvisor {
    static let maxCards = 4
    static let maxSteps = 5
    static let maxEvents = 6
    /// Data rows per table slide, without the header row.
    static let maxTableRows = 7
    /// Bullets below this size in a single column move to two columns or more slides.
    static let readableSize: Double = 18
    /// The floor for two columns, which are narrower.
    static let readableColumnSize: Double = 16

    static func split(_ drafts: [SlideDraft]) -> [SlideDraft] {
        drafts.flatMap(split)
    }

    static func split(_ draft: SlideDraft) -> [SlideDraft] {
        switch draft.layout {
        case .cards: return parts(draft, of: draft.items, max: maxCards) { $0.items = $1 }
        case .process: return parts(draft, of: draft.items, max: maxSteps) { $0.items = $1 }
        case .timeline: return parts(draft, of: draft.items, max: maxEvents) { $0.items = $1 }
        case .table: return tableParts(draft)
        case .bullets: return bulletParts(draft)
        default: return [draft]
        }
    }

    /// Sizes of `count` items over the fewest slides of at most `max` each, as even as possible: 5 becomes 3 + 2.
    static func evenSizes(_ count: Int, max limit: Int) -> [Int] {
        guard count > 0, limit > 0 else { return [] }
        let slides = (count + limit - 1) / limit
        let base = count / slides
        let extra = count % slides
        return (0..<slides).map { base + ($0 < extra ? 1 : 0) }
    }

    private static func chunks<T>(_ values: [T], sizes: [Int]) -> [[T]] {
        var start = 0
        return sizes.map { size in
            defer { start += size }
            return Array(values[start..<start + size])
        }
    }

    /// Follow-up copies: titles numbered, notes on the first part only, sources on all.
    private static func numbered(_ base: SlideDraft, _ variants: [SlideDraft]) -> [SlideDraft] {
        guard variants.count > 1 else { return variants }
        return variants.enumerated().map { index, variant in
            var part = variant
            part.title = base.title.isBlank ? "(\(index + 1)/\(variants.count))" : "\(base.title) (\(index + 1)/\(variants.count))"
            if index > 0 { part.notes = "" }
            return part
        }
    }

    private static func parts<T>(_ draft: SlideDraft, of values: [T], max limit: Int, set: (inout SlideDraft, [T]) -> Void) -> [SlideDraft] {
        guard values.count > limit else { return [draft] }
        let variants = chunks(values, sizes: evenSizes(values.count, max: limit)).map { chunk -> SlideDraft in
            var part = draft
            set(&part, chunk)
            return part
        }
        return numbered(draft, variants)
    }

    private static func tableParts(_ draft: SlideDraft) -> [SlideDraft] {
        guard let header = draft.table.first, draft.table.count - 1 > maxTableRows else { return [draft] }
        let rows = Array(draft.table.dropFirst())
        let variants = chunks(rows, sizes: evenSizes(rows.count, max: maxTableRows)).map { chunk -> SlideDraft in
            var part = draft
            part.table = [header] + chunk
            return part
        }
        return numbered(draft, variants)
    }

    // Bullets

    private static func fitsBox(_ lines: [String], width: Double, height: Double, minimum: Double, widthFactor: Double = 1) -> Bool {
        SlideLayouts.fits(lines.joined(separator: "\n"), width, height, minimum, bold: false, bullets: true, widthFactor: widthFactor)
    }

    private static func bulletParts(_ draft: SlideDraft) -> [SlideDraft] {
        let lines = draft.bullets
        guard lines.count > 1, !fitsBox(lines, width: SlideLayouts.bulletsBox.width, height: SlideLayouts.bulletsBox.height, minimum: readableSize) else { return [draft] }
        // First the same content in two columns, split evenly.
        if lines.count >= 4 {
            let half = (lines.count + 1) / 2
            let left = Array(lines.prefix(half))
            let right = Array(lines.dropFirst(half))
            if fitsBox(left, width: SlideLayouts.columnBox.width, height: SlideLayouts.columnBox.height, minimum: readableColumnSize) && fitsBox(right, width: SlideLayouts.columnBox.width, height: SlideLayouts.columnBox.height, minimum: readableColumnSize) {
                var twoColumns = draft
                twoColumns.layout = .twoColumns
                twoColumns.left = left
                twoColumns.right = right
                twoColumns.bullets = []
                return [twoColumns]
            }
        }
        // Then more slides: the fewest whose even parts each fit a single column.
        for count in 2...lines.count {
            let base = lines.count / count
            let extra = lines.count % count
            let sizes = (0..<count).map { base + ($0 < extra ? 1 : 0) }
            let split = chunks(lines, sizes: sizes)
            if split.allSatisfy({ fitsBox($0, width: SlideLayouts.bulletsBox.width, height: SlideLayouts.bulletsBox.height, minimum: readableSize) }) || count == lines.count {
                let variants = split.map { chunk -> SlideDraft in
                    var part = draft
                    part.bullets = chunk
                    return part
                }
                return numbered(draft, variants)
            }
        }
        return [draft]
    }
}

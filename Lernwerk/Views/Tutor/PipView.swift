import SwiftUI

/// Pip, the pixel cat from Quill, walking on the tutor's input bar. Thinks while the tutor waits,
/// meows when poked and can be picked up and dropped.
struct PipView: View {
    let isThinking: Bool

    @Environment(\.colorScheme) private var colorScheme
    @State private var pip = PipSimulation()

    var body: some View {
        GeometryReader { geometry in
            let lane = max(0, geometry.size.width - PipSimulation.size.width)
            TimelineView(.animation) { timeline in
                let _ = pip.advance(to: timeline.date, lane: lane, thinking: isThinking)
                ZStack(alignment: .bottomLeading) {
                    Canvas { context, _ in
                        pip.draw(in: context, dark: colorScheme == .dark, showsThinkingDots: isThinking)
                    }
                    .frame(width: PipSimulation.size.width, height: PipSimulation.size.height)
                    .offset(x: pip.x, y: pip.y)
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onChanged { value in pip.drag(by: value.translation, lane: lane) }
                            .onEnded { _ in pip.release() }
                    )

                    if let saying = pip.saying {
                        Text(saying)
                            .font(.pixel(9))
                            .foregroundStyle(Quill.bg)
                            .padding(.horizontal, 9)
                            .padding(.vertical, 5)
                            .background(Quill.ink, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
                            .fixedSize()
                            .offset(x: pip.x, y: pip.y - PipSimulation.size.height - 6)
                            .allowsHitTesting(false)
                    }
                }
                .frame(width: geometry.size.width, height: geometry.size.height, alignment: .bottomLeading)
            }
        }
        .frame(height: 56)
        .accessibilityHidden(true)
    }
}

/// Frame-based port of the prototype's canvas animation, stepped at 60 Hz.
final class PipSimulation {
    static let pixel: CGFloat = 3
    static let gridWidth = 16
    static let gridHeight = 18
    static let size = CGSize(width: CGFloat(gridWidth) * pixel, height: CGFloat(gridHeight) * pixel)

    private static let bodyY = 5
    private static let cat: [[Character]] = [
        ".............",
        ".oo.......oo.",
        ".opo.....opo.",
        ".offo...offo.",
        ".offfffffffo.",
        "offfffffffffo",
        "offeefffeeffo",
        "offeefffeeffo",
        "offfffpfffffo",
        "offfffffffffo",
        ".offfffffffo.",
        ".offwwfffwwo.",
        "..ooooooooo..",
    ].map(Array.init)
    private static let tails: [[(Int, Int)]] = [
        [(12, 10), (13, 10), (14, 9), (14, 8)],
        [(12, 10), (13, 9), (14, 8), (14, 7)],
        [(12, 11), (13, 10), (14, 10), (15, 9)],
    ]
    private static let draggedTail = [(12, 9), (13, 8), (13, 7), (13, 6)]
    private static let sayings = ["mrrp!", "nyah~", "hey!", "*stretch*", "hm?", "prrr"]

    private(set) var x: CGFloat = 10
    private(set) var y: CGFloat = 0
    private(set) var saying: String?

    private var direction: CGFloat = 1
    private var frame = 0
    private var blink = 0
    private var squash = 0
    private var velocity: CGFloat = 0
    private var pause: Double = 40
    private var sayFrames = 0
    private var thinking = false
    private var isDragging = false
    private var dragDistance: CGFloat = 0
    private var lastTranslation: CGSize = .zero
    private var lastDate: Date?
    private var pendingFrames: Double = 0

    func advance(to date: Date, lane: CGFloat, thinking: Bool) {
        self.thinking = thinking
        defer { lastDate = date }
        guard let lastDate else { return }
        pendingFrames += min(date.timeIntervalSince(lastDate), 0.25) * 60
        while pendingFrames >= 1 {
            tick(lane: lane)
            pendingFrames -= 1
        }
    }

    func drag(by translation: CGSize, lane: CGFloat) {
        if !isDragging {
            isDragging = true
            dragDistance = 0
            lastTranslation = .zero
            velocity = 0
        }
        let dx = translation.width - lastTranslation.width
        let dy = translation.height - lastTranslation.height
        lastTranslation = translation
        dragDistance += abs(dx) + abs(dy)
        x = min(max(x + dx, -8), lane + 8)
        y = min(max(y + dy, -420), 0)
    }

    func release() {
        guard isDragging else { return }
        isDragging = false
        velocity = 0
        if dragDistance < 6 {
            squash = 14
            say(Self.sayings.randomElement() ?? "mrrp!")
        } else {
            say(y < -40 ? "wheee" : "mrrp!")
        }
    }

    private func say(_ text: String) {
        saying = text
        sayFrames = 90
    }

    private func tick(lane: CGFloat) {
        frame += 1
        if blink > 0 {
            blink -= 1
        } else if Double.random(in: 0..<1) < 0.006 {
            blink = 9
        }
        if squash > 0 { squash -= 1 }

        if !isDragging {
            if y < 0 || velocity != 0 {
                velocity += 1.6
                y += velocity
                if y >= 0 {
                    y = 0
                    velocity = 0
                    squash = 8
                }
            } else if !thinking {
                if pause > 0 {
                    pause -= 1
                } else {
                    x += direction * 0.7
                    if x < 0 {
                        x = 0
                        direction = 1
                        pause = .random(in: 30...120)
                    }
                    if x > lane {
                        x = lane
                        direction = -1
                        pause = .random(in: 30...120)
                    }
                    if Double.random(in: 0..<1) < 0.004 {
                        direction *= -1
                        pause = .random(in: 20...90)
                    }
                }
            }
        }

        if sayFrames > 0 {
            sayFrames -= 1
            if sayFrames == 0 { saying = nil }
        }
    }

    func draw(in context: GraphicsContext, dark: Bool, showsThinkingDots: Bool) {
        let outline = Color(QuillUIColor.hex(dark ? 0x0A0A08 : 0x23231F))
        let palette: [Character: Color] = [
            "o": outline,
            "e": outline,
            "f": Color(QuillUIColor.hex(0x7FA98C)),
            "p": Color(QuillUIColor.hex(0xE5A8A2)),
            "w": Color(QuillUIColor.hex(0xFFFDF6)),
        ]

        var grid = Self.cat
        func set(_ x: Int, _ y: Int, _ value: Character) {
            guard grid.indices.contains(y), grid[y].indices.contains(x) else { return }
            grid[y][x] = value
        }
        let eyes = [(3, 6), (4, 6), (9, 6), (10, 6), (3, 7), (4, 7), (9, 7), (10, 7)]
        if blink > 4 {
            eyes.forEach { set($0.0, $0.1, "f") }
            [(3, 7), (4, 7), (9, 7), (10, 7)].forEach { set($0.0, $0.1, "o") }
        } else if isDragging {
            [(3, 5), (4, 5), (9, 5), (10, 5)].forEach { set($0.0, $0.1, "e") }
            set(3, 6, "w")
            set(9, 6, "w")
            set(6, 9, "o")
            set(7, 9, "o")
        } else if thinking {
            eyes.forEach { set($0.0, $0.1, "f") }
            [(3, 6), (4, 6), (9, 6), (10, 6)].forEach { set($0.0, $0.1, "e") }
        }

        let tail = isDragging ? Self.draggedTail : Self.tails[(frame / (thinking ? 7 : 16)) % 3]
        let step = (!thinking && pause <= 0 && !isDragging) ? (frame / 9) % 2 : 0
        let bob = isDragging ? 0 : (thinking ? (frame / 14) % 2 : step)
        let squashScale = squash > 0 ? 1 - CGFloat(squash) / 34 : 1
        let s = Self.pixel
        let height = Self.size.height

        func fill(_ gx: Int, _ gy: Int, _ color: Color, offsetY: Int = PipSimulation.bodyY) {
            let top = CGFloat(gy + offsetY + bob) * s
            let squashedTop = height - (height - top) * squashScale
            let rect = CGRect(x: CGFloat(gx) * s, y: squashedTop, width: s, height: s * squashScale)
            context.fill(Path(rect), with: .color(color))
        }

        var occupied = Set<Int>()
        for (gy, row) in grid.enumerated() {
            for (gx, value) in row.enumerated() where value != "." {
                occupied.insert(gy * 100 + gx)
            }
        }
        tail.forEach { occupied.insert($0.1 * 100 + $0.0) }
        for (tx, ty) in tail {
            for (dx, dy) in [(1, 0), (-1, 0), (0, 1), (0, -1)] where !occupied.contains((ty + dy) * 100 + tx + dx) {
                fill(tx + dx, ty + dy, outline)
            }
        }
        tail.forEach { fill($0.0, $0.1, palette["f"] ?? outline) }
        for (gy, row) in grid.enumerated() {
            for (gx, value) in row.enumerated() where value != "." {
                fill(gx, gy, palette[value] ?? outline)
            }
        }

        if showsThinkingDots {
            let active = (frame / 12) % 3
            let on = Color(QuillUIColor.hex(dark ? 0xF1EFE7 : 0x23231F))
            let off = dark ? Color(QuillUIColor.hex(0xF1EFE7, alpha: 0.2)) : Color(QuillUIColor.hex(0x23231F, alpha: 0.15))
            for index in 0..<3 {
                let rect = CGRect(
                    x: CGFloat(5 + index * 2) * s,
                    y: CGFloat(index == active ? 0 : 1) * s,
                    width: s,
                    height: s
                )
                context.fill(Path(rect), with: .color(index <= active ? on : off))
            }
        }
    }
}

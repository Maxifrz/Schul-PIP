import Foundation

/// The game behind the Heute card: Pip runs, jumps cacti and ducks under birds, like the dinosaur in Chrome's offline
/// page. Plain values and a fixed random seed, so the tests need no screen and no clock.
struct PipRun {
    enum Phase: Equatable {
        case ready, running, over
    }

    enum Kind: Equatable {
        case cactusSmall, cactusTall, cactusDouble, birdLow, birdHigh
    }

    struct Obstacle: Equatable {
        var x: Double
        let kind: Kind

        var width: Double {
            switch kind {
            case .cactusSmall: return 14
            case .cactusTall: return 18
            case .cactusDouble: return 34
            case .birdLow, .birdHigh: return 28
            }
        }

        var height: Double {
            switch kind {
            case .cactusSmall, .cactusDouble: return 26
            case .cactusTall: return 38
            case .birdLow, .birdHigh: return 14
            }
        }

        /// Height of the underside above the ground; a high bird flies where a standing Pip's head is.
        var lift: Double {
            kind == .birdHigh ? 18 : 0
        }

        var isBird: Bool {
            kind == .birdLow || kind == .birdHigh
        }
    }

    // The world is 600 wide and 160 high; the ground is at 0 and "up" is positive.
    static let width = 600.0
    static let height = 160.0
    static let pipX = 48.0
    static let pipWidth = 26.0
    static let standHeight = 26.0
    static let duckHeight = 16.0
    static let gravity = 2900.0
    static let jumpSpeed = 740.0
    static let fallSpeed = 1000.0
    static let duckTime = 0.45
    static let startSpeed = 280.0
    static let topSpeed = 620.0
    static let acceleration = 8.0
    /// Distance travelled per point of score.
    static let unitsPerPoint = 12.0
    /// Birds come only after this score; the first obstacles are cacti.
    static let birdsFromScore = 150
    /// How far the obstacle's box is pulled in on every side, so a graze is not a crash.
    static let leniency = 4.0
    static let restartDelay = 0.4

    private(set) var phase: Phase = .ready
    /// Pip's height above the ground and its vertical speed.
    private(set) var y = 0.0
    private(set) var vy = 0.0
    private(set) var duckLeft = 0.0
    private(set) var obstacles: [Obstacle] = []
    private(set) var speed = PipRun.startSpeed
    private(set) var distance = 0.0
    private(set) var best: Int
    private(set) var overFor = 0.0
    private var untilNext = 240.0
    private var random: SplitMix

    init(seed: UInt64 = 1, best: Int = 0) {
        random = SplitMix(seed: seed)
        self.best = best
    }

    var score: Int { Int(distance / Self.unitsPerPoint) }
    var isAirborne: Bool { y > 0 }
    var isDucking: Bool { duckLeft > 0 && !isAirborne }
    var pipHeight: Double { isDucking ? Self.duckHeight : Self.standHeight }

    /// The least space between two obstacles: more than a jump covers at this speed, plus the widest obstacle and Pip.
    static func minimumGap(speed: Double) -> Double {
        speed * 0.55 + 90
    }

    // MARK: Input

    /// Up arrow, space or a tap: starts the game, jumps, or starts again after a crash.
    mutating func jump() {
        switch phase {
        case .ready:
            begin()
            launch()
        case .running:
            launch()
        case .over:
            restart()
        }
    }

    /// Right arrow: starts the game, or starts it again after a crash; while it runs, nothing happens.
    mutating func start() {
        switch phase {
        case .ready: begin()
        case .over: restart()
        case .running: break
        }
    }

    /// Puts an obstacle into the course; the tests use it to set up a situation.
    mutating func place(_ obstacle: Obstacle) {
        obstacles.append(obstacle)
    }

    /// Down arrow: ducks on the ground, drops faster in the air.
    mutating func duck() {
        switch phase {
        case .ready:
            begin()
        case .running:
            if isAirborne {
                vy = min(vy, -Self.fallSpeed)
            } else {
                duckLeft = Self.duckTime
            }
        case .over:
            restart()
        }
    }

    private mutating func launch() {
        guard !isAirborne else { return }
        duckLeft = 0
        vy = Self.jumpSpeed
        y = 0.001
    }

    private mutating func begin() {
        phase = .running
    }

    private mutating func restart() {
        guard overFor >= Self.restartDelay else { return }
        self = PipRun(seed: random.next(), best: best)
        begin()
    }

    // MARK: Time

    mutating func step(_ dt: Double) {
        let dt = min(max(dt, 0), 0.05)
        switch phase {
        case .ready:
            return
        case .over:
            overFor += dt
            return
        case .running:
            break
        }
        if isAirborne || vy > 0 {
            vy -= Self.gravity * dt
            y += vy * dt
            if y <= 0 {
                y = 0
                vy = 0
            }
        }
        duckLeft = max(0, duckLeft - dt)
        speed = min(Self.topSpeed, speed + Self.acceleration * dt)
        let travelled = speed * dt
        distance += travelled
        for index in obstacles.indices { obstacles[index].x -= travelled }
        obstacles.removeAll { $0.x + $0.width < -10 }
        untilNext -= travelled
        if untilNext <= 0 { spawn() }
        if obstacles.contains(where: hits) {
            phase = .over
            overFor = 0
            best = max(best, score)
        }
    }

    private mutating func spawn() {
        let roll = random.nextDouble()
        let kind: Kind
        if score >= Self.birdsFromScore, roll < 0.28 {
            kind = random.nextDouble() < 0.55 ? .birdHigh : .birdLow
        } else {
            let pick = random.nextDouble()
            kind = pick < 0.4 ? .cactusSmall : (pick < 0.75 ? .cactusTall : .cactusDouble)
        }
        obstacles.append(Obstacle(x: Self.width + 20, kind: kind))
        let gap = Self.minimumGap(speed: speed)
        untilNext = gap + random.nextDouble() * gap * 0.9
    }

    private func hits(_ obstacle: Obstacle) -> Bool {
        let inset = Self.leniency
        let left = obstacle.x + inset
        let right = obstacle.x + obstacle.width - inset
        let bottom = obstacle.lift + inset
        let top = obstacle.lift + obstacle.height - inset
        let pipLeft = Self.pipX
        let pipRight = Self.pipX + Self.pipWidth
        return right > pipLeft && left < pipRight && top > y && bottom < y + pipHeight
    }
}

/// A small seeded generator (SplitMix64), so a run can be replayed.
struct SplitMix {
    private var state: UInt64

    init(seed: UInt64) {
        state = seed
    }

    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }

    mutating func nextDouble() -> Double {
        Double(next() >> 11) / Double(1 << 53)
    }
}

import XCTest
@testable import Lernwerk

final class PipRunTests: XCTestCase {
    private func run(_ seconds: Double, _ game: inout PipRun, each: (inout PipRun) -> Void = { _ in }) {
        var elapsed = 0.0
        while elapsed < seconds {
            each(&game)
            game.step(1.0 / 60)
            elapsed += 1.0 / 60
        }
    }

    func testNothingMovesBeforeTheStart() {
        var game = PipRun(seed: 3)
        game.step(1)
        XCTAssertEqual(game.phase, .ready)
        XCTAssertEqual(game.distance, 0)
        game.start()
        XCTAssertEqual(game.phase, .running)
    }

    func testAJumpLeavesTheGroundPeaksAndLands() {
        var game = PipRun(seed: 3)
        game.jump()
        XCTAssertEqual(game.phase, .running)
        XCTAssertTrue(game.isAirborne)
        var peak = 0.0
        run(0.3, &game) { peak = max(peak, $0.y) }
        XCTAssertGreaterThan(peak, 60)
        XCTAssertLessThan(peak, 100)
        // Obstacles are far away for the first half second, so the game is still on when Pip lands.
        run(0.4, &game)
        XCTAssertFalse(game.isAirborne)
        XCTAssertEqual(game.phase, .running)
    }

    func testNoDoubleJumpInTheAir() {
        var game = PipRun(seed: 3)
        game.jump()
        run(0.1, &game)
        let before = game.vy
        game.jump()
        XCTAssertEqual(game.vy, before)
    }

    func testDuckingShrinksPipOnTheGroundAndDropsItInTheAir() {
        var game = PipRun(seed: 3)
        game.start()
        game.duck()
        XCTAssertTrue(game.isDucking)
        XCTAssertEqual(game.pipHeight, PipRun.duckHeight)
        run(PipRun.duckTime + 0.1, &game)
        XCTAssertFalse(game.isDucking)
        XCTAssertEqual(game.pipHeight, PipRun.standHeight)

        game.jump()
        run(0.1, &game)
        game.duck()
        XCTAssertLessThanOrEqual(game.vy, -PipRun.fallSpeed)
        XCTAssertFalse(game.isDucking)
    }

    func testStandingPipHitsAHighBirdButADuckingOneFliesUnder() {
        var standing = PipRun(seed: 3)
        standing.start()
        standing.place(PipRun.Obstacle(x: 50, kind: .birdHigh))
        standing.step(0.016)
        XCTAssertEqual(standing.phase, .over)

        var ducking = PipRun(seed: 3)
        ducking.start()
        ducking.place(PipRun.Obstacle(x: 50, kind: .birdHigh))
        ducking.duck()
        ducking.step(0.016)
        XCTAssertEqual(ducking.phase, .running)
    }

    func testAGroundObstacleHitsPipOnTheGroundButNotInAJump() {
        var onGround = PipRun(seed: 3)
        onGround.start()
        onGround.place(PipRun.Obstacle(x: 60, kind: .cactusTall))
        onGround.step(0.016)
        XCTAssertEqual(onGround.phase, .over)

        var jumping = PipRun(seed: 3)
        jumping.jump()
        run(0.2, &jumping)
        jumping.place(PipRun.Obstacle(x: 60, kind: .cactusTall))
        jumping.step(0.016)
        XCTAssertEqual(jumping.phase, .running)
    }

    func testACrashEndsTheRunKeepsTheBestAndNeedsAShortPauseToRestart() {
        var game = PipRun(seed: 5)
        game.start()
        while game.phase == .running { game.step(1.0 / 60) }
        XCTAssertEqual(game.phase, .over)
        let best = game.best
        XCTAssertGreaterThan(best, 0)
        game.jump()
        XCTAssertEqual(game.phase, .over)
        run(PipRun.restartDelay + 0.1, &game)
        game.jump()
        XCTAssertEqual(game.phase, .running)
        XCTAssertEqual(game.score, 0)
        XCTAssertEqual(game.best, best)
    }

    func testTheSameSeedPlaysTheSameCourse() {
        func course(_ seed: UInt64) -> [Double] {
            var game = PipRun(seed: seed)
            game.start()
            var positions: [Double] = []
            run(1.2, &game) { _ in }
            positions += game.obstacles.map(\.x)
            return positions
        }
        XCTAssertEqual(course(9), course(9))
    }

    func testSpeedGrowsToItsLimit() {
        var game = PipRun(seed: 4)
        game.start()
        run(2, &game) { game in
            // Stay alive: jump whenever an obstacle is about to arrive.
            if let next = game.obstacles.first(where: { $0.x > PipRun.pipX }), next.x < 120, !game.isAirborne { game.jump() }
        }
        XCTAssertGreaterThan(game.speed, PipRun.startSpeed)
        XCTAssertLessThanOrEqual(game.speed, PipRun.topSpeed)
    }

    func testTheGapBetweenObstaclesAlwaysLeavesRoomForAJump() {
        var speed = PipRun.startSpeed
        while speed <= PipRun.topSpeed {
            let airtime = 2 * PipRun.jumpSpeed / PipRun.gravity
            XCTAssertGreaterThan(PipRun.minimumGap(speed: speed), speed * airtime + 66, "speed \(speed)")
            speed += 20
        }
    }

    /// A bot that jumps cacti and low birds and ducks under high ones survives a long run: the course can be played.
    func testACarefulPlayerSurvivesAMinute() {
        for seed in UInt64(1)...6 {
            var game = PipRun(seed: seed)
            game.jump()
            run(60, &game) { game in
                guard let next = game.obstacles.first(where: { $0.x + $0.width >= PipRun.pipX - 2 }), !game.isAirborne else { return }
                if next.kind == .birdHigh {
                    if next.x < 200 { game.duck() }
                } else if next.x <= 55 + game.speed * 0.255, next.x > PipRun.pipX - 10 {
                    game.jump()
                }
            }
            XCTAssertEqual(game.phase, .running, "seed \(seed) crashed at score \(game.score)")
        }
    }
}

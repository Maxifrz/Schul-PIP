import SwiftUI

/// Runs the game and remembers the best score; the Heute card shows it in place of Pip's corner.
@MainActor
final class PipRunModel: ObservableObject {
    private static let bestKey = "pip.run.best"

    @Published private(set) var run: PipRun
    @Published private(set) var isOpen = false
    private var last: Date?

    init() {
        run = PipRun(seed: UInt64(Date().timeIntervalSince1970), best: UserDefaults.standard.integer(forKey: Self.bestKey))
    }

    func open() {
        isOpen = true
        last = nil
    }

    func close() {
        isOpen = false
    }

    /// Right arrow: opens the game and starts it.
    func rightArrow() {
        if !isOpen { open() }
        run.start()
    }

    func jump() {
        guard isOpen else { return }
        run.jump()
    }

    func duck() {
        guard isOpen else { return }
        run.duck()
    }

    func tick(_ now: Date = .now) {
        defer { last = now }
        guard let last, isOpen else { return }
        let wasRunning = run.phase == .running
        run.step(now.timeIntervalSince(last))
        if wasRunning, run.phase == .over {
            UserDefaults.standard.set(run.best, forKey: Self.bestKey)
        }
    }
}

/// The offline-dinosaur game with Pip: ground, cacti, birds, score. Taps jump; the two buttons are for a screen without a
/// keyboard; arrows, space and escape work with one.
struct PipRunView: View {
    @ObservedObject var model: PipRunModel

    var body: some View {
        ZStack {
            Canvas { context, size in
                draw(model.run, in: &context, size: size)
            }
            VStack {
                HStack(alignment: .top) {
                    Text(model.run.phase == .ready ? "→ ODER TIPPEN ZUM STARTEN" : "")
                        .font(.mono(10.5, .medium))
                        .tracking(0.8)
                        .foregroundStyle(Quill.railMuted)
                    Spacer(minLength: 8)
                    Button { model.close() } label: {
                        Text("ENDE")
                            .font(.jersey(18))
                            .tracking(0.6)
                            .foregroundStyle(Quill.railInk)
                            .padding(.horizontal, 12)
                            .frame(height: 30)
                            .overlay(RoundedRectangle(cornerRadius: 4, style: .continuous).stroke(Quill.railLine, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
                HStack(spacing: 10) {
                    control("SPRUNG") { model.jump() }
                    control("DUCKEN") { model.duck() }
                }
            }
            .padding(16)
        }
        .contentShape(Rectangle())
        .onTapGesture { model.jump() }
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 16_000_000)
                model.tick()
            }
        }
    }

    private func control(_ title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.jersey(18))
                .tracking(0.6)
                .foregroundStyle(Quill.onAccent)
                .frame(maxWidth: .infinity)
                .frame(height: 34)
                .background(Quill.accent, in: RoundedRectangle(cornerRadius: 4, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    // MARK: Drawing

    private func draw(_ run: PipRun, in context: inout GraphicsContext, size: CGSize) {
        let worldWidth = CGFloat(PipRun.width)
        let worldHeight = CGFloat(PipRun.height)
        let groundY: CGFloat = size.height - 62
        let fitHeight: CGFloat = (groundY - 36) / worldHeight
        let scale: CGFloat = min(size.width / worldWidth, max(0.4, fitHeight))
        let originX: CGFloat = (size.width - worldWidth * scale) / 2

        func rect(_ x: Double, _ lift: Double, _ width: Double, _ height: Double) -> CGRect {
            let left: CGFloat = originX + CGFloat(x) * scale
            let top: CGFloat = groundY - CGFloat(lift + height) * scale
            return CGRect(x: left, y: top, width: CGFloat(width) * scale, height: CGFloat(height) * scale)
        }

        // Ground
        var ground = Path()
        ground.move(to: CGPoint(x: 0, y: groundY + 2))
        ground.addLine(to: CGPoint(x: size.width, y: groundY + 2))
        let phase: CGFloat = CGFloat(run.distance) * scale
        context.stroke(ground, with: .color(Quill.accent.opacity(0.7)), style: StrokeStyle(lineWidth: 2, dash: [6, 5], dashPhase: phase))

        // Score
        let score = String(format: "%05d", run.score)
        let best = String(format: "%05d", max(run.best, run.score))
        let scoreAt = CGPoint(x: size.width - 16, y: groundY - worldHeight * scale - 4)
        context.draw(Text("HI \(best)  \(score)").font(.jersey(24)).foregroundStyle(Quill.railInk), at: scoreAt, anchor: .bottomTrailing)

        // Obstacles
        let green = Color(QuillUIColor.hex(0x7FA98C))
        for obstacle in run.obstacles {
            if obstacle.isBird {
                let flap = Int(run.distance / 18) % 2 == 0
                let body = rect(obstacle.x, obstacle.lift, obstacle.width, obstacle.height)
                context.fill(Path(body), with: .color(Quill.railInk))
                let wingY: CGFloat = flap ? body.minY - body.height * 0.7 : body.maxY
                let wing = CGRect(x: body.minX + body.width * 0.3, y: wingY, width: body.width * 0.4, height: body.height * 0.7)
                context.fill(Path(wing), with: .color(Quill.railMuted))
            } else {
                let double = obstacle.kind == .cactusDouble
                let trunk: Double = double ? 8 : max(6, obstacle.width * 0.45)
                let count = double ? 2 : 1
                for index in 0..<count {
                    let offset: Double = double ? Double(index) * 20 : (obstacle.width - trunk) / 2
                    let height: Double = (double && index == 1) ? obstacle.height * 0.8 : obstacle.height
                    context.fill(Path(rect(obstacle.x + offset, 0, trunk, height)), with: .color(green))
                    context.fill(Path(rect(obstacle.x + offset - 4, height * 0.4, 4, 3)), with: .color(green))
                    context.fill(Path(rect(obstacle.x + offset + trunk, height * 0.55, 4, 3)), with: .color(green))
                }
            }
        }

        // Pip
        drawPip(run, in: &context, rect: rect(PipRun.pipX, run.y, PipRun.pipWidth, run.pipHeight))

        if run.phase == .over {
            let middle = CGPoint(x: size.width / 2, y: groundY - worldHeight * scale * 0.55)
            context.draw(Text("GAME OVER").font(.jersey(44)).foregroundStyle(Quill.accent), at: middle, anchor: .center)
        }
    }

    private func drawPip(_ run: PipRun, in context: inout GraphicsContext, rect: CGRect) {
        let outline = Color(QuillUIColor.hex(0x0A0A08))
        let palette: [Character: Color] = [
            "o": outline, "e": outline,
            "f": Color(QuillUIColor.hex(0x7FA98C)),
            "p": Color(QuillUIColor.hex(0xE5A8A2)),
            "w": Color(QuillUIColor.hex(0xFFFDF6)),
        ]
        let grid = PipSimulation.cat
        let cellWidth = rect.width / CGFloat(grid[0].count)
        let cellHeight = rect.height / CGFloat(grid.count)
        // Legs swap while running on the ground: the bottom rows shift by a cell.
        let step = !run.isAirborne && run.phase == .running && Int(run.distance / 14) % 2 == 0
        for (y, row) in grid.enumerated() {
            for (x, value) in row.enumerated() where value != "." {
                let dx: CGFloat = (step && y >= grid.count - 2) ? cellWidth * 0.6 : 0
                let left: CGFloat = rect.minX + CGFloat(x) * cellWidth + dx
                let top: CGFloat = rect.minY + CGFloat(y) * cellHeight
                let cell = CGRect(x: left, y: top, width: cellWidth + 0.5, height: cellHeight + 0.5)
                context.fill(Path(cell), with: .color(palette[value] ?? outline))
            }
        }
    }
}

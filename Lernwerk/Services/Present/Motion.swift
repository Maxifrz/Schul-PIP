import Foundation

/// How a slide comes in. Optional on a slide; a slide without one uses the short cross-fade the app always had.
enum TransitionKind: String, CaseIterable, Codable {
    case none = "NONE"
    case fade = "FADE"
    case push = "PUSH"
    case cover = "COVER"
    case zoom = "ZOOM"

    var label: String {
        switch self {
        case .none: return "Ohne"
        case .fade: return "Überblenden"
        case .push: return "Schieben"
        case .cover: return "Aufdecken"
        case .zoom: return "Zoom"
        }
    }
}

/// The side new content comes from.
enum MotionDirection: String, CaseIterable, Codable {
    case left = "LEFT"
    case right = "RIGHT"
    case up = "UP"
    case down = "DOWN"

    var label: String {
        switch self {
        case .left: return "von links"
        case .right: return "von rechts"
        case .up: return "von oben"
        case .down: return "von unten"
        }
    }
}

enum AnimationKind: String, CaseIterable, Codable {
    case appear = "APPEAR"
    case fade = "FADE"
    case fly = "FLY"
    case zoom = "ZOOM"
    case wipe = "WIPE"

    var label: String {
        switch self {
        case .appear: return "Erscheinen"
        case .fade: return "Einblenden"
        case .fly: return "Hereinfliegen"
        case .zoom: return "Zoom"
        case .wipe: return "Wischen"
        }
    }

    /// Whether the direction matters.
    var usesDirection: Bool { self == .fly || self == .wipe }
}

enum AnimationTrigger: String, CaseIterable, Codable {
    /// Waits for a tap.
    case click = "CLICK"
    /// Starts together with the effect before it (or by itself when the slide appears, if it is the first).
    case withPrevious = "WITH_PREVIOUS"

    var label: String { self == .click ? "Bei Tipp" : "Mit vorherigem" }
}

/// Decodes a raw-value enum tolerantly: any case, and an unknown value falls back instead of failing the deck.
private func tolerant<K: CodingKey, T: RawRepresentable>(_ container: KeyedDecodingContainer<K>, _ key: K, _ fallback: T) -> T where T.RawValue == String {
    guard let raw = try? container.decodeIfPresent(String.self, forKey: key) else { return fallback }
    return T(rawValue: raw.uppercased()) ?? fallback
}

struct SlideTransition: Codable, Equatable {
    var kind: TransitionKind = .none
    var direction: MotionDirection = .left
    /// Seconds, 0.1 to 3.
    var duration: Double = 0.5

    init(kind: TransitionKind = .none, direction: MotionDirection = .left, duration: Double = 0.5) {
        self.kind = kind
        self.direction = direction
        self.duration = duration
    }

    enum CodingKeys: String, CodingKey { case kind, direction, duration }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = tolerant(c, CodingKeys.kind, TransitionKind.none)
        direction = tolerant(c, CodingKeys.direction, MotionDirection.left)
        duration = (try? c.decodeIfPresent(Double.self, forKey: .duration)) ?? 0.5
    }

    var seconds: Double { min(3, max(0.1, duration)) }
}

struct ElementAnimation: Codable, Equatable {
    var kind: AnimationKind = .fade
    var direction: MotionDirection = .down
    var trigger: AnimationTrigger = .click
    /// Seconds after the trigger, 0 to 5.
    var delay: Double = 0
    /// Seconds, 0.1 to 3.
    var duration: Double = 0.5

    init(kind: AnimationKind = .fade, direction: MotionDirection = .down, trigger: AnimationTrigger = .click, delay: Double = 0, duration: Double = 0.5) {
        self.kind = kind
        self.direction = direction
        self.trigger = trigger
        self.delay = delay
        self.duration = duration
    }

    enum CodingKeys: String, CodingKey { case kind, direction, trigger, delay, duration }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        kind = tolerant(c, CodingKeys.kind, AnimationKind.fade)
        direction = tolerant(c, CodingKeys.direction, MotionDirection.down)
        trigger = tolerant(c, CodingKeys.trigger, AnimationTrigger.click)
        delay = (try? c.decodeIfPresent(Double.self, forKey: .delay)) ?? 0
        duration = (try? c.decodeIfPresent(Double.self, forKey: .duration)) ?? 0.5
    }

    var delaySeconds: Double { min(5, max(0, delay)) }
    var seconds: Double { min(3, max(0.1, duration)) }
}

/// A motion style for a whole deck; `MotionPlanner.apply` turns it into transitions and animations.
enum MotionPreset: String, CaseIterable, Codable {
    case off = "OFF"
    case calm = "CALM"
    case dynamic = "DYNAMIC"
    case stepwise = "STEPWISE"

    var label: String {
        switch self {
        case .off: return "Aus"
        case .calm: return "Ruhig"
        case .dynamic: return "Lebendig"
        case .stepwise: return "Schritt für Schritt"
        }
    }

    /// One line for the menu and for the AI's suggestion.
    var detail: String {
        switch self {
        case .off: return "Keine Übergänge und Animationen"
        case .calm: return "Weiches Überblenden, die Überschrift blendet ein"
        case .dynamic: return "Schieben und Zoom, alles fliegt nacheinander herein"
        case .stepwise: return "Ein Kasten samt Inhalt pro Tipp"
        }
    }
}

/// Plans what moves when. Pure functions of the slide, so the presenter, the editor and the PowerPoint export agree.
enum MotionPlanner {
    struct Entry: Equatable {
        var elementID: String
        var animation: ElementAnimation
    }

    /// Effects that start together. A step waits for a tap, unless it is the slide's first and begins by itself.
    struct Step: Equatable {
        var entries: [Entry]
        var autoStart: Bool
    }

    /// The slide's elements in stacking order: runs of elements that are always there, and animated ones with the
    /// step that shows them. The order never changes, so drawing the layers gives the slide back.
    enum Layer: Equatable {
        case fixed([SlideElement])
        case animated(SlideElement, step: Int)
    }

    /// A big box with the elements on top of it, like a card.
    struct Group: Equatable {
        var box: SlideElement
        var members: [SlideElement]
    }

    /// Click steps in stacking order: an element that waits for a tap starts a step, "with previous" ones join the
    /// step before them. If the first animated element does not wait for a tap, the first step starts by itself.
    static func timeline(_ slide: Slide) -> [Step] {
        var steps: [Step] = []
        for element in slide.elements {
            guard let animation = element.animation else { continue }
            let entry = Entry(elementID: element.id, animation: animation)
            if animation.trigger == .withPrevious, !steps.isEmpty {
                steps[steps.count - 1].entries.append(entry)
            } else {
                steps.append(Step(entries: [entry], autoStart: animation.trigger == .withPrevious))
            }
        }
        return steps
    }

    /// How many taps the slide needs before everything is shown.
    static func clicks(_ slide: Slide) -> Int {
        timeline(slide).filter { !$0.autoStart }.count
    }

    /// The step index at which the slide starts: 1 when the first step plays by itself, else 0.
    static func initialSteps(_ slide: Slide) -> Int {
        timeline(slide).first?.autoStart == true ? 1 : 0
    }

    static func layers(_ slide: Slide) -> [Layer] {
        var stepOf: [String: Int] = [:]
        for (index, step) in timeline(slide).enumerated() {
            for entry in step.entries { stepOf[entry.elementID] = index }
        }
        var result: [Layer] = []
        var run: [SlideElement] = []
        for element in slide.elements {
            if let step = stepOf[element.id] {
                if !run.isEmpty {
                    result.append(.fixed(run))
                    run = []
                }
                result.append(.animated(element, step: step))
            } else {
                run.append(element)
            }
        }
        if !run.isEmpty { result.append(.fixed(run)) }
        return result
    }

    /// The elements to draw once `steps` steps have played, in the slide's own order.
    static func visibleElements(_ slide: Slide, steps: Int) -> [SlideElement] {
        layers(slide).flatMap { layer -> [SlideElement] in
            switch layer {
            case let .fixed(elements): return elements
            case let .animated(element, step): return step < steps ? [element] : []
            }
        }
    }

    /// The slide as it looks after `steps` steps, for drawing.
    static func slide(_ slide: Slide, steps: Int) -> Slide {
        var result = slide
        result.elements = visibleElements(slide, steps: steps)
        return result
    }

    /// Boxes worth revealing on their own: rectangles and rounded boxes that are big enough to hold something but
    /// not the whole slide, with at least one element whose center lies on them. Decorations (circles, edge bars,
    /// table stripes, empty picture frames) are left out.
    static func groups(_ slide: Slide) -> [Group] {
        var claimed = Set<String>()
        var result: [Group] = []
        for (index, box) in slide.elements.enumerated() where isBox(box) {
            let members = slide.elements.suffix(from: index + 1).filter { member in
                !claimed.contains(member.id) && !isBox(member) && inside(member, box)
            }
            guard !members.isEmpty else { continue }
            claimed.formUnion(members.map(\.id))
            result.append(Group(box: box, members: members))
        }
        return result
    }

    private static func isBox(_ element: SlideElement) -> Bool {
        guard element.kind == .shape, element.shape == .rect || element.shape == .rounded, element.fill != "none" else { return false }
        return element.width >= 150 && element.height >= 110 && element.width * element.height <= SlideSize.width * SlideSize.height * 0.4
    }

    private static func inside(_ element: SlideElement, _ box: SlideElement) -> Bool {
        element.centerX >= box.x && element.centerX <= box.x + box.width && element.centerY >= box.y && element.centerY <= box.y + box.height
    }

    // Presets

    /// A slide with a preset's transition and animations; anything set before is replaced.
    static func apply(_ preset: MotionPreset, to slide: Slide, index: Int) -> Slide {
        var result = slide
        result.transition = nil
        for i in result.elements.indices { result.elements[i].animation = nil }
        switch preset {
        case .off:
            break
        case .calm:
            calm(&result)
        case .dynamic:
            result.transition = index == 0 ? SlideTransition(kind: .zoom, duration: 0.6) : SlideTransition(kind: .push, direction: .right, duration: 0.5)
            var animated = 0
            for i in result.elements.indices {
                let element = result.elements[i]
                // A full-slide backdrop stays put.
                if element.width >= SlideSize.width - 8 && element.height >= SlideSize.height - 8 { continue }
                let delay = min(Double(animated) * 0.12, 1.4)
                animated += 1
                let kind: AnimationKind
                var direction = MotionDirection.down
                switch element.kind {
                case .text:
                    kind = .fly
                    direction = SlideDesign.isHeading(element) ? .left : .down
                case .image: kind = .zoom
                case .shape: kind = element.isLine ? .wipe : .fade
                }
                if kind == .wipe { direction = .left }
                result.elements[i].animation = ElementAnimation(kind: kind, direction: direction, trigger: .withPrevious, delay: delay, duration: 0.5)
            }
        case .stepwise:
            let boxes = groups(result)
            guard !boxes.isEmpty else {
                calm(&result)
                break
            }
            result.transition = SlideTransition(kind: .fade, duration: 0.4)
            for group in boxes {
                for i in result.elements.indices {
                    let id = result.elements[i].id
                    if id == group.box.id {
                        result.elements[i].animation = ElementAnimation(kind: .fade, trigger: .click, duration: 0.4)
                    } else if group.members.contains(where: { $0.id == id }) {
                        result.elements[i].animation = ElementAnimation(kind: .fade, trigger: .withPrevious, duration: 0.4)
                    }
                }
            }
        }
        return result
    }

    private static func calm(_ slide: inout Slide) {
        slide.transition = SlideTransition(kind: .fade, duration: 0.4)
        let heading = slide.elements.firstIndex { $0.kind == .text && !$0.text.isBlank && SlideDesign.isHeading($0) }
        if let heading {
            slide.elements[heading].animation = ElementAnimation(kind: .fade, trigger: .withPrevious, delay: 0.15, duration: 0.5)
        }
    }

    static func apply(_ preset: MotionPreset, to presentation: Presentation) -> Presentation {
        var result = presentation
        for index in result.slides.indices { result.slides[index] = apply(preset, to: result.slides[index], index: index) }
        return result
    }

    /// Whether a deck has any transition or animation, for the menu's checkmark.
    static func hasMotion(_ presentation: Presentation) -> Bool {
        presentation.slides.contains { $0.transition != nil || $0.elements.contains { $0.animation != nil } }
    }
}

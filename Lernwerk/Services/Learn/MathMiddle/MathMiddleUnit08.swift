import Foundation

private typealias Q = MathMiddleQ
private typealias T = MathMiddleText

/// Unit 8, Geometrie: Umfang und Fläche ebener Figuren und des Kreises (lesson 1), Quader, Zylinder, Prisma und
/// Einheiten (2), Winkelsumme und Satz des Pythagoras (3).
enum MathMiddleUnit08 {
    static let templates: [MathMiddleTemplate] = [
        MathMiddleTemplate("u08.rectangle", lesson: 1, forms: [.choice, .typed, .pairs], make: rectangle),
        MathMiddleTemplate("u08.area", lesson: 1, forms: [.choice, .typed, .pairs], make: area),
        MathMiddleTemplate("u08.circle", lesson: 1, forms: [.choice, .typed, .pairs], make: circle),
        MathMiddleTemplate("u08.cuboid", lesson: 2, forms: [.choice, .typed, .pairs], make: cuboid),
        MathMiddleTemplate("u08.solid", lesson: 2, forms: [.choice, .typed, .pairs], make: solid),
        MathMiddleTemplate("u08.units", lesson: 2, forms: [.choice, .typed, .pairs], make: units),
        MathMiddleTemplate("u08.volumeWord", lesson: 2, forms: [.choice, .typed], make: volumeWord),
        MathMiddleTemplate("u08.angles", lesson: 3, forms: [.choice, .typed, .pairs], make: angles),
        MathMiddleTemplate("u08.pythagoras", lesson: 3, forms: [.choice, .typed, .pairs], make: pythagoras),
        MathMiddleTemplate("u08.pythagorasWord", lesson: 3, forms: [.choice, .typed], make: pythagorasWord),
        MathMiddleTemplate("u08.rightAngleTest", lesson: 3, forms: [.choice, .typed], make: rightAngleTest),
    ]

    private static let valueHint = "Gib nur die Zahl an."
    private static let piHint = "Gib nur die Zahl vor π an."

    private static func num(_ q: Q) -> String { T.number(q) }

    // Lesson 1

    /// "Ein Rechteck ist 8 cm lang und 5 cm breit. Berechne den Umfang." Perimeter, area, and the missing side.
    private static func rectangle(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { rectangleAttempt(level, gen) }
    }

    private static func rectangleAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let unit = gen.pick(["cm", "m"])
        let square = level == 1 && gen.chance(30)
        let a: Q
        let b: Q
        switch level {
        case 1:
            a = Q(gen.int(2...12))
            b = square ? a : Q(gen.int(2...12))
        case 2:
            a = Q(gen.int(3...19), 2)
            b = Q(gen.int(2...12))
        default:
            a = Q(gen.int(3...16))
            b = Q(gen.int(2...12))
        }
        guard square || a != b else { return nil }
        let perimeter = (a + b) * 2
        let area = a * b
        guard perimeter.ok, area.ok, [area, perimeter].decimals(1).count == 2 else { return nil }
        let shape = square ? "Ein Quadrat hat die Seitenlänge \(num(a)) \(unit)." : "Ein Rechteck ist \(num(a)) \(unit) lang und \(num(b)) \(unit) breit."
        if level == 3 {
            // Backwards: the missing side from the perimeter or the area.
            if gen.chance(50) {
                let wrong = [perimeter - a, perimeter / 2 + a, perimeter - a * 2, perimeter].decimals(1).positives
                return .number(
                    prompt: "Ein Rechteck hat den Umfang \(num(perimeter)) \(unit) und ist \(num(a)) \(unit) lang.\nWie breit ist es?",
                    answer: b,
                    style: .unit(unit),
                    hint: valueHint,
                    wrong: wrong,
                    pair: "U = \(num(perimeter)) \(unit), a = \(num(a)) \(unit)",
                    solution: "\(num(perimeter)) : 2 = \(num(perimeter / 2)); \(num(perimeter / 2)) \(T.minus) \(num(a)) = \(num(b)) \(unit)",
                    explanation: "Der Umfang ist 2 · (a + b). Teile ihn durch 2, dann ziehst du die bekannte Seite ab."
                )
            }
            let wrong = [area - a, area * a, perimeter / 2 - a, area / 2].decimals(1).positives
            return .number(
                prompt: "Ein Rechteck hat die Fläche \(num(area)) \(unit)² und ist \(num(a)) \(unit) lang.\nWie breit ist es?",
                answer: b,
                style: .unit(unit),
                hint: valueHint,
                wrong: wrong,
                pair: "A = \(num(area)) \(unit)², a = \(num(a)) \(unit)",
                solution: "A = a · b, also b = \(num(area)) : \(num(a)) = \(num(b)) \(unit)",
                explanation: "Die Fläche ist Länge mal Breite. Die fehlende Seite findest du durch Teilen der Fläche durch die bekannte Seite."
            )
        }
        let asksPerimeter = gen.chance(50)
        let value = asksPerimeter ? perimeter : area
        let wrong = (asksPerimeter ? [area, a + b, a * 2 + b, area * 2] : [perimeter, a + b, a * 2 * b, perimeter / 2]).decimals(1).positives
        return .number(
            prompt: "\(shape)\n" + (asksPerimeter ? "Berechne den Umfang." : "Berechne den Flächeninhalt."),
            answer: value,
            style: .unit(asksPerimeter ? unit : unit + "²"),
            hint: valueHint,
            wrong: wrong,
            pair: (asksPerimeter ? "Umfang: " : "Fläche: ") + (square ? "a = \(num(a)) \(unit)" : "\(num(a)) \(unit) · \(num(b)) \(unit)"),
            solution: asksPerimeter
                ? "U = 2 · (\(num(a)) + \(num(b))) = \(num(perimeter)) \(unit)"
                : "A = \(num(a)) · \(num(b)) = \(num(area)) \(unit)²",
            explanation: asksPerimeter
                ? "Der Umfang ist die Länge des Randes: Alle vier Seiten zusammen, also 2 · (a + b)."
                : "Der Flächeninhalt ist Länge mal Breite. Er hat die Einheit mit Quadrat, zum Beispiel cm²."
        )
    }

    /// Triangle, parallelogram and trapezoid: the base times the height, halved where it has to be.
    private static func area(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { areaAttempt(level, gen) }
    }

    private static func areaAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let unit = gen.pick(["cm", "m"])
        let kind = level == 1 ? gen.int(0...1) : (level == 2 ? gen.int(0...2) : gen.int(0...2))
        switch kind {
        case 0:
            // Triangle.
            let g = gen.int(level == 1 ? 3...14 : 5...20)
            let h = gen.int(level == 1 ? 2...12 : 4...16)
            guard g * h % 2 == 0, g != h else { return nil }
            let value = Q(g * h, 2)
            if level == 3, gen.chance(60) {
                // The doubling forgotten, the area itself, the area doubled and not divided by the base, the height doubled.
                let wrong = [value / g, value, Q(g * h), Q(h * 2)].decimals(1).positives
                return .number(
                    prompt: "Ein Dreieck hat die Grundseite \(g) \(unit) und die Fläche \(num(value)) \(unit)².\nWie hoch ist das Dreieck?",
                    answer: Q(h),
                    style: .unit(unit),
                    hint: valueHint,
                    wrong: wrong,
                    pair: "Dreieck: g = \(g) \(unit), A = \(num(value)) \(unit)²",
                    solution: "A = g · h : 2, also h = 2 · \(num(value)) : \(g) = \(h) \(unit)",
                    explanation: "Stelle die Formel A = g · h : 2 nach h um: Verdopple die Fläche und teile durch die Grundseite."
                )
            }
            return .number(
                prompt: "Ein Dreieck hat die Grundseite \(g) \(unit) und die Höhe \(h) \(unit).\nWie groß ist die Fläche?",
                answer: value,
                style: .unit(unit + "²"),
                hint: valueHint,
                wrong: [Q(g * h), Q(g + h), Q(g * h, 4), Q(g * h * 2)].decimals(1).positives,
                pair: "Dreieck: g = \(g) \(unit), h = \(h) \(unit)",
                solution: "A = g · h : 2 = \(g) · \(h) : 2 = \(num(value)) \(unit)²",
                explanation: "Ein Dreieck ist halb so groß wie das Rechteck mit derselben Grundseite und Höhe: A = g · h : 2."
            )
        case 1:
            // Parallelogram: the height, not the slanted side.
            let g = gen.int(3...16)
            let h = gen.int(2...12)
            let slanted = h + gen.int(1...4)
            guard g != h else { return nil }
            return .number(
                prompt: "Ein Parallelogramm hat die Grundseite \(g) \(unit), die Höhe \(h) \(unit) und die schräge Seite \(slanted) \(unit).\nWie groß ist die Fläche?",
                answer: Q(g * h),
                style: .unit(unit + "²"),
                hint: valueHint,
                wrong: [Q(g * slanted), Q(g * h, 2), Q(g + h), Q(2 * (g + slanted))].decimals(1).positives,
                pair: "Parallelogramm: g = \(g) \(unit), h = \(h) \(unit)",
                solution: "A = g · h = \(g) · \(h) = \(g * h) \(unit)². Die schräge Seite wird nicht gebraucht.",
                explanation: "Beim Parallelogramm gilt A = g · h. Wichtig ist die Höhe (senkrecht zur Grundseite), nicht die schräge Seite."
            )
        default:
            // Trapezoid: the mean of the parallel sides times the height.
            let a = gen.int(level == 2 ? 4...14 : 6...20)
            let c = gen.int(2...(a - 1))
            let h = gen.int(2...12)
            guard (a + c) * h % 2 == 0 else { return nil }
            let value = Q((a + c) * h, 2)
            return .number(
                prompt: "Ein Trapez hat die parallelen Seiten \(a) \(unit) und \(c) \(unit) und die Höhe \(h) \(unit).\nWie groß ist die Fläche?",
                answer: value,
                style: .unit(unit + "²"),
                hint: valueHint,
                wrong: [Q((a + c) * h), Q(a * h, 2), Q(a * c * h, 2), Q(a + c + h)].decimals(1).positives,
                pair: "Trapez: a = \(a) \(unit), c = \(c) \(unit), h = \(h) \(unit)",
                solution: "A = (a + c) : 2 · h = (\(a) + \(c)) : 2 · \(h) = \(num(value)) \(unit)²",
                explanation: "Beim Trapez nimmst du den Mittelwert der beiden parallelen Seiten mal die Höhe: A = (a + c) : 2 · h."
            )
        }
    }

    /// Circle: the area and the circumference as a multiple of π.
    private static func circle(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { circleAttempt(level, gen) }
    }

    private static func circleAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let r = gen.int(level == 1 ? 2...9 : 3...15)
        let unit = gen.pick(["cm", "m"])
        if level == 3, gen.chance(60) {
            // Backwards from the circumference or the area.
            if gen.chance(50) {
                let wrong = [Q(r * 2), Q(r * r), Q(r, 2), Q(r * 4)].positives
                return .number(
                    prompt: "Der Umfang eines Kreises ist \(2 * r)π \(unit).\nWie groß ist der Radius?",
                    answer: Q(r),
                    style: .unit(unit),
                    hint: valueHint,
                    wrong: wrong,
                    pair: "U = \(2 * r)π \(unit)",
                    solution: "U = 2πr, also \(2 * r)π = 2πr und r = \(r) \(unit)",
                    explanation: "Der Umfang ist U = 2πr. Teilst du den Umfang durch 2π, bleibt der Radius."
                )
            }
            let wrong = [Q(r * r), Q(r, 2), Q(r * r, 2), Q(2 * r)].positives
            return .number(
                prompt: "Die Fläche eines Kreises ist \(r * r)π \(unit)².\nWie groß ist der Radius?",
                answer: Q(r),
                style: .unit(unit),
                hint: valueHint,
                wrong: wrong,
                pair: "A = \(r * r)π \(unit)²",
                solution: "A = πr², also r² = \(r * r) und r = \(r) \(unit)",
                explanation: "Die Fläche ist A = πr². Nach dem Teilen durch π bleibt r², und die Wurzel daraus ist der Radius."
            )
        }
        let withDiameter = level >= 2 && gen.chance(50)
        let givenText = withDiameter ? "den Durchmesser \(2 * r) \(unit)" : "den Radius \(r) \(unit)"
        let asksArea = gen.chance(50)
        let answer = asksArea ? r * r : 2 * r
        // Area and circumference mixed up, the diameter used as the radius, the radius not squared.
        let wrong = asksArea
            ? [2 * r, r, 4 * r * r, r * r * 2, r * 2 * r * 2].map { Q($0) }
            : [r * r, r, 4 * r * r, 4 * r, 2 * r * r].map { Q($0) }
        return .number(
            prompt: "Ein Kreis hat \(givenText).\nBerechne " + (asksArea ? "die Fläche" : "den Umfang") + " in \(unit)" + (asksArea ? "²" : "") + ". Gib das Ergebnis als Vielfaches von π an.",
            answer: Q(answer),
            style: .pi,
            hint: piHint,
            wrong: wrong,
            pair: (asksArea ? "Fläche: " : "Umfang: ") + (withDiameter ? "d = \(2 * r) \(unit)" : "r = \(r) \(unit)"),
            solution: asksArea
                ? "r = \(r) \(unit); A = π · \(r)² = \(r * r)π \(unit)²"
                : "r = \(r) \(unit); U = 2 · π · \(r) = \(2 * r)π \(unit)",
            explanation: asksArea
                ? "Die Fläche ist A = π · r². Der Radius ist der halbe Durchmesser, und nur der Radius wird quadriert."
                : "Der Umfang ist U = 2 · π · r. Der Radius ist der halbe Durchmesser."
        )
    }

    // Lesson 2

    /// Volume and surface of a cuboid, and a missing edge.
    private static func cuboid(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { cuboidAttempt(level, gen) }
    }

    private static func cuboidAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let a = gen.int(level == 1 ? 2...8 : 3...12)
        let b = gen.int(level == 1 ? 2...8 : 3...10)
        let c = gen.int(level == 1 ? 2...6 : 2...9)
        guard Set([a, b, c]).count >= 2 else { return nil }
        let volume = a * b * c
        let surface = 2 * (a * b + a * c + b * c)
        let sides = "Ein Quader ist \(a) cm lang, \(b) cm breit und \(c) cm hoch."
        if level == 3, gen.chance(45) {
            // The missing edge from the volume.
            // Divided by another edge, the base area taken off, the base area alone.
            let wrong = [volume / a, volume - a * b, a * b, volume / b].filter { $0 > 0 }
            return .number(
                prompt: "Ein Quader mit der Grundfläche \(a * b) cm² hat das Volumen \(volume) cm³.\nWie hoch ist er?",
                answer: Q(c),
                style: .unit("cm"),
                hint: valueHint,
                wrong: wrong.map { Q($0) },
                pair: "G = \(a * b) cm², V = \(volume) cm³",
                solution: "V = G · h, also h = \(volume) : \(a * b) = \(c) cm",
                explanation: "Das Volumen ist Grundfläche mal Höhe. Die Höhe findest du, indem du das Volumen durch die Grundfläche teilst."
            )
        }
        let asksVolume = level == 1 || gen.chance(45)
        if asksVolume {
            // The sum, the surface, the base area alone, a doubled volume.
            let wrong = [a + b + c, surface, a * b, 2 * volume, a * b + c]
            return .number(
                prompt: "\(sides)\nBerechne das Volumen.",
                answer: Q(volume),
                style: .unit("cm³"),
                hint: valueHint,
                wrong: wrong.map { Q($0) },
                pair: "Volumen: \(a) cm · \(b) cm · \(c) cm",
                solution: "V = a · b · c = \(a) · \(b) · \(c) = \(volume) cm³",
                explanation: "Das Volumen eines Quaders ist Länge mal Breite mal Höhe. Die Einheit hat die Hochzahl 3."
            )
        }
        // The volume, one pair of faces missing, the sum of the three faces without doubling.
        let wrong = [volume, a * b + a * c + b * c, 2 * (a * b + a * c), a * b * 2 + c]
        return .number(
            prompt: "\(sides)\nBerechne die Oberfläche.",
            answer: Q(surface),
            style: .unit("cm²"),
            hint: valueHint,
            wrong: wrong.map { Q($0) },
            pair: "Oberfläche: \(a) cm · \(b) cm · \(c) cm",
            solution: "O = 2 · (a·b + a·c + b·c) = 2 · (\(a * b) + \(a * c) + \(b * c)) = \(surface) cm²",
            explanation: "Ein Quader hat sechs Rechtecke, je zwei gleiche: O = 2 · (a·b + a·c + b·c)."
        )
    }

    /// Prism and cylinder: the volume is the base area times the height.
    private static func solid(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { solidAttempt(level, gen) }
    }

    private static func solidAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        if level == 1 {
            let g = gen.int(4...30)
            let h = gen.int(2...12)
            guard g != h else { return nil }
            // Base plus height, half of the volume, the volume doubled.
            return .number(
                prompt: "Ein Prisma hat die Grundfläche \(g) cm² und die Höhe \(h) cm.\nWie groß ist das Volumen?",
                answer: Q(g * h),
                style: .unit("cm³"),
                hint: valueHint,
                wrong: [Q(g + h), Q(g * h, 2), Q(g * h * 2), Q(g * h * h)].decimals(1).positives,
                pair: "Prisma: G = \(g) cm², h = \(h) cm",
                solution: "V = G · h = \(g) · \(h) = \(g * h) cm³",
                explanation: "Für jedes Prisma und jeden Zylinder gilt V = G · h: Grundfläche mal Höhe."
            )
        }
        let r = gen.int(2...9)
        let h = gen.int(2...12)
        let withDiameter = level == 3 && gen.chance(50)
        guard r != h else { return nil }
        let value = r * r * h
        let given = withDiameter ? "den Durchmesser \(2 * r) cm" : "den Radius \(r) cm"
        // The radius not squared, the diameter used as the radius, the lateral surface, the base area alone.
        let wrong = [r * h, 4 * r * r * h, 2 * r * h, r * r, r * r * h * 2]
        return .number(
            prompt: "Ein Zylinder hat \(given) und die Höhe \(h) cm.\nBerechne das Volumen in cm³. Gib das Ergebnis als Vielfaches von π an.",
            answer: Q(value),
            style: .pi,
            hint: piHint,
            wrong: wrong.map { Q($0) },
            pair: "Zylinder: " + (withDiameter ? "d = \(2 * r) cm" : "r = \(r) cm") + ", h = \(h) cm",
            solution: "r = \(r) cm; V = π · r² · h = π · \(r)² · \(h) = \(value)π cm³",
            explanation: "Beim Zylinder ist die Grundfläche ein Kreis: V = π · r² · h. Der Radius ist der halbe Durchmesser, und nur er wird quadriert."
        )
    }

    private static let areaUnits = ["mm²", "cm²", "dm²", "m²"]
    private static let volumeUnits = ["cm³", "dm³", "m³"]

    /// A value of a conversion: whole numbers from a thousand on get the thin space.
    private static func valueText(_ q: Q) -> String {
        if let whole = q.int, whole >= 1000 { return T.grouped(whole) }
        return num(q)
    }

    /// "3 dm² = ? cm²": each step is 100 for areas and 1000 for volumes.
    private static func units(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { unitsAttempt(level, gen) }
    }

    private static func unitsAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let isArea = level == 1 || gen.chance(40)
        let list = isArea ? areaUnits : volumeUnits
        let step = isArea ? 100 : 1000
        let wrongStep = isArea ? 10 : 100
        let from = gen.int(0...(list.count - 1))
        let delta = level == 1 ? gen.pick([-1, 1]) : (level == 2 ? gen.pick([-1, 1, -2, 2]) : gen.pick([-2, 2, -1, 1]))
        let to = from + delta
        guard (0...(list.count - 1)).contains(to) else { return nil }
        // Liters are dm³ and millilitres are cm³.
        var fromName = list[from]
        var toName = list[to]
        if !isArea {
            if from == 1, gen.chance(50) { fromName = "l" }
            if to == 1, gen.chance(50) { toName = "l" }
            if from == 0, gen.chance(30) { fromName = "ml" }
            if to == 0, gen.chance(30) { toName = "ml" }
        }
        let steps = abs(delta)
        let factor = ipow(step, steps)
        let wrongFactor = ipow(wrongStep, steps)
        let bigToSmall = delta < 0
        // Answers stay below 1000: a big unit into a small one only with small values.
        let bigValues: [Q] = [Q(2), Q(3), Q(4), Q(5), Q(6), Q(7), Q(8), Q(9), Q(1, 5), Q(1, 4), Q(2, 5), Q(1, 2), Q(3, 5), Q(3, 4), Q(4, 5), Q(1, 20), Q(1, 50), Q(3, 100), Q(2, 25)]
        let smallValues: [Q] = [2, 3, 5, 6, 8, 10, 20, 25, 40, 50, 60, 75, 80, 120, 150, 200, 250, 400, 500, 600, 750, 800, 1500, 2500, 3000, 4500, 5000, 7500].map { Q($0) }
        let candidates = (bigToSmall ? bigValues : smallValues).filter { value in
            let result = bigToSmall ? value * factor : value / factor
            return result.ok && result.double < 1000 && result.double >= 0.01 && (bigToSmall ? result.isWhole : [result].decimals(3).count == 1)
        }
        guard !candidates.isEmpty else { return nil }
        let value = gen.pick(candidates)
        let answer = bigToSmall ? value * factor : value / factor
        // Counting with the length factor, off by a power of ten, the wrong way round.
        let withWrongFactor = bigToSmall ? value * wrongFactor : value / wrongFactor
        let wrong = [withWrongFactor, answer * 10, answer / 10, bigToSmall ? value / factor : value * factor].decimals(3).positives
        return .number(
            prompt: "Wandle um:\n\(valueText(value)) \(fromName) = ? \(toName)",
            answer: answer,
            hint: "Gib die Zahl an.",
            wrong: wrong,
            pair: "\(valueText(value)) \(fromName) in \(toName)",
            solution: "Jede Stufe ist der Faktor \(T.grouped(step)): \(steps) \(steps == 1 ? "Stufe" : "Stufen"), \(valueText(value)) \(bigToSmall ? "·" : ":") \(T.grouped(factor)) = \(valueText(answer)) \(toName)",
            explanation: isArea
                ? "Bei Flächen ist jede Stufe der Faktor 100 (1 m² = 100 dm²). Zur kleineren Einheit malnehmen, zur größeren teilen."
                : "Bei Volumen ist jede Stufe der Faktor 1000 (1 dm³ = 1000 cm³), und 1 l ist 1 dm³. Zur kleineren Einheit malnehmen, zur größeren teilen."
        )
    }

    private static func ipow(_ base: Int, _ exponent: Int) -> Int {
        var result = 1
        for _ in 0..<max(0, exponent) { result *= base }
        return result
    }

    /// "Wie viele Liter passen in das Aquarium?" cm³ to liters, and the water level the other way.
    private static func volumeWord(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { volumeWordAttempt(level, gen) }
    }

    private static func volumeWordAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        if level == 3, gen.chance(50) {
            // The water level: liters to cm³, divided by the base area.
            let length = gen.pick([40, 50, 60, 80])
            let width = gen.pick([20, 25, 30, 40, 50])
            let height = gen.int(5...40)
            let liters = length * width * height
            guard liters % 1000 == 0 else { return nil }
            let l = liters / 1000
            guard l >= 2, l <= 99 else { return nil }
            // The liters taken for cm³, not converted: the height too small by a thousandth; or times 10.
            let wrong = [Q(l, length * width), Q(l * 10, length * width), Q(l * 1000, length), Q(height * 10), Q(height, 10)].decimals(2).positives
            return .number(
                prompt: "In ein Becken (\(length) cm lang, \(width) cm breit) werden \(l) l Wasser gefüllt.\nWie hoch steht das Wasser?",
                answer: Q(height),
                style: .unit("cm"),
                hint: valueHint,
                wrong: wrong,
                solution: "\(l) l = \(T.grouped(l * 1000)) cm³; Grundfläche \(length * width) cm²; \(T.grouped(l * 1000)) : \(length * width) = \(height) cm",
                explanation: "Rechne die Liter in cm³ um (1 l = 1000 cm³). Das Volumen geteilt durch die Grundfläche ist die Höhe."
            )
        }
        let inDm = level == 1
        let a = inDm ? gen.int(2...9) : gen.pick([20, 30, 40, 50, 60, 80, 100])
        let b = inDm ? gen.int(2...8) : gen.pick([20, 25, 30, 40, 50])
        let c = inDm ? gen.int(2...6) : gen.pick([20, 25, 30, 40, 50, 60])
        let volume = a * b * c
        let liters = Q(volume, inDm ? 1 : 1000)
        guard liters.ok, [liters].decimals(1).count == 1, liters.double >= 2, liters.double < 1000, a != b else { return nil }
        let unit = inDm ? "dm" : "cm"
        let thing = gen.pick(["Ein Aquarium", "Ein Wassertank", "Eine Kiste"])
        // Not converted, converted by 100 or 10 000, the edges added.
        let wrong = inDm
            ? [Q(a + b + c), Q(2 * (a * b + a * c + b * c)), liters * 10, liters / 10, Q(volume * 1000)]
            : [Q(volume), liters / 10, liters * 10, Q(volume, 100), Q(a + b + c)]
        return .number(
            prompt: "\(thing) ist \(a) \(unit) lang, \(b) \(unit) breit und \(c) \(unit) hoch.\nWie viele Liter passen hinein?",
            answer: liters,
            style: .unit("l"),
            hint: valueHint,
            wrong: wrong.decimals(2).positives,
            solution: inDm
                ? "V = \(a) · \(b) · \(c) = \(volume) dm³ = \(volume) l"
                : "V = \(a) · \(b) · \(c) = \(T.grouped(volume)) cm³; \(T.grouped(volume)) : 1000 = \(num(liters)) l",
            explanation: inDm
                ? "1 dm³ ist 1 Liter. Das Volumen in dm³ ist also gleich der Anzahl der Liter."
                : "Zuerst das Volumen in cm³ berechnen. Dann gilt 1000 cm³ = 1 l, du teilst also durch 1000."
        )
    }

    // Lesson 3

    /// Angles in triangles and quadrilaterals, adjacent angles, and the isosceles triangle.
    private static func angles(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { anglesAttempt(level, gen) }
    }

    private static func anglesAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let kind = level == 1 ? gen.int(0...1) : (level == 2 ? gen.int(1...3) : gen.int(2...4))
        switch kind {
        case 0:
            // Triangle: 180° minus the two known angles.
            let a = gen.int(20...80)
            let b = gen.int(20...80)
            let c = 180 - a - b
            guard c >= 15 else { return nil }
            return degrees(
                "In einem Dreieck sind α = \(a)° und β = \(b)°.\nWie groß ist γ?", c,
                wrong: [180 - a, 180 - b, a + b, 360 - a - b],
                front: "Dreieck: α = \(a)°, β = \(b)°",
                working: "γ = 180° \(T.minus) \(a)° \(T.minus) \(b)° = \(c)°",
                why: "Die Winkelsumme im Dreieck ist 180°. Ziehe die beiden bekannten Winkel davon ab."
            )
        case 1:
            // Adjacent angles add up to 180°.
            let a = gen.int(25...155)
            guard a != 90 else { return nil }
            return degrees(
                "Zwei Winkel liegen nebeneinander auf einer Geraden. Einer ist \(a)° groß.\nWie groß ist der andere?", 180 - a,
                wrong: [90 - a, 360 - a, a, 180 + a].filter { $0 > 0 },
                front: "Nebenwinkel von \(a)°",
                working: "180° \(T.minus) \(a)° = \(180 - a)°",
                why: "Nebenwinkel ergeben zusammen 180°, weil sie auf einer Geraden liegen."
            )
        case 2:
            // Quadrilateral: 360° minus the three known angles.
            let a = gen.int(60...120)
            let b = gen.int(60...120)
            let c = gen.int(60...120)
            let d = 360 - a - b - c
            guard d >= 30, d <= 150 else { return nil }
            return degrees(
                "In einem Viereck sind drei Winkel \(a)°, \(b)° und \(c)° groß.\nWie groß ist der vierte Winkel?", d,
                wrong: [360 - a - b, 360 - a - c, a + b + c - 180, 360 - b - c].filter { $0 > 0 },
                front: "Viereck: \(a)°, \(b)°, \(c)°",
                working: "δ = 360° \(T.minus) \(a)° \(T.minus) \(b)° \(T.minus) \(c)° = \(d)°",
                why: "Die Winkelsumme im Viereck ist 360°. Ziehe die drei bekannten Winkel davon ab."
            )
        case 3:
            // Isosceles triangle: apex or base angle.
            if gen.chance(50) {
                let base = gen.int(30...80)
                let apex = 180 - 2 * base
                guard apex >= 20, base != 60 else { return nil }
                return degrees(
                    "Ein gleichschenkliges Dreieck hat \(base)° an der Basis.\nWie groß ist der Winkel an der Spitze?", apex,
                    wrong: [180 - base, base * 2, 90 - base, base].filter { $0 > 0 },
                    front: "Basiswinkel \(base)°, Spitze?",
                    working: "180° \(T.minus) 2 · \(base)° = \(apex)°",
                    why: "Im gleichschenkligen Dreieck sind die beiden Basiswinkel gleich groß. Von 180° gehen beide ab."
                )
            }
            let apex = gen.pick([20, 30, 40, 50, 80, 100, 110, 120, 140])
            let base = (180 - apex) / 2
            return degrees(
                "Ein gleichschenkliges Dreieck hat \(apex)° an der Spitze.\nWie groß ist ein Basiswinkel?", base,
                wrong: [180 - apex, apex / 2, 90 - apex, (360 - apex) / 2].filter { $0 > 0 },
                front: "Spitze \(apex)°, Basiswinkel?",
                working: "(180° \(T.minus) \(apex)°) : 2 = \(base)°",
                why: "Die beiden Basiswinkel sind gleich groß. Ziehe den Winkel an der Spitze von 180° ab und teile durch 2."
            )
        default:
            // A triangle with an angle given as a multiple of another.
            let a = gen.int(15...40)
            let times = gen.int(2...3)
            let b = a * times
            let c = 180 - a - b
            guard c >= 20 else { return nil }
            return degrees(
                "In einem Dreieck ist α = \(a)° und β ist \(times == 2 ? "doppelt" : "dreimal") so groß wie α.\nWie groß ist γ?", c,
                wrong: [180 - a - a, 180 - b, b - a, a + b].filter { $0 > 0 },
                front: "α = \(a)°, β = \(times)α",
                working: "β = \(times) · \(a)° = \(b)°; γ = 180° \(T.minus) \(a)° \(T.minus) \(b)° = \(c)°",
                why: "Berechne zuerst den zweiten Winkel, dann ziehst du beide von 180° ab."
            )
        }
    }

    private static func degrees(_ prompt: String, _ answer: Int, wrong: [Int], front: String, working: String, why: String) -> MathMiddleProblem? {
        var problem = MathMiddleProblem.number(
            prompt: prompt,
            answer: Q(answer),
            style: .degrees,
            hint: "Gib die Gradzahl ohne ° an.",
            wrong: wrong.map { Q($0) },
            pair: front,
            solution: working,
            explanation: why
        )
        problem?.pairPrompt = "Ordne jeder Aufgabe den gesuchten Winkel zu."
        return problem
    }

    private static let triples: [(Int, Int, Int)] = [(3, 4, 5), (6, 8, 10), (5, 12, 13), (9, 12, 15), (8, 15, 17), (12, 16, 20), (7, 24, 25), (15, 20, 25), (20, 21, 29)]

    /// A triple at the level; level 3 scales a small one by 0,5, 1,5 or 2,5.
    private static func pickTriple(_ level: Int, _ gen: MathMiddleGen) -> (Q, Q, Q) {
        switch level {
        case 1:
            let t = gen.pick(Array(triples.prefix(2)))
            return (Q(t.0), Q(t.1), Q(t.2))
        case 2:
            let t = gen.pick(Array(triples.prefix(6)))
            return (Q(t.0), Q(t.1), Q(t.2))
        default:
            if gen.chance(50) {
                let t = gen.pick(Array(triples.prefix(2)) + [(5, 12, 13)])
                let k = Q(gen.pick([1, 3, 5]), 2)
                return (k * t.0, k * t.1, k * t.2)
            }
            let t = gen.pick(triples)
            return (Q(t.0), Q(t.1), Q(t.2))
        }
    }

    /// Hypotenuse or leg of a right triangle.
    private static func pythagoras(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let triple = pickTriple(level, gen)
        let swap = gen.chance(50)
        let (a, b, c) = (swap ? triple.1 : triple.0, swap ? triple.0 : triple.1, triple.2)
        let findsHypotenuse = level == 1 || gen.chance(50)
        let sq = { (q: Q) in q * q }
        if findsHypotenuse {
            // The legs added, the squares added without a root, the difference of the legs.
            let wrong = [a + b, sq(a) + sq(b), (b - a).magnitude, c + 1].decimals(2).positives
            return .number(
                prompt: "In einem rechtwinkligen Dreieck sind die Katheten \(num(a)) cm und \(num(b)) cm lang.\nWie lang ist die Hypotenuse?",
                answer: c,
                style: .unit("cm"),
                hint: valueHint,
                wrong: wrong,
                pair: "Katheten \(num(a)) cm, \(num(b)) cm",
                solution: "c² = \(num(a))² + \(num(b))² = \(num(sq(a))) + \(num(sq(b))) = \(num(sq(c))); c = \(num(c)) cm",
                explanation: "Im rechtwinkligen Dreieck gilt a² + b² = c². Die Hypotenuse c liegt gegenüber dem rechten Winkel."
            )
        }
        // The other leg: the hypotenuse squared minus the known leg squared.
        let wrong = [c - a, c + a, sq(c) + sq(a), sq(c) - sq(a)].decimals(2).positives
        return .number(
            prompt: "In einem rechtwinkligen Dreieck ist die Hypotenuse \(num(c)) cm und eine Kathete \(num(a)) cm lang.\nWie lang ist die andere Kathete?",
            answer: b,
            style: .unit("cm"),
            hint: valueHint,
            wrong: wrong,
            pair: "c = \(num(c)) cm, a = \(num(a)) cm",
            solution: "b² = c² \(T.minus) a² = \(num(sq(c))) \(T.minus) \(num(sq(a))) = \(num(sq(b))); b = \(num(b)) cm",
            explanation: "Stelle a² + b² = c² um: b² = c² − a². Die Hypotenuse ist die längste Seite und wird nicht abgezogen, sondern steht allein."
        )
    }

    /// Ladder, diagonal and shortcut: Pythagoras in a story.
    private static func pythagorasWord(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let triple = pickTriple(level == 1 ? 2 : level, gen)
        let swap = gen.chance(50)
        let (a, b, c) = (swap ? triple.1 : triple.0, swap ? triple.0 : triple.1, triple.2)
        let story = gen.int(0...2)
        let unit = story == 1 ? "cm" : "m"
        let prompt: String
        let answer: Q
        let working: String
        let wrong: [Q]
        switch story {
        case 0:
            // Ladder: the length is the hypotenuse, the foot distance a leg: the height is the other leg.
            prompt = "Eine \(num(c)) m lange Leiter lehnt an einer Wand. Ihr Fuß steht \(num(a)) m von der Wand entfernt.\nWie hoch reicht die Leiter?"
            answer = b
            wrong = [c - a, c + a, c * c - a * a, a + b]
            working = "h² = \(num(c))² \(T.minus) \(num(a))² = \(num(c * c - a * a)); h = \(num(b)) m"
        case 1:
            prompt = "Ein Rechteck ist \(num(a)) cm lang und \(num(b)) cm breit.\nWie lang ist die Diagonale?"
            answer = c
            wrong = [a + b, a * a + b * b, (b - a).magnitude, a * b]
            working = "d² = \(num(a))² + \(num(b))² = \(num(a * a + b * b)); d = \(num(c)) cm"
        default:
            prompt = "Ein Sportplatz ist \(num(a)) m lang und \(num(b)) m breit. Anna läuft quer über die Diagonale.\nWie lang ist ihr Weg?"
            answer = c
            wrong = [a + b, a * a + b * b, (b - a).magnitude, a * b]
            working = "d² = \(num(a))² + \(num(b))² = \(num(a * a + b * b)); d = \(num(c)) m"
        }
        return .number(
            prompt: prompt,
            answer: answer,
            style: .unit(unit),
            hint: valueHint,
            wrong: wrong.decimals(2).positives,
            solution: working,
            explanation: "Suche das rechtwinklige Dreieck in der Geschichte und die Hypotenuse (die Seite gegenüber dem rechten Winkel). Dann gilt a² + b² = c²."
        )
    }

    /// Which set of sides makes a right triangle? The converse of the theorem.
    private static func rightAngleTest(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        gen.attempt { rightAngleTestAttempt(level, gen) }
    }

    private static func rightAngleTestAttempt(_ level: Int, _ gen: MathMiddleGen) -> MathMiddleProblem? {
        let pool = level == 1 ? Array(triples.prefix(3)) : (level == 2 ? Array(triples.prefix(6)) : triples)
        let (a, b, c) = gen.pick(pool)
        func isRight(_ x: Int, _ y: Int, _ z: Int) -> Bool {
            let sides = [x, y, z].sorted()
            return sides[0] * sides[0] + sides[1] * sides[1] == sides[2] * sides[2]
        }
        func text(_ x: Int, _ y: Int, _ z: Int) -> String { "\(x) cm, \(y) cm, \(z) cm" }
        // One side too long or too short by 1 or 2, two sides swapped for a shorter one.
        let candidates = [(a, b, c + 1), (a, b, c - 1), (a + 1, b, c), (a, b + 1, c), (a, b, c + 2), (a - 1, b, c), (a, b - 1, c)]
            .filter { $0.0 > 0 && $0.1 > 0 && $0.2 > 0 && !isRight($0.0, $0.1, $0.2) && $0.0 + $0.1 > $0.2 }
        let wrong = Array(gen.shuffled(candidates).prefix(3)).map { text($0.0, $0.1, $0.2) }
        guard wrong.count == 3 else { return nil }
        let (small1, small2) = a < b ? (a, b) : (b, a)
        return .text(
            prompt: "Welche Seitenlängen gehören zu einem rechtwinkligen Dreieck?",
            correct: text(a, b, c),
            wrong: wrong,
            typed: .init(
                prompt: "Ein Dreieck hat die Seiten \(text(a, b, c)).\nBerechne a² + b² mit den beiden kürzeren Seiten.",
                answer: Rational(small1 * small1 + small2 * small2)
            ),
            solution: "\(a)² + \(b)² = \(a * a + b * b) und \(c)² = \(c * c): Die Summe der Quadrate der kurzen Seiten gleicht dem Quadrat der längsten, also ist es rechtwinklig.",
            explanation: "Gilt a² + b² = c² für die drei Seiten (c ist die längste), ist das Dreieck rechtwinklig. Bei den anderen Dreiecken stimmt die Gleichung nicht."
        )
    }
}

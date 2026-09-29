import XCTest
@testable import Lernwerk

/// Every new component x every edge case x every parameter combination x every theme. A case either fits, and then the
/// component draws it inside the slide with every text in its box, or it does not, and then the registry falls back and
/// loses no text.
final class ComponentMatrixTests: XCTestCase {
    private enum Expectation { case fits, falls }

    private struct Case {
        var name: String
        var draft: SlideDraft
        var image: PlacedImage? = nil
        var expectation: Expectation = .fits
    }

    private let picture = PlacedImage(name: "p.jpg", aspect: 1.5)

    /// Text of exactly `count` characters made of words of assorted lengths, which wrap badly.
    private func words(_ count: Int) -> String {
        let pool = ["Wasserstoff", "Ab", "Photosynthese", "und", "Energie", "Zelle", "Kreislauf", "im", "Modell", "Größenordnung"]
        var text = ""
        var i = 0
        while text.count < count {
            text += (text.isEmpty ? "" : " ") + pool[i % pool.count]
            i += 1
        }
        var cut = String(text.prefix(count))
        while cut.hasSuffix(" ") { cut.removeLast() }
        return cut.count == count ? cut : cut + String(repeating: "x", count: count - cut.count)
    }

    private func entries(_ count: Int, title: Int, text: Int, icon: String = "") -> [DraftItem] {
        (0..<count).map { DraftItem(title: title == 1 ? "\($0 + 1)" : words(title), text: text == 0 ? "" : words(text), icon: icon) }
    }

    private func cases(_ id: String) -> [Case] {
        let d = { (layout: SlideLayout) in SlideDraft(layout: layout, title: "Titel") }
        var draft = d(.cards)
        switch id {
        case "stat-row":
            func numbers(_ count: Int, title: String, text: Int) -> SlideDraft {
                var x = d(.cards)
                x.items = (0..<count).map { _ in DraftItem(title: title, text: text == 0 ? "" : words(text)) }
                return x
            }
            return [
                Case(name: "min", draft: numbers(2, title: "70 %", text: 6)),
                Case(name: "max", draft: numbers(4, title: "12.345.678 Mio", text: 90)),
                Case(name: "empty", draft: numbers(3, title: "3", text: 0)),
                Case(name: "long-title", draft: numbers(3, title: String(repeating: "9", count: 30), text: 10), expectation: .falls),
                Case(name: "no-digits", draft: numbers(3, title: "viele", text: 10), expectation: .falls),
                Case(name: "one", draft: numbers(1, title: "1", text: 5), expectation: .falls),
                Case(name: "five", draft: numbers(5, title: "1", text: 5), expectation: .falls),
                Case(name: "long-text", draft: numbers(3, title: "5", text: 400), expectation: .falls),
            ]
        case "comparison", "before-after":
            let titleLimit = id == "comparison" ? 34 : 24
            let textLimit = id == "comparison" ? 80 : 60
            let most = id == "comparison" ? 5 : 4
            func sides(_ count: Int, _ text: Int, _ left: String, _ right: String) -> SlideDraft {
                var x = d(.twoColumns)
                x.leftTitle = left
                x.rightTitle = right
                x.left = (0..<count).map { _ in words(text) }
                x.right = (0..<count).map { _ in words(text) }
                return x
            }
            var result = [
                Case(name: "min", draft: sides(1, 3, "", "")),
                Case(name: "max", draft: sides(most, textLimit, words(titleLimit), words(titleLimit))),
                Case(name: "titled", draft: sides(2, 20, "Vorher", "Nachher")),
                Case(name: "long-text", draft: sides(2, textLimit * 3, "", ""), expectation: .falls),
                Case(name: "long-title", draft: sides(2, 10, words(titleLimit * 3), ""), expectation: .falls),
                Case(name: "too-many", draft: sides(most + 1, 10, "", ""), expectation: .falls),
            ]
            var oneSided = sides(2, 10, "", "")
            oneSided.right = []
            result.append(Case(name: "one-side-empty", draft: oneSided, expectation: .falls))
            if id == "before-after" {
                result.append(Case(name: "with-image", draft: sides(2, 40, "Vorher", "Nachher"), image: picture))
                result.append(Case(name: "image-but-long", draft: sides(4, 60, "", ""), image: picture))
            }
            return result
        case "matrix-2x2":
            func quads(_ count: Int, title: Int, text: Int, axes: (String, String) = ("", "")) -> SlideDraft {
                var x = d(.cards)
                x.items = entries(count, title: title, text: text)
                x.leftTitle = axes.0
                x.rightTitle = axes.1
                return x
            }
            return [
                Case(name: "min", draft: quads(4, title: 1, text: 0)),
                Case(name: "max", draft: quads(4, title: 28, text: 100, axes: (words(40), words(40)))),
                Case(name: "one-axis", draft: quads(4, title: 10, text: 30, axes: ("Zeit", ""))),
                Case(name: "long-title", draft: quads(4, title: 60, text: 10), expectation: .falls),
                Case(name: "three", draft: quads(3, title: 5, text: 10), expectation: .falls),
                Case(name: "long-axis", draft: quads(4, title: 5, text: 10, axes: (words(120), "")), expectation: .falls),
            ]
        case "definition":
            func definition(term: Int, explanation: Int, examples: [Int]) -> SlideDraft {
                var x = d(.bigNumber)
                x.value = term == 0 ? "" : words(term)
                x.subtitle = explanation == 0 ? "" : words(explanation)
                x.bullets = examples.map(words)
                return x
            }
            return [
                Case(name: "min", draft: definition(term: 1, explanation: 1, examples: [])),
                Case(name: "max", draft: definition(term: 40, explanation: 240, examples: [100, 100])),
                Case(name: "one-example", draft: definition(term: 12, explanation: 100, examples: [80])),
                Case(name: "no-example", draft: definition(term: 20, explanation: 200, examples: [])),
                Case(name: "long-explanation", draft: definition(term: 10, explanation: 700, examples: []), expectation: .falls),
                Case(name: "long-term", draft: definition(term: 90, explanation: 20, examples: []), expectation: .falls),
                Case(name: "no-term", draft: definition(term: 0, explanation: 20, examples: []), expectation: .falls),
                Case(name: "three-examples", draft: definition(term: 10, explanation: 20, examples: [10, 10, 10]), expectation: .falls),
            ]
        case "agenda", "staircase", "icon-grid":
            let (lo, hi, titleLimit, textLimit): (Int, Int, Int, Int)
            switch id {
            case "agenda": (lo, hi, titleLimit, textLimit) = (3, 7, 46, 60)
            case "staircase": (lo, hi, titleLimit, textLimit) = (3, 5, 24, 48)
            default: (lo, hi, titleLimit, textLimit) = (4, 6, 26, 60)
            }
            func list(_ count: Int, _ title: Int, _ text: Int, icon: String = "") -> SlideDraft {
                var x = d(.process)
                x.items = entries(count, title: title, text: text, icon: icon)
                return x
            }
            var result = [
                Case(name: "min", draft: list(lo, 1, 0)),
                Case(name: "max", draft: list(hi, titleLimit, textLimit, icon: "🔥")),
                Case(name: "no-text", draft: list(hi, titleLimit, 0)),
                Case(name: "long-title", draft: list(lo, titleLimit * 2, 5), expectation: .falls),
                Case(name: "long-text", draft: list(lo, 5, textLimit * 3), expectation: .falls),
                Case(name: "too-few", draft: list(lo - 1, 5, 5), expectation: .falls),
                Case(name: "too-many", draft: list(hi + 1, 5, 5), expectation: .falls),
            ]
            if id == "icon-grid" { result.append(Case(name: "five", draft: list(5, 10, 30, icon: "🌍"))) }
            return result
        case "checklist":
            func checks(_ count: Int, _ length: Int) -> SlideDraft {
                var x = d(.bullets)
                x.bullets = (0..<count).map { _ in words(length) }
                return x
            }
            return [
                Case(name: "min", draft: checks(3, 3)),
                Case(name: "max", draft: checks(6, 100)),
                Case(name: "long", draft: checks(3, 300), expectation: .falls),
                Case(name: "two", draft: checks(2, 10), expectation: .falls),
                Case(name: "seven", draft: checks(7, 10), expectation: .falls),
            ]
        case "quote-image":
            func quote(_ text: Int, _ source: Int, title: String = "") -> SlideDraft {
                var x = SlideDraft(layout: .quote, title: title)
                x.quote = words(text)
                x.attribution = source == 0 ? "" : words(source)
                return x
            }
            return [
                Case(name: "min", draft: quote(3, 0), image: picture),
                Case(name: "max", draft: quote(240, 60, title: words(90)), image: picture),
                Case(name: "no-attribution", draft: quote(120, 0), image: picture),
                Case(name: "tall-picture", draft: quote(120, 20), image: PlacedImage(name: "t.jpg", aspect: 0.5)),
                Case(name: "no-image", draft: quote(40, 10), expectation: .falls),
                Case(name: "long-quote", draft: quote(500, 10), image: picture, expectation: .falls),
            ]
        default:
            draft = d(.blank)
            return [Case(name: "unknown", draft: draft, expectation: .falls)]
        }
    }

    private func combinations(_ component: SlideComponent) -> [ComponentParams] {
        var result: [ComponentParams] = [[:]]
        for parameter in component.parameters {
            result = result.flatMap { partial in
                parameter.values.map { value -> ComponentParams in
                    var copy = partial
                    copy[parameter.name] = value
                    return copy
                }
            }
        }
        return result
    }

    private let newIDs = ["stat-row", "comparison", "matrix-2x2", "definition", "agenda", "checklist", "quote-image", "icon-grid", "staircase", "before-after"]

    private func strings(_ draft: SlideDraft) -> [String] {
        var result: [String] = [draft.title, draft.subtitle, draft.value, draft.quote, draft.attribution, draft.leftTitle, draft.rightTitle]
        result += draft.bullets
        result += draft.left
        result += draft.right
        result += draft.items.flatMap { [$0.title, $0.text] }
        return result
    }

    private func inBounds(_ e: SlideElement) -> Bool {
        let right: Double = e.x + e.width
        let bottom: Double = e.y + e.height
        let limitX: Double = SlideSize.width + 0.5
        let limitY: Double = SlideSize.height + 0.5
        return e.x >= -0.5 && e.y >= -0.5 && right <= limitX && bottom <= limitY
    }

    func testTenNewComponentsWithTwoOrMoreVariantsEach() {
        for id in newIDs {
            let component = try! XCTUnwrap(ComponentRegistry.component(id))
            XCTAssertGreaterThanOrEqual(component.parameters.count, 2, id)
            XCTAssertGreaterThanOrEqual(combinations(component).count, 4, id)
            XCTAssertTrue(component.parameters.contains { $0.name == DeckRhythm.densityParameter }, id)
            XCTAssertFalse(component.summary.isEmpty)
            XCTAssertFalse(component.tags.isEmpty)
            XCTAssertNotNil(component.layout == nil ? 1 : nil, "new components are not first-version layouts")
        }
        XCTAssertEqual(ComponentRegistry.all.count, 25)
    }

    func testMatrix() {
        var checked = 0
        for id in newIDs {
            let component = ComponentRegistry.component(id)!
            for testCase in cases(id) {
                for params in combinations(component) {
                    for theme in SlideTheme.all {
                        let label = "\(id)/\(testCase.name)/\(params.sorted { $0.key < $1.key })/\(theme.id)"
                        let built = ComponentRegistry.build(testCase.draft, componentID: id, params: params, image: testCase.image, theme: theme)
                        checked += 1
                        switch testCase.expectation {
                        case .fits:
                            XCTAssertEqual(built.componentID, id, "\(label): \(built.log)")
                            XCTAssertTrue(built.log.isEmpty, label)
                        case .falls:
                            XCTAssertNotEqual(built.componentID, id, label)
                            XCTAssertFalse(built.log.isEmpty, label)
                            let all = built.elements.map(\.text).joined(separator: "\n")
                            for text in strings(testCase.draft) where !text.isBlank {
                                XCTAssertTrue(all.contains(text.trimmingCharacters(in: .whitespacesAndNewlines)), "\(label): lost \"\(text.prefix(30))\"")
                            }
                        }
                        // Inside the slide, one id per element, and every text in its box (a fallback is fitted first).
                        let slide = testCase.expectation == .fits ? Slide(elements: built.elements) : SlideAutoFit.fit(Slide(elements: built.elements), theme: theme)
                        XCTAssertEqual(Set(slide.elements.map(\.id)).count, slide.elements.count, label)
                        for element in slide.elements {
                            XCTAssertTrue(inBounds(element), "\(label): \(element.kind) \(element.x),\(element.y) \(element.width)x\(element.height)")
                            if element.kind == .text {
                                let overflow = SlideAutoFit.overflows(element, theme: theme)
                                XCTAssertTrue(!overflow || (testCase.expectation == .falls && element.fontSize <= SlideAutoFit.minimumSize), "\(label): text overflows \"\(element.text.prefix(30))\" at \(element.fontSize)")
                            }
                        }
                        // The same input gives the same elements.
                        let again = ComponentRegistry.build(testCase.draft, componentID: id, params: params, image: testCase.image, theme: theme)
                        XCTAssertEqual(GoldenLayoutCases.digest(again.elements), GoldenLayoutCases.digest(built.elements), label)
                        XCTAssertEqual(again.componentID, built.componentID)
                    }
                }
            }
        }
        XCTAssertGreaterThan(checked, 5000)
    }

    func testInvalidParametersUseDefaults() {
        for id in newIDs {
            let component = ComponentRegistry.component(id)!
            let good = cases(id).first { $0.name == "min" }!
            let defaults = ComponentRegistry.build(good.draft, componentID: id, image: good.image)
            let broken = ComponentRegistry.build(good.draft, componentID: id, params: ["density": "dicht", "zzz": "1"], image: good.image)
            XCTAssertEqual(GoldenLayoutCases.digest(broken.elements), GoldenLayoutCases.digest(defaults.elements), id)
            XCTAssertEqual(defaults.params, component.resolvedParams([:]))
        }
    }

    func testVariantsActuallyDiffer() {
        for id in newIDs {
            let component = ComponentRegistry.component(id)!
            let good = cases(id).first { $0.name == "min" }!
            let digests = Set(combinations(component).map { params in
                GoldenLayoutCases.digest(ComponentRegistry.build(good.draft, componentID: id, params: params, image: good.image).elements)
            })
            // before-after only changes with a picture, and its picture needs short bullets.
            XCTAssertGreaterThan(digests.count, id == "before-after" ? 1 : 3, id)
        }
    }

    func testImageTextSideIsAParameterNotAComponent() throws {
        let draft = SlideDraft(layout: .imageText, title: "T", bullets: ["a", "b"])
        let image = PlacedImage(name: "p.jpg", aspect: 1.5)
        let left = ComponentRegistry.build(draft, componentID: "image-text", image: image)
        let right = ComponentRegistry.build(draft, componentID: "image-text", params: ["side": "right"], image: image)
        XCTAssertEqual(left.componentID, "image-text")
        XCTAssertEqual(right.componentID, "image-text")
        let leftPicture = try XCTUnwrap(left.elements.first { $0.kind == .image })
        let rightPicture = try XCTUnwrap(right.elements.first { $0.kind == .image })
        let leftText = try XCTUnwrap(left.elements.first { $0.bullets })
        let rightText = try XCTUnwrap(right.elements.first { $0.bullets })
        XCTAssertLessThan(leftPicture.x, leftText.x)
        XCTAssertGreaterThan(rightPicture.x, rightText.x)
        XCTAssertTrue(right.elements.allSatisfy(inBounds))
        XCTAssertEqual(GoldenLayoutCases.digest(left.elements), GoldenLayoutCases.digest(SlideLayouts.build(draft, image: image)), "the default is the old layout")
        XCTAssertNil(ComponentRegistry.component("image-text-right"))
    }

    func testComparisonEmphasisChangesTheHeaders() {
        var draft = SlideDraft(layout: .twoColumns, title: "T", leftTitle: "Alt", left: ["a"], rightTitle: "Neu", right: ["b"])
        draft.notes = ""
        func headerFills(_ emphasis: String) -> [String] {
            ComponentRegistry.build(draft, componentID: "comparison", params: ["emphasis": emphasis]).elements
                .filter { $0.kind == .shape && $0.y == 150 }.map(\.fill)
        }
        XCTAssertEqual(headerFills("none"), ["accent", "accent"])
        XCTAssertEqual(headerFills("left"), ["accent", "muted"])
        XCTAssertEqual(headerFills("right"), ["muted", "accent"])
    }

    func testBeforeAfterShowsThePictureOnTheChosenSideOnly() {
        var draft = SlideDraft(layout: .twoColumns, title: "T", leftTitle: "Vorher", left: ["a"], rightTitle: "Nachher", right: ["b"])
        draft.notes = ""
        func pictureX(_ side: String, image: PlacedImage?) -> Double? {
            ComponentRegistry.build(draft, componentID: "before-after", params: ["imageSide": side], image: image).elements.first { $0.kind == .image }?.x
        }
        let image = PlacedImage(name: "p.jpg", aspect: 1.5)
        XCTAssertNil(pictureX("none", image: image))
        XCTAssertNil(pictureX("left", image: nil))
        XCTAssertLessThan(pictureX("left", image: image)!, 480)
        XCTAssertGreaterThan(pictureX("right", image: image)!, 480)
    }
}

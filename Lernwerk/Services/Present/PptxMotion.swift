import Foundation

/// The `p:transition` and `p:timing` parts of a slide, built from `Slide.transition` and `SlideElement.animation`.
/// Kept apart from PptxWriter so a deck without motion produces exactly the bytes it always did.
enum PptxMotion {
    /// Empty when the slide has no (or no visible) transition.
    static func transition(_ slide: Slide) -> String {
        guard let t = slide.transition, t.kind != .none else { return "" }
        let speed = t.seconds < 0.4 ? "fast" : (t.seconds <= 0.9 ? "med" : "slow")
        // Read back with LibreOffice's PowerPoint import, this gives push and cover "from the left", "from the right", "from the
        // top" and "from the bottom" as named. It is the one outside check there is; PowerPoint itself has not been asked.
        let dir: String
        switch t.direction {
        case .left: dir = "l"
        case .right: dir = "r"
        case .up: dir = "d"
        case .down: dir = "u"
        }
        let body: String
        switch t.kind {
        case .none: return ""
        case .fade: body = "<p:fade/>"
        case .push: body = "<p:push dir=\"\(dir)\"/>"
        case .cover: body = "<p:cover dir=\"\(dir)\"/>"
        case .zoom: body = "<p:zoom dir=\"in\"/>"
        }
        return "<p:transition spd=\"\(speed)\">\(body)</p:transition>"
    }

    /// `shapeIDs` maps element ids to the shape ids in the slide XML; elements without a shape (a picture whose file
    /// is missing) are skipped. Empty when nothing on the slide animates.
    static func timing(_ slide: Slide, shapeIDs: [String: Int]) -> String {
        let steps = MotionPlanner.timeline(slide).map { step in
            (step: step, entries: step.entries.filter { shapeIDs[$0.elementID] != nil })
        }.filter { !$0.entries.isEmpty }
        guard !steps.isEmpty else { return "" }

        var next = 2
        func id() -> Int {
            next += 1
            return next
        }
        let byID = Dictionary(slide.elements.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var xml = "<p:timing><p:tnLst><p:par><p:cTn id=\"1\" dur=\"indefinite\" restart=\"never\" nodeType=\"tmRoot\"><p:childTnLst>"
        xml += "<p:seq concurrent=\"1\" nextAc=\"seek\"><p:cTn id=\"2\" dur=\"indefinite\" nodeType=\"mainSeq\"><p:childTnLst>"
        var built: [(spid: Int, needsBuild: Bool, animBg: Bool)] = []
        for (step, entries) in steps.map({ ($0.step, $0.entries) }) {
            let outer = id()
            let inner = id()
            let start = step.autoStart
                ? "<p:cond delay=\"indefinite\"/><p:cond evt=\"onBegin\" delay=\"0\"><p:tn val=\"2\"/></p:cond>"
                : "<p:cond delay=\"indefinite\"/>"
            xml += "<p:par><p:cTn id=\"\(outer)\" fill=\"hold\"><p:stCondLst>\(start)</p:stCondLst><p:childTnLst>"
            xml += "<p:par><p:cTn id=\"\(inner)\" fill=\"hold\"><p:stCondLst><p:cond delay=\"0\"/></p:stCondLst><p:childTnLst>"
            for (position, entry) in entries.enumerated() {
                guard let spid = shapeIDs[entry.elementID] else { continue }
                let node = position == 0 && !step.autoStart ? "clickEffect" : "withEffect"
                xml += effect(entry.animation, spid: spid, node: node, id: id)
                let element = byID[entry.elementID]
                let isPicture = element?.kind == .image
                let isLine = element?.isLine == true
                built.append((spid, !isPicture && !isLine, element?.kind == .shape))
            }
            xml += "</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>"
        }
        xml += "</p:childTnLst></p:cTn>"
        xml += "<p:prevCondLst><p:cond evt=\"onPrev\" delay=\"0\"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>"
        xml += "<p:nextCondLst><p:cond evt=\"onNext\" delay=\"0\"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>"
        xml += "</p:childTnLst></p:cTn></p:par></p:tnLst>"
        let builds = built.filter(\.needsBuild)
        if !builds.isEmpty {
            xml += "<p:bldLst>" + builds.map { "<p:bldP spid=\"\($0.spid)\" grpId=\"0\"\($0.animBg ? " animBg=\"1\"" : "")/>" }.joined() + "</p:bldLst>"
        }
        return xml + "</p:timing>"
    }

    private static func ms(_ seconds: Double) -> Int { Int((seconds * 1000).rounded()) }

    private static func target(_ spid: Int) -> String { "<p:tgtEl><p:spTgt spid=\"\(spid)\"/></p:tgtEl>" }

    private static func visible(_ spid: Int, id: () -> Int) -> String {
        "<p:set><p:cBhvr><p:cTn id=\"\(id())\" dur=\"1\" fill=\"hold\"><p:stCondLst><p:cond delay=\"0\"/></p:stCondLst></p:cTn>\(target(spid))"
            + "<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val=\"visible\"/></p:to></p:set>"
    }

    private static func animated(_ attribute: String, from: String, to: String, ms duration: Int, spid: Int, id: () -> Int) -> String {
        "<p:anim calcmode=\"lin\" valueType=\"num\"><p:cBhvr additive=\"base\"><p:cTn id=\"\(id())\" dur=\"\(duration)\" fill=\"hold\"/>\(target(spid))"
            + "<p:attrNameLst><p:attrName>\(attribute)</p:attrName></p:attrNameLst></p:cBhvr>"
            + "<p:tavLst><p:tav tm=\"0\"><p:val><p:strVal val=\"\(from)\"/></p:val></p:tav><p:tav tm=\"100000\"><p:val><p:strVal val=\"\(to)\"/></p:val></p:tav></p:tavLst></p:anim>"
    }

    private static func filter(_ name: String, ms duration: Int, spid: Int, id: () -> Int) -> String {
        "<p:animEffect transition=\"in\" filter=\"\(name)\"><p:cBhvr><p:cTn id=\"\(id())\" dur=\"\(duration)\"/>\(target(spid))</p:cBhvr></p:animEffect>"
    }

    /// One entrance effect. PowerPoint's presetIDs: 1 appear, 2 fly in, 10 fade, 22 wipe, 53 zoom.
    private static func effect(_ a: ElementAnimation, spid: Int, node: String, id: () -> Int) -> String {
        let duration = ms(a.seconds)
        let preset: (id: Int, subtype: Int)
        var inner = ""
        let outerID = id()
        switch a.kind {
        case .appear:
            preset = (1, 0)
            inner = visible(spid, id: id)
        case .fade:
            preset = (10, 0)
            inner = visible(spid, id: id) + filter("fade", ms: duration, spid: spid, id: id)
        case .fly:
            switch a.direction {
            case .up:
                preset = (2, 1)
                inner = visible(spid, id: id)
                    + animated("ppt_x", from: "#ppt_x", to: "#ppt_x", ms: duration, spid: spid, id: id)
                    + animated("ppt_y", from: "0-#ppt_h/2", to: "#ppt_y", ms: duration, spid: spid, id: id)
            case .right:
                preset = (2, 2)
                inner = visible(spid, id: id)
                    + animated("ppt_x", from: "1+#ppt_w/2", to: "#ppt_x", ms: duration, spid: spid, id: id)
                    + animated("ppt_y", from: "#ppt_y", to: "#ppt_y", ms: duration, spid: spid, id: id)
            case .down:
                preset = (2, 4)
                inner = visible(spid, id: id)
                    + animated("ppt_x", from: "#ppt_x", to: "#ppt_x", ms: duration, spid: spid, id: id)
                    + animated("ppt_y", from: "1+#ppt_h/2", to: "#ppt_y", ms: duration, spid: spid, id: id)
            case .left:
                preset = (2, 8)
                inner = visible(spid, id: id)
                    + animated("ppt_x", from: "0-#ppt_w/2", to: "#ppt_x", ms: duration, spid: spid, id: id)
                    + animated("ppt_y", from: "#ppt_y", to: "#ppt_y", ms: duration, spid: spid, id: id)
            }
        case .zoom:
            preset = (53, 16)
            inner = visible(spid, id: id)
                + animated("ppt_w", from: "0", to: "#ppt_w", ms: duration, spid: spid, id: id)
                + animated("ppt_h", from: "0", to: "#ppt_h", ms: duration, spid: spid, id: id)
                + filter("fade", ms: duration, spid: spid, id: id)
        case .wipe:
            let (subtype, name): (Int, String)
            switch a.direction {
            case .up: (subtype, name) = (1, "wipe(up)")
            case .right: (subtype, name) = (2, "wipe(right)")
            case .down: (subtype, name) = (4, "wipe(down)")
            case .left: (subtype, name) = (8, "wipe(left)")
            }
            preset = (22, subtype)
            inner = visible(spid, id: id) + filter(name, ms: duration, spid: spid, id: id)
        }
        return "<p:par><p:cTn id=\"\(outerID)\" presetID=\"\(preset.id)\" presetClass=\"entr\" presetSubtype=\"\(preset.subtype)\" fill=\"hold\" grpId=\"0\" nodeType=\"\(node)\">"
            + "<p:stCondLst><p:cond delay=\"\(ms(a.delaySeconds))\"/></p:stCondLst><p:childTnLst>\(inner)</p:childTnLst></p:cTn></p:par>"
    }
}

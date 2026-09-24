import Foundation

/// Reads an existing PowerPoint file into free slide elements: text boxes and placeholders (positions and sizes
/// inherited from layout and master), shapes, lines and arrows, pictures, groups, tables as text, backgrounds and
/// speaker notes. Charts, SmartArt, animations and vector pictures are left out. Slides of any size are fitted into
/// 960 × 540 pt. Mirrors the Android app.
enum PptxReader {
    struct Imported {
        var presentation: Presentation
        /// New media file name -> bytes, for the caller to store.
        var media: [String: Data]
        /// Objects that could not be taken over (charts, SmartArt, vector pictures).
        var skipped: Int
    }

    enum ReadError: LocalizedError {
        case notPowerPoint

        var errorDescription: String? { "Keine PowerPoint-Datei (.pptx)." }
    }

    fileprivate static let emuPerPoint: Double = 12700

    static func read(_ data: Data, title: String) throws -> Imported {
        let files = try ZipArchive.files(data)
        guard let presentationXML = files["ppt/presentation.xml"].flatMap(OfficeXML.parse) else { throw ReadError.notPowerPoint }
        let size = presentationXML.first("sldSz")
        let widthPt = (size?.attr("cx").flatMap(Double.init) ?? 9_144_000) / emuPerPoint
        let heightPt = (size?.attr("cy").flatMap(Double.init) ?? 6_858_000) / emuPerPoint
        let scale = min(SlideSize.width / widthPt, SlideSize.height / heightPt)
        let context = Context(
            files: files,
            scale: scale,
            offsetX: (SlideSize.width - widthPt * scale) / 2,
            offsetY: (SlideSize.height - heightPt * scale) / 2
        )
        let presentationRels = relationships(files, "ppt/presentation.xml")
        let slidePaths = presentationXML.all("sldId").compactMap { $0.attrNS("id").flatMap { presentationRels[$0] } }
        let slides = slidePaths.compactMap { path in files[path] == nil ? nil : context.readSlide(path) }
        let dark = slides.first.map { luminance($0.background) < 0.4 } ?? false
        return Imported(
            presentation: Presentation(
                title: title,
                themeId: dark ? SlideTheme.night.id : SlideTheme.paper.id,
                slides: slides.isEmpty ? [Slide()] : slides
            ),
            media: context.media,
            skipped: context.skipped
        )
    }

    // Package helpers

    /// Relationship ids of a part mapped to resolved package paths.
    fileprivate static func relationships(_ files: [String: Data], _ part: String) -> [String: String] {
        let folder = part.range(of: "/", options: .backwards).map { String(part[..<$0.lowerBound]) } ?? ""
        let file = part.split(separator: "/").last.map(String.init) ?? part
        let relsPath = folder.isEmpty ? "_rels/\(file).rels" : "\(folder)/_rels/\(file).rels"
        guard let root = files[relsPath].flatMap(OfficeXML.parse) else { return [:] }
        var result: [String: String] = [:]
        for rel in root.all("Relationship") {
            let target = rel.attr("Target") ?? ""
            result[rel.attr("Id") ?? ""] = rel.attr("TargetMode") == "External" ? "" : resolve(folder, target)
        }
        return result
    }

    private static func resolve(_ folder: String, _ target: String) -> String {
        if target.hasPrefix("/") { return String(target.drop { $0 == "/" }) }
        var parts = folder.isEmpty ? [] : folder.split(separator: "/").map(String.init)
        for piece in target.split(separator: "/", omittingEmptySubsequences: false) {
            switch piece {
            case "..": if !parts.isEmpty { parts.removeLast() }
            case ".", "": break
            default: parts.append(String(piece))
            }
        }
        return parts.joined(separator: "/")
    }

    // Colors

    fileprivate static func luminance(_ hex: String) -> Double {
        guard let value = UInt32(hex.hasPrefix("#") ? String(hex.dropFirst()) : hex, radix: 16) else { return 1 }
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }

    fileprivate struct Transform {
        var a: Double = 1
        var d: Double = 1
        var tx: Double = 0
        var ty: Double = 0

        func x(_ value: Double) -> Double { value * a + tx }
        func y(_ value: Double) -> Double { value * d + ty }

        /// Maps a group's child coordinate space into this one.
        func group(off: (Double, Double), ext: (Double, Double), chOff: (Double, Double), chExt: (Double, Double)) -> Transform {
            let sx = chExt.0 != 0 ? ext.0 / chExt.0 : 1
            let sy = chExt.1 != 0 ? ext.1 / chExt.1 : 1
            return Transform(a: a * sx, d: d * sy, tx: x(off.0 - chOff.0 * sx), ty: y(off.1 - chOff.1 * sy))
        }
    }

    fileprivate struct Placeholder {
        var type: String
        var idx: String?
    }

    fileprivate struct Frame {
        var x: Double
        var y: Double
        var width: Double
        var height: Double
        var rotation: Double
        var flipH: Bool
        var flipV: Bool
    }

    fileprivate struct Line {
        var text: String
        var level: Int
        var bullet: Bool?
        var size: Double?
        var bold: Bool
        var italic: Bool
        var color: String?
        var align: String?
    }

    fileprivate final class Context {
        typealias Element = OfficeXML.Element

        let files: [String: Data]
        let scale: Double
        let offsetX: Double
        let offsetY: Double
        var media: [String: Data] = [:]
        var skipped = 0

        private var mediaNames: [String: String] = [:]
        private var colors: [String: String] = [:]
        private var layout: Element?
        private var master: Element?
        private var rels: [String: String] = [:]
        private var background = "#FFFFFF"

        init(files: [String: Data], scale: Double, offsetX: Double, offsetY: Double) {
            self.files = files
            self.scale = scale
            self.offsetX = offsetX
            self.offsetY = offsetY
        }

        private func parse(_ path: String?) -> Element? {
            path.flatMap { files[$0] }.flatMap(OfficeXML.parse)
        }

        func readSlide(_ path: String) -> Slide? {
            guard let root = parse(path) else { return nil }
            rels = relationships(files, path)
            let layoutPath = rels.values.sorted().first { $0.contains("slideLayouts/") }
            layout = parse(layoutPath)
            let layoutRels = layoutPath.map { relationships(files, $0) } ?? [:]
            let masterPath = layoutRels.values.sorted().first { $0.contains("slideMasters/") }
            master = parse(masterPath)
            let masterRels = masterPath.map { relationships(files, $0) } ?? [:]
            colors = parse(masterRels.values.sorted().first { $0.contains("theme/") }).map(themeColors) ?? [:]

            background = [root, layout, master].compactMap { $0 }.compactMap { backgroundColor($0) }.first ?? "#FFFFFF"
            var elements: [SlideElement] = []
            // A picture background becomes the lowest element.
            let parts: [(Element?, [String: String])] = [(root, rels), (layout, layoutRels), (master, masterRels)]
            if let (part, partRels) = parts.first(where: { $0.0?.path("cSld", "bg") != nil }),
               let id = part?.path("cSld", "bg", "bgPr", "blipFill", "blip")?.attrNS("embed"),
               let target = partRels[id],
               let name = picture(target) {
                elements.append(SlideElement(kind: .image, x: 0, y: 0, width: SlideSize.width, height: SlideSize.height, image: name))
            }
            if let tree = root.path("cSld", "spTree") { readTree(tree, Transform(), &elements) }

            let notes = parse(rels.values.sorted().first { $0.contains("notesSlides/") }).map(notesText) ?? ""
            return Slide(elements: elements, notes: notes, background: background)
        }

        private func themeColors(_ theme: Element) -> [String: String] {
            guard let scheme = theme.first("clrScheme") else { return [:] }
            var result: [String: String] = [:]
            for entry in scheme.children {
                let color = entry.child("srgbClr")?.attr("val") ?? entry.child("sysClr")?.attr("lastClr") ?? "000000"
                result[entry.localName] = "#" + color.uppercased()
            }
            return result
        }

        private func backgroundColor(_ root: Element) -> String? {
            guard let bg = root.path("cSld", "bg") else { return nil }
            if let fill = bg.path("bgPr", "solidFill"), let value = color(fill) { return value }
            if let ref = bg.child("bgRef"), let value = color(ref) { return value }
            if let stop = bg.path("bgPr", "gradFill", "gsLst")?.children("gs").first, let value = color(stop) { return value }
            return nil
        }

        /// Resolves the color child of a fill-like element, including theme colors and lumMod/lumOff.
        func color(_ parent: Element) -> String? {
            guard let node = parent.children.first(where: { ["srgbClr", "schemeClr", "sysClr", "prstClr"].contains($0.localName) }) else { return nil }
            var hex: String?
            switch node.localName {
            case "srgbClr": hex = node.attr("val").map { "#" + $0.uppercased() }
            case "sysClr": hex = node.attr("lastClr").map { "#" + $0.uppercased() }
            case "prstClr": hex = node.attr("val") == "white" ? "#FFFFFF" : "#000000"
            default:
                let key: String?
                switch node.attr("val") {
                case "tx1": key = "dk1"
                case "bg1": key = "lt1"
                case "tx2": key = "dk2"
                case "bg2": key = "lt2"
                case let value: key = value
                }
                hex = key.flatMap { colors[$0] }
            }
            guard var result = hex else { return nil }
            let lumMod = node.child("lumMod")?.attr("val").flatMap(Double.init).map { $0 / 100_000 }
            let lumOff = node.child("lumOff")?.attr("val").flatMap(Double.init).map { $0 / 100_000 }
            if lumMod != nil || lumOff != nil { result = adjustLuminance(result, lumMod ?? 1, lumOff ?? 0) }
            return result
        }

        private func adjustLuminance(_ hex: String, _ mod: Double, _ off: Double) -> String {
            guard let value = UInt32(hex.dropFirst(), radix: 16) else { return hex }
            let r = Double((value >> 16) & 0xFF) / 255
            let g = Double((value >> 8) & 0xFF) / 255
            let b = Double(value & 0xFF) / 255
            let maxC = max(r, g, b)
            let minC = min(r, g, b)
            var l = (maxC + minC) / 2
            let delta = maxC - minC
            let s = delta == 0 ? 0 : delta / (1 - abs(2 * l - 1))
            var h: Double
            if delta == 0 {
                h = 0
            } else if maxC == r {
                h = 60 * ((g - b) / delta).truncatingRemainder(dividingBy: 6)
            } else if maxC == g {
                h = 60 * ((b - r) / delta + 2)
            } else {
                h = 60 * ((r - g) / delta + 4)
            }
            if h < 0 { h += 360 }
            l = min(max(l * mod + off, 0), 1)
            let c = (1 - abs(2 * l - 1)) * s
            let x = c * (1 - abs((h / 60).truncatingRemainder(dividingBy: 2) - 1))
            let m = l - c / 2
            let (r1, g1, b1): (Double, Double, Double)
            switch h {
            case ..<60: (r1, g1, b1) = (c, x, 0)
            case ..<120: (r1, g1, b1) = (x, c, 0)
            case ..<180: (r1, g1, b1) = (0, c, x)
            case ..<240: (r1, g1, b1) = (0, x, c)
            case ..<300: (r1, g1, b1) = (x, 0, c)
            default: (r1, g1, b1) = (c, 0, x)
            }
            func channel(_ v: Double) -> Int { min(max(Int((v + m) * 255), 0), 255) }
            return String(format: "#%02X%02X%02X", channel(r1), channel(g1), channel(b1))
        }

        private func notesText(_ root: Element) -> String {
            guard let body = root.all("sp").first(where: { $0.first("ph")?.attr("type") == "body" })?.child("txBody") else { return "" }
            return paragraphs(body).map(\.text).joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
        }

        // Shapes

        private func readTree(_ tree: Element, _ transform: Transform, _ out: inout [SlideElement]) {
            for node in tree.children {
                switch node.localName {
                case "sp": readShape(node, transform, &out)
                case "pic": readPicture(node, transform, &out)
                case "cxnSp": readLine(node, transform, &out)
                case "grpSp":
                    let child: Transform
                    if let xfrm = node.path("grpSpPr", "xfrm") {
                        child = transform.group(
                            off: point(xfrm.child("off")), ext: extent(xfrm.child("ext")),
                            chOff: point(xfrm.child("chOff")), chExt: extent(xfrm.child("chExt"))
                        )
                    } else {
                        child = transform
                    }
                    readTree(node, child, &out)
                case "graphicFrame": readFrame(node, transform, &out)
                case "AlternateContent":
                    if let fallback = node.child("Fallback") { readTree(fallback, transform, &out) }
                default: break
                }
            }
        }

        private func number(_ value: String?) -> Double? {
            value.flatMap(Double.init)
        }

        private func point(_ node: Element?) -> (Double, Double) {
            (number(node?.attr("x")) ?? 0, number(node?.attr("y")) ?? 0)
        }

        private func extent(_ node: Element?) -> (Double, Double) {
            (number(node?.attr("cx")) ?? 0, number(node?.attr("cy")) ?? 0)
        }

        /// A frame in slide points from an a:xfrm (or p:xfrm) in EMU.
        private func frame(_ xfrm: Element?, _ transform: Transform) -> Frame? {
            guard let xfrm else { return nil }
            let (ox, oy) = point(xfrm.child("off"))
            let (cx, cy) = extent(xfrm.child("ext"))
            let left = transform.x(ox)
            let top = transform.y(oy)
            let right = transform.x(ox + cx)
            let bottom = transform.y(oy + cy)
            return Frame(
                x: offsetX + left / emuPerPoint * scale,
                y: offsetY + top / emuPerPoint * scale,
                width: (right - left) / emuPerPoint * scale,
                height: (bottom - top) / emuPerPoint * scale,
                rotation: (number(xfrm.attr("rot")) ?? 0) / 60000,
                flipH: xfrm.attr("flipH") == "1",
                flipV: xfrm.attr("flipV") == "1"
            )
        }

        private func placeholder(_ sp: Element) -> Placeholder? {
            guard let ph = sp.path("nvSpPr", "nvPr", "ph") else { return nil }
            return Placeholder(type: ph.attr("type") ?? "body", idx: ph.attr("idx"))
        }

        /// The matching placeholder shape in the layout, then in the master.
        private func inherited(_ ph: Placeholder) -> [Element] {
            func matches(_ candidate: Element, byIndex: Bool) -> Bool {
                guard let other = candidate.path("nvSpPr", "nvPr", "ph") else { return false }
                let type = other.attr("type") ?? "body"
                return byIndex ? (ph.idx != nil && other.attr("idx") == ph.idx) : family(type) == family(ph.type)
            }
            var result: [Element] = []
            if let shapes = layout?.path("cSld", "spTree")?.children("sp"),
               let match = shapes.first(where: { matches($0, byIndex: true) }) ?? shapes.first(where: { matches($0, byIndex: false) }) {
                result.append(match)
            }
            if let match = master?.path("cSld", "spTree")?.children("sp").first(where: { matches($0, byIndex: false) }) {
                result.append(match)
            }
            return result
        }

        private func family(_ type: String) -> String {
            switch type {
            case "title", "ctrTitle": return "title"
            case "body", "subTitle", "obj": return "body"
            default: return type
            }
        }

        private func positiveIndex(_ ref: Element?) -> Element? {
            guard let ref, (Int(ref.attr("idx") ?? "") ?? 0) > 0 else { return nil }
            return ref
        }

        private func readShape(_ sp: Element, _ transform: Transform, _ out: inout [SlideElement]) {
            let ph = placeholder(sp)
            let parents = ph.map(inherited) ?? []
            let own = sp.path("spPr", "xfrm")
            let xfrm = own ?? parents.lazy.compactMap { $0.path("spPr", "xfrm") }.first
            guard let frame = frame(xfrm, own != nil ? transform : Transform()) else { return }
            let geometry = sp.path("spPr", "prstGeom")?.attr("prst")
            if geometry == "line" || geometry?.contains("Connector") == true {
                if let line = lineElement(sp.child("spPr"), sp.child("style"), frame) { out.append(line) }
                return
            }

            let spPr = sp.child("spPr")
            let fill: String?
            if spPr?.child("noFill") != nil {
                fill = nil
            } else if let solid = spPr?.child("solidFill") {
                fill = color(solid)
            } else if spPr?.child("gradFill") != nil {
                fill = spPr?.path("gradFill", "gsLst")?.children("gs").first.flatMap(color)
            } else {
                fill = positiveIndex(sp.path("style", "fillRef")).flatMap(color)
            }
            let ln = spPr?.child("ln")
            let stroke: String?
            if ln?.child("noFill") != nil {
                stroke = nil
            } else if let solid = ln?.child("solidFill") {
                stroke = color(solid)
            } else if ln == nil, sp.child("style") != nil, fill != nil {
                stroke = positiveIndex(sp.path("style", "lnRef")).flatMap(color)
            } else {
                stroke = nil
            }
            let strokeWidth = ((number(ln?.attr("w")).map { $0 / emuPerPoint }) ?? 1) * scale
            if fill != nil || stroke != nil {
                if sp.path("spPr", "custGeom") != nil { skipped += 1 }
                let shape: ShapeType
                switch geometry {
                case "ellipse": shape = .ellipse
                case "roundRect", "round2SameRect", "snipRoundRect": shape = .rounded
                default: shape = .rect
                }
                out.append(SlideElement(
                    kind: .shape, x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotation: frame.rotation,
                    shape: shape, fill: fill ?? "none", stroke: stroke ?? "none", strokeWidth: stroke != nil ? strokeWidth : 0
                ))
            }
            guard let body = sp.child("txBody") else { return }
            let lines = paragraphs(body)
            if lines.allSatisfy({ $0.text.isBlank }) { return }
            let fallbackColor = sp.path("style", "fontRef").flatMap(color)
            out.append(textElement(body, lines, frame, ph, parents, fallbackColor, fill))
        }

        private func paragraphs(_ body: Element) -> [Line] {
            body.children("p").map { p in
                let pPr = p.child("pPr")
                var text = ""
                for node in p.children {
                    switch node.localName {
                    case "r", "fld": text += node.child("t")?.textContent ?? ""
                    case "br": text += " "
                    default: break
                    }
                }
                let runProps = p.children("r").first { !($0.child("t")?.textContent.isBlank ?? true) }?.child("rPr") ?? p.child("endParaRPr")
                let bullet: Bool?
                if pPr?.child("buNone") != nil {
                    bullet = false
                } else if pPr?.child("buChar") != nil || pPr?.child("buAutoNum") != nil {
                    bullet = true
                } else {
                    bullet = nil
                }
                return Line(
                    text: text,
                    level: Int(pPr?.attr("lvl") ?? "") ?? 0,
                    bullet: bullet,
                    size: number(runProps?.attr("sz")).map { $0 / 100 },
                    bold: runProps?.attr("b") == "1",
                    italic: runProps?.attr("i") == "1",
                    color: runProps?.child("solidFill").flatMap(color),
                    align: pPr?.attr("algn")
                )
            }
        }

        private func textElement(
            _ body: Element,
            _ lines: [Line],
            _ frame: Frame,
            _ ph: Placeholder?,
            _ parents: [Element],
            _ fallbackColor: String?,
            _ fill: String?
        ) -> SlideElement {
            let titleLike = ph.map { family($0.type) == "title" } ?? false
            let bodyLike = ph.map { family($0.type) == "body" } ?? false
            let parentBodies = parents.compactMap { $0.child("txBody") }
            let styleName = titleLike ? "titleStyle" : (bodyLike ? "bodyStyle" : "otherStyle")
            // Size: the run, the placeholder's list style, the master's text styles, then a sensible default.
            let inheritedSize = parentBodies.lazy.compactMap { self.number($0.path("lstStyle", "lvl1pPr", "defRPr")?.attr("sz")) }.first.map { $0 / 100 }
                ?? number(master?.path("txStyles", styleName, "lvl1pPr", "defRPr")?.attr("sz")).map { $0 / 100 }
                ?? (titleLike ? 44 : 18)
            let fontScale = number(body.path("bodyPr", "normAutofit")?.attr("fontScale")).map { $0 / 100_000 } ?? 1
            let first = lines.first { !$0.text.isBlank }
            let size = (first?.size ?? inheritedSize) * fontScale * scale
            let masterLevel = master?.path("txStyles", styleName, "lvl1pPr")
            let placeholderLevel = parentBodies.lazy.compactMap { $0.path("lstStyle", "lvl1pPr") }.first
            let inheritedBullets = bodyLike && ph?.type != "subTitle" && placeholderLevel?.child("buNone") == nil
                && (placeholderLevel?.child("buChar") != nil || masterLevel?.child("buChar") != nil)
            let bullets = lines.contains { $0.bullet == true } || (inheritedBullets && !lines.contains { $0.bullet == false })
            let text = lines.map { ($0.level > 0 ? "– " : "") + $0.text }.joined(separator: "\n").trimmingCharacters(in: CharacterSet(charactersIn: "\n"))

            let anchor = body.child("bodyPr")?.attr("anchor") ?? parentBodies.lazy.compactMap { $0.child("bodyPr")?.attr("anchor") }.first
            let align = first?.align ?? parentBodies.lazy.compactMap { $0.path("lstStyle", "lvl1pPr")?.attr("algn") }.first ?? masterLevel?.attr("algn")
            // Text color: the run, the shape style, then whatever reads on the fill or the slide.
            let backdrop = fill ?? background
            let textColor = first?.color ?? fallbackColor ?? (luminance(backdrop) < 0.45 ? colors["lt1"] ?? "#FFFFFF" : colors["dk1"] ?? "#000000")

            let bodyPr = body.child("bodyPr")
            let left = (number(bodyPr?.attr("lIns")) ?? 91440) / emuPerPoint * scale
            let top = (number(bodyPr?.attr("tIns")) ?? 45720) / emuPerPoint * scale
            let right = (number(bodyPr?.attr("rIns")) ?? 91440) / emuPerPoint * scale
            let bottom = (number(bodyPr?.attr("bIns")) ?? 45720) / emuPerPoint * scale
            let noWrap = bodyPr?.attr("wrap") == "none"
            let textAlign: SlideTextAlign = align == "ctr" ? .center : (align == "r" ? .right : .left)
            var element = SlideElement(
                kind: .text,
                x: frame.x + left,
                y: frame.y + top,
                width: max(20, frame.width - left - right + (noWrap ? frame.width : 0)),
                height: max(10, frame.height - top - bottom),
                rotation: frame.rotation,
                text: text,
                fontSize: min(max(size, 6), 160),
                bold: first?.bold ?? false,
                italic: first?.italic ?? false,
                align: textAlign,
                anchor: anchor == "ctr" ? .middle : (anchor == "b" ? .bottom : .top),
                bullets: bullets,
                textColor: textColor
            )
            // Unwrapped text boxes grow around their anchor; keep them where PowerPoint shows them.
            if noWrap, textAlign == .center { element.x -= frame.width / 2 }
            return element
        }

        private func lineElement(_ spPr: Element?, _ style: Element?, _ frame: Frame) -> SlideElement? {
            let ln = spPr?.child("ln")
            if ln?.child("noFill") != nil { return nil }
            let lineColor = ln?.child("solidFill").flatMap(color) ?? style?.child("lnRef").flatMap(color) ?? colors["dk1"] ?? "#000000"
            let width = ((number(ln?.attr("w")).map { $0 / emuPerPoint }) ?? 1) * scale
            let head = ln?.child("headEnd")?.attr("type").flatMap { $0 == "none" ? nil : $0 }
            let tail = ln?.child("tailEnd")?.attr("type").flatMap { $0 == "none" ? nil : $0 }
            // Unrotated endpoints with flips, then the frame's rotation around its center.
            var sx = frame.flipH ? frame.x + frame.width : frame.x
            var sy = frame.flipV ? frame.y + frame.height : frame.y
            var ex = frame.flipH ? frame.x : frame.x + frame.width
            var ey = frame.flipV ? frame.y : frame.y + frame.height
            if frame.rotation != 0 {
                let cx = frame.x + frame.width / 2
                let cy = frame.y + frame.height / 2
                let r = frame.rotation * .pi / 180
                func rotate(_ px: Double, _ py: Double) -> (Double, Double) {
                    let dx = px - cx
                    let dy = py - cy
                    return (cx + dx * cos(r) - dy * sin(r), cy + dx * sin(r) + dy * cos(r))
                }
                (sx, sy) = rotate(sx, sy)
                (ex, ey) = rotate(ex, ey)
            }
            // Our arrows point at the end; an arrow head at the start swaps the ends.
            if head != nil, tail == nil {
                (sx, ex) = (ex, sx)
                (sy, ey) = (ey, sy)
            }
            let length = max(SlideGeometry.minSize, hypot(ex - sx, ey - sy))
            return SlideElement(
                kind: .shape,
                x: (sx + ex) / 2 - length / 2,
                y: (sy + ey) / 2 - 10,
                width: length,
                height: 20,
                rotation: atan2(ey - sy, ex - sx) * 180 / .pi,
                shape: head != nil || tail != nil ? .arrow : .line,
                fill: lineColor,
                strokeWidth: max(width, 1)
            )
        }

        private func readLine(_ node: Element, _ transform: Transform, _ out: inout [SlideElement]) {
            guard let frame = frame(node.path("spPr", "xfrm"), transform),
                  let line = lineElement(node.child("spPr"), node.child("style"), frame) else { return }
            out.append(line)
        }

        private func readPicture(_ node: Element, _ transform: Transform, _ out: inout [SlideElement]) {
            guard let frame = frame(node.path("spPr", "xfrm"), transform),
                  let id = node.path("blipFill", "blip")?.attrNS("embed") else { return }
            guard let name = rels[id].flatMap(picture) else {
                skipped += 1
                return
            }
            out.append(SlideElement(kind: .image, x: frame.x, y: frame.y, width: frame.width, height: frame.height, rotation: frame.rotation, image: name))
        }

        /// Copies a picture out of the package once; formats the apps cannot draw (EMF, SVG) are left out.
        func picture(_ path: String) -> String? {
            if let name = mediaNames[path] { return name }
            let ext = (path as NSString).pathExtension.lowercased()
            guard ["png", "jpg", "jpeg", "gif", "bmp", "webp"].contains(ext), let bytes = files[path] else { return nil }
            let name = "\(UUID().uuidString).\(ext == "jpeg" ? "jpg" : ext)"
            media[name] = bytes
            mediaNames[path] = name
            return name
        }

        private func readFrame(_ node: Element, _ transform: Transform, _ out: inout [SlideElement]) {
            guard let frame = frame(node.child("xfrm"), transform) else { return }
            guard let table = node.first("tbl") else {
                skipped += 1 // charts, SmartArt, embedded objects
                return
            }
            let rows = table.children("tr").map { row in
                row.children("tc").map { cell in
                    (cell.child("txBody").map { paragraphs($0).map(\.text).joined(separator: " ") } ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                }.joined(separator: " | ")
            }
            let size = ((table.first("tc")?.child("txBody").flatMap { paragraphs($0).first?.size }) ?? 18) * scale
            out.append(SlideElement(
                kind: .text, x: frame.x, y: frame.y, width: frame.width, height: frame.height,
                text: rows.joined(separator: "\n"), fontSize: min(max(size, 6), 60),
                textColor: luminance(background) < 0.45 ? "#FFFFFF" : colors["dk1"] ?? "#000000"
            ))
        }
    }
}

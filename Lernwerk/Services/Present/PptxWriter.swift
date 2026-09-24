import Foundation

/// Writes a presentation as a PowerPoint file (Office Open XML). Every element becomes a native shape, text box or
/// picture, so the file stays editable in PowerPoint, Keynote and Google Slides; speaker notes become notes pages.
/// Mirrors PptxWriter.kt in the Android app.
enum PptxWriter {
    static let font = "Work Sans"
    private static let emuPerPoint = 12700.0
    private static let ns = #"xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main""#
    private static let rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    private static let head = #"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>"#

    private struct Relation {
        var id: String
        var type: String
        var target: String
    }

    /// `media` returns the bytes of an image file referenced by an element, or nil if it is missing.
    static func write(_ presentation: Presentation, media: (String) -> Data?) -> Data {
        let theme = presentation.theme
        var files: [(String, Data)] = []
        func add(_ path: String, _ xml: String) { files.append((path, Data(xml.utf8))) }

        var mediaNames: [String: String] = [:]
        var slideXML: [String] = []
        for (index, slide) in presentation.slides.enumerated() {
            let number = index + 1
            var relations = [
                Relation(id: "rId1", type: "\(rel)/slideLayout", target: "../slideLayouts/slideLayout1.xml"),
                Relation(id: "rId2", type: "\(rel)/notesSlide", target: "../notesSlides/notesSlide\(number).xml"),
            ]
            var imageRelations: [String: String] = [:]
            for element in slide.elements where element.kind == .image {
                guard let name = element.image, imageRelations[name] == nil, let bytes = media(name) else { continue }
                let part: String
                if let existing = mediaNames[name] {
                    part = existing
                } else {
                    part = "image\(mediaNames.count + 1).\(isPNG(bytes) ? "png" : "jpeg")"
                    mediaNames[name] = part
                    files.append(("ppt/media/\(part)", bytes))
                }
                let id = "rId\(relations.count + 1)"
                relations.append(Relation(id: id, type: "\(rel)/image", target: "../media/\(part)"))
                imageRelations[name] = id
            }
            add("ppt/slides/_rels/slide\(number).xml.rels", relationships(relations))
            add("ppt/notesSlides/notesSlide\(number).xml", notesSlide(slide.notes))
            add("ppt/notesSlides/_rels/notesSlide\(number).xml.rels", relationships([
                Relation(id: "rId1", type: "\(rel)/notesMaster", target: "../notesMasters/notesMaster1.xml"),
                Relation(id: "rId2", type: "\(rel)/slide", target: "../slides/slide\(number).xml"),
            ]))
            slideXML.append(slideXMLString(slide, theme: theme, images: imageRelations))
        }
        for (index, xml) in slideXML.enumerated() { add("ppt/slides/slide\(index + 1).xml", xml) }

        let count = presentation.slides.count
        add("_rels/.rels", relationships([
            Relation(id: "rId1", type: "\(rel)/officeDocument", target: "ppt/presentation.xml"),
            Relation(id: "rId2", type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties", target: "docProps/core.xml"),
            Relation(id: "rId3", type: "\(rel)/extended-properties", target: "docProps/app.xml"),
        ]))
        add("docProps/core.xml", core(presentation.title))
        add("docProps/app.xml", app(count))
        add("ppt/presentation.xml", presentationXML(count))
        add("ppt/_rels/presentation.xml.rels", relationships([
            Relation(id: "rId1", type: "\(rel)/slideMaster", target: "slideMasters/slideMaster1.xml"),
            Relation(id: "rId2", type: "\(rel)/notesMaster", target: "notesMasters/notesMaster1.xml"),
            Relation(id: "rId3", type: "\(rel)/theme", target: "theme/theme1.xml"),
            Relation(id: "rId4", type: "\(rel)/presProps", target: "presProps.xml"),
            Relation(id: "rId5", type: "\(rel)/viewProps", target: "viewProps.xml"),
            Relation(id: "rId6", type: "\(rel)/tableStyles", target: "tableStyles.xml"),
        ] + (0..<count).map { Relation(id: "rId\($0 + 10)", type: "\(rel)/slide", target: "slides/slide\($0 + 1).xml") }))
        add("ppt/presProps.xml", "\(head)<p:presentationPr \(ns)/>")
        add("ppt/viewProps.xml", "\(head)<p:viewPr \(ns)><p:gridSpacing cx=\"76200\" cy=\"76200\"/></p:viewPr>")
        add("ppt/tableStyles.xml", "\(head)<a:tblStyleLst xmlns:a=\"http://schemas.openxmlformats.org/drawingml/2006/main\" def=\"{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}\"/>")
        add("ppt/slideMasters/slideMaster1.xml", slideMaster(theme))
        add("ppt/slideMasters/_rels/slideMaster1.xml.rels", relationships([
            Relation(id: "rId1", type: "\(rel)/slideLayout", target: "../slideLayouts/slideLayout1.xml"),
            Relation(id: "rId2", type: "\(rel)/theme", target: "../theme/theme1.xml"),
        ]))
        add("ppt/slideLayouts/slideLayout1.xml", slideLayout())
        add("ppt/slideLayouts/_rels/slideLayout1.xml.rels", relationships([
            Relation(id: "rId1", type: "\(rel)/slideMaster", target: "../slideMasters/slideMaster1.xml"),
        ]))
        add("ppt/theme/theme1.xml", themeXML(theme, name: "Lernwerk \(theme.name)"))
        add("ppt/theme/theme2.xml", themeXML(.paper, name: "Lernwerk Notizen"))
        add("ppt/notesMasters/notesMaster1.xml", notesMaster())
        add("ppt/notesMasters/_rels/notesMaster1.xml.rels", relationships([
            Relation(id: "rId1", type: "\(rel)/theme", target: "../theme/theme2.xml"),
        ]))

        // The content types part has to come first for some readers.
        return ZipWriter.archive([("[Content_Types].xml", Data(contentTypes(count).utf8))] + files)
    }

    private static func relationships(_ relations: [Relation]) -> String {
        head + #"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">"#
            + relations.map { #"<Relationship Id="\#($0.id)" Type="\#($0.type)" Target="\#($0.target)"/>"# }.joined()
            + "</Relationships>"
    }

    private static func contentTypes(_ slides: Int) -> String {
        let ml = "application/vnd.openxmlformats-officedocument.presentationml"
        var xml = head + #"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">"#
        xml += #"<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>"#
        xml += #"<Default Extension="xml" ContentType="application/xml"/>"#
        xml += #"<Default Extension="png" ContentType="image/png"/>"#
        xml += #"<Default Extension="jpeg" ContentType="image/jpeg"/>"#
        xml += #"<Override PartName="/ppt/presentation.xml" ContentType="\#(ml).presentation.main+xml"/>"#
        xml += #"<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="\#(ml).slideMaster+xml"/>"#
        xml += #"<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="\#(ml).slideLayout+xml"/>"#
        xml += #"<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="\#(ml).notesMaster+xml"/>"#
        xml += #"<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>"#
        xml += #"<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>"#
        xml += #"<Override PartName="/ppt/presProps.xml" ContentType="\#(ml).presProps+xml"/>"#
        xml += #"<Override PartName="/ppt/viewProps.xml" ContentType="\#(ml).viewProps+xml"/>"#
        xml += #"<Override PartName="/ppt/tableStyles.xml" ContentType="\#(ml).tableStyles+xml"/>"#
        xml += #"<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>"#
        xml += #"<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>"#
        for i in stride(from: 1, through: slides, by: 1) {
            xml += #"<Override PartName="/ppt/slides/slide\#(i).xml" ContentType="\#(ml).slide+xml"/>"#
            xml += #"<Override PartName="/ppt/notesSlides/notesSlide\#(i).xml" ContentType="\#(ml).notesSlide+xml"/>"#
        }
        return xml + "</Types>"
    }

    private static func core(_ title: String) -> String {
        head + #"<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">"#
            + "<dc:title>\(escape(title))</dc:title><dc:creator>Lernwerk</dc:creator></cp:coreProperties>"
    }

    private static func app(_ slides: Int) -> String {
        head + #"<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">"#
            + "<Application>Lernwerk</Application><Slides>\(slides)</Slides></Properties>"
    }

    private static func presentationXML(_ slides: Int) -> String {
        var xml = head + #"<p:presentation \#(ns) saveSubsetFonts="1">"#
        xml += #"<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>"#
        xml += #"<p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst>"#
        if slides > 0 {
            xml += "<p:sldIdLst>"
            for i in 1...slides { xml += #"<p:sldId id="\#(255 + i)" r:id="rId\#(i + 9)"/>"# }
            xml += "</p:sldIdLst>"
        }
        xml += #"<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>"#
        return xml + "</p:presentation>"
    }

    private static let emptyTree = #"<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>"#
    private static let colorMap = #"<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>"#

    private static func slideMaster(_ theme: SlideTheme) -> String {
        head + "<p:sldMaster \(ns)><p:cSld><p:bg><p:bgPr>\(solid(theme.background))<a:effectLst/></p:bgPr></p:bg>"
            + "<p:spTree>\(emptyTree)</p:spTree></p:cSld>\(colorMap)"
            + #"<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>"#
            + "<p:txStyles>"
            + #"<p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"><a:latin typeface="\#(font)"/></a:defRPr></a:lvl1pPr></p:titleStyle>"#
            + #"<p:bodyStyle><a:lvl1pPr><a:defRPr sz="2400"><a:latin typeface="\#(font)"/></a:defRPr></a:lvl1pPr></p:bodyStyle>"#
            + #"<p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"><a:latin typeface="\#(font)"/></a:defRPr></a:lvl1pPr></p:otherStyle>"#
            + "</p:txStyles></p:sldMaster>"
    }

    private static func slideLayout() -> String {
        head + #"<p:sldLayout \#(ns) type="blank" preserve="1"><p:cSld name="Leer"><p:spTree>\#(emptyTree)</p:spTree></p:cSld>"#
            + "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>"
    }

    private static func notesMaster() -> String {
        head + "<p:notesMaster \(ns)><p:cSld><p:spTree>\(emptyTree)</p:spTree></p:cSld>\(colorMap)</p:notesMaster>"
    }

    private static func notesSlide(_ notes: String) -> String {
        var xml = head + "<p:notes \(ns)><p:cSld><p:spTree>\(emptyTree)"
        xml += #"<p:sp><p:nvSpPr><p:cNvPr id="2" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>"#
        xml += #"<p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>"#
        xml += #"<p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm></p:spPr>"#
        xml += "<p:txBody><a:bodyPr/><a:lstStyle/>"
        for line in lines(notes.trimmingCharacters(in: .whitespacesAndNewlines)) {
            if line.isBlank {
                xml += #"<a:p><a:endParaRPr lang="de-DE"/></a:p>"#
            } else {
                xml += #"<a:p><a:r><a:rPr lang="de-DE" dirty="0"/><a:t>\#(escape(line))</a:t></a:r></a:p>"#
            }
        }
        return xml + "</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>"
    }

    private static func slideXMLString(_ slide: Slide, theme: SlideTheme, images: [String: String]) -> String {
        var xml = head + "<p:sld \(ns)><p:cSld><p:bg><p:bgPr>\(solid(theme.background))<a:effectLst/></p:bgPr></p:bg><p:spTree>\(emptyTree)"
        for (index, element) in slide.elements.enumerated() {
            let id = index + 2
            switch element.kind {
            case .text: xml += textBox(element, id: id, theme: theme)
            case .shape: xml += shape(element, id: id, theme: theme)
            case .image:
                if let name = element.image, let relation = images[name] { xml += picture(element, id: id, relation: relation) }
            }
        }
        return xml + "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>"
    }

    /// Lines as Kotlin's lines(): an empty string is one empty line.
    private static func lines(_ text: String) -> [String] {
        text.components(separatedBy: "\n")
    }

    private static func emu(_ points: Double) -> Int64 { Int64((points * emuPerPoint).rounded()) }

    private static func rotation(_ degrees: Double) -> String {
        let normalized = (degrees.truncatingRemainder(dividingBy: 360) + 360).truncatingRemainder(dividingBy: 360)
        let value = Int64((normalized * 60000).rounded())
        return value == 0 ? "" : " rot=\"\(value)\""
    }

    private static func xfrm(_ x: Double, _ y: Double, _ width: Double, _ height: Double, _ rotation: Double) -> String {
        #"<a:xfrm\#(self.rotation(rotation))><a:off x="\#(emu(x))" y="\#(emu(y))"/><a:ext cx="\#(emu(width))" cy="\#(emu(height))"/></a:xfrm>"#
    }

    private static func hexColor(_ rgb: UInt32) -> String { String(format: "%06X", rgb & 0xFFFFFF) }

    private static func solid(_ rgb: UInt32) -> String { #"<a:solidFill><a:srgbClr val="\#(hexColor(rgb))"/></a:solidFill>"# }

    private static func textBox(_ element: SlideElement, id: Int, theme: SlideTheme) -> String {
        let color = theme.color(element.textColor) ?? theme.text
        let anchor = element.anchor == .top ? "t" : (element.anchor == .middle ? "ctr" : "b")
        let align = element.align == .left ? "l" : (element.align == .center ? "ctr" : "r")
        let size = Int64((element.fontSize * 100).rounded())
        let indent = emu(element.fontSize * 1.1)
        var xml = #"<p:sp><p:nvSpPr><p:cNvPr id="\#(id)" name="Text \#(id)"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>"#
        xml += "<p:spPr>\(xfrm(element.x, element.y, element.width, element.height, element.rotation))"
        xml += #"<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>"#
        xml += #"<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="\#(anchor)"><a:noAutofit/></a:bodyPr><a:lstStyle/>"#
        var runProps = #"<a:rPr lang="de-DE" sz="\#(size)""#
        if element.bold { runProps += #" b="1""# }
        if element.italic { runProps += #" i="1""# }
        runProps += #" dirty="0">\#(solid(color))<a:latin typeface="\#(font)"/></a:rPr>"#
        for line in lines(element.text) {
            xml += "<a:p>"
            if element.bullets, !line.isBlank {
                xml += #"<a:pPr marL="\#(indent)" indent="-\#(indent)" algn="\#(align)"><a:buClr><a:srgbClr val="\#(hexColor(theme.accent))"/></a:buClr>"#
                xml += #"<a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>"#
            } else {
                xml += #"<a:pPr algn="\#(align)"><a:buNone/></a:pPr>"#
            }
            if line.isEmpty {
                xml += #"<a:endParaRPr lang="de-DE" sz="\#(size)"/>"#
            } else {
                xml += "<a:r>\(runProps)<a:t>\(escape(line))</a:t></a:r>"
            }
            xml += "</a:p>"
        }
        return xml + "</p:txBody></p:sp>"
    }

    private static func shape(_ element: SlideElement, id: Int, theme: SlideTheme) -> String {
        if element.isLine {
            let color = theme.color(element.fill) ?? theme.text
            let width = emu(max(element.strokeWidth, 3))
            let tail = element.shape == .arrow ? #"<a:tailEnd type="triangle" w="med" len="med"/>"# : ""
            return #"<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="\#(id)" name="Linie \#(id)"/><p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>"#
                + "<p:spPr>\(xfrm(element.x, element.centerY, element.width, 0, element.rotation))"
                + #"<a:prstGeom prst="line"><a:avLst/></a:prstGeom><a:ln w="\#(width)">\#(solid(color))\#(tail)</a:ln></p:spPr></p:cxnSp>"#
        }
        let geometry = element.shape == .rounded ? "roundRect" : (element.shape == .ellipse ? "ellipse" : "rect")
        let fill = theme.color(element.fill).map(solid) ?? "<a:noFill/>"
        let line: String
        if let stroke = theme.color(element.stroke), element.strokeWidth > 0 {
            line = #"<a:ln w="\#(emu(element.strokeWidth))">\#(solid(stroke))</a:ln>"#
        } else {
            line = "<a:ln><a:noFill/></a:ln>"
        }
        return #"<p:sp><p:nvSpPr><p:cNvPr id="\#(id)" name="Form \#(id)"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>"#
            + "<p:spPr>\(xfrm(element.x, element.y, element.width, element.height, element.rotation))"
            + #"<a:prstGeom prst="\#(geometry)"><a:avLst/></a:prstGeom>\#(fill)\#(line)</p:spPr></p:sp>"#
    }

    private static func picture(_ element: SlideElement, id: Int, relation: String) -> String {
        #"<p:pic><p:nvPicPr><p:cNvPr id="\#(id)" name="Bild \#(id)"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>"#
            + #"<p:blipFill><a:blip r:embed="\#(relation)"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>"#
            + "<p:spPr>\(xfrm(element.x, element.y, element.width, element.height, element.rotation))"
            + #"<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>"#
    }

    private static func themeXML(_ theme: SlideTheme, name: String) -> String {
        func srgb(_ tag: String, _ rgb: UInt32) -> String { "<a:\(tag)><a:srgbClr val=\"\(hexColor(rgb))\"/></a:\(tag)>" }
        let fillStyle = #"<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>"#
        let lineStyle = #"<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>"#
        return head
            + #"<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="\#(escape(name))"><a:themeElements>"#
            + #"<a:clrScheme name="\#(escape(name))">"#
            + srgb("dk1", theme.text) + srgb("lt1", theme.background) + srgb("dk2", theme.muted) + srgb("lt2", theme.surface)
            + srgb("accent1", theme.accent) + srgb("accent2", 0xC9974F) + srgb("accent3", 0x3D6FB6) + srgb("accent4", 0xC46A55)
            + srgb("accent5", 0x6F8FB0) + srgb("accent6", 0x9A968B) + srgb("hlink", 0x4F7A63) + srgb("folHlink", 0x6E6B62)
            + "</a:clrScheme>"
            + #"<a:fontScheme name="Lernwerk"><a:majorFont><a:latin typeface="\#(font)"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>"#
            + #"<a:minorFont><a:latin typeface="\#(font)"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>"#
            + #"<a:fmtScheme name="Lernwerk">"#
            + "<a:fillStyleLst>\(fillStyle)\(fillStyle)\(fillStyle)</a:fillStyleLst>"
            + "<a:lnStyleLst>\(lineStyle)\(lineStyle)\(lineStyle)</a:lnStyleLst>"
            + "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle>"
            + "<a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>"
            + "<a:bgFillStyleLst>\(fillStyle)\(fillStyle)\(fillStyle)</a:bgFillStyleLst>"
            + "</a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"
    }

    private static func isPNG(_ data: Data) -> Bool {
        data.count > 4 && data[data.startIndex] == 0x89 && data[data.startIndex + 1] == 0x50
    }

    /// XML text escaping; control characters other than tab are not allowed in XML 1.0.
    static func escape(_ text: String) -> String {
        var result = ""
        result.reserveCapacity(text.count)
        for scalar in text.unicodeScalars {
            switch scalar {
            case "&": result += "&amp;"
            case "<": result += "&lt;"
            case ">": result += "&gt;"
            case "\"": result += "&quot;"
            default:
                if scalar.value < 0x20, scalar != "\t" { continue }
                result.unicodeScalars.append(scalar)
            }
        }
        return result
    }
}

/// A minimal ZIP writer (stored entries, no compression); iOS has no public API for creating archives.
enum ZipWriter {
    static func archive(_ entries: [(String, Data)]) -> Data {
        var output = Data()
        var central = Data()
        for (name, data) in entries {
            let nameBytes = Data(name.utf8)
            let crc = CRC32.checksum(data)
            let offset = UInt32(output.count)
            // Local file header
            output.append(uint32: 0x0403_4B50)
            output.append(uint16: 20) // version needed
            output.append(uint16: 0x0800) // UTF-8 names
            output.append(uint16: 0) // stored
            output.append(uint16: 0) // time
            output.append(uint16: 0x21) // date: 1980-01-01
            output.append(uint32: crc)
            output.append(uint32: UInt32(data.count))
            output.append(uint32: UInt32(data.count))
            output.append(uint16: UInt16(nameBytes.count))
            output.append(uint16: 0)
            output.append(nameBytes)
            output.append(data)
            // Central directory entry
            central.append(uint32: 0x0201_4B50)
            central.append(uint16: 20)
            central.append(uint16: 20)
            central.append(uint16: 0x0800)
            central.append(uint16: 0)
            central.append(uint16: 0)
            central.append(uint16: 0x21)
            central.append(uint32: crc)
            central.append(uint32: UInt32(data.count))
            central.append(uint32: UInt32(data.count))
            central.append(uint16: UInt16(nameBytes.count))
            central.append(uint16: 0) // extra
            central.append(uint16: 0) // comment
            central.append(uint16: 0) // disk
            central.append(uint16: 0) // internal attributes
            central.append(uint32: 0) // external attributes
            central.append(uint32: offset)
            central.append(nameBytes)
        }
        let centralOffset = UInt32(output.count)
        output.append(central)
        output.append(uint32: 0x0605_4B50)
        output.append(uint16: 0)
        output.append(uint16: 0)
        output.append(uint16: UInt16(entries.count))
        output.append(uint16: UInt16(entries.count))
        output.append(uint32: UInt32(central.count))
        output.append(uint32: centralOffset)
        output.append(uint16: 0)
        return output
    }
}

enum CRC32 {
    private static let table: [UInt32] = (0..<256).map { index in
        var value = UInt32(index)
        for _ in 0..<8 { value = value & 1 == 1 ? 0xEDB8_8320 ^ (value >> 1) : value >> 1 }
        return value
    }

    static func checksum(_ data: Data) -> UInt32 {
        var crc: UInt32 = 0xFFFF_FFFF
        for byte in data { crc = table[Int((crc ^ UInt32(byte)) & 0xFF)] ^ (crc >> 8) }
        return crc ^ 0xFFFF_FFFF
    }
}

private extension Data {
    mutating func append(uint16 value: UInt16) {
        append(UInt8(value & 0xFF))
        append(UInt8(value >> 8))
    }

    mutating func append(uint32 value: UInt32) {
        append(uint16: UInt16(value & 0xFFFF))
        append(uint16: UInt16(value >> 16))
    }
}

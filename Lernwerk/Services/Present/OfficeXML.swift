import Foundation
#if canImport(FoundationXML)
import FoundationXML
#endif

/// A small XML tree for reading Office files, looked up by local name so namespace prefixes do not matter.
enum OfficeXML {
    final class Element {
        let name: String
        let localName: String
        let attributes: [String: String]
        private(set) var children: [Element] = []
        fileprivate(set) weak var parent: Element?
        fileprivate var text = ""

        init(name: String, attributes: [String: String]) {
            self.name = name
            self.localName = name.split(separator: ":").last.map(String.init) ?? name
            self.attributes = attributes
        }

        fileprivate func append(_ child: Element) {
            child.parent = self
            children.append(child)
        }

        func children(_ name: String) -> [Element] {
            children.filter { $0.localName == name }
        }

        func child(_ name: String) -> Element? {
            children.first { $0.localName == name }
        }

        func path(_ names: String...) -> Element? {
            var current: Element? = self
            for name in names { current = current?.child(name) }
            return current
        }

        /// This element or its first descendant with the name, in document order.
        func first(_ name: String) -> Element? {
            if localName == name { return self }
            for child in children {
                if let found = child.first(name) { return found }
            }
            return nil
        }

        /// All descendants with the name, in document order.
        func all(_ name: String) -> [Element] {
            var result: [Element] = []
            func visit(_ element: Element) {
                for child in element.children {
                    if child.localName == name { result.append(child) }
                    visit(child)
                }
            }
            visit(self)
            return result
        }

        /// An attribute without a namespace prefix.
        func attr(_ name: String) -> String? {
            attributes[name]
        }

        /// An attribute in the relationships namespace, like r:id or r:embed.
        func attrNS(_ name: String) -> String? {
            for (key, value) in attributes {
                let parts = key.split(separator: ":", maxSplits: 1)
                if parts.count == 2, parts[1] == name, namespace(of: String(parts[0]))?.contains("relationships") == true { return value }
            }
            return attr(name)
        }

        private func namespace(of prefix: String) -> String? {
            var element: Element? = self
            while let current = element {
                if let uri = current.attributes["xmlns:\(prefix)"] { return uri }
                element = current.parent
            }
            return nil
        }

        /// All text inside the element.
        var textContent: String {
            text + children.map(\.textContent).joined()
        }
    }

    /// Relationship ids of a part mapped to resolved package paths, e.g. `word/document.xml` to its
    /// `word/_rels/document.xml.rels`. Shared by every Office file reader.
    static func relationships(_ files: [String: Data], part: String) -> [String: String] {
        let folder = part.contains("/") ? String(part[part.startIndex..<part.range(of: "/", options: .backwards)!.lowerBound]) : ""
        let name = part.contains("/") ? String(part[part.range(of: "/", options: .backwards)!.upperBound...]) : part
        let relsPath = (folder.isEmpty ? "" : folder + "/") + "_rels/\(name).rels"
        guard let data = files[relsPath], let root = parse(data) else { return [:] }
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
        for piece in target.split(separator: "/") {
            switch piece {
            case "..": if !parts.isEmpty { parts.removeLast() }
            case ".", "": break
            default: parts.append(String(piece))
            }
        }
        return parts.joined(separator: "/")
    }

    /// Parses a document; returns its root element, or nil for anything that is not well-formed XML.
    static func parse(_ data: Data) -> Element? {
        let delegate = Builder()
        let parser = XMLParser(data: data)
        // Office files never need external entities; refusing them keeps the parser safe.
        parser.shouldResolveExternalEntities = false
        parser.shouldProcessNamespaces = false
        parser.delegate = delegate
        guard parser.parse(), delegate.failed == false else { return nil }
        return delegate.root
    }

    private final class Builder: NSObject, XMLParserDelegate {
        var root: Element?
        var stack: [Element] = []
        var failed = false

        func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String] = [:]) {
            let element = Element(name: qualifiedName ?? elementName, attributes: attributes)
            if let parent = stack.last { parent.append(element) } else { root = element }
            stack.append(element)
        }

        func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?, qualifiedName: String?) {
            _ = stack.popLast()
        }

        func parser(_ parser: XMLParser, foundCharacters string: String) {
            // Only leaf elements such as a:t carry text in Office files; mixed content is not needed.
            stack.last?.text += string
        }

        func parser(_ parser: XMLParser, foundIgnorableWhitespace whitespaceString: String) {}

        func parser(_ parser: XMLParser, resolveExternalEntityName name: String, systemID: String?) -> Data? {
            failed = true
            return nil
        }
    }
}

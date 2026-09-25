package de.maxifrz.lernwerk.present

import org.w3c.dom.Element
import java.io.ByteArrayInputStream
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory

/** Reading Office Open XML files (.pptx, .docx): the ZIP container and a namespace-agnostic XML tree, shared by
 * every reader in this package. */
object OfficeXml {
    fun unzip(bytes: ByteArray): Map<String, ByteArray> {
        val files = mutableMapOf<String, ByteArray>()
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (!entry.isDirectory) files[entry.name.trimStart('/')] = zip.readBytes()
            }
        }
        return files
    }

    fun parse(bytes: ByteArray): Element? = runCatching {
        val factory = DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
            // Office files never need external entities; refusing them keeps the parser safe.
            setFeature("http://apache.org/xml/features/disallow-doctype-decl", true)
        }
        factory.newDocumentBuilder().parse(ByteArrayInputStream(bytes)).documentElement
    }.getOrNull()

    /** Relationship ids of a part mapped to resolved package paths. */
    fun relationships(files: Map<String, ByteArray>, part: String): Map<String, String> {
        val folder = part.substringBeforeLast('/', "")
        val relsPath = "$folder/_rels/${part.substringAfterLast('/')}.rels".trimStart('/')
        val root = files[relsPath]?.let(::parse) ?: return emptyMap()
        return root.all("Relationship").associate { rel ->
            val target = rel.attr("Target").orEmpty()
            rel.attr("Id").orEmpty() to if (rel.attr("TargetMode") == "External") "" else resolve(folder, target)
        }
    }

    private fun resolve(folder: String, target: String): String {
        if (target.startsWith("/")) return target.trimStart('/')
        val parts = if (folder.isEmpty()) mutableListOf() else folder.split('/').toMutableList()
        for (piece in target.split('/')) {
            when (piece) {
                ".." -> if (parts.isNotEmpty()) parts.removeAt(parts.lastIndex)
                ".", "" -> Unit
                else -> parts += piece
            }
        }
        return parts.joinToString("/")
    }

    // XML helpers (namespace-agnostic by local name)

    fun Element.children(name: String? = null): List<Element> {
        val result = mutableListOf<Element>()
        var node = firstChild
        while (node != null) {
            if (node is Element && (name == null || node.localName == name)) result += node
            node = node.nextSibling
        }
        return result
    }

    fun Element.child(name: String): Element? = children(name).firstOrNull()

    fun Element.path(vararg names: String): Element? {
        var current: Element? = this
        for (name in names) current = current?.child(name)
        return current
    }

    fun Element.first(name: String): Element? {
        if (localName == name) return this
        val list = getElementsByTagNameNS("*", name)
        return if (list.length > 0) list.item(0) as Element else null
    }

    fun Element.all(name: String): List<Element> {
        val list = getElementsByTagNameNS("*", name)
        return (0 until list.length).map { list.item(it) as Element }
    }

    fun Element.attr(name: String): String? = if (hasAttribute(name)) getAttribute(name) else null

    /** An attribute in the relationships namespace, like r:id or r:embed. */
    fun Element.attrNs(name: String): String? {
        val attributes = attributes
        for (i in 0 until attributes.length) {
            val attribute = attributes.item(i)
            if (attribute.localName == name && attribute.namespaceURI?.contains("relationships") == true) return attribute.nodeValue
        }
        return attr(name)
    }
}

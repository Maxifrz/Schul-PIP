package de.maxifrz.lernwerk.llm

import java.net.URI

/**
 * The student's own OpenAI-compatible API: a server of their own (Ollama, LM Studio, vLLM, a school server) or any
 * provider the app does not know. Only the address is needed; the key is optional.
 */
object CustomEndpoint {
    sealed interface Check {
        data object Empty : Check
        data object Invalid : Check

        /** Plain http is only for servers in the local network. */
        data object InsecureRemote : Check
        data class Valid(val url: String) : Check
    }

    /**
     * "https://host/v1", "https://host/v1/", "https://host" and the full ".../chat/completions" all lead to the chat
     * completions endpoint. An address without a path gets "/v1", the path almost every such server uses.
     */
    fun check(text: String): Check {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return Check.Empty
        val uri = runCatching { URI(trimmed) }.getOrNull() ?: return Check.Invalid
        val scheme = uri.scheme?.lowercase()
        val host = uri.host
        if ((scheme != "http" && scheme != "https") || host.isNullOrEmpty()) return Check.Invalid
        var path = (uri.rawPath ?: "").trimEnd('/')
        path = when {
            path.lowercase().endsWith("/chat/completions") -> path
            path.isEmpty() -> "/v1/chat/completions"
            else -> "$path/chat/completions"
        }
        val port = if (uri.port != -1) ":${uri.port}" else ""
        val url = "$scheme://$host$port$path"
        return if (scheme == "http" && !isLocal(host)) Check.InsecureRemote else Check.Valid(url)
    }

    /** This device, `.local` names, names without a dot and private address ranges. */
    fun isLocal(host: String): Boolean {
        val lower = host.lowercase()
        if (lower == "localhost" || lower == "[::1]" || lower.endsWith(".local") || !lower.contains('.')) return true
        val octets = lower.split('.').map { it.toIntOrNull() }
        if (octets.size != 4 || octets.any { it == null || it !in 0..255 }) return false
        val a = octets[0]!!
        val b = octets[1]!!
        return a == 10 || a == 127 || (a == 192 && b == 168) || (a == 169 && b == 254) || (a == 172 && b in 16..31)
    }

    fun message(check: Check): String? = when (check) {
        Check.Empty -> "Trag die Adresse der API ein, z. B. https://mein-server.de/v1."
        Check.Invalid -> "Das ist keine gültige Adresse. Sie beginnt mit https:// (oder http:// im lokalen Netz)."
        Check.InsecureRemote -> "http:// funktioniert nur im lokalen Netz. Nimm für andere Server https://."
        is Check.Valid -> null
    }
}

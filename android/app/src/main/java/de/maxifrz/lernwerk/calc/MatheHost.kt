package de.maxifrz.lernwerk.calc

import android.annotation.SuppressLint
import android.content.Context
import android.content.MutableContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebView
import android.webkit.WebViewClient
import de.maxifrz.lernwerk.ui.shareFile
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.net.URLDecoder
import java.net.URLEncoder

/**
 * The calculator app (`cas/web/mathe.html`, built from `cas/app`) in one web view that lives as long as the app, so
 * Giac loads once. The page talks to the app through `MatheBridge.post(json)`: a key–value store for projects in
 * files/Rechner, the share sheet for exports, graphics into documents, and it is told the colour scheme.
 */
class MatheHost private constructor(private val context: Context) {
    private val main = Handler(Looper.getMainLooper())
    private var theme = "light"
    private var ready = false
    private var view: WebView? = null

    /** Set by the calculator screen: asks for a document and puts the picture in; `answer` tells the page how it went. */
    var onInsertImage: ((picture: Bitmap, answer: (String?) -> Unit) -> Unit)? = null

    private val wrapper = MutableContextWrapper(context)

    /**
     * The web view, detached from any earlier parent so the calculator tab can show it again. It runs in the
     * showing activity's context (share sheet, dialogs) and falls back to the application's when that goes away.
     */
    fun webView(activity: Context): WebView {
        wrapper.baseContext = activity
        val existing = view ?: create().also { view = it }
        (existing.parent as? ViewGroup)?.removeView(existing)
        return existing
    }

    fun release() {
        wrapper.baseContext = context
    }

    fun setTheme(dark: Boolean) {
        theme = if (dark) "dark" else "light"
        if (ready) view?.evaluateJavascript("window.Mathe && window.Mathe.setTheme('$theme')", null)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun create(): WebView {
        val web = WebView(wrapper)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.setBackgroundColor(Color.TRANSPARENT)
        web.addJavascriptInterface(Bridge(), "MatheBridge")
        web.webViewClient = object : WebViewClient() {
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // Android ends the renderer when memory runs short; the next visit to the tab loads the page again.
                ready = false
                (view.parent as? ViewGroup)?.removeView(view)
                view.destroy()
                if (this@MatheHost.view === view) this@MatheHost.view = null
                return true
            }
        }
        web.loadUrl("file:///android_asset/mathe.html")
        return web
    }

    private inner class Bridge {
        @JavascriptInterface
        fun post(message: String) {
            val body = runCatching { Json.parseToJsonElement(message) as JsonObject }.getOrNull() ?: return
            main.post { handle(body) }
        }
    }

    private fun JsonObject.string(key: String) = (this[key] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: ""

    private fun handle(body: JsonObject) {
        val id = (body["id"] as? JsonPrimitive)?.intOrNull
        when (body.string("type")) {
            "ready" -> {
                ready = true
                setTheme(theme == "dark")
            }
            "store.get" -> reply(id, file(body.string("key")).takeIf { it.exists() }?.let { runCatching { it.readText() }.getOrNull() }?.let(::JsonPrimitive) ?: JsonNull)
            "store.set" -> {
                runCatching { file(body.string("key")).writeText(body.string("value")) }
                reply(id, JsonPrimitive(true))
            }
            "store.delete" -> {
                file(body.string("key")).delete()
                reply(id, JsonPrimitive(true))
            }
            "store.list" -> reply(id, JsonArray(keys(body.string("prefix")).map(::JsonPrimitive)))
            "share" -> {
                share(body)
                reply(id, JsonPrimitive(true))
            }
            "insertImage" -> {
                val bytes = runCatching { Base64.decode(body.string("png"), Base64.DEFAULT) }.getOrNull()
                val picture = bytes?.let { BitmapFactory.decodeByteArray(it, 0, it.size) }
                val insert = onInsertImage
                if (picture == null || insert == null) reply(id, JsonNull)
                else insert(picture) { message -> main.post { reply(id, message?.let(::JsonPrimitive) ?: JsonNull) } }
            }
            else -> reply(id, JsonNull)
        }
    }

    private fun reply(id: Int?, value: JsonElement) {
        if (id == null) return
        view?.evaluateJavascript("window.Mathe && window.Mathe.reply($id, $value)", null)
    }

    // Storage: one file per key in files/Rechner

    private val folder: File
        get() = File(context.filesDir, "Rechner").apply { mkdirs() }

    private fun file(key: String) = File(folder, URLEncoder.encode(key, "UTF-8") + ".json")

    private fun keys(prefix: String): List<String> =
        (folder.list() ?: emptyArray())
            .filter { it.endsWith(".json") }
            .map { URLDecoder.decode(it.removeSuffix(".json"), "UTF-8") }
            .filter { it.startsWith(prefix) }

    private fun share(body: JsonObject) {
        val name = body.string("name").ifBlank { "Rechnung.txt" }.replace('/', '-')
        val text = body.string("data")
        val base64 = (body["base64"] as? JsonPrimitive)?.booleanOrNull ?: false
        val bytes = if (base64) runCatching { Base64.decode(text, Base64.DEFAULT) }.getOrDefault(ByteArray(0)) else text.toByteArray()
        val folder = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(folder, name)
        if (runCatching { file.writeBytes(bytes) }.isFailure) return
        val mime = body.string("mime").ifBlank { "text/plain" }
        runCatching { shareFile(wrapper.baseContext, file, mime) }
    }

    companion object {
        @SuppressLint("StaticFieldLeak")
        private var shared: MatheHost? = null

        fun get(context: Context): MatheHost = shared ?: MatheHost(context.applicationContext).also { shared = it }
    }
}

package de.maxifrz.lernwerk.calc

import android.annotation.SuppressLint
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.webkit.JavascriptInterface
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlin.coroutines.resume

/**
 * Runs Giac, compiled to WebAssembly, in a hidden WebView and hands it the calculator's work. There is one engine for
 * the app: the calculator and the notes share its variables. Everything that touches the WebView runs on the main
 * thread.
 */
class CasEngine private constructor(private val context: Context) {
    sealed interface State {
        data object Idle : State
        data object Loading : State
        data object Ready : State
        data class Failed(val reason: String) : State
    }

    class Unavailable(reason: String) : Exception(reason)

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state
    private val main = Handler(Looper.getMainLooper())
    private val json = Json { ignoreUnknownKeys = true }
    private var webView: WebView? = null
    private val waiting = mutableListOf<CompletableDeferred<Unit>>()
    /** Inputs that define variables and functions, made again whenever the engine starts. */
    private val definitions = mutableListOf<Pair<String, String>>()
    private var degrees = false
    private val timeout = Runnable { if (_state.value == State.Loading) fail("Der Rechenkern ist nicht rechtzeitig gestartet.") }

    /** Starts loading Giac in the background, so it is ready by the time something needs it. */
    fun warmUp() {
        main.post { if (_state.value == State.Idle) start() }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun start() {
        _state.value = State.Loading
        val view = WebView(context)
        view.settings.javaScriptEnabled = true
        view.addJavascriptInterface(Bridge(), "CasBridge")
        view.webViewClient = object : WebViewClient() {
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                // Android ends the renderer when memory runs short; the next calculation starts Giac again.
                if (_state.value == State.Loading) fail("Der Rechenkern ist beim Laden abgestürzt.") else discard(State.Idle)
                return true
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) fail("Der Rechenkern ließ sich nicht laden.")
            }
        }
        view.loadUrl("file:///android_asset/cas.html")
        webView = view
        main.postDelayed(timeout, 45_000)
    }

    private inner class Bridge {
        @JavascriptInterface
        fun ready() {
            main.post { if (_state.value == State.Loading) onReady() }
        }
    }

    private fun onReady() {
        main.removeCallbacks(timeout)
        val view = webView ?: return
        val script = buildString {
            if (degrees) append("CAS.setDegrees(true);")
            definitions.forEach { (_, input) -> append("CAS.evaluateJSON(").append(quote(input)).append(");") }
            append("'ok'")
        }
        view.evaluateJavascript(script) {
            _state.value = State.Ready
            val deferreds = waiting.toList()
            waiting.clear()
            deferreds.forEach { it.complete(Unit) }
        }
    }

    private fun discard(next: State) {
        webView?.destroy()
        webView = null
        _state.value = next
    }

    private fun fail(reason: String) {
        main.removeCallbacks(timeout)
        discard(State.Failed(reason))
        val deferreds = waiting.toList()
        waiting.clear()
        deferreds.forEach { it.completeExceptionally(Unavailable(reason)) }
    }

    private suspend fun ready() = withContext(Dispatchers.Main) {
        when (_state.value) {
            State.Ready -> return@withContext
            State.Idle, is State.Failed -> start()
            State.Loading -> Unit
        }
        (_state.value as? State.Failed)?.let { throw Unavailable(it.reason) }
        val deferred = CompletableDeferred<Unit>()
        waiting += deferred
        deferred.await()
    }

    private fun quote(text: String) = json.encodeToString(String.serializer(), text)

    /** Runs a script that ends in a string and returns that string. */
    private suspend fun call(script: String): String = withContext(Dispatchers.Main) {
        val view = webView ?: throw Unavailable("Der Rechenkern läuft nicht.")
        val raw = suspendCancellableCoroutine { continuation ->
            view.evaluateJavascript(script) { continuation.resume(it) }
        }
        // evaluateJavascript hands back the value as JSON: a string arrives quoted.
        if (raw == null || raw == "null") throw Unavailable("Der Rechenkern hat nicht geantwortet.")
        json.decodeFromString(String.serializer(), raw)
    }

    suspend fun evaluate(input: String): CasAnswer {
        ready()
        val answer = json.decodeFromString(CasAnswer.serializer(), call("CAS.evaluateJSON(${quote(input)})"))
        val name = answer.assigns
        if (answer.ok && name != null) {
            withContext(Dispatchers.Main) {
                definitions.removeAll { it.first == name }
                definitions += name to input
            }
        }
        return answer
    }

    suspend fun plot(expressions: List<String>, xmin: Double, xmax: Double, samples: Int = 401): CasPlot {
        ready()
        val list = json.encodeToString(ListSerializer(String.serializer()), expressions)
        return json.decodeFromString(CasPlot.serializer(), call("CAS.plotJSON(${quote(list)}, $xmin, $xmax, $samples)"))
    }

    suspend fun setDegrees(value: Boolean) {
        withContext(Dispatchers.Main) { degrees = value }
        if (_state.value == State.Ready) runCatching { call("CAS.setDegrees($value); 'ok'") }
    }

    /** The definitions and angle unit saved from earlier, made again before the first calculation. */
    fun restore(saved: List<CalculatorHistory.Definition>, degrees: Boolean) {
        main.post {
            definitions.clear()
            definitions += saved.map { it.name to it.input }
            this.degrees = degrees
        }
    }

    suspend fun forget(names: List<String>) {
        withContext(Dispatchers.Main) { definitions.removeAll { it.first in names } }
        if (_state.value == State.Ready) {
            val list = json.encodeToString(ListSerializer(String.serializer()), names)
            runCatching { call("CAS.forget(JSON.parse(${quote(list)})); 'ok'") }
        }
    }

    companion object {
        @Volatile
        private var instance: CasEngine? = null

        fun get(context: Context): CasEngine =
            instance ?: synchronized(this) { instance ?: CasEngine(context.applicationContext).also { instance = it } }
    }
}

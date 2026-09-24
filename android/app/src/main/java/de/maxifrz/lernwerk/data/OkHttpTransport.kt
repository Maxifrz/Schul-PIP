package de.maxifrz.lernwerk.data

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import de.maxifrz.lernwerk.llm.HttpResult
import de.maxifrz.lernwerk.llm.HttpTransport
import de.maxifrz.lernwerk.llm.LlmError
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InterruptedIOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.math.max
import kotlin.math.roundToInt

class OkHttpTransport : HttpTransport {
    override suspend fun post(url: String, headers: Map<String, String>, body: String, timeoutSeconds: Long): HttpResult =
        execute(request(url, headers).post(body.toRequestBody("application/json".toMediaType())).build(), timeoutSeconds)

    override suspend fun get(url: String, headers: Map<String, String>, timeoutSeconds: Long): HttpResult =
        execute(request(url, headers).get().build(), timeoutSeconds)

    private fun request(url: String, headers: Map<String, String>): Request.Builder =
        Request.Builder().url(url).apply { headers.forEach { (name, value) -> header(name, value) } }

    private suspend fun execute(request: Request, timeoutSeconds: Long): HttpResult {
        val client = base.newBuilder()
            .callTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(timeoutSeconds, TimeUnit.SECONDS)
            .build()

        return suspendCancellableCoroutine { continuation ->
            val call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }
            call.enqueue(object : Callback {
                override fun onResponse(call: Call, response: Response) {
                    val result = runCatching { response.use { HttpResult(it.code, it.body?.string() ?: "") } }
                    result.fold(continuation::resume) { onFailure(call, it as? IOException ?: IOException(it)) }
                }

                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isCancelled) return
                    val error = if (e is InterruptedIOException) {
                        LlmError.Timeout(timeoutSeconds)
                    } else {
                        LlmError.Network(e.message ?: e.javaClass.simpleName)
                    }
                    continuation.resumeWithException(error)
                }
            })
        }
    }

    private companion object {
        val base = OkHttpClient.Builder().connectTimeout(20, TimeUnit.SECONDS).build()
    }
}

object ImageCompressor {
    /** Re-encodes a JPEG until it fits [maxBytes], lowering quality first and resolution second. */
    fun jpeg(data: ByteArray, maxBytes: Int, maxDimension: Int = 1600): ByteArray {
        if (data.size <= maxBytes) return data
        val image = BitmapFactory.decodeByteArray(data, 0, data.size) ?: return data
        var dimension = minOf(maxDimension, max(image.width, image.height)).toFloat()
        var quality = 70
        var smallest = data
        repeat(10) {
            val encoded = encode(resized(image, dimension), quality)
            if (encoded.size < smallest.size) smallest = encoded
            if (encoded.size <= maxBytes) return encoded
            if (quality > 40) quality -= 15 else dimension *= 0.75f
        }
        return smallest
    }

    fun encode(bitmap: Bitmap, quality: Int): ByteArray =
        ByteArrayOutputStream().also { bitmap.compress(Bitmap.CompressFormat.JPEG, quality, it) }.toByteArray()

    private fun resized(image: Bitmap, maxDimension: Float): Bitmap {
        val scale = minOf(1f, maxDimension / max(image.width, image.height))
        if (scale >= 1f) return image
        return Bitmap.createScaledBitmap(image, (image.width * scale).roundToInt(), (image.height * scale).roundToInt(), true)
    }
}

package io.github.aleksanderdudek.gymtracker.zdrowie

import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Wysyłka do skrzynki na serwerze — tej samej, do której pisze zegarek Garmin (`/garmin/push`;
 * nazwa ścieżki jest historyczna). Serwer trzyma tylko najnowszą kopertę i nie zna klucza.
 * Wywołania blokują wątek: wołać z `Dispatchers.IO`.
 */
class Sender(private val base: String = BuildConfig.API_URL) {

    enum class Result { OK, TOO_OFTEN, REJECTED, OFFLINE }

    fun push(box: String, blob: String): Result =
        try {
            when (post("/garmin/push", "{\"box\":${Payload.str(box)},\"blob\":${Payload.str(blob)}}")) {
                200 -> Result.OK
                // Serwer przyjmuje jedną paczkę na minutę na skrzynkę.
                429 -> Result.TOO_OFTEN
                // Zła skrzynka albo za duża koperta — powtórka nic nie zmieni.
                400 -> Result.REJECTED
                else -> Result.OFFLINE
            }
        } catch (_: IOException) {
            Result.OFFLINE
        } catch (_: RuntimeException) {
            // Np. SecurityException przy zablokowanym dostępie do sieci — dla człowieka to też „brak sieci”.
            Result.OFFLINE
        }

    /** Kasuje paczkę z serwera. `false`, gdy serwer nie odpowiedział — paczka i tak zniknie po 7 dniach. */
    fun forget(box: String): Boolean =
        try {
            post("/garmin/forget", "{\"box\":${Payload.str(box)}}") in 200..299
        } catch (_: IOException) {
            false
        } catch (_: RuntimeException) {
            false
        }

    private fun post(path: String, body: String): Int {
        val c = URL(base + path).openConnection() as HttpURLConnection
        try {
            c.requestMethod = "POST"
            c.connectTimeout = TIMEOUT_MS
            c.readTimeout = TIMEOUT_MS
            c.doOutput = true
            c.useCaches = false
            c.setRequestProperty("Content-Type", "application/json")
            val bytes = body.toByteArray(Charsets.UTF_8)
            c.setFixedLengthStreamingMode(bytes.size)
            c.outputStream.use { it.write(bytes) }
            // Wystarczy kod odpowiedzi; treść (`{"ok":true}` albo `{"error":…}`) niczego nie dodaje.
            return c.responseCode
        } finally {
            c.disconnect()
        }
    }

    private companion object {
        const val TIMEOUT_MS = 15_000
    }
}

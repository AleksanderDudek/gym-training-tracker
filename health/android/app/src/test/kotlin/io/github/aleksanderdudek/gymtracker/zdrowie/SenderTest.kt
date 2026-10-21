package io.github.aleksanderdudek.gymtracker.zdrowie

import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.CopyOnWriteArrayList
import kotlin.concurrent.thread

/** Wysyłka na prawdziwe gniazdo: ścieżka, nagłówek i treść jak u zegarka, kody odpowiedzi na wyniki. */
class SenderTest {
    private val server = FakeServer()

    @After
    fun stop() = server.close()

    private fun sender() = Sender("http://127.0.0.1:${server.port}")

    @Test
    fun postsBoxAndBlobAsJson() {
        assertEquals(Sender.Result.OK, sender().push("737a7eb70569826b3e8462ab4ac24904", "AaChoq+/=="))
        val r = server.requests.single()
        assertEquals("POST /garmin/push", r.line)
        assertEquals("application/json", r.type)
        val json = JSONObject(r.body)
        assertEquals("737a7eb70569826b3e8462ab4ac24904", json.getString("box"))
        assertEquals("AaChoq+/==", json.getString("blob"))
    }

    @Test
    fun mapsServerAnswers() {
        server.status = 429
        assertEquals(Sender.Result.TOO_OFTEN, sender().push("ab", "cd"))
        server.status = 400
        assertEquals(Sender.Result.REJECTED, sender().push("ab", "cd"))
        server.status = 503
        assertEquals(Sender.Result.OFFLINE, sender().push("ab", "cd"))
    }

    @Test
    fun noServerMeansOffline() {
        val port = ServerSocket(0).use { it.localPort }
        assertEquals(Sender.Result.OFFLINE, Sender("http://127.0.0.1:$port").push("ab", "cd"))
    }

    @Test
    fun forgetPostsTheBox() {
        server.status = 204
        assertTrue(sender().forget("737a7eb70569826b3e8462ab4ac24904"))
        val r = server.requests.single()
        assertEquals("POST /garmin/forget", r.line)
        assertEquals("737a7eb70569826b3e8462ab4ac24904", JSONObject(r.body).getString("box"))
        server.status = 500
        assertFalse(sender().forget("ab"))
    }

    class Request(val line: String, val type: String?, val body: String)

    /** Najprostszy serwer HTTP/1.1 na jedno żądanie na połączenie — w testach na JVM Androida nie ma jdk.httpserver. */
    private class FakeServer : AutoCloseable {
        @Volatile
        var status = 200
        val requests = CopyOnWriteArrayList<Request>()
        private val socket = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
        val port: Int get() = socket.localPort

        init {
            thread(isDaemon = true) {
                while (!socket.isClosed) {
                    val s = try {
                        socket.accept()
                    } catch (_: IOException) {
                        break
                    }
                    s.use(::answer)
                }
            }
        }

        private fun answer(s: Socket) {
            val input = s.getInputStream().buffered()
            val line = readLine(input).substringBeforeLast(" ")
            val headers = generateSequence { readLine(input).takeIf { it.isNotEmpty() } }
                .associate { it.substringBefore(':').trim().lowercase() to it.substringAfter(':').trim() }
            val body = ByteArray(headers["content-length"]?.toInt() ?: 0)
            var at = 0
            while (at < body.size) {
                val n = input.read(body, at, body.size - at)
                if (n < 0) break
                at += n
            }
            requests += Request(line, headers["content-type"], body.decodeToString())
            s.getOutputStream().apply {
                write("HTTP/1.1 $status X\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
                flush()
            }
        }

        private fun readLine(input: InputStream): String {
            val out = StringBuilder()
            while (true) {
                val c = input.read()
                if (c < 0 || c == '\n'.code) break
                if (c != '\r'.code) out.append(c.toChar())
            }
            return out.toString()
        }

        override fun close() = socket.close()
    }
}

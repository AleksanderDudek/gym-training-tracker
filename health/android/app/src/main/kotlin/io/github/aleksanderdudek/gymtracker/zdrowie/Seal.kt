package io.github.aleksanderdudek.gymtracker.zdrowie

import java.security.SecureRandom
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Koperta danych: 0x01 ‖ IV ‖ AES-256-CBC(PKCS#7) ‖ HMAC-SHA256 ze wszystkiego przed nim, w base64.
 * Ten sam format pieczętuje zegarek (garmin/source/Seal.mc) i otwiera aplikacja (src/watchseal.ts);
 * SealTest pilnuje, żeby wszystkie trzy końce dawały bajt w bajt to samo dla tego samego klucza i IV
 * (health/vectors.json).
 *
 * Z klucza wychodzą trzy klucze pochodne, jak w HKDF-Expand z jednym blokiem:
 * HMAC(klucz, etykieta ‖ 0x01) dla "gt-box" (adres skrzynki), "gt-enc" (AES) i "gt-mac" (podpis).
 */
object Seal {
    private const val VERSION: Byte = 1
    private const val IV = 16

    class Keys(
        /** Identyfikator skrzynki na serwerze, 32 znaki hex. */
        val box: String,
        val enc: ByteArray,
        val mac: ByteArray,
    )

    /**
     * Klucz ze schowka: 64 znaki hex. Białe znaki, łączniki i wielkość liter nie mają znaczenia —
     * tak samo jak w `cleanKey` w aplikacji. Inny znak to nie klucz, tylko coś wklejonego razem z nim.
     */
    fun cleanKey(s: String): String? {
        val k = s.filterNot { it.isWhitespace() || it == '-' }.lowercase()
        return if (k.length == 64 && k.all { it in '0'..'9' || it in 'a'..'f' }) k else null
    }

    fun deriveKeys(hex: String): Keys? {
        val secret = cleanKey(hex)?.let(::hexBytes) ?: return null
        return Keys(
            box = bytesHex(derive(secret, "gt-box").copyOf(16)),
            enc = derive(secret, "gt-enc"),
            mac = derive(secret, "gt-mac"),
        )
    }

    /** Pieczętowanie jak na zegarku. IV podaje tylko test — inaczej losowy. */
    fun seal(keys: Keys, text: String, iv: ByteArray = randomIv()): String {
        require(iv.size == IV) { "IV ma 16 bajtów" }
        // Java nazywa to PKCS5Padding, ale przy blokach 16-bajtowych to dokładnie PKCS#7.
        val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
        cipher.init(Cipher.ENCRYPT_MODE, SecretKeySpec(keys.enc, "AES"), IvParameterSpec(iv))
        val head = byteArrayOf(VERSION) + iv + cipher.doFinal(text.toByteArray(Charsets.UTF_8))
        // Standardowe base64 z dopełnieniem, bez łamania linii — tak jak `btoa` w przeglądarce.
        return Base64.getEncoder().encodeToString(head + hmac(keys.mac, head))
    }

    fun randomIv(): ByteArray = ByteArray(IV).also { SecureRandom().nextBytes(it) }

    private fun derive(secret: ByteArray, label: String): ByteArray =
        hmac(secret, label.toByteArray(Charsets.UTF_8) + 0x01.toByte())

    private fun hmac(key: ByteArray, msg: ByteArray): ByteArray =
        Mac.getInstance("HmacSHA256").run {
            init(SecretKeySpec(key, "HmacSHA256"))
            doFinal(msg)
        }

    internal fun hexBytes(hex: String): ByteArray =
        ByteArray(hex.length / 2) { i -> hex.substring(2 * i, 2 * i + 2).toInt(16).toByte() }

    // Małymi literami, jak identyfikator skrzynki po stronie serwera i aplikacji.
    internal fun bytesHex(b: ByteArray): String = buildString(b.size * 2) {
        for (x in b) {
            append(HEX[(x.toInt() shr 4) and 0xf])
            append(HEX[x.toInt() and 0xf])
        }
    }

    private const val HEX = "0123456789abcdef"
}

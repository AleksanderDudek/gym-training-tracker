package io.github.aleksanderdudek.gymtracker.zdrowie

import org.json.JSONObject
import java.io.File
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.Mac
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

/**
 * Wspólny wektor koperty (health/vectors.json). Gradle podaje ścieżkę we właściwości `vectors`;
 * bez niej (np. test puszczony z IDE) szukamy `../../vectors.json` od katalogu modułu i wyżej.
 */
object Vectors {
    val json: JSONObject by lazy { JSONObject(file().readText()) }

    private fun file(): File {
        System.getProperty("vectors")?.let(::File)?.takeIf { it.isFile }?.let { return it }
        File("../../vectors.json").takeIf { it.isFile }?.let { return it }
        var dir: File? = File("").absoluteFile
        while (dir != null) {
            listOf(File(dir, "vectors.json"), File(dir, "health/vectors.json")).firstOrNull { it.isFile }?.let { return it }
            dir = dir.parentFile
        }
        error("Nie znalazłem health/vectors.json")
    }
}

/** Otwieranie koperty tak jak `open` w src/watchseal.ts — tylko do testów, telefon nic nie otwiera. */
fun openBlob(keys: Seal.Keys, blob: String): String? {
    val env = Base64.getDecoder().decode(blob)
    if (env.size < 1 + 16 + 16 + 32 || env[0] != 1.toByte()) return null
    val head = env.copyOfRange(0, env.size - 32)
    val tag = Mac.getInstance("HmacSHA256").run {
        init(SecretKeySpec(keys.mac, "HmacSHA256"))
        doFinal(head)
    }
    if (!tag.contentEquals(env.copyOfRange(env.size - 32, env.size))) return null
    val cipher = Cipher.getInstance("AES/CBC/PKCS5Padding")
    cipher.init(Cipher.DECRYPT_MODE, SecretKeySpec(keys.enc, "AES"), IvParameterSpec(head.copyOfRange(1, 17)))
    return String(cipher.doFinal(head.copyOfRange(17, head.size)), Charsets.UTF_8)
}

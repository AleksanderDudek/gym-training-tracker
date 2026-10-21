package io.github.aleksanderdudek.gymtracker.zdrowie

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** Telefon musi pieczętować bajt w bajt jak zegarek i jak wzorzec w aplikacji. */
class SealTest {
    private val v = Vectors.json
    private val keys = Seal.deriveKeys(v.getString("key"))!!

    @Test
    fun derivesTheSameKeysAsTheApp() {
        assertEquals(v.getString("box"), keys.box)
        assertEquals(v.getString("enc"), Seal.bytesHex(keys.enc))
        assertEquals(v.getString("mac"), Seal.bytesHex(keys.mac))
    }

    @Test
    fun sealsTheVectorByteForByte() {
        val blob = Seal.seal(keys, v.getString("plaintext"), Seal.hexBytes(v.getString("iv")))
        assertEquals(v.getString("blob"), blob)
    }

    @Test
    fun opensAgainWithARandomIv() {
        val a = Seal.seal(keys, "{\"v\":1}")
        val b = Seal.seal(keys, "{\"v\":1}")
        assertNotEquals("losowe IV za każdym razem", a, b)
        assertEquals("{\"v\":1}", openBlob(keys, a))
        assertEquals("{\"v\":1}", openBlob(keys, b))
    }

    @Test
    fun sealsPolishCharactersAsUtf8() {
        val text = "{\"x\":\"zażółć gęślą jaźń\"}"
        assertEquals(text, openBlob(keys, Seal.seal(keys, text)))
    }

    @Test
    fun cleanKeyIgnoresSpacesDashesAndCase() {
        val key = v.getString("key")
        assertEquals(key, Seal.cleanKey(key))
        assertEquals(key, Seal.cleanKey(key.uppercase()))
        assertEquals(key, Seal.cleanKey(key.chunked(8).joinToString("-")))
        assertEquals(key, Seal.cleanKey("  " + key.chunked(16).joinToString(" \n\t") + "\n"))
        // Twarda spacja z niektórych klawiatur i komunikatorów też nie przeszkadza (jak `\s` w JS).
        assertEquals(key, Seal.cleanKey(key.chunked(32).joinToString(" ")))
    }

    @Test
    fun cleanKeyRejectsAnythingElse() {
        val key = v.getString("key")
        assertNull(Seal.cleanKey(""))
        assertNull(Seal.cleanKey(key.dropLast(1)))
        assertNull(Seal.cleanKey(key + "0"))
        assertNull(Seal.cleanKey(key.dropLast(1) + "g"))
        assertNull(Seal.cleanKey("klucz: $key"))
        assertNull(Seal.deriveKeys("to nie klucz"))
        assertNotNull(Seal.deriveKeys(key.uppercase()))
    }
}

package io.github.aleksanderdudek.gymtracker.zdrowie

import android.content.Context
import androidx.core.content.edit

/**
 * Klucz z GYM TRACKER. Leży w prywatnych ustawieniach aplikacji, które czyta też wysyłka w tle.
 * Kopia zapasowa i przenoszenie na nowy telefon są wyłączone dla całej aplikacji (manifest,
 * `data_extraction_rules.xml`), więc klucz nie wychodzi z tego telefonu — na nowym wkleja się go
 * jeszcze raz.
 */
class Keys(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("klucz", Context.MODE_PRIVATE)

    /** Klucz po oczyszczeniu: 64 znaki hex, albo `null`, gdy go jeszcze nie ma. */
    val hex: String?
        get() = prefs.getString(KEY, null)?.let(Seal::cleanKey)

    fun derived(): Seal.Keys? = hex?.let(Seal::deriveKeys)

    /** Zapisuje klucz, jeśli to klucz. `false`, gdy w schowku było coś innego. */
    fun save(raw: String): Boolean {
        val k = Seal.cleanKey(raw) ?: return false
        prefs.edit { putString(KEY, k) }
        return true
    }

    fun clear() = prefs.edit { remove(KEY) }

    private companion object {
        const val KEY = "key"
    }
}

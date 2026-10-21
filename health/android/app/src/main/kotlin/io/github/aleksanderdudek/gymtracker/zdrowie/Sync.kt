package io.github.aleksanderdudek.gymtracker.zdrowie

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Deferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.async
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * Jedna wysyłka: odczyt z Health Connect → paczka → koperta → serwer. Woła ją ekran (przy otwarciu
 * i przyciskiem) i praca w tle co godzinę. Wynik ostatniej próby zostaje w ustawieniach dla ekranu:
 * kiedy, z jakim skutkiem, ile dni i jakie rodzaje danych — bez samych liczb.
 */
object Sync {

    enum class Outcome {
        SENT, TOO_OFTEN, REJECTED, OFFLINE,

        /** Health Connect nie ma nic z ostatnich 14 dni (albo nic z tego, na co jest zgoda). */
        NOTHING,

        /** Odczyt z Health Connect się nie udał — np. cofnięta zgoda albo czytanie w tle bez zgody. */
        FAILED,

        /** Nie było czego próbować: brak klucza, Health Connect albo zgody. Nie zapisuje się jako próba. */
        NOT_READY,

        /** Ostatnia wysyłka była przed chwilą; świeższych danych i tak by nie było. */
        SKIPPED,
    }

    class Last(val at: Long, val outcome: Outcome, val days: Int, val kinds: Set<Kind>, val sentAt: Long)

    /** Bez przycisku najwyżej raz na kwadrans: ekran otwiera się często, a dane i tak przychodzą co kilka minut. */
    private const val GAP_MS = 15 * 60_000L

    // Ekran i praca w tle mogą ruszyć naraz; serwer i tak przyjmie tylko jedną paczkę na minutę.
    private val lock = Mutex()

    // Wysyłka z ekranu nie ginie, gdy ekran się obróci albo zamknie w połowie.
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /** Wysyłka z ekranu: biegnie dalej, nawet gdy ten, kto czeka na wynik, zniknie. */
    fun start(context: Context, force: Boolean): Deferred<Outcome> =
        context.applicationContext.let { app -> scope.async { orElse(Outcome.FAILED) { run(app, force) } } }

    /** Odłączenie z ekranu, tak samo odporne na zamknięcie ekranu jak [start]. */
    fun startDisconnect(context: Context): Deferred<Boolean> =
        context.applicationContext.let { app -> scope.async { orElse(false) { disconnect(app) } } }

    // Nieprzewidziany wyjątek z ustawień czy WorkManagera wyszedłby z `await()` na ekranie i zamknął aplikację.
    private inline fun <T> orElse(fallback: T, block: () -> T): T =
        try {
            block()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            fallback
        }

    /** [background]: woła praca w tle — bez zgody na czytanie w tle odczyt by się nie udał. */
    suspend fun run(context: Context, force: Boolean, background: Boolean = false): Outcome = lock.withLock {
        val app = context.applicationContext
        val now = System.currentTimeMillis()
        if (!force && !due(app, now)) return Outcome.SKIPPED
        val keys = Keys(app).derived() ?: return Outcome.NOT_READY
        if (HealthReader.status(app) != HealthReader.Status.AVAILABLE) return Outcome.NOT_READY
        val reader = HealthReader(app)
        val sealed = try {
            val all = reader.granted()
            if (background && HealthReader.BACKGROUND !in all) {
                // Zgodę cofnięto w ustawieniach: praca w tle kończy się sama, ekran wysyła dalej przy otwarciu.
                SyncWorker.cancel(app)
                return Outcome.NOT_READY
            }
            val granted = all intersect HealthReader.READ
            if (granted.isEmpty()) return Outcome.NOT_READY
            val reading = reader.read(granted)
            if (reading.days.isEmpty() && reading.rides.isEmpty()) return save(app, now, Outcome.NOTHING)
            withContext(Dispatchers.Default) {
                Payload.sealedWithinBudget(keys, reading.days, reading.rides, now / 1000)
            }
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // SecurityException, RemoteException, IOException z Health Connect — szczegóły niczego
            // nie zmienią dla człowieka, a w logach nie powinno być nic o jego zdrowiu.
            return save(app, now, Outcome.FAILED)
        }
        val outcome = when (withContext(Dispatchers.IO) { Sender().push(keys.box, sealed.blob) }) {
            Sender.Result.OK -> Outcome.SENT
            Sender.Result.TOO_OFTEN -> Outcome.TOO_OFTEN
            Sender.Result.REJECTED -> Outcome.REJECTED
            Sender.Result.OFFLINE -> Outcome.OFFLINE
        }
        save(app, now, outcome, sealed)
    }

    /**
     * Odłączenie: paczka znika z serwera, klucz z telefonu, praca w tle się kończy. Pod tym samym
     * zamkiem co wysyłka, żeby nie przyszła paczka już po skasowaniu skrzynki.
     * `false`, gdy serwer nie odpowiedział — wtedy paczka zniknie sama po 7 dniach.
     */
    private suspend fun disconnect(context: Context): Boolean = lock.withLock {
        val app = context.applicationContext
        val box = Keys(app).derived()?.box
        val forgotten = box == null || withContext(Dispatchers.IO) { Sender().forget(box) }
        Keys(app).clear()
        prefs(app).edit { clear() }
        SyncWorker.cancel(app)
        forgotten
    }

    fun last(context: Context): Last? {
        val p = prefs(context)
        val outcome = p.getString(OUTCOME, null)?.let { s -> Outcome.entries.firstOrNull { it.name == s } } ?: return null
        val kinds = p.getString(KINDS, "").orEmpty().split(',').mapNotNull { s -> Kind.entries.firstOrNull { it.name == s } }
        return Last(p.getLong(AT, 0), outcome, p.getInt(DAYS, 0), kinds.toSet(), p.getLong(SENT_AT, 0))
    }

    private fun due(context: Context, now: Long): Boolean {
        val sentAt = prefs(context).getLong(SENT_AT, 0)
        // Zegar cofnięty ręcznie nie może zablokować wysyłki na zawsze.
        return now - sentAt >= GAP_MS || sentAt > now
    }

    private fun save(context: Context, now: Long, outcome: Outcome, sealed: Sealed? = null): Outcome {
        // „Za często” tuż po udanej wysyłce (drugie stuknięcie, zgoda i powrót na ekran naraz) nie
        // zasłania wyniku: paczka sprzed chwili leży na serwerze, nic nie przepadło.
        val sentAt = prefs(context).getLong(SENT_AT, 0)
        if (outcome == Outcome.TOO_OFTEN && now - sentAt in 0 until 90_000) return outcome
        prefs(context).edit {
            putLong(AT, now)
            putString(OUTCOME, outcome.name)
            if (outcome == Outcome.SENT && sealed != null) {
                putLong(SENT_AT, now)
                putInt(DAYS, sealed.days.size)
                putString(KINDS, Payload.kinds(sealed.days, sealed.rides).joinToString(",") { it.name })
            }
        }
        return outcome
    }

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences("wysylka", Context.MODE_PRIVATE)

    private const val AT = "at"
    private const val OUTCOME = "outcome"
    private const val SENT_AT = "sentAt"
    private const val DAYS = "days"
    private const val KINDS = "kinds"
}

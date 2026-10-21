package io.github.aleksanderdudek.gymtracker.zdrowie

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.Locale

/**
 * Jeden dzień paczki. `day` to lokalna data telefonu; `null` znaczy „nie zmierzone albo brak zgody”
 * i w JSON-ie pola po prostu nie ma. `active` (minuty ćwiczeń) zostaje puste — Health Connect
 * nie ma odpowiednika minut ćwiczeń z Apple Zdrowia.
 */
data class Day(
    val day: String,
    val steps: Int? = null,
    val m: Int? = null,
    val floors: Int? = null,
    val active: Int? = null,
    val rhr: Int? = null,
    val hrMin: Int? = null,
    val hrAvg: Int? = null,
    val hrMax: Int? = null,
    val sleep: Int? = null,
    val kg: Double? = null,
) {
    /** Dzień bez żadnej liczby aplikacja i tak odrzuci, więc nie ma po co go wysyłać. */
    val isEmpty: Boolean
        get() = listOf(steps, m, floors, active, rhr, hrMin, hrAvg, hrMax, sleep, kg).all { it == null }
}

/** Przejazd rowerem z drogą. `start` w sekundach od 1970, `sport` w numeracji FIT (2 = rower), jak z zegarka. */
data class Ride(val start: Long, val sport: Int, val sec: Int, val m: Int)

/** Paczka po zapieczętowaniu i to, co do niej weszło (do podsumowania na ekranie). */
class Sealed(val blob: String, val days: List<Day>, val rides: List<Ride>)

/** Rodzaje danych do podsumowania „wysłane: …” — bez liczb, które nie muszą leżeć w ustawieniach. */
enum class Kind { STEPS, DISTANCE, FLOORS, RESTING_HR, HEART_RATE, SLEEP, WEIGHT, RIDES }

/**
 * Paczka telefonu v1 — kształt opisuje spec (docs/superpowers/specs/2026-10-21-zdrowie-telefon-design.md)
 * i sprawdza `parsePhonePayload` w aplikacji. Własny mały zapis JSON zamiast org.json: kolejność
 * kluczy jest wtedy stała i taka sama jak we wspólnym wektorze, a test na JVM nie zależy od Androida.
 */
object Payload {
    /** Serwer przyjmuje do 12 000 znaków base64; zapas na wypadek zmian po drodze. */
    const val BUDGET = 11_000

    /** Tyle przejazdów aplikacja przyjmuje z jednej paczki. */
    const val MAX_RIDES = 50

    const val SPORT_CYCLING = 2

    fun json(days: List<Day>, rides: List<Ride>, t: Long): String = obj(
        "v" to "1",
        "k" to str("phone"),
        "os" to str("android"),
        "t" to t.toString(),
        "d" to days.joinToString(",", "[", "]", transform = ::day),
        "a" to rides.joinToString(",", "[", "]", transform = ::ride),
    )

    /**
     * Pieczętuje paczkę, a gdy koperta przekracza [BUDGET], zrzuca najstarsze dni (i przejazdy
     * sprzed najstarszego zostawionego dnia), aż się zmieści. Najnowsze dane są najcenniejsze —
     * starsze aplikacja ma już z wcześniejszych paczek.
     */
    fun sealedWithinBudget(
        keys: Seal.Keys,
        days: List<Day>,
        rides: List<Ride>,
        t: Long,
        zone: ZoneId = ZoneId.systemDefault(),
        iv: () -> ByteArray = Seal::randomIv,
    ): Sealed {
        var d = days.filterNot { it.isEmpty }.sortedBy { it.day }
        var r = rides.sortedBy { it.start }.takeLast(MAX_RIDES)
        while (true) {
            val blob = Seal.seal(keys, json(d, r, t), iv())
            if (blob.length <= BUDGET || (d.isEmpty() && r.isEmpty())) return Sealed(blob, d, r)
            if (d.isNotEmpty()) {
                d = d.drop(1)
                val from = d.firstOrNull()?.let { LocalDate.parse(it.day) }
                if (from != null) r = r.filter { !Instant.ofEpochSecond(it.start).atZone(zone).toLocalDate().isBefore(from) }
            } else {
                r = r.drop(1)
            }
        }
    }

    /**
     * Ten sam przejazd zapisany przez dwie aplikacje (np. Garmin Connect i Strava) liczy się raz:
     * z przejazdów, które zaczęły się w ciągu 10 minut, zostaje ten z dłuższą drogą. Ta sama
     * granica co między przejazdem z telefonu i z zegarka w aplikacji.
     */
    fun withoutDuplicateRides(rides: List<Ride>): List<Ride> {
        val out = mutableListOf<Ride>()
        for (r in rides.sortedBy { it.start }) {
            val last = out.lastOrNull()
            when {
                last == null || r.start - last.start > DUPLICATE_GAP_S -> out += r
                r.m > last.m -> out[out.lastIndex] = r
            }
        }
        return out
    }

    private const val DUPLICATE_GAP_S = 600

    /** Które rodzaje danych są w paczce choć raz. */
    fun kinds(days: List<Day>, rides: List<Ride>): Set<Kind> = buildSet {
        if (days.any { it.steps != null }) add(Kind.STEPS)
        if (days.any { it.m != null }) add(Kind.DISTANCE)
        if (days.any { it.floors != null }) add(Kind.FLOORS)
        if (days.any { it.rhr != null }) add(Kind.RESTING_HR)
        if (days.any { it.hrMin != null || it.hrAvg != null || it.hrMax != null }) add(Kind.HEART_RATE)
        if (days.any { it.sleep != null }) add(Kind.SLEEP)
        if (days.any { it.kg != null }) add(Kind.WEIGHT)
        if (rides.isNotEmpty()) add(Kind.RIDES)
    }

    private fun day(d: Day): String = obj(
        "day" to str(d.day),
        "steps" to d.steps?.toString(),
        "m" to d.m?.toString(),
        "floors" to d.floors?.toString(),
        "active" to d.active?.toString(),
        "rhr" to d.rhr?.toString(),
        "hrMin" to d.hrMin?.toString(),
        "hrAvg" to d.hrAvg?.toString(),
        "hrMax" to d.hrMax?.toString(),
        "sleep" to d.sleep?.toString(),
        // Locale.ROOT: polski telefon napisałby „82,4”, a to już nie jest liczba w JSON-ie.
        "kg" to d.kg?.let { String.format(Locale.ROOT, "%.1f", it) },
    )

    private fun ride(r: Ride): String = obj(
        "start" to r.start.toString(),
        "sport" to r.sport.toString(),
        "sec" to r.sec.toString(),
        "m" to r.m.toString(),
    )

    /** Obiekt z gotowych wartości JSON; pola z `null` pomija. */
    private fun obj(vararg fields: Pair<String, String?>): String =
        fields.filter { it.second != null }.joinToString(",", "{", "}") { (k, v) -> "${str(k)}:$v" }

    internal fun str(s: String): String = buildString(s.length + 2) {
        append('"')
        for (c in s) {
            when {
                c == '"' -> append("\\\"")
                c == '\\' -> append("\\\\")
                c < ' ' -> append("\\u%04x".format(Locale.ROOT, c.code))
                else -> append(c)
            }
        }
        append('"')
    }
}

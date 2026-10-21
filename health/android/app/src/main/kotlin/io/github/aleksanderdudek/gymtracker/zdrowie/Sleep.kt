package io.github.aleksanderdudek.gymtracker.zdrowie

import androidx.health.connect.client.records.SleepSessionRecord
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/** Etap snu: przedział i typ jak w `SleepSessionRecord.STAGE_TYPE_*`. */
data class SleepStage(val start: Instant, val end: Instant, val type: Int)

/** Sesja snu z Health Connect, z etapami, jeśli aplikacja, która ją zapisała, je zna. */
data class SleepSession(val start: Instant, val end: Instant, val stages: List<SleepStage> = emptyList())

/**
 * Minuty snu na dzień pobudki — tak jak „sen z ostatniej nocy” w Garminie i w aplikacji.
 *
 * Tę samą noc często zapisuje kilka aplikacji (zegarek, telefon, opaska), więc sesje najpierw
 * się sumuje jako zbiory: nachodzące na siebie liczą się raz. Potem odejmuje się czuwanie
 * i wyjście z łóżka. Sesja bez etapów liczy się w całości jako sen.
 */
object Sleep {
    // Stałe z Health Connect są `const`, więc kompilator je wstawia — test na JVM nie ładuje biblioteki.
    private val NOT_ASLEEP = setOf(
        SleepSessionRecord.STAGE_TYPE_AWAKE,
        SleepSessionRecord.STAGE_TYPE_OUT_OF_BED,
        SleepSessionRecord.STAGE_TYPE_AWAKE_IN_BED,
    )

    private const val DAY_MINUTES = 1_440

    fun minutesByDay(sessions: List<SleepSession>, zone: ZoneId): Map<LocalDate, Int> {
        val nights = union(sessions.map { it.start to it.end })
        val awake = union(sessions.flatMap { s -> s.stages.filter { it.type in NOT_ASLEEP }.map { it.start to it.end } })
        val seconds = sortedMapOf<LocalDate, Long>()
        for ((start, end) in nights) {
            val asleep = Duration.between(start, end).seconds - awake.sumOf { overlap(start, end, it) }
            // Noc należy do dnia, w którym się skończyła: sen z 23:00 do 7:00 to sen „dzisiejszy”.
            seconds.merge(end.atZone(zone).toLocalDate(), asleep, Long::plus)
        }
        return seconds.mapValues { ((it.value + 30) / 60).toInt().coerceIn(0, DAY_MINUTES) }
    }

    /** Suma przedziałów jako rozłączne, posortowane przedziały. Puste i odwrócone odpadają. */
    private fun union(spans: List<Pair<Instant, Instant>>): List<Pair<Instant, Instant>> {
        val out = mutableListOf<Pair<Instant, Instant>>()
        for ((s, e) in spans.filter { it.second > it.first }.sortedBy { it.first }) {
            val last = out.lastOrNull()
            if (last != null && s <= last.second) {
                if (e > last.second) out[out.lastIndex] = last.first to e
            } else {
                out += s to e
            }
        }
        return out
    }

    private fun overlap(start: Instant, end: Instant, span: Pair<Instant, Instant>): Long {
        val s = maxOf(start, span.first)
        val e = minOf(end, span.second)
        return if (e > s) Duration.between(s, e).seconds else 0
    }
}

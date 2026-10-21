package io.github.aleksanderdudek.gymtracker.zdrowie

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.HealthConnectFeatures
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.FloorsClimbedRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.records.metadata.DataOrigin
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.Period
import java.time.ZoneId
import kotlin.math.roundToInt

/**
 * Odczyt z Health Connect: dwa ostatnie tygodnie w kształcie paczki v1.
 *
 * Sumy dnia liczy samo Health Connect (`aggregateGroupByPeriod`), bo tylko ono zna kolejność
 * aplikacji ustawioną przez człowieka i nie liczy dwa razy kroków z telefonu i z zegarka.
 * Czytamy wyłącznie rodzaje danych, na które jest zgoda — zapytanie o resztę skończyłoby się
 * wyjątkiem, a człowiek może się zgodzić tylko na część.
 */
class HealthReader(private val context: Context) {

    enum class Status { AVAILABLE, NEEDS_INSTALL, UNSUPPORTED }

    class Reading(val days: List<Day>, val rides: List<Ride>)

    companion object {
        /** Health Connect jako aplikacja (Android 9–13); od Androida 14 jest częścią systemu. */
        const val PROVIDER = "com.google.android.apps.healthdata"

        /** Ile dni wstecz, razem z dzisiejszym. */
        const val DAYS = 14

        val STEPS = HealthPermission.getReadPermission(StepsRecord::class)
        val DISTANCE = HealthPermission.getReadPermission(DistanceRecord::class)
        val FLOORS = HealthPermission.getReadPermission(FloorsClimbedRecord::class)
        val HEART_RATE = HealthPermission.getReadPermission(HeartRateRecord::class)
        val RESTING_HR = HealthPermission.getReadPermission(RestingHeartRateRecord::class)
        val SLEEP = HealthPermission.getReadPermission(SleepSessionRecord::class)
        val WEIGHT = HealthPermission.getReadPermission(WeightRecord::class)
        val EXERCISE = HealthPermission.getReadPermission(ExerciseSessionRecord::class)

        /** Wszystko, co aplikacja czyta. Musi się zgadzać z uprawnieniami w manifeście. */
        val READ = setOf(STEPS, DISTANCE, FLOORS, HEART_RATE, RESTING_HR, SLEEP, WEIGHT, EXERCISE)

        const val BACKGROUND = HealthPermission.PERMISSION_READ_HEALTH_DATA_IN_BACKGROUND

        fun status(context: Context): Status =
            when (HealthConnectClient.getSdkStatus(context, PROVIDER)) {
                HealthConnectClient.SDK_AVAILABLE -> Status.AVAILABLE
                HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> Status.NEEDS_INSTALL
                else -> Status.UNSUPPORTED
            }
    }

    private val client: HealthConnectClient by lazy { HealthConnectClient.getOrCreate(context, PROVIDER) }

    suspend fun granted(): Set<String> = client.permissionController.getGrantedPermissions()

    /** Czytanie w tle zależy od wersji Health Connect na telefonie, nie od wersji Androida. */
    fun backgroundAvailable(): Boolean =
        client.features.getFeatureStatus(HealthConnectFeatures.FEATURE_READ_HEALTH_DATA_IN_BACKGROUND) ==
            HealthConnectFeatures.FEATURE_STATUS_AVAILABLE

    suspend fun read(
        granted: Set<String>,
        zone: ZoneId = ZoneId.systemDefault(),
        today: LocalDate = LocalDate.now(zone),
    ): Reading {
        val first = today.minusDays(DAYS - 1L)
        val from = first.atStartOfDay()
        val to = today.plusDays(1).atStartOfDay()
        val fromI = from.atZone(zone).toInstant()
        val toI = to.atZone(zone).toInstant()

        val totals = if (granted.isEmpty()) emptyMap() else totals(granted, from, to)
        val sleep = if (SLEEP in granted) sleep(first, today, zone) else emptyMap()
        val weight = if (WEIGHT in granted) weight(fromI, toI, zone) else emptyMap()

        val days = (0 until DAYS).map { first.plusDays(it.toLong()) }.map { d ->
            val r = totals[d]
            Day(
                day = d.toString(),
                steps = r?.get(StepsRecord.COUNT_TOTAL)?.toIntClamped(),
                m = r?.get(DistanceRecord.DISTANCE_TOTAL)?.inMeters?.roundToInt(),
                floors = r?.get(FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL)?.roundToInt(),
                rhr = r?.get(RestingHeartRateRecord.BPM_AVG)?.toIntClamped(),
                hrMin = r?.get(HeartRateRecord.BPM_MIN)?.toIntClamped(),
                hrAvg = r?.get(HeartRateRecord.BPM_AVG)?.toIntClamped(),
                hrMax = r?.get(HeartRateRecord.BPM_MAX)?.toIntClamped(),
                sleep = sleep[d],
                kg = weight[d],
            )
        }.filterNot { it.isEmpty }

        // Droga przejazdu pochodzi z rekordów dystansu, więc bez tej zgody przejazdy nic nie wnoszą.
        val rides = if (EXERCISE in granted && DISTANCE in granted) rides(fromI, toI) else emptyList()
        return Reading(days, rides)
    }

    /** Sumy i średnie dnia — jedno zapytanie dla wszystkich dozwolonych miar, doba po dobie w czasie lokalnym. */
    private suspend fun totals(granted: Set<String>, from: LocalDateTime, to: LocalDateTime): Map<LocalDate, AggregationResult> {
        val metrics = buildSet<AggregateMetric<*>> {
            if (STEPS in granted) add(StepsRecord.COUNT_TOTAL)
            if (DISTANCE in granted) add(DistanceRecord.DISTANCE_TOTAL)
            if (FLOORS in granted) add(FloorsClimbedRecord.FLOORS_CLIMBED_TOTAL)
            if (HEART_RATE in granted) {
                add(HeartRateRecord.BPM_MIN)
                add(HeartRateRecord.BPM_AVG)
                add(HeartRateRecord.BPM_MAX)
            }
            if (RESTING_HR in granted) add(RestingHeartRateRecord.BPM_AVG)
        }
        if (metrics.isEmpty()) return emptyMap()
        val request = AggregateGroupByPeriodRequest(metrics, TimeRangeFilter.between(from, to), Period.ofDays(1))
        return client.aggregateGroupByPeriod(request).associate { it.startTime.toLocalDate() to it.result }
    }

    private suspend fun sleep(first: LocalDate, today: LocalDate, zone: ZoneId): Map<LocalDate, Int> {
        // Noc, która kończy się pierwszego dnia, zaczęła się poprzedniego wieczoru.
        val from = first.minusDays(1).atTime(18, 0).atZone(zone).toInstant()
        val to = today.plusDays(1).atStartOfDay(zone).toInstant()
        val sessions = readAll<SleepSessionRecord>(TimeRangeFilter.between(from, to)).map { s ->
            SleepSession(s.startTime, s.endTime, s.stages.map { SleepStage(it.startTime, it.endTime, it.stage) })
        }
        return Sleep.minutesByDay(sessions, zone).filterKeys { it in first..today }
    }

    /** Ostatnie ważenie każdego dnia, jak w dzienniku wagi w aplikacji. */
    private suspend fun weight(from: Instant, to: Instant, zone: ZoneId): Map<LocalDate, Double> =
        readAll<WeightRecord>(TimeRangeFilter.between(from, to))
            .groupBy { it.time.atZone(zone).toLocalDate() }
            .mapValues { (_, list) -> list.maxBy { it.time }.weight.inKilograms }

    /**
     * Przejazdy rowerem z drogą. Biegi i spacery nie, bo ich kroki są już w krokach dnia (ta sama
     * zasada co przy zegarku). Drogę liczy Health Connect z rekordów dystansu w czasie przejazdu.
     */
    private suspend fun rides(from: Instant, to: Instant): List<Ride> {
        val rides = readAll<ExerciseSessionRecord>(TimeRangeFilter.between(from, to))
            .filter { it.exerciseType == ExerciseSessionRecord.EXERCISE_TYPE_BIKING }
            .mapNotNull { s ->
                val sec = Duration.between(s.startTime, s.endTime).seconds
                if (sec < 60) return@mapNotNull null
                // Najpierw droga z aplikacji, która zapisała przejazd: krokomierz telefonu z wyższym
                // priorytetem dałby inaczej kilkaset metrów „chodzenia” zamiast 25 km jazdy.
                val m = distance(s, setOf(s.metadata.dataOrigin)).takeIf { it > 0 } ?: distance(s, emptySet())
                if (m > 0) Ride(s.startTime.epochSecond, Payload.SPORT_CYCLING, sec.toIntClamped(), m) else null
            }
        return Payload.withoutDuplicateRides(rides)
    }

    private suspend fun distance(s: ExerciseSessionRecord, origins: Set<DataOrigin>): Int {
        val filter = TimeRangeFilter.between(s.startTime, s.endTime)
        val total = client.aggregate(AggregateRequest(setOf(DistanceRecord.DISTANCE_TOTAL), filter, origins))
        return total[DistanceRecord.DISTANCE_TOTAL]?.inMeters?.roundToInt() ?: 0
    }

    /** Wszystkie strony odczytu — Health Connect oddaje najwyżej 1000 rekordów naraz. */
    private suspend inline fun <reified T : Record> readAll(filter: TimeRangeFilter): List<T> {
        val out = mutableListOf<T>()
        var token: String? = null
        do {
            val page = client.readRecords(ReadRecordsRequest<T>(timeRangeFilter = filter, pageToken = token))
            out += page.records
            // Przed Androidem 14 brak następnej strony to pusty napis, a nie null.
            token = page.pageToken?.takeIf { it.isNotEmpty() }
        } while (token != null)
        return out
    }

    private fun Long.toIntClamped(): Int = coerceIn(Int.MIN_VALUE.toLong(), Int.MAX_VALUE.toLong()).toInt()
}

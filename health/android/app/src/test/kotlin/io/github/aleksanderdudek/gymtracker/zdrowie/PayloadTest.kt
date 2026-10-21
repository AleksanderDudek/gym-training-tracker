package io.github.aleksanderdudek.gymtracker.zdrowie

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.ZoneOffset
import java.util.Locale

class PayloadTest {
    private val keys = Seal.deriveKeys(Vectors.json.getString("key"))!!

    private val vectorDays = listOf(
        Day("2026-10-19", steps = 4210, m = 3120, floors = 3, rhr = 55, hrMin = 50, hrAvg = 74, hrMax = 131, sleep = 401),
        Day(
            "2026-10-20", steps = 9120, m = 7340, floors = 12, active = 35, rhr = 52, hrMin = 48, hrAvg = 71, hrMax = 142,
            sleep = 432, kg = 82.4,
        ),
    )
    private val vectorRides = listOf(Ride(start = 1792501200, sport = 2, sec = 3600, m = 25000))

    @Test
    fun writesTheVectorPlaintextExactly() {
        assertEquals(Vectors.json.getString("plaintext"), Payload.json(vectorDays, vectorRides, 1792540800))
    }

    @Test
    fun keyOrderAndMarkers() {
        val json = Payload.json(emptyList(), emptyList(), 1792540800)
        assertEquals("{\"v\":1,\"k\":\"phone\",\"os\":\"android\",\"t\":1792540800,\"d\":[],\"a\":[]}", json)
    }

    @Test
    fun omitsMissingFields() {
        val json = Payload.json(listOf(Day("2026-10-20", steps = 100, sleep = 0)), emptyList(), 1)
        assertTrue(json, json.contains("{\"day\":\"2026-10-20\",\"steps\":100,\"sleep\":0}"))
        assertFalse(json.contains("null"))
    }

    @Test
    fun weightHasOneDecimalAndADotEvenOnAPolishPhone() {
        val before = Locale.getDefault()
        try {
            Locale.setDefault(Locale.forLanguageTag("pl-PL"))
            fun kg(v: Double) = Regex("\"kg\":([^,}]*)")
                .find(Payload.json(listOf(Day("2026-10-20", kg = v)), emptyList(), 1))!!.groupValues[1]
            assertEquals("82.0", kg(82.0))
            assertEquals("82.4", kg(82.36))
            assertEquals("104.7", kg(104.7))
        } finally {
            Locale.setDefault(before)
        }
    }

    @Test
    fun escapesStrings() {
        assertEquals("\"a\\\"b\\\\c\\u000a\"", Payload.str("a\"b\\c\n"))
    }

    @Test
    fun sealedPayloadOpensToTheSameJson() {
        val s = Payload.sealedWithinBudget(keys, vectorDays, vectorRides, 1792540800, ZoneOffset.UTC)
        assertEquals(Vectors.json.getString("plaintext"), openBlob(keys, s.blob))
        assertEquals(2, s.days.size)
    }

    @Test
    fun emptyDaysAreNotSent() {
        val s = Payload.sealedWithinBudget(keys, listOf(Day("2026-10-19"), Day("2026-10-20", steps = 1)), emptyList(), 1)
        assertEquals(listOf("2026-10-20"), s.days.map { it.day })
        assertEquals(1, JSONObject(openBlob(keys, s.blob)!!).getJSONArray("d").length())
    }

    @Test
    fun twoWeeksOfEverythingFitWithoutTrimming() {
        val days = fullDays(LocalDate.parse("2026-10-20"), 14)
        val rides = (0 until 50).map { ride(LocalDate.parse("2026-10-07").plusDays(it % 14L), it) }
        val s = Payload.sealedWithinBudget(keys, days, rides, 1792540800, ZoneOffset.UTC)
        assertEquals(14, s.days.size)
        assertEquals(50, s.rides.size)
        assertTrue(s.blob.length <= Payload.BUDGET)
    }

    @Test
    fun trimsOldestDaysFirstAndStaysWithinBudget() {
        val last = LocalDate.parse("2026-10-20")
        val days = fullDays(last, 90).shuffled()
        val rides = (0 until 90).map { ride(last.minusDays(it.toLong()), it) }
        val s = Payload.sealedWithinBudget(keys, days, rides, 1792540800, ZoneOffset.UTC)

        assertTrue("${s.blob.length}", s.blob.length <= Payload.BUDGET)
        assertTrue(s.days.size in 1 until 90)
        // Zostają najnowsze dni, po kolei, bez dziur.
        val expected = (0 until s.days.size).map { last.minusDays(it.toLong()).toString() }.reversed()
        assertEquals(expected, s.days.map { it.day })
        // Przejazdy sprzed najstarszego zostawionego dnia odpadają; najwyżej 50.
        val oldest = LocalDate.parse(s.days.first().day).atStartOfDay(ZoneOffset.UTC).toEpochSecond()
        assertTrue(s.rides.all { it.start >= oldest })
        assertTrue(s.rides.size <= Payload.MAX_RIDES)
        // Koperta otwiera się do paczki z dokładnie tymi dniami.
        val p = JSONObject(openBlob(keys, s.blob)!!)
        assertEquals(s.days.size, p.getJSONArray("d").length())
        assertEquals(s.days.last().day, p.getJSONArray("d").getJSONObject(s.days.size - 1).getString("day"))
    }

    @Test
    fun duplicateRidesFromTwoAppsCountOnce() {
        val a = Ride(start = 1_000_000, sport = 2, sec = 3600, m = 25_000)
        val b = Ride(start = 1_000_000 + 120, sport = 2, sec = 3500, m = 25_400)
        val later = Ride(start = 1_000_000 + 4 * 3600, sport = 2, sec = 1800, m = 9_000)
        assertEquals(listOf(b, later), Payload.withoutDuplicateRides(listOf(later, a, b)))
    }

    @Test
    fun kindsSayWhatWasSent() {
        assertEquals(
            setOf(Kind.STEPS, Kind.DISTANCE, Kind.FLOORS, Kind.RESTING_HR, Kind.HEART_RATE, Kind.SLEEP, Kind.WEIGHT, Kind.RIDES),
            Payload.kinds(vectorDays, vectorRides),
        )
        assertEquals(setOf(Kind.HEART_RATE), Payload.kinds(listOf(Day("2026-10-20", hrMax = 150)), emptyList()))
    }

    private fun fullDays(last: LocalDate, n: Int) = (0 until n).map {
        Day(
            last.minusDays(it.toLong()).toString(), steps = 12_345, m = 9_876, floors = 14, rhr = 55,
            hrMin = 48, hrAvg = 72, hrMax = 165, sleep = 432, kg = 82.4,
        )
    }

    private fun ride(day: LocalDate, i: Int) =
        Ride(start = day.atTime(17, i % 60).toEpochSecond(ZoneOffset.UTC), sport = 2, sec = 3_600 + i, m = 20_000 + i)
}

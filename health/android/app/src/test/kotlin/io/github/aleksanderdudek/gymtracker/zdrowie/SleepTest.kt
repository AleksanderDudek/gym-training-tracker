package io.github.aleksanderdudek.gymtracker.zdrowie

import androidx.health.connect.client.records.SleepSessionRecord.Companion.STAGE_TYPE_AWAKE
import androidx.health.connect.client.records.SleepSessionRecord.Companion.STAGE_TYPE_AWAKE_IN_BED
import androidx.health.connect.client.records.SleepSessionRecord.Companion.STAGE_TYPE_DEEP
import androidx.health.connect.client.records.SleepSessionRecord.Companion.STAGE_TYPE_LIGHT
import androidx.health.connect.client.records.SleepSessionRecord.Companion.STAGE_TYPE_OUT_OF_BED
import androidx.health.connect.client.records.SleepSessionRecord.Companion.STAGE_TYPE_REM
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset

class SleepTest {
    private val warsaw = ZoneId.of("Europe/Warsaw")

    private fun at(local: String, zone: ZoneId = warsaw): Instant = LocalDateTime.parse(local).atZone(zone).toInstant()

    private fun session(from: String, to: String, vararg stages: SleepStage) = SleepSession(at(from), at(to), stages.toList())

    private fun stage(from: String, to: String, type: Int) = SleepStage(at(from), at(to), type)

    private fun day(s: String) = LocalDate.parse(s)

    @Test
    fun overlappingSessionsFromTwoAppsCountOnce() {
        val watch = session("2026-10-19T23:00", "2026-10-20T07:00")
        val phone = session("2026-10-19T23:30", "2026-10-20T07:30")
        // 23:00–7:30 to 8 h 30 min, a nie 16 h.
        assertEquals(mapOf(day("2026-10-20") to 510), Sleep.minutesByDay(listOf(watch, phone), warsaw))
    }

    @Test
    fun awakeAndOutOfBedAreSubtracted() {
        val night = session(
            "2026-10-19T23:00", "2026-10-20T07:00",
            stage("2026-10-19T23:00", "2026-10-20T01:00", STAGE_TYPE_LIGHT),
            stage("2026-10-20T01:00", "2026-10-20T01:20", STAGE_TYPE_AWAKE),
            stage("2026-10-20T01:20", "2026-10-20T03:00", STAGE_TYPE_DEEP),
            stage("2026-10-20T03:00", "2026-10-20T03:10", STAGE_TYPE_OUT_OF_BED),
            stage("2026-10-20T03:10", "2026-10-20T06:45", STAGE_TYPE_REM),
            stage("2026-10-20T06:45", "2026-10-20T07:00", STAGE_TYPE_AWAKE_IN_BED),
        )
        // 480 min w łóżku − 20 − 10 − 15 min czuwania.
        assertEquals(mapOf(day("2026-10-20") to 435), Sleep.minutesByDay(listOf(night), warsaw))
    }

    @Test
    fun theSameAwakeTimeFromTwoAppsIsSubtractedOnce() {
        val a = session("2026-10-19T23:00", "2026-10-20T07:00", stage("2026-10-20T03:00", "2026-10-20T03:30", STAGE_TYPE_AWAKE))
        val b = session("2026-10-19T23:00", "2026-10-20T07:00", stage("2026-10-20T03:10", "2026-10-20T03:40", STAGE_TYPE_AWAKE))
        assertEquals(mapOf(day("2026-10-20") to 440), Sleep.minutesByDay(listOf(a, b), warsaw))
    }

    @Test
    fun aNightAcrossMidnightBelongsToTheWakeUpDay() {
        val night = session("2026-10-20T22:00", "2026-10-21T06:00")
        val nap = session("2026-10-21T14:00", "2026-10-21T14:30")
        assertEquals(mapOf(day("2026-10-21") to 510), Sleep.minutesByDay(listOf(night, nap), warsaw))
    }

    @Test
    fun theWakeUpDayIsTheLocalDateOfThePhone() {
        // 20:00–23:30 UTC: w Warszawie (UTC+2) pobudka jest 21.10 o 1:30, w Londynie (UTC+1) 21.10 o 0:30,
        // a w strefie UTC jeszcze 20.10.
        val s = SleepSession(at("2026-10-20T20:00", ZoneOffset.UTC), at("2026-10-20T23:30", ZoneOffset.UTC))
        assertEquals(mapOf(day("2026-10-21") to 210), Sleep.minutesByDay(listOf(s), warsaw))
        assertEquals(mapOf(day("2026-10-21") to 210), Sleep.minutesByDay(listOf(s), ZoneId.of("Europe/London")))
        assertEquals(mapOf(day("2026-10-20") to 210), Sleep.minutesByDay(listOf(s), ZoneOffset.UTC))
    }

    @Test
    fun theNightTheClocksGoBackHasAnExtraHour() {
        // 25.10.2026 o 3:00 zegarki cofają się na 2:00: od 23:00 do 7:00 czasu lokalnego mija 9 godzin.
        val night = session("2026-10-24T23:00", "2026-10-25T07:00")
        assertEquals(mapOf(day("2026-10-25") to 540), Sleep.minutesByDay(listOf(night), warsaw))
    }

    @Test
    fun aDayHasAtMost1440Minutes() {
        val broken = session("2026-10-18T06:00", "2026-10-20T06:00")
        assertEquals(mapOf(day("2026-10-20") to 1440), Sleep.minutesByDay(listOf(broken), warsaw))
    }

    @Test
    fun emptyAndReversedSessionsAreIgnored() {
        val reversed = SleepSession(at("2026-10-20T07:00"), at("2026-10-19T23:00"))
        val empty = SleepSession(at("2026-10-20T07:00"), at("2026-10-20T07:00"))
        assertEquals(emptyMap<LocalDate, Int>(), Sleep.minutesByDay(listOf(reversed, empty), warsaw))
    }

    @Test
    fun secondsRoundToTheNearestMinute() {
        val s = SleepSession(at("2026-10-19T23:00"), at("2026-10-20T07:00").plusSeconds(31))
        assertEquals(mapOf(day("2026-10-20") to 481), Sleep.minutesByDay(listOf(s), warsaw))
    }
}

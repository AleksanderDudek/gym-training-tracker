import Foundation
#if !GT_CHECK
import XCTest
@testable import GymTrackerZdrowie
#endif

final class PayloadTests: XCTestCase {
    /// Dni i przejazd z wektora — `os` jest tam `android`, bo wektor dzieli się z Androidem.
    private let vectorDays = [
        Day(day: "2026-10-19", steps: 4210, m: 3120, floors: 3, rhr: 55, hrMin: 50, hrAvg: 74, hrMax: 131, sleep: 401),
        Day(
            day: "2026-10-20", steps: 9120, m: 7340, floors: 12, active: 35, rhr: 52, hrMin: 48, hrAvg: 71,
            hrMax: 142, sleep: 432, kg: 82.4),
    ]
    private let vectorRides = [Ride(start: 1_792_501_200, sport: 2, sec: 3600, m: 25000)]
    private let t = 1_792_540_800

    func testJSONMatchesVectorPlaintext() throws {
        let v = try Vector.load()
        XCTAssertEqual(Payload.json(days: vectorDays, rides: vectorRides, t: t, os: "android"), v.plaintext)
    }

    func testPhoneMarkerAndIOS() {
        let s = Payload.json(days: [], rides: [], t: t)
        XCTAssertEqual(s, #"{"v":1,"k":"phone","os":"ios","t":1792540800,"d":[],"a":[]}"#)
    }

    func testMissingFieldsAreOmitted() {
        XCTAssertEqual(Payload.dayJSON(Day(day: "2026-10-20", steps: 120)), #"{"day":"2026-10-20","steps":120}"#)
        XCTAssertEqual(Payload.dayJSON(Day(day: "2026-10-20", sleep: 0)), #"{"day":"2026-10-20","sleep":0}"#)
        XCTAssertTrue(Day(day: "2026-10-20").isEmpty)
        XCTAssertFalse(Day(day: "2026-10-20", kg: 80).isEmpty)
    }

    func testKgHasOneDecimalAndADot() {
        XCTAssertEqual(Payload.kgText(82.4), "82.4")
        XCTAssertEqual(Payload.kgText(82), "82.0")
        XCTAssertEqual(Payload.kgText(82.449), "82.4")
        XCTAssertEqual(Payload.kgText(82.46), "82.5")
        XCTAssertEqual(Payload.dayJSON(Day(day: "2026-10-20", kg: 101.04)), #"{"day":"2026-10-20","kg":101.0}"#)
    }

    func testSealedPayloadMatchesVectorBlob() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        let sealed = try Payload.sealedWithinBudget(
            keys: keys, days: vectorDays.reversed(), rides: vectorRides, t: t, os: "android", calendar: warsaw,
            iv: Seal.bytes(hex: v.iv))
        XCTAssertEqual(sealed, Sealed(blob: v.blob, days: 2, rides: 1))
    }

    func testEmptyRowsDroppedAndDaysSorted() throws {
        let keys = try XCTUnwrap(Seal.deriveKeys(try Vector.load().key))
        let days = [
            Day(day: "2026-10-20", steps: 2), Day(day: "2026-10-18"), Day(day: "2026-10-19", rhr: 60),
        ]
        let sealed = try Payload.sealedWithinBudget(keys: keys, days: days, rides: [], t: t, calendar: warsaw)
        XCTAssertEqual(sealed.days, 2)
        XCTAssertEqual(
            openEnvelope(keys, sealed.blob),
            #"{"v":1,"k":"phone","os":"ios","t":1792540800,"d":[{"day":"2026-10-19","rhr":60},{"day":"2026-10-20","steps":2}],"a":[]}"#
        )
    }

    func testTwoFullWeeksFitTheDefaultBudget() throws {
        let keys = try XCTUnwrap(Seal.deriveKeys(try Vector.load().key))
        let rides = (0..<50).map { Ride(start: 1_791_400_000 + $0 * 20_000, sport: 2, sec: 86_399, m: 299_999) }
        let sealed = try Payload.sealedWithinBudget(keys: keys, days: fullDays(14), rides: rides, t: t, calendar: warsaw)
        XCTAssertEqual(sealed.days, 14)
        XCTAssertEqual(sealed.rides, 50)
        XCTAssertLessThanOrEqual(sealed.blob.count, Payload.budget)
    }

    func testOverBudgetDropsOldestDaysAndTheirRides() throws {
        let v = try Vector.load()
        let keys = try XCTUnwrap(Seal.deriveKeys(v.key))
        let iv = try XCTUnwrap(Seal.bytes(hex: v.iv))
        let days = fullDays(14)
        // Przejazd o 8:00 każdego dnia; zostać mają te z zostawionych dni.
        let rides = days.map { Ride(start: Int(at($0.day + " 08:00").timeIntervalSince1970), sport: 2, sec: 3600, m: 20000) }
        let kept = Array(days.suffix(10))
        let keptRides = Array(rides.suffix(10))
        let expected = try Seal.seal(keys, Payload.json(days: kept, rides: keptRides, t: t), iv: iv)

        let sealed = try Payload.sealedWithinBudget(
            keys: keys, days: days, rides: rides, t: t, calendar: warsaw, budget: expected.count, iv: iv)
        XCTAssertEqual(sealed, Sealed(blob: expected, days: 10, rides: 10))
    }

    func testAtMostFiftyRidesNewestKept() throws {
        let keys = try XCTUnwrap(Seal.deriveKeys(try Vector.load().key))
        let rides = (0..<60).map { Ride(start: 1_791_400_000 + $0 * 3600, sport: 2, sec: 600, m: 3000) }
        let sealed = try Payload.sealedWithinBudget(keys: keys, days: [], rides: rides.shuffled(), t: t, calendar: warsaw)
        XCTAssertEqual(sealed.rides, 50)
        let text = try XCTUnwrap(openEnvelope(keys, sealed.blob))
        XCTAssertFalse(text.contains("\(rides[9].start)"))
        XCTAssertTrue(text.contains("\(rides[10].start)"))
    }

    /// `n` dni do 2026-10-20 włącznie, każdy z kompletem pól i największymi liczbami z zakresów.
    private func fullDays(_ n: Int) -> [Day] {
        (0..<n).map { i in
            let date = warsaw.date(byAdding: .day, value: i - n + 1, to: at("2026-10-20 12:00"))!
            return Day(
                day: Payload.dayKey(date, warsaw), steps: 100_000, m: 300_000, floors: 1000, active: 1440, rhr: 250,
                hrMin: 250, hrAvg: 250, hrMax: 250, sleep: 1440, kg: 299.9)
        }
    }
}

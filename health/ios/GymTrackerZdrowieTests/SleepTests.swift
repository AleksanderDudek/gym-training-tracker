import Foundation
#if !GT_CHECK
import XCTest
@testable import GymTrackerZdrowie
#endif

final class SleepTests: XCTestCase {
    private func s(_ from: String, _ to: String, _ kind: SleepKind = .asleep) -> SleepSample {
        SleepSample(start: at(from), end: at(to), kind: kind)
    }

    private func minutes(_ samples: [SleepSample]) -> [String: Int] {
        Sleep.minutesByDay(samples, calendar: warsaw)
    }

    func testIPhoneAndWatchOverlapCountsOnce() {
        let iPhone = s("2026-10-19 23:00", "2026-10-20 07:00")
        let watch = [
            s("2026-10-19 23:30", "2026-10-20 03:00"), s("2026-10-20 03:00", "2026-10-20 06:30"),
            s("2026-10-20 06:30", "2026-10-20 06:40", .awake),
        ]
        // 8 h snu z iPhone'a, z czego 10 minut zegarek widział jako czuwanie.
        XCTAssertEqual(minutes([iPhone] + watch), ["2026-10-20": 470])
        // Zegarek sięga pół godziny dalej: liczy się suma przedziałów, nie suma próbek.
        XCTAssertEqual(minutes([iPhone, s("2026-10-19 23:30", "2026-10-20 07:30")]), ["2026-10-20": 510])
    }

    func testAwakeIsNotSleep() {
        let night = [
            s("2026-10-19 23:00", "2026-10-20 02:00"), s("2026-10-20 02:00", "2026-10-20 02:30", .awake),
            s("2026-10-20 02:30", "2026-10-20 07:00"),
        ]
        XCTAssertEqual(minutes(night), ["2026-10-20": 450])
        XCTAssertEqual(minutes([s("2026-10-20 02:00", "2026-10-20 05:00", .awake)]), [:])
    }

    func testNightAcrossMidnightBelongsToTheWakeDay() {
        XCTAssertEqual(minutes([s("2026-10-19 22:30", "2026-10-20 06:30")]), ["2026-10-20": 480])
        // Kawałek przed północą i reszta po półgodzinnym wybudzeniu to wciąż ta sama noc.
        let split = [s("2026-10-19 23:00", "2026-10-19 23:50"), s("2026-10-20 00:20", "2026-10-20 06:00")]
        XCTAssertEqual(minutes(split), ["2026-10-20": 390])
    }

    func testInBedIsIgnored() {
        let bed = s("2026-10-19 22:00", "2026-10-20 08:00", .inBed)
        XCTAssertEqual(minutes([bed, s("2026-10-19 23:00", "2026-10-20 06:00")]), ["2026-10-20": 420])
        XCTAssertEqual(minutes([bed]), [:])
    }

    func testGapOverThreeHoursStartsANewNight() {
        let samples = [
            s("2026-10-19 23:00", "2026-10-20 07:00"),
            // Drzemka po południu: osobny blok, ten sam dzień pobudki.
            s("2026-10-20 14:00", "2026-10-20 14:30"),
            s("2026-10-20 23:30", "2026-10-21 06:30"),
        ]
        XCTAssertEqual(minutes(samples), ["2026-10-20": 510, "2026-10-21": 420])
    }

    func testDayIsClampedTo1440() {
        XCTAssertEqual(minutes([s("2026-10-18 07:00", "2026-10-20 07:00")]), ["2026-10-20": 1440])
        XCTAssertEqual(minutes([s("2026-10-20 07:00", "2026-10-20 07:00"), s("2026-10-20 08:00", "2026-10-20 07:00")]), [:])
    }
}

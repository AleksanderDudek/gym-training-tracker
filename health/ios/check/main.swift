import Foundation

// Testy bez Xcode: te same pliki co w GymTrackerZdrowieTests (koperta, paczka, sen), skompilowane
// z atrapą XCTest i uruchomione po kolei. check.sh liczy `func test…` w plikach testów i podaje tu
// tę liczbę — test dopisany tam, a zapomniany tutaj, kończy się błędem zamiast cichego pominięcia.

var count = 0

func run<T: XCTestCase>(_ type: T.Type, _ tests: [(String, (T) -> () throws -> Void)]) {
    for (name, test) in tests {
        count += 1
        let before = XCTestShim.failures.count
        do {
            try test(T())()
        } catch is XCTUnwrapError {
            // Już zapisane przez XCTUnwrap.
        } catch {
            XCTestShim.fail("\(name) rzucił \(error)", #filePath, #line)
        }
        let failed = XCTestShim.failures[before...]
        print(failed.isEmpty ? "  ok    \(T.self).\(name)" : "  BŁĄD  \(T.self).\(name)")
        for f in failed {
            print("        \(URL(fileURLWithPath: "\(f.file)").lastPathComponent):\(f.line): \(f.message)")
        }
    }
}

run(SealTests.self, [
    ("testCleanKeyIgnoresSpacesDashesAndCase", SealTests.testCleanKeyIgnoresSpacesDashesAndCase),
    ("testCleanKeyRejectsWhatIsNotAKey", SealTests.testCleanKeyRejectsWhatIsNotAKey),
    ("testDerivedKeysMatchVector", SealTests.testDerivedKeysMatchVector),
    ("testBlobMatchesVectorByteForByte", SealTests.testBlobMatchesVectorByteForByte),
    ("testRandomIVEveryTime", SealTests.testRandomIVEveryTime),
    ("testTamperedBlobDoesNotOpen", SealTests.testTamperedBlobDoesNotOpen),
    ("testRejectsWrongIVLength", SealTests.testRejectsWrongIVLength),
])

run(PayloadTests.self, [
    ("testJSONMatchesVectorPlaintext", PayloadTests.testJSONMatchesVectorPlaintext),
    ("testPhoneMarkerAndIOS", PayloadTests.testPhoneMarkerAndIOS),
    ("testMissingFieldsAreOmitted", PayloadTests.testMissingFieldsAreOmitted),
    ("testKgHasOneDecimalAndADot", PayloadTests.testKgHasOneDecimalAndADot),
    ("testSealedPayloadMatchesVectorBlob", PayloadTests.testSealedPayloadMatchesVectorBlob),
    ("testEmptyRowsDroppedAndDaysSorted", PayloadTests.testEmptyRowsDroppedAndDaysSorted),
    ("testTwoFullWeeksFitTheDefaultBudget", PayloadTests.testTwoFullWeeksFitTheDefaultBudget),
    ("testOverBudgetDropsOldestDaysAndTheirRides", PayloadTests.testOverBudgetDropsOldestDaysAndTheirRides),
    ("testAtMostFiftyRidesNewestKept", PayloadTests.testAtMostFiftyRidesNewestKept),
])

run(SleepTests.self, [
    ("testIPhoneAndWatchOverlapCountsOnce", SleepTests.testIPhoneAndWatchOverlapCountsOnce),
    ("testAwakeIsNotSleep", SleepTests.testAwakeIsNotSleep),
    ("testNightAcrossMidnightBelongsToTheWakeDay", SleepTests.testNightAcrossMidnightBelongsToTheWakeDay),
    ("testInBedIsIgnored", SleepTests.testInBedIsIgnored),
    ("testGapOverThreeHoursStartsANewNight", SleepTests.testGapOverThreeHoursStartsANewNight),
    ("testDayIsClampedTo1440", SleepTests.testDayIsClampedTo1440),
])

let expected = CommandLine.arguments.dropFirst().first.flatMap { Int($0) }
let failures = XCTestShim.failures.count
if let expected, expected != count {
    print("check: testów w plikach: \(expected), w check/main.swift: \(count) — dopisz brakujące.")
    exit(1)
}
print(failures == 0 ? "check: wszystkie testy przeszły (\(count))." : "check: błędy: \(failures) (testów: \(count)).")
exit(failures == 0 ? 0 : 1)

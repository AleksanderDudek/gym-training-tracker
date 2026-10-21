import Foundation
import HealthKit

// Odczyt ze Zdrowia: ostatnie 14 lokalnych dni, sen i przejazdy rowerem z dystansem.
//
// Zapytania statystyczne łączą źródła tak jak aplikacja Zdrowie — według kolejności źródeł, którą
// ustawia użytkownik — więc kroki z iPhone'a i zegarka nie liczą się dwa razy. Surowych próbek
// tętna ani kroków nie wysyłamy, tylko liczby dnia, które GYM TRACKER pokazuje (RODO, art. 5 ust. 1 c).
//
// HealthKit nigdy nie mówi, że odmówiono odczytu: brak zgody wygląda jak brak danych. Pusty wynik
// to więc po prostu brak pola w paczce.

struct HealthData: Sendable {
    let days: [Day]
    let rides: [Ride]
}

final class HealthReader: Sendable {
    static let shared = HealthReader()

    let store = HKHealthStore()

    static var available: Bool { HKHealthStore.isHealthDataAvailable() }

    /// Dokładnie to, co trafia do paczki — o nic więcej aplikacja nie prosi.
    static let readTypes: Set<HKObjectType> = [
        HKQuantityType(.stepCount), HKQuantityType(.distanceWalkingRunning), HKQuantityType(.flightsClimbed),
        HKQuantityType(.appleExerciseTime), HKQuantityType(.heartRate), HKQuantityType(.restingHeartRate),
        HKQuantityType(.bodyMass), HKCategoryType(.sleepAnalysis), HKObjectType.workoutType(),
        HKQuantityType(.distanceCycling),
    ]

    /// Arkusz zgód pokazuje się tylko raz na typ danych; później zmienia się je w Ustawieniach.
    func requestAuthorization() async throws {
        try await store.requestAuthorization(toShare: [], read: Self.readTypes)
    }

    func read(days n: Int = 14, now: Date = .now, calendar cal: Calendar = Payload.calendar()) async throws -> HealthData {
        let today = cal.startOfDay(for: now)
        let start = cal.date(byAdding: .day, value: -(n - 1), to: today)!
        let end = cal.date(byAdding: .day, value: 1, to: today)!
        let range = start..<end
        let perMinute = HKUnit.count().unitDivided(by: .minute())

        async let steps = daily(.stepCount, .cumulativeSum, .count(), range, cal)
        async let metres = daily(.distanceWalkingRunning, .cumulativeSum, .meter(), range, cal)
        async let floors = daily(.flightsClimbed, .cumulativeSum, .count(), range, cal)
        async let exercise = daily(.appleExerciseTime, .cumulativeSum, .minute(), range, cal)
        async let hr = daily(.heartRate, [.discreteMin, .discreteAverage, .discreteMax], perMinute, range, cal)
        async let rhr = daily(.restingHeartRate, .discreteAverage, perMinute, range, cal)
        async let kg = daily(.bodyMass, .mostRecent, .gramUnit(with: .kilo), range, cal)
        async let sleep = sleepByDay(range, cal)
        async let cycling = rides(range)

        let (s, m, f, e, h, r, w, z) = try await (steps, metres, floors, exercise, hr, rhr, kg, sleep)
        var out: [Day] = []
        var day = start
        while day < end {
            let k = Payload.dayKey(day, cal)
            let row = Day(
                day: k, steps: int(s[k]?.sum), m: int(m[k]?.sum), floors: int(f[k]?.sum), active: int(e[k]?.sum),
                rhr: int(r[k]?.avg), hrMin: int(h[k]?.min), hrAvg: int(h[k]?.avg), hrMax: int(h[k]?.max),
                sleep: z[k], kg: w[k]?.last)
            if !row.isEmpty { out.append(row) }
            day = cal.date(byAdding: .day, value: 1, to: day)!
        }
        return HealthData(days: out, rides: try await cycling)
    }

    /// Liczby jednego dnia z `HKStatistics` — tylko te, o które zapytanie prosiło.
    private struct Stat: Sendable {
        var sum, min, avg, max, last: Double?
    }

    /// Statystyki dzień po dniu od lokalnej północy. Interwał „1 dzień” liczy kalendarz, więc doba
    /// ze zmianą czasu ma 23 albo 25 godzin, jak w aplikacji Zdrowie.
    private func daily(
        _ id: HKQuantityTypeIdentifier, _ options: HKStatisticsOptions, _ unit: HKUnit, _ range: Range<Date>,
        _ cal: Calendar
    ) async throws -> [String: Stat] {
        try await soft([:]) {
            let type = HKQuantityType(id)
            let predicate = HKQuery.predicateForSamples(withStart: range.lowerBound, end: range.upperBound)
            let query = HKStatisticsCollectionQueryDescriptor(
                predicate: .quantitySample(type: type, predicate: predicate), options: options,
                anchorDate: range.lowerBound, intervalComponents: DateComponents(day: 1))
            var out: [String: Stat] = [:]
            for s in try await query.result(for: store).statistics() {
                func v(_ o: HKStatisticsOptions, _ q: () -> HKQuantity?) -> Double? {
                    options.contains(o) ? q()?.doubleValue(for: unit) : nil
                }
                out[Payload.dayKey(s.startDate, cal)] = Stat(
                    sum: v(.cumulativeSum) { s.sumQuantity() }, min: v(.discreteMin) { s.minimumQuantity() },
                    avg: v(.discreteAverage) { s.averageQuantity() }, max: v(.discreteMax) { s.maximumQuantity() },
                    last: v(.mostRecent) { s.mostRecentQuantity() })
            }
            return out
        }
    }

    /// Sen od 18:00 dnia przed zakresem — noc, która kończy się pierwszego dnia, zaczyna się wieczorem.
    private func sleepByDay(_ range: Range<Date>, _ cal: Calendar) async throws -> [String: Int] {
        try await soft([:]) {
            let dayBefore = cal.date(byAdding: .day, value: -1, to: range.lowerBound)!
            let from = cal.date(bySettingHour: 18, minute: 0, second: 0, of: dayBefore)!
            let query = HKSampleQueryDescriptor(
                predicates: [
                    .categorySample(
                        type: HKCategoryType(.sleepAnalysis),
                        predicate: HKQuery.predicateForSamples(withStart: from, end: range.upperBound))
                ],
                // Bez sortowania: `Sleep` i `Payload` układają po swojemu, a `SortDescriptor(\.startDate)`
                // w trybie Swift 5 jest ostrzeżeniem o nie-Sendable ścieżce klucza.
                sortDescriptors: [])
            let samples = try await query.result(for: store).compactMap { s -> SleepSample? in
                guard let kind = Self.kind(s.value) else { return nil }
                return SleepSample(start: s.startDate, end: s.endDate, kind: kind)
            }
            let first = Payload.dayKey(range.lowerBound, cal)
            // Noc, która skończyła się przed pierwszym dniem, należy do dnia spoza zakresu.
            return Sleep.minutesByDay(samples, calendar: cal).filter { $0.key >= first }
        }
    }

    static func kind(_ value: Int) -> SleepKind? {
        switch HKCategoryValueSleepAnalysis(rawValue: value) {
        case .inBed: .inBed
        case .awake: .awake
        case .asleepUnspecified, .asleepCore, .asleepDeep, .asleepREM: .asleep
        // Nowa wartość z przyszłego iOS — lepiej jej nie liczyć niż zgadywać.
        default: nil
        }
    }

    /// Przejazdy rowerem z dystansem: tylko one trafiają do GYM TRACKER (bieg i spacer są już w krokach).
    private func rides(_ range: Range<Date>) async throws -> [Ride] {
        try await soft([]) {
            let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
                HKQuery.predicateForWorkouts(with: .cycling),
                HKQuery.predicateForSamples(withStart: range.lowerBound, end: range.upperBound, options: .strictStartDate),
            ])
            let query = HKSampleQueryDescriptor(predicates: [.workout(predicate)], sortDescriptors: [])
            let cycling = HKQuantityType(.distanceCycling)
            return try await query.result(for: store).compactMap { w -> Ride? in
                // Starsze aplikacje zapisują dystans tylko w `totalDistance`, bez statystyk treningu.
                let q = w.statistics(for: cycling)?.sumQuantity() ?? w.totalDistance
                let metres = q?.doubleValue(for: .meter()) ?? 0
                guard metres > 0, w.duration >= 60 else { return nil }
                return Ride(
                    start: Int(w.startDate.timeIntervalSince1970), sport: Payload.cycling, sec: Int(w.duration.rounded()),
                    m: Int(metres.rounded()))
            }
        }
    }

    /// Błąd jednego rodzaju danych nie psuje reszty paczki — z wyjątkiem zablokowanego telefonu:
    /// wtedy nic nie da się przeczytać i cała wysyłka czeka na następną okazję.
    private func soft<T: Sendable>(_ empty: T, _ work: () async throws -> T) async throws -> T {
        do {
            return try await work()
        } catch let e as HKError where e.code == .errorDatabaseInaccessible {
            throw e
        } catch is CancellationError {
            throw CancellationError()
        } catch {
            return empty
        }
    }

    private func int(_ v: Double?) -> Int? {
        // `Int(_:)` przerywa program przy liczbie spoza zakresu; zakresy pól sprawdza i tak aplikacja.
        guard let v, v.isFinite, abs(v) < 1e9 else { return nil }
        return Int(v.rounded())
    }
}

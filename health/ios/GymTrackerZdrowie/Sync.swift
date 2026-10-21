import Foundation
import HealthKit

// Jedna wysyłka: Zdrowie → paczka → koperta → serwer. Wołają ją ekran, obserwatory HealthKit
// (przebudzenia w tle) i zadanie odświeżania w tle — często kilka naraz, stąd aktor i wspólna
// wysyłka w toku zamiast kilku równoległych.

enum SyncOutcome: String, Codable, Sendable {
    case sent, tooOften, rejected, offline, locked, empty, noKey, noHealth, failed
}

/// Ostatnia próba dla ekranu. W UserDefaults, bo ekran czyta ją także po przebudzeniu w tle.
struct SyncStatus: Codable, Equatable, Sendable {
    var at: Date
    var outcome: SyncOutcome
    var days: Int
    /// Ostatnia udana wysyłka — pokazywana, gdy ostatnia próba się nie udała.
    var sentAt: Date?
}

actor Sync {
    static let shared = Sync()
    /// Kroki przybywają co chwilę; częstsza wysyłka nic nie da, a zużywa baterię i limit serwera.
    static let minGap: TimeInterval = 15 * 60
    /// Wysyłka w tle też zmienia stan — ekran, jeśli jest otwarty, odświeża się na ten sygnał.
    static let changed = Notification.Name("io.github.aleksanderdudek.gymtracker.zdrowie.sync")

    private static let statusKey = "sync.status"

    private var running: Task<SyncOutcome?, Never>?

    /// Wynik albo `nil`, gdy wysyłka była niepotrzebna (ostatnia udana mniej niż 15 minut temu).
    /// `force` — przycisk „Wyślij teraz” i świeżo wklejony klucz.
    @discardableResult
    func run(force: Bool = false) async -> SyncOutcome? {
        if let current = running {
            let r = await current.value
            // Ta sama paczka właśnie poszła; druga zaraz po niej dostałaby od serwera „za często”.
            if r != nil || !force { return r }
        }
        let task = Task { await perform(force: force) }
        running = task
        let r = await withTaskCancellationHandler { await task.value } onCancel: { task.cancel() }
        if running == task { running = nil }
        return r
    }

    /// Czeka, aż skończy się wysyłka w toku — przy odłączaniu, żeby nie wskrzesiła skasowanej skrzynki.
    func idle() async {
        if let running { _ = await running.value }
    }

    private func perform(force: Bool) async -> SyncOutcome? {
        guard let key = KeyStore.load(), let keys = Seal.deriveKeys(key) else { return record(.noKey) }
        let now = Date()
        let status = Self.status()
        if !force, let sent = status?.sentAt, now.timeIntervalSince(sent) < Self.minGap { return nil }
        guard HealthReader.available else { return record(.noHealth) }

        let data: HealthData
        do {
            data = try await HealthReader.shared.read(now: now)
        } catch let e as HKError where e.code == .errorDatabaseInaccessible {
            // Zablokowany telefon: Zdrowie jest zaszyfrowane do odblokowania. Następne przebudzenie spróbuje.
            return record(.locked)
        } catch is CancellationError {
            return nil
        } catch {
            return record(.failed)
        }
        if Task.isCancelled { return nil }
        guard !data.days.isEmpty || !data.rides.isEmpty else { return record(.empty) }

        let sealed: Sealed
        do {
            sealed = try Payload.sealedWithinBudget(
                keys: keys, days: data.days, rides: data.rides, t: Int(now.timeIntervalSince1970))
        } catch {
            return record(.failed)
        }
        let outcome: SyncOutcome =
            switch await Sender.shared.push(box: keys.box, blob: sealed.blob) {
            case .ok: .sent
            case .tooOften: .tooOften
            case .rejected: .rejected
            case .offline: .offline
            }
        return record(outcome, days: sealed.days, at: now)
    }

    private func record(_ outcome: SyncOutcome, days: Int = 0, at now: Date = Date()) -> SyncOutcome {
        let sentAt = outcome == .sent ? now : Self.status()?.sentAt
        let status = SyncStatus(at: now, outcome: outcome, days: days, sentAt: sentAt)
        UserDefaults.standard.set(try? JSONEncoder().encode(status), forKey: Self.statusKey)
        NotificationCenter.default.post(name: Self.changed, object: nil)
        return outcome
    }

    nonisolated static func status() -> SyncStatus? {
        guard let data = UserDefaults.standard.data(forKey: statusKey) else { return nil }
        return try? JSONDecoder().decode(SyncStatus.self, from: data)
    }

    nonisolated static func reset() {
        UserDefaults.standard.removeObject(forKey: statusKey)
        NotificationCenter.default.post(name: changed, object: nil)
    }
}

extension SyncStatus {
    /// „dziś 14:05 — wysłane: 14 dni”.
    func text(now: Date = Date(), calendar: Calendar = .current) -> String {
        "\(Self.when(at, now: now, calendar: calendar)) — \(message)"
    }

    /// „Ostatnio wysłane: wczoraj 22:10”, gdy ostatnia próba się nie udała.
    func lastSent(now: Date = Date(), calendar: Calendar = .current) -> String? {
        guard outcome != .sent, let sentAt else { return nil }
        return "Ostatnio wysłane: \(Self.when(sentAt, now: now, calendar: calendar))"
    }

    var message: String {
        switch outcome {
        case .sent: "wysłane: \(days) \(days == 1 ? "dzień" : "dni")"
        case .tooOften: "Serwer: za często, spróbuj za minutę"
        case .rejected: "Serwer odrzucił paczkę"
        case .offline: "Brak sieci albo serwer nie odpowiada"
        case .locked: "Telefon zablokowany — spróbuję później"
        case .empty: "Zdrowie nie oddało żadnych danych — sprawdź dostęp"
        case .noKey: "Brak klucza — wklej go z GYM TRACKER"
        case .noHealth: "To urządzenie nie ma aplikacji Zdrowie"
        case .failed: "Nie udało się odczytać Zdrowia — spróbuję później"
        }
    }

    static func when(_ date: Date, now: Date, calendar: Calendar) -> String {
        let f = DateFormatter()
        f.calendar = calendar
        f.timeZone = calendar.timeZone
        f.locale = Locale(identifier: "pl_PL")
        f.dateFormat = "HH:mm"
        let time = f.string(from: date)
        if calendar.isDate(date, inSameDayAs: now) { return "dziś \(time)" }
        if let y = calendar.date(byAdding: .day, value: -1, to: now), calendar.isDate(date, inSameDayAs: y) {
            return "wczoraj \(time)"
        }
        f.dateFormat = "d.MM HH:mm"
        return f.string(from: date)
    }
}

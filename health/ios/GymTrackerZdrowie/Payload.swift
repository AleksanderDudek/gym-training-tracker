import Foundation

// Paczka „phone v1” — tekst JSON wewnątrz koperty. Format opisuje spec
// (docs/superpowers/specs/2026-10-21-zdrowie-telefon-design.md), a czyta ją `src/engine/phone.ts`.
// Pole bez pomiaru albo bez zgody po prostu znika z wiersza; aplikacja sprawdza zakresy sama.

/// Jeden lokalny dzień telefonu.
struct Day: Equatable, Sendable {
    var day: String
    var steps: Int? = nil
    /// Metry chodu i biegu.
    var m: Int? = nil
    var floors: Int? = nil
    /// Minuty ćwiczeń (pierścień „Ćwiczenia”).
    var active: Int? = nil
    var rhr: Int? = nil
    var hrMin: Int? = nil
    var hrAvg: Int? = nil
    var hrMax: Int? = nil
    /// Minuty snu w nocy, która kończy się tego dnia.
    var sleep: Int? = nil
    /// Ostatnie ważenie dnia.
    var kg: Double? = nil

    /// Wiersz bez żadnej liczby nic aplikacji nie mówi — nie ma po co go wysyłać.
    var isEmpty: Bool {
        [steps, m, floors, active, rhr, hrMin, hrAvg, hrMax, sleep].allSatisfy { $0 == nil } && kg == nil
    }
}

/// Przejazd rowerem z dystansem. `sport` w numeracji FIT (2 = rower), jak w paczce zegarka.
struct Ride: Equatable, Sendable {
    var start: Int
    var sport: Int
    var sec: Int
    var m: Int
}

struct Sealed: Equatable, Sendable {
    let blob: String
    let days: Int
    let rides: Int
}

enum Payload {
    /// Serwer przyjmuje do 12 000 znaków; tysiąc zapasu na wypadek, gdyby limit kiedyś zmalał.
    static let budget = 11_000
    static let maxDays = 31
    static let maxRides = 50
    static let cycling = 2

    /// Kalendarz dni paczki: zawsze gregoriański — telefon może mieć ustawiony buddyjski albo
    /// japoński, a `day` musi wyglądać jak w aplikacji — w strefie czasowej telefonu.
    static func calendar(_ zone: TimeZone = .current) -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = zone
        return c
    }

    /// Lokalna data, `2026-10-20`.
    static func dayKey(_ date: Date, _ cal: Calendar) -> String {
        let d = cal.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04ld-%02ld-%02ld", d.year ?? 0, d.month ?? 0, d.day ?? 0)
    }

    /// Klucze w stałej kolejności (`v,k,os,t,d,a`) — tak samo pisze Android i wektor testowy,
    /// więc ta sama paczka daje tę samą kopertę na obu telefonach.
    static func json(days: [Day], rides: [Ride], t: Int, os: String = "ios") -> String {
        let d = days.map(dayJSON).joined(separator: ",")
        let a = rides.map { #"{"start":\#($0.start),"sport":\#($0.sport),"sec":\#($0.sec),"m":\#($0.m)}"# }
            .joined(separator: ",")
        return #"{"v":1,"k":"phone","os":"\#(os)","t":\#(t),"d":[\#(d)],"a":[\#(a)]}"#
    }

    static func dayJSON(_ d: Day) -> String {
        var f = [#""day":"\#(d.day)""#]
        let ints: [(String, Int?)] = [
            ("steps", d.steps), ("m", d.m), ("floors", d.floors), ("active", d.active), ("rhr", d.rhr),
            ("hrMin", d.hrMin), ("hrAvg", d.hrAvg), ("hrMax", d.hrMax), ("sleep", d.sleep),
        ]
        for (k, v) in ints {
            if let v { f.append(#""\#(k)":\#(v)"#) }
        }
        if let kg = d.kg, kg.isFinite { f.append(#""kg":\#(kgText(kg))"#) }
        return "{" + f.joined(separator: ",") + "}"
    }

    /// Jedno miejsce po przecinku i zawsze kropka — polski telefon z `%f` i lokalizacją dałby przecinek.
    static func kgText(_ kg: Double) -> String {
        String(format: "%.1f", locale: Locale(identifier: "en_US_POSIX"), (kg * 10).rounded() / 10)
    }

    /// Zapieczętowana paczka nie dłuższa niż `budget`. Gdy się nie mieści, odpadają najstarsze dni
    /// (i przejazdy sprzed najstarszego zostawionego dnia) — najnowsze dane są najcenniejsze,
    /// a starsze aplikacja zwykle już ma z poprzednich paczek.
    static func sealedWithinBudget(
        keys: SealKeys,
        days: [Day],
        rides: [Ride],
        t: Int,
        os: String = "ios",
        calendar cal: Calendar = Payload.calendar(),
        budget: Int = Payload.budget,
        iv: Data? = nil
    ) throws -> Sealed {
        var d = Array(days.filter { !$0.isEmpty }.sorted { $0.day < $1.day }.suffix(maxDays))
        var r = Array(rides.sorted { $0.start < $1.start }.suffix(maxRides))
        while true {
            let blob = try Seal.seal(keys, json(days: d, rides: r, t: t, os: os), iv: iv)
            if blob.count <= budget { return Sealed(blob: blob, days: d.count, rides: r.count) }
            if !d.isEmpty {
                d.removeFirst()
                if let oldest = d.first?.day {
                    r.removeAll { dayKey(Date(timeIntervalSince1970: TimeInterval($0.start)), cal) < oldest }
                } else {
                    r.removeAll()
                }
            } else if !r.isEmpty {
                r.removeFirst()
            } else {
                // Pusta paczka to ~150 znaków — tu dochodzi się tylko przy absurdalnym `budget`.
                return Sealed(blob: blob, days: 0, rides: 0)
            }
        }
    }
}

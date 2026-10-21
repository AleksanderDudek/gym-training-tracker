import Foundation

// Minuty snu na dzień pobudki, z próbek `sleepAnalysis`.
//
// Tę samą noc zapisuje zwykle kilka źródeł naraz (iPhone, Apple Watch, Garmin Connect, AutoSleep…),
// a fazy jednego źródła nie nachodzą na siebie. Suma próbek liczyłaby więc noc dwa razy — liczy się
// suma zbiorów: czas, w którym choć jedno źródło widzi sen, minus czas, w którym któreś widzi
// czuwanie. „W łóżku” to nie sen (iPhone zapisuje tak sam harmonogram snu), więc odpada.

enum SleepKind: Sendable {
    case asleep
    case awake
    case inBed
}

struct SleepSample: Sendable {
    let start: Date
    let end: Date
    let kind: SleepKind
}

enum Sleep {
    /// Przerwa dłuższa niż 3 godziny zaczyna nową noc — krótsze to wybudzenia w tej samej.
    static let nightGap: TimeInterval = 3 * 3600

    private struct Span {
        var start: Double
        var end: Double
    }

    /// Minuty snu według lokalnej daty końca nocy: noc 23:00–07:00 należy w całości do dnia,
    /// w którym się kończy — jak „sen ostatniej nocy” z zegarka. Drzemka tego samego dnia dolicza się.
    static func minutesByDay(_ samples: [SleepSample], calendar cal: Calendar) -> [String: Int] {
        let asleep = union(samples.filter { $0.kind == .asleep })
        let awake = union(samples.filter { $0.kind == .awake })
        var seconds: [String: Double] = [:]
        var night: [Span] = []
        func close() {
            guard let last = night.last else { return }
            let day = Payload.dayKey(Date(timeIntervalSinceReferenceDate: last.end), cal)
            seconds[day, default: 0] += night.reduce(0) { $0 + $1.end - $1.start }
            night = []
        }
        for s in subtract(asleep, awake) {
            if let last = night.last, s.start - last.end > nightGap { close() }
            night.append(s)
        }
        close()
        return seconds.mapValues { min(1440, max(0, Int(($0 / 60).rounded()))) }
    }

    /// Posortowane, rozłączne przedziały — nakładające się próbki różnych źródeł zlewają się w jeden.
    private static func union(_ samples: [SleepSample]) -> [Span] {
        let spans = samples
            .map { Span(start: $0.start.timeIntervalSinceReferenceDate, end: $0.end.timeIntervalSinceReferenceDate) }
            .filter { $0.end > $0.start }
            .sorted { $0.start < $1.start }
        var out: [Span] = []
        for s in spans {
            if let last = out.last, s.start <= last.end {
                out[out.count - 1].end = max(last.end, s.end)
            } else {
                out.append(s)
            }
        }
        return out
    }

    /// `a` bez `b`; oba posortowane i rozłączne, jak z `union`.
    private static func subtract(_ a: [Span], _ b: [Span]) -> [Span] {
        var out: [Span] = []
        for var s in a {
            for c in b where c.end > s.start && c.start < s.end {
                if c.start > s.start { out.append(Span(start: s.start, end: c.start)) }
                s.start = c.end
                if s.start >= s.end { break }
            }
            if s.start < s.end { out.append(s) }
        }
        return out
    }
}

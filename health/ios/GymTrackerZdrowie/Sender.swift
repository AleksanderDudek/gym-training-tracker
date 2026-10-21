import Foundation

// Wysyłka koperty do skrzynki na serwerze GYM TRACKER — tej samej, do której pisze zegarek Garmin.
// Serwer trzyma tylko najnowszą paczkę i nie zna klucza; ścieżka `/garmin/…` to historia, nie zegarek.

enum SendResult: String, Codable, Sendable {
    case ok
    /// Serwer przyjmuje jedną paczkę na minutę na skrzynkę.
    case tooOften
    /// Zły identyfikator skrzynki albo koperta — błąd w aplikacji, ponowienie nic nie da.
    case rejected
    /// Brak sieci, przekroczony czas albo serwer nie odpowiada jak trzeba.
    case offline
}

struct Sender: Sendable {
    static let shared = Sender(base: apiURL())

    let base: URL
    private let session: URLSession

    init(base: URL) {
        self.base = base
        // Bez ciasteczek i pamięci podręcznej; 15 s, bo przebudzenie w tle ma tylko chwilę na pracę.
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 15
        config.timeoutIntervalForResource = 15
        session = URLSession(configuration: config)
    }

    /// Adres z Info.plist (`API_URL` w ustawieniach buildu), a bez niego serwer zegarka.
    static func apiURL(_ bundle: Bundle = .main) -> URL {
        let raw = (bundle.object(forInfoDictionaryKey: "API_URL") as? String)?
            .trimmingCharacters(in: .whitespaces)
        if let raw, raw.hasPrefix("https://"), let url = URL(string: raw) { return url }
        return URL(string: "https://gym-tracker-api.instrukcje-app.workers.dev")!
    }

    func push(box: String, blob: String) async -> SendResult {
        guard let status = await post("garmin/push", ["box": box, "blob": blob]) else { return .offline }
        switch status {
        case 200..<300: return .ok
        case 429: return .tooOften
        case 400..<500: return .rejected
        default: return .offline
        }
    }

    /// Skasowanie paczki przy odłączaniu. `false`, gdy serwer nie potwierdził — paczka i tak zniknie
    /// sama po 7 dniach bez wysyłki.
    func forget(box: String) async -> Bool {
        guard let status = await post("garmin/forget", ["box": box]) else { return false }
        return (200..<300).contains(status)
    }

    private func post(_ path: String, _ body: [String: String]) async -> Int? {
        var req = URLRequest(url: base.appendingPathComponent(path))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let encoder = JSONEncoder()
        encoder.outputFormatting = .withoutEscapingSlashes
        guard let data = try? encoder.encode(body) else { return nil }
        req.httpBody = data
        do {
            let (_, response) = try await session.data(for: req)
            return (response as? HTTPURLResponse)?.statusCode
        } catch {
            return nil
        }
    }
}

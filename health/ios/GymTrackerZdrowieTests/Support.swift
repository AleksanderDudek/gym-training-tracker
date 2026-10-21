import CommonCrypto
import CryptoKit
import Foundation
#if !GT_CHECK
import XCTest
@testable import GymTrackerZdrowie
#endif

// Wspólne dla testów: wektor koperty z health/vectors.json i otwieranie koperty (aplikacja na
// telefonie tylko pieczętuje — otwiera GYM TRACKER — więc `open` żyje tylko tutaj).
//
// `GT_CHECK` ustawia check.sh: te same pliki kompilują się wtedy bez Xcode, z atrapą XCTest.

struct Vector: Decodable {
    let key: String
    let iv: String
    let box: String
    let enc: String
    let mac: String
    let plaintext: String
    let blob: String

    /// Z zasobów paczki testów (Xcode), a bez niej z repozytorium obok (`check.sh`).
    static func load(file: StaticString = #filePath) throws -> Vector {
        let url = Bundle(for: Marker.self).url(forResource: "vectors", withExtension: "json")
            ?? URL(fileURLWithPath: "\(file)").deletingLastPathComponent()
            .appendingPathComponent("../../vectors.json").standardizedFileURL
        return try JSONDecoder().decode(Vector.self, from: Data(contentsOf: url))
    }

    private final class Marker {}
}

/// Odwrotność `Seal.seal`, jak `open` w src/watchseal.ts: najpierw podpis, potem szyfr.
func openEnvelope(_ keys: SealKeys, _ blob: String) -> String? {
    guard let env = Data(base64Encoded: blob), env.count >= 1 + 16 + 16 + 32, env.first == 1 else { return nil }
    let head = env.prefix(env.count - 32)
    let tag = env.suffix(32)
    guard HMAC<SHA256>.isValidAuthenticationCode(tag, authenticating: head, using: SymmetricKey(data: keys.mac))
    else { return nil }
    let iv = head.dropFirst().prefix(16)
    let cipher = head.dropFirst(17)
    var plain = Data(count: cipher.count)
    var written = 0
    let status = plain.withUnsafeMutableBytes { out in
        cipher.withUnsafeBytes { inp in
            keys.enc.withUnsafeBytes { key in
                iv.withUnsafeBytes { ivp in
                    CCCrypt(
                        CCOperation(kCCDecrypt), CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding),
                        key.baseAddress, key.count, ivp.baseAddress,
                        inp.baseAddress, inp.count, out.baseAddress, out.count, &written)
                }
            }
        }
    }
    guard status == kCCSuccess else { return nil }
    return String(data: plain.prefix(written), encoding: .utf8)
}

/// Strefa z czasem letnim — testy nie zależą od strefy maszyny, na której chodzą.
let warsaw = Payload.calendar(TimeZone(identifier: "Europe/Warsaw")!)

/// Chwila w Warszawie, `"2026-10-19 23:00"`.
func at(_ s: String) -> Date {
    let f = DateFormatter()
    f.calendar = warsaw
    f.timeZone = warsaw.timeZone
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd HH:mm"
    return f.date(from: s)!
}

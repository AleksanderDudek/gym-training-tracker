import CommonCrypto
import CryptoKit
import Foundation
import Security

// Koperta danych: 0x01 ‖ IV ‖ AES-256-CBC(PKCS#7) ‖ HMAC-SHA256 ze wszystkiego przed nim, w base64.
// Ten sam format pieczętuje zegarek (garmin/source/Seal.mc) i otwiera aplikacja (src/watchseal.ts).
// Wspólny wektor w health/vectors.json pilnuje, żeby wszystkie końce dawały bajt w bajt to samo
// dla tego samego klucza i IV.
//
// Z klucza wychodzą trzy klucze pochodne, jak w HKDF-Expand z jednym blokiem:
// HMAC(klucz, etykieta ‖ 0x01) dla "gt-box" (adres skrzynki), "gt-enc" (AES) i "gt-mac" (podpis).

struct SealKeys: Equatable, Sendable {
    /// Identyfikator skrzynki na serwerze, 32 znaki hex.
    let box: String
    let enc: Data
    let mac: Data
}

enum SealError: Error {
    case random
    case cipher
}

enum Seal {
    static let version: UInt8 = 1
    static let ivSize = 16

    /// Klucz z GYM TRACKER: 64 znaki hex. Spacje, łączniki, nowe linie i wielkość liter nie mają
    /// znaczenia — tak samo jak `cleanKey` w aplikacji. Inny znak to nie klucz, tylko coś
    /// wklejonego razem z nim.
    static func cleanKey(_ raw: String) -> String? {
        let k = String(raw.filter { !$0.isWhitespace && $0 != "-" }).lowercased()
        // Tylko ASCII: `isHexDigit` przepuściłby cyfry pełnej szerokości.
        let hex = k.utf8.allSatisfy { (48...57).contains($0) || (97...102).contains($0) }
        return hex && k.utf8.count == 64 ? k : nil
    }

    static func deriveKeys(_ keyHex: String) -> SealKeys? {
        guard let k = cleanKey(keyHex), let secret = bytes(hex: k) else { return nil }
        let key = SymmetricKey(data: secret)
        func derive(_ label: String) -> Data {
            Data(HMAC<SHA256>.authenticationCode(for: Data(label.utf8) + [0x01], using: key))
        }
        return SealKeys(box: hex(derive("gt-box").prefix(16)), enc: derive("gt-enc"), mac: derive("gt-mac"))
    }

    /// Pieczętowanie jak na zegarku. IV podaje tylko test — inaczej losowy, nowy przy każdej paczce.
    static func seal(_ keys: SealKeys, _ text: String, iv: Data? = nil) throws -> String {
        let iv = try iv ?? randomIV()
        guard iv.count == ivSize, keys.enc.count == kCCKeySizeAES256 else { throw SealError.cipher }
        let plain = Data(text.utf8)
        // PKCS#7 dokłada od 1 do 16 bajtów, więc miejsca na jeden blok więcej zawsze wystarczy.
        var cipher = Data(count: plain.count + kCCBlockSizeAES128)
        var written = 0
        let status = cipher.withUnsafeMutableBytes { out in
            plain.withUnsafeBytes { inp in
                keys.enc.withUnsafeBytes { key in
                    iv.withUnsafeBytes { ivp in
                        CCCrypt(
                            CCOperation(kCCEncrypt), CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding),
                            key.baseAddress, key.count, ivp.baseAddress,
                            inp.baseAddress, inp.count, out.baseAddress, out.count, &written)
                    }
                }
            }
        }
        guard status == kCCSuccess else { throw SealError.cipher }
        cipher.count = written
        let head = Data([version]) + iv + cipher
        let tag = HMAC<SHA256>.authenticationCode(for: head, using: SymmetricKey(data: keys.mac))
        // Bez łamania linii: serwer i aplikacja czytają base64 w jednym kawałku.
        return (head + Data(tag)).base64EncodedString()
    }

    static func randomIV() throws -> Data {
        var iv = Data(count: ivSize)
        let status = iv.withUnsafeMutableBytes { SecRandomCopyBytes(kSecRandomDefault, ivSize, $0.baseAddress!) }
        // Bez losowego IV nie pieczętujemy wcale — zerowy IV zdradzałby powtarzające się początki paczek.
        guard status == errSecSuccess else { throw SealError.random }
        return iv
    }

    static func bytes(hex: String) -> Data? {
        let u = Array(hex.utf8)
        guard u.count % 2 == 0 else { return nil }
        var out = Data(capacity: u.count / 2)
        for i in stride(from: 0, to: u.count, by: 2) {
            guard let b = UInt8(String(decoding: u[i..<i + 2], as: UTF8.self), radix: 16) else { return nil }
            out.append(b)
        }
        return out
    }

    /// Małymi literami, jak identyfikator skrzynki po stronie serwera i aplikacji.
    static func hex<D: Sequence>(_ data: D) -> String where D.Element == UInt8 {
        data.map { String(format: "%02x", $0) }.joined()
    }
}

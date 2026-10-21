import Foundation
import Security

// Klucz z GYM TRACKER w pęku kluczy. „Po pierwszym odblokowaniu, tylko to urządzenie”:
// przebudzenie w tle przy zablokowanym telefonie może go przeczytać, a klucz nie trafia
// do kopii zapasowej ani na inny telefon — kto ma klucz, odczyta dane o zdrowiu.

enum KeyStore {
    private static var base: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "io.github.aleksanderdudek.gymtracker.zdrowie",
            kSecAttrAccount as String: "phone-key",
            // Na iPhonie to i tak jedyny pęk kluczy; flaga liczy się tylko na Macu.
            kSecUseDataProtectionKeychain as String: true,
        ]
    }

    static func load() -> String? {
        var query = base
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func save(_ key: String) -> Bool {
        let attrs: [String: Any] = [
            kSecValueData as String: Data(key.utf8),
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
        ]
        let status = SecItemUpdate(base as CFDictionary, attrs as CFDictionary)
        if status == errSecItemNotFound {
            return SecItemAdd(base.merging(attrs) { $1 } as CFDictionary, nil) == errSecSuccess
        }
        return status == errSecSuccess
    }

    static func delete() {
        SecItemDelete(base as CFDictionary)
    }
}

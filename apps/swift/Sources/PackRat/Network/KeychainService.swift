import Foundation
import Security

final class KeychainService: Sendable {
    static let shared = KeychainService()
    private init() {}

    private let service = "com.andrewbierman.packrat"
    private let userDefaultsPrefix = "e2e_auth_"
    private var usesUserDefaultsStorage: Bool {
        ProcessInfo.processInfo.arguments.contains("--use-userdefaults-auth")
    }

    enum Key: String {
        // Better Auth issues a single long-lived session token returned via the
        // `set-auth-token` response header and used as `Authorization: Bearer …`
        // on subsequent calls. There is no separate refresh token — when the
        // session expires the user re-authenticates.
        case sessionToken = "session_token"
    }

    var sessionToken: String? { read(.sessionToken) }

    func saveSessionToken(_ token: String) {
        save(token, for: .sessionToken)
    }

    /// Removes any persisted auth material. Used on logout and by the
    /// `--reset-auth` XCUITest launch argument to land each run on the
    /// login screen.
    func clearTokens() {
        delete(.sessionToken)
    }

    private func save(_ value: String, for key: Key) {
        if usesUserDefaultsStorage {
            UserDefaults.standard.set(value, forKey: userDefaultsKey(key))
            return
        }
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    private func read(_ key: Key) -> String? {
        if usesUserDefaultsStorage {
            return UserDefaults.standard.string(forKey: userDefaultsKey(key))
        }
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data
        else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(_ key: Key) {
        if usesUserDefaultsStorage {
            UserDefaults.standard.removeObject(forKey: userDefaultsKey(key))
            return
        }
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private func userDefaultsKey(_ key: Key) -> String {
        "\(userDefaultsPrefix)\(key.rawValue)"
    }
}

import Foundation
import Security

final class KeychainService: Sendable {
    static let shared = KeychainService()
    private init() {}

    private let service = "com.andrewbierman.packrat"
    private let legacyExpoService = "app"
    private let legacyExpoCookieAccount = "packrat_cookie"
    private let legacyExpoSessionCookieNames = [
        "better-auth.session_token",
        "__Secure-better-auth.session_token",
    ]
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

    var sessionToken: String? {
        if let token = read(.sessionToken) {
            return token
        }
        guard let token = readLegacyExpoSessionToken() else {
            return nil
        }
        saveSessionToken(token)
        return token
    }

    func saveSessionToken(_ token: String) {
        save(token, for: .sessionToken)
    }

    /// Removes any persisted auth material. Used on logout and by the
    /// `--reset-auth` XCUITest launch argument to land each run on the
    /// login screen.
    func clearTokens() {
        delete(.sessionToken)
        deleteLegacyExpoCookie()
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

    private func readLegacyExpoSessionToken() -> String? {
        if usesUserDefaultsStorage {
            return nil
        }
        guard let cookieData = readRawKeychainValue(
            service: legacyExpoService,
            account: legacyExpoCookieAccount,
            generic: legacyExpoCookieAccount
        ) ?? readRawKeychainValue(
            service: legacyExpoService,
            account: legacyExpoCookieAccount,
            generic: nil
        ),
            let cookieString = String(data: cookieData, encoding: .utf8),
            let data = cookieString.data(using: .utf8),
            let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else {
            return nil
        }

        for cookieName in legacyExpoSessionCookieNames {
            guard let cookie = object[cookieName] as? [String: Any],
                  let value = cookie["value"] as? String,
                  !value.isEmpty
            else {
                continue
            }
            return value
        }
        return nil
    }

    private func readRawKeychainValue(service: String, account: String, generic: String?) -> Data? {
        var query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
            kSecReturnData: true,
            kSecMatchLimit: kSecMatchLimitOne,
        ]
        if let generic {
            query[kSecAttrGeneric] = generic.data(using: .utf8)
        }
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else {
            return nil
        }
        return result as? Data
    }

    private func saveRawKeychainValue(_ value: String, service: String, account: String, generic: String?) {
        let data = Data(value.utf8)
        var query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: account,
        ]
        if let generic {
            query[kSecAttrGeneric] = generic.data(using: .utf8)
        }
        SecItemDelete(query as CFDictionary)
        var attributes = query
        attributes[kSecValueData] = data
        SecItemAdd(attributes as CFDictionary, nil)
    }

    private func deleteLegacyExpoCookie() {
        if usesUserDefaultsStorage {
            return
        }
        let preciseQuery: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: legacyExpoService,
            kSecAttrAccount: legacyExpoCookieAccount,
            kSecAttrGeneric: legacyExpoCookieAccount.data(using: .utf8) as Any,
        ]
        SecItemDelete(preciseQuery as CFDictionary)

        let fallbackQuery: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: legacyExpoService,
            kSecAttrAccount: legacyExpoCookieAccount,
        ]
        SecItemDelete(fallbackQuery as CFDictionary)
    }

    #if DEBUG
    func saveLegacyExpoCookieForTesting(_ value: String) {
        saveRawKeychainValue(
            value,
            service: legacyExpoService,
            account: legacyExpoCookieAccount,
            generic: legacyExpoCookieAccount
        )
    }

    func clearLegacyExpoCookieForTesting() {
        deleteLegacyExpoCookie()
    }
    #endif
}

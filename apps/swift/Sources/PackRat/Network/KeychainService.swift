import Foundation
import Security

final class KeychainService: Sendable {
    static let shared = KeychainService()
    private init() {}

    private let service = "com.andrewbierman.packrat"
    /// expo-secure-store's default service, and the two suffixed variants it
    /// actually writes under. `query(with:options:requireAuthentication:)` appends
    /// ":no-auth"/":auth" whenever `requireAuthentication` is non-nil, which it is
    /// on every write — so a real Expo install stores `packrat_cookie` under
    /// "app:no-auth", never bare "app". Its own reader tries all three in this
    /// order (no-auth, auth, then the legacy unsuffixed name), and so must we, or
    /// a signed-in user is logged out by the update.
    private let legacyExpoServices = ["app:no-auth", "app:auth", "app"]
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

    /// Reads Expo's `packrat_cookie` across every service name expo-secure-store
    /// may have written it under. The generic attribute is tried first because
    /// that is what expo-secure-store sets, then omitted for items written by
    /// older versions that left it unset.
    private func readLegacyExpoCookieData() -> Data? {
        for service in legacyExpoServices {
            if let data = readRawKeychainValue(
                service: service,
                account: legacyExpoCookieAccount,
                generic: legacyExpoCookieAccount
            ) ?? readRawKeychainValue(
                service: service,
                account: legacyExpoCookieAccount,
                generic: nil
            ) {
                return data
            }
        }
        return nil
    }

    private func readLegacyExpoSessionToken() -> String? {
        if usesUserDefaultsStorage {
            return nil
        }
        guard let cookieData = readLegacyExpoCookieData(),
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
        // Every service variant, or logout leaves a cookie behind that the next
        // `sessionToken` read would silently promote back into a live session.
        for service in legacyExpoServices {
            let preciseQuery: [CFString: Any] = [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: service,
                kSecAttrAccount: legacyExpoCookieAccount,
                kSecAttrGeneric: legacyExpoCookieAccount.data(using: .utf8) as Any,
            ]
            SecItemDelete(preciseQuery as CFDictionary)

            let fallbackQuery: [CFString: Any] = [
                kSecClass: kSecClassGenericPassword,
                kSecAttrService: service,
                kSecAttrAccount: legacyExpoCookieAccount,
            ]
            SecItemDelete(fallbackQuery as CFDictionary)
        }
    }

    #if DEBUG
    /// Writes under the service a real expo-secure-store install uses, so tests
    /// exercise the same lookup a shipped update performs. Pass an explicit
    /// service to cover the other variants.
    func saveLegacyExpoCookieForTesting(_ value: String, service: String = "app:no-auth") {
        saveRawKeychainValue(
            value,
            service: service,
            account: legacyExpoCookieAccount,
            generic: legacyExpoCookieAccount
        )
    }

    func clearLegacyExpoCookieForTesting() {
        deleteLegacyExpoCookie()
    }
    #endif
}

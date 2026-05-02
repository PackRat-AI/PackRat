import Foundation
import Security

final class KeychainService: Sendable {
    static let shared = KeychainService()
    private init() {}

    private let service = "com.packrat.app"

    enum Key: String {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
    }

    var accessToken: String? { read(.accessToken) }
    var refreshToken: String? { read(.refreshToken) }

    func saveTokens(accessToken: String, refreshToken: String) {
        save(accessToken, for: .accessToken)
        save(refreshToken, for: .refreshToken)
    }

    func clearTokens() {
        delete(.accessToken)
        delete(.refreshToken)
    }

    private func save(_ value: String, for key: Key) {
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
        let query: [CFString: Any] = [
            kSecClass: kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key.rawValue,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

import Foundation
import Observation

@Observable
final class AuthManager {
    var currentUser: User?
    var isAuthenticated: Bool { currentUser != nil }
    var needsEmailVerification = false
    var pendingVerificationEmail: String?

    private let apiClient: APIClient

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        // Honor --reset-auth from XCUITest launch arguments so each test run
        // starts at the login screen.
        if ProcessInfo.processInfo.arguments.contains("--reset-auth") {
            KeychainService.shared.clearTokens()
        }
        loadStoredUser()
    }

    // MARK: - Auth Actions

    func login(email: String, password: String) async throws {
        struct LoginBody: Encodable { let email: String; let password: String }
        struct LoginResponse: Decodable { let success: Bool; let accessToken: String; let refreshToken: String; let user: User }

        let endpoint = Endpoint(.post, "/api/auth/login", body: LoginBody(email: email, password: password), requiresAuth: false)
        let response: LoginResponse = try await apiClient.send(endpoint)

        KeychainService.shared.saveTokens(accessToken: response.accessToken, refreshToken: response.refreshToken)
        await MainActor.run { currentUser = response.user }
        persistUser(response.user)
    }

    func register(email: String, password: String, firstName: String, lastName: String) async throws {
        struct RegisterBody: Encodable {
            let email: String; let password: String
            let firstName: String; let lastName: String
        }

        let endpoint = Endpoint(
            .post, "/api/auth/register",
            body: RegisterBody(email: email, password: password, firstName: firstName, lastName: lastName),
            requiresAuth: false
        )
        try await apiClient.sendDiscarding(endpoint)
        await MainActor.run {
            needsEmailVerification = true
            pendingVerificationEmail = email
        }
    }

    func verifyEmail(email: String, code: String) async throws {
        struct VerifyBody: Encodable { let email: String; let code: String }
        struct VerifyResponse: Decodable { let success: Bool; let accessToken: String; let refreshToken: String; let user: User }

        let endpoint = Endpoint(.post, "/api/auth/verify-email", body: VerifyBody(email: email, code: code), requiresAuth: false)
        let response: VerifyResponse = try await apiClient.send(endpoint)

        KeychainService.shared.saveTokens(accessToken: response.accessToken, refreshToken: response.refreshToken)
        await MainActor.run {
            currentUser = response.user
            needsEmailVerification = false
            pendingVerificationEmail = nil
        }
        persistUser(response.user)
    }

    func logout() async throws {
        if let refreshToken = KeychainService.shared.refreshToken {
            struct LogoutBody: Encodable { let refreshToken: String }
            let endpoint = Endpoint(.post, "/api/auth/logout", body: LogoutBody(refreshToken: refreshToken))
            try? await apiClient.sendDiscarding(endpoint)
        }
        await MainActor.run { signOut() }
    }

    func refreshProfile() async throws {
        struct ProfileResponse: Decodable { let user: User? }
        let endpoint = Endpoint(.get, "/api/user/profile")

        // Profile endpoint may return user directly or wrapped
        if let wrapped = try? await apiClient.send(endpoint, as: ProfileResponse.self), let user = wrapped.user {
            await MainActor.run { currentUser = user }
            persistUser(user)
        } else {
            let user: User = try await apiClient.send(endpoint)
            await MainActor.run { currentUser = user }
            persistUser(user)
        }
    }

    func signOut() {
        KeychainService.shared.clearTokens()
        UserDefaults.standard.removeObject(forKey: "current_user")
        currentUser = nil
    }

    // MARK: - Persistence

    private func persistUser(_ user: User) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: "current_user")
        }
    }

    private func loadStoredUser() {
        guard KeychainService.shared.accessToken != nil,
              let data = UserDefaults.standard.data(forKey: "current_user"),
              let user = try? JSONDecoder().decode(User.self, from: data)
        else { return }
        currentUser = user
    }
}

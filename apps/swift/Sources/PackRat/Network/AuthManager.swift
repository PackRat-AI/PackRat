import Foundation
import Observation

@Observable
final class AuthManager {
    var currentUser: User?
    var isAuthenticated: Bool { currentUser != nil }

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

    /// Signs in via Better Auth's email/password endpoint.
    /// The session token is captured by `APIClient` from the `set-auth-token`
    /// response header; we also stash it from the JSON body as a belt-and-
    /// braces guarantee for tests / mock transports.
    func login(email: String, password: String) async throws {
        struct LoginBody: Encodable { let email: String; let password: String }
        struct LoginResponse: Decodable {
            let token: String?
            let user: User
        }

        let endpoint = Endpoint(
            .post,
            "/api/auth/sign-in/email",
            body: LoginBody(email: email, password: password),
            requiresAuth: false
        )
        let response: LoginResponse = try await apiClient.send(endpoint)

        if let token = response.token, !token.isEmpty {
            KeychainService.shared.saveSessionToken(token)
        }
        await MainActor.run { currentUser = response.user }
        persistUser(response.user)
        SentryConfig.setUser(id: response.user.id, email: response.user.email)
    }

    /// Creates a new account via Better Auth's email/password sign-up.
    /// Better Auth requires a `name` field; we synthesize it from
    /// firstName + lastName and also pass each piece through the
    /// `additionalFields` config exposed by `auth.config.ts`.
    /// `requireEmailVerification` is `false`, so this returns a session
    /// immediately and the user is signed in.
    func register(email: String, password: String, firstName: String, lastName: String) async throws {
        struct RegisterBody: Encodable {
            let email: String
            let password: String
            let name: String
            let firstName: String
            let lastName: String
        }
        struct RegisterResponse: Decodable {
            let token: String?
            let user: User
        }

        let combinedName = [firstName, lastName]
            .map { $0.trimmingCharacters(in: .whitespaces) }
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        // Fallback so Better Auth's name field is never empty — it's required.
        let name = combinedName.isEmpty ? email : combinedName

        let endpoint = Endpoint(
            .post,
            "/api/auth/sign-up/email",
            body: RegisterBody(
                email: email,
                password: password,
                name: name,
                firstName: firstName,
                lastName: lastName
            ),
            requiresAuth: false
        )
        let response: RegisterResponse = try await apiClient.send(endpoint)

        if let token = response.token, !token.isEmpty {
            KeychainService.shared.saveSessionToken(token)
        }
        await MainActor.run { currentUser = response.user }
        persistUser(response.user)
        SentryConfig.setUser(id: response.user.id, email: response.user.email)
    }

    /// Signs out via Better Auth. We ignore failures so a stale/expired
    /// session token still clears local state.
    func logout() async throws {
        if KeychainService.shared.sessionToken != nil {
            let endpoint = Endpoint(.post, "/api/auth/sign-out")
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
        SentryConfig.clearUser()
    }

    // MARK: - Persistence

    private func persistUser(_ user: User) {
        if let data = try? JSONEncoder().encode(user) {
            UserDefaults.standard.set(data, forKey: "current_user")
        }
    }

    private func loadStoredUser() {
        guard KeychainService.shared.sessionToken != nil,
              let data = UserDefaults.standard.data(forKey: "current_user"),
              let user = try? JSONDecoder().decode(User.self, from: data)
        else { return }
        currentUser = user
        SentryConfig.setUser(id: user.id, email: user.email)
    }
}

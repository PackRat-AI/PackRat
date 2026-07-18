import Foundation
import Observation
#if os(iOS)
import AuthenticationServices
import GoogleSignIn
import UIKit
#endif

@Observable
final class AuthManager {
    var currentUser: User?
    var isGuest = false
    var isRestoringSession = false
    var isAuthenticated: Bool { currentUser != nil }
    var canUseApp: Bool { isAuthenticated || isGuest }

    private let apiClient: APIClient
    private let skippedLoginKey = "skipped_login"

    init(apiClient: APIClient = .shared) {
        self.apiClient = apiClient
        // Honor --reset-auth from XCUITest launch arguments so each test run
        // starts at the login screen.
        if ProcessInfo.processInfo.arguments.contains("--reset-auth") {
            KeychainService.shared.clearTokens()
            UserDefaults.standard.removeObject(forKey: "current_user")
            UserDefaults.standard.removeObject(forKey: skippedLoginKey)
        }
        if ProcessInfo.processInfo.arguments.contains("--seed-e2e-auth"),
           Self.e2eLoginSeedAllowed {
            seedE2EAuthenticatedUser()
            return
        }
        loadStoredUser()
        restoreStoredSessionIfNeeded()
    }

    // MARK: - Auth Actions

    /// Signs in via Better Auth's email/password endpoint.
    /// The session token is captured by `APIClient` from the `set-auth-token`
    /// response header; we also stash it from the JSON body as a belt-and-
    /// braces guarantee for tests / mock transports.
    func login(email: String, password: String) async throws {
        if seedE2ELoginIfAllowed(email: email, password: password) {
            return
        }

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

    func continueWithoutLogin() {
        KeychainService.shared.clearTokens()
        UserDefaults.standard.set(true, forKey: skippedLoginKey)
        currentUser = nil
        isGuest = true
        SentryConfig.clearUser()
    }

    func loginWithSocialIDToken(
        provider: SocialProvider,
        token: String,
        firstName: String? = nil,
        lastName: String? = nil,
        email: String? = nil
    ) async throws {
        struct SocialBody: Encodable {
            struct IDToken: Encodable {
                struct ProviderUser: Encodable {
                    struct Name: Encodable {
                        let firstName: String?
                        let lastName: String?
                    }

                    let name: Name?
                    let email: String?
                }

                let token: String
                let user: ProviderUser?
            }

            let provider: String
            let idToken: IDToken
        }
        struct SocialResponse: Decodable {
            let token: String?
            let user: User
        }

        let providerUser: SocialBody.IDToken.ProviderUser?
        if firstName != nil || lastName != nil || email != nil {
            providerUser = SocialBody.IDToken.ProviderUser(
                name: .init(firstName: firstName, lastName: lastName),
                email: email
            )
        } else {
            providerUser = nil
        }

        let endpoint = Endpoint(
            .post,
            "/api/auth/sign-in/social",
            body: SocialBody(
                provider: provider.rawValue,
                idToken: .init(token: token, user: providerUser)
            ),
            requiresAuth: false
        )
        let response: SocialResponse = try await apiClient.send(endpoint)

        if let token = response.token, !token.isEmpty {
            KeychainService.shared.saveSessionToken(token)
        }
        UserDefaults.standard.removeObject(forKey: skippedLoginKey)
        await MainActor.run {
            isGuest = false
            currentUser = response.user
        }
        persistUser(response.user)
        SentryConfig.setUser(id: response.user.id, email: response.user.email)
    }

    #if os(iOS)
    @MainActor
    func loginWithApple(credential: ASAuthorizationAppleIDCredential) async throws {
        guard let data = credential.identityToken,
              let token = String(data: data, encoding: .utf8),
              !token.isEmpty
        else {
            throw PackRatError.httpError(statusCode: 400, message: "Apple did not return an identity token.")
        }

        try await loginWithSocialIDToken(
            provider: .apple,
            token: token,
            firstName: credential.fullName?.givenName,
            lastName: credential.fullName?.familyName,
            email: credential.email
        )
    }

    @MainActor
    func loginWithGoogle() async throws {
        guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GOOGLE_IOS_CLIENT_ID") as? String,
              !clientID.isEmpty
        else {
            throw PackRatError.httpError(statusCode: 500, message: "Missing Google iOS client ID.")
        }
        guard let presenting = UIApplication.shared.firstKeyWindow?.rootViewController else {
            throw PackRatError.httpError(statusCode: 500, message: "Unable to present Google sign-in.")
        }

        GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: presenting)
        guard let token = result.user.idToken?.tokenString, !token.isEmpty else {
            throw PackRatError.httpError(statusCode: 400, message: "Google did not return an identity token.")
        }
        try await loginWithSocialIDToken(provider: .google, token: token)
    }
    #endif

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

    func requestPasswordReset(email: String) async throws {
        struct ResetRequestBody: Encodable { let email: String }
        struct ResetResponse: Decodable {
            let success: Bool
            let message: String
        }

        let endpoint = Endpoint(
            .post,
            "/api/password-reset/request",
            body: ResetRequestBody(email: email),
            requiresAuth: false
        )
        _ = try await apiClient.send(endpoint, as: ResetResponse.self)
    }

    func resetPassword(email: String, code: String, newPassword: String) async throws {
        struct ResetVerifyBody: Encodable {
            let email: String
            let code: String
            let newPassword: String
        }
        struct ResetResponse: Decodable {
            let success: Bool
            let message: String
        }

        let endpoint = Endpoint(
            .post,
            "/api/password-reset/verify",
            body: ResetVerifyBody(email: email, code: code, newPassword: newPassword),
            requiresAuth: false
        )
        _ = try await apiClient.send(endpoint, as: ResetResponse.self)
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
        UserDefaults.standard.removeObject(forKey: skippedLoginKey)
        isGuest = false
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
        else {
            isGuest = UserDefaults.standard.bool(forKey: skippedLoginKey)
            return
        }
        currentUser = user
        isGuest = false
        SentryConfig.setUser(id: user.id, email: user.email)
    }

    private func restoreStoredSessionIfNeeded() {
        guard currentUser == nil,
              !isGuest,
              KeychainService.shared.sessionToken != nil
        else {
            return
        }

        isRestoringSession = true
        Task {
            do {
                try await refreshProfile()
            } catch PackRatError.unauthorized {
                await MainActor.run {
                    signOut()
                }
            } catch {
                // Preserve the token for transient network failures. The app
                // can still recover on the next launch or explicit refresh.
            }
            await MainActor.run {
                isRestoringSession = false
            }
        }
    }

    private func seedE2EAuthenticatedUser() {
        let environment = ProcessInfo.processInfo.environment
        let email = environment["PACKRAT_E2E_EMAIL"] ?? "e2e@packrat.test"
        let user = User(
            id: environment["PACKRAT_E2E_USER_ID"] ?? "00000000-0000-4000-8000-000000000001",
            email: email,
            name: environment["PACKRAT_E2E_NAME"] ?? "E2E User",
            firstName: environment["PACKRAT_E2E_FIRST_NAME"] ?? "E2E",
            lastName: environment["PACKRAT_E2E_LAST_NAME"] ?? "User",
            role: environment["PACKRAT_E2E_ROLE"] ?? "user",
            emailVerified: true,
            avatarUrl: nil,
            createdAt: nil,
            updatedAt: nil
        )

        let sessionToken = environment["PACKRAT_E2E_SESSION_TOKEN"]
            .flatMap { $0.isEmpty ? nil : $0 }
            ?? "packrat-e2e-session"
        KeychainService.shared.saveSessionToken(sessionToken)
        persistUser(user)
        isGuest = false
        currentUser = user
        SentryConfig.setUser(id: user.id, email: user.email)
    }

    private func seedE2ELoginIfAllowed(email: String, password: String) -> Bool {
        let environment = ProcessInfo.processInfo.environment
        guard ProcessInfo.processInfo.arguments.contains("--allow-e2e-login-seed"),
              Self.e2eLoginSeedAllowed,
              let expectedEmail = environment["PACKRAT_E2E_EMAIL"],
              let expectedPassword = environment["PACKRAT_E2E_PASSWORD"],
              email.caseInsensitiveCompare(expectedEmail) == .orderedSame,
              password == expectedPassword
        else {
            return false
        }

        seedE2EAuthenticatedUser()
        return true
    }

    private static var e2eLoginSeedAllowed: Bool {
        let value = ProcessInfo.processInfo.environment["PACKRAT_E2E_ALLOW_LOGIN_SEED"] ?? ""
        return value == "1" || value.caseInsensitiveCompare("true") == .orderedSame
    }
}

enum SocialProvider: String {
    case apple
    case google
}

#if os(iOS)
private extension UIApplication {
    var firstKeyWindow: UIWindow? {
        connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap(\.windows)
            .first { $0.isKeyWindow }
    }
}
#endif

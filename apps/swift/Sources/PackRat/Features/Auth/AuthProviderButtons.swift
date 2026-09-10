import AuthenticationServices
import SwiftUI

/// "Or continue with" — Google and Sign in with Apple.
///
/// Shared by sign-in and sign-up rather than living on the sign-in screen
/// alone. Better Auth creates the account on the first OAuth callback, so these
/// buttons already *are* a sign-up path; offering them only to people who
/// already have an account left new users with email-and-password as their one
/// visible option, which is the slowest and the most abandoned.
///
/// The caller owns `isLoading` and `error`: both screens already have that
/// state driving their own submit button, and a provider sign-in should disable
/// the whole form, not just this section.
struct AuthProviderButtons: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(\.colorScheme) private var colorScheme

    @Binding var isLoading: Bool
    @Binding var error: String?

    /// Distinguishes the two screens' accessibility identifiers so E2E can tell
    /// which surface it is driving.
    let identifierPrefix: String

    var body: some View {
        if AppFeatureFlags.enableOAuth {
            VStack(spacing: 10) {
                HStack(spacing: 12) {
                    Divider()
                    Text("Or continue with")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                    Divider()
                }

                // Google's SDK needs UIKit, so macOS gets a button that
                // explains where to sign in with Google rather than one that
                // silently cannot work.
                #if os(iOS)
                Button {
                    signInWithGoogle()
                } label: {
                    Label("Continue with Google", systemImage: "g.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .disabled(isLoading)
                .accessibilityIdentifier("\(identifierPrefix)_google")
                #else
                Button {
                    error = "Google sign-in is available in the iOS app. Use email sign-in on macOS for now."
                } label: {
                    Label("Continue with Google", systemImage: "g.circle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
                .accessibilityIdentifier("\(identifierPrefix)_google")
                #endif

                // Deliberately on both platforms. App Store guideline 4.8
                // requires Sign in with Apple wherever a third-party login is
                // offered, and macOS offers Google above. `SignInWithAppleButton`
                // and `loginWithApple` are both cross-platform, so nothing here
                // needs gating — this button shipped on macOS until it was moved
                // inside the iOS branch while extracting this view (#2749),
                // which is what broke `AuthTests.testLoginScreenAppears` on the
                // macOS target.
                SignInWithAppleButton(.continue) { request in
                    request.requestedScopes = [.fullName, .email]
                } onCompletion: { result in
                    signInWithApple(result)
                }
                .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                .frame(height: 44)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .disabled(isLoading)
                .accessibilityIdentifier("\(identifierPrefix)_apple")
            }
        }
    }

    #if os(iOS)
    private func signInWithGoogle() {
        guard !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                try await authManager.loginWithGoogle()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
    #endif

    private func signInWithApple(_ result: Result<ASAuthorization, Error>) {
        error = nil
        switch result {
        case .success(let authorization):
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential else {
                error = "Apple did not return a usable credential."
                return
            }
            isLoading = true
            Task {
                defer { isLoading = false }
                do {
                    try await authManager.loginWithApple(credential: credential)
                } catch {
                    self.error = error.localizedDescription
                }
            }
        case .failure(let error):
            // A cancelled Apple sheet reports an error; saying nothing is
            // right, since the viewer chose to back out.
            if (error as? ASAuthorizationError)?.code != .canceled {
                self.error = error.localizedDescription
            }
        }
    }
}

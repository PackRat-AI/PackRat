import SwiftUI
#if os(iOS)
import AuthenticationServices
#endif

struct LoginView: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(\.colorScheme) private var colorScheme
    let onRegisterTapped: () -> Void
    let onForgotPasswordTapped: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        authContainer {
            VStack(spacing: 22) {
                AuthHeader(title: "Sign In", subtitle: "Access your packs, trips, and saved gear.", symbol: "backpack.fill")

                VStack(spacing: 0) {
                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        #endif
                        .autocorrectionDisabled()
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .accessibilityIdentifier("login_email")

                    Divider().padding(.leading, 14)

                    SecureField("Password", text: $password)
                        .textContentType(.password)
                        #if os(iOS)
                        .submitLabel(.go)
                        #endif
                        .onSubmit { submit() }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .accessibilityIdentifier("login_password")
                }
                .authGroupedSurface()

                if let error {
                    LoginInlineErrorView(message: error)
                }

                VStack(spacing: 12) {
                    Button(action: submit) {
                        Group {
                            if isLoading {
                                ProgressView().controlSize(.small)
                            } else {
                                Text("Sign In")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(isLoading || email.isEmpty || password.isEmpty)
                    .accessibilityIdentifier("login_submit")

                    Button("Forgot Password?", action: onForgotPasswordTapped)
                        .buttonStyle(.plain)
                        .font(.callout)
                        .foregroundStyle(.tint)
                        .accessibilityIdentifier("forgot_password_link")
                }

                Button("Don't have an account? Sign Up", action: onRegisterTapped)
                    .buttonStyle(.plain)
                    .foregroundStyle(.tint)
                    .font(.callout)

                VStack(spacing: 10) {
                    HStack(spacing: 12) {
                        Divider()
                        Text("Or continue with")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                        Divider()
                    }

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
                    .accessibilityIdentifier("auth_google")

                    SignInWithAppleButton(.continue) { request in
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        signInWithApple(result)
                    }
                    .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
                    .frame(height: 44)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .disabled(isLoading)
                    .accessibilityIdentifier("auth_apple")
                    #else
                    Button {
                        error = "Google sign-in is available in the iOS app. Use email sign-in on macOS for now."
                    } label: {
                        Label("Continue with Google", systemImage: "g.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .accessibilityIdentifier("auth_google")
                    #endif
                }
            }
        }
    }

    private func submit() {
        guard !isLoading, !email.isEmpty, !password.isEmpty else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                try await authManager.login(email: email, password: password)
            } catch {
                self.error = error.localizedDescription
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
            self.error = error.localizedDescription
        }
    }
    #endif
}

private struct LoginInlineErrorView: View {
    let message: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.red)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
                .lineLimit(3)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityIdentifier("login_error")
    }
}

@ViewBuilder
func authContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    #if os(macOS)
    VStack {
        Spacer(minLength: 32)
        content()
            .padding(40)
            .frame(width: 420)
            .fixedSize(horizontal: false, vertical: true)
        Spacer(minLength: 32)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(.background)
    #else
    ScrollView {
        content()
            .padding(.horizontal, 24)
            .padding(.vertical, 36)
            .frame(maxWidth: 430)
            .frame(maxWidth: .infinity)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .scrollDismissesKeyboard(.interactively)
    #endif
}

struct AuthHeader: View {
    let title: String
    let subtitle: String
    let symbol: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: symbol)
                .font(.system(size: 42, weight: .semibold))
                .foregroundStyle(.tint)
                .symbolRenderingMode(.hierarchical)

            VStack(spacing: 5) {
                Text(title)
                    .font(.largeTitle.bold())
                    .multilineTextAlignment(.center)
                Text(subtitle)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
        }
    }
}

struct AuthRowButton: View {
    let title: String
    let symbol: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: symbol)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.tint)
                    .frame(width: 24)
                Text(title)
                    .foregroundStyle(.primary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.tertiary)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

extension View {
    func authGroupedSurface() -> some View {
        self
            .background(.background.secondary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(.separator.opacity(0.35), lineWidth: 0.5)
            }
    }
}

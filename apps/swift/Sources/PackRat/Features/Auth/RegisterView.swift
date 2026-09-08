import SwiftUI

struct RegisterView: View {
    @Environment(AuthManager.self) private var authManager
    let onLoginTapped: () -> Void

    @State private var firstName = ""
    @State private var lastName = ""
    @State private var email = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var error: String?

    private var passwordMismatch: Bool {
        !confirmPassword.isEmpty && password != confirmPassword
    }

    private var isValid: Bool {
        !firstName.isEmpty && !email.isEmpty && !password.isEmpty
            && password == confirmPassword && password.count >= 8
    }

    var body: some View {
        authContainer {
            VStack(spacing: 24) {
                AuthHeader(title: "Create Account", subtitle: "Save packs, trips, and gear across devices.", symbol: "person.crop.circle.badge.plus")

                VStack(spacing: 0) {
                    HStack(spacing: 10) {
                        TextField("First Name", text: $firstName)
                            .textContentType(.givenName)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("register_first_name")
                            .accessibilityLabel("First Name")
                        Divider()
                        TextField("Last Name", text: $lastName)
                            .textContentType(.familyName)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("register_last_name")
                            .accessibilityLabel("Last Name")
                    }

                    Divider().padding(.leading, 14)

                    TextField("Email", text: $email)
                        .textContentType(.emailAddress)
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        #endif
                        .autocorrectionDisabled()
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .accessibilityIdentifier("register_email")
                        .accessibilityLabel("Email")

                    Divider().padding(.leading, 14)

                    // State the rule up front — 8 characters matches both
                    // `isValid` here and Better Auth's `minPasswordLength`
                    // server-side, so the user is not left to discover it by
                    // failing.
                    VStack(alignment: .leading, spacing: 4) {
                        SecureField("Password", text: $password)
                            .textContentType(.newPassword)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("register_password")
                            .accessibilityLabel("Password")
                        if password.isEmpty || password.count < 8 {
                            Text("At least 8 characters")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .padding(.horizontal, 14)
                                .padding(.bottom, 10)
                        }
                    }

                    Divider().padding(.leading, 14)

                    VStack(alignment: .leading, spacing: 4) {
                        SecureField("Confirm Password", text: $confirmPassword)
                            .textContentType(.newPassword)
                            .onSubmit { if isValid { submit() } }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("register_confirm_password")
                            .accessibilityLabel("Confirm Password")
                        if passwordMismatch {
                            Text("Passwords don't match")
                                .font(.caption)
                                .foregroundStyle(.red)
                                .padding(.horizontal, 14)
                                .padding(.bottom, 10)
                        }
                    }
                }
                .authGroupedSurface()

                if let error {
                    InlineErrorView(message: error)
                }

                Button(action: submit) {
                    Group {
                        if isLoading {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Create Account").frame(maxWidth: .infinity)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 2)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!isValid || isLoading)
                .accessibilityIdentifier("register_submit")

                Divider()

                Button("Already have an account? Sign In", action: onLoginTapped)
                    .buttonStyle(.plain)
                    .foregroundStyle(.tint)
                    .font(.callout)
            }
        }
    }

    private func submit() {
        guard isValid, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                try await authManager.register(
                    email: email,
                    password: password,
                    firstName: firstName,
                    lastName: lastName
                )
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

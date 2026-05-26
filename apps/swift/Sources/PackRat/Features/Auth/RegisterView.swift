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
                        Divider()
                        TextField("Last Name", text: $lastName)
                            .textContentType(.familyName)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("register_last_name")
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

                    Divider().padding(.leading, 14)

                    SecureField("Password", text: $password)
                        .textContentType(.newPassword)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .accessibilityIdentifier("register_password")

                    Divider().padding(.leading, 14)

                    VStack(alignment: .leading, spacing: 4) {
                        SecureField("Confirm Password", text: $confirmPassword)
                            .textContentType(.newPassword)
                            .onSubmit { if isValid { submit() } }
                            .padding(.horizontal, 14)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("register_confirm_password")
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

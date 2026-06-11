import SwiftUI

struct ForgotPasswordView: View {
    @Environment(AuthManager.self) private var authManager
    let onCodeSent: (String) -> Void
    let onLoginTapped: () -> Void

    @State private var email = ""
    @State private var isLoading = false
    @State private var error: String?

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    var body: some View {
        authContainer {
            VStack(spacing: 24) {
                header

                VStack(spacing: 14) {
                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.emailAddress)
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        #endif
                        .autocorrectionDisabled()
                        .onSubmit { submit() }
                        .accessibilityIdentifier("forgot_password_email")

                    if let error {
                        InlineErrorView(message: error)
                    }

                    Button(action: submit) {
                        Group {
                            if isLoading {
                                ProgressView().controlSize(.small)
                            } else {
                                Text("Send Code")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 2)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!canSubmit)
                    .accessibilityIdentifier("forgot_password_submit")
                }

                Divider()

                Button("Back to Sign In", action: onLoginTapped)
                    .buttonStyle(.plain)
                    .foregroundStyle(.tint)
                    .font(.callout)
                    .accessibilityIdentifier("forgot_password_back")
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "lock.rotation")
                .font(.system(size: 46))
                .foregroundStyle(.tint)
            Text("Reset Password")
                .font(.largeTitle.bold())
            Text("Enter your email and we'll send a 6-digit reset code.")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }

    private func submit() {
        let trimmedEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedEmail.isEmpty, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                try await authManager.requestPasswordReset(email: trimmedEmail)
                onCodeSent(trimmedEmail)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

struct ResetPasswordView: View {
    @Environment(AuthManager.self) private var authManager
    let email: String
    let onPasswordReset: () -> Void
    let onBack: () -> Void

    @State private var code = ""
    @State private var password = ""
    @State private var confirmPassword = ""
    @State private var isLoading = false
    @State private var error: String?

    private var passwordsMismatch: Bool {
        !confirmPassword.isEmpty && password != confirmPassword
    }

    private var canSubmit: Bool {
        code.count == 6 && password.count >= 8 && password == confirmPassword && !isLoading
    }

    var body: some View {
        authContainer {
            VStack(spacing: 24) {
                header

                VStack(spacing: 14) {
                    TextField("Reset Code", text: $code)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.oneTimeCode)
                        #if os(iOS)
                        .keyboardType(.numberPad)
                        #endif
                        .onChange(of: code) { _, newValue in
                            code = String(newValue.filter(\.isNumber).prefix(6))
                        }
                        .accessibilityIdentifier("reset_password_code")

                    SecureField("New Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.newPassword)
                        .accessibilityIdentifier("reset_password_new")

                    VStack(alignment: .leading, spacing: 4) {
                        SecureField("Confirm Password", text: $confirmPassword)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.newPassword)
                            .onSubmit { submit() }
                            .accessibilityIdentifier("reset_password_confirm")

                        if passwordsMismatch {
                            Text("Passwords don't match")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
                    }

                    if let error {
                        InlineErrorView(message: error)
                    }

                    Button(action: submit) {
                        Group {
                            if isLoading {
                                ProgressView().controlSize(.small)
                            } else {
                                Text("Reset Password")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 2)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .disabled(!canSubmit)
                    .accessibilityIdentifier("reset_password_submit")
                }

                Divider()

                Button("Use a Different Email", action: onBack)
                    .buttonStyle(.plain)
                    .foregroundStyle(.tint)
                    .font(.callout)
                    .accessibilityIdentifier("reset_password_back")
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.shield.fill")
                .font(.system(size: 46))
                .foregroundStyle(.tint)
            Text("Enter Code")
                .font(.largeTitle.bold())
            Text(email)
                .font(.callout)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .truncationMode(.middle)
        }
    }

    private func submit() {
        guard canSubmit else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                try await authManager.resetPassword(email: email, code: code, newPassword: password)
                onPasswordReset()
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

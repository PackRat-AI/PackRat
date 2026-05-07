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
                VStack(spacing: 8) {
                    Image(systemName: "backpack.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.tint)
                    Text("Create Account")
                        .font(.largeTitle.bold())
                    Text("Join the PackRat community")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 12) {
                    HStack(spacing: 10) {
                        TextField("First Name", text: $firstName)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.givenName)
                        TextField("Last Name", text: $lastName)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.familyName)
                    }

                    TextField("Email", text: $email)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.emailAddress)
                        #if os(iOS)
                        .keyboardType(.emailAddress)
                        .autocapitalization(.none)
                        #endif
                        .autocorrectionDisabled()

                    SecureField("Password (min 8 chars)", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.newPassword)

                    VStack(alignment: .leading, spacing: 4) {
                        SecureField("Confirm Password", text: $confirmPassword)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.newPassword)
                            .onSubmit { if isValid { submit() } }
                        if passwordMismatch {
                            Text("Passwords don't match")
                                .font(.caption)
                                .foregroundStyle(.red)
                        }
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
                            Text("Create Account").frame(maxWidth: .infinity)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 2)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(!isValid || isLoading)

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

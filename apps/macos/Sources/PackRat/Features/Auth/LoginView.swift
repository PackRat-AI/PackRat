import SwiftUI

struct LoginView: View {
    @Environment(AuthManager.self) private var authManager
    let onRegisterTapped: () -> Void

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var error: String?

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

                    SecureField("Password", text: $password)
                        .textFieldStyle(.roundedBorder)
                        .textContentType(.password)
                        .onSubmit { submit() }
                }

                if let error {
                    InlineErrorView(message: error)
                }

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
                    .padding(.vertical, 2)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(isLoading || email.isEmpty || password.isEmpty)

                Divider()

                Button("Don't have an account? Sign Up", action: onRegisterTapped)
                    .buttonStyle(.plain)
                    .foregroundStyle(.tint)
                    .font(.callout)
            }
        }
    }

    private var header: some View {
        VStack(spacing: 8) {
            Image(systemName: "backpack.fill")
                .font(.system(size: 48))
                .foregroundStyle(.tint)
            Text("PackRat")
                .font(.largeTitle.bold())
            Text("Plan better. Pack smarter.")
                .font(.callout)
                .foregroundStyle(.secondary)
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
}

@ViewBuilder
private func authContainer<Content: View>(@ViewBuilder content: () -> Content) -> some View {
    #if os(macOS)
    content()
        .padding(40)
        .frame(width: 360)
        .frame(maxHeight: .infinity)
        .background(.background)
    #else
    ScrollView {
        content()
            .padding(32)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    #endif
}

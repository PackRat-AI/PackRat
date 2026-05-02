import SwiftUI

struct VerifyEmailView: View {
    @Environment(AuthManager.self) private var authManager
    let email: String

    @State private var code = ""
    @State private var isLoading = false
    @State private var error: String?

    var body: some View {
        authContainer {
            VStack(spacing: 24) {
                VStack(spacing: 8) {
                    Image(systemName: "envelope.badge.checkmark")
                        .font(.system(size: 48))
                        .foregroundStyle(.tint)
                    Text("Check Your Email")
                        .font(.largeTitle.bold())
                    Text("We sent a 6-digit code to\n**\(email)**")
                        .multilineTextAlignment(.center)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }

                TextField("6-digit code", text: $code)
                    .textFieldStyle(.roundedBorder)
                    .textContentType(.oneTimeCode)
                    #if os(iOS)
                    .keyboardType(.numberPad)
                    #endif
                    .multilineTextAlignment(.center)
                    .font(.title2.monospacedDigit())
                    .onSubmit { submit() }

                if let error {
                    InlineErrorView(message: error)
                }

                Button(action: submit) {
                    Group {
                        if isLoading {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Verify Email").frame(maxWidth: .infinity)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 2)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)
                .disabled(code.count < 6 || isLoading)

                Button("Use a different email") {
                    authManager.signOut()
                }
                .buttonStyle(.plain)
                .foregroundStyle(.secondary)
                .font(.callout)
            }
        }
    }

    private func submit() {
        guard code.count >= 6, !isLoading else { return }
        isLoading = true
        error = nil
        Task {
            defer { isLoading = false }
            do {
                try await authManager.verifyEmail(email: email, code: code)
            } catch {
                self.error = error.localizedDescription
            }
        }
    }
}

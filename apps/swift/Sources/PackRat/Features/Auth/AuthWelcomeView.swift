import SwiftUI

struct AuthWelcomeView: View {
    let onSignUpTapped: () -> Void
    let onEmailSignInTapped: () -> Void
    let onContinueWithoutLoginTapped: () -> Void

    var body: some View {
        authContainer {
            VStack(spacing: 24) {
                AuthHeader(title: "PackRat", subtitle: "Plan better. Pack smarter.", symbol: "backpack.fill")

                VStack(spacing: 10) {
                    Button(action: onSignUpTapped) {
                        Text("Sign Up Free")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                    .accessibilityIdentifier("auth_signup_free")

                    Button(action: onContinueWithoutLoginTapped) {
                        Label("Continue as Guest", systemImage: "person.crop.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .accessibilityIdentifier("auth_continue_without_login")
                }

                Button(action: onEmailSignInTapped) {
                    Text("Already have an account? Sign In")
                        .font(.callout)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                }
                .buttonStyle(.plain)
                .foregroundStyle(.tint)
                .contentShape(Rectangle())
                .accessibilityIdentifier("auth_sign_in")
            }
        }
    }
}

struct InlineInfoView: View {
    let message: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Image(systemName: "info.circle.fill")
                .foregroundStyle(.blue)
            Text(message)
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.blue.opacity(0.08), in: RoundedRectangle(cornerRadius: 10, style: .continuous))
        .accessibilityIdentifier("auth_info_message")
    }
}

import SwiftUI
#if os(iOS)
import GoogleSignIn
#endif

struct AuthGateView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var route: AuthRoute = .welcome

    var body: some View {
        Group {
            if authManager.isRestoringSession {
                ProgressView()
                    .controlSize(.large)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.secondary.opacity(0.08))
            } else if authManager.canUseApp {
                AppNavigation()
            } else {
                authContent
            }
        }
        .animation(.spring(duration: 0.3), value: authManager.isRestoringSession)
        .animation(.spring(duration: 0.3), value: authManager.canUseApp)
        .animation(.spring(duration: 0.3), value: route)
        .onOpenURL { url in
            #if os(iOS)
            if GIDSignIn.sharedInstance.handle(url) {
                return
            }
            #endif
        }
    }

    @ViewBuilder
    private var authContent: some View {
        switch route {
        case .welcome:
            AuthWelcomeView(
                onSignUpTapped: { route = .register },
                onEmailSignInTapped: { route = .login },
                onContinueWithoutLoginTapped: { authManager.continueWithoutLogin() }
            )
        case .login:
            LoginView(
                onRegisterTapped: { route = .register },
                onForgotPasswordTapped: { route = .forgotPassword }
            )
        case .register:
            RegisterView(onLoginTapped: { route = .login })
        case .forgotPassword:
            ForgotPasswordView(
                onCodeSent: { email in route = .resetPassword(email: email) },
                onLoginTapped: { route = .login }
            )
        case .resetPassword(let email):
            ResetPasswordView(
                email: email,
                onPasswordReset: { route = .login },
                onBack: { route = .forgotPassword }
            )
        }
    }
}

private enum AuthRoute: Hashable {
    case welcome
    case login
    case register
    case forgotPassword
    case resetPassword(email: String)
}

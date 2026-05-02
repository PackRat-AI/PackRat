import SwiftUI

struct AuthGateView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var showRegister = false

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                AppNavigation()
            } else if authManager.needsEmailVerification, let email = authManager.pendingVerificationEmail {
                VerifyEmailView(email: email)
            } else if showRegister {
                RegisterView(onLoginTapped: { showRegister = false })
            } else {
                LoginView(onRegisterTapped: { showRegister = true })
            }
        }
        .animation(.spring(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.spring(duration: 0.3), value: authManager.needsEmailVerification)
        .animation(.spring(duration: 0.3), value: showRegister)
    }
}

import SwiftUI

struct AuthGateView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var showRegister = false

    var body: some View {
        Group {
            if authManager.isAuthenticated {
                AppNavigation()
            } else if showRegister {
                RegisterView(onLoginTapped: { showRegister = false })
            } else {
                LoginView(onRegisterTapped: { showRegister = true })
            }
        }
        .animation(.spring(duration: 0.3), value: authManager.isAuthenticated)
        .animation(.spring(duration: 0.3), value: showRegister)
        .onOpenURL { url in
            let link = DeepLink.parse(url)
            // Routing per destination is deferred — the scheme handler is wired here
            // so deep links surface via Sentry breadcrumbs (once U9 lands) and the
            // logs, even before each destination has a binding. This is enough to
            // close the parity gap with Expo's `packrat://` scheme.
            print("[DeepLink] received \(url) → \(link)")
        }
    }
}

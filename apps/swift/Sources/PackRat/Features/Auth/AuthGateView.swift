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
                    .onAppear {
                        // Someone who left guest mode specifically to sign in
                        // has already chosen; open there rather than making
                        // them pick again on the welcome screen.
                        if authManager.wantsSignInDirectly {
                            route = .login
                            authManager.wantsSignInDirectly = false
                        }
                    }
            }
        }
        .animation(.spring(duration: 0.3), value: authManager.isRestoringSession)
        .animation(.spring(duration: 0.3), value: authManager.canUseApp)
        .animation(.spring(duration: 0.3), value: route)
        // Re-runs whenever the signed-in user changes, including sign-out
        // (nil). Tying purchases identity to the same signal as the rest of the
        // session keeps RevenueCat's app-user-id equal to our users.id, which
        // is the join the entitlements webhook writes against.
        .task(id: authManager.currentUser?.id) {
            // Drop the cached Pro answer before anything else. It is cached per
            // device but belongs to an account, so the next person to sign in
            // must not inherit it — least of all offline, where the refresh
            // below may never land to correct it.
            FeatureAccessStore.shared.forgetEntitlement()

            // Configure here rather than in App.init: iOS prewarms apps in the
            // background, and configuring there creates a RevenueCat user
            // record for a launch nobody saw.
            SubscriptionService.shared.configure()

            if let userId = authManager.currentUser?.id {
                // Attach purchases to the account. logIn also carries over
                // anything bought against the anonymous id, though the paywall
                // does not let a guest buy in the first place.
                if let customerInfo = await SubscriptionService.shared.identify(userId: userId) {
                    FeatureAccessStore.shared.apply(customerInfo: customerInfo)
                }
            } else {
                // Signed out. Returns RevenueCat to an anonymous id if it was
                // ever configured, so the next account on this device does not
                // inherit these entitlements.
                await SubscriptionService.shared.resetUser()
            }
            await FeatureAccessStore.shared.refresh()
            await FeatureFlagStore.shared.refresh()
        }
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

import SwiftUI
#if os(iOS)
import UIKit
#endif

/// Developer tools. On iPhone and iPad a long press on the top-right corner of
/// any screen opens it as a sheet; on the Mac it is a window opened from the
/// Developer menu (⌥⌘D). Non-production builds only, matching the other
/// developer controls.
struct DevSheet: View {
    @Environment(AuthManager.self) private var authManager
    @Environment(\.dismiss) private var dismiss
    @AppStorage(IntroView.hasSeenKey) private var hasSeenIntro = false
    @State private var showsIntro = false

    private var version: String {
        let info = Bundle.main.infoDictionary
        let short = info?["CFBundleShortVersionString"] as? String ?? "?"
        let build = info?["CFBundleVersion"] as? String ?? "?"
        return "\(short) (\(build))"
    }

    var body: some View {
        NavigationStack {
            List {
                Section("Build") {
                    LabeledContent("Version", value: version)
                    LabeledContent("Environment", value: APIClient.environmentName ?? "debug")
                    LabeledContent("API", value: APIClient.resolvedBaseURL.absoluteString)
                    LabeledContent("Account", value: accountLabel)
                }

                Section("Intro") {
                    Button("Show Intro") { showsIntro = true }
                        .accessibilityIdentifier("dev_show_intro")
                    Button("Reset First-Launch Intro") { hasSeenIntro = false }
                        .disabled(!hasSeenIntro)
                        .accessibilityIdentifier("dev_reset_intro")
                }

                Section("Feature Flags") {
                    ForEach(FeatureFlagStore.shared.flags.keys.sorted(), id: \.self) { key in
                        LabeledContent(key) {
                            Image(systemName: FeatureFlagStore.shared.isEnabled(key) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(FeatureFlagStore.shared.isEnabled(key) ? .green : .secondary)
                        }
                        .font(.callout)
                    }
                }

                if authManager.canUseApp {
                    Section {
                        Button("Sign Out", role: .destructive) {
                            authManager.signOut()
                            dismiss()
                        }
                        .accessibilityIdentifier("dev_sign_out")
                    }
                }
            }
            .navigationTitle("Developer")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            .fullScreenCover(isPresented: $showsIntro) {
                IntroView(onFinished: { showsIntro = false })
            }
            #else
            .formStyle(.grouped)
            .sheet(isPresented: $showsIntro) {
                IntroView(onFinished: { showsIntro = false })
                    .frame(width: 420, height: 640)
            }
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .accessibilityIdentifier("dev_sheet")
    }

    private var accountLabel: String {
        if let user = authManager.currentUser { return user.email }
        return authManager.canUseApp ? "Guest" : "Signed out"
    }
}

#if os(iOS)
extension View {
    /// Opens `DevSheet` on a long press in the top-right corner of the window.
    /// Installs a window-level recognizer that never cancels touches, so
    /// buttons and scroll views underneath keep working.
    @ViewBuilder
    func devSheetOnCornerLongPress() -> some View {
        if APIClient.isNonProduction {
            modifier(DevSheetModifier())
        } else {
            self
        }
    }
}

private struct DevSheetModifier: ViewModifier {
    @State private var isPresented = false

    func body(content: Content) -> some View {
        content
            .background(CornerLongPressInstaller { isPresented = true })
            .sheet(isPresented: $isPresented) {
                DevSheet()
            }
    }
}

private struct CornerLongPressInstaller: UIViewRepresentable {
    let onTrigger: () -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onTrigger: onTrigger) }

    func makeUIView(context: Context) -> InstallerView {
        let view = InstallerView()
        view.coordinator = context.coordinator
        view.isUserInteractionEnabled = false
        return view
    }

    func updateUIView(_ uiView: InstallerView, context: Context) {
        context.coordinator.onTrigger = onTrigger
    }

    final class InstallerView: UIView {
        weak var coordinator: Coordinator?

        override func didMoveToWindow() {
            super.didMoveToWindow()
            guard let window, let coordinator else { return }
            coordinator.install(on: window)
        }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        var onTrigger: () -> Void
        private weak var window: UIWindow?
        private var recognizer: UILongPressGestureRecognizer?

        /// Square in the top-right corner, measured from the window edge.
        private let cornerSize: CGFloat = 88

        init(onTrigger: @escaping () -> Void) { self.onTrigger = onTrigger }

        func install(on window: UIWindow) {
            guard self.window !== window else { return }
            if let recognizer { recognizer.view?.removeGestureRecognizer(recognizer) }
            let recognizer = UILongPressGestureRecognizer(target: self, action: #selector(handle(_:)))
            recognizer.minimumPressDuration = 1.0
            recognizer.cancelsTouchesInView = false
            recognizer.delaysTouchesBegan = false
            recognizer.delegate = self
            window.addGestureRecognizer(recognizer)
            self.window = window
            self.recognizer = recognizer
        }

        @objc private func handle(_ recognizer: UILongPressGestureRecognizer) {
            guard recognizer.state == .began else { return }
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            onTrigger()
        }

        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let window else { return false }
            let point = gestureRecognizer.location(in: window)
            return point.x >= window.bounds.width - cornerSize && point.y <= cornerSize + window.safeAreaInsets.top
        }

        func gestureRecognizer(
            _ gestureRecognizer: UIGestureRecognizer,
            shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
        ) -> Bool {
            true
        }
    }
}
#endif

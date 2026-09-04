import SwiftUI
import UserNotifications

// MARK: - App-wide user preferences stored in UserDefaults

final class AppPreferences: ObservableObject {
    static let shared = AppPreferences()

    @AppStorage("defaultAppWeightUnit") var defaultAppWeightUnit: AppWeightUnit = .grams
    @AppStorage("preferMetric") var preferMetric: Bool = true
    @AppStorage("temperatureUnit") var temperatureUnit: TemperatureUnit = .fahrenheit
    @AppStorage("speedUnit") var speedUnit: SpeedUnit = .mph
    @AppStorage("accentColorName") var accentColorName: String = "blue"
    @AppStorage("apiBaseURL") var apiBaseURL: String = ""

    enum TemperatureUnit: String, CaseIterable {
        case fahrenheit = "°F"
        case celsius = "°C"

        var label: String { rawValue }
    }
}

// MARK: - Settings / Preferences window (Cmd+,)

/// Section order follows Apple's one explicit ordering rule for settings: the
/// controls people are most likely to use sit at the top, with more advanced
/// functionality last or hidden by default.
///
/// On iOS that yields, top to bottom:
///
/// 1. **Sync** — the only section that reports live state rather than setting a
///    preference, and the reason a user opens Settings when something looks
///    wrong. It also stays quiet when everything is synced.
/// 2. **Units** — the most frequently changed real preference, and the one that
///    changes numbers on every pack screen. Weight, temperature, and wind now sit
///    together instead of temperature living alone in a "General" section: they
///    are all measurement display, and Apple's guidance is to group related
///    settings rather than scatter them.
/// 3. **Notifications** — set once, rarely revisited.
/// 4. **Advanced** — the destructive preference reset.
/// 5. **About** — version info, the least-used content on the screen.
/// 6. **Developer** — non-production API controls and local-data wipe, matching
///    Apple's own placement of developer affordances at the bottom. Absent
///    entirely from production builds.
/// 7. **Debug** — `#if DEBUG` only, below everything shippable.
struct PreferencesView: View {
    @Environment(AuthManager.self) private var authManager
    @AppStorage("defaultAppWeightUnit") private var defaultAppWeightUnit: AppWeightUnit = .grams
    @AppStorage("preferMetric") private var preferMetric: Bool = true
    @AppStorage("temperatureUnit") private var temperatureUnit: AppPreferences.TemperatureUnit = .fahrenheit
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    @AppStorage("apiBaseURL") private var apiBaseURL: String = ""

    @State private var showingClearDataConfirm = false
    @Environment(\.openURL) private var openURL
    @State private var notificationsEnabled = false
    @State private var notificationAuthStatus: UNAuthorizationStatus = .notDetermined

    var body: some View {
        #if os(macOS)
        // Fixed-size tabbed layout for the macOS Settings window (Cmd+,). Tab
        // order mirrors the iOS section order.
        TabView {
            syncTab
                .tabItem { Label("Sync", systemImage: "arrow.triangle.2.circlepath") }
            unitsTab
                .tabItem { Label("Units", systemImage: "scalemass") }
            advancedTab
                .tabItem { Label("Advanced", systemImage: "wrench.and.screwdriver") }
            #if DEBUG
            debugTab
                .tabItem { Label("Debug", systemImage: "ladybug") }
            #endif
        }
        .padding(20)
        .frame(width: 460, height: 360)
        .clearDataConfirmation(isPresented: $showingClearDataConfirm, onConfirm: clearAppData)
        #else
        // iOS: a single scrolling form pushed onto a navigation stack. The
        // macOS tabs become grouped sections so all settings stay reachable
        // on iPhone, where there is no dedicated Settings window.
        Form {
            generalSection
            SubscriptionSettingsSection()
            SyncStatusSection()
            unitsSection
            notificationSection
            advancedSection
            aboutSection
            developerSection
            #if DEBUG
            Section("Debug") {
                NavigationLink("On-device AI") { OfflineAIView() }
            }
            #endif
        }
        .navigationTitle("Settings")
        .clearDataConfirmation(isPresented: $showingClearDataConfirm, onConfirm: clearAppData)
        .onAppear { Task { await refreshNotificationStatus() } }
        #endif
    }

    /// Android-style "Clear Data": wipes all local data including auth, then
    /// returns the app to the auth gate (the user is signed out).
    private func clearAppData() {
        authManager.clearAllData()
    }

    #if os(macOS)
    #if DEBUG
    private var debugTab: some View {
        NavigationStack {
            OfflineAIView()
        }
    }
    #endif

    private var syncTab: some View {
        Form { SyncStatusSection() }
            .packRatFormStyle()
    }

    private var unitsTab: some View {
        Form { unitsSection }
            .packRatFormStyle()
    }

    private var advancedTab: some View {
        Form {
            advancedSection
            aboutSection
            developerSection
        }
        .packRatFormStyle()
    }
    #endif

    // MARK: - Units

    /// Weight, temperature, and wind/distance are all measurement display, so
    /// they share one section. Temperature previously sat alone under a "General"
    /// header, which named nothing and separated it from the settings it belongs
    /// with. Headers here are noun phrases without ending punctuation.
    @ViewBuilder
    private var unitsSection: some View {
        Section {
            Picker("Default Weight Unit", selection: $defaultAppWeightUnit) {
                ForEach(AppWeightUnit.allCases, id: \.self) { unit in
                    Text(unit.rawValue).tag(unit)
                }
            }
            Toggle("Prefer Metric Display", isOn: $preferMetric)
        } header: {
            Text("Weight")
        }

        Section {
            Picker("Temperature", selection: $temperatureUnit) {
                ForEach(AppPreferences.TemperatureUnit.allCases, id: \.self) { unit in
                    Text(unit.label).tag(unit)
                }
            }
            .pickerStyle(.segmented)

            Picker("Wind & Distance", selection: $speedUnit) {
                ForEach(SpeedUnit.allCases, id: \.self) { unit in
                    Text(unit.label).tag(unit)
                }
            }
            .pickerStyle(.segmented)
        } header: {
            Text("Weather")
        } footer: {
            Text("Applies to forecasts, trail conditions, and trip planning.")
        }
    }

    // MARK: - Notifications

    @ViewBuilder
    private var notificationSection: some View {
        Section {
            if notificationAuthStatus == .denied {
                HStack {
                    Image(systemName: "bell.slash.fill").foregroundStyle(.secondary)
                    Text("Notifications are blocked in Settings")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                    Spacer()
                    #if os(iOS)
                    Button("Open Settings") {
                        if let url = URL(string: UIApplication.openSettingsURLString) {
                            openURL(url)
                        }
                    }
                    .font(.callout)
                    #endif
                }
            } else {
                Toggle("Push Notifications", isOn: $notificationsEnabled)
                    .onChange(of: notificationsEnabled) { _, enabled in
                        Task { await toggleNotifications(enabled) }
                    }
            }
        } header: {
            Text("Notifications")
        }
    }

    private func refreshNotificationStatus() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()
        notificationAuthStatus = settings.authorizationStatus
        notificationsEnabled = settings.authorizationStatus == .authorized
    }

    private func toggleNotifications(_ enable: Bool) async {
        let center = UNUserNotificationCenter.current()
        if enable {
            let status = await center.notificationSettings().authorizationStatus
            if status == .notDetermined {
                _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
            }
        }
        await refreshNotificationStatus()
    }

    // MARK: - Advanced

    /// Preference reset only. The backend controls and the local-data wipe that
    /// used to share this section moved to `developerSection`, below About: they
    /// are developer affordances, not user-facing advanced options, and one of
    /// them signs the user out.
    @ViewBuilder
    private var advancedSection: some View {
        Section {
            Button("Reset All Preferences", role: .destructive) {
                resetDefaults()
            }
        } header: {
            Text("Advanced")
        } footer: {
            Text("Returns units and notification preferences to their defaults. Your packs, trips, and sign-in are not affected.")
        }
    }

    // MARK: - Developer

    private var effectiveURL: String {
        if !apiBaseURL.isEmpty { return apiBaseURL }
        if let env = Bundle.main.object(forInfoDictionaryKey: "PACKRAT_ENV") as? String,
           let url = APIClient.environments[env] { return url }
        return "http://localhost:8787"
    }

    /// Developer-only backend controls. Hidden entirely in production so end
    /// users can't repoint the app at a dev/local API or wipe their data.
    @ViewBuilder
    private var developerSection: some View {
        if APIClient.isNonProduction {
            Section {
                HStack {
                    ForEach(["local", "dev", "production"], id: \.self) { env in
                        if let url = APIClient.environments[env] {
                            Button(env.capitalized) {
                                apiBaseURL = url == apiBaseURL ? "" : url
                            }
                            .buttonStyle(.bordered)
                            .tint(effectiveURL == url ? .accentColor : nil)
                        }
                    }
                }
                TextField("Custom URL (overrides build default)", text: $apiBaseURL)
                    .textFieldStyle(.roundedBorder)
                LabeledContent("Effective") {
                    Text(effectiveURL)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("API Server")
            } footer: {
                Text("Empty = use build-time default (PACKRAT_ENV from xcconfig). Changes apply immediately.")
            }

            Section {
                Button("Clear Data", role: .destructive) {
                    showingClearDataConfirm = true
                }
            } header: {
                Text("Developer")
            } footer: {
                Text("Erases all local data — cache, preferences, and sign-in. Signs you out and resets the app.")
            }
        }
    }

    // MARK: - About

    @ViewBuilder
    private var aboutSection: some View {
        Section {
            LabeledContent(appName, value: appVersionString)
        } header: {
            Text("About")
        }
    }

    private var appName: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? (Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String)
            ?? "PackRat"
    }

    /// "v1.2.3 (45)" — short version + build number, matching the version
    /// string the Expo Settings screen shows.
    private var appVersionString: String {
        let short = (Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String) ?? "—"
        let build = (Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String) ?? ""
        return build.isEmpty ? "v\(short)" : "v\(short) (\(build))"
    }

    private func resetDefaults() {
        defaultAppWeightUnit = .grams
        preferMetric = true
        temperatureUnit = .fahrenheit
        speedUnit = .mph
        apiBaseURL = ""
    }
}

private extension View {
    /// Shared confirmation dialog for the destructive "Clear App Data" action.
    func clearDataConfirmation(isPresented: Binding<Bool>, onConfirm: @escaping () -> Void) -> some View {
        alert("Clear Data", isPresented: isPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Clear Data", role: .destructive, action: onConfirm)
        } message: {
            Text("This erases all local data and signs you out. This cannot be undone.")
        }
    }
}

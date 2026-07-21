import SwiftUI

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

struct PreferencesView: View {
    @AppStorage("defaultAppWeightUnit") private var defaultAppWeightUnit: AppWeightUnit = .grams
    @AppStorage("preferMetric") private var preferMetric: Bool = true
    @AppStorage("temperatureUnit") private var temperatureUnit: AppPreferences.TemperatureUnit = .fahrenheit
    @AppStorage("speedUnit") private var speedUnit: SpeedUnit = .mph
    @AppStorage("apiBaseURL") private var apiBaseURL: String = ""

    @State private var showingClearDataConfirm = false

    var body: some View {
        #if os(macOS)
        // Fixed-size tabbed layout for the macOS Settings window (Cmd+,).
        TabView {
            generalTab
                .tabItem { Label("General", systemImage: "gearshape") }
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
        .frame(width: 460, height: 320)
        .clearDataConfirmation(isPresented: $showingClearDataConfirm, onConfirm: clearAppData)
        #else
        // iOS: a single scrolling form pushed onto a navigation stack. The
        // macOS tabs become grouped sections so all settings stay reachable
        // on iPhone, where there is no dedicated Settings window.
        Form {
            generalSection
            unitsSection
            advancedSection
            #if DEBUG
            Section("Debug") {
                NavigationLink("On-device AI") { OfflineAIView() }
            }
            #endif
            aboutSection
        }
        .navigationTitle("Settings")
        .clearDataConfirmation(isPresented: $showingClearDataConfirm, onConfirm: clearAppData)
        #endif
    }

    /// Clears cached data (URL/image caches) and locally stored preference
    /// defaults. Auth lives in the Keychain, so the user stays signed in —
    /// mirrors the Expo Settings "Clear App Data" behavior.
    private func clearAppData() {
        URLCache.shared.removeAllCachedResponses()
        let defaults = UserDefaults.standard
        for key in ["defaultAppWeightUnit", "preferMetric", "temperatureUnit", "speedUnit", "apiBaseURL", "accentColorName"] {
            defaults.removeObject(forKey: key)
        }
    }

    #if os(macOS)
    #if DEBUG
    private var debugTab: some View {
        NavigationStack {
            OfflineAIView()
        }
    }
    #endif

    private var generalTab: some View {
        Form { generalSection }
            .packRatFormStyle()
    }

    private var unitsTab: some View {
        Form { unitsSection }
            .packRatFormStyle()
    }

    private var advancedTab: some View {
        Form { advancedSection }
            .packRatFormStyle()
    }
    #endif

    @ViewBuilder
    private var generalSection: some View {
        Section("Temperature") {
            Picker("Display temperature in", selection: $temperatureUnit) {
                ForEach(AppPreferences.TemperatureUnit.allCases, id: \.self) { unit in
                    Text(unit.label).tag(unit)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    @ViewBuilder
    private var unitsSection: some View {
        Section("Weight") {
            Picker("Default weight unit", selection: $defaultAppWeightUnit) {
                ForEach(AppWeightUnit.allCases, id: \.self) { unit in
                    Text(unit.rawValue).tag(unit)
                }
            }
            Toggle("Prefer metric display", isOn: $preferMetric)
        }

        Section("Wind & Distance") {
            Picker("Wind & distance", selection: $speedUnit) {
                ForEach(SpeedUnit.allCases, id: \.self) { unit in
                    Text(unit.label).tag(unit)
                }
            }
            .pickerStyle(.segmented)
        }
    }

    private var effectiveURL: String {
        if !apiBaseURL.isEmpty { return apiBaseURL }
        if let env = Bundle.main.object(forInfoDictionaryKey: "PACKRAT_ENV") as? String,
           let url = APIClient.environments[env] { return url }
        return "http://localhost:8787"
    }

    @ViewBuilder
    private var advancedSection: some View {
        // Developer-only backend controls. Hidden entirely in production so end
        // users can't repoint the app at a dev/local API or wipe their data.
        if APIClient.isNonProduction {
            Section("API Server") {
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
                Text("Empty = use build-time default (PACKRAT_ENV from xcconfig). Changes apply immediately.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Section("Developer") {
                Button("Clear App Data", role: .destructive) {
                    showingClearDataConfirm = true
                }
                Text("Deletes cached data and locally stored preferences. You stay logged in.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }

        Section {
            Button("Reset All Preferences", role: .destructive) {
                resetDefaults()
            }
        }

        #if os(macOS)
        aboutSection
        #endif
    }

    @ViewBuilder
    private var aboutSection: some View {
        Section("About") {
            LabeledContent(appName, value: appVersionString)
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
        alert("Clear App Data", isPresented: isPresented) {
            Button("Cancel", role: .cancel) {}
            Button("Clear", role: .destructive, action: onConfirm)
        } message: {
            Text("This deletes the cache and locally stored preferences. You will stay logged in.")
        }
    }
}

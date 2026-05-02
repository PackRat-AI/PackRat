import SwiftUI

// MARK: - App-wide user preferences stored in UserDefaults

final class AppPreferences: ObservableObject {
    static let shared = AppPreferences()

    @AppStorage("defaultAppWeightUnit") var defaultAppWeightUnit: AppWeightUnit = .grams
    @AppStorage("preferMetric") var preferMetric: Bool = true
    @AppStorage("temperatureUnit") var temperatureUnit: TemperatureUnit = .fahrenheit
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
    @AppStorage("apiBaseURL") private var apiBaseURL: String = ""

    var body: some View {
        TabView {
            generalTab
                .tabItem { Label("General", systemImage: "gearshape") }
            unitsTab
                .tabItem { Label("Units", systemImage: "scalemass") }
            advancedTab
                .tabItem { Label("Advanced", systemImage: "wrench.and.screwdriver") }
        }
        .padding(20)
        .frame(width: 460, height: 280)
    }

    private var generalTab: some View {
        Form {
            Section("Temperature") {
                Picker("Display temperature in", selection: $temperatureUnit) {
                    ForEach(AppPreferences.TemperatureUnit.allCases, id: \.self) { unit in
                        Text(unit.label).tag(unit)
                    }
                }
                .pickerStyle(.segmented)
            }
        }
        .formStyle(.grouped)
    }

    private var unitsTab: some View {
        Form {
            Section("Weight") {
                Picker("Default weight unit", selection: $defaultAppWeightUnit) {
                    ForEach(AppWeightUnit.allCases, id: \.self) { unit in
                        Text(unit.rawValue).tag(unit)
                    }
                }
                Toggle("Prefer metric display", isOn: $preferMetric)
            }
        }
        .formStyle(.grouped)
    }

    private var effectiveURL: String {
        if !apiBaseURL.isEmpty { return apiBaseURL }
        if let env = Bundle.main.object(forInfoDictionaryKey: "PACKRAT_ENV") as? String,
           let url = APIClient.environments[env] { return url }
        return "http://localhost:8787"
    }

    private var advancedTab: some View {
        Form {
            Section("API Server") {
                HStack {
                    ForEach(["local", "staging", "production"], id: \.self) { env in
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

            Section {
                Button("Reset All Preferences", role: .destructive) {
                    resetDefaults()
                }
            }
        }
        .formStyle(.grouped)
    }

    private func resetDefaults() {
        defaultAppWeightUnit = .grams
        preferMetric = true
        temperatureUnit = .fahrenheit
        apiBaseURL = ""
    }
}

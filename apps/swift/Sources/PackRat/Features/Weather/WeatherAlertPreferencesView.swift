import SwiftUI

struct WeatherAlertPreferencesView: View {
    @AppStorage("alertPref.weatherNotifications") private var weatherNotifications = true
    @AppStorage("alertPref.locationMonitoring") private var locationMonitoring = true
    @AppStorage("alertPref.severeStorms") private var severeStorms = true
    @AppStorage("alertPref.tornadoWarnings") private var tornadoWarnings = true
    @AppStorage("alertPref.floodAlerts") private var floodAlerts = true
    @AppStorage("alertPref.fireDanger") private var fireDanger = true
    @AppStorage("alertPref.winterWeather") private var winterWeather = true
    @AppStorage("alertPref.extremeTemperature") private var extremeTemperature = true
    @AppStorage("alertPref.highWinds") private var highWinds = false
    @AppStorage("alertPref.fogAlerts") private var fogAlerts = false

    var body: some View {
        Form {
            Section("General") {
                Toggle("Weather Notifications", isOn: $weatherNotifications)
                    .accessibilityIdentifier("weather_notifications_toggle")
                Toggle("Location Monitoring", isOn: $locationMonitoring)
            }

            Section {
                Toggle(isOn: $severeStorms) {
                    Label {
                        Text("Severe Storms")
                    } icon: {
                        Image(systemName: "cloud.bolt.rain.fill")
                            .foregroundStyle(.yellow)
                    }
                }
                Toggle(isOn: $tornadoWarnings) {
                    Label {
                        Text("Tornado Warnings")
                    } icon: {
                        Image(systemName: "tornado")
                            .foregroundStyle(.red)
                    }
                }
                Toggle(isOn: $floodAlerts) {
                    Label {
                        Text("Flood Alerts")
                    } icon: {
                        Image(systemName: "drop.fill")
                            .foregroundStyle(.blue)
                    }
                }
                Toggle(isOn: $fireDanger) {
                    Label {
                        Text("Fire Danger")
                    } icon: {
                        Image(systemName: "flame.fill")
                            .foregroundStyle(.orange)
                    }
                }
                Toggle(isOn: $winterWeather) {
                    Label {
                        Text("Winter Weather")
                    } icon: {
                        Image(systemName: "snowflake")
                            .foregroundStyle(.cyan)
                    }
                }
                Toggle(isOn: $extremeTemperature) {
                    Label {
                        Text("Extreme Temperature")
                    } icon: {
                        Image(systemName: "thermometer.sun.fill")
                            .foregroundStyle(.red)
                    }
                }
                Toggle(isOn: $highWinds) {
                    Label {
                        Text("High Winds")
                    } icon: {
                        Image(systemName: "wind")
                            .foregroundStyle(.teal)
                    }
                }
                .accessibilityIdentifier("high_winds_toggle")
                Toggle(isOn: $fogAlerts) {
                    Label {
                        Text("Fog Alerts")
                    } icon: {
                        Image(systemName: "cloud.fog.fill")
                            .foregroundStyle(.secondary)
                    }
                }
            } header: {
                Text("Alert Types")
            } footer: {
                Text("Choose which types of weather alerts you want to be notified about.")
            }
            .disabled(!weatherNotifications)
        }
        .navigationTitle("Alert Preferences")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

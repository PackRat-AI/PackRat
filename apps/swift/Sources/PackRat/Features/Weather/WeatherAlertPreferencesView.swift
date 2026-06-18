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
                    .accessibilityIdentifier("weather_alert_notifications_toggle")
                    .accessibilityLabel("Weather Notifications")
                    .accessibilityValue(weatherNotifications ? "on" : "off")
                Toggle("Location Monitoring", isOn: $locationMonitoring)
                    .accessibilityIdentifier("weather_alert_location_monitoring_toggle")
                    .accessibilityLabel("Location Monitoring")
                    .accessibilityValue(locationMonitoring ? "on" : "off")
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
                .accessibilityIdentifier("weather_alert_severe_storms_toggle")
                .accessibilityLabel("Severe Storms")
                .accessibilityValue(severeStorms ? "on" : "off")
                Toggle(isOn: $tornadoWarnings) {
                    Label {
                        Text("Tornado Warnings")
                    } icon: {
                        Image(systemName: "tornado")
                            .foregroundStyle(.red)
                    }
                }
                .accessibilityIdentifier("weather_alert_tornado_warnings_toggle")
                .accessibilityLabel("Tornado Warnings")
                .accessibilityValue(tornadoWarnings ? "on" : "off")
                Toggle(isOn: $floodAlerts) {
                    Label {
                        Text("Flood Alerts")
                    } icon: {
                        Image(systemName: "drop.fill")
                            .foregroundStyle(.blue)
                    }
                }
                .accessibilityIdentifier("weather_alert_flood_alerts_toggle")
                .accessibilityLabel("Flood Alerts")
                .accessibilityValue(floodAlerts ? "on" : "off")
                Toggle(isOn: $fireDanger) {
                    Label {
                        Text("Fire Danger")
                    } icon: {
                        Image(systemName: "flame.fill")
                            .foregroundStyle(.orange)
                    }
                }
                .accessibilityIdentifier("weather_alert_fire_danger_toggle")
                .accessibilityLabel("Fire Danger")
                .accessibilityValue(fireDanger ? "on" : "off")
                Toggle(isOn: $winterWeather) {
                    Label {
                        Text("Winter Weather")
                    } icon: {
                        Image(systemName: "snowflake")
                            .foregroundStyle(.cyan)
                    }
                }
                .accessibilityIdentifier("weather_alert_winter_weather_toggle")
                .accessibilityLabel("Winter Weather")
                .accessibilityValue(winterWeather ? "on" : "off")
                Toggle(isOn: $extremeTemperature) {
                    Label {
                        Text("Extreme Temperature")
                    } icon: {
                        Image(systemName: "thermometer.sun.fill")
                            .foregroundStyle(.red)
                    }
                }
                .accessibilityIdentifier("weather_alert_extreme_temperature_toggle")
                .accessibilityLabel("Extreme Temperature")
                .accessibilityValue(extremeTemperature ? "on" : "off")
                Toggle(isOn: $highWinds) {
                    Label {
                        Text("High Winds")
                    } icon: {
                        Image(systemName: "wind")
                            .foregroundStyle(.teal)
                    }
                }
                .accessibilityIdentifier("weather_alert_high_winds_toggle")
                .accessibilityLabel("High Winds")
                .accessibilityValue(highWinds ? "on" : "off")
                Toggle(isOn: $fogAlerts) {
                    Label {
                        Text("Fog Alerts")
                    } icon: {
                        Image(systemName: "cloud.fog.fill")
                            .foregroundStyle(.secondary)
                    }
                }
                .accessibilityIdentifier("weather_alert_fog_alerts_toggle")
                .accessibilityLabel("Fog Alerts")
                .accessibilityValue(fogAlerts ? "on" : "off")
            } header: {
                Text("Alert Types")
            } footer: {
                Text("Choose which types of weather alerts you want to be notified about.")
            }
            .disabled(!weatherNotifications)
        }
        .packRatFormStyle()
        .navigationTitle("Alert Preferences")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
    }
}

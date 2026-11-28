#if os(iOS)
import Foundation
import Sentry
import UIKit
import UserNotifications

/// Speaks up during a trip for what the user needs to know straight away: a
/// severe weather alert where they are, an hour left before their contacts
/// are told they're overdue, and a battery low enough to cut tracking short.
/// Each is said once. Runs while PackRat is awake, which tracking, guidance
/// and "Hey PackRat" keep it; the check-in reminders are scheduled
/// notifications, so they arrive either way.
@MainActor
final class TripSafetyAnnouncer {
    static let shared = TripSafetyAnnouncer()

    static let checkInterval: Duration = .seconds(60)
    /// Weather where the user is gets refetched this often while online.
    static let weatherInterval: TimeInterval = 30 * 60
    static let overdueLead: TimeInterval = 60 * 60

    struct Alert: Equatable {
        enum Kind: Equatable {
            case overdue
            case battery
            case weather(title: String)
        }

        /// Said once per trip under this key.
        let key: String
        let kind: Kind
        let text: String
    }

    struct WeatherWarning: Equatable {
        let id: String
        let event: String
        let headline: String?
        let severity: String?
    }

    private var tripId: String?
    private var loop: Task<Void, Never>?
    private var weatherCheckedAt = Date.distantPast
    private var weather: [WeatherWarning] = []
    private let defaults = UserDefaults.standard
    private let announcedKey = "voiceSafetyAlertsAnnounced"

    /// Call whenever trips change: watches the trip in progress, if any.
    func sync() {
        guard VoiceCommandSettings.isAvailable, let trip = VoiceCommandHost.shared.tripInProgress() else { return stop() }
        guard trip.id != tripId else { return }
        stop()
        tripId = trip.id
        UIDevice.current.isBatteryMonitoringEnabled = true
        loop = Task { [weak self] in
            while !Task.isCancelled {
                await self?.check()
                try? await Task.sleep(for: Self.checkInterval)
            }
        }
    }

    func stop() {
        loop?.cancel()
        loop = nil
        tripId = nil
        weather = []
        weatherCheckedAt = .distantPast
    }

    // MARK: - Checking

    private func check(now: Date = Date()) async {
        guard VoiceCommandSettings.isAvailable, let tripId, let trip = VoiceCommandHost.shared.tripInProgress(), trip.id == tripId else { return stop() }
        await refreshWeather(for: trip, now: now)
        let device = UIDevice.current
        let battery: (level: Float, charging: Bool)? = device.batteryLevel < 0
            ? nil
            : (device.batteryLevel, device.batteryState == .charging || device.batteryState == .full)
        let checkIn = SafetyCheckInStore.shared.checkIn(forTrip: trip.id)
        let alerts = Self.due(
            checkIn: checkIn,
            battery: battery,
            weather: weather + cachedWeather(tripId: trip.id),
            tracking: TrackRecorder.shared.isRecording(tripId: trip.id),
            now: now
        )
        var announced = announced(tripId: trip.id)
        for alert in alerts where !announced.contains(alert.key) {
            announced.insert(alert.key)
            // A drop straight to 10% skips the 20% warning.
            if alert.key == Self.batteryKey(10) { announced.insert(Self.batteryKey(20)) }
            save(announced, tripId: trip.id)
            await deliver(alert, trip: trip)
        }
    }

    /// What's due to be said now, before anything already said is skipped.
    nonisolated static func due(
        checkIn: LocalSafetyCheckIn?,
        battery: (level: Float, charging: Bool)?,
        weather: [WeatherWarning],
        tracking: Bool,
        now: Date
    ) -> [Alert] {
        var alerts: [Alert] = []
        for warning in weather where ["severe", "extreme"].contains(warning.severity?.lowercased() ?? "") {
            alerts.append(Alert(
                key: "weather-\(warning.id)",
                kind: .weather(title: warning.event.capitalized),
                text: VoiceAnswers.weatherAlert(event: warning.event, headline: warning.headline)
            ))
        }
        if let checkIn, !checkIn.overdueAlertSent, now >= checkIn.overdueAt.addingTimeInterval(-overdueLead), now < checkIn.overdueAt {
            alerts.append(Alert(
                key: "overdue-\(checkIn.id)-\(Int(checkIn.overdueAt.timeIntervalSince1970))",
                kind: .overdue,
                text: VoiceAnswers.overdueSoon(contacts: checkIn.contactSummary, overdueAt: checkIn.overdueAt, now: now)
            ))
        }
        if let battery, !battery.charging, let step = [10, 20].first(where: { battery.level <= Float($0) / 100 }) {
            alerts.append(Alert(
                key: batteryKey(step),
                kind: .battery,
                text: VoiceAnswers.lowBattery(percent: Int((battery.level * 100).rounded()), tracking: tracking)
            ))
        }
        return alerts
    }

    nonisolated static func batteryKey(_ step: Int) -> String { "battery-\(step)" }

    // MARK: - Weather

    /// Alerts where the user is now: the recording's latest point, otherwise
    /// the trip's destination. Offline, the last result stands.
    private func refreshWeather(for trip: Trip, now: Date) async {
        guard NetworkMonitor.shared.isConnected, now.timeIntervalSince(weatherCheckedAt) >= Self.weatherInterval else { return }
        let point: (Double, Double)? = TrackRecorder.shared.track?.lastSample.map { ($0.latitude, $0.longitude) }
            ?? trip.location.map { ($0.latitude, $0.longitude) }
        guard let point else { return }
        weatherCheckedAt = now
        do {
            let forecast = try await WeatherService.shared.getForecast(query: "\(point.0),\(point.1)")
            weather = (forecast.alerts?.alert ?? []).compactMap { alert in
                guard let event = alert.event ?? alert.headline else { return nil }
                return WeatherWarning(id: alert.id, event: event, headline: alert.headline, severity: alert.severity)
            }
        } catch {
            SentrySDK.capture(error: error) { scope in
                scope.setTag(value: "voiceCommands", key: "feature")
                scope.setTag(value: "safetyAlertWeather", key: "action")
                scope.setExtra(value: trip.id, key: "tripId")
            }
        }
    }

    /// The destination forecast PackRat already has for the trip.
    private func cachedWeather(tripId: String) -> [WeatherWarning] {
        (TripConditionsStore.shared.conditions(for: tripId)?.alerts ?? []).map {
            WeatherWarning(id: $0.id, event: $0.event, headline: nil, severity: $0.severity)
        }
    }

    // MARK: - Saying it

    private func deliver(_ alert: Alert, trip: Trip) async {
        let crumb = Breadcrumb(level: .info, category: "voiceCommands")
        crumb.message = "Safety alert"
        crumb.data = ["key": alert.key, "tripId": trip.id]
        SentrySDK.addBreadcrumb(crumb)

        if alert.kind != .overdue { notify(alert, trip: trip) }
        guard VoiceCommandSettings.safetyAlertsSpoken else { return }
        // Waits for a command or a guidance prompt to finish rather than
        // talking over it, for up to two minutes.
        for _ in 0..<60 {
            let phase = VoiceCommandController.shared.phase
            let busy = phase == .listening || phase == .confirming || phase == .working || VoiceSpeaker.shared.isSpeaking
            if !busy { break }
            try? await Task.sleep(for: .seconds(2))
        }
        await VoiceSpeaker.shared.say(alert.text)
        VoiceAudioSession.deactivate()
    }

    /// The overdue reminder is already scheduled; the rest get one now, so
    /// there's something to read back if the alert wasn't heard.
    private func notify(_ alert: Alert, trip: Trip) {
        let content = UNMutableNotificationContent()
        switch alert.kind {
        case .weather(let title): content.title = title
        case .battery: content.title = "Low battery"
        case .overdue: return
        }
        content.body = alert.text
        content.sound = .default
        content.userInfo = [SafetyCheckInNotifications.tripIdKey: trip.id]
        UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: "voice-safety-\(trip.id)-\(alert.key)", content: content, trigger: nil)
        )
    }

    // MARK: - Said already

    private func announced(tripId: String) -> Set<String> {
        let all = defaults.dictionary(forKey: announcedKey) as? [String: [String]] ?? [:]
        return Set(all[tripId] ?? [])
    }

    private func save(_ keys: Set<String>, tripId: String) {
        // Only the trip in progress matters, so older trips are dropped.
        defaults.set([tripId: Array(keys)], forKey: announcedKey)
    }
}
#endif

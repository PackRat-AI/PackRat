#if os(iOS)
import Foundation
import Observation
import Sentry
import SwiftData

/// Runs one spoken command at a time for the trip on screen: listen, work out
/// what was said, read anything that tells other people something back for a
/// spoken yes, act through the same stores the trip page's buttons use, and
/// answer out loud and in the banner.
@Observable
@MainActor
final class VoiceCommandController {
    static let shared = VoiceCommandController()

    enum Phase: Equatable {
        case idle
        case listening
        case working
        /// Waiting on a spoken yes or no.
        case confirming
        case answering
    }

    private(set) var phase: Phase = .idle
    /// What PackRat heard, then what it said, for the banner on the trip page.
    private(set) var heard = ""
    private(set) var answer = ""

    private let listener = VoiceListener()
    private let speaker = VoiceSpeaker.shared
    private var run: Task<Void, Never>?

    private var speaksAnswers: Bool { VoiceCommandSettings.speaksAnswers }

    private var metric: Bool {
        UserDefaults.standard.object(forKey: "preferMetric") as? Bool ?? true
    }

    /// Everything a command needs from the trip page.
    struct Context {
        let trip: Trip
        let pack: Pack?
        let viewModel: TripsViewModel
        let modelContext: ModelContext
    }

    // MARK: - Push to talk

    /// The microphone button went down: start listening.
    func beginListening(_ context: Context) {
        guard phase == .idle || phase == .answering else { return }
        // The first press only asks for the microphone and speech recognition.
        // The alert takes the touch away, so listening starts on the next hold.
        if VoiceListener.needsPermission {
            Task { try? await VoiceListener.requestPermissions() }
            return
        }
        speaker.stop()
        run?.cancel()
        heard = ""
        answer = ""
        phase = .listening
        listener.onPartial = { [weak self] in self?.heard = $0 }
        VoiceTone.start()
        run = Task { [weak self] in
            guard let self else { return }
            do {
                let transcript = try await self.listener.listen(.untilStopped)
                VoiceTone.end()
                await self.handle(transcript, context)
            } catch {
                VoiceTone.end()
                await self.respond((error as? LocalizedError)?.errorDescription ?? VoiceAnswers.notHeard)
            }
        }
    }

    /// The microphone button came up: stop listening and act on what was heard.
    func endListening() {
        guard phase == .listening else { return }
        listener.stop()
    }

    func dismiss() {
        run?.cancel()
        listener.cancel()
        speaker.stop()
        phase = .idle
        heard = ""
        answer = ""
        VoiceAudioSession.deactivate()
    }

    // MARK: - Commands

    func handle(_ transcript: String, _ context: Context) async {
        heard = transcript
        guard let command = VoiceCommandParser.parse(transcript) else {
            if transcript.isEmpty { return finishQuietly() }
            return await respond(VoiceAnswers.notHeard)
        }
        let crumb = Breadcrumb(level: .info, category: "voiceCommands")
        crumb.message = "Voice command"
        crumb.data = ["command": String(describing: command), "tripId": context.trip.id]
        SentrySDK.addBreadcrumb(crumb)
        phase = .working
        await perform(command, context)
    }

    private func perform(_ command: VoiceCommand, _ context: Context) async {
        let store = SafetyCheckInStore.shared
        let trip = context.trip
        let checkIn = store.checkIn(forTrip: trip.id)
        let now = Date()
        let online = NetworkMonitor.shared.isConnected

        switch command {
        case .startTrip:
            guard trip.lifecycle == .planned else { return await respond(VoiceAnswers.alreadyStarted) }
            context.viewModel.setLifecycle(trip.id, status: .inProgress, context: context.modelContext)
            guard SafetyCheckInStore.isEnabled, let contact = store.defaultContact, contact.canBeNotified else {
                return await respond(VoiceAnswers.tripStarted)
            }
            let expected = SafetyCheckInDefaults.expectedReturn(for: trip, now: now)
            guard await confirm(VoiceAnswers.confirmNotify(contact: contact.name, expectedReturn: expected, now: now)) else {
                return await respond(VoiceAnswers.tripStarted)
            }
            store.start(
                tripId: trip.id,
                tripName: trip.name,
                contacts: [contact],
                expectedReturnAt: expected,
                graceMinutes: SafetyGracePeriod.defaultMinutes,
                gear: SafetyCheckInDefaults.identifyingGear(from: context.pack?.items ?? []),
                trackingEnabled: false,
                now: now
            )
            await respond(VoiceAnswers.notified(contact: contact.name, online: online))

        case .checkIn:
            guard let checkIn else { return await respond(VoiceAnswers.noContactsTold) }
            guard let fix = await currentFix() else { return await respond(noFixAnswer) }
            guard await confirm(VoiceAnswers.confirmCheckIn(contacts: checkIn.contactSummary, placeName: fix.placeName)) else {
                return await respond(VoiceAnswers.cancelled)
            }
            store.recordCheckIn(tripId: trip.id, location: fix, note: nil)
            await respond(VoiceAnswers.checkedIn(online: online))

        case .imSafe:
            if checkIn != nil {
                guard await confirm(VoiceAnswers.confirmSafe(tripName: trip.name)) else {
                    return await respond(VoiceAnswers.cancelled)
                }
                store.end(tripId: trip.id, outcome: .safe)
                context.viewModel.setLifecycle(trip.id, status: .complete, context: context.modelContext)
                await respond(VoiceAnswers.markedSafe(online: online))
            } else {
                guard trip.lifecycle == .inProgress else { return await respond(VoiceAnswers.noTrip) }
                guard await confirm(VoiceAnswers.confirmFinish(tripName: trip.name)) else {
                    return await respond(VoiceAnswers.cancelled)
                }
                context.viewModel.setLifecycle(trip.id, status: .complete, context: context.modelContext)
                await respond(VoiceAnswers.finished)
            }

        case .extendBy, .extendUntil:
            guard let checkIn else { return await respond(VoiceAnswers.noCheckIn) }
            let target = Self.newReturn(for: command, current: checkIn.expectedReturnAt, now: now)
            guard await confirm(VoiceAnswers.confirmExtend(to: target, contacts: checkIn.contactSummary, now: now)) else {
                return await respond(VoiceAnswers.cancelled)
            }
            store.extend(tripId: trip.id, to: target)
            await respond(VoiceAnswers.extended(to: target, online: online, now: now))

        case .whereAmI:
            guard let fix = await currentFix() else { return await respond(noFixAnswer) }
            let progress = trip.plannedRoute.flatMap { RouteProgress(position: fix.point, route: $0) }
            await respond(VoiceAnswers.whereAmI(
                placeName: fix.placeName, progress: progress,
                latitude: fix.latitude, longitude: fix.longitude,
                altitudeMeters: fix.altitude, metric: metric
            ))

        case .howFarToGo, .amIOnRoute:
            if let session = TripGuide.shared.session, session.tripId == trip.id {
                if command == .howFarToGo {
                    return await respond(VoiceAnswers.guidanceRemaining(session.guide, toward: session.bearing, metric: metric))
                }
                if let progress = session.guide.progress { return await respond(VoiceAnswers.onRoute(progress, metric: metric)) }
            }
            guard let route = trip.plannedRoute, route.count >= 2 else { return await respond(VoiceAnswers.noRoute) }
            guard let fix = await currentFix(), let progress = RouteProgress(position: fix.point, route: route) else {
                return await respond(noFixAnswer)
            }
            await respond(command == .howFarToGo
                ? VoiceAnswers.remaining(progress, metric: metric)
                : VoiceAnswers.onRoute(progress, metric: metric))

        case .whenAmIDue:
            guard let checkIn else { return await respond(VoiceAnswers.noCheckIn) }
            await respond(VoiceAnswers.dueBack(expectedReturn: checkIn.expectedReturnAt, graceMinutes: checkIn.graceMinutes, now: now))

        case .weather:
            guard let conditions = TripConditionsStore.shared.conditions(for: trip.id) else {
                return await respond(VoiceAnswers.noForecast)
            }
            await respond(VoiceAnswers.weather(conditions, metric: metric, now: now))

        case .startTracking, .pauseTracking, .resumeTracking, .stopTracking, .trackSoFar:
            await performTracking(command, context)

        case .navigate(let spoken):
            await navigate(to: spoken, context)

        case .stopNavigating:
            guard TripGuide.shared.isGuiding(tripId: trip.id) else { return await respond(VoiceAnswers.notNavigating) }
            TripGuide.shared.stop()
            await respond(VoiceAnswers.navigationStopped(tracking: TrackRecorder.shared.isRecording(tripId: trip.id)))

        case .markWaypoint(let name):
            guard let fix = await waypointFix() else { return await respond(noFixAnswer) }
            let waypoint = TripWaypoint.named(name, latitude: fix.latitude, longitude: fix.longitude, elevation: fix.altitude)
            await context.viewModel.addWaypoint(waypoint, to: trip.id, context: context.modelContext)
            await respond(VoiceAnswers.waypointMarked(waypoint.name))

        case .note(let text):
            guard !text.isEmpty else { return await respond(VoiceAnswers.noteEmpty) }
            guard let fix = await waypointFix() else { return await respond(noFixAnswer) }
            let waypoint = TripWaypoint.named(nil, note: text, latitude: fix.latitude, longitude: fix.longitude, elevation: fix.altitude)
            await context.viewModel.addWaypoint(waypoint, to: trip.id, context: context.modelContext)
            await respond(VoiceAnswers.noteSaved)
        }
    }

    private func performTracking(_ command: VoiceCommand, _ context: Context) async {
        let recorder = TrackRecorder.shared
        let trip = context.trip
        if let track = recorder.track, track.tripId != trip.id {
            return await respond(VoiceAnswers.trackingOtherTrip(track.tripName))
        }
        switch command {
        case .startTracking:
            guard recorder.track == nil else { return await respond(VoiceAnswers.alreadyTracking) }
            guard trip.lifecycle != .complete else { return await respond(VoiceAnswers.tripEnded) }
            do {
                try await recorder.start(tripId: trip.id, tripName: trip.name)
            } catch {
                return await respond(VoiceAnswers.locationDenied)
            }
            // Tracking a trip that hasn't started starts it.
            if trip.lifecycle == .planned {
                context.viewModel.setLifecycle(trip.id, status: .inProgress, context: context.modelContext)
                return await respond(VoiceAnswers.tripStartedTracking)
            }
            await respond(VoiceAnswers.trackingStarted)

        case .pauseTracking:
            guard let track = recorder.track else { return await respond(VoiceAnswers.notTracking) }
            guard !track.isPaused else { return await respond(VoiceAnswers.alreadyPaused) }
            recorder.pause()
            await respond(VoiceAnswers.trackingPaused)

        case .resumeTracking:
            guard let track = recorder.track else { return await respond(VoiceAnswers.notTracking) }
            guard track.isPaused else { return await respond(VoiceAnswers.notPaused) }
            recorder.resume()
            await respond(VoiceAnswers.trackingResumed)

        case .stopTracking:
            guard let track = recorder.stop() else { return await respond(VoiceAnswers.notTracking) }
            await context.viewModel.saveRecording(track, context: context.modelContext)
            await respond(VoiceAnswers.trackingStopped(track, metric: metric))

        case .trackSoFar:
            guard let track = recorder.track else { return await respond(VoiceAnswers.notTracking) }
            await respond(VoiceAnswers.trackSoFar(track, metric: metric))

        default:
            break
        }
    }

    private func navigate(to spoken: String, _ context: Context) async {
        let trip = context.trip
        let guide = TripGuide.shared
        guard trip.lifecycle != .complete else { return await respond(VoiceAnswers.tripEnded) }
        if let other = guide.session, other.tripId != trip.id {
            return await respond(VoiceAnswers.navigatingOtherTrip(other.tripName))
        }
        let waypoints = trip.log?.waypoints ?? []
        guard let destination = GuidanceDestination.resolve(spoken, waypoints: waypoints, route: trip.plannedRoute) else {
            let options = GuidanceDestination.options(waypoints: waypoints, route: trip.plannedRoute)
            return await respond(options.isEmpty ? VoiceAnswers.noDestinations : VoiceAnswers.unknownDestination(spoken, options: options))
        }
        do {
            let (plan, position) = try await guide.start(tripId: trip.id, tripName: trip.name, to: destination, route: trip.plannedRoute)
            await respond(VoiceAnswers.navigating(plan, from: position, metric: metric))
        } catch TripGuide.StartError.denied {
            await respond(VoiceAnswers.locationDenied)
        } catch TripGuide.StartError.alreadyThere {
            await respond(VoiceAnswers.alreadyThere(destination.name))
        } catch {
            await respond(VoiceAnswers.noFix)
        }
    }

    /// The return time a command asks for. A time of day already past today
    /// means tomorrow.
    nonisolated static func newReturn(for command: VoiceCommand, current: Date, now: Date, calendar: Calendar = .current) -> Date {
        switch command {
        case .extendBy(let minutes):
            return max(current, now).addingTimeInterval(TimeInterval(minutes * 60))
        case .extendUntil(let hour, let minute):
            guard let today = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: now) else { return current }
            return today > now ? today : calendar.date(byAdding: .day, value: 1, to: today) ?? today
        default:
            return current
        }
    }

    // MARK: - Speaking and confirming

    /// Asks a yes/no question and listens hands-free for the answer. Anything
    /// but a clear yes, including silence, is a no.
    private func confirm(_ question: String) async -> Bool {
        phase = .confirming
        answer = question
        if speaksAnswers { await speaker.say(question) }
        guard !Task.isCancelled else { return false }
        VoiceTone.start()
        let reply = (try? await listener.listen(.untilSilence)) ?? ""
        VoiceTone.end()
        heard = reply
        phase = .working
        return VoiceCommandParser.parseConfirmation(reply) == .yes
    }

    private func respond(_ text: String) async {
        guard !Task.isCancelled else { return }
        phase = .answering
        answer = text
        if speaksAnswers { await speaker.say(text) }
        VoiceAudioSession.deactivate()
    }

    private func finishQuietly() {
        phase = .idle
        VoiceAudioSession.deactivate()
    }

    private var locationDenied = false

    /// Why there's no fix: location turned off for PackRat, or no signal.
    private var noFixAnswer: String { locationDenied ? VoiceAnswers.locationDenied : VoiceAnswers.noFix }

    /// The recorder's latest point when it's fresh, so marking a waypoint
    /// while tracking is instant; otherwise a new fix.
    private func waypointFix() async -> SafetyLocationFix? {
        if let sample = TrackRecorder.shared.track?.lastSample, Date().timeIntervalSince(sample.time) < 30 {
            var fix = SafetyLocationFix(latitude: sample.latitude, longitude: sample.longitude, accuracy: TrackRecorder.worstAccuracy, recordedAt: sample.time)
            fix.altitude = sample.altitude
            return fix
        }
        return await currentFix()
    }

    private func currentFix() async -> SafetyLocationFix? {
        locationDenied = false
        do {
            return try await SafetyCheckInLocator().currentFix(timeout: .seconds(15))
        } catch SafetyCheckInLocator.LocatorError.denied {
            locationDenied = true
            return nil
        } catch {
            return nil
        }
    }
}

private extension SafetyLocationFix {
    var point: TripRoutePoint { TripRoutePoint(latitude: latitude, longitude: longitude) }
}
#endif

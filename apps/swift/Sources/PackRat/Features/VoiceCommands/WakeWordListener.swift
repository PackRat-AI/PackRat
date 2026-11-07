#if os(iOS)
import AVFoundation
import Foundation
import Observation
import Sentry
import Speech
import SwiftData
import UIKit

/// Listens for "Hey PackRat" while a trip is in progress, with the screen off.
///
/// Recognition is on the phone only, and the words are only checked for the
/// phrase: nothing heard is kept. Listening steps aside whenever PackRat
/// itself listens or speaks, and picks up again afterwards.
@Observable
@MainActor
final class WakeWordListener {
    static let shared = WakeWordListener()

    /// The trip a wake-up runs its command against.
    struct Target {
        let tripId: String
        let pack: Pack?
        let viewModel: TripsViewModel
        let modelContext: ModelContext
    }

    private(set) var isListening = false

    @ObservationIgnored private var target: Target?
    @ObservationIgnored private var suspended = false
    @ObservationIgnored private var request: SFSpeechAudioBufferRecognitionRequest?
    @ObservationIgnored private var task: SFSpeechRecognitionTask?
    @ObservationIgnored private var loop: Task<Void, Never>?
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    /// The current request's transcript and when it last changed. A result
    /// from an earlier request is told apart by `segment`.
    @ObservationIgnored private var segment = 0
    @ObservationIgnored private var heard = ""
    @ObservationIgnored private var changedAt = Date.distantPast
    @ObservationIgnored private var failed = false

    /// One recognition request is restarted this often, so a whole day of
    /// listening never builds into one long transcript.
    static let segmentLength: TimeInterval = 50
    /// After "Hey PackRat", this much quiet ends the command said with it.
    static let commandPause: TimeInterval = 1.2
    /// The longest command said in the same breath as the wake phrase.
    static let commandLimit: TimeInterval = 6

    init() {
        let center = NotificationCenter.default
        // A call or Siri takes the microphone; listening resumes after.
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { note in
            let ended = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt).flatMap(AVAudioSession.InterruptionType.init) == .ended
            Task { @MainActor in
                let listener = WakeWordListener.shared
                if ended { listener.startIfPossible() } else { listener.stopListening(closeMicrophone: true) }
            }
        })
        // A new headset or a lost one stops the input; carry on with the new route.
        observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: nil, queue: .main) { _ in
            Task { @MainActor in
                let listener = WakeWordListener.shared
                guard listener.isArmed else { return }
                listener.stopListening(closeMicrophone: true)
                listener.startIfPossible()
            }
        })
        // The microphone can't be opened from the background, so a restart
        // that was turned down there is tried again on return.
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in WakeWordListener.shared.startIfPossible() }
        })
    }

    var isArmed: Bool { target != nil }

    // MARK: - Arming

    func arm(_ target: Target) {
        self.target = target
        startIfPossible()
    }

    /// Stops listening for good, for one trip or whichever is armed.
    func disarm(tripId: String? = nil) {
        guard tripId == nil || target?.tripId == tripId else { return }
        target = nil
        stopListening(closeMicrophone: true)
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    /// PackRat is about to listen or speak itself.
    func suspend() {
        suspended = true
        stopListening(closeMicrophone: false)
    }

    /// PackRat has finished listening and speaking.
    func resume() {
        suspended = false
        startIfPossible()
    }

    // MARK: - Listening

    private func startIfPossible() {
        guard target != nil, !suspended, !isListening, VoiceCommandSettings.wakeWordEnabled,
              SFSpeechRecognizer.authorizationStatus() == .authorized,
              AVAudioApplication.shared.recordPermission == .granted,
              let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              recognizer.supportsOnDeviceRecognition, recognizer.isAvailable
        else { return }

        do {
            // Mixes with music rather than ducking it: this runs for the whole
            // trip, and only PackRat speaking should lower anything.
            // Changing the category under a running microphone stops it, so
            // it's only set when it isn't already this.
            let session = AVAudioSession.sharedInstance()
            let options: AVAudioSession.CategoryOptions = [.mixWithOthers, .allowBluetoothA2DP, .defaultToSpeaker]
            if session.category != .playAndRecord || session.categoryOptions != options {
                try session.setCategory(.playAndRecord, mode: .default, options: options)
            }
            try session.setActive(true)
            try VoiceMicrophone.shared.start()
        } catch {
            stopListening(closeMicrophone: true)
            return
        }
        startSegment(recognizer)
        isListening = true
    }

    /// A fresh recognition request on the microphone that's already open.
    private func startSegment(_ recognizer: SFSpeechRecognizer) {
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.contextualStrings = ["Hey PackRat", "PackRat"]
        self.request = request

        VoiceMicrophone.shared.attach(request, for: .wakeWord)

        segment += 1
        let current = segment
        heard = ""
        changedAt = Date()
        failed = false
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            let text = result?.bestTranscription.formattedString
            Task { @MainActor in
                guard let self, self.segment == current else { return }
                if let text, text != self.heard {
                    self.heard = text
                    self.changedAt = Date()
                } else if error != nil {
                    self.failed = true
                }
            }
        }

        let startedAt = Date()
        loop = Task { [weak self] in
            var wokeAt: Date?
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(150))
                guard let self, !Task.isCancelled else { return }
                let now = Date()
                if wokeAt == nil, WakePhrase.command(after: self.heard) != nil { wokeAt = now }
                if let wokeAt {
                    // Wait for the rest of "Hey PackRat, mark waypoint".
                    if now.timeIntervalSince(self.changedAt) >= Self.commandPause || now.timeIntervalSince(wokeAt) >= Self.commandLimit {
                        self.wake(command: WakePhrase.command(after: self.heard) ?? "")
                        return
                    }
                } else if self.failed || now.timeIntervalSince(startedAt) >= Self.segmentLength {
                    self.restartSegment(recognizer)
                    return
                }
            }
        }
    }

    private func restartSegment(_ recognizer: SFSpeechRecognizer) {
        tearDownSegment()
        startSegment(recognizer)
    }

    private func wake(command: String) {
        // The microphone stays open for the command that follows.
        stopListening(closeMicrophone: false)
        guard let target,
              let trip = target.viewModel.trips.first(where: { $0.id == target.tripId }),
              trip.lifecycle == .inProgress
        else { return disarm() }
        let crumb = Breadcrumb(level: .info, category: "voiceCommands")
        crumb.message = "Wake phrase heard"
        crumb.data = ["tripId": trip.id, "withCommand": !command.isEmpty]
        SentrySDK.addBreadcrumb(crumb)
        let context = VoiceCommandController.Context(trip: trip, pack: target.pack, viewModel: target.viewModel, modelContext: target.modelContext)
        Task { await VoiceCommandController.shared.handleWake(command: command, context) }
    }

    private func tearDownSegment() {
        loop?.cancel()
        loop = nil
        VoiceMicrophone.shared.detach(.wakeWord)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
    }

    private func stopListening(closeMicrophone: Bool) {
        tearDownSegment()
        isListening = false
        if closeMicrophone { VoiceMicrophone.shared.stop() }
    }
}
#endif

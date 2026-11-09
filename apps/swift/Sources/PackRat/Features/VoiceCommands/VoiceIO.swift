#if os(iOS)
import AVFoundation
import Foundation
import Sentry
import Speech
import UIKit

/// Says PackRat's answers out loud, through a headset when one is connected,
/// lowering any music while it speaks.
@MainActor
final class VoiceSpeaker: NSObject, AVSpeechSynthesizerDelegate {
    static let shared = VoiceSpeaker()

    private let synthesizer = AVSpeechSynthesizer()
    private var finished: CheckedContinuation<Void, Never>?
    /// The sentence `finished` waits on. A cancelled sentence's callback
    /// arrives late and must not end the next one.
    private var current: AVSpeechUtterance?

    override init() {
        super.init()
        synthesizer.delegate = self
        // Speech gets its own system-run session, which lowers music while it
        // talks and raises it after. PackRat's own session can't: it keeps the
        // microphone open for "Hey PackRat", and iOS refuses to duck from a
        // session that's recording in the background.
        synthesizer.usesApplicationAudioSession = false
    }

    /// Speaks `text` and returns once it has been said (or cut off).
    func say(_ text: String) async {
        synthesizer.stopSpeaking(at: .immediate)
        resumeFinished()
        VoiceAudioSession.activate()
        let utterance = AVSpeechUtterance(string: VoiceAnswers.speakable(text))
        utterance.voice = voice
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        await withCheckedContinuation { continuation in
            finished = continuation
            current = utterance
            synthesizer.speak(utterance)
        }
    }

    var isSpeaking: Bool { synthesizer.isSpeaking }

    /// Looked up each time, so a voice downloaded mid-trip is used straight away.
    private var voice: AVSpeechSynthesisVoice? {
        let picked = Self.preferredVoice
        if picked?.identifier != lastVoiceId {
            lastVoiceId = picked?.identifier
            VoiceLog.note("Speaking with \(picked?.identifier ?? "the system default"), quality \(picked?.quality.rawValue ?? 0)")
        }
        return picked
    }

    private var lastVoiceId: String?

    /// The voice PackRat speaks with, shown in Settings.
    static var preferredVoice: AVSpeechSynthesisVoice? { bestVoice(among: AVSpeechSynthesisVoice.speechVoices()) }

    /// True when only a standard voice is on the phone, so Settings can say
    /// where to get a more natural one.
    static var hasNaturalVoice: Bool { (preferredVoice?.quality ?? .default) != .default }

    /// The most natural voice on the phone in the user's language: premium,
    /// then enhanced (both downloaded in Settings, under Accessibility, then
    /// Spoken Content), then the standard one; the user's own region first
    /// within each, then US English. Novelty voices are never picked.
    nonisolated static func bestVoice(among voices: [AVSpeechSynthesisVoice], locale: Locale = .current) -> AVSpeechSynthesisVoice? {
        let language = locale.language.languageCode?.identifier ?? "en"
        let region = locale.region.map { "\(language)-\($0.identifier)" }
        func rank(_ voice: AVSpeechSynthesisVoice) -> (Int, Int) {
            let quality: Int
            switch voice.quality {
            case .premium: quality = 2
            case .enhanced: quality = 1
            default: quality = 0
            }
            let place = voice.language == region ? 2 : voice.language == "\(language)-US" ? 1 : 0
            return (quality, place)
        }
        return voices
            .filter { $0.language.hasPrefix(language) && !$0.voiceTraits.contains(.isNoveltyVoice) && !$0.voiceTraits.contains(.isPersonalVoice) }
            .max { rank($0) < rank($1) }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        resumeFinished()
    }

    private func resumeFinished() {
        finished?.resume()
        finished = nil
        current = nil
    }

    private func ended(_ utterance: AVSpeechUtterance) {
        guard utterance === current else { return }
        resumeFinished()
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.ended(utterance) }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.ended(utterance) }
    }
}

/// One shared audio session setup for listening and speaking: record and play
/// at once, prefer a Bluetooth headset, otherwise the loudspeaker, and duck
/// whatever else is playing. "Hey PackRat" steps aside meanwhile.
///
/// While "Hey PackRat" is on, the session is never closed mid-trip, because
/// iOS won't let an app start recording again from the background.
@MainActor
enum VoiceAudioSession {
    static let listeningOptions: AVAudioSession.CategoryOptions = [.mixWithOthers, .allowBluetoothA2DP, .defaultToSpeaker]

    static func activate() {
        let wakeWord = WakeWordListener.shared
        wakeWord.suspend()
        if wakeWord.isArmed {
            do {
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                VoiceLog.note("Session couldn't activate: \(error)")
            }
            return
        }
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(
            .playAndRecord,
            mode: .spokenAudio,
            options: [.duckOthers, .allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker]
        )
        try? session.setActive(true)
    }

    static func deactivate() {
        let wakeWord = WakeWordListener.shared
        if wakeWord.isArmed { return wakeWord.resume() }
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

}

/// Breadcrumbs for the audio path, which only misbehaves on a real phone in
/// a pocket, where there's no debugger.
enum VoiceLog {
    static func note(_ message: String) {
        print("[voice] \(message)")
        let crumb = Breadcrumb(level: .info, category: "voiceCommands")
        crumb.message = message
        SentrySDK.addBreadcrumb(crumb)
    }
}

/// The one microphone input that listening reads from. Kept running for the
/// whole trip while "Hey PackRat" is on, because a stopped input can't be
/// started again until PackRat is back on screen.
@MainActor
final class VoiceMicrophone {
    static let shared = VoiceMicrophone()

    enum Listener {
        case wakeWord
        case command
    }

    private var engine: AVAudioEngine?
    private let sink = BufferSink()

    var isRunning: Bool { engine?.isRunning == true }

    func start() throws {
        if isRunning { return }
        stop()
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        // An input with no channels (no microphone) can't be tapped at all.
        guard format.sampleRate > 0, format.channelCount > 0 else { throw VoiceListener.ListenError.unavailable }
        let sink = self.sink
        input.installTap(onBus: 0, bufferSize: 1_024, format: format) { buffer, _ in
            sink.deliver(buffer)
        }
        engine.prepare()
        try engine.start()
        self.engine = engine
    }

    func stop() {
        if let engine {
            if engine.isRunning { engine.stop() }
            engine.inputNode.removeTap(onBus: 0)
        }
        engine = nil
    }

    func attach(_ request: SFSpeechAudioBufferRecognitionRequest, for listener: Listener) {
        sink.set(request, for: listener)
    }

    func detach(_ listener: Listener) {
        sink.set(nil, for: listener)
    }
}

/// Hands each microphone buffer to whichever recognisers are attached. Called
/// on the audio thread, hence the lock.
private final class BufferSink: @unchecked Sendable {
    private let lock = NSLock()
    private var wakeWord: SFSpeechAudioBufferRecognitionRequest?
    private var command: SFSpeechAudioBufferRecognitionRequest?

    func set(_ request: SFSpeechAudioBufferRecognitionRequest?, for listener: VoiceMicrophone.Listener) {
        lock.lock()
        defer { lock.unlock() }
        switch listener {
        case .wakeWord: wakeWord = request
        case .command: command = request
        }
    }

    func deliver(_ buffer: AVAudioPCMBuffer) {
        lock.lock()
        let targets = [wakeWord, command]
        lock.unlock()
        for request in targets { request?.append(buffer) }
    }
}

/// Listens for one command, on the phone only.
///
/// Recognition never leaves the device (`requiresOnDeviceRecognition`), which
/// is what makes commands work in Airplane Mode, and nothing is recorded:
/// audio goes straight from the microphone into the recogniser.
@MainActor
final class VoiceListener {
    enum ListenError: LocalizedError {
        case microphoneDenied
        case speechDenied
        case unavailable
        case failed

        var errorDescription: String? {
            switch self {
            case .microphoneDenied:
                "PackRat needs the microphone for voice commands. Allow it in Settings › PackRat."
            case .speechDenied:
                "PackRat needs speech recognition for voice commands. Allow it in Settings › PackRat."
            case .unavailable:
                "Voice commands aren't available in this language on this iPhone."
            case .failed:
                "PackRat couldn't listen just now. Try again."
            }
        }
    }

    /// How listening ends: when the user lets go of the button, or after a
    /// pause in speech for hands-free questions like "Send it?".
    enum Mode {
        case untilStopped
        case untilSilence
    }

    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var transcript = ""
    private var lastHeard = Date.distantPast
    private var stopRequested = false
    private var generation = 0
    private var recognitionFailed = false

    private(set) var isListening = false
    /// What has been heard so far, for the on-screen banner.
    var onPartial: ((String) -> Void)?

    /// Silence after speech that ends a hands-free answer.
    static let endOfSpeechPause: TimeInterval = 1.2
    /// How long to wait for anything at all before giving up.
    static let noSpeechTimeout: TimeInterval = 5

    /// Either permission hasn't been asked for yet.
    static var needsPermission: Bool {
        SFSpeechRecognizer.authorizationStatus() == .notDetermined
            || AVAudioApplication.shared.recordPermission == .undetermined
    }

    static func requestPermissions() async throws {
        let speech = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speech == .authorized else { throw ListenError.speechDenied }
        guard await AVAudioApplication.requestRecordPermission() else { throw ListenError.microphoneDenied }
    }

    func listen(_ mode: Mode) async throws -> String {
        // A release that comes before listening is under way still ends it;
        // the flag is cleared once this listen is over.
        defer { stopRequested = false }
        try await Self.requestPermissions()
        guard let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              recognizer.supportsOnDeviceRecognition, recognizer.isAvailable
        else { throw ListenError.unavailable }

        cancel()
        VoiceAudioSession.activate()
        transcript = ""
        recognitionFailed = false
        generation += 1
        let thisListen = generation
        let startedAt = Date()
        lastHeard = .distantPast

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.taskHint = .confirmation
        request.contextualStrings = ["check in", "I'm safe", "PackRat", "on route", "due back"]
        self.request = request

        do {
            try VoiceMicrophone.shared.start()
        } catch {
            self.request = nil
            throw ListenError.unavailable
        }
        VoiceMicrophone.shared.attach(request, for: .command)
        isListening = true

        // Results from an earlier listen, such as the command before a yes
        // or no, are ignored by their generation.
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let text = result?.bestTranscription.formattedString else {
                if error != nil {
                    Task { @MainActor in
                        guard let self, self.generation == thisListen else { return }
                        self.recognitionFailed = true
                    }
                }
                return
            }
            Task { @MainActor in
                guard let self, self.isListening, self.generation == thisListen else { return }
                if text != self.transcript {
                    self.transcript = text
                    self.lastHeard = Date()
                    self.onPartial?(text)
                }
            }
        }

        // Poll rather than wait on the recogniser's final result: on-device
        // recognition can take a second to finalise after audio ends, and a
        // partial that has stopped changing is already the answer.
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(150))
            if stopRequested || recognitionFailed { break }
            let now = Date()
            if mode == .untilSilence {
                if transcript.isEmpty, now.timeIntervalSince(startedAt) > Self.noSpeechTimeout { break }
                if !transcript.isEmpty, now.timeIntervalSince(lastHeard) > Self.endOfSpeechPause { break }
            }
            // Push-to-talk is capped too, so a stuck button can't hold the mic open.
            if now.timeIntervalSince(startedAt) > 30 { break }
        }
        // Give the recogniser a moment to catch the last word after release.
        if mode == .untilStopped { try? await Task.sleep(for: .milliseconds(400)) }
        let heard = transcript
        let failed = recognitionFailed && heard.isEmpty
        cancel()
        if failed { throw ListenError.failed }
        return heard
    }

    /// Ends push-to-talk; `listen` returns what was heard.
    func stop() {
        stopRequested = true
    }

    func cancel() {
        VoiceMicrophone.shared.detach(.command)
        // The microphone opens only while listening, unless "Hey PackRat" keeps it open.
        if !WakeWordListener.shared.isArmed { VoiceMicrophone.shared.stop() }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
    }
}

/// The start and end tones around listening, played through the voice
/// session so they're heard while the microphone is open, with a tap.
@MainActor
enum VoiceTone {
    private static let startPlayer = player("begin_record")
    private static let endPlayer = player("end_record")

    static func start() { play(startPlayer, fallback: 1113, haptic: .medium) }
    static func end() { play(endPlayer, fallback: 1114, haptic: .light) }

    private static func player(_ name: String) -> AVAudioPlayer? {
        let player = try? AVAudioPlayer(contentsOf: URL(filePath: "/System/Library/Audio/UISounds/\(name).caf"))
        player?.prepareToPlay()
        return player
    }

    private static func play(_ player: AVAudioPlayer?, fallback: SystemSoundID, haptic: UIImpactFeedbackGenerator.FeedbackStyle) {
        UIImpactFeedbackGenerator(style: haptic).impactOccurred()
        VoiceAudioSession.activate()
        if let player {
            player.currentTime = 0
            player.play()
        } else {
            AudioServicesPlaySystemSound(fallback)
        }
    }
}
#endif

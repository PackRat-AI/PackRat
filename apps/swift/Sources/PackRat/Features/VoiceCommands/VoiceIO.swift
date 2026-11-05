#if os(iOS)
import AVFoundation
import Foundation
import Speech

/// Says PackRat's answers out loud, through a headset when one is connected,
/// lowering any music while it speaks.
@MainActor
final class VoiceSpeaker: NSObject, AVSpeechSynthesizerDelegate {
    static let shared = VoiceSpeaker()

    private let synthesizer = AVSpeechSynthesizer()
    private var finished: CheckedContinuation<Void, Never>?

    override init() {
        super.init()
        synthesizer.delegate = self
    }

    /// Speaks `text` and returns once it has been said (or cut off).
    func say(_ text: String) async {
        synthesizer.stopSpeaking(at: .immediate)
        resumeFinished()
        VoiceAudioSession.activate()
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: Locale.current.identifier.replacingOccurrences(of: "_", with: "-"))
            ?? AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate
        await withCheckedContinuation { continuation in
            finished = continuation
            synthesizer.speak(utterance)
        }
    }

    func stop() {
        synthesizer.stopSpeaking(at: .immediate)
        resumeFinished()
    }

    private func resumeFinished() {
        finished?.resume()
        finished = nil
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in self.resumeFinished() }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in self.resumeFinished() }
    }
}

/// One shared audio session setup for listening and speaking: record and play
/// at once, prefer a Bluetooth headset, otherwise the loudspeaker, and duck
/// whatever else is playing.
enum VoiceAudioSession {
    static func activate() {
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(
            .playAndRecord,
            mode: .spokenAudio,
            options: [.duckOthers, .allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker]
        )
        try? session.setActive(true)
    }

    static func deactivate() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
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

        var errorDescription: String? {
            switch self {
            case .microphoneDenied:
                "PackRat needs the microphone for voice commands. Allow it in Settings › PackRat."
            case .speechDenied:
                "PackRat needs speech recognition for voice commands. Allow it in Settings › PackRat."
            case .unavailable:
                "Voice commands aren't available in this language on this iPhone."
            }
        }
    }

    /// How listening ends: when the user lets go of the button, or after a
    /// pause in speech for hands-free questions like "Send it?".
    enum Mode {
        case untilStopped
        case untilSilence
    }

    private var audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var transcript = ""
    private var lastHeard = Date.distantPast
    private var stopRequested = false

    private(set) var isListening = false
    /// What has been heard so far, for the on-screen banner.
    var onPartial: ((String) -> Void)?

    /// Silence after speech that ends a hands-free answer.
    static let endOfSpeechPause: TimeInterval = 1.2
    /// How long to wait for anything at all before giving up.
    static let noSpeechTimeout: TimeInterval = 5

    static func requestPermissions() async throws {
        let speech = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { continuation.resume(returning: $0) }
        }
        guard speech == .authorized else { throw ListenError.speechDenied }
        guard await AVAudioApplication.requestRecordPermission() else { throw ListenError.microphoneDenied }
    }

    func listen(_ mode: Mode) async throws -> String {
        try await Self.requestPermissions()
        guard let recognizer = SFSpeechRecognizer(locale: Locale.current) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US")),
              recognizer.supportsOnDeviceRecognition, recognizer.isAvailable
        else { throw ListenError.unavailable }

        cancel()
        VoiceAudioSession.activate()
        transcript = ""
        stopRequested = false
        let startedAt = Date()
        lastHeard = .distantPast

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.requiresOnDeviceRecognition = true
        request.shouldReportPartialResults = true
        request.taskHint = .confirmation
        request.contextualStrings = ["check in", "I'm safe", "PackRat", "on route", "due back"]
        self.request = request

        // A fresh engine after the session is configured, so the input format
        // matches the hardware. A stale one makes installTap raise, and an
        // input with no channels (no microphone) can't be tapped at all.
        audioEngine = AVAudioEngine()
        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            self.request = nil
            throw ListenError.unavailable
        }
        input.installTap(onBus: 0, bufferSize: 1_024, format: format) { [weak request] buffer, _ in
            request?.append(buffer)
        }
        audioEngine.prepare()
        try audioEngine.start()
        isListening = true

        task = recognizer.recognitionTask(with: request) { [weak self] result, _ in
            guard let text = result?.bestTranscription.formattedString else { return }
            Task { @MainActor in
                guard let self, self.isListening else { return }
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
            if stopRequested { break }
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
        cancel()
        return heard
    }

    /// Ends push-to-talk; `listen` returns what was heard.
    func stop() {
        stopRequested = true
    }

    func cancel() {
        if audioEngine.isRunning { audioEngine.stop() }
        audioEngine.inputNode.removeTap(onBus: 0)
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
    }
}

/// The start and end tones around listening.
enum VoiceTone {
    static func start() { AudioServicesPlaySystemSound(1113) }
    static func end() { AudioServicesPlaySystemSound(1114) }
}
#endif

#if os(iOS)
import SwiftUI

/// Hold-to-talk at the bottom of a trip page from the day it starts, with a
/// banner showing what PackRat heard and what it answered.
struct TripVoiceBar: View {
    let trip: Trip
    let pack: Pack?
    let viewModel: TripsViewModel

    @Environment(\.modelContext) private var modelContext
    @State private var controller = VoiceCommandController.shared
    @State private var wakeWord = WakeWordListener.shared
    @AppStorage(VoiceCommandSettings.wakeWordKey) private var wakeWordOn = false
    @AppStorage(VoiceCommandSettings.wakeWordOfferedKey) private var wakeWordOffered = false
    @State private var showingCommands = false
    @State private var offeringWakeWord = false
    /// Resets on its own when the touch is cancelled, such as by a permission
    /// alert, so the button never sticks in the listening state.
    @GestureState private var pressing = false

    /// Shown while the trip is underway, and on its start day so "start my
    /// trip" works too.
    static func shows(for trip: Trip, now: Date = Date()) -> Bool {
        guard VoiceCommandSettings.isAvailable else { return false }
        switch trip.lifecycle {
        case .inProgress: return true
        case .complete: return false
        case .planned:
            guard let start = trip.startDate?.toDate() else { return true }
            return Calendar.current.startOfDay(for: start) <= now
        }
    }

    var body: some View {
        VStack(spacing: 10) {
            if controller.phase != .idle {
                banner
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
            VStack(spacing: 6) {
                micButton
                // Stays while an answer is on screen; hidden only while PackRat
                // is mid-command.
                if controller.phase == .idle || controller.phase == .answering {
                    hint
                        .transition(.opacity)
                }
            }
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
        .animation(.snappy, value: controller.phase)
        .animation(.snappy, value: wakeWord.isArmed)
        .onAppear { VoiceTone.warmUp() }
        .onDisappear { controller.dismiss() }
        .sheet(isPresented: $showingCommands) { VoiceCommandsSheet() }
        // Offered once, when a trip first gets underway, rather than left for
        // the user to find in Settings.
        .task(id: "\(trip.lifecycle)-\(controller.phase)") { offerWakeWordIfNeeded() }
        .alert("Talk to PackRat Hands-Free?", isPresented: $offeringWakeWord) {
            Button("Turn On") {
                wakeWordOffered = true
                wakeWordOn = true
                if VoiceListener.needsPermission { Task { try? await VoiceListener.requestPermissions() } }
            }
            Button("Not Now", role: .cancel) { wakeWordOffered = true }
        } message: {
            Text("Say “Hey PackRat” and a command while your trip is underway, even with your phone locked. You can turn this off in Settings.")
        }
        // Hands-free listening follows the trip: on while it's underway and
        // the user has turned it on, off once it ends.
        .task(id: "\(trip.id)-\(trip.lifecycle)-\(wakeWordOn)") {
            if trip.lifecycle == .inProgress, VoiceCommandSettings.wakeWordEnabled {
                wakeWord.arm(.init(tripId: trip.id, pack: pack, viewModel: viewModel, modelContext: modelContext))
            } else {
                wakeWord.disarm(tripId: trip.id)
            }
        }
    }

    private func offerWakeWordIfNeeded() {
        guard trip.lifecycle == .inProgress, !wakeWordOn, !wakeWordOffered, controller.phase == .idle else { return }
        offeringWakeWord = true
    }

    /// A command worth trying now, changing every few seconds; a tap opens
    /// the full list.
    private var hint: some View {
        Button {
            showingCommands = true
        } label: {
            TimelineView(.periodic(from: .now, by: 5)) { timeline in
                let example = currentExample(at: timeline.date)
                HStack(spacing: 4) {
                    Image(systemName: wakeWord.isArmed ? "ear" : "lightbulb")
                    Text(wakeWord.isArmed ? "Say “Hey PackRat, \(example)”" : "Try saying “\(example)”")
                        .contentTransition(.opacity)
                        .animation(.easeInOut, value: example)
                    Image(systemName: "info.circle")
                }
                .font(.caption.weight(.medium))
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("What you can say")
        .accessibilityHint("Shows every voice command.")
        .accessibilityIdentifier("trip_voice_hint")
    }

    private func currentExample(at date: Date) -> String {
        let examples = VoiceExamples.current(
            lifecycle: trip.lifecycle,
            tracking: TrackRecorder.shared.isRecording(tripId: trip.id),
            guiding: TripGuide.shared.isGuiding(tripId: trip.id),
            hasCheckIn: SafetyCheckInStore.shared.checkIn(forTrip: trip.id) != nil,
            hasRoute: (trip.plannedRoute?.count ?? 0) >= 2
        )
        return examples[Int(date.timeIntervalSinceReferenceDate / 5) % examples.count]
    }

    private var banner: some View {
        HStack(alignment: .top, spacing: 12) {
            Group {
                if controller.phase == .working {
                    ProgressView()
                } else {
                    Image(systemName: bannerSymbol)
                        .font(.title3)
                        .foregroundStyle(.tint)
                        .symbolEffect(.variableColor.iterative, isActive: controller.phase == .listening || controller.phase == .confirming)
                }
            }
            .frame(width: 28)
            VStack(alignment: .leading, spacing: 4) {
                if !controller.heard.isEmpty {
                    Text("“\(controller.heard)”")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                if !controller.answer.isEmpty {
                    Text(controller.answer)
                        .font(.callout.weight(.medium))
                } else if controller.phase == .listening, controller.heard.isEmpty {
                    Text("Listening…")
                        .font(.callout.weight(.medium))
                } else if !controller.status.isEmpty {
                    Text(controller.status)
                        .font(.callout.weight(.medium))
                        .foregroundStyle(.secondary)
                }
                if controller.phase == .confirming {
                    Text("Say yes to send, or no to cancel.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                controller.dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
            .accessibilityIdentifier("trip_voice_dismiss")
        }
        .padding(14)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("trip_voice_banner")
    }

    private var bannerSymbol: String {
        switch controller.phase {
        case .listening, .confirming: "waveform"
        default: "bubble.left.fill"
        }
    }

    private var micButton: some View {
        // Waiting on a spoken yes or no listens too, so the button says so
        // rather than inviting another hold.
        let active = controller.phase == .listening || controller.phase == .confirming
        return Label(active ? "Listening" : "Hold to Talk", systemImage: active ? "waveform" : "mic.fill")
            .font(.headline)
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(active ? Color.red : Color.accentColor, in: Capsule())
            .scaleEffect(active ? 1.03 : 1)
            .shadow(color: .black.opacity(0.15), radius: 8, y: 3)
            .contentShape(Capsule())
            .gesture(
                DragGesture(minimumDistance: 0)
                    .updating($pressing) { _, state, _ in state = true }
            )
            .onChange(of: pressing) { _, isPressing in
                if isPressing {
                    controller.beginListening(.init(trip: trip, pack: pack, viewModel: viewModel, modelContext: modelContext))
                } else {
                    controller.endListening()
                }
            }
            .sensoryFeedback(.impact(weight: .medium), trigger: active)
            .accessibilityElement()
            .accessibilityLabel("Voice command")
            .accessibilityHint("Hold and speak a command, then let go.")
            .accessibilityAddTraits(.isButton)
            // VoiceOver can't hold a press, so a double-tap starts and a second one stops.
            .accessibilityAction {
                if active {
                    controller.endListening()
                } else {
                    controller.beginListening(.init(trip: trip, pack: pack, viewModel: viewModel, modelContext: modelContext))
                }
            }
            .accessibilityIdentifier("trip_voice_button")
    }
}
#endif

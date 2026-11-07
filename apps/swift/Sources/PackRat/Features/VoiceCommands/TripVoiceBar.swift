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
                if wakeWord.isListening, controller.phase == .idle {
                    Label("Say “Hey PackRat” anytime", systemImage: "ear")
                        .font(.caption.weight(.medium))
                        .foregroundStyle(.secondary)
                        .transition(.opacity)
                        .accessibilityIdentifier("trip_voice_wake_word")
                }
            }
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
        .animation(.snappy, value: controller.phase)
        .animation(.snappy, value: wakeWord.isListening)
        .onDisappear { controller.dismiss() }
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

    private var banner: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: bannerSymbol)
                .font(.title3)
                .foregroundStyle(.tint)
                .symbolEffect(.variableColor.iterative, isActive: controller.phase == .listening || controller.phase == .confirming)
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
        case .working: "ellipsis"
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

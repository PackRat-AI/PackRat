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
    @State private var pressing = false

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
            micButton
        }
        .padding(.horizontal)
        .padding(.bottom, 8)
        .animation(.snappy, value: controller.phase)
        .onDisappear { controller.dismiss() }
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
        let active = controller.phase == .listening
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
                    .onChanged { _ in
                        guard !pressing else { return }
                        pressing = true
                        controller.beginListening(.init(trip: trip, pack: pack, viewModel: viewModel, modelContext: modelContext))
                    }
                    .onEnded { _ in
                        pressing = false
                        controller.endListening()
                    }
            )
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

import SwiftUI

/// Contextual, dismissible offer to watch a location — surfaced only when a
/// lookup already has an active alert (see docs/features/weather-alerts.md
/// ADR-003). A `.safeAreaInset` card rather than an `.alert()`/`.sheet()`:
/// the HIG reserves those for decisions that must be resolved before the
/// user can continue, and this suggestion is exactly the opposite.
struct WatchLocationPromptBanner: View {
    let locationName: String
    let onWatch: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.title3)

            VStack(alignment: .leading, spacing: 6) {
                Text("Active alert for \(locationName)")
                    .font(.subheadline.bold())
                Text("Watch this location to get notified about future alerts, even when the app is closed.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Watch This Location", action: onWatch)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                    .accessibilityIdentifier("watch_location_prompt_watch_button")
            }

            Spacer()

            Button {
                onDismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss")
            .accessibilityIdentifier("watch_location_prompt_dismiss_button")
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
        .padding(.bottom, 8)
        .transition(.move(edge: .bottom).combined(with: .opacity))
        .accessibilityIdentifier("watch_location_prompt_banner")
    }
}

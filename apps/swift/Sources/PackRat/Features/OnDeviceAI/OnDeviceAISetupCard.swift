import SwiftUI

/// Shown in the chat when On-device is chosen but can't answer yet: the
/// Gemma download, or the way to turn on Apple Intelligence.
struct OnDeviceAISetupCard: View {
    let availability: OnDeviceAIAvailability
    @Bindable private var store = GemmaModelStore.shared
    @State private var confirmingDownload = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            switch availability {
            case .appleIntelligenceOff:
                header(
                    "Turn on Apple Intelligence",
                    systemImage: "apple.intelligence",
                    detail: "On-device chat uses Apple Intelligence. Turn it on in Settings, then come back."
                )
                OpenSettingsButton()
            case .appleModelPreparing:
                header(
                    "Apple Intelligence is getting ready",
                    systemImage: "hourglass",
                    detail: "Your device is still downloading Apple Intelligence. On-device chat is ready once it finishes."
                )
            case .gemma:
                gemmaContent
            case .apple, .unsupported:
                EmptyView()
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .padding(.horizontal, 12)
        .accessibilityIdentifier("on_device_ai_setup_card")
    }

    @ViewBuilder
    private var gemmaContent: some View {
        switch store.state {
        case .notDownloaded, .failed:
            header(
                "Download the on-device model",
                systemImage: "arrow.down.circle",
                detail: "Chat with no signal, and keep what you type on this device. One-time download of \(GemmaModelSize.formatted)."
            )
            if case .failed(let message) = store.state {
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }
            Button("Download") { confirmingDownload = true }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("on_device_ai_download")
                .confirmationDialog(
                    "Download \(GemmaModelSize.formatted)?",
                    isPresented: $confirmingDownload,
                    titleVisibility: .visible
                ) {
                    Button("Download") { store.download() }
                } message: {
                    Text("Wi-Fi recommended. You can delete the model anytime in Settings.")
                }
        case .waitingForWiFi:
            header(
                "Waiting for Wi-Fi",
                systemImage: "wifi",
                detail: "The download starts when you're on Wi-Fi. To use cellular data, turn it on in Settings under On-device AI."
            )
            Button("Cancel", role: .cancel) { store.cancel() }
                .buttonStyle(.bordered)
        case .downloading(let fraction):
            header(
                "Downloading the on-device model",
                systemImage: "arrow.down.circle",
                detail: "Keep PackRat open until it finishes."
            )
            ProgressView(value: fraction)
                .accessibilityLabel("Download progress")
                .accessibilityValue(Text(fraction, format: .percent.precision(.fractionLength(0))))
            HStack {
                Text(fraction, format: .percent.precision(.fractionLength(0)))
                    .font(.footnote.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
                Button("Cancel", role: .cancel) { store.cancel() }
                    .buttonStyle(.bordered)
            }
        case .downloaded:
            EmptyView()
        }
    }

    private func header(_ title: String, systemImage: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Label(title, systemImage: systemImage)
                .font(.headline)
            Text(detail)
                .font(.callout)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

enum GemmaModelSize {
    static var formatted: String {
        ByteCountFormatter.string(fromByteCount: GemmaModelStore.downloadSize, countStyle: .file)
    }
}

/// Opens the app's page in Settings, the closest a third-party app can link to
/// the Apple Intelligence switch.
private struct OpenSettingsButton: View {
    @Environment(\.openURL) private var openURL

    var body: some View {
        Button("Open Settings") {
            #if os(iOS)
            if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
            #else
            if let url = URL(string: "x-apple.systempreferences:com.apple.Siri-Settings.extension") { openURL(url) }
            #endif
        }
        .buttonStyle(.borderedProminent)
    }
}

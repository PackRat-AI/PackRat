import Defaults
import SwiftUI

/// Settings › On-device AI: which model answers on-device chats, and managing
/// the downloaded one.
struct OnDeviceAISettingsView: View {
    @State private var availability = OnDeviceAIAvailability.current
    @Bindable private var store = QwenModelStore.shared
    @Default(.onDeviceAIAllowsCellular) private var allowsCellular
    @State private var confirmingDelete = false

    var body: some View {
        Form {
            switch availability {
            case .apple, .appleIntelligenceOff, .appleModelPreparing:
                appleSection
            case .qwen:
                qwenSection
                cellularSection
            case .unsupported:
                Section {
                    Text("This device can't run on-device AI. Chat uses Cloud.")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .packRatFormStyle()
        .navigationTitle("On-device AI")
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
        .onAppear { availability = .current }
    }

    private var appleSection: some View {
        Section {
            LabeledContent("Model", value: "Apple Intelligence")
            LabeledContent("Status", value: appleStatus)
        } footer: {
            Text("Built into your device. Nothing to download.")
        }
    }

    private var appleStatus: String {
        switch availability {
        case .apple: return "Ready"
        case .appleModelPreparing: return "Getting ready"
        default: return "Off"
        }
    }

    @ViewBuilder
    private var qwenSection: some View {
        Section {
            LabeledContent("Model", value: QwenModelStore.displayName)
            switch store.state {
            case .downloaded:
                LabeledContent("Size on device", value: QwenModelSize.formatted)
                Button("Delete Model", role: .destructive) { confirmingDelete = true }
                    .confirmationDialog(
                        "Delete the on-device model?",
                        isPresented: $confirmingDelete,
                        titleVisibility: .visible
                    ) {
                        Button("Delete", role: .destructive) { store.delete() }
                    } message: {
                        Text("Frees \(QwenModelSize.formatted). On-device chat stops working until you download it again.")
                    }
            case .downloading(let fraction):
                ProgressView(value: fraction) {
                    Text("Downloading")
                } currentValueLabel: {
                    Text(fraction, format: .percent.precision(.fractionLength(0)))
                }
                Button("Cancel Download", role: .cancel) { store.cancel() }
            case .waitingForWiFi:
                LabeledContent("Status", value: "Waiting for Wi-Fi")
                Button("Cancel Download", role: .cancel) { store.cancel() }
            case .notDownloaded, .failed:
                if case .failed(let message) = store.state {
                    Text(message).foregroundStyle(.red)
                }
                Button("Download (\(QwenModelSize.formatted))") { store.download() }
            }
        } footer: {
            Text("Answers on-device chats with no signal. What you type stays on this device.")
        }
    }

    private var cellularSection: some View {
        Section {
            Toggle("Download Over Cellular", isOn: $allowsCellular)
        } footer: {
            Text("Applies to the next download.")
        }
    }
}

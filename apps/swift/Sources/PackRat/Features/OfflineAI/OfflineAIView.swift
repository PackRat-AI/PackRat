import Defaults
import SwiftUI

/// Debug surface for the offline (on-device) AI feature.
///
/// **Intentionally not user-facing on production builds.** This view is wired
/// up only behind `#if DEBUG` from `PreferencesView`. Production callers
/// should consume the underlying `OfflineAIViewModel` directly once a real UX
/// design lands.
public struct OfflineAIView: View {
    @State private var viewModel: OfflineAIViewModel
    @Default(.useRealLocalLLM) private var useRealLocalLLM

    @MainActor
    public init(viewModel: OfflineAIViewModel? = nil) {
        _viewModel = State(initialValue: viewModel ?? OfflineAIViewModel())
    }

    public var body: some View {
        Form {
            providerSection
            promptSection
            responseSection
        }
        .packRatFormStyle()
        .navigationTitle("Offline AI (Debug)")
        #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
        #endif
    }

    // MARK: - Sections

    private var providerSection: some View {
        Section("Provider") {
            Toggle("Use real on-device LLM (MLX)", isOn: $useRealLocalLLM)
                .disabled(true)
            LabeledContent("Active provider") {
                Text("MockLocalLLMProvider")
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }
            Text("The MLX provider is not available in this build. Offline AI uses the local mock provider until model packaging and runtime loading are production-ready.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("Flag changes apply on next view appearance.")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
    }

    private var promptSection: some View {
        Section("Prompt") {
            TextField("Ask anything…", text: $viewModel.prompt, axis: .vertical)
                .lineLimit(2 ... 5)
                .textFieldStyle(.roundedBorder)
                .disabled(viewModel.isGenerating)

            HStack {
                Button("Ask offline") { viewModel.submit() }
                    .buttonStyle(.borderedProminent)
                    .disabled(!viewModel.canSubmit)
                    .keyboardShortcut(.return, modifiers: .command)

                if viewModel.isGenerating {
                    Button("Cancel", role: .cancel) { viewModel.cancel() }
                        .buttonStyle(.bordered)
                }

                Spacer()

                Button("Reset", role: .destructive) { viewModel.reset() }
                    .buttonStyle(.bordered)
                    .disabled(viewModel.response.isEmpty && viewModel.prompt.isEmpty)
            }
        }
    }

    @ViewBuilder
    private var responseSection: some View {
        Section("Response") {
            switch viewModel.state {
            case .idle where viewModel.response.isEmpty:
                Text("No response yet. Enter a prompt above and press “Ask offline.”")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            case .idle:
                Text(viewModel.response)
                    .font(.callout)
                    .textSelection(.enabled)
            case .generating:
                HStack {
                    ProgressView()
                    if viewModel.response.isEmpty {
                        Text("Generating…")
                            .foregroundStyle(.secondary)
                    } else {
                        Text(viewModel.response)
                            .font(.callout)
                            .textSelection(.enabled)
                    }
                }
            case .error(let message):
                VStack(alignment: .leading, spacing: 6) {
                    Label(message, systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.red)
                    if !viewModel.response.isEmpty {
                        Text("Partial response:")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(viewModel.response)
                            .font(.callout)
                            .textSelection(.enabled)
                    }
                }
            }
        }
    }
}

#Preview {
    NavigationStack {
        OfflineAIView(viewModel: OfflineAIViewModel(provider: MockLocalLLMProvider()))
    }
}

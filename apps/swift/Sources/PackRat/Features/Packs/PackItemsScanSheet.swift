import SwiftUI
import PhotosUI

/// Photo → detected gear → pack.
///
/// Mirrors Expo's `ItemsScanScreen`: pick a photo, the server's vision model
/// names the gear it can see and matches each detection against the catalog,
/// then you tick which ones to add. Everything is pre-selected because the
/// common case is "yes, add all of these".
@MainActor
@Observable
final class PackItemsScanViewModel {
    enum Phase: Equatable {
        case picking
        case analyzing
        case reviewing
        case failed(String)
        /// Distinct from `failed` so the sheet can show the connectivity state
        /// directly instead of round-tripping a message through string sniffing.
        case offline
    }

    var phase: Phase = .picking
    var detections: [DetectedItemWithMatches] = []
    /// Indices into `detections` that the user wants to add.
    var selectedIndices: Set<Int> = []
    var isAdding = false

    private let service: ImageDetectionService

    init(service: ImageDetectionService = .shared) {
        self.service = service
    }

    var selectedCount: Int { selectedIndices.count }
    var canAdd: Bool { !selectedIndices.isEmpty && !isAdding }

    func isSelected(_ index: Int) -> Bool { selectedIndices.contains(index) }

    func toggle(_ index: Int) {
        if selectedIndices.contains(index) {
            selectedIndices.remove(index)
        } else {
            selectedIndices.insert(index)
        }
    }

    func selectAll() { selectedIndices = Set(detections.indices) }
    func selectNone() { selectedIndices.removeAll() }

    func analyze(imageData: Data, userId: String) async {
        detections = []
        selectedIndices = []

        // Scanning needs the server's vision model, so there is nothing useful to
        // do offline. Checking up front keeps the user out of a doomed upload and
        // out of the generic failure copy that a transport error produces.
        guard NetworkMonitor.shared.isConnected else {
            phase = .offline
            return
        }

        phase = .analyzing
        do {
            let results = try await service.detectItems(imageData: imageData, userId: userId)
            detections = results
            // Pre-select everything, matching Expo's auto-select-all.
            selectedIndices = Set(results.indices)
            phase = .reviewing
        } catch {
            // A connection that drops mid-upload lands here rather than in the
            // guard above, so classify by error rather than assuming it's generic.
            phase = FriendlyErrorPresentation.isConnectivityError(error)
                ? .offline
                : .failed(error.localizedDescription)
        }
    }

    func resolvedSelection() -> [DetectedItemWithMatches] {
        detections.enumerated()
            .filter { selectedIndices.contains($0.offset) }
            .map(\.element)
    }

    /// Returns to the picker for a fresh photo. The analyzed image is deleted
    /// from R2 server-side, so "try again" always means a new upload rather
    /// than re-analyzing the previous key.
    func reset() {
        phase = .picking
        detections = []
        selectedIndices = []
    }
}

struct PackItemsScanSheet: View {
    let packId: String
    let packsViewModel: PacksViewModel
    var onAdded: ((_ added: Int, _ failed: Int) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @Environment(AuthManager.self) private var authManager

    @State private var viewModel = PackItemsScanViewModel()
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Scan Items")
                #if os(iOS)
                .navigationBarTitleDisplayMode(.inline)
                #endif
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                            .accessibilityIdentifier("pack_scan_cancel")
                    }
                    if case .reviewing = viewModel.phase {
                        ToolbarItem(placement: .primaryAction) {
                            addButton
                        }
                    }
                }
                .onChange(of: photoItem) { _, item in
                    guard let item else { return }
                    Task {
                        defer { photoItem = nil }
                        guard let data = try? await item.loadTransferable(type: Data.self) else {
                            viewModel.phase = .failed("Couldn't read that photo. Try another one.")
                            return
                        }
                        guard let userId = authManager.currentUser?.id else {
                            viewModel.phase = .failed("You need to be signed in to scan gear.")
                            return
                        }
                        await viewModel.analyze(imageData: data, userId: userId)
                    }
                }
        }
        #if os(macOS)
        .frame(minWidth: 520, minHeight: 600)
        #endif
    }

    /// Pluralized in Swift: `^[…](inflect: true)` markup only resolves through a
    /// localization catalog, and this target ships none, so it rendered verbatim.
    private var detectionCountLabel: String {
        let count = viewModel.detections.count
        return "\(count) \(count == 1 ? "item" : "items") found"
    }

    private var addButton: some View {
        Button {
            Task { await addSelected() }
        } label: {
            if viewModel.isAdding {
                ProgressView().controlSize(.small)
            } else {
                Text("Add\(viewModel.selectedCount > 0 ? " (\(viewModel.selectedCount))" : "")").bold()
            }
        }
        .disabled(!viewModel.canAdd)
        .accessibilityIdentifier("pack_scan_confirm_add")
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.phase {
        case .picking:
            pickerState
        case .analyzing:
            VStack(spacing: 14) {
                ProgressView()
                Text("Looking for gear in your photo…")
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .accessibilityIdentifier("pack_scan_analyzing")
        case .reviewing:
            if viewModel.detections.isEmpty {
                noResultsState
            } else {
                reviewList
            }
        case .failed(let message):
            ErrorView(message, retry: { viewModel.reset() })
        case .offline:
            ConnectionUnavailableView(
                message: "Scanning items from a photo needs an internet connection. Reconnect and try again.",
                retry: { viewModel.reset() }
            )
        }
    }

    private var pickerState: some View {
        UnavailableStateView(
            title: "Scan Gear from a Photo",
            subtitle: "Take or choose a photo of your gear laid out, and PackRat will identify the items and match them to the catalog.",
            systemImage: "camera.viewfinder",
            accessibilityIdentifier: "pack_scan_picker"
        ) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Choose Photo", systemImage: "photo.on.rectangle")
            }
            .buttonStyle(.borderedProminent)
            .accessibilityIdentifier("pack_scan_choose_photo")
        }
    }

    private var noResultsState: some View {
        UnavailableStateView(
            title: "No Gear Detected",
            subtitle: "Nothing recognisable turned up in that photo. Try a brighter shot with items spread out and not overlapping.",
            systemImage: "questionmark.viewfinder",
            accessibilityIdentifier: "pack_scan_no_results"
        ) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Try Another Photo", systemImage: "photo.on.rectangle")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var reviewList: some View {
        List {
            Section {
                ForEach(Array(viewModel.detections.enumerated()), id: \.offset) { index, detection in
                    DetectedItemRow(
                        detection: detection,
                        isSelected: viewModel.isSelected(index),
                        onToggle: { viewModel.toggle(index) }
                    )
                }
            } header: {
                HStack {
                    Text(detectionCountLabel)
                    Spacer()
                    Button(viewModel.selectedCount == viewModel.detections.count ? "Select None" : "Select All") {
                        if viewModel.selectedCount == viewModel.detections.count {
                            viewModel.selectNone()
                        } else {
                            viewModel.selectAll()
                        }
                    }
                    .font(.caption.bold())
                    .textCase(nil)
                    .accessibilityIdentifier("pack_scan_select_toggle")
                }
            } footer: {
                Text("Items without a catalog match are added at 0 g — set their weight afterwards.")
            }
        }
        .listStyle(.plain)
        .accessibilityIdentifier("pack_scan_results_list")
    }

    private func addSelected() async {
        let selections = viewModel.resolvedSelection()
        guard !selections.isEmpty else { return }
        viewModel.isAdding = true
        let result = await packsViewModel.addDetectedItems(selections, to: packId)
        viewModel.isAdding = false

        if result.failed > 0 && result.added == 0 {
            viewModel.phase = .failed("Couldn't add those items. Check your connection and try again.")
            return
        }
        onAdded?(result.added, result.failed)
        dismiss()
    }
}

// MARK: - Row

private struct DetectedItemRow: View {
    let detection: DetectedItemWithMatches
    let isSelected: Bool
    let onToggle: () -> Void

    private var match: CatalogItem? { detection.primaryMatch }

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                .font(.title3)
                .foregroundStyle(isSelected ? Color.accentColor : Color.secondary)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                Text(detection.detected.name)
                    .font(.subheadline.weight(.medium))

                HStack(spacing: 8) {
                    if detection.detected.quantity > 1 {
                        Text("×\(detection.detected.quantity)")
                            .font(.caption2.bold())
                            .foregroundStyle(.secondary)
                    }
                    if !detection.detected.category.isEmpty {
                        Text(detection.detected.category.capitalized)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                    confidenceBadge
                }

                if let match {
                    Label(
                        "\(match.displayName)\(match.displayWeight.isEmpty ? "" : " · \(match.displayWeight)")",
                        systemImage: "link"
                    )
                    .font(.caption2)
                    .foregroundStyle(.tint)
                    .lineLimit(1)
                } else {
                    Text("No catalog match — weight not set")
                        .font(.caption2)
                        .foregroundStyle(.orange)
                }
            }

            Spacer(minLength: 0)
        }
        .padding(.vertical, 4)
        .contentShape(Rectangle())
        .onTapGesture(perform: onToggle)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("pack_scan_item_\(detection.detected.name)")
    }

    @ViewBuilder
    private var confidenceBadge: some View {
        let confidence = detection.detected.confidence
        if confidence > 0 {
            Text("\(Int(confidence * 100))%")
                .font(.caption2.monospacedDigit())
                .foregroundStyle(confidence >= 0.7 ? .green : .orange)
        }
    }
}

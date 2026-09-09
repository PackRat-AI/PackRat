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
        /// The picked photo could not be read at all, so there is nothing to
        /// upload and "Try Again" would retry nothing. Distinct from `failed`
        /// for the same reason `offline` is: the sheet states the case itself
        /// rather than routing already-friendly copy through the infrastructure
        /// error classifier, which buckets anything it does not recognise into
        /// "Temporarily Unavailable" with a retry that cannot work.
        case unreadablePhoto
        /// Distinct from `failed` so the sheet can show the connectivity state
        /// directly instead of round-tripping a message through string sniffing.
        case offline
    }

    /// The named steps of a scan, shown instead of one generic label.
    ///
    /// These are the real boundaries in `ImageDetectionService.detectItems` —
    /// the upload completes, then a single request covers vision analysis and
    /// catalog matching. `matching` is therefore not separately observable, so
    /// it is entered when the analyze request is issued rather than reported by
    /// the server. Apple's guidance is to prefer a determinate indicator where
    /// one is honest; the model pass has no progress to report, so this stays
    /// indeterminate and names the stage instead of faking a percentage.
    enum Stage: Int, CaseIterable, Equatable {
        case uploading
        case detecting

        var label: String {
            switch self {
            case .uploading: return "Uploading your photo…"
            case .detecting: return "Looking for gear and matching the catalog…"
            }
        }
    }

    var phase: Phase = .picking
    /// Which step of the analysis is running. Only meaningful in `.analyzing`.
    var stage: Stage = .uploading
    /// The chosen photo, kept so the wait shows the image being analyzed
    /// rather than an empty screen with a spinner (#2695).
    var previewImageData: Data?
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
        previewImageData = imageData

        // Scanning needs the server's vision model, so there is nothing useful to
        // do offline. Checking up front keeps the user out of a doomed upload and
        // out of the generic failure copy that a transport error produces.
        guard NetworkMonitor.shared.isConnected else {
            phase = .offline
            return
        }

        stage = .uploading
        phase = .analyzing
        do {
            let results = try await service.detectItems(
                imageData: imageData,
                userId: userId,
                onUploadFinished: { [weak self] in
                    Task { @MainActor in self?.stage = .detecting }
                }
            )
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
        previewImageData = nil
        stage = .uploading
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
                        guard let data = try? await item.loadTransferable(type: Data.self),
                              !data.isEmpty else {
                            // Common on the simulator, where a library photo's
                            // backing file may not exist, and for iCloud photos
                            // that are not downloaded yet.
                            viewModel.phase = .unreadablePhoto
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
            analyzingState
        case .reviewing:
            if viewModel.detections.isEmpty {
                noResultsState
            } else {
                reviewList
            }
        case .unreadablePhoto:
            UnavailableStateView(
                title: "Couldn't Read That Photo",
                subtitle: "That photo could not be opened. If it is stored in iCloud, open it in Photos first so it downloads to this device, then try again.",
                systemImage: "photo.badge.exclamationmark",
                accessibilityIdentifier: "pack_scan_unreadable_photo"
            ) {
                // Choosing a different photo is the only thing that can help —
                // there is no upload to retry.
                PhotosPicker(selection: $photoItem, matching: .images) {
                    Label("Choose Another Photo", systemImage: "photo.on.rectangle")
                }
                .buttonStyle(.borderedProminent)
                .accessibilityIdentifier("pack_scan_choose_another_photo")
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

    /// The wait, with the photo on screen.
    ///
    /// The scan takes a few seconds — an upload, then a vision pass and catalog
    /// match. NN/g puts a spinner in range for a 2–10s wait, but a bare one
    /// gives no sense of what is happening and no confirmation that the right
    /// photo was picked, which was the complaint in #2695. Showing the image
    /// with the current step named answers both without inventing a percentage
    /// the server cannot report.
    private var analyzingState: some View {
        VStack(spacing: 20) {
            if let data = viewModel.previewImageData, let image = PlatformImage(data: data) {
                Image(platformImage: image)
                    .resizable()
                    .scaledToFit()
                    .frame(maxHeight: 260)
                    .clipShape(RoundedRectangle(cornerRadius: 14))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14)
                            .strokeBorder(.separator, lineWidth: 0.5)
                    )
                    .overlay(alignment: .bottom) { scanningSheen }
                    .accessibilityLabel("The photo being scanned")
                    .accessibilityIdentifier("pack_scan_preview_image")
            }

            VStack(spacing: 12) {
                ProgressView()
                Text(viewModel.stage.label)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    // Announce each step change to VoiceOver, which otherwise
                    // hears one static label for the whole wait.
                    .accessibilityIdentifier("pack_scan_stage_label")
                    .id(viewModel.stage)
                    .transition(.opacity)
            }
            .animation(.easeInOut(duration: 0.2), value: viewModel.stage)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("pack_scan_analyzing")
    }

    /// A soft band at the base of the photo, so the image reads as being worked
    /// on rather than just displayed. Purely decorative — the stage label is
    /// what actually communicates progress.
    private var scanningSheen: some View {
        LinearGradient(
            colors: [.accentColor.opacity(0), .accentColor.opacity(0.22)],
            startPoint: .top,
            endPoint: .bottom
        )
        .frame(height: 60)
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .accessibilityHidden(true)
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

            matchThumbnail

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

    /// The matched product's image beside its row, so a wrong match is obvious
    /// without opening anything (#2695).
    ///
    /// The detection response carries no crop of the photo — `DetectedItemSchema`
    /// returns name, description, quantity, category, flags and confidence, with
    /// no geometry — so the catalog image is the only picture available for a
    /// row. Unmatched detections fall back to the same category glyph the
    /// catalog list uses, keeping the rows a consistent width.
    @ViewBuilder
    private var matchThumbnail: some View {
        let size: CGFloat = 44
        Group {
            if let match, let urlString = match.images?.first, let url = URL(string: urlString) {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().scaledToFill()
                    case .failure:
                        thumbnailPlaceholder
                    case .empty:
                        // No spinner at 44pt — it draws attention to itself and
                        // the row is already readable without the picture.
                        thumbnailPlaceholder
                    @unknown default:
                        thumbnailPlaceholder
                    }
                }
            } else {
                thumbnailPlaceholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .strokeBorder(.separator, lineWidth: 0.5)
        )
        // Decorative: the row's text already names the item and its match, so a
        // second announcement would just make VoiceOver more verbose.
        .accessibilityHidden(true)
    }

    private var thumbnailPlaceholder: some View {
        ZStack {
            Color.secondary.opacity(0.12)
            Image(systemName: match == nil ? "questionmark" : "photo")
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
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

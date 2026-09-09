import Foundation
import Testing
@testable import PackRat

/// Covers #2695: scanning gear from a photo showed a bare spinner and one
/// generic label for the whole wait, then described the results in words only.
/// The sheet now keeps the chosen photo on screen, names the step it is waiting
/// on, and shows the matched product's image beside each detection.
@Suite("Pack items scan view model")
@MainActor
struct PackItemsScanViewModelTests {

    // MARK: - Stages

    @Test("a scan names its steps rather than showing one generic label")
    func stagesAreNamed() {
        // The complaint in #2695 was that the wait "shows the least". Every
        // stage must carry copy a user can read, and they must differ.
        let labels = PackItemsScanViewModel.Stage.allCases.map(\.label)

        #expect(labels.count == 2)
        #expect(Set(labels).count == labels.count)
        for label in labels {
            #expect(label.isEmpty == false)
        }
    }

    @Test("stages run upload first, then detection")
    func stageOrder() {
        // Order matters: the label must not claim the catalog is being matched
        // while the photo is still uploading.
        #expect(PackItemsScanViewModel.Stage.allCases == [.uploading, .detecting])
        #expect(PackItemsScanViewModel.Stage.uploading.rawValue
                < PackItemsScanViewModel.Stage.detecting.rawValue)
    }

    @Test("the upload stage mentions uploading and the detect stage mentions gear")
    func stageCopyMatchesWork() {
        #expect(PackItemsScanViewModel.Stage.uploading.label.localizedCaseInsensitiveContains("upload"))
        #expect(PackItemsScanViewModel.Stage.detecting.label.localizedCaseInsensitiveContains("gear"))
    }

    @Test("a fresh view model starts at the first stage")
    func startsAtFirstStage() {
        let viewModel = PackItemsScanViewModel()

        #expect(viewModel.stage == .uploading)
        #expect(viewModel.phase == .picking)
        #expect(viewModel.previewImageData == nil)
    }

    // MARK: - Photo preview

    @Test("choosing another photo after a failure clears the previous preview")
    func resetClearsPreview() {
        // reset() returns to the picker. A stale preview would show the old
        // photo behind the next scan, and the analyzed image is already gone
        // server-side, so nothing should survive the reset.
        let viewModel = PackItemsScanViewModel()
        viewModel.previewImageData = Data([0xFF, 0xD8, 0xFF])
        viewModel.stage = .detecting
        viewModel.phase = .reviewing

        viewModel.reset()

        #expect(viewModel.previewImageData == nil)
        #expect(viewModel.stage == .uploading)
        #expect(viewModel.phase == .picking)
        #expect(viewModel.detections.isEmpty)
        #expect(viewModel.selectedIndices.isEmpty)
    }

    // MARK: - Selection

    @Test("select all then none moves every row and leaves Add disabled when empty")
    func selectionToggles() {
        let viewModel = PackItemsScanViewModel()
        viewModel.detections = [
            Self.detection(name: "Tent"),
            Self.detection(name: "Sleeping bag"),
        ]

        viewModel.selectAll()
        #expect(viewModel.selectedCount == 2)
        #expect(viewModel.canAdd)

        viewModel.selectNone()
        #expect(viewModel.selectedCount == 0)
        // Nothing selected means nothing to add — the toolbar button must not
        // offer an action that would no-op.
        #expect(viewModel.canAdd == false)
    }

    @Test("resolved selection returns only the ticked detections, in order")
    func resolvedSelectionFiltersAndKeepsOrder() {
        let viewModel = PackItemsScanViewModel()
        viewModel.detections = [
            Self.detection(name: "Tent"),
            Self.detection(name: "Stove"),
            Self.detection(name: "Filter"),
        ]
        viewModel.toggle(2)
        viewModel.toggle(0)

        let resolved = viewModel.resolvedSelection()

        #expect(resolved.map(\.detected.name) == ["Tent", "Filter"])
    }

    @Test("adding in flight blocks a second add")
    func addingBlocksReentry() {
        let viewModel = PackItemsScanViewModel()
        viewModel.detections = [Self.detection(name: "Tent")]
        viewModel.selectAll()
        #expect(viewModel.canAdd)

        viewModel.isAdding = true

        #expect(viewModel.canAdd == false)
    }

    // MARK: - Fixtures

    private static func detection(name: String) -> DetectedItemWithMatches {
        DetectedItemWithMatches(
            detected: DetectedItem(name: name, category: "shelter", confidence: 0.9),
            catalogMatches: []
        )
    }
}

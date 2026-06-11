import Foundation
import Observation

/// Drives the AI Packs generation screen.
///
/// Mirrors the React Query `useGeneratePacks` hook in
/// `apps/expo/features/ai-packs/hooks/useGeneratedPacks.ts` — a single mutation
/// (here modeled as `generate()`) that posts to `/api/packs/generate-packs`
/// and stores the returned packs so the UI can preview them.
@MainActor
@Observable
final class AIPacksViewModel {
    /// User-controlled count of packs to generate. The API clamps to positive ints;
    /// we mirror that here so the Stepper UX never sends 0.
    var count: Int = 3

    /// True while the network call is in flight.
    var isGenerating: Bool = false

    /// Last error string (from `LocalizedError` / `localizedDescription`).
    var error: String?

    /// Packs returned from the latest successful call. Drives the preview sheet.
    var generatedPacks: [Pack] = []

    /// Bounds the count field — keeps the UI sane and matches what's realistic
    /// for an LLM call without blowing past timeouts.
    static let minCount = 1
    static let maxCount = 10

    private let service: AIPacksService

    init(service: AIPacksService = .shared) {
        self.service = service
    }

    var canGenerate: Bool {
        !isGenerating && count >= Self.minCount && count <= Self.maxCount
    }

    /// Performs the generation request. Returns the new packs on success so the
    /// caller can decide whether to optimistically merge into a `PacksViewModel`.
    @discardableResult
    func generate() async -> [Pack] {
        guard canGenerate else { return [] }
        isGenerating = true
        error = nil
        defer { isGenerating = false }

        do {
            let packs = try await service.generatePacks(count: count)
            generatedPacks = packs
            return packs
        } catch {
            self.error = error.localizedDescription
            return []
        }
    }

    /// Clamp `count` to the supported range — used by Stepper/TextField bindings.
    func clampCount() {
        if count < Self.minCount { count = Self.minCount }
        if count > Self.maxCount { count = Self.maxCount }
    }

    /// Reset the generated-packs cache when the user dismisses the preview.
    func clearGenerated() {
        generatedPacks = []
    }
}

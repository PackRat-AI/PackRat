import Foundation
import Observation

@Observable
@MainActor
final class TrailConditionsViewModel {
    var reports: [TrailConditionReport] = []
    var isLoading = false
    var error: String?
    var searchText = ""

    private let service: TrailConditionsService

    init(service: TrailConditionsService = .shared) {
        self.service = service
    }

    var filteredReports: [TrailConditionReport] {
        guard !searchText.isEmpty else { return reports }
        return reports.filter {
            $0.trailName.localizedCaseInsensitiveContains(searchText)
            || ($0.trailRegion?.localizedCaseInsensitiveContains(searchText) ?? false)
            || ($0.notes?.localizedCaseInsensitiveContains(searchText) ?? false)
        }
    }

    func load() async {
        if VisualSampleData.isEnabled && !reports.isEmpty {
            isLoading = false
            error = nil
            return
        }
        if VisualSampleData.isScreenshotCapture {
            isLoading = false
            error = nil
            reports = []
            return
        }

        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            reports = try await service.listReports()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func submitReport(
        trailName: String,
        trailRegion: String?,
        surface: String?,
        overallCondition: String,
        hazards: [String],
        notes: String?
    ) async throws {
        let report: TrailConditionReport
        do {
            report = try await service.createReport(
                trailName: trailName,
                trailRegion: trailRegion,
                surface: surface,
                overallCondition: overallCondition,
                hazards: hazards,
                notes: notes
            )
        } catch {
            report = makeLocalReport(
                trailName: trailName,
                trailRegion: trailRegion,
                surface: surface,
                overallCondition: overallCondition,
                hazards: hazards,
                notes: notes
            )
        }
        searchText = ""
        reports.removeAll { $0.id == report.id }
        reports.insert(report, at: 0)
    }

    func deleteReport(_ id: String) async throws {
        if id.hasPrefix("local-") {
            reports.removeAll { $0.id == id }
            return
        }
        try await service.deleteReport(id)
        reports.removeAll { $0.id == id }
    }

    private func makeLocalReport(
        trailName: String,
        trailRegion: String?,
        surface: String?,
        overallCondition: String,
        hazards: [String],
        notes: String?
    ) -> TrailConditionReport {
        let now = Date.iso8601Now()
        return TrailConditionReport(
            id: "local-\(UUID().uuidString.lowercased())",
            trailName: trailName,
            trailRegion: trailRegion,
            surface: surface ?? "unknown",
            overallCondition: overallCondition,
            hazards: hazards,
            waterCrossings: 0,
            waterCrossingDifficulty: nil,
            notes: notes,
            photos: [],
            userId: nil,
            tripId: nil,
            deleted: false,
            createdAt: now,
            updatedAt: now
        )
    }
}

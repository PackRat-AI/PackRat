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
        let report = try await service.createReport(
            trailName: trailName,
            trailRegion: trailRegion,
            surface: surface,
            overallCondition: overallCondition,
            hazards: hazards,
            notes: notes
        )
        searchText = ""
        reports.removeAll { $0.id == report.id }
        reports.insert(report, at: 0)
    }

    func deleteReport(_ id: String) async throws {
        try await service.deleteReport(id)
        reports.removeAll { $0.id == id }
    }
}

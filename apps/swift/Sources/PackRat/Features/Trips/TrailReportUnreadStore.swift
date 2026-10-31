import Foundation
import Observation

/// Which of the user's upcoming and in-progress trips have a trail report they
/// haven't read, so the trip list can mark them. Reading a report, in the
/// trip's section or anywhere else, clears it.
@MainActor
@Observable
final class TrailReportUnreadStore {
    static let shared = TrailReportUnreadStore()
    static let flagKey = "enableTrailConditionNotifications"

    static var isEnabled: Bool {
        FeatureFlagStore.shared.isEnabled(flagKey) && NavItem.trailConditions.isFeatureEnabled
    }

    private(set) var tripIds: Set<String> = []
    private let service: TrailConditionsService

    init(service: TrailConditionsService = .shared) {
        self.service = service
    }

    func refresh() async {
        guard Self.isEnabled else {
            tripIds = []
            return
        }
        // A failed refresh keeps the markers already shown.
        guard let ids = try? await service.unreadTripIds() else { return }
        tripIds = Set(ids)
    }

    /// Records the reports as read; the trip they were read on loses its marker at once.
    func markRead(_ reportIds: [String], onTrip tripId: String? = nil) async {
        guard Self.isEnabled, !reportIds.isEmpty else { return }
        if let tripId { tripIds.remove(tripId) }
        try? await service.markRead(reportIds)
    }
}

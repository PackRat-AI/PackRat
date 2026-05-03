import Foundation
import Observation

@Observable
@MainActor
final class AppState {
    // Feature ViewModels — stable references that persist across nav changes
    let packsVM = PacksViewModel()
    let tripsVM = TripsViewModel()
    let weatherVM = WeatherViewModel()
    let catalogVM = CatalogViewModel()
    let chatVM = ChatViewModel()
    let feedVM = FeedViewModel()
    let templatesVM = PackTemplatesViewModel()
    let trailConditionsVM = TrailConditionsViewModel()

    // Per-feature detail selections
    var selectedPackId: String?
    var selectedTripId: String?
    var selectedTemplateId: String?
    var selectedReportId: String?

    // Active nav item
    var navItem: NavItem = .home
}

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
    let chatVM: ChatViewModel
    let feedVM = FeedViewModel()
    let templatesVM = PackTemplatesViewModel()
    let trailConditionsVM = TrailConditionsViewModel()
    let aiPacksVM = AIPacksViewModel()

    // Per-feature detail selections
    var selectedPackId: String?
    var selectedTripId: String?
    var selectedTemplateId: String?
    var selectedReportId: String?

    // Active nav item
    var navItem: NavItem = .home

    // App-wide presentation
    var isGlobalSearchPresented = false

    init() {
        // Back the assistant's pack tools with the local store, so it can find
        // packs by name and add items to them against the same data the Packs tab
        // shows. Without this every pack reads as missing, even ones on screen.
        chatVM = ChatViewModel(packTools: LocalChatPackTools(packsViewModel: packsVM))

        if VisualSampleData.isEnabled {
            VisualSampleData.apply(to: self)
        }
    }
}

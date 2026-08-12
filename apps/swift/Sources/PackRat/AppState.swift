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
        // The general assistant has no scoped pack, so give it a way to look up
        // whichever pack the model asks about. Without this it reports every
        // pack as missing, even ones the user can see in the Packs tab.
        let packs = packsVM
        chatVM = ChatViewModel(resolvePack: { [weak packs] packId in
            guard let pack = packs?.packs.first(where: { $0.id == packId }) else { return nil }
            return ["id": pack.id, "name": pack.name, "contents": pack.aiContextSummary]
        })

        if VisualSampleData.isEnabled {
            VisualSampleData.apply(to: self)
        }
    }
}

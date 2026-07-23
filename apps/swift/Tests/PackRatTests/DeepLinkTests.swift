import Foundation
import Testing
@testable import PackRat

@Suite("DeepLink.parse")
struct DeepLinkTests {
    @Test("routes packrat:// host=home and bare scheme to .home")
    func homeLink() {
        #expect(DeepLink.parse(URL(string: "packrat://")!) == .home)
        #expect(DeepLink.parse(URL(string: "packrat://home")!) == .home)
    }

    @Test("routes packrat://pack/<id> to .pack(id)")
    func packLink() {
        #expect(DeepLink.parse(URL(string: "packrat://pack/abc-123")!) == .pack(id: "abc-123"))
    }

    @Test("routes packrat://trip/<id> to .trip(id)")
    func tripLink() {
        #expect(DeepLink.parse(URL(string: "packrat://trip/42")!) == .trip(id: "42"))
    }

    @Test("routes packrat://feed and packrat://weather to their constants")
    func staticTabLinks() {
        #expect(DeepLink.parse(URL(string: "packrat://feed")!) == .feed)
        #expect(DeepLink.parse(URL(string: "packrat://weather")!) == .weather)
    }

    @Test("treats packrat://pack with no id as unknown")
    func packMissingIdIsUnknown() {
        let url = URL(string: "packrat://pack")!
        #expect(DeepLink.parse(url) == .unknown(url))
    }

    @Test("treats unknown hosts as .unknown")
    func unknownHost() {
        let url = URL(string: "packrat://something-new")!
        #expect(DeepLink.parse(url) == .unknown(url))
    }

    @Test("ignores non-packrat schemes (returns .unknown)")
    func wrongScheme() {
        let url = URL(string: "https://packrat.app/pack/abc")!
        #expect(DeepLink.parse(url) == .unknown(url))
    }

    @Test("ignores the legacy reverse-DNS OAuth-callback scheme")
    func oauthScheme() {
        // com.andrewbierman.packrat:// stays for Google Sign-In flows; DeepLink.parse
        // doesn't touch it — that's not its job.
        let url = URL(string: "com.andrewbierman.packrat://oauth-callback")!
        #expect(DeepLink.parse(url) == .unknown(url))
    }

    @MainActor
    @Test("applies parsed links to native navigation state")
    func appliesLinksToNavigationState() {
        let state = AppState()

        #expect(state.apply(.pack(id: "pack-1")))
        #expect(state.navItem == .packs)
        #expect(state.selectedPackId == "pack-1")

        #expect(state.apply(.trip(id: "trip-1")))
        #expect(state.navItem == .trips)
        #expect(state.selectedTripId == "trip-1")

        #expect(state.apply(.weather))
        #expect(state.navItem == .weather)

        let unknown = URL(string: "packrat://unknown")!
        #expect(!state.apply(.unknown(unknown)))
        #expect(state.navItem == .weather)
    }
}

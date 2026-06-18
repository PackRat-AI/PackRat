import XCTest

final class MacNavigationTests: MacUITestCase {
    func testEverySidebarDestinationIsReachable() {
        let destinations = [
            "Home",
            "Packs",
            "Trips",
            "Weather",
            "Assistant",
            "Catalog",
            "Templates",
            "Trail Conditions",
            "Feed",
            "Guides",
            "Gear Inventory",
            "Wildlife"
        ]

        for destination in destinations {
            goToSidebar(destination)
        }
    }
}

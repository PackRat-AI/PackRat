import CoreLocation
import Foundation
import Testing
@testable import PackRat

/// Covers #1810: the tile-pack count that decides whether an area is too
/// large to save, and the outline a named-region area covers.
@Suite("Offline maps")
struct OfflineMapsTests {

    private func box(south: Double, west: Double, north: Double, east: Double) -> [[CLLocationCoordinate2D]] {
        [OfflineAreaBounds(south: south, west: west, north: north, east: east).ring]
    }

    @Test func singleTileAtEachIndexZoom() {
        // A few hundred metres inside one tile at every index zoom.
        let rings = box(south: 37.74, west: -119.59, north: 37.745, east: -119.585)
        #expect(OfflineTilePacks.packs(for: rings, detail: .standard).count == 3)
        #expect(OfflineTilePacks.packs(for: rings, detail: .trail).count == 4)
    }

    @Test func boxCountsEveryTileItCovers() {
        // The north-west quarter of the world at zoom 2: tiles x 0...1, y 0...1.
        let tiles = OfflineTilePacks.tiles(
            covering: box(south: 0.5, west: -179.5, north: 84.5, east: -0.5), zoom: 2
        )
        #expect(tiles == Set((0...1).flatMap { x in (0...1).map { y in OfflineTilePacks.Tile(x: x, y: y) } }))
    }

    @Test func interiorTilesAreFilled() {
        // A box ten zoom-11 tiles across has its middle filled, not just its edges.
        let rings = box(south: 37.0, west: -120.0, north: 37.8, east: -118.2)
        let tiles = OfflineTilePacks.tiles(covering: rings, zoom: 11)
        let xs = tiles.map(\.x), ys = tiles.map(\.y)
        let width = (xs.max()! - xs.min()! + 1), height = (ys.max()! - ys.min()! + 1)
        #expect(tiles.count == width * height)
    }

    @Test func trianglesSkipTilesOutsideTheShape() {
        // A right triangle covers roughly half its bounding box.
        let triangle = [[
            CLLocationCoordinate2D(latitude: 37, longitude: -121),
            CLLocationCoordinate2D(latitude: 37, longitude: -118),
            CLLocationCoordinate2D(latitude: 39.4, longitude: -121),
        ]]
        let inBox = OfflineTilePacks.tiles(covering: box(south: 37, west: -121, north: 39.4, east: -118), zoom: 11).count
        let inTriangle = OfflineTilePacks.tiles(covering: triangle, zoom: 11).count
        #expect(inTriangle < inBox * 3 / 4)
        #expect(inTriangle > inBox / 3)
    }

    @Test func parkFitsAndStateDoesNotAtTrailDetail() {
        // Yosemite-sized frame fits comfortably; a Colorado-sized one at
        // Trail detail is far past the cap.
        let yosemite = box(south: 37.49, west: -119.89, north: 38.19, east: -119.2)
        let colorado = box(south: 37, west: -109.05, north: 41, east: -102.05)
        #expect(OfflineTilePacks.packs(for: yosemite, detail: .trail).count < OfflineTilePacks.limit / 2)
        #expect(OfflineTilePacks.packs(for: colorado, detail: .trail).count > OfflineTilePacks.limit)
    }

    @Test func budgetCountsSharedPacksOnce() {
        let rings = box(south: 37.74, west: -119.59, north: 37.745, east: -119.585)
        let saved = OfflineArea(
            id: "a", name: "A",
            bounds: OfflineAreaBounds(south: 37.74, west: -119.59, north: 37.745, east: -119.585),
            detail: .trail, savedAt: Date()
        )
        let budget = OfflineTilePacks.budget(adding: rings, detail: .standard, to: [saved])
        #expect(budget.used == 4)
        #expect(budget.added == 0)
    }

    @Test func namedRegionCoversItsOutline() {
        let outline = [[
            OfflinePoint(latitude: 1, longitude: 1),
            OfflinePoint(latitude: 1, longitude: 2),
            OfflinePoint(latitude: 2, longitude: 1),
        ]]
        var area = OfflineArea(
            id: "a", name: "A",
            bounds: OfflineAreaBounds(south: 1, west: 1, north: 2, east: 2),
            detail: .standard, savedAt: Date()
        )
        #expect(area.rings.first?.count == 5)
        area.boundary = outline
        #expect(area.rings.first?.count == 3)
        #expect(OfflineAreaBounds(enclosing: area.rings) == area.bounds)
    }
}

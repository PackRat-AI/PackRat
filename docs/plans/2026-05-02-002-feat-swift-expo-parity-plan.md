---
title: "feat: Swift app full Expo feature parity"
type: feat
status: active
date: 2026-05-02
---

# feat: Swift app full Expo feature parity

## Summary

The Swift app covers the core navigation surface (Packs, Trips, Templates, Weather, Catalog, Chat, Feed, Trail Conditions) but is missing a significant number of features that exist in the Expo app. This plan brings the Swift app to functional parity across eleven feature gaps, ordered from highest user value to lowest. It does not require exact UI parity — native SwiftUI idioms are preferred over pixel-matching Expo's React Native layout.

---

## Problem Frame

The Expo app has been the primary client and continues to accumulate features. The Swift app was scaffolded quickly and covers the skeleton well, but several meaningful user-facing features (home dashboard, pack item detail, generative AI UI, guides, gear inventory, season suggestions, wildlife identification, shopping list, weather alerts, template authoring, and improved trip maps) are absent. Users who switch to the native client lose access to these capabilities.

---

## Requirements

- R1. Home dashboard with customizable tile grid matching Expo's tile set (Current Pack, Season Suggestions, AI Chat, Pack Stats, Weight Analysis, Upcoming Trips, Weather, Gear Inventory, Shopping List, Templates, Guides, Feed, Wildlife)
- R2. Pack item tapping opens a read-only detail view showing weight, worn/consumable flags, notes, and similar-catalog items
- R3. Generative UI in AI Chat: tool invocations (weather, pack details, catalog items, web search) render as rich SwiftUI cards instead of raw text
- R4. Guides feature: browseable list with category filter + markdown detail view
- R5. Gear Inventory: all user items across all packs, grouped by category
- R6. Season Suggestions: location picker + AI-generated pack suggestions user can save as a new pack
- R7. Wildlife Identification: camera capture → API identification → species detail; history list
- R8. Pack Template Create/Edit: new template form, add/edit/remove template items
- R9. Shopping List: per-user wishlist of gear items (priority, notes, estimated cost)
- R10. Weather Alerts: display alerts from saved weather locations; preference to enable/disable
- R11. Trip location: MKLocalSearch in TripFormView replaces free-text geocoding; show trip route/map in TripDetailView
- R12. Profile completeness: notification preferences toggle, delete-account flow

---

## Scope Boundaries

- No pixel-for-pixel matching of Expo's React Native layout — use native SwiftUI conventions
- No P2P messaging (Conversations/Messages) — backend schema requires significant investigation; deferred
- No Admin/AI Packs screen — admin-only feature; deferred
- No AI-generated pack templates (separate admin flow)
- Shopping List is local-only (UserDefaults/SwiftData) in v1; server persistence is deferred

### Deferred to Follow-Up Work

- Messages / Conversations feature: separate PR after backend user-to-user messaging API is stable
- Admin AI Packs screen
- Server-synced Shopping List (currently local-only)
- Push notification delivery wiring (R12 covers preference toggle only)

---

## Context & Research

### Relevant Code and Patterns

- `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift` — NavItem enum + sidebar/tab layout; add new nav cases here
- `apps/swift/Sources/PackRat/Features/Packs/PackDetailView.swift` — pack item row tap target; add NavigationLink or sheet to PackItemDetailView
- `apps/swift/Sources/PackRat/Features/Chat/ChatView.swift` — chat message bubbles; tool invocations need a new rendering path
- `apps/swift/Sources/PackRat/Features/Chat/ChatViewModel.swift` — streaming parser; tool invocations arrive as typed JSON chunks (`type: "tool-result"` or similar)
- `apps/swift/Sources/PackRat/Features/PackTemplates/PackTemplatesView.swift` — template list and detail; template create/edit follows PackFormView pattern
- `apps/swift/Sources/PackRat/Features/Trips/TripFormView.swift` — location text field + CLGeocoder; replace with MKLocalSearch sheet
- `apps/swift/Sources/PackRat/Features/Weather/WeatherViewModel.swift` — saved locations in UserDefaults; alerts can use same location store
- `apps/swift/Sources/PackRat/Services/` — existing service files to mirror for new API calls
- `apps/expo/features/guides/` — API shape for guides (title, content markdown, category)
- `apps/expo/features/wildlife/` — API for wildlife identification (`POST /api/wildlife/identify`)
- `apps/expo/features/packs/screens/PackItemDetailScreen.tsx` — item detail feature depth: worn/consumable chips, notes, similar items
- `apps/expo/app/(app)/(tabs)/(home)/index.tsx` — full tile list and tile names
- `apps/expo/features/ai/components/` — generative UI component patterns (WeatherGenerativeUI, PackDetailsGenerativeUI, etc.)

### Institutional Learnings

- SourceKit false-positive errors are common in this repo; build success is the true signal
- New Swift files require `bun swift` (XcodeGen regenerate) to appear in the project
- `.tint` shorthand doesn't compile in all SwiftUI contexts; use `Color.accentColor` explicitly
- `safeAreaInset(edge: .top)` works well for sticky filter bars above a `List`
- `Color.secondary.opacity(0.12)` is the cross-platform approach for surface backgrounds
- `UserDefaults` + JSON encoding is the v1 persistence pattern for local-only data (established in WeatherViewModel)

### External References

- MapKit `MKLocalSearch` — standard API for place/POI search; no trail-specific Apple API exists publicly
- `VNRecognizeAnimalsRequest` (Vision framework) — animal recognition on-device; supplement with `/api/wildlife/identify` for species detail
- Vercel AI SDK v6 `toUIMessageStreamResponse()` type format: chunks include `type: "tool-call"`, `type: "tool-result"`, `type: "text-delta"`

---

## Key Technical Decisions

- **Home dashboard as a new NavItem (`.home`)**: Insert `.home` as the first nav item in the sidebar/tab; on iPhone it becomes the first tab. Uses a `ScrollView` of `LazyVGrid` tiles rather than a List. Tiles are reusable `View` structs. This matches the Expo tile grid concept with SwiftUI idioms.
- **Pack item detail as a sheet/push navigation**: On compact (iPhone), `NavigationLink` from the pack detail row. On wide layout, a sheet. Avoids rewriting the 3-column split layout.
- **Generative UI via typed chunk dispatch**: The chat stream already parses `UIStreamChunk`. Extend to handle `type: "tool-call"` and `type: "tool-result"` chunks by storing tool invocations separately on `ChatMessage`, then rendering them with a `ToolResultView` switch in `MessageBubble`.
- **Wildlife identification via VisionKit + server**: Use `VNImageRequestHandler` with `VNClassifyImageRequest` or the server `/api/wildlife/identify` (multipart POST). Server-side gives richer species detail; on-device gives offline capability. Prefer server with on-device fallback.
- **Guides as a new NavItem (`.guides`)**: Guides are content-only (no CRUD); fits as a sidebar item. Markdown rendering via the existing `MarkdownUI` library already imported in ChatView.
- **Shopping List as local-only SwiftData entity**: No server API confirmed. Store `ShoppingItem` in SwiftData (already imported as a dependency from the XcodeGen setup). Sync deferred.
- **Season Suggestions**: Reuse `WeatherViewModel.savedLocations` for location picker; call `POST /api/packs/season-suggestions` with location + current date; result is an array of suggested items the user can save as a new pack via `PackService.createPack`.
- **MKLocalSearch replaces CLGeocoder in TripFormView**: Present a search sheet using `MKLocalSearch.Request` driven by a TextField. Selected result fills lat/lon directly rather than geocoding on submit.

---

## Open Questions

### Resolved During Planning

- *Does `/api/packs/season-suggestions` exist?* — Confirmed in Expo feature code (`useSeasonSuggestions` hook calls this endpoint). Assume same path; verify at implementation time.
- *Does `/api/wildlife/identify` accept multipart image POST?* — Expo's `WildlifeIdentifyScreen` uses a camera capture + form data POST. Assume same shape.
- *Does the gap analysis 500 originate client-side or server-side?* — Server-side: `if (!aiProvider) return status(500, ...)`. The AI provider env vars are not set in the deployed Cloudflare Worker for this endpoint. **Fix: improve Swift-side error messaging to surface "AI not available on server" rather than generic error; backend fix is separate work.**

### Deferred to Implementation

- Exact shape of `type: "tool-call"` / `type: "tool-result"` chunks in the Vercel AI SDK v6 stream format — read actual server output during U3 implementation
- Whether `VNClassifyImageRequest` produces species-level accuracy sufficient to show results without server round-trip
- Exact guides API pagination shape (page/limit or cursor) — check during U5 implementation

---

## Implementation Units

- U1. **Home Dashboard Tab**

**Goal:** Add a `.home` NavItem as the first tab/sidebar entry with a scrollable grid of tiles that link to existing features.

**Requirements:** R1

**Dependencies:** None — tiles link to existing nav items and views

**Files:**
- Modify: `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift`
- Create: `apps/swift/Sources/PackRat/Features/Home/HomeView.swift`
- Create: `apps/swift/Sources/PackRat/Features/Home/HomeTiles.swift`

**Approach:**
- Add `.home` as first case in `NavItem` enum; give it `systemImage: "house"`, label "Home", `hasListDetail: false`
- `HomeView` is a `ScrollView` containing a `LazyVGrid` (2-column adaptive, min 160pt) of tile cards
- Each tile is a `NavigationLink` or button that sets `appState.navItem` to the target section and optionally pushes into its detail
- Tiles to include (mapped to nav targets): Current Pack (→ packs), Season Suggestions (→ separate sheet U6), AI Chat (→ chat), Pack Statistics (→ packs), Weight Analysis (→ packs), Upcoming Trips (→ trips filtered), Weather (→ weather), Gear Inventory (→ U4), Shopping List (→ U8), Pack Templates (→ templates), Guides (→ U5), Feed (→ feed), Wildlife (→ U7)
- Tile card visual: icon (`.largeTitle`), title, subtitle showing live count or last-updated (optional)
- On iPhone, inject `.home` as the first tab

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift` for NavItem extension pattern
- `apps/swift/Sources/PackRat/Features/Packs/PackWeightChart.swift` for `LazyVGrid` layout

**Test scenarios:**
- Happy path: Home tab appears first in sidebar and tab bar
- Happy path: Tapping "Packs" tile sets `navItem = .packs`
- Happy path: Tapping "Weather" tile switches to weather view
- Edge case: Tiles that require loaded data (e.g., Current Pack) show a loading placeholder when `packsVM.packs` is empty

**Verification:**
- Home tab appears first in both compact (tab) and regular (sidebar) layouts
- All tiles are visible and navigable; none crash on tap

---

- U2. **Pack Item Detail View**

**Goal:** Tapping a pack item row shows a detail view with full item metadata — weight, unit, worn/consumable flags, notes — plus a "Similar Items" section from the catalog API.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/Packs/PackItemDetailView.swift`
- Modify: `apps/swift/Sources/PackRat/Features/Packs/PackItemRow.swift`
- Modify: `apps/swift/Sources/PackRat/Services/CatalogService.swift`

**Approach:**
- `PackItemDetailView` receives a `PackItem`; shows: name (title), weight formatted with unit, worn badge, consumable badge, category chip, notes text, and a horizontal `ScrollView` of similar catalog items
- Similar items: call `CatalogService.searchSimilar(itemId: item.id, limit: 5)` using the existing catalog search endpoint; show compact `CatalogItemCard` rows
- On compact: `PackItemRow` uses `NavigationLink { PackItemDetailView(...) } label: { ... }`
- On wide: row tap sets a `@State var selectedItem: PackItem?` in `PackDetailView` and shows a sheet

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Catalog/CatalogItemDetailView.swift` for detail layout
- `apps/swift/Sources/PackRat/Features/Packs/GapAnalysisSheet.swift` for sheet sheet pattern

**Test scenarios:**
- Happy path: Tapping a pack item row shows name, weight, worn/consumable chips
- Happy path: Item with notes displays notes section
- Edge case: Item with no weight shows "—" not zero
- Edge case: No similar items found → section hidden
- Error path: Similar items API failure shows no section (silent fail, not crash)

**Verification:**
- Tapping any item row in PackDetailView opens the detail view
- All metadata fields render correctly for a test item with weight, notes, worn=true

---

- U3. **Generative UI in AI Chat**

**Goal:** Tool invocations in the chat stream render as rich SwiftUI card components instead of being silently dropped or shown as raw text.

**Requirements:** R3

**Dependencies:** None (extends existing ChatViewModel + ChatView)

**Files:**
- Modify: `apps/swift/Sources/PackRat/Features/Chat/ChatViewModel.swift`
- Modify: `apps/swift/Sources/PackRat/Features/Chat/ChatView.swift`
- Create: `apps/swift/Sources/PackRat/Features/Chat/ToolResultView.swift`

**Approach:**
- Extend `ChatMessage` to carry an optional `toolResults: [ToolResult]` array (alongside `content`)
- `ToolResult` is a struct with `toolName: String` and `resultJSON: Data` (raw JSON for the result payload)
- In `ChatViewModel`, add handling for `type: "tool-call"` and `type: "tool-result"` chunks: accumulate into the current message's `toolResults`
- In `MessageBubble`, after the text bubble, render a `ForEach(message.toolResults)` → `ToolResultView(result:)`
- `ToolResultView` switches on `toolName`:
  - `"getWeather"` / `"weather"` → `WeatherToolCard` showing location, temp, conditions
  - `"searchCatalog"` / `"catalogItems"` → horizontal `ScrollView` of compact item cards
  - `"getPackDetails"` → compact pack summary card
  - default → collapsible raw JSON view (chevron-revealed)
- Tool cards use `.background(.fill.tertiary, in: RoundedRectangle(...))` for visual separation

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Chat/ChatView.swift` MessageBubble for card styling
- `apps/expo/features/ai/components/WeatherGenerativeUI.tsx` for the tool card data shape
- `apps/swift/Sources/PackRat/Features/Weather/ForecastRow.swift` for weather display conventions

**Test scenarios:**
- Happy path: A message with `toolName = "getWeather"` shows a weather card with location + temp
- Happy path: A message with text + tool result shows both text bubble and tool card
- Happy path: Unknown tool name renders a collapsed "Tool result" disclosure group
- Edge case: Malformed tool result JSON → card shows "Unable to parse result" and does not crash
- Integration: Full stream from server with mixed `text-delta` + `tool-result` chunks renders correctly

**Verification:**
- Asking "What's the weather in Denver?" triggers the weather tool and renders a weather card below the AI response text
- No crash on any tool response shape

---

- U4. **Gear Inventory View**

**Goal:** A dedicated view showing all of the user's pack items across all packs, grouped by category with counts and total weight.

**Requirements:** R5

**Dependencies:** U1 (Gear Inventory tile on home links here)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/GearInventory/GearInventoryView.swift`
- Modify: `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift`

**Approach:**
- `GearInventoryView` reads `packsVM.packs` and flat-maps all items → group by `category`
- Shows `List` with section headers: category name + item count + total weight
- Each row: item name, weight, pack name (subtitle), worn/consumable icons
- Search via `.searchable` filtering item names
- No nav item needed if accessed from Home tile; add `.gearInventory` NavItem only if user feedback warrants it

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Packs/PackDetailView.swift` category grouping with `OrderedDictionary`
- `apps/swift/Sources/PackRat/Features/Packs/PackItemRow.swift` for row layout

**Test scenarios:**
- Happy path: User with 3 packs sees all items aggregated with correct category sections
- Happy path: Search for "tent" filters to only tent-named items
- Edge case: User with no packs sees EmptyStateView
- Edge case: Items with nil category bucket into "Uncategorized"

**Verification:**
- GearInventoryView shows all items from all packs correctly grouped
- Category totals match manual sum

---

- U5. **Guides Feature**

**Goal:** A Guides nav section showing a list of content guides with category filter and a markdown detail view.

**Requirements:** R4

**Dependencies:** U1 (Guides tile links here)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/Guides/GuidesView.swift`
- Create: `apps/swift/Sources/PackRat/Features/Guides/GuidesViewModel.swift`
- Create: `apps/swift/Sources/PackRat/Services/GuidesService.swift`
- Modify: `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift`

**Approach:**
- Add `.guides` to `NavItem`; label "Guides", symbol `"book"`
- `GuidesViewModel` fetches `GET /api/guides` (paginated) and `GET /api/guides/categories`
- `GuidesView` renders a `List` with category chips at top (following `PacksListView.categoryFilterBar` pattern) and guide cards
- Guide card: title, excerpt/description, category badge
- Tapping a guide pushes `GuideDetailView` which fetches `GET /api/guides/:id` and renders `Markdown(guide.content)` using the existing `MarkdownUI` import
- Pagination: load more on reaching last item (same `.task` pattern as `PacksListView`)

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Packs/PacksListView.swift` for category chips + list structure
- `apps/swift/Sources/PackRat/Features/Chat/ChatView.swift` for `Markdown()` rendering

**Test scenarios:**
- Happy path: Guide list loads and shows titles with category badges
- Happy path: Category chip filters list to that category
- Happy path: Tapping a guide shows markdown content
- Edge case: No guides for a category → EmptyStateView
- Error path: Network failure shows ErrorView with retry

**Verification:**
- Guides appear in sidebar; list loads; detail renders markdown correctly

---

- U6. **Season Suggestions**

**Goal:** AI-powered seasonal packing recommendations: user picks a location, gets a list of suggested items they can save as a new pack.

**Requirements:** R6

**Dependencies:** None (can be accessed from Home tile or pack toolbar)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/SeasonSuggestions/SeasonSuggestionsView.swift`
- Modify: `apps/swift/Sources/PackRat/Services/PackService.swift`

**Approach:**
- `SeasonSuggestionsView` is presented as a sheet
- Location picker: reuse `WeatherViewModel.savedLocations` chips + a text field for new location; alternatively inline MKLocalSearch (shares U11's approach)
- On "Get Suggestions", call `POST /api/packs/season-suggestions` with `{ location, date: today }`
- Response is an array of `{ name, category, weight?, quantity? }` suggestions
- Display as grouped list; "Save as New Pack" button calls `PackService.createPack(name: "\(location) Season Pack")` then adds each suggested item
- On success, navigate to the new pack

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Packs/GapAnalysisSheet.swift` for the form→result flow pattern
- `apps/swift/Sources/PackRat/Features/Weather/WeatherView.swift` for saved location chip carousel

**Test scenarios:**
- Happy path: Selecting a location and tapping "Get Suggestions" shows a list of items
- Happy path: "Save as New Pack" creates a pack and navigates to it
- Edge case: API returns empty list → EmptyStateView with "No suggestions for this season"
- Error path: Network failure → InlineErrorView

**Verification:**
- Can pick a location, get suggestions, and save them as a pack from the Swift app

---

- U7. **Wildlife Identification**

**Goal:** Camera capture → server-side species identification → species detail view with history list.

**Requirements:** R7

**Dependencies:** U1 (Wildlife tile on home links here)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/Wildlife/WildlifeView.swift`
- Create: `apps/swift/Sources/PackRat/Features/Wildlife/WildlifeViewModel.swift`
- Create: `apps/swift/Sources/PackRat/Services/WildlifeService.swift`
- Modify: `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift`

**Approach:**
- Add `.wildlife` to `NavItem`; label "Wildlife", symbol `"pawprint"`
- `WildlifeView` shows: camera capture button (`PhotosPicker` or `UIImagePickerController` via `.sheet`) + identification history list
- On image selection, call `WildlifeService.identify(imageData:)` → multipart `POST /api/wildlife/identify`
- Response: `{ results: [{ species: { commonName, scientificName }, confidence }] }`
- Store history in `UserDefaults` as `[WildlifeIdentification]` (same pattern as saved weather locations)
- History rows: species name, confidence %, date, thumbnail
- Tapping a history entry shows a detail sheet with scientific name, description (if API provides it)

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Services/UploadService.swift` for multipart POST
- `apps/swift/Sources/PackRat/Features/Weather/WeatherViewModel.swift` for UserDefaults persistence pattern

**Test scenarios:**
- Happy path: Selecting a photo of a bear shows "American Black Bear" with confidence score
- Happy path: History list shows previous identifications in reverse-chronological order
- Edge case: No species identified → "Unable to identify" state in history
- Error path: Network failure during identify → inline error, no history entry saved

**Verification:**
- Can pick or capture a photo, receive identification, and view history in Swift app

---

- U8. **Pack Template Create/Edit**

**Goal:** Users can create new templates and edit/delete their own template items; official templates remain read-only.

**Requirements:** R8

**Dependencies:** None (extends existing PackTemplatesView)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/PackTemplates/PackTemplateFormView.swift`
- Create: `apps/swift/Sources/PackRat/Features/PackTemplates/PackTemplateItemFormView.swift`
- Modify: `apps/swift/Sources/PackRat/Features/PackTemplates/PackTemplatesView.swift`
- Modify: `apps/swift/Sources/PackRat/Features/PackTemplates/PackTemplatesViewModel.swift`
- Modify: `apps/swift/Sources/PackRat/Services/PackTemplateService.swift`

**Approach:**
- Add "New Template" button to `PackTemplatesListView` toolbar (mirrors "New Pack" in PacksListView)
- `PackTemplateFormView`: name, description, category picker — same style as `PackFormView`
- After creating, navigate to the new template's detail where items can be added
- `PackTemplateItemFormView`: name, weight, weight unit, quantity, category, worn, consumable (mirrors `PackItemFormView`)
- In `PackTemplateDetailView`, show "Add Item" button in toolbar when template belongs to current user
- Template ownership: `template.userId == authManager.currentUser?.id`
- `PackTemplatesViewModel` adds `createTemplate`, `updateTemplate`, `addItem`, `updateItem`, `deleteItem` methods

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Packs/PackFormView.swift`
- `apps/swift/Sources/PackRat/Features/Packs/PackItemFormView.swift`

**Test scenarios:**
- Happy path: Create a new template, add two items, apply it to a pack
- Happy path: Edit an existing user-created template's name
- Edge case: Attempting to edit an official template shows no edit affordances
- Error path: Save fails → InlineErrorView with error message

**Verification:**
- New Template button appears in toolbar; form creates a template visible in the "Mine" section; items can be added to it

---

- U9. **Shopping List**

**Goal:** A local wishlist of gear items with priority, estimated cost, and notes.

**Requirements:** R9

**Dependencies:** U1 (Shopping List tile links here)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/ShoppingList/ShoppingListView.swift`
- Create: `apps/swift/Sources/PackRat/Models/ShoppingItem.swift` (SwiftData `@Model`)

**Approach:**
- `ShoppingItem` is a `@Model` class: `id: UUID`, `name: String`, `priority: String` (high/medium/low), `estimatedCost: String?`, `notes: String?`, `isPurchased: Bool`, `createdAt: Date`
- `ShoppingListView` uses `@Query` sorted by priority then createdAt
- Sections: "Needed" and "Purchased" (toggle shows/hides purchased items)
- Swipe-to-delete + swipe action to mark purchased
- "Add Item" button → inline form sheet (name, priority picker, cost, notes)
- No server sync in v1

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Packs/PackFormView.swift` for sheet form style
- SwiftData `@Query` + `@Model` (already a project dependency)

**Test scenarios:**
- Happy path: Add item with name + priority; appears in list sorted by priority
- Happy path: Mark item as purchased → moves to Purchased section
- Happy path: Delete item via swipe
- Edge case: Empty list shows EmptyStateView with "No items yet"

**Verification:**
- Items persist across app restarts (SwiftData); priority sort is correct

---

- U10. **Weather Alerts**

**Goal:** Display weather alerts for the user's saved weather locations; preference toggle to enable/disable.

**Requirements:** R10

**Dependencies:** None (WeatherViewModel already stores saved locations)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/Weather/WeatherAlertsView.swift`
- Modify: `apps/swift/Sources/PackRat/Features/Weather/WeatherViewModel.swift`
- Modify: `apps/swift/Sources/PackRat/Features/Weather/WeatherView.swift`

**Approach:**
- `WeatherViewModel` adds `fetchAlerts(for location: WeatherLocation) async throws -> [WeatherAlert]` calling `GET /api/weather/alerts?lat=&lon=`
- `WeatherAlertsView` shows a list of alerts grouped by location; alert row shows type, severity badge (Low/Moderate/High with color), date range, and summary
- Add "Alerts" button to `WeatherView` toolbar, badge count if alerts exist
- Severity color: `.red` for High, `.orange` for Moderate, `.yellow` for Low

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Weather/WeatherView.swift` for styling conventions
- `apps/swift/Sources/PackRat/Features/Packs/GapAnalysisSheet.swift` for sheet pattern

**Test scenarios:**
- Happy path: Location with active alert shows alert with severity badge
- Happy path: Location with no alerts shows "No alerts" state
- Error path: Network failure → retry button

**Verification:**
- Alerts badge appears on Weather view when alerts exist for a saved location

---

- U11. **Trip Location: MKLocalSearch + Enhanced Map**

**Goal:** Replace the text + CLGeocoder pattern in TripFormView with an MKLocalSearch sheet for precise place selection; show a richer map in TripDetailView.

**Requirements:** R11

**Dependencies:** None (replaces existing TripFormView location input)

**Files:**
- Create: `apps/swift/Sources/PackRat/Features/Trips/LocationSearchView.swift`
- Modify: `apps/swift/Sources/PackRat/Features/Trips/TripFormView.swift`
- Modify: `apps/swift/Sources/PackRat/Features/Trips/TripDetailView.swift`

**Approach:**
- `LocationSearchView`: a sheet with a `TextField` driving `MKLocalSearch.Request(naturalLanguageQuery:)`, results list showing name + subtitle, tap selects and dismisses
- `TripFormView`: "Search location" button replaces the plain TextField; tapping presents `LocationSearchView` as a sheet; selection fills `locationName`, `locationLat`, `locationLon`
- `TripDetailView`: if coordinates exist, show a `Map` with a `MapMarker(coordinate:)` and a button "Open in Maps" that calls `MKMapItem.openMaps(with:)`; include trail/POI annotations if MapKit provides them naturally

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Trips/TripFormView.swift` for existing location section structure
- MapKit `Map` view — already used in TripDetailView

**Test scenarios:**
- Happy path: Typing "Yosemite" in LocationSearchView shows matching MKMapItems
- Happy path: Selecting a result fills coordinates and name in TripFormView
- Happy path: TripDetailView shows map pin at selected coordinates
- Edge case: No results for query → "No locations found" row
- Error path: MKLocalSearch fails → inline error, falls back to manual text entry

**Verification:**
- Location search sheet appears; selecting a place fills form correctly; map appears in detail view with correct pin

---

- U12. **Profile Settings Completeness**

**Goal:** Add notification preference toggle and delete-account flow to the Profile view.

**Requirements:** R12

**Dependencies:** None

**Files:**
- Modify: `apps/swift/Sources/PackRat/Features/Profile/ProfileView.swift`

**Approach:**
- Add a "Notifications" `Toggle` row (stored in `UserDefaults`; wires into `UNUserNotificationCenter.requestAuthorization` on iOS; no-op on macOS)
- Add "Delete Account" `Button(role: .destructive)` at bottom; shows a confirmation `Alert` before calling `DELETE /api/auth/account`; on success calls `authManager.logout()`

**Patterns to follow:**
- `apps/swift/Sources/PackRat/Features/Auth/AuthGateView.swift` for logout pattern
- `apps/swift/Sources/PackRat/Features/Preferences/PreferencesView.swift` for `@AppStorage` toggle pattern

**Test scenarios:**
- Happy path: Toggling notifications on requests system permission (iOS)
- Happy path: Delete account shows confirmation alert; on confirm calls API and logs out
- Error path: Delete account API failure → alert with error message, stays logged in

**Verification:**
- Notification toggle persists; delete account flow requires confirmation and produces logout on success

---

## System-Wide Impact

- **NavItem enum**: Adding `.home`, `.guides`, `.wildlife` affects `NavItem.allCases` ordering — verify iPhone tab bar order is correct and doesn't overflow (consider grouping less-used items into a More/overflow tab if > 5 tabs)
- **AppNavigation content/phone switches**: All new NavItems need cases in `contentColumn`, `phoneContentView`, and `detailColumn`
- **XcodeGen**: Every new `.swift` file requires `bun swift` regeneration before it appears in the Xcode project build
- **bun swift**: Run after adding each implementation unit's new files
- **Error propagation**: Gap analysis 500 should surface a user-readable "AI not available" message, not a raw HTTP 500 description
- **Unchanged invariants**: The 3-column split layout, existing NavItem routing, pack/trip CRUD, and chat streaming are not modified by this plan except where explicitly noted

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `/api/packs/season-suggestions` endpoint shape unknown | Inspect Expo `useSeasonSuggestions` hook for exact request/response at implementation time |
| Vercel AI SDK v6 tool-call chunk format not yet verified | Log raw stream in DEBUG builds; parse defensively with unknown-tool fallback |
| Wildlife `/api/wildlife/identify` may not support multipart from Swift `URLSession` | Mirror `UploadService` multipart pattern; test with Expo's confirmed working shape |
| 5+ NavItems exceeds iPhone tab bar limit (5 max) | Group low-frequency items (Wildlife, Guides) behind a "More" overflow tab or access only from Home tiles |
| Shopping List local-only creates expectation of sync | UI clearly labels "Local list" in view title; defer server sync to follow-up |
| Gap analysis 500 error (AI not configured) | Improve Swift error message to "AI analysis unavailable" — backend fix is separate |

---

## Sources & References

- Expo screens: `apps/expo/app/(app)/(tabs)/(home)/index.tsx` (tile list)
- Expo item detail: `apps/expo/features/packs/screens/PackItemDetailScreen.tsx`
- Expo guides: `apps/expo/features/guides/`
- Expo wildlife: `apps/expo/features/wildlife/`
- Expo generative UI: `apps/expo/features/ai/components/`
- Gap analysis API: `packages/api/src/routes/packs/index.ts` line 441
- Swift navigation: `apps/swift/Sources/PackRat/Navigation/AppNavigation.swift`

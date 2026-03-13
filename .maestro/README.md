# PackRat Maestro E2E Tests

End-to-end tests for the PackRat mobile app using [Maestro](https://maestro.mobile.dev).

## Structure

```
.maestro/
├── config.yaml                                  # Suite config & flow execution order
└── flows/
    ├── setup/
    │   ├── clear-state.yaml                     # Clears app state before suite
    │   └── session-persistence-flow.yaml        # Force-kill & reopen login persistence
    ├── auth/
    │   ├── login-flow.yaml                      # Sign in with email/password
    │   └── logout-flow.yaml                     # Sign out from profile tab
    ├── dashboard/
    │   ├── dashboard-tiles-flow.yaml            # Verify all 13 dashboard tiles render
    │   └── pack-templates-flow.yaml             # Browse pack templates from dashboard
    ├── packs/
    │   ├── create-pack-flow.yaml                # Create a new pack
    │   ├── pack-detail-flow.yaml                # Verify pack detail view
    │   ├── pack-edit-share-flow.yaml            # Edit/share buttons (tests BUG-5 #1948)
    │   ├── pack-toggle-filter-flow.yaml         # My Packs/All Packs toggle & category filters
    │   ├── add-item-manual-flow.yaml            # Add item manually (tests BUG-1 #1943)
    │   ├── add-item-catalog-flow.yaml           # Add item from catalog detail (working path)
    │   └── add-item-in-pack-catalog-flow.yaml   # Add from in-pack catalog (tests BUG-7)
    ├── trips/
    │   ├── create-trip-flow.yaml                # Create trip (tests BUG-2 #1944)
    │   ├── trip-detail-flow.yaml                # Verify trip detail view
    │   └── trip-edit-flow.yaml                  # Edit existing trip
    ├── catalog/
    │   ├── catalog-browse-flow.yaml             # Browse catalog items
    │   ├── catalog-search-flow.yaml             # Search catalog (tests BUG-4 #1946)
    │   └── catalog-item-detail-flow.yaml        # Catalog item detail page
    ├── ai/
    │   ├── ai-chat-dashboard-flow.yaml          # Dashboard AI (tests BUG-3 #1945)
    │   └── ai-chat-pack-flow.yaml               # Pack-specific AI chat
    ├── guides/
    │   └── guides-browse-flow.yaml              # Browse guides content from dashboard
    ├── profile/
    │   └── profile-view-flow.yaml               # Profile tab verification
    └── negative/
        ├── invalid-login-flow.yaml              # Wrong credentials error handling
        └── empty-pack-submit-flow.yaml          # Empty form validation
```

## Prerequisites

1. **Install Maestro CLI** (v2.3+):
   ```bash
   curl -Ls "https://get.maestro.mobile.dev" | bash
   ```

2. **Connect device/emulator** with PackRat installed:
   ```bash
   adb devices  # Should show your device
   ```

3. **Set environment variables**:
   ```bash
   export TEST_EMAIL="your-test-account@example.com"
   export TEST_PASSWORD="your-test-password"
   ```

## Running Tests

### Full suite (sequential, ordered)
```bash
maestro test .maestro/config.yaml
```

### Single flow
```bash
maestro test .maestro/flows/catalog/catalog-browse-flow.yaml
```

### With JUnit output (for CI)
```bash
maestro test --format junit --output test-results.xml .maestro/config.yaml
```

## Test Coverage Map

| QA Report Bug | Test Flow | Expected Result |
|---------------|-----------|-----------------|
| BUG-1: Add Manually fails | `add-item-manual-flow.yaml` | FAIL until fixed |
| BUG-2: Trip pack picker empty | `create-trip-flow.yaml` | Documents bug |
| BUG-3: AI chat no back button | `ai-chat-dashboard-flow.yaml` | Documents bug |
| BUG-4: Search doesn't filter | `catalog-search-flow.yaml` | FAIL until fixed |
| BUG-5: Pack edit/share broken | `pack-edit-share-flow.yaml` | Documents bug |
| BUG-7: In-pack catalog add broken | `add-item-in-pack-catalog-flow.yaml` | Documents bug |

## Selector Strategy

Tests use text-based selectors as the codebase has minimal testID coverage (only 7 testIDs).
Priority for adding testIDs:

1. Form inputs (pack/trip/item creation)
2. Navigation elements (tab bar, back buttons)
3. AI chat components
4. Catalog search
5. Action buttons (edit, share, delete)

## App ID

Production build: `com.packratai.mobile`
Dev build: `com.andrewbierman.packrat.dev` (not tested)

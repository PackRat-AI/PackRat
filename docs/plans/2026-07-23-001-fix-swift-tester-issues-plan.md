---
title: Fix Swift tester issues 2640-2642
date: 2026-07-23
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Fix Swift tester issues 2640-2642

## Product Contract

### Requirements

- R1: Opening AI Assistant from Home must create native back navigation to Home.
- R2: Opening the primary Assistant tab must remain a root destination without synthetic history.
- R3: Gear Inventory sorting must use a balanced native menu that exposes and updates the selected order accessibly.
- R4: Weather current, feels-like, forecast-high, and forecast-low temperatures must honor the saved Celsius/Fahrenheit preference.
- R5: Weather formatting must prefer the API field matching the selected unit, convert the alternate field when necessary, and show a placeholder only when both are unavailable.

### Acceptance Evidence

- AE1: A focused UI test covers Home-origin Assistant back navigation and direct-tab history.
- AE2: A focused UI test covers the Gear sort menu options and selected accessibility value.
- AE3: Unit tests cover both preferred fields, both conversion fallbacks, and missing data.
- AE4: A focused UI test addresses all four Weather temperature surfaces independently.
- AE5: The PackRat iOS simulator target builds successfully.

## Key Technical Decisions

- KTD1: Home accepts an optional Assistant-opening callback; the compact iPhone Home stack supplies it, while all existing Home callers retain global navigation behavior.
- KTD2: The Home stack does not mirror its pushed `.chat` route into global tab selection, preventing the tab observer from erasing native back history.
- KTD3: Gear sorting uses an explicit `Menu` with a current-value label, selection indicator, and accessibility value.
- KTD4: A pure formatter centralizes preferred-field selection, fallback conversion, rounding, suffixes, and missing-value behavior.

## Implementation Units

### U1: Source-sensitive Assistant navigation

Implements R1-R2 and AE1 using `HomeView`, `AppNavigation`, and `MoreTabsTests`.

### U2: Explicit Gear sorting menu

Implements R3 and AE2 using `GearInventoryView` and `MoreTabsTests`.

### U3: Preference-aware Weather temperatures

Implements R4-R5 and AE3-AE4 using `ForecastRow`, `WeatherView`, `ViewModelTests`, and `WeatherTests`.

## Verification

- Generate the Xcode project from `apps/swift/project.yml`.
- Build `PackRat-iOS` for an available iOS simulator through XcodeBuildMCP.
- Run the five `WeatherTemperatureDisplayTests`.
- Run the three focused UI tests when PackRat E2E credentials are available; otherwise record an explicit credential-based skip rather than claiming execution.

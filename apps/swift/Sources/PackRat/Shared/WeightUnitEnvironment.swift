import SwiftUI

/// Propagates the user's preferred weight unit down the view tree.
///
/// The preference is stored in `UserDefaults` under
/// `AppWeightUnit.storageKey`, but reading it with `@AppStorage` in every view
/// that shows a weight means ~20 declarations that are easy to forget — and
/// forgetting one is exactly the bug this fixes (the picker in Preferences wrote
/// the value and nothing ever read it). Injecting it once at the app root gives
/// every descendant reactive access through `@Environment`.
/// Spelled as an explicit `EnvironmentKey` rather than with the `@Entry` macro,
/// which needs iOS 18 — this target deploys to iOS 17.
private struct WeightUnitKey: EnvironmentKey {
    static let defaultValue: AppWeightUnit = .grams
}

extension EnvironmentValues {
    var weightUnit: AppWeightUnit {
        get { self[WeightUnitKey.self] }
        set { self[WeightUnitKey.self] = newValue }
    }
}

/// Reads the stored weight-unit preference and publishes it into the
/// environment. `@AppStorage` is a `DynamicProperty`, so it invalidates this
/// view — and therefore everything below it — whenever the preference changes.
private struct WeightUnitPreferenceModifier: ViewModifier {
    @AppStorage(AppWeightUnit.storageKey) private var weightUnit: AppWeightUnit = .grams

    func body(content: Content) -> some View {
        content.environment(\.weightUnit, weightUnit)
    }
}

extension View {
    /// Applies the stored weight-unit preference to this view's subtree.
    /// Attach once, at the app root.
    func providesWeightUnitPreference() -> some View {
        modifier(WeightUnitPreferenceModifier())
    }
}

import Defaults
import Foundation

// MARK: - Feature flags
//
// Mirror of `apps/expo/config.ts`'s `featureFlags` object. New flags default
// to `false` per the project convention so a PR that introduces a flag does
// not accidentally enable in-flight work for users.
//
// Storage is `Defaults` (sindresorhus/Defaults) so the flag survives across
// launches, is observable from SwiftUI, and stays in sync between the iOS and
// macOS targets without a custom UserDefaults suite.

extension Defaults.Keys {
    /// When true, the OfflineAI feature uses `MLXLocalLLMProvider` (real
    /// on-device LLM via MLX). When false, it uses `MockLocalLLMProvider`
    /// (canned responses). Defaults to `false` until the MLX integration is
    /// product-greenlit and the model bundle/download path is settled.
    public static let useRealLocalLLM = Key<Bool>("featureFlag.useRealLocalLLM", default: false)
}

// MARK: - Provider factory

/// Resolves the active `LocalLLMProvider` based on the current
/// `useRealLocalLLM` flag value. View models call this rather than directly
/// instantiating a concrete provider so flipping the flag at runtime swaps
/// implementations on the next read.
public enum LocalLLMProviderFactory {
    public static func makeProvider() -> LocalLLMProvider {
        if AppFeatureFlags.enableLocalAI && Defaults[.useRealLocalLLM] {
            return MLXLocalLLMProvider()
        }
        return MockLocalLLMProvider()
    }
}

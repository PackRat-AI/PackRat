import Defaults
import Foundation
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Where an AI chat's replies come from.
enum ChatAIMode: String, Defaults.Serializable, CaseIterable, Identifiable {
    case cloud
    case onDevice

    var id: Self { self }

    var title: String {
        switch self {
        case .cloud: return "Cloud"
        case .onDevice: return "On-device"
        }
    }
}

extension Defaults.Keys {
    /// The mode the chat opens in. Remembered between launches.
    static let chatAIMode = Key<ChatAIMode>("chatAIMode", default: .cloud)
}

/// What on-device AI can do on this device, right now.
enum OnDeviceAIAvailability: Equatable {
    /// Apple Intelligence is on and its model is ready.
    case apple
    /// The device has Apple Intelligence, but it is off.
    case appleIntelligenceOff
    /// Apple Intelligence is on and still downloading its model.
    case appleModelPreparing
    /// No Apple Intelligence; Qwen runs here once downloaded.
    case qwen
    /// Neither model runs well enough to offer.
    case unsupported

    var isOffered: Bool { self != .unsupported }

    /// Resolved fresh on every call: Apple Intelligence can be switched on or
    /// off while the app is running.
    static var current: OnDeviceAIAvailability {
        #if DEBUG
        // `-forceQwen YES` tests Qwen on a device that has Apple Intelligence.
        if UserDefaults.standard.bool(forKey: "forceQwen") {
            return deviceCanRunQwen ? .qwen : .unsupported
        }
        #endif
        #if canImport(FoundationModels)
        if #available(iOS 26.0, macOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available:
                return .apple
            case .unavailable(.appleIntelligenceNotEnabled):
                return .appleIntelligenceOff
            case .unavailable(.modelNotReady):
                return .appleModelPreparing
            case .unavailable:
                break
            }
        }
        #endif
        return deviceCanRunQwen ? .qwen : .unsupported
    }

    /// Qwen3 keeps ~2.3 GB resident, so it needs a 6 GB device (iPhone 12 Pro
    /// and later Pro models, iPhone 15, M-series iPads and Macs). The simulator
    /// is excluded: MLX needs a real GPU.
    static var deviceCanRunQwen: Bool {
        #if targetEnvironment(simulator) || !arch(arm64)
        return false
        #else
        // A 6 GB device reports a little under 6 GB.
        return ProcessInfo.processInfo.physicalMemory >= 5_500_000_000
        #endif
    }

    /// The provider that answers on-device, or nil when nothing is ready yet.
    @MainActor
    func makeProvider() -> (any LocalLLMProvider)? {
        switch self {
        case .apple:
            #if canImport(FoundationModels)
            if #available(iOS 26.0, macOS 26.0, *) { return AppleLanguageModelProvider() }
            #endif
            return nil
        case .qwen:
            guard QwenModelStore.shared.isDownloaded else { return nil }
            return QwenProvider(directory: QwenModelStore.directory)
        case .appleIntelligenceOff, .appleModelPreparing, .unsupported:
            return nil
        }
    }
}

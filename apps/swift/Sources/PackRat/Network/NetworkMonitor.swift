import Network
import Observation
import Foundation

@Observable
@MainActor
final class NetworkMonitor {
    static let shared = NetworkMonitor()

    private(set) var isConnected: Bool = true
    private(set) var connectionType: NWInterface.InterfaceType? = nil

    private let monitor: NWPathMonitor
    private let queue = DispatchQueue(label: "world.packrat.netmonitor")
    private let forceOffline = ProcessInfo.processInfo.arguments.contains("--force-offline")

    private init() {
        if forceOffline {
            isConnected = false
            connectionType = nil
        }

        monitor = NWPathMonitor()
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor [weak self] in
                guard let self else { return }
                guard !self.forceOffline else {
                    self.isConnected = false
                    self.connectionType = nil
                    return
                }
                self.isConnected = path.status == .satisfied
                self.connectionType = [.wifi, .cellular, .wiredEthernet]
                    .first { path.usesInterfaceType($0) }
            }
        }
        monitor.start(queue: queue)
    }

    deinit {
        monitor.cancel()
    }

    var connectionLabel: String {
        guard isConnected else { return "Offline" }
        switch connectionType {
        case .wifi:          return "Wi-Fi"
        case .cellular:      return "Cellular"
        case .wiredEthernet: return "Ethernet"
        default:             return "Connected"
        }
    }
}

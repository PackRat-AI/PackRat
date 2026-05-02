import SwiftUI

struct OfflineBanner: View {
    @State private var monitor = NetworkMonitor.shared

    var body: some View {
        if !monitor.isConnected {
            HStack(spacing: 8) {
                Image(systemName: "wifi.slash")
                    .font(.callout)
                Text("You're offline — showing cached data")
                    .font(.callout)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(.orange.gradient)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

// Convenience modifier to attach the banner below the toolbar
extension View {
    func offlineBanner() -> some View {
        VStack(spacing: 0) {
            OfflineBanner()
            self
        }
        .animation(.easeInOut(duration: 0.3), value: NetworkMonitor.shared.isConnected)
    }
}

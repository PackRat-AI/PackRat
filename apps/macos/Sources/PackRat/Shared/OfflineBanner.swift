import SwiftUI

// Reads directly in body so @Observable tracking picks up isConnected changes
struct OfflineBanner: View {
    var body: some View {
        if !NetworkMonitor.shared.isConnected {
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

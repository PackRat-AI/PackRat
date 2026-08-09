import SwiftData
import SwiftUI

/// Drains the offline write queue whenever it can plausibly succeed: at launch,
/// when connectivity returns, and when the app comes back to the foreground.
private struct OutboxFlushModifier: ViewModifier {
    @Environment(\.modelContext) private var modelContext
    @Environment(\.scenePhase) private var scenePhase

    private var outbox: OutboxService { .shared }
    private var isConnected: Bool { NetworkMonitor.shared.isConnected }

    func body(content: Content) -> some View {
        content
            .task {
                outbox.refreshCounts(modelContext)
                await outbox.flush(context: modelContext)
            }
            // NetworkMonitor is @Observable, so this fires on every connectivity change.
            .onChange(of: isConnected) { _, connected in
                guard connected else { return }
                Task { await outbox.flush(context: modelContext) }
            }
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active else { return }
                Task { await outbox.flush(context: modelContext) }
            }
    }
}

extension View {
    /// Attach once, above the app's content, to keep queued offline writes moving.
    func flushesPendingWrites() -> some View {
        modifier(OutboxFlushModifier())
    }
}

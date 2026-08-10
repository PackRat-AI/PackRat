import SwiftData
import SwiftUI

/// Surfaces the outbox counters.
///
/// Offline writes succeed locally and replay in the background, so without this the
/// only signal that a write never reached the server was `OutboxService.failedCount`,
/// which nothing rendered. A write that the server rejected would disappear silently.
///
/// Reads the counters directly in `body` so `@Observable` tracking picks up changes.
struct PendingWritesBanner: View {
    @Environment(\.modelContext) private var modelContext

    private var outbox: OutboxService { .shared }

    var body: some View {
        let failed = outbox.failedCount
        let pending = outbox.pendingCount

        if failed > 0 {
            HStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.callout)
                Text(failed == 1
                    ? "1 change couldn't be saved to the server"
                    : "\(failed) changes couldn't be saved to the server")
                    .font(.callout)
                Spacer(minLength: 8)
                Button("Dismiss") {
                    outbox.discardFailed(context: modelContext)
                }
                .font(.callout.weight(.semibold))
                .buttonStyle(.plain)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(.red.gradient)
            .transition(.move(edge: .top).combined(with: .opacity))
        } else if pending > 0 {
            HStack(spacing: 8) {
                Image(systemName: "arrow.triangle.2.circlepath")
                    .font(.callout)
                Text(pending == 1
                    ? "1 change waiting to sync"
                    : "\(pending) changes waiting to sync")
                    .font(.callout)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(.gray.gradient)
            .transition(.move(edge: .top).combined(with: .opacity))
        }
    }
}

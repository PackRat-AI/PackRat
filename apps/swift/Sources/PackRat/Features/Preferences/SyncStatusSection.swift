import SwiftData
import SwiftUI

/// Settings → Sync: the authoritative account of whether this device's work has
/// reached the server.
///
/// This is where connectivity and outbox state live now that the navigation
/// banners are gone (#2723). Two conventions shape it:
///
/// - **Passive by default.** Apple's guidance is that status belongs in a passive
///   surface people consult when they care, and that an offline condition is
///   informative rather than actionable — cached data plus a non-intrusive
///   indicator, not an interruption. Mature sync apps agree: Things and Bear keep
///   the authoritative last-sync timestamp in a preferences pane.
/// - **Quiet when healthy.** Bear renders no sync affordance at all when
///   everything is synced; Linear only names a pending count when the queue is
///   actually backed up. So the rows here are conditional: online with an empty
///   queue collapses to a single "Up to date" line.
///
/// Failed writes are the exception that gets emphasis, because they are the one
/// case that is both actionable and data-losing: the change exists on this device
/// and will never reach the server unless the user retries or discards it.
struct SyncStatusSection: View {
    @Environment(\.modelContext) private var modelContext
    @State private var showingDiscardConfirmation = false

    private var outbox: OutboxService { .shared }
    private var monitor: NetworkMonitor { .shared }

    var body: some View {
        // Read through `body` so `@Observable` tracking picks up connectivity and
        // counter changes; both are singletons rather than injected state.
        let isConnected = monitor.isConnected
        let pending = outbox.pendingCount
        let failed = outbox.failedCount
        let isFlushing = outbox.isFlushing

        Section {
            statusRow(isConnected: isConnected, pending: pending, failed: failed, isFlushing: isFlushing)

            if let lastSyncedAt = outbox.lastSyncedAt {
                LabeledContent("Last Synced") {
                    Text(lastSyncedAt, format: .relative(presentation: .named))
                        .foregroundStyle(.secondary)
                }
                .accessibilityIdentifier("sync_last_synced")
            }

            if failed > 0 {
                Button("Discard Unsynced Changes", role: .destructive) {
                    showingDiscardConfirmation = true
                }
                .accessibilityIdentifier("sync_discard_button")
            }

            Button {
                Task { await outbox.flush(context: modelContext) }
            } label: {
                // Apple: a manual refresh must supplement automatic sync, never
                // replace it. The outbox already flushes on launch, on reconnect,
                // and on foreground — this only exists so a user staring at a
                // stuck queue has something to press.
                Text("Sync Now")
            }
            .disabled(!isConnected || isFlushing || (pending == 0 && failed == 0))
            .accessibilityIdentifier("sync_now_button")
        } header: {
            Text("Sync")
        } footer: {
            Text(footerText(isConnected: isConnected, pending: pending, failed: failed))
        }
        .alert("Discard unsynced changes?", isPresented: $showingDiscardConfirmation) {
            Button("Discard", role: .destructive) {
                outbox.discardFailed(context: modelContext)
            }
            Button("Keep", role: .cancel) {}
        } message: {
            Text(discardWarning(failed: outbox.failedCount))
        }
        .task {
            // The counters are only recomputed on enqueue and on flush, so a
            // Settings visit that follows neither would show a stale number.
            outbox.refreshCounts(modelContext)
        }
    }

    // MARK: - Status row

    /// One line naming the current state, in priority order: failures first
    /// (actionable and data-losing), then in-flight, then queued, then offline,
    /// then healthy.
    @ViewBuilder
    private func statusRow(isConnected: Bool, pending: Int, failed: Int, isFlushing: Bool) -> some View {
        if failed > 0 {
            statusLabel(
                changeCount(failed, singular: "change couldn't be synced", plural: "changes couldn't be synced"),
                symbol: "exclamationmark.triangle.fill",
                tint: .red
            )
        } else if isFlushing {
            LabeledContent {
                ProgressView().controlSize(.small)
            } label: {
                Label("Syncing changes", systemImage: "arrow.triangle.2.circlepath")
            }
            .accessibilityIdentifier("sync_status_row")
        } else if pending > 0 {
            statusLabel(
                changeCount(pending, singular: "change waiting to sync", plural: "changes waiting to sync"),
                symbol: "clock.arrow.circlepath",
                tint: .orange
            )
        } else if !isConnected {
            // Not "You're offline": non-technical readers misread the word, and
            // the useful fact is that nothing is stranded, not the radio state.
            statusLabel("No connection — nothing waiting to sync", symbol: "wifi.slash", tint: .secondary)
        } else {
            statusLabel("Up to date", symbol: "checkmark.circle.fill", tint: .green)
        }
    }

    private func statusLabel(_ text: String, symbol: String, tint: Color) -> some View {
        Label {
            Text(text)
        } icon: {
            Image(systemName: symbol).foregroundStyle(tint)
        }
        .accessibilityIdentifier("sync_status_row")
    }

    private func changeCount(_ count: Int, singular: String, plural: String) -> String {
        "\(count) \(count == 1 ? singular : plural)"
    }

    // MARK: - Footer

    /// The footer carries the explanation the status line is too short for —
    /// section footers exist for exactly the detail a header or row label cannot
    /// hold. Phrased around the outcome ("will be sent") rather than the network,
    /// because reassurance is what a user with queued work is looking for.
    private func footerText(isConnected: Bool, pending: Int, failed: Int) -> String {
        if failed > 0 {
            return """
            These changes were rejected by the server and won't be retried. They \
            still exist on this device. Discarding removes them for good, leaving \
            this device and your account out of sync.
            """
        }
        if pending > 0 {
            return isConnected
                ? "Your changes are being sent to your account now."
                : "Your changes are saved on this device and will be sent to your account when you reconnect."
        }
        return "Changes you make offline are saved on this device and sent to your account automatically when you reconnect."
    }

    private func discardWarning(failed: Int) -> String {
        let subject = failed == 1 ? "1 change" : "\(failed) changes"
        return """
        \(subject) never reached the server. Discarding removes \
        \(failed == 1 ? "it" : "them") for good — this device and your account will \
        stay out of sync.
        """
    }
}

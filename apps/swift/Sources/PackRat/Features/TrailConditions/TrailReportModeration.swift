import Foundation
import Observation
import SwiftUI

enum TrailReportFlagReason: String, CaseIterable, Identifiable, Codable, Sendable {
    case inaccurate
    case offensive
    case spam

    var id: String { rawValue }

    var label: String {
        switch self {
        case .inaccurate: "Wrong or Misleading"
        case .offensive: "Offensive"
        case .spam: "Spam"
        }
    }

    var systemImage: String {
        switch self {
        case .inaccurate: "exclamationmark.triangle"
        case .offensive: "hand.raised"
        case .spam: "xmark.bin"
        }
    }
}

/// Reports the hiker flagged and hikers they blocked this session. The server
/// stops sending both on the next load; this hides them everywhere without
/// waiting for a refetch. Sending and hiding are separate steps: hiding a
/// report pops any screen showing it, so the confirmation must come first.
@Observable
@MainActor
final class TrailReportModeration {
    static let shared = TrailReportModeration()

    private(set) var flaggedReportIds: Set<String> = []
    private(set) var blockedAuthorIds: Set<String> = []
    private(set) var deletedReportIds: Set<String> = []

    private let service: TrailConditionsService

    init(service: TrailConditionsService = .shared) {
        self.service = service
    }

    func hides(_ report: TrailConditionReport) -> Bool {
        flaggedReportIds.contains(report.id)
            || deletedReportIds.contains(report.id)
            || report.userId.map(blockedAuthorIds.contains) == true
    }

    func flag(_ report: TrailConditionReport, reason: TrailReportFlagReason) async throws {
        try await service.flagReport(report.id, reason: reason)
    }

    func block(authorOf report: TrailConditionReport) async throws {
        guard let userId = report.userId else { return }
        try await service.blockAuthor(userId: userId)
    }

    func hideFlagged(_ report: TrailConditionReport) {
        flaggedReportIds.insert(report.id)
    }

    func hideBlocked(authorOf report: TrailConditionReport) {
        if let userId = report.userId { blockedAuthorIds.insert(userId) }
    }

    func unhideBlocked(userId: String) {
        blockedAuthorIds.remove(userId)
    }

    func hideDeleted(_ report: TrailConditionReport) {
        deletedReportIds.insert(report.id)
    }
}

private struct TrailReportAlert: Identifiable {
    let id = UUID()
    let title: String
    let message: String
    /// Runs when the hiker taps OK.
    var onDismiss: (() -> Void)?
}

/// One screen's report actions: what the menus asked for, and the dialogs that
/// follow. Menus only record the request; the screen presents the dialogs,
/// because alerts attached to a toolbar or context menu never appear.
@Observable
@MainActor
final class TrailReportActions {
    struct Target: Identifiable {
        let report: TrailConditionReport
        let authorName: String?
        var id: String { report.id }
        var hikerName: String { authorName ?? "This Hiker" }
    }

    fileprivate var blockTarget: Target?
    fileprivate var deleteTarget: Target?
    fileprivate var alert: TrailReportAlert?

    @ObservationIgnored private let moderation = TrailReportModeration.shared

    func flag(_ target: Target, reason: TrailReportFlagReason, onHidden: (() -> Void)?) {
        Task {
            do {
                try await moderation.flag(target.report, reason: reason)
                alert = TrailReportAlert(
                    title: "Thanks for Letting Us Know",
                    message: "This report is hidden for you now, and the PackRat team will review it.",
                    onDismiss: { [moderation] in
                        onHidden?()
                        moderation.hideFlagged(target.report)
                    }
                )
            } catch {
                alert = TrailReportAlert(title: "Couldn't Flag Report", message: FeedErrorCopy.message(for: error, fallback: "Something went wrong on our end. Please try again."))
            }
        }
    }

    func askToBlock(_ target: Target) { blockTarget = target }
    func askToDelete(_ target: Target) { deleteTarget = target }

    fileprivate func block(_ target: Target, onHidden: (() -> Void)?) {
        Task {
            do {
                try await moderation.block(authorOf: target.report)
                alert = TrailReportAlert(
                    title: "\(target.hikerName) Is Blocked",
                    message: FeatureFlagStore.shared.isEnabled("enableFeed")
                        ? "You won't see their trail reports anymore. You can unblock them in Settings, under Feed & Sharing."
                        : "You won't see their trail reports anymore. You can unblock them in Settings, under Blocked People.",
                    onDismiss: { [moderation] in
                        onHidden?()
                        moderation.hideBlocked(authorOf: target.report)
                    }
                )
            } catch {
                alert = TrailReportAlert(title: "Couldn't Block \(target.hikerName)", message: FeedErrorCopy.message(for: error, fallback: "Something went wrong on our end. Please try again."))
            }
        }
    }

    fileprivate func delete(_ target: Target, using viewModel: TrailConditionsViewModel, onHidden: (() -> Void)?) {
        Task {
            do {
                try await viewModel.deleteReport(target.report.id)
                onHidden?()
                moderation.hideDeleted(target.report)
            } catch {
                alert = TrailReportAlert(title: "Couldn't Delete Report", message: FeedErrorCopy.message(for: error, fallback: "Something went wrong on our end. Please try again."))
            }
        }
    }
}

/// Delete for your own report; flag or block for anyone else's. Used as the
/// content of a long-press menu and the report screen's ••• menu.
struct TrailReportMenuItems: View {
    let report: TrailConditionReport
    let authorName: String?
    let actions: TrailReportActions
    var onHidden: (() -> Void)?

    @Environment(AuthManager.self) private var authManager

    private var target: TrailReportActions.Target { .init(report: report, authorName: authorName) }

    private var isMine: Bool {
        report.userId == authManager.currentUser?.id
    }

    var body: some View {
        if isMine {
            Button("Delete Report", systemImage: "trash", role: .destructive) { actions.askToDelete(target) }
                .accessibilityIdentifier("trail_report_delete")
        } else {
            Menu {
                ForEach(TrailReportFlagReason.allCases) { reason in
                    Button(reason.label, systemImage: reason.systemImage) {
                        actions.flag(target, reason: reason, onHidden: onHidden)
                    }
                    .accessibilityIdentifier("trail_report_flag_reason_\(reason.rawValue)")
                }
            } label: {
                Label("Flag Report", systemImage: "flag")
            }
            .accessibilityIdentifier("trail_report_flag")
            if report.userId != nil {
                Button("Block \(authorName ?? "Hiker")", systemImage: "hand.raised", role: .destructive) {
                    actions.askToBlock(target)
                }
                .accessibilityIdentifier("trail_report_block")
            }
        }
    }
}

private struct TrailReportActionDialogs: ViewModifier {
    @Bindable var actions: TrailReportActions
    var onHidden: (() -> Void)?

    @Environment(AppState.self) private var appState

    func body(content: Content) -> some View {
        content
            .confirmationDialog(
                "Block \(actions.blockTarget?.hikerName ?? "This Hiker")?",
                isPresented: Binding(get: { actions.blockTarget != nil }, set: { if !$0 { actions.blockTarget = nil } }),
                titleVisibility: .visible,
                presenting: actions.blockTarget
            ) { target in
                Button("Block", role: .destructive) { actions.block(target, onHidden: onHidden) }
                    .accessibilityIdentifier("trail_report_confirm_block")
            } message: { _ in
                Text("You won't see each other's trail reports, posts or comments.")
            }
            .confirmationDialog(
                "Delete this report?",
                isPresented: Binding(get: { actions.deleteTarget != nil }, set: { if !$0 { actions.deleteTarget = nil } }),
                titleVisibility: .visible,
                presenting: actions.deleteTarget
            ) { target in
                Button("Delete Report", role: .destructive) {
                    actions.delete(target, using: appState.trailConditionsVM, onHidden: onHidden)
                }
                .accessibilityIdentifier("trail_report_confirm_delete")
            } message: { _ in
                Text("Other hikers will no longer see it. This can't be undone.")
            }
            .alert(item: $actions.alert) { alert in
                Alert(title: Text(alert.title), message: Text(alert.message), dismissButton: .default(Text("OK")) {
                    alert.onDismiss?()
                })
            }
    }
}

extension View {
    /// Presents the dialogs `actions` asks for. `onHidden` runs when the report
    /// this screen shows is gone, so a report screen can close.
    func trailReportActionDialogs(_ actions: TrailReportActions, onHidden: (() -> Void)? = nil) -> some View {
        modifier(TrailReportActionDialogs(actions: actions, onHidden: onHidden))
    }
}

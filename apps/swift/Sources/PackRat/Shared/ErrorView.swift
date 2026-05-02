import SwiftUI

struct ErrorView: View {
    let message: String
    let retry: (() async -> Void)?

    init(_ message: String, retry: (() async -> Void)? = nil) {
        self.message = message
        self.retry = retry
    }

    var body: some View {
        ContentUnavailableView {
            Label("Something went wrong", systemImage: "exclamationmark.triangle")
        } description: {
            Text(message)
        } actions: {
            if let retry {
                AsyncButton("Try Again", action: retry)
                    .buttonStyle(.borderedProminent)
            }
        }
    }
}

struct InlineErrorView: View {
    let message: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.red)
            Text(message)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
    }
}

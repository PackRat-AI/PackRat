import Foundation

// ISO8601DateFormatter creation costs ~1ms each — reuse shared instances
// instead of allocating new ones in row/cell computed properties.
// These are only safe to use on the main thread (all callers are @MainActor
// or SwiftUI view bodies).
private let isoFull: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()

private let isoBasic: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()

extension String {
    /// Parse an ISO8601 timestamp, tolerating fractional-second variants.
    func toDate() -> Date? {
        isoFull.date(from: self) ?? isoBasic.date(from: self)
    }

    var timeAgo: String {
        guard let date = toDate() else { return "" }
        return date.formatted(.relative(presentation: .named))
    }
}

extension Date {
    static func iso8601Now() -> String { isoBasic.string(from: .now) }
    func iso8601String() -> String { isoBasic.string(from: self) }
}

import Foundation

// MARK: - User extensions (struct defined in Generated.swift)

extension User {
    var displayName: String {
        let parts = [firstName, lastName].compactMap { $0?.nilIfEmpty }
        return parts.isEmpty ? email : parts.joined(separator: " ")
    }

    /// Initials for the avatar fallback.
    ///
    /// Falls back to the email's first alphanumeric character when no name is
    /// set. Returning "" for a named-but-nameless account meant the avatar
    /// rendered an empty circle: callers write `initials ?? "?"`, and an empty
    /// string is not nil, so the `??` never fired. Every account has an email,
    /// so there is always one letter to show.
    var initials: String {
        let parts = [firstName, lastName].compactMap { $0?.first.map(String.init) }
        if !parts.isEmpty { return parts.prefix(2).joined().uppercased() }
        if let first = email.first(where: { $0.isLetter || $0.isNumber }) {
            return String(first).uppercased()
        }
        return ""
    }

    var isAdmin: Bool { role == "ADMIN" }
}

// MARK: - Request Bodies

struct UpdateProfileRequest: Encodable {
    let firstName: String?
    let lastName: String?
    let email: String?
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

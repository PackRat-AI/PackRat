import Foundation

// MARK: - User extensions (struct defined in Generated.swift)

extension User {
    var displayName: String {
        let parts = [firstName, lastName].compactMap { $0?.nilIfEmpty }
        return parts.isEmpty ? email : parts.joined(separator: " ")
    }

    var initials: String {
        let parts = [firstName, lastName].compactMap { $0?.first.map(String.init) }
        return parts.prefix(2).joined().uppercased()
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

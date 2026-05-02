import Foundation

struct User: Codable, Identifiable, Sendable {
    let id: String
    let email: String
    let firstName: String?
    let lastName: String?
    let avatarUrl: String?
    let role: String?
    let emailVerified: Bool?
    let createdAt: String?

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

struct UpdateProfileRequest: Encodable {
    let firstName: String?
    let lastName: String?
    let email: String?
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

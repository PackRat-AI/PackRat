import Foundation

// MARK: - Emergency contacts

/// Someone outside PackRat who is told when the user starts a trip and alerted
/// if they don't come back on time. Needs a mobile number, an email, or both.
struct EmergencyContact: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let name: String
    let phone: String?
    let email: String?
    let isDefault: Bool

    /// Contacts are reached by email. Phone numbers are stored for texts
    /// later but not used, so a contact without an email can't be notified.
    var canBeNotified: Bool { email?.isEmpty == false }

    var reachableAt: String { canBeNotified ? (email ?? "") : "No email address" }
}

struct CreateEmergencyContactRequest: Encodable, Sendable {
    let id: String
    let name: String
    let phone: String?
    let email: String?
    let isDefault: Bool
}

struct UpdateEmergencyContactRequest: Encodable, Sendable {
    let name: String
    let phone: String?
    let email: String?
    let isDefault: Bool

    enum CodingKeys: String, CodingKey { case name, phone, email, isDefault }

    /// Phone and email are sent even when nil, so clearing one saves.
    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(name, forKey: .name)
        try container.encode(phone, forKey: .phone)
        try container.encode(email, forKey: .email)
        try container.encode(isDefault, forKey: .isDefault)
    }
}

// MARK: - Check-in

/// Gear that helps someone recognise the user: "orange" + "Big Agnes tent".
struct IdentifyingGearItem: Codable, Hashable, Sendable, Identifiable {
    var id = UUID()
    var name: String
    var note: String?

    enum CodingKeys: String, CodingKey { case name, note }
}

struct StartSafetyCheckInRequest: Codable, Sendable {
    let id: String
    let contactIds: [String]
    let expectedReturnAt: String
    let graceMinutes: Int
    let identifyingGear: [IdentifyingGearItem]
    let trackingEnabled: Bool
    let startedAt: String
    let timeZone: String
}

struct ExtendSafetyCheckInRequest: Codable, Sendable {
    let expectedReturnAt: String
}

struct EndSafetyCheckInRequest: Codable, Sendable {
    let endedAt: String
}

enum SafetyLocationKind: String, Codable, Sendable {
    case checkIn = "check_in"
    case track
}

/// A position recorded on the phone: a manual check-in, or a background track
/// point. The id is made here so a batch re-sent after a dropped connection
/// isn't stored twice.
struct SafetyLocationInput: Codable, Hashable, Sendable {
    let id: String
    let kind: SafetyLocationKind
    let latitude: Double
    let longitude: Double
    let accuracyMeters: Double?
    let placeName: String?
    let note: String?
    let recordedAt: String
}

struct UploadSafetyLocationsRequest: Codable, Sendable {
    let locations: [SafetyLocationInput]
}

struct SafetyCheckInResponse: Codable, Sendable {
    struct Contact: Codable, Sendable {
        let contactId: String?
        let name: String
    }

    let id: String
    let tripId: String
    let status: String
    let shareUrl: String
    let expectedReturnAt: String
    let graceMinutes: Int
    let overdueAt: String
    let trackingEnabled: Bool
    let startedAt: String
    let overdueAlertSentAt: String?
    let contacts: [Contact]
}

struct ActiveSafetyCheckInResponse: Codable, Sendable {
    let checkIn: SafetyCheckInResponse?
}

// MARK: - Local state

/// A check-in as the phone knows it. Lives on the device so the countdown,
/// Check In and I'm Safe all work with no signal; the server copy catches up
/// through `SafetyCheckInStore`'s queue.
struct LocalSafetyCheckIn: Codable, Identifiable, Hashable, Sendable {
    let id: String
    let tripId: String
    var tripName: String
    var contactNames: [String]
    var expectedReturnAt: Date
    var graceMinutes: Int
    var trackingEnabled: Bool
    let startedAt: Date
    /// Set once the server has the check-in, i.e. the contacts have been told.
    var shareUrl: String?
    var lastCheckInAt: Date?
    var overdueAlertSent: Bool = false
    /// A start the server refused (e.g. every chosen contact was since removed).
    var startError: String?

    var overdueAt: Date { expectedReturnAt.addingTimeInterval(TimeInterval(graceMinutes * 60)) }
    var contactsNotified: Bool { shareUrl != nil }

    var contactSummary: String {
        switch contactNames.count {
        case 0: "your contacts"
        case 1: contactNames[0]
        case 2: "\(contactNames[0]) and \(contactNames[1])"
        default: "\(contactNames[0]) and \(contactNames.count - 1) others"
        }
    }
}

enum SafetyCheckInOutcome: String, Codable, Sendable {
    case safe
    case cancel
}

/// A write waiting for signal, replayed in order.
enum PendingSafetyOperation: Codable, Hashable, Sendable {
    case start(tripId: String, request: StartSafetyCheckInRequest)
    case extend(checkInId: String, expectedReturnAt: Date)
    case end(checkInId: String, outcome: SafetyCheckInOutcome, at: Date)
    case locations(checkInId: String, [SafetyLocationInput])

    var checkInId: String {
        switch self {
        case .start(_, let request): request.id
        case .extend(let id, _), .end(let id, _, _), .locations(let id, _): id
        }
    }
}

extension StartSafetyCheckInRequest: Hashable {
    static func == (lhs: Self, rhs: Self) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }
}

/// Grace periods offered when starting a check-in, in minutes.
enum SafetyGracePeriod {
    static let options = [60, 120, 180, 240, 360]
    static let defaultMinutes = 120

    static func label(_ minutes: Int) -> String {
        let hours = minutes / 60
        return hours == 1 ? "1 hour" : "\(hours) hours"
    }
}

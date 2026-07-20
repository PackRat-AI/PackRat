import Foundation

enum PackRatError: Error, LocalizedError {
    case networkError(Error)
    case httpError(statusCode: Int, message: String?)
    case decodingError(Error)
    case unauthorized
    case notFound
    case unknown

    var errorDescription: String? {
        switch self {
        case .networkError(let e):           return e.localizedDescription
        case .httpError(_, let msg):         return msg ?? "An error occurred"
        case .decodingError:                 return "Failed to parse server response"
        case .unauthorized:                  return "Your session has expired. Please sign in again."
        case .notFound:                      return "The requested resource was not found"
        case .unknown:                       return "An unknown error occurred"
        }
    }
}

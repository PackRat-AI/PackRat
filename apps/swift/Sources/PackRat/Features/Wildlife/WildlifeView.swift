import SwiftUI
import PhotosUI

// MARK: - Models

struct WildlifeIdentification: Identifiable {
    let id = UUID()
    let commonName: String
    let scientificName: String?
    let confidence: Double
    let description: String?
    let habitat: String?
    let safetyInfo: String?
    let imageData: Data?
}

// MARK: - Service

final class WildlifeService: Sendable {
    static let shared = WildlifeService()

    func identify(imageData: Data) async throws -> WildlifeIdentification {
        let url = APIClient.resolvedBaseURL.appendingPathComponent("/api/wildlife/identify")
        let boundary = UUID().uuidString
        var body = Data()
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"image\"; filename=\"wildlife.jpg\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
        body.append(imageData)
        body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        // Better Auth runs a CSRF Origin check on every POST — see APIClient
        // for the full rationale. This route uses multipart so it can't go
        // through the JSON-only APIClient.send path; set Origin manually.
        request.setValue("packrat://", forHTTPHeaderField: "Origin")
        if let token = KeychainService.shared.sessionToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = body

        let (data, _) = try await URLSession.shared.data(for: request)
        let decoded = try JSONDecoder().decode(WildlifeResponse.self, from: data)
        return decoded.toIdentification(imageData: imageData)
    }
}

private struct WildlifeResponse: Codable {
    let commonName: String?
    let scientificName: String?
    let confidence: Double?
    let description: String?
    let habitat: String?
    let safetyInfo: String?

    func toIdentification(imageData: Data) -> WildlifeIdentification {
        WildlifeIdentification(
            commonName: commonName ?? "Unknown",
            scientificName: scientificName,
            confidence: confidence ?? 0,
            description: description,
            habitat: habitat,
            safetyInfo: safetyInfo,
            imageData: imageData
        )
    }
}

// MARK: - ViewModel

@Observable
@MainActor
final class WildlifeViewModel {
    var identifications: [WildlifeIdentification] = []
    var isLoading = false
    var error: String?

    func identify(imageData: Data) async {
        isLoading = true
        error = nil
        defer { isLoading = false }
        do {
            let result = try await WildlifeService.shared.identify(imageData: imageData)
            identifications.insert(result, at: 0)
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - View

struct WildlifeView: View {
    @Environment(AuthManager.self) private var authManager
    @State private var viewModel = WildlifeViewModel()
    @State private var photoItem: PhotosPickerItem?

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                EmptyStateView(
                    "Sign In to Identify Wildlife",
                    subtitle: "Wildlife identification uses PackRat's image service. You can still manage local packs and trips as a guest.",
                    systemImage: "pawprint"
                )
            } else if viewModel.isLoading {
                ProgressView("Identifying…").frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.identifications.isEmpty {
                emptyState
            } else {
                resultsList
            }
        }
        .navigationTitle("Wildlife ID")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if authManager.isAuthenticated {
                    PhotosPicker(selection: $photoItem, matching: .images) {
                        Label("Choose Photo", systemImage: "photo.on.rectangle")
                    }
                }
            }
        }
        .onChange(of: photoItem) { _, item in
            guard authManager.isAuthenticated, let item else { return }
            Task {
                guard let data = try? await item.loadTransferable(type: Data.self) else { return }
                await viewModel.identify(imageData: data)
                photoItem = nil
            }
        }
        .alert("Error", isPresented: Binding(
            get: { viewModel.error != nil },
            set: { if !$0 { viewModel.error = nil } }
        )) {
            Button("OK") { viewModel.error = nil }
        } message: {
            Text(viewModel.error ?? "")
        }
    }

    private var emptyState: some View {
        ContentUnavailableView {
            Label("Identify Wildlife", systemImage: "pawprint")
                .symbolRenderingMode(.hierarchical)
        } description: {
            Text("Choose a photo of an animal or plant to identify it using AI.")
        } actions: {
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Choose Photo", systemImage: "photo.on.rectangle")
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var resultsList: some View {
        List {
            if let error = viewModel.error {
                Section {
                    InlineErrorView(message: error)
                }
            }
            ForEach(viewModel.identifications) { id in
                WildlifeResultRow(identification: id)
            }
        }
        .overlay(alignment: .bottom) {
            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Identify Another", systemImage: "plus.circle.fill")
                    .font(.headline)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 12)
                    .background(Color.accentColor, in: Capsule())
                    .foregroundStyle(.white)
            }
            .buttonStyle(.plain)
            .padding(.bottom, 20)
        }
    }
}

// MARK: - Result Row

private struct WildlifeResultRow: View {
    let identification: WildlifeIdentification
    @State private var expanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 12) {
                thumbnailView
                VStack(alignment: .leading, spacing: 4) {
                    Text(identification.commonName)
                        .font(.headline)
                    if let sci = identification.scientificName {
                        Text(sci)
                            .font(.caption)
                            .italic()
                            .foregroundStyle(.secondary)
                    }
                    ConfidenceBadge(confidence: identification.confidence)
                }
                Spacer()
                Button {
                    withAnimation { expanded.toggle() }
                } label: {
                    Image(systemName: expanded ? "chevron.up" : "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            if expanded {
                VStack(alignment: .leading, spacing: 8) {
                    if let desc = identification.description {
                        detailRow(label: "About", text: desc, symbol: "info.circle")
                    }
                    if let habitat = identification.habitat {
                        detailRow(label: "Habitat", text: habitat, symbol: "leaf")
                    }
                    if let safety = identification.safetyInfo {
                        detailRow(label: "Safety", text: safety, symbol: "exclamationmark.triangle")
                    }
                }
                .padding(.top, 4)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .padding(.vertical, 4)
    }

    @ViewBuilder
    private var thumbnailView: some View {
        if let data = identification.imageData {
            #if os(iOS)
            if let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 70, height: 70)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            #else
            if let ns = NSImage(data: data) {
                Image(nsImage: ns)
                    .resizable()
                    .scaledToFill()
                    .frame(width: 70, height: 70)
                    .clipShape(RoundedRectangle(cornerRadius: 10))
            }
            #endif
        }
    }

    private func detailRow(label: String, text: String, symbol: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Label(label, systemImage: symbol)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            Text(text)
                .font(.caption)
        }
    }
}

private struct ConfidenceBadge: View {
    let confidence: Double

    private var color: Color {
        if confidence >= 0.8 { return .green }
        if confidence >= 0.5 { return .orange }
        return .secondary
    }

    var body: some View {
        Text("\(Int(confidence * 100))% confident")
            .font(.caption2.bold())
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(color.opacity(0.12), in: Capsule())
            .foregroundStyle(color)
    }
}

import PhotosUI
import SwiftData
import SwiftUI

/// The offline identification screen.
///
/// Unlike the online-only `WildlifeView` it replaces, this one is not
/// auth-gated: identification runs on the device against a bundled pack, and
/// the history is the user's own data held where they are. There is nothing
/// here that needs an account, so requiring one would be asking for a sign-in
/// to use a phone's own camera.
struct OfflineWildlifeView: View {
    @Environment(\.modelContext) private var modelContext
    @State private var viewModel = OfflineWildlifeViewModel()
    @State private var photoItem: PhotosPickerItem?
    @State private var isShowingCamera = false
    @State private var isShowingHistory = false

    var body: some View {
        content
            .navigationTitle("Wildlife ID")
            .toolbar {
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        isShowingHistory = true
                    } label: {
                        Label("Sightings", systemImage: "clock.arrow.circlepath")
                    }
                }
            }
            .navigationDestination(isPresented: $isShowingHistory) {
                IdentificationHistoryView()
            }
            .task { viewModel.prepare() }
            .onChange(of: photoItem) { _, item in
                guard let item else { return }
                Task {
                    if let data = try? await item.loadTransferable(type: Data.self) {
                        await viewModel.identify(imageData: data)
                    }
                    photoItem = nil
                }
            }
            #if os(iOS)
            .fullScreenCover(isPresented: $isShowingCamera) {
                WildlifeCameraView(
                    onCapture: { data in
                        isShowingCamera = false
                        Task { await viewModel.identify(imageData: data) }
                    },
                    onCancel: { isShowingCamera = false }
                )
                .ignoresSafeArea()
            }
            #endif
            .alert("Error", isPresented: Binding(
                get: { viewModel.errorMessage != nil },
                set: { if !$0 { viewModel.errorMessage = nil } }
            )) {
                Button("OK") { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle:
            emptyState
        case .identifying:
            ProgressView("Identifying…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .results(let results):
            resultsList(results)
        case .noConfidentMatch:
            UnavailableStateView(
                title: "No confident match",
                subtitle: "Nothing in your loaded species packs is a close enough match to name. Try another angle, or get closer to the subject.",
                systemImage: "questionmark.circle"
            ) {
                captureButtons
            }
        case .outsideLoadedPacks:
            // A different and more useful message than "no match": it tells
            // the user there is something they can do about it.
            UnavailableStateView(
                title: "Not in your species packs",
                subtitle: "This looks like it is outside the region your downloaded packs cover. Download the pack for where you are to identify it.",
                systemImage: "arrow.down.circle"
            ) {
                captureButtons
            }
        case .modelUnavailable:
            UnavailableStateView(
                title: "Recogniser not installed",
                subtitle: "The on-device species recogniser has not been installed on this device yet. Identification is unavailable until it is.",
                systemImage: "cpu"
            )
        }
    }

    private var emptyState: some View {
        UnavailableStateView(
            title: "Identify wildlife",
            subtitle: "Point your camera at a plant or animal. Recognition happens on this device, so it works with no signal.\n\n\(viewModel.coverageSummary)",
            systemImage: "camera.viewfinder"
        ) {
            captureButtons
        }
    }

    @ViewBuilder
    private var captureButtons: some View {
        VStack(spacing: 8) {
            #if os(iOS)
            // The camera leads. The library is the secondary path.
            Button {
                isShowingCamera = true
            } label: {
                Label("Take Photo", systemImage: "camera.fill")
            }
            .buttonStyle(.borderedProminent)
            #endif

            PhotosPicker(selection: $photoItem, matching: .images) {
                Label("Choose Photo", systemImage: "photo.on.rectangle")
            }
        }
    }

    private func resultsList(_ results: [IdentificationResult]) -> some View {
        List {
            Section {
                ForEach(Array(results.enumerated()), id: \.element.id) { index, result in
                    NavigationLink {
                        SpeciesDetailView(result: result)
                    } label: {
                        IdentificationResultRow(result: result, isTopResult: index == 0)
                    }
                }
            } header: {
                HStack {
                    // A ranked list, not a verdict — named as such so the top
                    // row does not read as the only answer.
                    Text("Ranked matches")
                    if viewModel.isRefiningWithServer {
                        Spacer()
                        ProgressView().controlSize(.small)
                    }
                }
            } footer: {
                Text("Fine-grained identification is often ambiguous. Check the alternatives before acting on the top match — especially before eating anything.")
            }

            Section {
                Button {
                    viewModel.save(context: modelContext)
                    viewModel.reset()
                } label: {
                    Label("Save sighting", systemImage: "square.and.arrow.down")
                }
                Button {
                    viewModel.reset()
                } label: {
                    Label("Identify another", systemImage: "camera")
                }
            }
        }
    }
}

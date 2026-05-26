import SwiftUI

/// AI Packs admin screen — ports the Expo `AIPacksScreen` to SwiftUI.
///
/// Layout differs from the Expo version on two intentional axes:
///   - **Confirmation flow**: Expo uses a `material` Alert before submit. SwiftUI's
///     `.confirmationDialog` is the platform-idiomatic equivalent and keeps the
///     same "tap to confirm, with a clear count" UX.
///   - **Result presentation**: Expo presents a full-screen Modal with the generated
///     packs. We use a SwiftUI `.sheet` carrying a `NavigationStack` so a Done button
///     in the toolbar is the right affordance on iOS and macOS.
struct AIPacksView: View {
    @Bindable var viewModel: AIPacksViewModel
    var packsVM: PacksViewModel? = nil

    @Environment(AuthManager.self) private var authManager
    @State private var showingConfirm = false
    @State private var showingResults = false

    var body: some View {
        Group {
            if !authManager.isAuthenticated {
                GuestLimitedView(
                    "Sign In to Generate AI Packs",
                    subtitle: "AI pack generation runs on your PackRat account and is not available in guest mode.",
                    systemImage: "sparkles"
                )
            } else if authManager.currentUser?.isAdmin == true {
                adminContent
            } else {
                UnavailableStateView(
                    title: "Admin Only",
                    subtitle: "The AI Packs generator is restricted to admin accounts. Contact a workspace admin if you need access.",
                    systemImage: "lock.shield"
                )
            }
        }
        .navigationTitle("AI Packs")
        #if os(iOS)
        .navigationBarTitleDisplayMode(.large)
        #endif
        .confirmationDialog(
            "Generate \(viewModel.count) AI pack\(viewModel.count == 1 ? "" : "s")?",
            isPresented: $showingConfirm,
            titleVisibility: .visible
        ) {
            Button("Generate") { Task { await runGeneration() } }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("This calls the OpenAI-backed pack generator. Each pack consumes one API request and may take a few seconds.")
        }
        .sheet(isPresented: $showingResults) {
            GeneratedPacksSheet(viewModel: viewModel)
        }
    }

    // MARK: - Admin Content

    @ViewBuilder
    private var adminContent: some View {
        Form {
            generatorSection
            if let error = viewModel.error {
                Section { InlineErrorView(message: error) }
            }
            if !viewModel.generatedPacks.isEmpty {
                lastResultSection
            }
            tipsSection
        }
    }

    // MARK: - Sections

    private var generatorSection: some View {
        Section("Generate New Packs") {
            HStack {
                Text("Count")
                Spacer()
                Stepper(value: $viewModel.count, in: AIPacksViewModel.minCount...AIPacksViewModel.maxCount) {
                    Text("\(viewModel.count)")
                        .monospacedDigit()
                        .frame(minWidth: 30, alignment: .trailing)
                }
                .accessibilityIdentifier("ai_packs_count_stepper")
            }
            Text("Up to \(AIPacksViewModel.maxCount) packs per request. Each pack is generated independently with a unique theme.")
                .font(.caption)
                .foregroundStyle(.secondary)

            Button {
                showingConfirm = true
            } label: {
                if viewModel.isGenerating {
                    HStack(spacing: 8) {
                        ProgressView().controlSize(.small)
                        Text("Generating…")
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    Label("Generate \(viewModel.count) Pack\(viewModel.count == 1 ? "" : "s")", systemImage: "sparkles")
                        .frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!viewModel.canGenerate)
            .accessibilityIdentifier("ai_packs_generate_button")
            .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
        }
    }

    private var lastResultSection: some View {
        Section("Last Generation") {
            HStack {
                Image(systemName: "checkmark.seal.fill")
                    .foregroundStyle(.green)
                Text("\(viewModel.generatedPacks.count) pack\(viewModel.generatedPacks.count == 1 ? "" : "s") ready")
                Spacer()
                Button("View") { showingResults = true }
                    .buttonStyle(.bordered)
            }
        }
    }

    private var tipsSection: some View {
        Section {
            Label {
                Text("Generated packs are public by default and tagged as AI-generated. They go through the catalog vector search so each item maps to a real product.")
            } icon: {
                Image(systemName: "info.circle")
            }
            .font(.callout)
            .foregroundStyle(.secondary)
        }
    }

    // MARK: - Actions

    private func runGeneration() async {
        let packs = await viewModel.generate()
        if !packs.isEmpty {
            // Optimistically merge into the global packs list so the user can find
            // them under Packs without a manual refresh.
            if let packsVM {
                let existingIds = Set(packsVM.packs.map(\.id))
                let newPacks = packs.filter { !existingIds.contains($0.id) }
                packsVM.packs.insert(contentsOf: newPacks, at: 0)
            }
            showingResults = true
        }
    }
}

/// Sheet that previews the packs returned by the last successful generation.
///
/// Replaces the Expo full-screen `Modal` — `.sheet` on iOS gives a swipe-to-dismiss
/// gesture and a Done button without us hand-rolling the navigation chrome.
private struct GeneratedPacksSheet: View {
    @Bindable var viewModel: AIPacksViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.generatedPacks.isEmpty {
                    UnavailableStateView(
                        title: "No Generated Packs",
                        subtitle: "Generate some packs from the main screen first.",
                        systemImage: "sparkles"
                    )
                } else {
                    List(viewModel.generatedPacks) { pack in
                        GeneratedPackRow(pack: pack)
                    }
                }
            }
            .navigationTitle("Generated Packs")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        #if os(macOS)
        .frame(minWidth: 420, minHeight: 380)
        #endif
    }
}

/// Compact row preview for an AI-generated pack. Lighter than `PackCard` since
/// the API response often returns packs without their nested items array (items
/// are inserted server-side in the same transaction but not eagerly joined).
private struct GeneratedPackRow: View {
    let pack: Pack

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                if let category = pack.category {
                    Image(systemName: category.symbol)
                        .foregroundStyle(.tint)
                }
                Text(pack.name)
                    .font(.headline)
                Spacer()
                if pack.isAIGenerated == true {
                    Label("AI", systemImage: "sparkles")
                        .labelStyle(.iconOnly)
                        .foregroundStyle(.purple)
                        .accessibilityLabel("AI generated")
                }
            }
            if let description = pack.description, !description.isEmpty {
                Text(description)
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            if let tags = pack.tags, !tags.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(tags, id: \.self) { tag in
                            Text(tag)
                                .font(.caption2)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(.tint.opacity(0.12), in: Capsule())
                                .foregroundStyle(.tint)
                        }
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }
}

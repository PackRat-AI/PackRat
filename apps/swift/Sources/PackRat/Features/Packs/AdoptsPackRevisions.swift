import SwiftUI

/// Keeps a scene's `PacksViewModel` current with pack edits made in other
/// windows (#2667).
///
/// Reads `PackRevisionStore.shared.revision` inside the view body so SwiftUI's
/// observation tracking registers the dependency, then adopts on change. Every
/// scene that renders pack data from its own `PacksViewModel` needs this —
/// without it the scene keeps showing whatever it loaded at `.task` time.
private struct AdoptsPackRevisions: ViewModifier {
    let viewModel: PacksViewModel

    func body(content: Content) -> some View {
        content
            .onChange(of: PackRevisionStore.shared.revision, initial: true) { _, _ in
                viewModel.adoptExternalRevisions()
            }
    }
}

extension View {
    /// Adopts pack mutations published by other windows into `viewModel`.
    func adoptsPackRevisions(into viewModel: PacksViewModel) -> some View {
        modifier(AdoptsPackRevisions(viewModel: viewModel))
    }
}

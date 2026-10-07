import SwiftUI

/// The year in review as full-screen story cards (Spotify Wrapped, Strava
/// Year in Sport): segments across the top, tap the right of the screen for
/// the next card and the left for the one before, swipe works too. Nothing
/// advances on a timer, so a card stays up as long as someone is reading it
/// (WCAG 2.2.2). Each card is the same image the Share button sends.
struct YearInReviewView: View {
    let review: YearInReview
    let unit: TripDistanceUnit

    @Environment(\.dismiss) private var dismiss
    @State private var index = 0
    @State private var sharing: TripShareRequest?

    private var pages: [YearInReview.Page] { review.pages }
    private var page: YearInReview.Page { pages[min(index, pages.count - 1)] }

    var body: some View {
        GeometryReader { proxy in
            let format = TripShareFormat.story
            let height = format.height ?? 640
            let scale = min(proxy.size.width / format.width, (proxy.size.height - 120) / height)
            ZStack {
                Color.black.ignoresSafeArea()

                VStack(spacing: 14) {
                    segments
                    TripShareCardView(content: .review(review, page), format: format, unit: unit)
                        .id(page)
                        .transition(.opacity)
                        .scaleEffect(scale)
                        .frame(width: format.width * scale, height: height * scale)
                        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                        .overlay { tapZones }
                        .accessibilityElement(children: .combine)
                        .accessibilityHint("Swipe up or down for other cards")
                        .accessibilityAdjustableAction { direction in
                            switch direction {
                            case .increment: advance(1)
                            case .decrement: advance(-1)
                            @unknown default: break
                            }
                        }
                        .accessibilityIdentifier("year_in_review_card")
                    controls
                }
                .padding(.horizontal, 12)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .gesture(
                DragGesture(minimumDistance: 30).onEnded { value in
                    if value.translation.height > 120, abs(value.translation.width) < 80 {
                        dismiss()
                    } else if abs(value.translation.width) > abs(value.translation.height) {
                        advance(value.translation.width < 0 ? 1 : -1)
                    }
                }
            )
        }
        .preferredColorScheme(.dark)
        .focusable()
        .focusEffectDisabled()
        .onKeyPress(.rightArrow) { advance(1); return .handled }
        .onKeyPress(.leftArrow) { advance(-1); return .handled }
        .onKeyPress(.escape) { dismiss(); return .handled }
        .sheet(item: $sharing) { request in
            TripShareSheet(content: request.content, unit: unit)
        }
        .accessibilityIdentifier("year_in_review")
    }

    private var segments: some View {
        HStack(spacing: 4) {
            ForEach(pages.indices, id: \.self) { i in
                Capsule()
                    .fill(.white.opacity(i <= index ? 0.95 : 0.25))
                    .frame(height: 3)
            }
        }
        .padding(.horizontal, 4)
        .padding(.top, 8)
        .animation(.easeOut(duration: 0.2), value: index)
        .accessibilityElement()
        .accessibilityLabel("Card \(index + 1) of \(pages.count)")
    }

    /// The left third goes back, the rest goes forward, as in Instagram stories.
    private var tapZones: some View {
        GeometryReader { proxy in
            HStack(spacing: 0) {
                Color.clear
                    .contentShape(Rectangle())
                    .frame(width: proxy.size.width / 3)
                    .onTapGesture { advance(-1) }
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { advance(1) }
            }
        }
        .accessibilityHidden(true)
    }

    private var controls: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "xmark")
                    .font(.headline)
                    .frame(width: 44, height: 44)
                    .background(.white.opacity(0.14), in: Circle())
            }
            .accessibilityLabel("Close")
            .accessibilityIdentifier("year_in_review_close")

            Spacer()

            Button {
                sharing = TripShareRequest(content: .review(review, page))
            } label: {
                Label("Share", systemImage: "square.and.arrow.up")
                    .font(.headline)
                    .padding(.horizontal, 20)
                    .frame(height: 44)
                    .background(.white, in: Capsule())
                    .foregroundStyle(.black)
            }
            .accessibilityIdentifier("year_in_review_share")
        }
        .buttonStyle(.plain)
        .foregroundStyle(.white)
        .padding(.horizontal, 4)
    }

    private func advance(_ step: Int) {
        let next = index + step
        guard pages.indices.contains(next) else { return }
        withAnimation(.easeInOut(duration: 0.25)) { index = next }
    }
}

/// "Your 2026 in Review" at the top of Trip Stats, while the review is on offer.
struct YearInReviewBanner: View {
    let review: YearInReview
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                Image(systemName: "sparkles")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(ShareCardPalette.mint)
                    .frame(width: 48, height: 48)
                    .background(.white.opacity(0.1), in: Circle())
                VStack(alignment: .leading, spacing: 2) {
                    Text("Your \(String(review.year)) in Review")
                        .font(.headline)
                    Text("\(review.totals.trips) trip\(review.totals.trips == 1 ? "" : "s") · \(review.totals.nights) night\(review.totals.nights == 1 ? "" : "s") out. See the highlights and share them.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.75))
                        .multilineTextAlignment(.leading)
                }
                Spacer(minLength: 8)
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .foregroundStyle(.white)
            .padding(16)
            .background(
                LinearGradient(colors: [ShareCardPalette.top, ShareCardPalette.bottom], startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 14, style: .continuous)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("year_in_review_banner")
    }
}

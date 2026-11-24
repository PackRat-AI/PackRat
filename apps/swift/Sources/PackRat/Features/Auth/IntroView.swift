import SwiftUI

/// First-launch intro: a few full-screen pages, each in its own colour, that
/// explain what the app is for, then hand off to the welcome screen.
struct IntroView: View {
    static let hasSeenKey = "intro.hasSeen.v1"

    let onFinished: () -> Void

    @State private var index = 0
    /// Continuous page position while swiping. Held in an observable object
    /// that only the background reads, so a swipe redraws the colour alone
    /// rather than the whole pager every frame.
    @State private var scroll = IntroScrollProgress()
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let pages = IntroPage.all

    private var isLastPage: Bool { index == pages.count - 1 }

    var body: some View {
        ZStack {
            IntroBackground(scroll: scroll, pages: pages)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                HStack {
                    Spacer()
                    if !isLastPage {
                        Button("Skip", action: onFinished)
                            .font(.body.weight(.semibold))
                            .foregroundStyle(.white.opacity(0.85))
                            .padding(.horizontal, 20)
                            .padding(.vertical, 12)
                            .accessibilityIdentifier("intro_skip")
                    }
                }
                .frame(height: 48)

                pager

                footer
            }
        }
        .preferredColorScheme(.dark)
        .accessibilityIdentifier("intro_screen")
    }

    @ViewBuilder
    private var pager: some View {
        #if os(iOS)
        TabView(selection: $index) {
            ForEach(Array(pages.enumerated()), id: \.offset) { offset, page in
                IntroPageView(page: page)
                    .background(pageOffsetReader(for: offset))
                    .tag(offset)
                    .accessibilityIdentifier("intro_page_\(offset)")
            }
        }
        // No onChange(of: index) here: the pager flips `index` at the halfway
        // point of a swipe, and the page geometry already drives the colour for
        // both swipes and the Next button's animated slide.
        .tabViewStyle(.page(indexDisplayMode: .never))
        #else
        IntroPageView(page: pages[index])
            .id(index)
            .transition(.opacity)
            .accessibilityIdentifier("intro_page_\(index)")
            .onChange(of: index) { _, newIndex in
                withAnimation(reduceMotion ? nil : .easeInOut(duration: 0.35)) {
                    scroll.value = CGFloat(newIndex)
                }
            }
        #endif
    }

    #if os(iOS)
    /// Reports where a page sits horizontally. The page currently under the
    /// finger sets the scroll progress, so the colour tracks the swipe frame by frame.
    private func pageOffsetReader(for offset: Int) -> some View {
        GeometryReader { proxy in
            let frame = proxy.frame(in: .global)
            Color.clear
                .onChange(of: frame.minX) { _, minX in
                    guard frame.width > 0, abs(minX) < frame.width else { return }
                    let value = CGFloat(offset) - minX / frame.width
                    if abs(scroll.value - value) > 0.001 { scroll.value = value }
                }
        }
    }
    #endif

    private var footer: some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(.white.opacity(0.18))
                .frame(height: 1)

            HStack {
                pageDots
                Spacer()
                nextButton
            }
            .padding(.horizontal, 24)
            .frame(height: 76)
        }
    }

    private var pageDots: some View {
        HStack(spacing: 8) {
            ForEach(pages.indices, id: \.self) { offset in
                Circle()
                    .fill(.white.opacity(offset == index ? 0.95 : 0.35))
                    .frame(width: 8, height: 8)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Page \(index + 1) of \(pages.count)")
        .accessibilityIdentifier("intro_page_indicator")
    }

    @ViewBuilder
    private var nextButton: some View {
        if isLastPage {
            Button(action: onFinished) {
                Text("Get Started")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(IntroPage.blendedBackground(at: CGFloat(pages.count - 1), in: pages))
                    .padding(.horizontal, 22)
                    .frame(height: 44)
                    .background(.white, in: Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("intro_get_started")
        } else {
            Button(action: advance) {
                Image(systemName: "chevron.right")
                    .font(.title2.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Next")
            .accessibilityIdentifier("intro_next")
        }
    }

    private func advance() {
        guard !isLastPage else { return }
        if reduceMotion {
            index += 1
        } else {
            withAnimation(.easeInOut(duration: 0.35)) { index += 1 }
        }
    }
}

@Observable
private final class IntroScrollProgress {
    /// 1.5 means halfway from page 1 to page 2.
    var value: CGFloat = 0
}

private struct IntroBackground: View {
    let scroll: IntroScrollProgress
    let pages: [IntroPage]

    var body: some View {
        IntroPage.blendedBackground(at: scroll.value, in: pages)
    }
}

private struct IntroPageView: View {
    let page: IntroPage

    @ViewBuilder
    private var artwork: some View {
        switch page.artwork {
        case .symbol(let name):
            Image(systemName: name)
                .font(.system(size: 120, weight: .regular))
                .symbolRenderingMode(.hierarchical)
        case .logo:
            Image("LogoMark")
                .renderingMode(.template)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 180, height: 180)
        }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 28) {
                artwork
                    .foregroundStyle(.white.opacity(0.82))
                    .frame(height: 170)
                    .accessibilityHidden(true)

                Text(page.title)
                    .font(.title.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .accessibilityAddTraits(.isHeader)

                VStack(spacing: 18) {
                    Text(page.lead)
                    Text(page.detail)
                }
                .font(.body)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white.opacity(0.92))

                Text(page.tagline)
                    .font(.callout.italic())
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 36)
            .padding(.vertical, 40)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }
}

struct IntroPage: Identifiable {
    enum Artwork {
        case logo
        case symbol(String)
    }

    let id: Int
    let artwork: Artwork
    let title: String
    let lead: String
    let detail: String
    let tagline: String
    let rgb: RGB

    /// One outdoor colour per page, each dark enough for white text. Kept as
    /// RGB so neighbouring pages can be blended during a swipe.
    struct RGB {
        let red: Double
        let green: Double
        let blue: Double

        var color: Color { Color(red: red, green: green, blue: blue) }

        func mixed(with other: RGB, by amount: Double) -> RGB {
            RGB(
                red: red + (other.red - red) * amount,
                green: green + (other.green - green) * amount,
                blue: blue + (other.blue - blue) * amount
            )
        }
    }

    private enum Palette {
        static let forest = RGB(red: 0.20, green: 0.50, blue: 0.39)
        static let ember = RGB(red: 0.80, green: 0.40, blue: 0.13)
        static let sky = RGB(red: 0.05, green: 0.42, blue: 0.80)
        static let lake = RGB(red: 0.05, green: 0.46, blue: 0.53)
        static let dusk = RGB(red: 0.33, green: 0.25, blue: 0.55)
    }

    var background: Color { rgb.color }

    /// The background at a fractional page position, blending the two pages
    /// either side of it.
    static func blendedBackground(at progress: CGFloat, in pages: [IntroPage]) -> Color {
        guard !pages.isEmpty else { return .clear }
        let clamped = min(max(Double(progress), 0), Double(pages.count - 1))
        let lower = Int(clamped.rounded(.down))
        let upper = min(lower + 1, pages.count - 1)
        let from = pages[lower].rgb
        let to = pages[upper].rgb
        return from.mixed(with: to, by: clamped - Double(lower)).color
    }

    static let all: [IntroPage] = [
        IntroPage(
            id: 0,
            artwork: .logo,
            title: "Welcome to PackRat",
            lead: "Plan trips, build packing lists and head outdoors ready for what's ahead.",
            detail: "Everything for the trip lives in one place.",
            tagline: "Plan better. Pack smarter.",
            rgb: Palette.forest
        ),
        IntroPage(
            id: 1,
            artwork: .symbol("checklist"),
            title: "Pack with purpose",
            lead: "Build lists from a catalog of real gear, with weights filled in.",
            detail: "See your total and base weight before you lift the pack.",
            tagline: "Every gram counts.",
            rgb: Palette.ember
        ),
        IntroPage(
            id: 2,
            artwork: .symbol("map.fill"),
            title: "Plan every trip",
            lead: "Put a trip on the calendar, choose where you're going and attach a pack.",
            detail: "Your dates, your destination and your gear stay together.",
            tagline: "Know before you go.",
            rgb: Palette.sky
        ),
        IntroPage(
            id: 3,
            artwork: .symbol("cloud.sun.fill"),
            title: "Check the conditions",
            lead: "See the forecast for where you're headed, not just where you are.",
            detail: "Read guides for the trail and the activity before you set out.",
            tagline: "No surprises at the trailhead.",
            rgb: Palette.lake
        ),
        IntroPage(
            id: 4,
            artwork: .symbol("mountain.2.fill"),
            title: "Ready anywhere",
            lead: "Your packs and trips stay on your device.",
            detail: "Open them at the trailhead, with or without signal.",
            tagline: "See you out there.",
            rgb: Palette.dusk
        ),
    ]
}

#Preview {
    IntroView(onFinished: {})
}

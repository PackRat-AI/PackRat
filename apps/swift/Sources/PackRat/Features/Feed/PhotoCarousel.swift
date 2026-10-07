import SwiftUI

/// The photos on a post: swipe between them, tap to open full screen,
/// double-tap to like.
struct PhotoCarousel: View {
    let images: [String]
    @Binding var selection: Int
    var aspectRatio: CGFloat = 4.0 / 5.0
    let onTap: (Int) -> Void
    var onDoubleTap: (() -> Void)?

    @State private var scrolledID: Int?

    var body: some View {
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(images.indices, id: \.self) { index in
                    RemoteImage(url: images[index], contentMode: .fill) {
                        Rectangle().fill(.fill.secondary)
                    }
                    .containerRelativeFrame([.horizontal, .vertical])
                    .clipped()
                    .contentShape(Rectangle())
                    .onTapGesture(count: 2) { onDoubleTap?() }
                    .onTapGesture { onTap(index) }
                    .accessibilityLabel("Photo \(index + 1) of \(images.count)")
                    .accessibilityAddTraits(.isButton)
                    .accessibilityIdentifier("feed_photo_\(index)")
                    .id(index)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollIndicators(.hidden)
        .scrollPosition(id: $scrolledID)
        .scrollDisabled(images.count < 2)
        .aspectRatio(aspectRatio, contentMode: .fit)
        .overlay(alignment: .topTrailing) {
            if images.count > 1 {
                Text("\(selection + 1)/\(images.count)")
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.horizontal, 9)
                    .padding(.vertical, 4)
                    .background(.black.opacity(0.55), in: Capsule())
                    .padding(10)
                    .accessibilityHidden(true)
            }
        }
        .overlay(alignment: .bottom) {
            if images.count > 1 {
                PageDots(count: images.count, selection: selection)
                    .padding(.bottom, 10)
            }
        }
        .onChange(of: scrolledID) { _, id in
            if let id { selection = id }
        }
        .onAppear { scrolledID = selection }
    }
}

struct PageDots: View {
    let count: Int
    let selection: Int

    var body: some View {
        HStack(spacing: 6) {
            ForEach(0..<count, id: \.self) { index in
                Circle()
                    .fill(.white.opacity(index == selection ? 1 : 0.5))
                    .frame(width: index == selection ? 7 : 6, height: index == selection ? 7 : 6)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 5)
        .background(.black.opacity(0.25), in: Capsule())
        .animation(.easeInOut(duration: 0.2), value: selection)
        .accessibilityElement()
        .accessibilityLabel("Photo \(selection + 1) of \(count)")
        .accessibilityIdentifier("feed_photo_page_dots")
    }
}

/// Opens a post's photos full screen at `index`.
struct PhotoViewerStart: Identifiable {
    let index: Int
    var id: Int { index }
}

/// Full-screen photo viewer with paging and pinch to zoom.
struct PhotoViewer: View {
    let images: [String]
    @State var selection: Int
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            pages
        }
        .overlay(alignment: .topLeading) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
                    .frame(width: 36, height: 36)
                    .background(.white.opacity(0.18), in: Circle())
            }
            .buttonStyle(.plain)
            .padding()
            .accessibilityLabel("Close")
            .accessibilityIdentifier("feed_photo_viewer_close")
            .keyboardShortcut(.escape, modifiers: [])
        }
        .overlay(alignment: .top) {
            if images.count > 1 {
                Text("\(selection + 1) of \(images.count)")
                    .font(.subheadline.weight(.semibold).monospacedDigit())
                    .foregroundStyle(.white)
                    .padding(.top, 22)
            }
        }
        #if os(iOS)
        .statusBarHidden()
        #endif
        .accessibilityIdentifier("feed_photo_viewer")
    }

    @ViewBuilder
    private var pages: some View {
        #if os(iOS)
        TabView(selection: $selection) {
            ForEach(images.indices, id: \.self) { index in
                ZoomablePhoto(url: images[index])
                    .tag(index)
            }
        }
        .tabViewStyle(.page(indexDisplayMode: images.count > 1 ? .always : .never))
        #else
        ZoomablePhoto(url: images[selection])
            .id(selection)
            .overlay {
                if images.count > 1 {
                    HStack {
                        pageButton("chevron.left", offset: -1)
                        Spacer()
                        pageButton("chevron.right", offset: 1)
                    }
                    .padding()
                }
            }
        #endif
    }

    #if os(macOS)
    private func pageButton(_ symbol: String, offset: Int) -> some View {
        Button {
            selection = (selection + offset + images.count) % images.count
        } label: {
            Image(systemName: symbol)
                .font(.title2.weight(.semibold))
                .foregroundStyle(.white)
                .frame(width: 44, height: 44)
                .background(.white.opacity(0.18), in: Circle())
        }
        .buttonStyle(.plain)
        .keyboardShortcut(offset < 0 ? .leftArrow : .rightArrow, modifiers: [])
    }
    #endif
}

private struct ZoomablePhoto: View {
    let url: String

    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    var body: some View {
        RemoteImage(url: url, contentMode: .fit) {
            Color.clear
        }
        .scaleEffect(scale)
        .offset(offset)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
        .gesture(
            MagnifyGesture()
                .onChanged { value in
                    scale = min(max(lastScale * value.magnification, 1), 4)
                }
                .onEnded { _ in
                    lastScale = scale
                    if scale <= 1 { reset() }
                }
        )
        .simultaneousGesture(scale > 1 ? pan : nil)
        .onTapGesture(count: 2) {
            withAnimation(.spring(response: 0.3)) {
                if scale > 1 {
                    reset()
                } else {
                    scale = 2.5
                    lastScale = 2.5
                }
            }
        }
    }

    private var pan: some Gesture {
        DragGesture()
            .onChanged { value in
                offset = CGSize(
                    width: lastOffset.width + value.translation.width,
                    height: lastOffset.height + value.translation.height
                )
            }
            .onEnded { _ in lastOffset = offset }
    }

    private func reset() {
        scale = 1
        lastScale = 1
        offset = .zero
        lastOffset = .zero
    }
}

import SwiftUI

/// A card on its way out: pick a shape, see exactly what will be shared, send
/// it. Private by default — names and the map background are opt-in, per
/// card, every time (Strava's privacy zones work the same way: hidden unless
/// you choose otherwise).
struct TripShareSheet: View {
    let content: TripShareContent
    let unit: TripDistanceUnit

    @Environment(\.dismiss) private var dismiss
    @State private var format: TripShareFormat = .story
    @State private var options = TripShareOptions()
    @State private var rendered: (image: CGImage, png: Data)?
    @State private var mapFailed = false

    private struct RenderKey: Equatable {
        let format: TripShareFormat
        let options: TripShareOptions
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    preview
                        .frame(maxWidth: .infinity)
                        .frame(height: 420)

                    Picker("Format", selection: $format) {
                        ForEach(TripShareFormat.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("trip_share_format")

                    VStack(alignment: .leading, spacing: 12) {
                        if content.canShowNames {
                            Toggle("Show Trip Names", isOn: $options.showNames)
                                .accessibilityIdentifier("trip_share_names")
                        }
                        if content.isMap {
                            Toggle("Show Map Background", isOn: $options.showBasemap)
                                .accessibilityIdentifier("trip_share_basemap")
                            if mapFailed {
                                Text("The map couldn't load. Sharing the route shapes only.")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        Label(privacyNote, systemImage: "lock.fill")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(20)
                .frame(maxWidth: 560)
                .frame(maxWidth: .infinity)
            }
            .safeAreaInset(edge: .bottom) { shareButton }
            .navigationTitle("Share")
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
            .task(id: RenderKey(format: format, options: options)) { await render() }
        }
        .accessibilityIdentifier("trip_share_sheet")
    }

    private var privacyNote: String {
        if content.isMap, !options.showBasemap {
            return "Only the shape of your routes is shared, without a map that shows where they are."
        }
        if content.canShowNames, !options.showNames {
            return "Trip names stay off the card unless you turn them on."
        }
        return "Only the numbers on this card are shared. Trip names, notes and exact places stay private."
    }

    @ViewBuilder
    private var preview: some View {
        if let rendered {
            Image(decorative: rendered.image, scale: 3)
                .resizable()
                .scaledToFit()
                .padding(format == .sticker ? 24 : 0)
                .background {
                    // A sticker is transparent; show it over a photo-dark backdrop.
                    if format == .sticker {
                        RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(white: 0.32))
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                .shadow(color: .black.opacity(0.2), radius: 12, y: 4)
                .accessibilityLabel("Preview of the \(format.label.lowercased()) image")
        } else {
            ProgressView()
        }
    }

    private var shareButton: some View {
        Group {
            if let rendered {
                ShareLink(
                    item: TripShareImage(png: rendered.png),
                    preview: SharePreview(content.title, image: Image(decorative: rendered.image, scale: 3))
                ) {
                    Label("Share Image", systemImage: "square.and.arrow.up")
                        .font(.headline)
                        .frame(maxWidth: 520, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .accessibilityIdentifier("trip_share_send")
            } else {
                Button {} label: {
                    Text("Share Image").font(.headline).frame(maxWidth: 520, minHeight: 50)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.roundedRectangle(radius: 14))
                .disabled(true)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 8)
        .frame(maxWidth: .infinity)
        .background(.bar)
    }

    @MainActor
    private func render() async {
        var map = ProjectedMap.empty
        if case .map(let routes, let pins, _, _) = content {
            mapFailed = false
            if options.showBasemap {
                if let snapshot = await ProjectedMap.snapshot(routes: routes, pins: pins, aspect: format.mapAspect) {
                    map = snapshot
                } else {
                    mapFailed = true
                }
            }
            if map.image == nil {
                map = ProjectedMap.lineDrawing(routes: routes, pins: pins, aspect: format.mapAspect)
            }
        }
        guard !Task.isCancelled else { return }
        let card = TripShareCardView(content: content, format: format, options: options, unit: unit, map: map)
        guard let image = TripShareRenderer.render(card), let png = TripShareRenderer.png(image) else { return }
        rendered = (image, png)
    }
}

/// A card waiting for the share sheet; `sheet(item:)` needs an identity.
struct TripShareRequest: Identifiable {
    let id = UUID()
    let content: TripShareContent
}

/// The small share button on a stats card header.
struct TripShareButton: View {
    let accessibilityId: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "square.and.arrow.up")
                .font(.subheadline.weight(.semibold))
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(.borderless)
        .accessibilityLabel("Share")
        .accessibilityIdentifier(accessibilityId)
    }
}

import PhotosUI
import SwiftUI

/// The most photos one report carries. The API enforces the same cap.
enum ReportPhotoLimit {
    static let max = 5
}

/// The first few of a report's photos, small and side by side, for list rows
/// that are themselves links. The last tile counts any that didn't fit.
struct ReportPhotoPreviewRow: View {
    let photos: [String]
    var size: CGFloat = 64
    var shown = 3

    var body: some View {
        HStack(spacing: 6) {
            ForEach(Array(photos.prefix(shown).enumerated()), id: \.offset) { index, key in
                RemoteImage(url: key, contentMode: .fill) {
                    Rectangle().fill(.fill.secondary)
                }
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .overlay {
                    if index == shown - 1 && photos.count > shown {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(.black.opacity(0.45))
                        Text("+\(photos.count - shown)")
                            .font(.callout.weight(.semibold).monospacedDigit())
                            .foregroundStyle(.white)
                    }
                }
            }
        }
        .accessibilityElement()
        .accessibilityLabel(photos.count == 1 ? "1 photo" : "\(photos.count) photos")
    }
}

/// A report's photos in a row. Tapping one opens them full screen when
/// `opensViewer` is on; inside a row that is itself a link, it is off.
struct ReportPhotoStrip: View {
    let photos: [String]
    var size: CGFloat = 112
    var opensViewer = true

    @State private var viewerStart: PhotoViewerStart?

    var body: some View {
        ScrollView(.horizontal) {
            HStack(spacing: 8) {
                ForEach(photos.indices, id: \.self) { index in
                    let tile = RemoteImage(url: photos[index], contentMode: .fill) {
                        Rectangle().fill(.fill.secondary)
                    }
                    .frame(width: size, height: size)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .accessibilityLabel("Photo \(index + 1) of \(photos.count)")

                    if opensViewer {
                        Button { viewerStart = PhotoViewerStart(index: index) } label: { tile }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("trail_report_photo_\(index)")
                    } else {
                        tile
                    }
                }
            }
        }
        .scrollIndicators(.hidden)
        #if os(iOS)
        .fullScreenCover(item: $viewerStart) { start in
            PhotoViewer(images: photos, selection: start.index)
        }
        #else
        .sheet(item: $viewerStart) { start in
            PhotoViewer(images: photos, selection: start.index)
                .frame(minWidth: 640, minHeight: 640)
        }
        #endif
    }
}

// MARK: - Picking

/// The submit form's photo section: up to five from the library or the
/// camera. Photos are downsampled and re-encoded on the way in, which drops
/// their metadata, location included, before anything is uploaded.
struct ReportPhotoPickerSection: View {
    @Binding var photos: [DraftPhoto]
    let isLocked: Bool

    @State private var pickerItems: [PhotosPickerItem] = []
    @State private var isImporting = false
    @State private var showingCamera = false
    @State private var error: String?

    private var remainingSlots: Int { ReportPhotoLimit.max - photos.count }

    var body: some View {
        Section {
            ScrollView(.horizontal) {
                HStack(spacing: 10) {
                    ForEach(photos) { photo in
                        thumbnail(photo)
                    }
                    if isImporting {
                        ProgressView()
                            .frame(width: 88, height: 88)
                            .background(.fill.tertiary, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                    }
                    if remainingSlots > 0 && !isLocked {
                        addTiles
                    }
                }
                .padding(.vertical, 4)
            }
            .scrollIndicators(.hidden)
            if let error {
                InlineErrorView(message: error)
            }
        } header: {
            HStack {
                Text("Photos")
                Spacer()
                Text("\(photos.count) of \(ReportPhotoLimit.max)")
                    .monospacedDigit()
                    .accessibilityIdentifier("trail_report_photo_count")
            }
        } footer: {
            Text("Location data is removed from photos before they're shared.")
        }
        .onChange(of: pickerItems) { _, items in
            guard !items.isEmpty else { return }
            Task { await importPicked(items) }
        }
        #if os(iOS)
        .fullScreenCover(isPresented: $showingCamera) {
            WildlifeCameraView(
                onCapture: { data in
                    showingCamera = false
                    Task { await add([data]) }
                },
                onCancel: { showingCamera = false }
            )
            .ignoresSafeArea()
        }
        #endif
    }

    private func thumbnail(_ photo: DraftPhoto) -> some View {
        Image(decorative: photo.preview, scale: 1)
            .resizable()
            .scaledToFill()
            .frame(width: 88, height: 88)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(alignment: .topTrailing) {
                if !isLocked {
                    Button {
                        withAnimation(.snappy) { photos.removeAll { $0.id == photo.id } }
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(.white)
                            .frame(width: 22, height: 22)
                            .background(.black.opacity(0.6), in: Circle())
                    }
                    .buttonStyle(.plain)
                    .padding(4)
                    .accessibilityLabel("Remove photo")
                    .accessibilityIdentifier("trail_report_remove_photo")
                }
            }
            .overlay {
                if isLocked && photo.uploadedKey != nil {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.white, .green)
                }
            }
            .accessibilityElement(children: .contain)
            .accessibilityLabel("Photo")
            .accessibilityIdentifier("trail_report_photo")
    }

    @ViewBuilder
    private var addTiles: some View {
        PhotosPicker(
            selection: $pickerItems,
            maxSelectionCount: remainingSlots,
            selectionBehavior: .ordered,
            matching: .images
        ) {
            AddPhotoTile(title: "Library", systemImage: "photo.on.rectangle")
        }
        .buttonStyle(.plain)
        .disabled(isImporting)
        .accessibilityIdentifier("trail_report_add_photos")

        #if os(iOS)
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            Button {
                showingCamera = true
            } label: {
                AddPhotoTile(title: "Camera", systemImage: "camera")
            }
            .buttonStyle(.plain)
            .disabled(isImporting)
            .accessibilityIdentifier("trail_report_camera")
        }
        #endif
    }

    private func importPicked(_ items: [PhotosPickerItem]) async {
        isImporting = true
        var datas: [Data] = []
        for item in items {
            if let data = try? await item.loadTransferable(type: Data.self) {
                datas.append(data)
            }
        }
        pickerItems = []
        let skipped = items.count - datas.count
        await add(datas)
        if skipped > 0 {
            error = skipped == 1
                ? "One photo couldn't be added. It may still be downloading from iCloud."
                : "\(skipped) photos couldn't be added. They may still be downloading from iCloud."
        }
    }

    private func add(_ datas: [Data]) async {
        isImporting = true
        error = nil
        defer { isImporting = false }
        for data in datas.prefix(remainingSlots) {
            let prepared = await Task.detached(priority: .userInitiated) {
                FeedPhotoProcessing.prepare(data)
            }.value
            guard let prepared else {
                error = "That photo couldn't be read. Try a different one."
                continue
            }
            withAnimation(.snappy) {
                photos.append(DraftPhoto(jpeg: prepared.jpeg, preview: prepared.preview))
            }
        }
    }
}

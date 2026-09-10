import SwiftUI

#if os(iOS)
import UIKit
typealias PlatformImage = UIImage
#else
import AppKit
typealias PlatformImage = NSImage
#endif

extension Image {
    /// Builds an `Image` from raw platform image data on either platform.
    ///
    /// `Image` has no shared initializer across UIKit and AppKit, so every site
    /// that renders picked photo data otherwise repeats the same `#if os(iOS)`
    /// pair (cf. `WildlifeView.thumbnailView`). One helper keeps the call sites
    /// platform-free.
    init(platformImage: PlatformImage) {
        #if os(iOS)
        self.init(uiImage: platformImage)
        #else
        self.init(nsImage: platformImage)
        #endif
    }
}

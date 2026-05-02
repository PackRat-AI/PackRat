// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PackRat",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    dependencies: [
        .package(url: "https://github.com/kean/Nuke", from: "12.0.0"),
        .package(url: "https://github.com/gonzalezreal/swift-markdown-ui", from: "2.4.0"),
    ],
    targets: [
        .executableTarget(
            name: "PackRat",
            dependencies: [
                .product(name: "NukeUI", package: "Nuke"),
                .product(name: "MarkdownUI", package: "swift-markdown-ui"),
            ],
            path: "Sources/PackRat"
        ),
        .testTarget(
            name: "PackRatTests",
            dependencies: [],
            path: "Tests/PackRatTests"
        ),
    ]
)

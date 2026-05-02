// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PackRat",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    targets: [
        .executableTarget(
            name: "PackRat",
            path: "Sources/PackRat"
        ),
    ]
)

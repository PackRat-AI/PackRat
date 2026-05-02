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
        // OpenAPI code generation — reads openapi.yaml at build time
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.3.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.5.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.0"),
    ],
    targets: [
        // Generated OpenAPI client — isolated target so the build plugin only
        // runs against openapi.yaml and doesn't slow down the main compile.
        .target(
            name: "PackRatAPIClient",
            dependencies: [
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                .product(name: "OpenAPIURLSession", package: "swift-openapi-urlsession"),
            ],
            path: "Sources/PackRatAPIClient",
            plugins: [
                .plugin(name: "OpenAPIGenerator", package: "swift-openapi-generator"),
            ]
        ),
        .executableTarget(
            name: "PackRat",
            dependencies: [
                .product(name: "NukeUI", package: "Nuke"),
                .product(name: "MarkdownUI", package: "swift-markdown-ui"),
                .product(name: "OpenAPIRuntime", package: "swift-openapi-runtime"),
                "PackRatAPIClient",
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

// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "PackRat",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.3.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.5.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.0"),
    ],
    targets: [
        // Generated OpenAPI client — isolated target so the build plugin only
        // runs against openapi.yaml and doesn't slow down the main compile.
        // Nuke and MarkdownUI are declared in project.yml (Xcode targets) instead.
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
    ]
)

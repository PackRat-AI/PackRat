// swift-tools-version: 5.9
// This package is used only for `bun swift:codegen` — it is NOT referenced
// by the Xcode project. The generated Client.swift / Types.swift are
// committed directly into Sources/PackRat/API/.
import PackageDescription

let package = Package(
    name: "PackRatAPIClient",
    platforms: [
        .macOS(.v14),
        .iOS(.v17),
    ],
    products: [
        .library(name: "PackRatAPIClient", targets: ["PackRatAPIClient"]),
    ],
    dependencies: [
        .package(url: "https://github.com/apple/swift-openapi-generator", from: "1.3.0"),
        .package(url: "https://github.com/apple/swift-openapi-runtime", from: "1.5.0"),
        .package(url: "https://github.com/apple/swift-openapi-urlsession", from: "1.0.0"),
    ],
    targets: [
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

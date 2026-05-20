import Foundation

/// MLX-Swift backed `LocalLLMProvider`.
///
/// **Status: stub.** This intentionally does NOT import MLX yet. The real
/// integration is a separate effort with its own product/legal decisions
/// (model license, RAM budget, App Store review impact).
///
/// **Integration plan when product greenlights it:**
///
/// 1. Add the `MLX` and `MLXLLM` SwiftPM packages to `apps/swift/project.yml`:
///    - `https://github.com/ml-explore/mlx-swift` (latest tagged release)
///    - `https://github.com/ml-explore/mlx-swift-examples` for the
///      `MLXLLM` / `MLXLMCommon` helper packages.
/// 2. Pick a model. Recommended starting point: **Llama-3.2-1B-Instruct-4bit**
///    (~700 MB on-disk, ~1.0–1.2 GB RAM peak, MIT-licensed weights via
///    `mlx-community` on Hugging Face). Heavier alternatives if quality is
///    insufficient:
///    - `Llama-3.2-3B-Instruct-4bit` (~2.0 GB RAM)
///    - `Mistral-7B-Instruct-v0.3-4bit` (~4.5 GB RAM, iPhone 15 Pro+ only)
/// 3. Decide on packaging:
///    - **Download on first launch** (preferred): keeps the binary small,
///      lets us swap models without a new App Store build, but needs a
///      progress UI and a retry path on bad networks.
///    - **Bundled**: simpler, but bloats the IPA to 700 MB+.
/// 4. Wire `warmUp()` to call `MLXLLM.loadModelContainer(configuration:)`,
///    storing the resulting container on `self`.
/// 5. Wire `generate(...)` / `generateStream(...)` to
///    `MLXLLM.generate(input:parameters:context:didGenerate:)`. The streaming
///    variant maps each yielded `GenerateResult` chunk through the
///    `AsyncThrowingStream` continuation.
/// 6. Entitlements: none required. MLX runs entirely in-process on the GPU
///    via Metal — no special capability beyond the existing app sandbox.
/// 7. Update `OfflineAITests.swift` to also exercise the MLX path on a
///    physical-device CI lane (Simulator MLX kernels are CPU-only and slow).
///
/// Until step 1 happens, this type throws `LocalLLMError.notImplemented` from
/// every method that does real work. The unit test
/// `OfflineAITests.mlxStubIsNotYetWired` locks that contract in place so a
/// future PR that wires MLX must consciously break the test.
public final class MLXLocalLLMProvider: LocalLLMProvider {
    /// Always false until the real implementation lands. View models should
    /// surface "model not ready" UX rather than hanging on `warmUp`.
    public let isReady: Bool = false

    public init() {}

    public func warmUp() async throws {
        throw LocalLLMError.notImplemented(
            "MLXLocalLLMProvider is a stub. See the doc comment for integration steps."
        )
    }

    public func generate(prompt _: String, options _: GenerateOptions?) async throws -> String {
        throw LocalLLMError.notImplemented(
            "MLXLocalLLMProvider is a stub. See the doc comment for integration steps."
        )
    }

    public func generateStream(
        prompt _: String,
        options _: GenerateOptions?
    ) -> AsyncThrowingStream<String, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish(throwing: LocalLLMError.notImplemented(
                "MLXLocalLLMProvider is a stub. See the doc comment for integration steps."
            ))
        }
    }
}

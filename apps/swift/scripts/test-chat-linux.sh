#!/usr/bin/env bash
# Focused portable logic tests. Does NOT validate URLSession.AsyncBytes, Sentry,
# SwiftUI, SwiftData, Keychain, or an Apple app build. Run ChatTransportTests on Apple.
# Requires Swift >= 6 and Python 3. Additional swift-test flags can be passed through.
set -euo pipefail
chat_swift_root="$(cd "$(dirname "$0")/.." && pwd)"
chat_test_dir="$(mktemp -d /tmp/packrat-chat-linux.XXXXXX)"
trap 'rm -rf "$chat_test_dir"' EXIT
python3 - "$chat_swift_root" "$chat_test_dir" <<'PY'
from pathlib import Path
import sys
root, destination = map(Path, sys.argv[1:])
sources = destination / 'Sources/PackRat'
tests = destination / 'Tests/PackRatTests'
sources.mkdir(parents=True)
tests.mkdir(parents=True)
(destination / 'Package.swift').write_text('''// swift-tools-version: 6.0
import PackageDescription
let package = Package(name: "ChatLinux", targets: [
    .target(name: "PackRat"),
    .testTarget(name: "PackRatTests", dependencies: ["PackRat"])
], swiftLanguageModes: [.v5])
''')
for relative in ['Models/Chat.swift', 'Features/Chat/ChatViewModel.swift',
                 'Features/Chat/ChatPackTools.swift', 'Network/ChatStreamParser.swift']:
    (sources / Path(relative).name).symlink_to(root / 'Sources/PackRat' / relative)
for name in ['ChatViewModelTests.swift', 'ChatStreamParserTests.swift']:
    (tests / name).symlink_to(root / 'Tests/PackRatTests' / name)
# Compile the real service protocol and unit conversion code. The default network
# service is deliberately unavailable; every test must inject its synthetic service.
support = (root / 'Sources/PackRat/Services/ChatService.swift').read_text().split('final class ChatService:')[0]
support += '''final class ChatService: ChatServicing {
    static let shared = ChatService()
    func sendMessage(messages: [ChatMessage], context: ChatContext) async -> AsyncThrowingStream<String, Error> {
        fatalError("Inject a mock service; Linux harness does not provide networking")
    }
}
'''
generated = (root / 'Sources/PackRat/Models/Generated.swift').read_text()
support += generated[generated.index('enum WeightUnit:'):generated.index('enum PackCategory:')]
pack = (root / 'Sources/PackRat/Models/Pack.swift').read_text()
start = pack.index('extension WeightUnit {')
support += pack[start:pack.index('\nextension PackCategory', start)]
(sources / 'LinuxSupport.swift').write_text(support)
PY
export CLANG_MODULE_CACHE_PATH="${CLANG_MODULE_CACHE_PATH:-$chat_test_dir/clang-cache}"
swift test --package-path "$chat_test_dir" --cache-path "$chat_test_dir/cache" -j 2 "$@"

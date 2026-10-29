#if os(iOS)
import SwiftUI
import Testing
import UIKit
@testable import PackRat

@Suite("User chat bubble layout")
@MainActor
struct ChatBubbleLayoutTests {
    @Test("Long prompts retain their full height under a compressed proposal", arguments:
        [CGFloat(296), CGFloat(369)],
        [DynamicTypeSize.large, .accessibility1]
    )
    func longPromptRetainsHeight(rowWidth: CGFloat, typeSize: DynamicTypeSize) {
        let prompts = [
            "Help me prepare for a three day hike with rain, cold mornings, and warm afternoons. Review my layers, shelter, food, water, and first aid supplies, and explain what I should change before leaving.",
            "Review my packing list.\nCheck rain protection.\nCheck warm layers.\nCheck food and water.\nKeep this final line visible.",
        ]
        for prompt in prompts {
            // The row reserves 48pt for the spacer, 28pt for the avatar,
            // two 8pt gaps, and two 14pt text insets. Measure the full text
            // independently with an unrestricted vertical proposal.
            let textWidth = rowWidth - 48 - 28 - 16 - 28
            let reference = UIHostingController(rootView:
                Text(prompt).environment(\.dynamicTypeSize, typeSize)
            )
            let textSize = reference.sizeThatFits(in:
                CGSize(width: textWidth, height: CGFloat.greatestFiniteMagnitude)
            )
            let bubble = UIHostingController(rootView:
                MessageBubble(message: ChatMessage(role: .user, content: prompt))
                    .environment(\.dynamicTypeSize, typeSize)
            )
            let size = bubble.sizeThatFits(in: CGSize(width: rowWidth, height: 28))
            #expect(textSize.height > 28, "Fixture must require multiple lines")
            #expect(size.height >= textSize.height + 20 - 1,
                    "All text lines plus vertical padding must fit, even when compressed")
            #expect(size.width <= rowWidth + 1, "Wrapping must not widen the row")
        }
    }
}
#endif

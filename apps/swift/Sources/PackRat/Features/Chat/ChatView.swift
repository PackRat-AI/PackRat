import SwiftUI
import MarkdownUI

struct ChatView: View {
    @Bindable var viewModel: ChatViewModel

    private var showSuggestions: Bool {
        viewModel.messages.count <= 1 && !viewModel.isStreaming
    }

    var body: some View {
        VStack(spacing: 0) {
            messageList
            if showSuggestions {
                suggestionsBar
            }
            Divider()
            inputBar
        }
        .navigationTitle("AI Assistant")
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button("Clear", systemImage: "trash") { viewModel.clearHistory() }
                    .disabled(viewModel.messages.count <= 1)
            }
        }
    }

    // MARK: - Message List

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if viewModel.messages.count <= 1 {
                        welcomeHeader
                    }
                    ForEach(viewModel.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                    if let error = viewModel.error {
                        InlineErrorView(message: error).padding(.horizontal)
                    }
                }
                .padding(.horizontal, 12)
                .padding(.bottom, 16)
            }
            .onChange(of: viewModel.messages.count) {
                withAnimation(.spring(duration: 0.3)) {
                    proxy.scrollTo(viewModel.messages.last?.id, anchor: .bottom)
                }
            }
            .onChange(of: viewModel.messages.last?.content) {
                proxy.scrollTo(viewModel.messages.last?.id, anchor: .bottom)
            }
        }
    }

    private var welcomeHeader: some View {
        VStack(spacing: 10) {
            Circle()
                .fill(Color.accentColor.opacity(0.12))
                .frame(width: 60, height: 60)
                .overlay {
                    Image(systemName: "backpack.fill")
                        .font(.title2)
                        .foregroundStyle(Color.accentColor)
                }
            Text("PackRat AI")
                .font(.title3.bold())
            Text("Ask me anything about gear, trips, or packing strategy")
                .font(.callout)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 24)
        .padding(.top, 4)
        .padding(.bottom, 8)
    }

    // MARK: - Suggestions

    private static let suggestions: [(String, String)] = [
        ("Ultralight tips", "What are the best ultralight backpacking tips for cutting pack weight?"),
        ("3-day hike gear", "What gear should I pack for a 3-day summer hiking trip?"),
        ("Layering advice", "Explain the layering system for outdoor clothing."),
        ("Rain prep", "How should I prepare my pack for a rainy backcountry trip?"),
        ("Essential first aid", "What first aid items are must-haves in every pack?"),
        ("Food planning", "How much food should I pack per day for a backpacking trip?"),
    ]

    private var suggestionsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Self.suggestions, id: \.0) { label, prompt in
                    Button {
                        viewModel.inputText = prompt
                        viewModel.sendMessage()
                    } label: {
                        Text(label)
                            .font(.caption.bold())
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Color.accentColor.opacity(0.1), in: Capsule())
                            .foregroundStyle(Color.accentColor)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(.background.secondary)
    }

    // MARK: - Input Bar

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            #if os(macOS)
            TextField("Ask about gear, trips, packing...", text: $viewModel.inputText)
                .textFieldStyle(.roundedBorder)
                .onSubmit { viewModel.sendMessage() }
                .accessibilityIdentifier("chat_input")
            #else
            TextField("Ask about gear, trips, packing…", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .padding(.vertical, 8)
                .onSubmit { viewModel.sendMessage() }
                .accessibilityIdentifier("chat_input")
            #endif

            Group {
                if viewModel.isStreaming {
                    Button(action: viewModel.cancelStreaming) {
                        Image(systemName: "stop.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.red)
                            .symbolEffect(.pulse)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("chat_cancel")
                } else {
                    Button(action: viewModel.sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(viewModel.canSend ? Color.accentColor : Color.secondary)
                    }
                    .buttonStyle(.plain)
                    .disabled(!viewModel.canSend)
                    .keyboardShortcut(.return, modifiers: .command)
                    .accessibilityIdentifier("chat_send")
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(.background)
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage
    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUser {
                Spacer(minLength: 48)
                bubbleContent
                userAvatar
            } else {
                aiAvatar
                bubbleContent
                Spacer(minLength: 48)
            }
        }
        .transition(.asymmetric(
            insertion: .move(edge: isUser ? .trailing : .leading).combined(with: .opacity),
            removal: .opacity
        ))
    }

    @ViewBuilder
    private var bubbleContent: some View {
        if message.content.isEmpty && message.toolInvocations.isEmpty && !isUser {
            TypingIndicator()
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        } else if isUser {
            Text(message.content)
                .textSelection(.enabled)
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.accentColor, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .foregroundStyle(.white)
        } else {
            VStack(alignment: .leading, spacing: 8) {
                if !message.toolInvocations.isEmpty {
                    ToolInvocationsView(invocations: message.toolInvocations)
                        .padding(.horizontal, 14)
                        .padding(.top, 10)
                }
                if !message.content.isEmpty {
                    Markdown(message.content)
                        .markdownTheme(.gitHub)
                        .textSelection(.enabled)
                        .padding(.horizontal, 14)
                        .padding(.vertical, message.toolInvocations.isEmpty ? 10 : 0)
                        .padding(.bottom, message.toolInvocations.isEmpty ? 0 : 10)
                }
            }
            .background(Color.secondary.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
    }

    private var aiAvatar: some View {
        Circle()
            .fill(Color.accentColor.opacity(0.12))
            .frame(width: 28, height: 28)
            .overlay {
                Image(systemName: "backpack.fill")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
            }
    }

    private var userAvatar: some View {
        Circle()
            .fill(.fill.secondary)
            .frame(width: 28, height: 28)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
    }
}

// MARK: - Typing Indicator

struct TypingIndicator: View {
    @State private var phase = 0

    var body: some View {
        HStack(spacing: 5) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.secondary.opacity(phase == i ? 1 : 0.3))
                    .frame(width: 7, height: 7)
                    .scaleEffect(phase == i ? 1.2 : 0.9)
                    .animation(.easeInOut(duration: 0.35), value: phase)
            }
        }
        .onAppear {
            Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                phase = (phase + 1) % 3
            }
        }
    }
}

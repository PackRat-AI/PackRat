import SwiftUI
import MarkdownUI

struct ChatView: View {
    let viewModel: ChatViewModel

    var body: some View {
        VStack(spacing: 0) {
            messageList
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

    private var messageList: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 16) {
                    ForEach(viewModel.messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }
                    if let error = viewModel.error {
                        InlineErrorView(message: error).padding(.horizontal)
                    }
                }
                .padding()
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

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask about gear, trips, or packing…", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...6)
                .padding(.vertical, 8)

            Group {
                if viewModel.isStreaming {
                    Button(action: viewModel.cancelStreaming) {
                        Image(systemName: "stop.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.red)
                            .symbolEffect(.pulse)
                    }
                    .buttonStyle(.plain)
                } else {
                    Button(action: viewModel.sendMessage) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title3)
                            .foregroundStyle(viewModel.canSend ? .tint : .secondary)
                    }
                    .buttonStyle(.plain)
                    .disabled(!viewModel.canSend)
                    .keyboardShortcut(.return, modifiers: .command)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.background.secondary)
    }
}

// MARK: - Message Bubble

struct MessageBubble: View {
    let message: ChatMessage
    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if isUser { Spacer(minLength: 60) }
            if !isUser { avatar }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 2) {
                if message.content.isEmpty && !isUser {
                    typingIndicator
                } else if isUser {
                    Text(message.content)
                        .textSelection(.enabled)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(.tint, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                        .foregroundStyle(.white)
                } else {
                    Markdown(message.content)
                        .markdownTheme(.gitHub)
                        .textSelection(.enabled)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
            }
            .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)

            if isUser { userAvatar }
            if !isUser { Spacer(minLength: 60) }
        }
    }

    private var avatar: some View {
        Circle()
            .fill(.tint.opacity(0.12))
            .frame(width: 30, height: 30)
            .overlay {
                Image(systemName: "backpack.fill")
                    .font(.caption.bold())
                    .foregroundStyle(.tint)
            }
    }

    private var userAvatar: some View {
        Circle()
            .fill(.tint.opacity(0.12))
            .frame(width: 30, height: 30)
            .overlay {
                Image(systemName: "person.fill")
                    .font(.caption)
                    .foregroundStyle(.tint)
            }
    }

    private var typingIndicator: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(.secondary)
                    .frame(width: 7, height: 7)
                    .scaleEffect(1.0)
                    .animation(
                        .easeInOut(duration: 0.5).repeatForever().delay(Double(i) * 0.15),
                        value: true
                    )
            }
        }
        .padding(12)
        .background(.fill.secondary, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }
}

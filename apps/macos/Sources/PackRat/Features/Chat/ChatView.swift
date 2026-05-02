import SwiftUI

struct ChatView: View {
    @State private var viewModel = ChatViewModel()

    var body: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(viewModel.messages) { message in
                            MessageBubble(message: message)
                                .id(message.id)
                        }
                        if let error = viewModel.error {
                            InlineErrorView(message: error)
                                .padding(.horizontal)
                        }
                    }
                    .padding()
                }
                .onChange(of: viewModel.messages.count) {
                    withAnimation {
                        proxy.scrollTo(viewModel.messages.last?.id, anchor: .bottom)
                    }
                }
                .onChange(of: viewModel.messages.last?.content) {
                    proxy.scrollTo(viewModel.messages.last?.id, anchor: .bottom)
                }
            }

            Divider()
            inputBar
        }
        .navigationTitle("AI Assistant")
        .toolbar {
            ToolbarItem(placement: .automatic) {
                Button("Clear", systemImage: "trash") {
                    viewModel.clearHistory()
                }
                .disabled(viewModel.messages.count <= 1)
            }
        }
    }

    private var inputBar: some View {
        HStack(alignment: .bottom, spacing: 10) {
            TextField("Ask about gear, trips, or packing…", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .padding(.vertical, 8)
                .onSubmit {
                    #if os(macOS)
                    viewModel.sendMessage()
                    #endif
                }

            Group {
                if viewModel.isStreaming {
                    Button(action: viewModel.cancelStreaming) {
                        Image(systemName: "stop.circle.fill")
                            .font(.title3)
                            .foregroundStyle(.red)
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
                    .keyboardShortcut(.return, modifiers: [.command])
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
        .background(.background.secondary)
    }
}

struct MessageBubble: View {
    let message: ChatMessage

    private var isUser: Bool { message.role == .user }

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            if isUser { Spacer(minLength: 60) }

            if !isUser {
                Circle()
                    .fill(.tint.opacity(0.15))
                    .overlay {
                        Image(systemName: "backpack.fill")
                            .font(.caption.bold())
                            .foregroundStyle(.tint)
                    }
                    .frame(width: 28, height: 28)
            }

            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                if message.content.isEmpty && !isUser {
                    ProgressView()
                        .controlSize(.small)
                        .padding(.vertical, 4)
                } else {
                    Text(message.content)
                        .textSelection(.enabled)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            isUser ? AnyShapeStyle(.tint) : AnyShapeStyle(.fill.secondary),
                            in: RoundedRectangle(cornerRadius: 14)
                        )
                        .foregroundStyle(isUser ? .white : .primary)
                }
            }
            .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)

            if isUser {
                Circle()
                    .fill(.tint.opacity(0.15))
                    .frame(width: 28, height: 28)
                    .overlay {
                        Image(systemName: "person.fill")
                            .font(.caption)
                            .foregroundStyle(.tint)
                    }
            } else {
                Spacer(minLength: 60)
            }
        }
    }
}

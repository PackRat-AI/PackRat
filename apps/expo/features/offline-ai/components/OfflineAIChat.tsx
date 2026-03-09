/**
 * Offline AI Chat Component
 *
 * Main chat interface for the offline AI assistant.
 * Displays messages and allows user input.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useOfflineAI } from '../hooks/useOfflineAI';
import type { ChatMessage, TrailInfo } from '../types';

interface OfflineAIChatProps {
  /** Initial trail context */
  trail?: TrailInfo;
  /** Placeholder text for input */
  placeholder?: string;
  /** Show model info */
  showModelInfo?: boolean;
}

export function OfflineAIChat({
  trail,
  placeholder = 'Ask about trails, gear, or safety...',
  showModelInfo = true,
}: OfflineAIChatProps) {
  const [input, setInput] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    messages,
    isGenerating,
    error,
    isAvailable,
    modelInfo,
    sendMessage,
    clearMessages,
    initialize,
  } = useOfflineAI({
    trailContext: trail ? { trail } : undefined,
  });

  // Scroll to bottom when new messages arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: messages is needed to trigger scroll on new messages
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isGenerating) return;

    const message = input.trim();
    setInput('');
    await sendMessage(message);
  };

  const quickPrompts = [
    'What gear do I need?',
    'Trail conditions?',
    'Safety tips?',
    'Water needs?',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🏔️ Offline AI Assistant</Text>
        {showModelInfo && modelInfo && <Text style={styles.modelInfo}>{modelInfo.name}</Text>}
        {!isAvailable && (
          <TouchableOpacity onPress={initialize} style={styles.initButton}>
            <Text style={styles.initButtonText}>Tap to Enable</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Trail context indicator */}
      {trail && (
        <View style={styles.trailBadge}>
          <Text style={styles.trailBadgeText}>📍 {trail.name}</Text>
        </View>
      )}

      {/* Error display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Ask me anything!</Text>
            <Text style={styles.emptySubtitle}>
              I work offline and can help with trail info, gear recommendations, and safety tips.
            </Text>

            <View style={styles.quickPrompts}>
              {quickPrompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.quickPromptButton}
                  onPress={() => sendMessage(prompt)}
                  disabled={!isAvailable || isGenerating}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}

        {isGenerating && (
          <View style={styles.typingIndicator}>
            <ActivityIndicator size="small" color="#10B981" />
            <Text style={styles.typingText}>Thinking...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          multiline
          maxLength={500}
          editable={isAvailable && !isGenerating}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!input.trim() || !isAvailable || isGenerating) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!input.trim() || !isAvailable || isGenerating}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>

      {/* Clear button */}
      {messages.length > 0 && (
        <TouchableOpacity style={styles.clearButton} onPress={clearMessages}>
          <Text style={styles.clearButtonText}>Clear Chat</Text>
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}

/**
 * Individual message bubble component
 */
function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
      <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
        {message.content}
      </Text>
      <Text style={styles.timestamp}>
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modelInfo: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  initButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#10B981',
    borderRadius: 20,
  },
  initButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  trailBadge: {
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  trailBadgeText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 14,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  quickPrompts: {
    marginTop: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  quickPromptButton: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  quickPromptText: {
    color: '#0369A1',
    fontSize: 14,
    fontWeight: '500',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#10B981',
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#FFFFFF',
  },
  assistantText: {
    color: '#111827',
  },
  timestamp: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  typingText: {
    marginLeft: 8,
    color: '#6B7280',
    fontSize: 14,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#111827',
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: '#10B981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 15,
  },
  clearButton: {
    alignSelf: 'center',
    padding: 8,
    marginBottom: 8,
  },
  clearButtonText: {
    color: '#6B7280',
    fontSize: 14,
  },
});

export default OfflineAIChat;

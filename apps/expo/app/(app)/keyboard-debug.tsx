import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: 'Welcome to the chat! This is a sample message to test keyboard avoidance.',
      isUser: false,
      timestamp: new Date(),
    },
    {
      id: '2',
      text: 'Hello! Testing the chat interface.',
      isUser: true,
      timestamp: new Date(),
    },
    {
      id: '3',
      text: 'The keyboard should properly avoid this input field when you type.',
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = () => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        isUser: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, newMessage]);
      setInputText('');
    }
  };

  const renderMessage = (message: Message) => (
    <View key={message.id} className={`mb-3 mx-4 ${message.isUser ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[80%] p-3 rounded-2xl ${
          message.isUser ? 'bg-blue-500 rounded-br-sm' : 'bg-gray-200 rounded-bl-sm'
        }`}
      >
        <Text className={`text-base ${message.isUser ? 'text-white' : 'text-gray-900'}`}>
          {message.text}
        </Text>
        <Text className={`text-xs mt-1 ${message.isUser ? 'text-blue-100' : 'text-gray-500'}`}>
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: 'white' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      {/* Header */}
      <View className="bg-blue-500 px-4 py-3 pt-12">
        <Text className="text-white text-lg font-semibold">Chat Debug</Text>
        <Text className="text-blue-100 text-sm">Testing keyboard avoidance behavior</Text>
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 16 }}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(renderMessage)}
      </ScrollView>

      {/* Input Area */}
      <View className="flex-row items-center px-4 py-3 bg-gray-50 border-t border-gray-200">
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder="Type a message..."
          multiline
          maxHeight={100}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#d1d5db',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            marginRight: 12,
            backgroundColor: 'white',
            fontSize: 16,
          }}
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
          returnKeyType="send"
        />
        <TouchableOpacity onPress={sendMessage} className="bg-blue-500 rounded-full p-3">
          <Text className="text-white font-semibold">Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

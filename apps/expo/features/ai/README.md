# PackRat On-Device AI PoC

This directory contains a complete Proof of Concept implementation for bringing AI capabilities on-device to PackRat using [react-native-ai](https://react-native-ai.dev/).

## 🚀 Overview

The on-device AI implementation provides faster, more private AI responses by running models locally on user devices, with intelligent fallback to cloud-based AI when needed.

### Key Benefits

- **⚡ Faster Responses**: Eliminates network latency
- **🔒 Enhanced Privacy**: No data sent to external servers
- **📱 Offline Support**: Works without internet connection*
- **💰 Cost Reduction**: Reduces cloud API usage

## 🏗️ Architecture

### Core Components

1. **`OnDeviceAIProvider`** (`providers/on-device-ai.ts`)
   - Manages Apple Intelligence and MLC engines
   - Handles provider selection and initialization
   - Provides unified interface for both providers

2. **`OnDeviceChatTransport`** (`providers/on-device-chat-transport.ts`)
   - AI SDK-compatible transport with streaming support
   - Seamless fallback to cloud when needed
   - Full compatibility with existing chat interface

3. **`useOnDeviceAI`** (`hooks/useOnDeviceAI.ts`)
   - React hook for capability detection
   - State management for on-device AI features
   - Real-time capability updates

4. **`OnDeviceAIStatus`** (`components/OnDeviceAIStatus.tsx`)
   - Visual capability indicators
   - Configuration interface
   - Status and progress displays

### Provider Support

#### Apple Intelligence (iOS)
- **Requirements**: iOS 18+ with Apple Intelligence enabled
- **Models**: System default language model
- **Features**: 
  - Text generation with tool support
  - Speech synthesis and transcription
  - Text embeddings via NLContextualEmbedding
  - Native system integration

#### MLC Engine (Cross-Platform)
- **Models**: Llama 3.2 3B Instruct (default), other MLC-compatible models
- **Features**:
  - On-device inference with streaming
  - Model downloading and management
  - JSON-structured responses
  - Tool calling support

## 📱 User Experience

### New Routes

#### `/ai-demo` - AI Capabilities Demo
- Comprehensive overview of available AI options
- Device capability detection results
- Feature comparison table
- Direct access to different AI modes

#### `/ai-chat-ondevice` - On-Device AI Chat
- Full chat interface powered by on-device AI
- Real-time provider status display
- Configuration options panel
- Streaming responses with progress indicators

#### Enhanced `/ai-chat` Tile
- Shows on-device availability status
- Visual indicators for capability
- Seamless integration with existing interface

## 🛠️ Implementation Details

### Device Capability Detection

```typescript
export async function detectDeviceCapabilities(): Promise<DeviceCapabilities> {
  let supportsAppleIntelligence = false;
  let supportsMLC = false;

  // Check Apple Intelligence availability on iOS
  if (Platform.OS === 'ios') {
    try {
      supportsAppleIntelligence = await apple.isAvailable();
    } catch (error) {
      console.warn('Failed to check Apple Intelligence:', error);
    }
  }

  // MLC is available on both iOS and Android
  supportsMLC = true;

  const recommendedProvider: OnDeviceProvider | null = 
    supportsAppleIntelligence ? 'apple' : 
    supportsMLC ? 'mlc' : 
    null;

  return {
    supportsAppleIntelligence,
    supportsMLC,
    recommendedProvider,
  };
}
```

### Provider Selection Logic

1. **iOS with Apple Intelligence**: Uses Apple's native AI for optimal performance
2. **iOS without Apple Intelligence**: Falls back to MLC engine
3. **Android**: Uses MLC engine for on-device processing
4. **Fallback**: Cloud-based AI when on-device processing unavailable

### Streaming Implementation

The on-device providers support full streaming responses compatible with the AI SDK:

```typescript
const stream = await onDeviceProvider.generateStream(messages, {
  temperature: 0.7,
  maxTokens: 1000,
});

// Convert provider stream to AI SDK format
return convertProviderStreamToUIMessageChunks(stream, chatId);
```

## 🔧 Configuration

### Expo Configuration

The MLC plugin is automatically configured in `app.config.ts`:

```typescript
plugins: [
  // ... other plugins
  '@react-native-ai/mlc',
]
```

### Provider Configuration

```typescript
const onDeviceProvider = new OnDeviceAIProvider({
  fallbackToCloud: true,
  mlcOptions: {
    modelId: 'Llama-3.2-3B-Instruct',
    downloadProgressCallback: (progress) => {
      console.log('Model download progress:', progress);
    },
  },
  appleOptions: {
    availableTools: {
      // Define available tools for Apple Intelligence
    },
  },
});
```

## 📊 Performance Characteristics

### Apple Intelligence
- **Latency**: ~100-500ms for short responses
- **Privacy**: Fully on-device processing
- **Memory**: Uses system AI resources
- **Power**: Optimized by iOS system

### MLC Engine
- **Latency**: ~1-3 seconds for short responses (device dependent)
- **Privacy**: Fully local processing
- **Memory**: ~2-4GB RAM for model
- **Storage**: ~1-4GB for model files

### Cloud AI (Fallback)
- **Latency**: ~1-5 seconds (network dependent)
- **Privacy**: Data sent to provider
- **Resources**: Minimal local usage

## 🧪 Testing & Development

### Testing On-Device Capabilities

1. **Apple Intelligence Testing**
   - Requires iOS 18+ device with Apple Intelligence enabled
   - Test on iPhone 15 Pro, M1+ iPads, or compatible devices
   - Verify capability detection and model responses

2. **MLC Engine Testing**
   - Test model download and initialization
   - Verify inference performance on different devices
   - Check memory usage during operation

3. **Fallback Testing**
   - Disable on-device providers to test cloud fallback
   - Verify seamless transition between providers
   - Test error handling and recovery

### Development Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Start Expo development server:
   ```bash
   bun expo
   ```

3. Test on device or simulator:
   - iOS: Apple Intelligence requires physical device
   - Android: MLC works in emulator (with limitations)

## 📋 Limitations & Considerations

### Current Limitations

1. **Model Selection**: Limited model options compared to cloud AI
2. **Context Length**: Shorter context windows for on-device models
3. **Complex Tasks**: May not handle very complex reasoning as well as large cloud models
4. **Initial Setup**: Model downloading requires time and storage space

### Privacy Considerations

- **On-Device**: No data leaves the device during processing
- **Model Downloads**: Initial model download may occur over internet
- **Fallback**: Cloud fallback sends data to remote servers when enabled

### Performance Considerations

- **Device Requirements**: Performance varies significantly by device
- **Battery Usage**: On-device inference uses more battery than cloud calls
- **Storage Requirements**: Models require significant storage space

## 🔮 Future Enhancements

### Short-term Improvements

- [ ] Model management UI (download/remove/update models)
- [ ] Performance optimization and caching
- [ ] Better error handling and recovery
- [ ] Usage analytics and monitoring

### Long-term Enhancements

- [ ] Hybrid processing (simple tasks on-device, complex on cloud)
- [ ] Model fine-tuning for outdoor/hiking domain
- [ ] Multi-modal support (image, audio processing)
- [ ] Federated learning capabilities

### Advanced Features

- [ ] Smart context switching based on task complexity
- [ ] Local RAG (Retrieval-Augmented Generation) with device storage
- [ ] Offline knowledge base integration
- [ ] Personal model adaptation

## 📚 Resources

- [React Native AI Documentation](https://react-native-ai.dev/)
- [Apple Intelligence Overview](https://react-native-ai.dev/docs/apple/getting-started)
- [MLC LLM Documentation](https://react-native-ai.dev/docs/mlc/getting-started)
- [AI SDK Documentation](https://sdk.vercel.ai/docs)

## 🤝 Contributing

When contributing to the on-device AI implementation:

1. Test on both iOS and Android devices
2. Consider privacy implications of changes
3. Ensure fallback mechanisms work correctly
4. Document performance characteristics
5. Update capability detection as needed

---

*This PoC demonstrates the feasibility and benefits of on-device AI for PackRat users, providing a foundation for future development and optimization.*
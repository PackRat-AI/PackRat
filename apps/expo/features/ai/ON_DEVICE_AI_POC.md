# On-Device AI PoC with Cactus React Native

This Proof of Concept (PoC) demonstrates how to integrate on-device AI inference into PackRat using [cactus-react-native](https://github.com/cactus-compute/cactus-react-native).

## Overview

This PoC brings AI functionality directly to the user's device, enabling:

- **Offline AI inference**: Chat with AI without internet connection
- **Privacy**: User data never leaves the device
- **Speed**: Faster response times (20-75+ tokens/sec on mobile)
- **Hybrid mode**: Automatic fallback to cloud when on-device unavailable

## Architecture

The implementation consists of several key components:

### 1. Core Hooks

#### `useCactusAI` (`features/ai/hooks/useCactusAI.ts`)
Custom hook wrapping the cactus-react-native SDK with:
- Model download management
- Inference execution
- Progress tracking
- Error handling
- Resource cleanup

**Example Usage:**
```tsx
const { 
  isReady, 
  isDownloading, 
  downloadProgress, 
  complete, 
  download 
} = useCactusAI({
  autoDownload: true,
  onReady: () => console.log('Model ready!'),
});

// Generate completion
const result = await complete({
  messages: [
    { role: 'user', content: 'What should I pack for a day hike?' }
  ],
  temperature: 0.7,
  stream: true,
  onStreamChunk: (chunk) => console.log(chunk),
});
```

### 2. Context & State Management

#### `OnDeviceAIProvider` (`features/ai/providers/OnDeviceAIProvider.tsx`)
React context provider managing:
- AI mode selection (cloud/on-device/hybrid)
- Model download state
- Mode persistence via AsyncStorage
- Mode-based routing logic

**Modes:**
- **Cloud**: All requests go to cloud API (default)
- **On-Device**: All requests use local inference
- **Hybrid**: Uses on-device when available, falls back to cloud

### 3. UI Components

#### `OnDeviceAISettings` (`features/ai/components/OnDeviceAISettings.tsx`)
Settings UI for:
- AI mode selection
- Model download/deletion
- Download progress visualization
- Feature information

### 4. Integration Layer

#### `hybridChatIntegration` (`features/ai/lib/hybridChatIntegration.ts`)
Unifies cloud and on-device AI interfaces:
- Message format conversion
- Provider selection logic
- Fallback handling
- Streaming support

## Installation

### 1. Install Dependencies

```bash
cd apps/expo
npm install cactus-react-native react-native-nitro-modules
# or
bun add cactus-react-native react-native-nitro-modules
```

### 2. Platform Setup

#### iOS
```bash
cd ios
pod install
```

Ensure iOS version is 13.0+

#### Android
Ensure:
- API level 21+
- Java 17

### 3. Add Provider to App Root

In `apps/expo/providers/JotaiProvider.tsx` or similar:

```tsx
import { OnDeviceAIProvider } from 'expo-app/features/ai/providers/OnDeviceAIProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <JotaiProvider>
      <OnDeviceAIProvider>
        {/* ... other providers ... */}
        {children}
      </OnDeviceAIProvider>
    </JotaiProvider>
  );
}
```

## Integration with Existing Chat

### Modify `ai-chat.tsx`

Add the hybrid chat hook:

```tsx
import { useHybridChat } from 'expo-app/features/ai/lib/hybridChatIntegration';
import { useOnDeviceAI } from 'expo-app/features/ai/providers/OnDeviceAIProvider';

export default function AIChat() {
  const { isUsingOnDevice, mode } = useHybridChat();
  
  // ... existing code ...
  
  // Add visual indicator
  const aiModeIndicator = isUsingOnDevice ? (
    <View className="flex-row items-center gap-1 px-2 py-1 bg-green-100 rounded">
      <Icon name="smartphone" size={12} color="green" />
      <Text className="text-xs text-green-700">On-Device</Text>
    </View>
  ) : (
    <View className="flex-row items-center gap-1 px-2 py-1 bg-blue-100 rounded">
      <Icon name="cloud" size={12} color="blue" />
      <Text className="text-xs text-blue-700">Cloud</Text>
    </View>
  );
  
  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <AiChatHeader 
              onClear={handleClear}
              rightElement={aiModeIndicator}
            />
          ),
        }}
      />
      {/* ... rest of component ... */}
    </>
  );
}
```

### Add Settings Screen

Create or update a settings screen:

```tsx
import { OnDeviceAISettings } from 'expo-app/features/ai/components/OnDeviceAISettings';

export default function AISettingsScreen() {
  return (
    <ScrollView className="flex-1 p-4 bg-background">
      <OnDeviceAISettings />
    </ScrollView>
  );
}
```

## Environment Configuration

Add to `.env` (optional):

```bash
# Enable on-device AI by default (optional)
EXPO_PUBLIC_ON_DEVICE_AI_ENABLED=true

# Default AI mode (cloud, on-device, hybrid)
EXPO_PUBLIC_DEFAULT_AI_MODE=hybrid

# Model identifier (optional, uses default if not specified)
EXPO_PUBLIC_CACTUS_MODEL_ID=qwen-2.5-600m
```

## Features

### ✅ Implemented in PoC

- [x] On-device AI hook (`useCactusAI`)
- [x] AI mode provider (`OnDeviceAIProvider`)
- [x] Settings UI component
- [x] Model download management
- [x] Mode selection (cloud/on-device/hybrid)
- [x] Hybrid integration layer
- [x] Progress tracking
- [x] Error handling
- [x] State persistence

### 🚧 Not Implemented (Future Work)

- [ ] Actual cactus-react-native integration (currently simulated)
- [ ] Native module verification
- [ ] Model size optimization
- [ ] Multi-model support
- [ ] Model quantization options
- [ ] Batch inference
- [ ] Vision/multimodal support
- [ ] Tool/function calling in on-device mode
- [ ] Performance metrics tracking
- [ ] A/B testing cloud vs on-device

## Performance Expectations

Based on cactus-react-native benchmarks:

| Device | Model | Speed |
|--------|-------|-------|
| Mid-range Android | Qwen3-600m | 20+ tok/sec |
| iPhone 14 Pro | Qwen3-600m | 50+ tok/sec |
| Flagship Android | Qwen3-600m | 75+ tok/sec |

### Model Size
- Qwen3-600m: ~600MB download
- Storage after download: ~600MB
- RAM usage during inference: ~800MB-1GB

## Testing

### Test Model Download
```tsx
const { download, downloadProgress } = useCactusAI();

await download();
console.log('Download complete!');
```

### Test On-Device Inference
```tsx
const { complete, isReady } = useCactusAI();

if (isReady) {
  const result = await complete({
    messages: [{ role: 'user', content: 'Hello!' }],
  });
  console.log(result.response);
}
```

### Test Hybrid Mode
```tsx
const { mode, setMode } = useOnDeviceAI();

await setMode('hybrid');
// App will automatically use on-device when available, cloud as fallback
```

## Troubleshooting

### Module Not Found
If you get errors about missing modules:
1. Ensure dependencies are installed
2. Run `pod install` on iOS
3. Rebuild the app completely

### Model Download Fails
- Check available storage (need 600MB+)
- Verify internet connection
- Check console for error details

### On-Device Inference Slow
- Close other apps to free RAM
- Consider using a smaller model
- Check device specifications

### Fallback Not Working
- Verify cloud API credentials are set
- Check `mode` is set to 'hybrid'
- Review error logs for API issues

## Implementation Status

This is a **Proof of Concept** with simulated behavior. To activate:

1. Install actual `cactus-react-native` package
2. Uncomment native module imports in `useCactusAI.ts`:
   ```ts
   import { CactusLM, type Message } from 'cactus-react-native';
   ```
3. Replace simulation code with actual SDK calls
4. Test on physical devices (required for native modules)

## Next Steps

1. **Complete Installation**: Install packages when build environment is ready
2. **Test on Devices**: Test on real iOS/Android devices
3. **Optimize Models**: Experiment with different model sizes
4. **Performance Tuning**: Measure and optimize inference speed
5. **Production Readiness**:
   - Error recovery strategies
   - Model update mechanism
   - Analytics integration
   - User onboarding flow

## Resources

- [cactus-react-native GitHub](https://github.com/cactus-compute/cactus-react-native)
- [Cactus Compute Docs](https://cactuscompute.com/docs/react-native)
- [Getting Started Guide](https://deepwiki.com/cactus-compute/cactus-react-native/1.1-getting-started)
- [Performance Blog](https://huggingface.co/blog/rshemet/cactus-on-device-inference)

## License

This PoC follows PackRat's existing license.

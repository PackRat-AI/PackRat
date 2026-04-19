# Integration Guide: Adding On-Device AI to Existing Chat

This guide shows how to integrate the on-device AI PoC with the existing `ai-chat.tsx` screen.

## Current Architecture

The existing chat implementation in `apps/expo/app/(app)/ai-chat.tsx` uses:
- `useChat` hook from `@ai-sdk/react`
- Cloud API at `${clientEnvs.EXPO_PUBLIC_API_URL}/api/chat`
- `DefaultChatTransport` for API communication

## Integration Approach

There are two recommended approaches:

### Option 1: Parallel Implementation (Recommended for PoC)

Keep the existing cloud chat working and add on-device as a separate mode.

**Step 1: Add Provider**

In your app root (e.g., `providers/JotaiProvider.tsx`):

```tsx
import { OnDeviceAIProvider } from 'expo-app/features/ai';

export function Providers({ children }) {
  return (
    <JotaiProvider>
      <OnDeviceAIProvider>
        {children}
      </OnDeviceAIProvider>
    </JotaiProvider>
  );
}
```

**Step 2: Modify ai-chat.tsx Header**

Add mode indicator:

```tsx
import { useOnDeviceAI } from 'expo-app/features/ai';

export default function AIChat() {
  const { mode, getEffectiveMode } = useOnDeviceAI();
  const effectiveMode = getEffectiveMode();
  
  // Mode indicator component
  const ModeIndicator = () => {
    if (effectiveMode === 'on-device') {
      return (
        <View className="flex-row items-center gap-1 px-2 py-1 bg-green-100 rounded">
          <Icon name="smartphone" size={12} color="green" />
          <Text className="text-xs text-green-700">On-Device</Text>
        </View>
      );
    }
    return (
      <View className="flex-row items-center gap-1 px-2 py-1 bg-blue-100 rounded">
        <Icon name="cloud" size={12} color="blue" />
        <Text className="text-xs text-blue-700">Cloud</Text>
      </View>
    );
  };
  
  // ... rest of component
  
  return (
    <>
      <Stack.Screen
        options={{
          header: () => (
            <View className="flex-row items-center justify-between p-4">
              <AiChatHeader onClear={handleClear} />
              <ModeIndicator />
            </View>
          ),
        }}
      />
      {/* ... */}
    </>
  );
}
```

**Step 3: Add Settings Link**

In your settings menu, add a link to the AI settings:

```tsx
<TouchableOpacity onPress={() => router.push('/ai-settings')}>
  <View className="flex-row items-center gap-3 p-4">
    <Icon name="cpu" size={20} />
    <Text>On-Device AI Settings</Text>
  </View>
</TouchableOpacity>
```

### Option 2: Full Integration (Production)

For production, you'd want to seamlessly switch between cloud and on-device.

**Step 1: Create Unified Chat Hook**

Create `apps/expo/features/ai/hooks/useUnifiedChat.ts`:

```tsx
import { useChat } from '@ai-sdk/react';
import { useCactusAI } from './useCactusAI';
import { useOnDeviceAI } from '../providers/OnDeviceAIProvider';
import type { UIMessage } from 'ai';

export function useUnifiedChat(config: {
  api: string;
  headers: Record<string, string>;
  body: () => any;
  onError: (error: Error) => void;
  messages: UIMessage[];
}) {
  const { getEffectiveMode } = useOnDeviceAI();
  const cactusAI = useCactusAI();
  
  // Use existing cloud chat
  const cloudChat = useChat({
    transport: new DefaultChatTransport({
      fetch: expoFetch as unknown as typeof globalThis.fetch,
      api: config.api,
      headers: config.headers,
      body: config.body,
    }),
    onError: config.onError,
    messages: config.messages,
  });
  
  // Determine which to use
  const effectiveMode = getEffectiveMode();
  
  if (effectiveMode === 'on-device' && cactusAI.isReady) {
    // Return on-device interface that matches useChat API
    return {
      ...cloudChat, // Spread for compatibility
      messages: cactusAI.messages, // Override with on-device messages
      sendMessage: async (message) => {
        // Convert and send to Cactus
        await cactusAI.complete({
          messages: [...cloudChat.messages, { 
            role: 'user', 
            content: message.text 
          }],
        });
      },
    };
  }
  
  // Use cloud by default
  return cloudChat;
}
```

**Step 2: Update ai-chat.tsx**

Replace `useChat` with `useUnifiedChat`:

```tsx
// Before:
const { messages, setMessages, error, sendMessage, stop, status } = useChat({
  // ... config
});

// After:
const { messages, setMessages, error, sendMessage, stop, status } = useUnifiedChat({
  // ... same config
});
```

## Testing the Integration

### Test Checklist

- [ ] Provider is added to app root
- [ ] Mode indicator appears in chat header
- [ ] Can access AI settings screen
- [ ] Can download model (simulated)
- [ ] Mode switching works (cloud/on-device/hybrid)
- [ ] Settings persist across app restarts
- [ ] Existing cloud chat still works
- [ ] Error states are handled gracefully

### Manual Testing Steps

1. **Install PoC**: Merge this PR
2. **Add Provider**: Update app root with OnDeviceAIProvider
3. **Add Settings Link**: Add link to ai-settings screen
4. **Test Mode Indicator**: Verify it shows in chat
5. **Test Settings**: Try downloading model (simulated)
6. **Test Mode Switch**: Switch between modes
7. **Verify Cloud Still Works**: Ensure existing chat works

## Production Activation

When ready to activate real on-device AI:

1. **Install Packages**:
   ```bash
   cd apps/expo
   bun install  # This will install cactus-react-native
   ```

2. **Uncomment Imports**:
   Follow TODO comments in `useCactusAI.ts`

3. **Test on Device**:
   ```bash
   # iOS
   bun ios
   
   # Android  
   bun android
   ```

4. **Replace Simulation**:
   Remove simulation code, use actual SDK calls

5. **Verify Download**:
   Test actual model download on WiFi

6. **Performance Test**:
   Measure inference speed

7. **Production Deploy**:
   Build and deploy to stores

## Migration Path

### Phase 1: PoC (Current)
- ✅ Add provider and settings
- ✅ Show mode indicator
- ✅ Allow mode switching
- ✅ Simulated functionality

### Phase 2: Beta
- Install actual packages
- Test on real devices
- Gather user feedback
- Monitor performance

### Phase 3: Production
- Full integration with unified hook
- Remove simulation code
- Add analytics
- Production deployment

## Support

For issues or questions:
- See `ON_DEVICE_AI_POC.md` for detailed docs
- Check TODO comments in code
- Review troubleshooting section

## Summary

The PoC is designed to integrate with minimal changes to existing code:
1. Add provider wrapper (1 line change)
2. Add mode indicator (optional UI)
3. Add settings link (optional)

The existing cloud chat continues to work unchanged. When ready to activate on-device AI, follow the TODO comments to replace simulation with real SDK calls.

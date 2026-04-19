# On-Device AI Integration - Quick Start

## Overview

PackRat now includes a Proof of Concept (PoC) for on-device AI inference using [cactus-react-native](https://cactuscompute.com). This allows users to chat with AI completely offline, with their data never leaving their device.

## Quick Setup

> **Note on Import Paths**: The code uses `expo-app` path alias for imports. Ensure this is configured in your `tsconfig.json`:
> ```json
> {
>   "compilerOptions": {
>     "paths": {
>       "expo-app/*": ["./apps/expo/*"]
>     }
>   }
> }
> ```
> Alternatively, you can convert to relative imports if preferred.

### 1. Install Dependencies

```bash
cd apps/expo
bun add cactus-react-native react-native-nitro-modules
```

### 2. Add Provider to App

Edit `apps/expo/providers/JotaiProvider.tsx` (or your root provider):

```tsx
import { OnDeviceAIProvider } from 'expo-app/features/ai';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <JotaiProvider>
      <OnDeviceAIProvider>
        {children}
      </OnDeviceAIProvider>
    </JotaiProvider>
  );
}
```

### 3. Add Settings Screen

The settings screen is already created at `apps/expo/app/(app)/ai-settings.tsx`. 

Add a link to it in your app's settings or navigation menu.

### 4. Test the Integration

```tsx
import { useCactusAI, useOnDeviceAI } from 'expo-app/features/ai';

// In your component
const { mode, setMode } = useOnDeviceAI();
const { download, complete } = useCactusAI();

// Download model
await download();

// Generate response
const result = await complete({
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

## Features

✅ **Offline AI**: Works without internet after model download  
✅ **Private**: Data never leaves the device  
✅ **Fast**: 20-75+ tokens/sec on mobile devices  
✅ **Hybrid Mode**: Auto-fallback to cloud when needed  
✅ **Easy Integration**: Drop-in components and hooks  

## File Structure

```
apps/expo/features/ai/
├── hooks/
│   └── useCactusAI.ts              # Core hook for on-device AI
├── providers/
│   └── OnDeviceAIProvider.tsx      # Context provider for AI mode
├── components/
│   └── OnDeviceAISettings.tsx      # Settings UI component
├── lib/
│   └── hybridChatIntegration.ts    # Integration layer
├── index.ts                         # Exports
└── ON_DEVICE_AI_POC.md             # Detailed documentation
```

## Documentation

See [`apps/expo/features/ai/ON_DEVICE_AI_POC.md`](apps/expo/features/ai/ON_DEVICE_AI_POC.md) for:
- Detailed architecture
- Complete API reference
- Integration examples
- Performance benchmarks
- Troubleshooting guide

## Key Components

### `useCactusAI` Hook
Manages on-device model lifecycle:
- Model download
- Inference execution  
- Progress tracking
- Resource cleanup

### `OnDeviceAIProvider`
Provides context for:
- AI mode selection (cloud/on-device/hybrid)
- Model state management
- Settings persistence

### `OnDeviceAISettings` Component
Ready-to-use UI for:
- Mode selection
- Model management
- Download progress
- Feature information

## Implementation Status

This is a **Proof of Concept** with simulated functionality. The code structure and API are complete, but require:

1. ✅ Dependencies added to `package.json`
2. ⏳ Dependencies installed (`bun install`)
3. ⏳ Native modules verified on real devices
4. ⏳ Simulation code replaced with actual SDK calls

To activate full functionality:
1. Complete dependency installation
2. Uncomment native imports in `useCactusAI.ts`
3. Test on physical iOS/Android devices
4. Replace simulated inference with actual SDK calls

## Next Steps

1. **Install packages** when build environment allows
2. **Test on real devices** (iOS/Android)
3. **Integrate into chat screen** using provided utilities
4. **Gather feedback** from beta users
5. **Optimize model selection** based on device capabilities

## Resources

- [PoC Documentation](apps/expo/features/ai/ON_DEVICE_AI_POC.md)
- [Cactus React Native Docs](https://cactuscompute.com/docs/react-native)
- [GitHub Repository](https://github.com/cactus-compute/cactus-react-native)

---

For questions or issues, please refer to the detailed documentation or create an issue in the repository.

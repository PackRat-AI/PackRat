# Offline AI Feature Documentation

## Overview

The **Offline AI Assistant** is a new feature for the PackRat outdoor app that provides on-device AI capabilities without requiring internet connectivity. This feature uses local LLM inference (via llama.cpp or similar) to deliver trail information, gear recommendations, and safety guidance.

## Key Features

1. **On-Device AI** - Runs locally without internet connection
2. **Trail Q&A** - Get information about trails, conditions, and permits
3. **Gear Recommendations** - Personalized gear suggestions based on your pack
4. **Safety Assistant** - Wilderness safety tips and emergency guidance
5. **Offline-First** - Works completely offline - perfect for remote areas

## Architecture

### Components

```
features/offline-ai/
├── components/
│   └── OfflineAIChat.tsx    # Main chat UI component
├── hooks/
│   └── useOfflineAI.ts      # Main hook for AI functionality
├── lib/
│   └── mock-llm-provider.ts # Mock LLM provider (dev/testing)
├── screens/
│   └── OfflineAIScreen.tsx  # Full screen view
├── types.ts                 # TypeScript type definitions
└── index.ts                 # Public exports
```

### Key Types

- **LLMProvider**: Interface for LLM implementations
- **LLMConfig**: Configuration for the LLM model
- **TrailInfo**: Trail metadata (difficulty, length, permits, hazards)
- **TrailQAContext**: Context for Q&A (trail, pack items, location, weather)
- **ChatMessage**: Chat message structure

## Usage

### Basic Usage

```tsx
import { OfflineAIChat } from '../features/offline-ai';

function MyScreen() {
  return (
    <OfflineAIChat 
      placeholder="Ask about trails, gear, or safety..."
      showModelInfo={true}
    />
  );
}
```

### With Trail Context

```tsx
import { OfflineAIChat } from '../features/offline-ai';
import type { TrailInfo } from '../features/offline-ai';

const trail: TrailInfo = {
  id: 'yosemite',
  name: 'Yosemite Valley',
  location: 'California',
  difficulty: 'moderate',
  length: 'varies',
  elevation: '4,000 ft',
  description: 'Iconic valley with famous granite cliffs',
  highlights: ['Half Dome', 'El Capitan'],
  permits: ['Wilderness permit required'],
  hazards: ['Rockfall', 'Altitude sickness'],
  bestSeasons: ['Spring', 'Fall'],
};

function TrailScreen() {
  return <OfflineAIChat trail={trail} />;
}
```

### Programmatic Usage

```tsx
import { useOfflineAI } from '../features/offline-ai';

function CustomComponent() {
  const { 
    messages, 
    isGenerating, 
    sendMessage, 
    clearMessages 
  } = useOfflineAI({
    config: {
      modelId: 'llama-3.2-1b',
      maxTokens: 512,
      temperature: 0.7,
    },
    onReady: () => console.log('AI ready!'),
    onError: (error) => console.error('AI error:', error),
  });

  const handleAsk = async () => {
    await sendMessage('What gear do I need for this trail?');
  };

  return (
    <View>
      {/* Custom UI */}
    </View>
  );
}
```

## LLM Integration

### Mock Provider (Development)

The mock provider is used for development and testing:

```tsx
import { MockLLMProvider, createLLMProvider } from '../features/offline-ai';

// Using factory
const provider = createLLMProvider('mock');

// Direct usage
const provider = new MockLLMProvider();
await provider.initialize({
  modelId: 'llama-3.2-1b',
  modelPath: './models/llama-3.2-1b-q4_k_m.gguf',
  maxTokens: 512,
  temperature: 0.7,
  contextWindow: 2048,
  gpuLayers: 0,
});
```

### Real LLM Provider (Production)

For production, integrate with a real on-device LLM:

**Options:**
1. **llama.cpp** via `react-native-llama`
2. **Transformers.js** for WebGPU inference
3. **ExLlamaV2** for optimized inference

Example implementation structure:

```tsx
// lib/llama-cpp-provider.ts
export class LlamaCppProvider implements LLMProvider {
  private model: any;
  
  async initialize(config: LLMConfig): Promise<void> {
    // Load model using llama.cpp bindings
  }
  
  async generate(prompt: string, context?: TrailQAContext): Promise<string> {
    // Run inference
  }
  
  isReady(): boolean { /* ... */ }
  getModelInfo(): { name: string; size: string } | null { /* ... */ }
  async dispose(): Promise<void> { /* ... */ }
}
```

## Trail Q&A Prompts

The feature includes predefined prompts for common outdoor questions:

- **Trail Conditions**: Current trail status and recommendations
- **Gear Recommendations**: What to bring based on trail and weather
- **Safety**: Emergency information and precautions
- **Trip Planning**: Route suggestions and permit information

### Example Questions

- "What is the trail difficulty?"
- "What permits do I need?"
- "What gear should I bring?"
- "Are there any hazards?"
- "What is the weather forecast?"
- "How much water do I need?"
- "What first aid supplies do I need?"
- "What wildlife should I be aware of?"

## Testing

Run the unit tests:

```bash
# From project root
bun test

# Or with coverage
bun test:coverage
```

### Test Coverage

- Mock LLM Provider initialization and disposal
- Response generation with various contexts
- Trail-specific Q&A functionality
- Weather and pack item context handling

## Performance Considerations

1. **Model Size**: Use quantized models (Q4_K_M) for smaller footprint
2. **GPU Layers**: Increase `gpuLayers` for faster inference on supported devices
3. **Context Window**: Adjust based on device capabilities
4. **Temperature**: Lower values (0.1-0.3) for more consistent responses

## Future Enhancements

- [ ] Real llama.cpp integration
- [ ] Model download manager
- [ ] Conversation history persistence
- [ ] Voice input/output
- [ ] Image analysis for plant/wildlife identification
- [ ] GPS-integrated trail recommendations

## Differentiation

This feature provides a **competitive advantage** as:

1. **No outdoor apps currently offer offline AI**
2. Works in areas without cell service
3. Saves battery by avoiding network requests
4. Privacy-focused (data stays on device)
5. Always available, even in emergencies

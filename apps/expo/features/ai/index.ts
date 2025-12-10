/**
 * On-Device AI Exports
 * Central export point for on-device AI functionality
 */

// Hooks
export { useCactusAI } from './hooks/useCactusAI';
export type { 
  CactusMessage,
  CactusCompletionParams,
  CactusCompletionResult,
  UseCactusAIOptions,
  UseCactusAIReturn,
} from './hooks/useCactusAI';

// Providers
export { 
  OnDeviceAIProvider, 
  useOnDeviceAI 
} from './providers/OnDeviceAIProvider';
export type { AIMode } from './providers/OnDeviceAIProvider';

// Components
export { OnDeviceAISettings } from './components/OnDeviceAISettings';

// Integration utilities
export { useHybridChat } from './lib/hybridChatIntegration';

// Configuration
export { DEFAULT_MODEL_CONFIG, PERFORMANCE_TIERS, MEMORY_REQUIREMENTS } from './config/modelConfig';

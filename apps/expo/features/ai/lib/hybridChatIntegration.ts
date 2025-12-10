/**
 * On-Device AI Chat Integration
 * This file demonstrates how to integrate on-device AI with the existing chat functionality
 * 
 * Key Integration Points:
 * 1. Check AI mode (cloud, on-device, or hybrid)
 * 2. Use CactusLM for on-device inference
 * 3. Fallback to cloud API when needed
 * 4. Handle streaming from both sources uniformly
 */

import { useCactusAI, type CactusMessage } from 'expo-app/features/ai/hooks/useCactusAI';
import { useOnDeviceAI } from 'expo-app/features/ai/providers/OnDeviceAIProvider';
import type { UIMessage, TextUIPart } from 'ai';

/**
 * Hook that provides unified chat interface for both cloud and on-device AI
 */
export function useHybridChat() {
  const { mode, getEffectiveMode, isModelDownloaded } = useOnDeviceAI();
  const cactusAI = useCactusAI();

  /**
   * Convert UIMessage to CactusMessage format
   */
  const convertToCactusMessages = (messages: UIMessage[]): CactusMessage[] => {
    return messages.map(msg => {
      const textPart = msg.parts.find((p): p is TextUIPart => p.type === 'text');
      return {
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: textPart?.text || '',
      };
    });
  };

  /**
   * Determine which AI provider to use
   */
  const shouldUseOnDevice = (): boolean => {
    const effectiveMode = getEffectiveMode();
    
    if (effectiveMode === 'on-device') {
      return isModelDownloaded && cactusAI.isReady;
    }
    
    return false;
  };

  /**
   * Send a message using the appropriate AI provider
   */
  const sendMessage = async (
    messages: UIMessage[],
    onStream?: (chunk: string) => void
  ): Promise<string> => {
    const useOnDevice = shouldUseOnDevice();

    console.log('[useHybridChat] Using AI mode:', useOnDevice ? 'on-device' : 'cloud');

    if (useOnDevice) {
      // Use on-device AI
      const cactusMessages = convertToCactusMessages(messages);
      
      try {
        const result = await cactusAI.complete({
          messages: cactusMessages,
          temperature: 0.7,
          stream: !!onStream,
          onStreamChunk: onStream,
        });

        return result.response;
      } catch (error) {
        console.error('[useHybridChat] On-device inference failed:', error);
        
        // If in hybrid mode, fallback to cloud
        if (mode === 'hybrid') {
          console.log('[useHybridChat] Falling back to cloud API');
          // TODO: Implement cloud API fallback by calling existing useChat hook from ai-chat.tsx
          // Integration steps:
          // 1. Import useChat from '@ai-sdk/react'
          // 2. Call sendMessage from useChat hook
          // 3. Handle streaming response
          throw new Error('TODO: Fallback to cloud not yet implemented - needs integration with existing useChat hook');
        }
        
        throw error;
      }
    } else {
      // TODO: Use cloud API via existing useChat hook from ai-chat.tsx
      // Integration steps:
      // 1. Extract useChat hook logic to a separate composable
      // 2. Call it here with the messages
      // 3. Return the response
      throw new Error('TODO: Cloud API integration needed - should delegate to existing useChat hook from ai-chat.tsx');
    }
  };

  return {
    sendMessage,
    isUsingOnDevice: shouldUseOnDevice(),
    mode,
    cactusAI,
  };
}

/**
 * Example integration into the existing ai-chat.tsx file:
 * 
 * ```tsx
 * export default function AIChat() {
 *   // ... existing code ...
 *   
 *   const { isUsingOnDevice, mode } = useHybridChat();
 *   
 *   // Show indicator when using on-device mode
 *   const aiModeIndicator = isUsingOnDevice ? (
 *     <View className="flex-row items-center gap-1 px-2 py-1 bg-green-100 rounded">
 *       <Icon name="smartphone" size={12} color="green" />
 *       <Text className="text-xs text-green-700">On-Device</Text>
 *     </View>
 *   ) : null;
 *   
 *   // Add to header
 *   return (
 *     <>
 *       <Stack.Screen
 *         options={{
 *           header: () => (
 *             <AiChatHeader 
 *               onClear={handleClear}
 *               rightElement={aiModeIndicator}
 *             />
 *           ),
 *         }}
 *       />
 *       {/* ... rest of the component ... *\/}
 *     </>
 *   );
 * }
 * ```
 * 
 * For full integration:
 * 1. Wrap the app with OnDeviceAIProvider
 * 2. Add settings screen with OnDeviceAISettings component
 * 3. Modify ai-chat.tsx to use useHybridChat hook
 * 4. Add visual indicators for which mode is being used
 * 5. Handle errors and fallbacks gracefully
 */

export const OnDeviceAIChatIntegrationExample = `
This file provides example code for integrating on-device AI into the existing chat system.

Key components:
- useCactusAI: Hook for managing on-device inference
- useOnDeviceAI: Hook for managing AI mode settings
- useHybridChat: Hook that unifies cloud and on-device AI

Integration steps:
1. Add OnDeviceAIProvider to app root (providers/JotaiProvider.tsx or similar)
2. Modify ai-chat.tsx to use useHybridChat
3. Add OnDeviceAISettings component to settings screen
4. Update chat UI to show which mode is active
5. Test both modes and fallback behavior

See inline comments for specific code examples.
`;

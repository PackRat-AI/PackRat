import type { UIMessage } from '@ai-sdk/react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ChatContext = {
  itemId?: string;
  itemName?: string;
  packId?: string;
  packName?: string;
  contextType: 'item' | 'pack' | 'general';
  location?: string;
};

/**
 * Generates a unique storage key for a chat context
 */
export function getChatStorageKey(context: ChatContext): string {
  const { contextType, itemId, packId } = context;

  if (contextType === 'item' && itemId) {
    return `chat:item:${itemId}`;
  }

  if (contextType === 'pack' && packId) {
    return `chat:pack:${packId}`;
  }

  return 'chat:general';
}

/**
 * Validates that the data is an array of UIMessage objects
 */
function isValidMessageArray(data: unknown): data is UIMessage[] {
  if (!Array.isArray(data)) return false;

  const validRoles = ['user', 'assistant', 'system'];

  return data.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'id' in item &&
      typeof item.id === 'string' &&
      'role' in item &&
      typeof item.role === 'string' &&
      validRoles.includes(item.role) &&
      'parts' in item &&
      Array.isArray(item.parts) &&
      item.parts.every(
        (part: unknown) =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          typeof part.type === 'string',
      ),
  );
}

/**
 * Loads persisted chat messages from AsyncStorage
 */
export async function loadChatMessages(context: ChatContext): Promise<UIMessage[] | null> {
  try {
    const key = getChatStorageKey(context);
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (!isValidMessageArray(parsed)) {
      console.warn('Invalid chat message format in storage, clearing');
      await AsyncStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Failed to load chat messages:', error);
    return null;
  }
}

/**
 * Saves chat messages to AsyncStorage
 */
export async function saveChatMessages(context: ChatContext, messages: UIMessage[]): Promise<void> {
  try {
    const key = getChatStorageKey(context);
    await AsyncStorage.setItem(key, JSON.stringify(messages));
  } catch (error) {
    console.error('Failed to save chat messages:', error);
  }
}

/**
 * Clears chat messages for a specific context
 */
export async function clearChatMessages(context: ChatContext): Promise<void> {
  try {
    const key = getChatStorageKey(context);
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear chat messages:', error);
  }
}

import type { UIMessage } from '@ai-sdk/react';

export interface ChatMessage extends UIMessage {
  sender: string;
  text: string;
  date: string;
  time: string;
}

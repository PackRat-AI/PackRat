import type { Message } from '@ai-sdk/react';

export interface ChatMessage extends Message {
  sender: string;
  text: string;
  date: string;
  time: string;
}

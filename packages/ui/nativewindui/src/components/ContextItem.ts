import { View } from 'react-native';

export interface ContextItem {
  id: string;
  title: string;
  icon?: React.ReactNode;
  destructive?: boolean;
}

export function createContextItem(id: string, title: string, options?: {
  icon?: React.ReactNode;
  destructive?: boolean;
}): ContextItem {
  return { id, title, ...options };
}

import { clientEnvs } from '@packrat/env/expo-client';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import type { Comment, Post } from '../types';

export function buildPostImageUrl(imageKey: string): string {
  return `${clientEnvs.EXPO_PUBLIC_R2_PUBLIC_URL}/${imageKey}`;
}

export function formatAuthorName(entity: Post | Comment): string {
  if (!entity.author) return 'Unknown';
  const { firstName, lastName } = entity.author;
  if (firstName && lastName) return `${firstName} ${lastName}`;
  if (firstName) return firstName;
  if (lastName) return lastName;
  return 'User';
}

/**
 * @deprecated Use getRelativeTime from 'expo-app/lib/utils/getRelativeTime' directly.
 */
export const formatRelativeDate = getRelativeTime;

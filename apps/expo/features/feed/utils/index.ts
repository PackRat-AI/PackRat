import { clientEnvs } from '@packrat/env/expo-client';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import type { Comment, Post } from '../types';

export * from './commentThreads';
export * from './errorCopy';
export * from './liveComments';
export * from './mentions';
export * from './photoAspect';
export * from './share';

const ABSOLUTE_URL = /^(https?|file):/i;

export function buildPostImageUrl(imageKey: string): string {
  if (ABSOLUTE_URL.test(imageKey)) return imageKey;
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

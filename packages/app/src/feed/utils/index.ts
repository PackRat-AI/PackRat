import type { Comment, Post } from '@packrat/app/feed';
import { getRelativeTime } from '@packrat/app/lib/utils/getRelativeTime';
import { clientEnvs } from '@packrat/env/expo-client';

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
 * @deprecated Use getRelativeTime from '@packrat/app/lib/utils/getRelativeTime' directly.
 */
export const formatRelativeDate = getRelativeTime;

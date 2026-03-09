import { clientEnvs } from 'expo-app/env/clientEnvs';
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

export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

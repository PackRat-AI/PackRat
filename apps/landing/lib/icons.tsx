import type { LucideIcon as LucideIconType } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export const LucideIcon = (name: string): LucideIconType => {
  const icons = LucideIcons;
  return (icons[name as keyof typeof icons] as LucideIconType) || LucideIcons.FileQuestion;
};

import * as LucideIcons from 'lucide-react';

export const LucideIcon = (name: string) => {
  const icons = LucideIcons;

  return icons[name as keyof typeof icons] || icons.FileQuestion;
};

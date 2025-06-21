import * as LucideIcons from "lucide-react";

export const LucideIcon = (name: string) => {
  const icons: Record<string, any> = LucideIcons;

  return icons[name] || icons["FileQuestion"];
};

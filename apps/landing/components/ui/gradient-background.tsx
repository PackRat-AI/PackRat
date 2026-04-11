import { cn } from 'landing-app/lib/utils';

interface GradientBackgroundProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'tertiary' | 'mesh';
}

export default function GradientBackground({
  className,
  variant = 'primary',
}: GradientBackgroundProps) {
  const gradientClass = {
    primary:
      'bg-gradient-to-br from-primary/10 dark:from-primary/20 via-primary/5 dark:via-primary/10 to-transparent',
    secondary:
      'bg-gradient-to-tr from-secondary/10 dark:from-secondary/20 via-secondary/5 dark:via-secondary/10 to-transparent',
    tertiary:
      'bg-gradient-to-r from-purple-500/10 dark:from-purple-500/20 via-blue-500/5 dark:via-blue-500/10 to-cyan-500/10 dark:to-cyan-500/20',
    mesh: 'bg-gradient-mesh opacity-30 dark:opacity-20',
  }[variant];

  if (!gradientClass) return null;

  return <div className={cn('absolute inset-0 -z-10', gradientClass, className)} />;
}

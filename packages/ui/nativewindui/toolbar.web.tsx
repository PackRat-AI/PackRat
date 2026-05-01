import type { ReactNode } from 'react';
import { Button } from './button.web';
import { cn } from './cn.web';
import { Icon } from './icon.web';

type ToolbarProps = {
  leftView?: ReactNode;
  rightView?: ReactNode;
  className?: string;
  // Native-only — ignored on web
  iosHint?: string;
  iosBlurIntensity?: number;
};

export function Toolbar({ leftView, rightView, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between border-t border-border bg-card/80 backdrop-blur-sm px-4 py-2',
        className,
      )}
    >
      <div className="flex items-center gap-2">{leftView}</div>
      <div className="flex items-center gap-2">{rightView}</div>
    </div>
  );
}

type IconProp = { name: string; size?: number; color?: string; className?: string };

type ToolbarButtonProps = {
  icon: IconProp;
  className?: string;
  onPress?: () => void;
  disabled?: boolean;
  // Native-only — ignored on web
  androidRootClassName?: string;
};

export function ToolbarIcon({ icon, className, onPress, disabled }: ToolbarButtonProps) {
  return (
    <Button
      size="icon"
      variant="plain"
      className={cn('h-11 w-11 rounded-lg', className)}
      onPress={onPress}
      disabled={disabled}
    >
      <Icon {...icon} />
    </Button>
  );
}

export function ToolbarCTA({ icon, className, onPress, disabled }: ToolbarButtonProps) {
  return (
    <Button
      size="icon"
      variant="tonal"
      className={cn('h-11 w-11 rounded-lg', className)}
      onPress={onPress}
      disabled={disabled}
    >
      <Icon {...icon} />
    </Button>
  );
}

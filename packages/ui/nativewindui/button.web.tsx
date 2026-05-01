import type { ButtonProps as ShadcnButtonProps } from '@packrat/web-ui/components/button';
import { Button as ShadcnButton } from '@packrat/web-ui/components/button';
import * as React from 'react';

type NativeVariant = 'primary' | 'secondary' | 'tonal' | 'plain';
type NativeSize = 'sm' | 'md' | 'lg' | 'icon';
type ShadcnVariant = 'default' | 'secondary' | 'outline' | 'ghost';
type ShadcnSize = 'sm' | 'default' | 'lg' | 'icon';

const VARIANT_MAP = {
  primary: 'default',
  secondary: 'secondary',
  tonal: 'outline',
  plain: 'ghost',
} as const satisfies Record<NativeVariant, ShadcnVariant>;

const SIZE_MAP = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  icon: 'icon',
} as const satisfies Record<NativeSize, ShadcnSize>;

export interface ButtonProps {
  variant?: NativeVariant;
  size?: NativeSize;
  onPress?: () => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  testID?: string;
  androidRootClassName?: string;
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      onPress,
      children,
      className,
      disabled,
      testID,
      androidRootClassName: _androidRootClassName,
      asChild,
      ...rest
    },
    ref,
  ) => {
    const shadcnVariant = VARIANT_MAP[variant] ?? 'default';
    const shadcnSize = SIZE_MAP[size] ?? 'default';

    return (
      <ShadcnButton
        ref={ref}
        variant={shadcnVariant}
        size={shadcnSize}
        onClick={onPress}
        className={className}
        disabled={disabled}
        data-testid={testID}
        asChild={asChild}
        {...(rest as Partial<ShadcnButtonProps>)}
      >
        {children}
      </ShadcnButton>
    );
  },
);
Button.displayName = 'Button';

export const buttonVariants = () => '';
export const buttonTextVariants = () => '';

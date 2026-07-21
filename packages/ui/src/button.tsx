import { Button as ExpoButton, Host } from '@expo/ui';
import { cssInterop } from 'nativewind';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { shouldMatchContents } from './lib/text-class-parser';

cssInterop(Host, { className: 'style' });

type ButtonVariant = 'filled' | 'outlined' | 'text';

type ButtonProps = {
  children?: ReactNode;
  label?: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function Button({
  children,
  label,
  onPress,
  variant = 'filled',
  disabled,
  className,
  style,
  testID,
}: ButtonProps) {
  return (
    // matchContents only when className has no explicit sizing (flex-1, w-*, h-*, ...) — those
    // need Yoga to size the box; everything else needs matchContents or it collapses to zero
    // height (Host has no other size signal without a native-content-driven size).
    <Host
      matchContents={shouldMatchContents(className)}
      className={className}
      style={style}
      testID={testID}
    >
      <ExpoButton label={label} onPress={onPress} variant={variant} disabled={disabled}>
        {children}
      </ExpoButton>
    </Host>
  );
}

export { Button };
export type { ButtonProps, ButtonVariant };

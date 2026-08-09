import { cn } from 'expo-app/lib/cn';
import { cssInterop } from 'nativewind';
import type { ComponentProps } from 'react';
import { UITextView } from 'react-native-uitextview';

// selectable/uiTextView text-selection has no @expo/ui equivalent on any platform (Universal,
// SwiftUI, and Jetpack Compose Text all lack a selection-mode prop) — this wraps
// react-native-uitextview directly, the same underlying native module the old nativewindui
// package's Text used for this one feature. Kept minimal: real call sites pass no variant/color,
// just plain selectable text, so this doesn't replicate Text's full variant system.

cssInterop(UITextView, { className: 'style' });

type SelectableTextProps = ComponentProps<typeof UITextView>;

function SelectableText({ className, ...props }: SelectableTextProps) {
  return (
    <UITextView className={cn('text-foreground text-[17px] leading-6', className)} {...props} />
  );
}

export { SelectableText };

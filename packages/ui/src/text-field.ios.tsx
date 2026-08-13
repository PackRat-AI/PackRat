import { useAugmentedRef, useControllableState } from '@rn-primitives/hooks';
import { cn } from 'expo-app/lib/cn';
import type * as React from 'react';
import { Pressable, TextInput, type TextInputProps, View } from 'react-native';
import { Text } from './text';

// Plain RN composition — TextField never needed a native Host bridge. iOS keeps the old
// package's simple (non-Material, no floating-label animation) design — matches
// text-field.tsx's prop surface so callers see one API regardless of platform.

type TextFieldRef = React.Ref<TextInput>;

type TextFieldProps = TextInputProps & {
  ref?: TextFieldRef;
  children?: React.ReactNode;
  leftView?: React.ReactNode;
  rightView?: React.ReactNode;
  label?: string;
  labelClassName?: string;
  containerClassName?: string;
  containerTestID?: string;
  containerAccessibilityLabel?: string;
  errorMessage?: string;
  // Accepted for prop-surface parity with text-field.tsx (Android) — no effect on iOS, the
  // old package's iOS TextField never had a Material variant either.
  materialVariant?: 'outlined' | 'filled';
  materialRingColor?: string;
  materialHideActionIcons?: boolean;
};

function TextField({
  ref,
  value: valueProp,
  onChangeText: onChangeTextProp,
  defaultValue: defaultValueProp,
  editable,
  className,
  leftView,
  rightView,
  label,
  labelClassName,
  containerClassName,
  containerTestID,
  containerAccessibilityLabel,
  accessibilityHint,
  errorMessage,
  ...props
}: TextFieldProps) {
  const inputRef = useAugmentedRef({ ref: ref ?? null, methods: { focus, blur, clear } });

  const [value = '', onChangeText] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValueProp ?? valueProp ?? '',
    onChange: onChangeTextProp,
  });

  function focus() {
    inputRef.current?.focus();
  }

  function blur() {
    inputRef.current?.blur();
  }

  function clear() {
    onChangeText('');
  }

  return (
    <Pressable
      testID={containerTestID}
      accessibilityLabel={containerAccessibilityLabel}
      accessibilityHint={accessibilityHint ?? errorMessage}
      accessibilityRole="none"
      className={cn(editable === false && 'opacity-50', containerClassName)}
      disabled={editable === false}
      onPress={focus}
    >
      {!!label && (
        <View className={cn('flex-row pt-2', !leftView ? 'pl-1.5' : 'pl-2')}>
          {leftView}
          <Text className={cn('text-muted-foreground pl-1', !!leftView && 'pl-2', labelClassName)}>
            {label}
          </Text>
        </View>
      )}
      <View className="flex-row">
        {!!leftView && !label && leftView}
        <TextInput
          ref={inputRef}
          editable={editable}
          className={cn('text-foreground flex-1 px-2.5 py-3 text-[17px]', className)}
          onChangeText={onChangeText}
          value={value}
          clearButtonMode="while-editing"
          accessibilityHint={accessibilityHint ?? errorMessage}
          {...props}
          // After the spread so testID (which arrives via props) can seed it. XCTest only
          // resolves an element it can name, so a bare testID leaves the input untypeable
          // for automation; an explicit accessibilityLabel still wins.
          accessibilityLabel={props.accessibilityLabel ?? props.testID}
        />
        {rightView}
      </View>
    </Pressable>
  );
}

export { TextField };
export type { TextFieldProps, TextFieldRef };

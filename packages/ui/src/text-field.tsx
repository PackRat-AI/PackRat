import { useAugmentedRef, useControllableState } from '@rn-primitives/hooks';
import { cva } from 'class-variance-authority';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import {
  type BlurEvent,
  type FocusEvent,
  Pressable,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';

// Plain RN composition — TextField never needed a native Host bridge (RN TextInput +
// Pressable/View/Reanimated), so it's ported directly rather than routed through @expo/ui.
// This is the base/default file (Android + web) — Metro picks text-field.ios.tsx on iOS,
// matching the old package's platform split exactly (no visual change on either platform).
// This file's Material-style floating label (materialVariant/materialRingColor/
// materialHideActionIcons) only ever applied here, never on iOS.

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
  materialVariant?: 'outlined' | 'filled';
  materialRingColor?: string;
  materialHideActionIcons?: boolean;
};

function TextField({
  ref,
  value: valueProp,
  defaultValue: defaultValueProp,
  onChangeText: onChangeTextProp,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  placeholder,
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
  materialVariant = 'outlined',
  materialRingColor,
  materialHideActionIcons,
  ...props
}: TextFieldProps) {
  const inputRef = useAugmentedRef({ ref: ref ?? null, methods: { focus, blur, clear } });
  const [isFocused, setIsFocused] = React.useState(false);

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

  function onFocus(e: FocusEvent) {
    setIsFocused(true);
    onFocusProp?.(e);
  }

  function onBlur(e: BlurEvent) {
    setIsFocused(false);
    onBlurProp?.(e);
  }

  return (
    <Pressable
      testID={containerTestID}
      accessibilityLabel={containerAccessibilityLabel}
      accessibilityHint={accessibilityHint ?? errorMessage}
      accessibilityRole="none"
      className={rootVariants({
        variant: materialVariant,
        state: getInputState({ isFocused, hasError: !!errorMessage, editable }),
        className: containerClassName,
      })}
      style={materialRingColor ? { borderColor: materialRingColor } : undefined}
      disabled={editable === false}
      onPress={focus}
    >
      <View
        className={innerRootVariants({
          variant: materialVariant,
          state: getInputState({ isFocused, hasError: !!errorMessage, editable }),
        })}
        style={materialRingColor && isFocused ? { borderColor: materialRingColor } : undefined}
      >
        {leftView}
        <FilledWrapper>
          {!!label && (
            <MaterialLabel
              materialVariant={materialVariant}
              isFocused={isFocused}
              value={value}
              materialLabel={label}
              hasLeftView={!!leftView}
              className={labelClassName}
              hasError={!!errorMessage}
            />
          )}
          <TextInput
            ref={inputRef}
            editable={editable}
            className={cn(
              'text-foreground flex-1 rounded py-3 pl-2.5 text-[17px] dark:placeholder:text-white/30',
              materialVariant === 'filled' && !!label && 'pb-2 pt-5',
              className,
            )}
            placeholder={isFocused || !label ? placeholder : ''}
            onFocus={onFocus}
            onBlur={onBlur}
            onChangeText={onChangeText}
            value={value}
            accessibilityHint={accessibilityHint ?? errorMessage}
            {...props}
            // After the spread so testID (which arrives via props) can seed it — keeps the
            // input reachable by automation, matching text-field.ios.tsx.
            accessibilityLabel={props.accessibilityLabel ?? props.testID}
          />
        </FilledWrapper>
        {!materialHideActionIcons && (
          <>
            {errorMessage ? (
              <MaterialErrorIcon />
            ) : (
              !!value && isFocused && <MaterialClearIcon clearText={clear} editable={editable} />
            )}
          </>
        )}
        {rightView}
      </View>
    </Pressable>
  );
}

type InputState = 'idle' | 'focused' | 'error' | 'disabled';

function getInputState(args: {
  isFocused: boolean;
  hasError?: boolean;
  editable?: boolean;
}): InputState {
  if (args.editable === false) return 'disabled';
  if (args.hasError) return 'error';
  if (args.isFocused) return 'focused';
  return 'idle';
}

const rootVariants = cva('relative rounded-[5px]', {
  variants: {
    variant: { outlined: 'border', filled: 'border-b rounded-b-none' },
    state: {
      idle: 'border-transparent',
      error: 'border-destructive',
      focused: 'border-primary',
      disabled: 'opacity-50',
    },
  },
  defaultVariants: { variant: 'outlined', state: 'idle' },
});

const innerRootVariants = cva('flex-row rounded', {
  variants: {
    variant: { outlined: 'border border-border', filled: 'border-b bg-border rounded-b-none' },
    state: {
      idle: 'border-foreground/30',
      error: 'border-destructive',
      focused: 'border-primary',
      disabled: 'border-foreground/30',
    },
  },
  defaultVariants: { variant: 'outlined', state: 'idle' },
});

function FilledWrapper(props: ViewProps) {
  return <View className="relative flex-1 flex-row" {...props} />;
}

type MaterialLabelProps = {
  isFocused: boolean;
  value: string;
  materialLabel: string;
  hasLeftView: boolean;
  hasError?: boolean;
  className?: string;
  materialVariant: 'outlined' | 'filled';
};

const DEFAULT_TEXT_FIELD_HEIGHT = 56;

function MaterialLabel(props: MaterialLabelProps) {
  const { colors } = useColorScheme();
  const isLifted = props.isFocused || !!props.value;
  const isLiftedDerived = useDerivedValue(() => isLifted);
  const hasLeftViewDerived = useDerivedValue(() => props.hasLeftView);
  const variantDerived = useDerivedValue(() => props.materialVariant);
  const animatedRootStyle = useAnimatedStyle(() => {
    const style: ViewStyle = { position: 'absolute', alignSelf: 'center' };
    if (variantDerived.value === 'outlined') {
      style.paddingLeft = withTiming(hasLeftViewDerived.value && isLiftedDerived.value ? 0 : 12, {
        duration: 200,
      });
      style.transform = [
        {
          translateY: withTiming(isLiftedDerived.value ? -DEFAULT_TEXT_FIELD_HEIGHT / 2.2 : 0, {
            duration: 200,
          }),
        },
        {
          translateX: withTiming(hasLeftViewDerived.value && isLiftedDerived.value ? -12 : 0, {
            duration: 200,
          }),
        },
      ];
    }
    if (variantDerived.value === 'filled') {
      style.paddingLeft = 8;
      style.transform = [
        {
          translateY: withTiming(isLiftedDerived.value ? -DEFAULT_TEXT_FIELD_HEIGHT / 3.75 : 0, {
            duration: 200,
          }),
        },
        { translateX: 0 },
      ];
    }
    return style;
  });
  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      fontSize: withTiming(isLiftedDerived.value ? 12 : 17, { duration: 200 }),
      backgroundColor:
        variantDerived.value === 'outlined'
          ? withTiming(colors.background, { duration: 200 })
          : // Old theme had a dedicated `border` color; this app's theme doesn't — `card` is the
            // closest surface color used for filled-variant containers elsewhere.
            colors.card,
    };
  });
  return (
    <Animated.View style={animatedRootStyle} pointerEvents="none">
      <Animated.Text
        className={cn(
          'bg-card/0 text-foreground/70 rounded',
          isLifted && 'px-0.5',
          isLifted && props.materialVariant === 'outlined' && 'bg-background',
          props.isFocused && 'text-primary/80 dark:text-primary',
          props.hasError && 'text-destructive dark:text-destructive',
          props.className,
        )}
        style={animatedTextStyle}
      >
        {props.materialLabel}
      </Animated.Text>
    </Animated.View>
  );
}

function MaterialClearIcon(props: { editable?: boolean; clearText: () => void }) {
  const { colors } = useColorScheme();
  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <Pressable
        disabled={props.editable === false}
        className="flex-1 justify-center px-2 active:opacity-65"
        onPress={props.clearText}
      >
        <Icon color={colors.grey2} name="close-circle" />
      </Pressable>
    </Animated.View>
  );
}

function MaterialErrorIcon() {
  return (
    <Animated.View
      pointerEvents="none"
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      className="justify-center pr-2"
    >
      <Icon name="alert-circle-outline" color="#EF4444" />
    </Animated.View>
  );
}

export { TextField };
export type { TextFieldProps, TextFieldRef };

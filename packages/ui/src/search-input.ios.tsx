import { useAugmentedRef, useControllableState } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { type FocusEvent, Pressable, TextInput, View, type ViewStyle } from 'react-native';
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import type { SearchInputProps, SearchInputRef } from './search-input-types';
import { Text } from './text';

// Plain RN composition — SearchInput never needed a Host bridge on iOS either. This is the
// animated cancel-button design (search-input.tsx is the Android/default variant).

// Add as class when possible: https://github.com/marklawlor/nativewind/issues/522
const BORDER_CURVE: ViewStyle = { borderCurve: 'continuous' };

function SearchInput({
  ref,
  value: valueProp,
  onChangeText: onChangeTextProp,
  onFocus: onFocusProp,
  placeholder = 'Search...',
  cancelText = 'Cancel',
  containerClassName,
  iconContainerClassName,
  containerTestID,
  containerAccessibilityLabel,
  className,
  iconColor,
  ...props
}: SearchInputProps) {
  const { colors } = useColorScheme();
  const inputRef = useAugmentedRef({ ref: ref as SearchInputRef, methods: { focus, blur, clear } });
  const [showCancel, setShowCancel] = React.useState(false);
  const showCancelDerivedValue = useDerivedValue(() => showCancel, [showCancel]);
  const animatedRef = useAnimatedRef();

  const [value = '', onChangeText] = useControllableState({
    prop: valueProp,
    defaultProp: valueProp ?? '',
    onChange: onChangeTextProp,
  });

  const rootStyle = useAnimatedStyle(() => {
    if (_WORKLET) {
      const measurement = measure(animatedRef);
      return {
        paddingRight: showCancelDerivedValue.value
          ? withTiming(measurement?.width ?? cancelText.length * 11.2)
          : withTiming(0),
      };
    }
    return {
      paddingRight: showCancelDerivedValue.value
        ? withTiming(cancelText.length * 11.2)
        : withTiming(0),
    };
  });
  const cancelButtonStyle = useAnimatedStyle(() => {
    if (_WORKLET) {
      const measurement = measure(animatedRef);
      return {
        position: 'absolute',
        right: 0,
        opacity: showCancelDerivedValue.value ? withTiming(1) : withTiming(0),
        transform: [
          {
            translateX: showCancelDerivedValue.value
              ? withTiming(0)
              : measurement?.width
                ? withTiming(measurement.width)
                : cancelText.length * 11.2,
          },
        ],
      };
    }
    return {
      position: 'absolute',
      right: 0,
      opacity: showCancelDerivedValue.value ? withTiming(1) : withTiming(0),
      transform: [
        {
          translateX: showCancelDerivedValue.value
            ? withTiming(0)
            : withTiming(cancelText.length * 11.2),
        },
      ],
    };
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
    setShowCancel(true);
    onFocusProp?.(e);
  }

  return (
    <Animated.View
      testID={containerTestID}
      accessibilityLabel={containerAccessibilityLabel}
      className="flex-row items-center"
      style={rootStyle}
    >
      <Animated.View
        style={BORDER_CURVE}
        className={cn('bg-card flex-1 flex-row rounded-lg', containerClassName)}
      >
        <View
          className={cn(
            'absolute bottom-0 left-0 top-0 z-50 justify-center pl-1.5',
            iconContainerClassName,
          )}
        >
          <Icon color={iconColor ?? colors.grey3} name="magnify" size={20} />
        </View>
        <TextInput
          ref={inputRef}
          placeholder={placeholder}
          className={cn(
            !showCancel && 'active:bg-muted/5 dark:active:bg-muted/20',
            'text-foreground flex-1 rounded-lg py-2 pl-8 pr-1 text-[17px]',
            className,
          )}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          clearButtonMode="while-editing"
          role="searchbox"
          {...props}
        />
      </Animated.View>
      <Animated.View
        ref={animatedRef}
        style={cancelButtonStyle}
        pointerEvents={!showCancel ? 'none' : 'auto'}
      >
        <Pressable
          onPress={() => {
            onChangeText('');
            inputRef.current?.blur();
            setShowCancel(false);
          }}
          disabled={!showCancel}
          pointerEvents={!showCancel ? 'none' : 'auto'}
          className="flex-1 justify-center active:opacity-50"
        >
          <Text className="text-primary px-2">{cancelText}</Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

export { SearchInput };

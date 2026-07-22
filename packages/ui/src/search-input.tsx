import { useAugmentedRef, useControllableState } from '@rn-primitives/hooks';
import { Icon } from 'expo-app/components/Icon';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Button } from './button';
import type { SearchInputProps, SearchInputRef } from './search-input-types';

// Plain RN composition — SearchInput never needed a Host bridge, ported directly. This is the
// Android/default design (search-input.ios.tsx has iOS's animated cancel-button variant).

function SearchInput({
  ref,
  value: valueProp,
  onChangeText: onChangeTextProp,
  placeholder = 'Search...',
  cancelText: _cancelText = 'Cancel',
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
  const [value = '', onChangeText] = useControllableState({
    prop: valueProp,
    defaultProp: valueProp ?? '',
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
    <Button
      testID={containerTestID}
      accessibilityLabel={containerAccessibilityLabel}
      variant="plain"
      className={cn(
        'android:gap-0 android:h-14 bg-card flex-row items-center rounded-full px-2',
        containerClassName,
      )}
      onPress={focus}
    >
      <View className={cn('p-2', iconContainerClassName)} pointerEvents="none">
        <Icon color={iconColor ?? colors.grey2} name="magnify" />
      </View>

      <View className="flex-1">
        <TextInput
          ref={inputRef}
          placeholder={placeholder}
          className={cn('text-foreground flex-1 rounded-r-full p-2 text-[17px]', className)}
          placeholderTextColor={colors.grey2}
          value={value}
          onChangeText={onChangeText}
          role="searchbox"
          {...props}
        />
      </View>
      {!!value && (
        <Animated.View entering={FadeIn} exiting={FadeOut.duration(150)}>
          <Pressable className="p-2" onPress={clear}>
            <Icon color={colors.grey2} name="close" />
          </Pressable>
        </Animated.View>
      )}
    </Button>
  );
}

export { SearchInput };

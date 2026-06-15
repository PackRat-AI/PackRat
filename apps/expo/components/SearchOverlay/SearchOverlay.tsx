import { Portal } from '@rn-primitives/portal';
import { Icon } from 'expo-app/components/Icon';
import { SearchInput } from 'expo-app/components/SearchInput';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useId, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutRight,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { SearchOverlayProps } from './types';

export function SearchOverlay({
  placeholder,
  value,
  onChangeText,
  children,
  androidHeaderRightActions,
}: SearchOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const id = useId();

  const close = useCallback(() => {
    setIsOpen(false);
    onChangeText('');
  }, [onChangeText]);

  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isOpen) {
        close();
        return true;
      }
      return false;
    });
    return () => handler.remove();
  }, [isOpen, close]);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerRightRow}>
              {androidHeaderRightActions}
              <Pressable onPress={() => setIsOpen(true)} hitSlop={8}>
                <Icon name="magnify" size={24} color={colors.foreground} />
              </Pressable>
            </View>
          ),
        }}
      />
      {isOpen && (
        <Portal name={`search-overlay:${id}`}>
          <Animated.View exiting={FadeOut} style={StyleSheet.absoluteFill}>
            <View
              style={[styles.header, { paddingTop: insets.top + 6 }]}
              className="bg-background relative overflow-hidden"
            >
              <Animated.View
                entering={pillEntering}
                exiting={pillExiting}
                className="bg-muted/25 dark:bg-card absolute bottom-2.5 left-4 right-4 h-14 rounded-full"
              />
              <View style={styles.inputRow}>
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <Pressable onPress={close} hitSlop={8} className="p-2">
                    <Icon name="arrow-left" size={22} color={colors.foreground} />
                  </Pressable>
                </Animated.View>
                <Animated.View
                  entering={FadeInRight}
                  exiting={FadeOutRight}
                  style={styles.inputFlex}
                >
                  <SearchInput
                    autoFocus
                    placeholder={placeholder ?? 'Search...'}
                    value={value}
                    onChangeText={onChangeText}
                    onBlur={() => {
                      if (value.length === 0) close();
                    }}
                    autoCapitalize="none"
                    returnKeyType="search"
                    style={[styles.input, { color: colors.foreground }]}
                    placeholderTextColor={colors.grey2}
                  />
                </Animated.View>
                {!!value && (
                  <Animated.View entering={FadeIn} exiting={FadeOut}>
                    <Pressable onPress={() => onChangeText('')} hitSlop={8} className="p-2">
                      <Icon name="close" size={20} color={colors.foreground} />
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </View>
            <Animated.View entering={FadeInUp} style={styles.content} className="bg-background">
              {children}
            </Animated.View>
          </Animated.View>
        </Portal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  header: {},
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inputRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  inputFlex: { flex: 1 },
  input: { flex: 1, fontSize: 17, paddingHorizontal: 8 },
  content: { flex: 1 },
});

const pillEntering = () => {
  'worklet';
  return {
    initialValues: { transform: [{ scale: 1 }] },
    animations: { transform: [{ scale: withTiming(3, { duration: 400 }) }] },
  };
};

const pillExiting = () => {
  'worklet';
  return {
    initialValues: { transform: [{ scale: 3 }], opacity: 1 },
    animations: { transform: [{ scale: withTiming(1) }], opacity: withTiming(0) },
  };
};

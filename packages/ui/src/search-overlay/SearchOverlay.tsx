import { Portal } from '@rn-primitives/portal';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useId, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInRight,
  FadeInUp,
  FadeOut,
  FadeOutRight,
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
              <Pressable onPress={() => setIsOpen(true)} style={styles.searchButton}>
                <Icon name="magnify" size={28} color={colors.foreground} />
              </Pressable>
            </View>
          ),
        }}
      />
      {isOpen && (
        <Portal name={`search-overlay:${id}`}>
          <Animated.View exiting={FadeOut} style={[StyleSheet.absoluteFill, styles.portal]}>
            <View
              style={[
                styles.header,
                { paddingTop: insets.top + 6, backgroundColor: colors.background },
              ]}
            >
              <View style={styles.inputRow}>
                <Animated.View entering={FadeIn} exiting={FadeOut}>
                  <Pressable onPress={close} hitSlop={8} style={styles.backButton}>
                    <Icon name="arrow-left" size={26} color={colors.grey3} />
                  </Pressable>
                </Animated.View>
                <Animated.View
                  entering={FadeInRight}
                  exiting={FadeOutRight}
                  style={styles.inputFlex}
                >
                  <TextInput
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
                    <Pressable
                      onPress={() => onChangeText('')}
                      hitSlop={8}
                      style={styles.clearButton}
                    >
                      <Icon name="close" size={26} color={colors.grey3} />
                    </Pressable>
                  </Animated.View>
                )}
              </View>
            </View>
            <Animated.View
              entering={FadeInUp}
              style={[styles.content, { backgroundColor: colors.card }]}
            >
              {children}
            </Animated.View>
          </Animated.View>
        </Portal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  portal: { backgroundColor: 'transparent' },
  header: {},
  headerRightRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  searchButton: { padding: 14 },
  inputRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: { padding: 12 },
  inputFlex: { flex: 1 },
  input: { flex: 1, fontSize: 20, paddingHorizontal: 8 },
  clearButton: { padding: 8 },
  content: { flex: 1 },
});

import { Stack } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import type { SearchOverlayProps } from './types';

export function SearchOverlay({ placeholder, value, onChangeText, children }: SearchOverlayProps) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: placeholder ?? 'Search...',
            hideWhenScrolling: false,
            onChangeText: (e) => onChangeText(e.nativeEvent.text),
            onFocus: () => setIsFocused(true),
            onBlur: () => setIsFocused(false),
          },
        }}
      />
      {(isFocused || value.length > 0) && (
        <Animated.View
          entering={FadeIn.duration(200)}
          style={StyleSheet.absoluteFill}
          className="bg-background z-50"
        >
          <SafeAreaView style={{ flex: 1 }}>{children}</SafeAreaView>
        </Animated.View>
      )}
    </>
  );
}

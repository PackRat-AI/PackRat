import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { ReactNode } from 'react';
import { Platform, SafeAreaView, View } from 'react-native';

export function LargeTitleHeaderSearchContentContainer({ children }: { children: ReactNode }) {
  const { colors } = useColorScheme();
  const Container = Platform.OS === 'ios' ? SafeAreaView : View;
  return <Container style={{ flex: 1, backgroundColor: colors.background }}>{children}</Container>;
}

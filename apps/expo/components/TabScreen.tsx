import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { Platform, StyleSheet, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  type SafeAreaViewProps,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

interface TabScreenProps extends SafeAreaViewProps {}

export const TabScreen: React.FC<TabScreenProps> = ({ children, style, ...rest }) => {
  const insets = useSafeAreaInsets();

  const TAB_BAR_INSET = Platform.OS === 'android' ? 80 : 0;

  const containerStyle: ViewStyle = {
    flex: 1,
    ...(Platform.OS === 'ios' ? { paddingTop: insets.top } : {}),
    paddingBottom: TAB_BAR_INSET,
    ...(StyleSheet.flatten(style) as ViewStyle),
  };

  return (
    <SafeAreaView style={containerStyle} {...rest} edges={['bottom', 'left', 'right']}>
      <StatusBar />
      {children}
    </SafeAreaView>
  );
};

export default TabScreen;

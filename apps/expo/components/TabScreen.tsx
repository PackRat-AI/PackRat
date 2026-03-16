import { useColorScheme } from '@packrat/ui/nativewindui';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { Platform, type ViewStyle } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface TabScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const TabScreen: React.FC<TabScreenProps> = ({ children, style, ...rest }) => {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();

  const TAB_BAR_INSET = Platform.OS === 'android' ? 80 : 0;

  const containerStyle: ViewStyle = {
    flex: 1,
    ...(Platform.OS === 'ios' ? { paddingTop: insets.top } : {}),
    paddingBottom: TAB_BAR_INSET,
    ...style,
  };

  return (
    <SafeAreaView style={containerStyle} {...rest} edges={['bottom', 'left', 'right']}>
      <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      />
      {children}
    </SafeAreaView>
  );
};

export default TabScreen;

import { useColorScheme } from '@packrat/ui/nativewindui';
import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Screen: React.FC<ScreenProps> = ({ children, style, ...rest }) => {
  const { colorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();

  const TAB_BAR_INSET = Platform.OS === 'android' ? 64 : 0;
  const PADDING_BOTTOM = 16;

  const containerStyle: ViewStyle = {
    flex: 1,
    paddingBottom: insets.bottom + PADDING_BOTTOM + TAB_BAR_INSET,
    ...style,
  };

  return (
    <View style={containerStyle} {...rest}>
      <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      />
      {children}
    </View>
  );
};

export default Screen;

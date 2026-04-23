import { StatusBar } from 'expo-status-bar';
import type React from 'react';
import { Platform, View } from 'react-native';

interface TabScreenProps {
  children: React.ReactNode;
}

export const TabScreen: React.FC<TabScreenProps> = ({ children }) => {
  const ANDROID_TAB_BAR_INSET = 80;

  if (Platform.OS === 'ios')
    return (
      <>
        <StatusBar />
        {children}
      </>
    );

  return (
    <View
      style={{
        paddingBottom: ANDROID_TAB_BAR_INSET,
        flex: 1,
      }}
    >
      {children}
    </View>
  );
};

export default TabScreen;

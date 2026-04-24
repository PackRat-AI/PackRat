import { Platform, View } from 'react-native';

export const AndroidTabBarInsetFix = () => {
  const ANDROID_TAB_BAR_INSET = 80;

  if (Platform.OS === 'ios') return null;

  return <View style={{ height: ANDROID_TAB_BAR_INSET }} />;
};

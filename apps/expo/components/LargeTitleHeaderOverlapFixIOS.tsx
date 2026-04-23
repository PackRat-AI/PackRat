import { Platform, SafeAreaView, View } from 'react-native';

export const LargeTitleHeaderOverlapFixIOS = () => {
  if (Platform.OS === 'android') return null;

  return (
    <SafeAreaView>
      <View className="h-[0.5]" />
    </SafeAreaView>
  );
};

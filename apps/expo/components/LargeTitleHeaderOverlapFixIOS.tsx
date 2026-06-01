import { Platform, SafeAreaView, View } from 'react-native';

export const LargeTitleHeaderOverlapFixIOS = ({ children }: { children?: React.ReactNode }) => {
  if (Platform.OS === 'android') {
    if (!children) {
      return null;
    } else {
      return children;
    }
  }

  return (
    <SafeAreaView {...(children ? { className: 'flex-1 bg-background' } : {})}>
      {children}
      {!children && <View className="h-[0.5]" />}
    </SafeAreaView>
  );
};

import { Platform, SafeAreaView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const LargeTitleHeaderOverlapFixIOS = ({ children }: { children?: React.ReactNode }) => {
  if (Platform.OS === 'android') {
    if (!children) {
      return null;
    } else {
      return children;
    }
  }

  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView
      {...(children
        ? { className: 'flex-1 bg-background', style: { paddingTop: insets.top } }
        : {})}
    >
      {children}
      {!children && <View className="h-[0.5]" />}
    </SafeAreaView>
  );
};

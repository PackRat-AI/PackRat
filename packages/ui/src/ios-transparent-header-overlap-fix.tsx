import type { ReactNode } from 'react';
import { Platform, SafeAreaView, View } from 'react-native';

export function IosTransparentHeaderOverlapFix({ children }: { children?: ReactNode }) {
  if (Platform.OS === 'android') {
    if (!children) return null;
    return <>{children}</>;
  }
  return (
    <SafeAreaView {...(children ? { className: 'flex-1 bg-background' } : {})}>
      {children}
      {!children && <View className="h-[0.5]" />}
    </SafeAreaView>
  );
}

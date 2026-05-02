import { useColorScheme } from '@packrat/ui/nativewindui';
import { Platform, SafeAreaView, View } from 'react-native';

export const LargeTitleHeaderSearchContentContainer = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { colors } = useColorScheme();

  const Container = Platform.OS === 'ios' ? SafeAreaView : View;

  return <Container style={{ flex: 1, backgroundColor: colors.background }}>{children}</Container>;
};

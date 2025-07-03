import { useColorScheme } from '~/lib/hooks/useColorScheme';
import { WelcomeConsentScreen } from '~/screens/ConsentWelcomeScreen';

export default function ModalScreen() {
  const { colors, colorScheme } = useColorScheme();
  return (
    <>
      {/* <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      /> */}
      <WelcomeConsentScreen />
    </>
  );
}

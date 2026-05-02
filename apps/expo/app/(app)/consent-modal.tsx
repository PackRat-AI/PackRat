// import { useColorScheme } from '@packrat/app/lib/hooks/useColorScheme';
import { WelcomeConsentScreen } from '@packrat/app/screens/ConsentWelcomeScreen';

export default function ModalScreen() {
  // const { colors, colorScheme } = useColorScheme();
  return (
    <>
      {/* <StatusBar
        style={Platform.OS === 'ios' ? 'light' : colorScheme === 'dark' ? 'light' : 'dark'}
      /> */}
      <WelcomeConsentScreen />
    </>
  );
}

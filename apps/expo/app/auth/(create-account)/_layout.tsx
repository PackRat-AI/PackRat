import { Stack } from 'expo-router';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';

export default function CreateAccountLayout() {
  const { t } = useTranslation();
  
  return (
    <>
      <Stack.Screen options={{ title: t('auth.createAccount') }} />
      <Stack screenOptions={SCREEN_OPTIONS} />
    </>
  );
}

const SCREEN_OPTIONS = {
  headerShown: false,
} as const;

import { Button, Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router, Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function AuthLayout() {
  const { t } = useTranslation();

  const CREATE_ACCOUNT_MODAL_OPTIONS = {
    presentation: 'modal',
    headerShown: Platform.OS === 'ios',
    headerShadowVisible: false,
    headerLeft() {
      return (
        <Button
          variant="plain"
          className="ios:px-0"
          onPress={() => {
            router.back();
          }}
        >
          <Text className="text-primary">{t('common.cancel')}</Text>
        </Button>
      );
    },
  } as const;

  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(login)" options={LOGIN_MODAL_OPTIONS} />
      <Stack.Screen name="(create-account)" options={CREATE_ACCOUNT_MODAL_OPTIONS} />
    </Stack>
  );
}

const SCREEN_OPTIONS = {
  headerShown: false,
} as const;

const LOGIN_MODAL_OPTIONS = {
  presentation: 'modal',
  headerShown: false,
} as const;

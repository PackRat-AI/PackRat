import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Stack } from 'expo-router';

export default function WildlifeLayout() {
  const { t } = useTranslation();

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="identify"
        options={{
          title: t('wildlife.identify'),
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          title: t('wildlife.speciesDetail'),
        }}
      />
    </Stack>
  );
}

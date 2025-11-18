import { Stack } from 'expo-router';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';

export default function LocationsLayout() {
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
        name="search"
        options={{
          title: t('weather.addLocation'),
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="preview"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: false,
        }}
      />
    </Stack>
  );
}

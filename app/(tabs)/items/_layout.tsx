import { Stack } from 'expo-router';

export default function ItemsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My Items' }} />
    </Stack>
  );
}

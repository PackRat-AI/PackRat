import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { AiChatHeader } from 'expo-app/components/ai-chatHeader';
import { ThemeToggle } from 'expo-app/components/ThemeToggle';
import { useAuthInit } from 'expo-app/features/auth/hooks/useAuthInit';
import { getPackDetailOptions } from 'expo-app/features/packs/utils/getPackDetailOptions';
import { getPackItemDetailOptions } from 'expo-app/features/packs/utils/getPackItemDetailOptions';
import 'expo-dev-client';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function AppLayout() {
  const isLoading = useAuthInit();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }
  return (
    <Stack screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="(tabs)" options={TABS_OPTIONS} />
      <Stack.Screen name="modal" options={MODAL_OPTIONS} />
      <Stack.Screen name="consent-modal" options={CONSENT_MODAL_OPTIONS} />
      <Stack.Screen
        name="pack/[id]/index"
        options={({ route }) => getPackDetailOptions((route.params as { id: string })?.id)}
      />
      <Stack.Screen name="pack/[id]/edit" options={PACK_EDIT_OPTIONS} />
      <Stack.Screen name="pack/new" options={PACK_NEW_OPTIONS} />
      <Stack.Screen
        name="item/[id]/index"
        options={({ route }) => getPackItemDetailOptions({ route })}
      />
      <Stack.Screen name="item/[id]/edit" options={ITEM_EDIT_OPTIONS} />
      <Stack.Screen name="item/new" options={ITEM_NEW_OPTIONS} />
      <Stack.Screen name="catalog/add-to-pack/index" options={PACK_SELECTION_OPTIONS} />
      <Stack.Screen
        name="catalog/add-to-pack/details"
        options={CATALOG_ADD_TO_PACK_ITEM_DETAILS_OPTIONS}
      />
      <Stack.Screen name="ai-chat" options={AI_CHAT_OPTIONS} />
      <Stack.Screen name="catalog/index" options={CATALOG_LIST_OPTIONS} />
      <Stack.Screen name="catalog/[id]" options={CATALOG_ITEM_DETAIL_OPTIONS} />
      <Stack.Screen name="weather" options={{ headerShown: false }} />

      <Stack.Screen
        name="current-pack"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="recent-packs"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="pack-stats/[id]"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="weight-analysis"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="pack-categories/[id]"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="upcoming-trips"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="weather-alerts"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="trail-conditions"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="gear-inventory"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="shopping-list"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="shared-packs"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="guides/index"
        options={{
          title: 'Guides',
          headerLargeTitle: true,
        }}
      />
      <Stack.Screen
        name="guides/[id]"
        options={{
          title: 'Guide',
        }}
      />
      <Stack.Screen
        name="pack-templates/index"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="pack-templates/new"
        options={{
          headerTitle: 'Create New Pack Template',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="pack-templates/[id]/index"
        options={{
          headerTitle: 'Pack Template Details',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="templateItem/new"
        options={{
          headerTitle: 'Create Template item',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="templateItem/[id]/edit"
        options={{
          headerTitle: 'Edit Template Item',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="templateItem/[id]/index"
        options={{
          headerTitle: 'Template item details',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
}

const SCREEN_OPTIONS = {
  animation: 'ios_from_right', // for android
} as const;

const TABS_OPTIONS = {
  title: '',
  headerShown: false,
} as const;

// MODALS
const MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
  title: 'Settings',
  headerRight: () => <ThemeToggle />,
} as const;

const CONSENT_MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
} as const;

const PACK_NEW_OPTIONS = {
  title: 'Create New Pack',
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
} as const;

const ITEM_NEW_OPTIONS = {
  title: 'Create New Item',
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
} as const;

const AI_CHAT_OPTIONS = {
  title: 'AI Chat',
  header: () => <AiChatHeader />,
  animation: 'fade_from_bottom', // for android
} as const;

const PACK_SELECTION_OPTIONS = {
  title: 'Select Pack',
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
} as const;

const CATALOG_ADD_TO_PACK_ITEM_DETAILS_OPTIONS = {
  title: 'Item Details',
  animation: 'fade_from_bottom', // for android
} as const;

const PACK_EDIT_OPTIONS = {
  title: 'Edit Pack',
  presentation: 'modal',
  animation: 'slide_from_bottom',
} as const;

const ITEM_EDIT_OPTIONS = {
  title: 'Edit Item',
} as const;

const CATALOG_LIST_OPTIONS = {
  title: 'Gear Catalog',
  headerLargeTitle: true,
} as const;

const CATALOG_ITEM_DETAIL_OPTIONS = {
  title: 'Catalog Item',
} as const;

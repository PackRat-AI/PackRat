import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { ThemeToggle } from 'expo-app/components/ThemeToggle';
import { needsReauthAtom } from 'expo-app/features/auth/atoms/authAtoms';
import { useAuthInit } from 'expo-app/features/auth/hooks/useAuthInit';
import { getPackTemplateDetailOptions } from 'expo-app/features/pack-templates/utils/getPackTemplateDetailOptions';
import { getPackTemplateItemDetailOptions } from 'expo-app/features/pack-templates/utils/getPackTemplateItemDetailOptions';
import SyncBanner from 'expo-app/features/packs/components/SyncBanner';
import { getPackDetailOptions } from 'expo-app/features/packs/utils/getPackDetailOptions';
import { getPackItemDetailOptions } from 'expo-app/features/packs/utils/getPackItemDetailOptions';
import { getTripDetailOptions } from 'expo-app/features/trips/utils/getTripDetailOptions';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import type { TranslationFunction } from 'expo-app/lib/i18n/types';
import 'expo-dev-client';
import { Stack } from 'expo-router';
import { useAtomValue } from 'jotai';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function AppLayout() {
  const isLoading = useAuthInit();
  const { t } = useTranslation();
  const needsReauth = useAtomValue(needsReauthAtom);
  const insets = useSafeAreaInsets();

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <>
      {needsReauth && (
        <View className="z-50" style={{ marginTop: insets.top, marginBottom: -(insets.top + 10) }}>
          <SyncBanner title={t('auth.syncPaused')} isReAuthentication />
        </View>
      )}
      <Stack screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="(tabs)" options={TABS_OPTIONS} />
        <Stack.Screen name="modal" options={getModalOptions(t)} />
        <Stack.Screen name="consent-modal" options={CONSENT_MODAL_OPTIONS} />
        <Stack.Screen
          name="pack/[id]/index"
          options={({ route }) => getPackDetailOptions((route.params as { id: string })?.id)}
        />
        <Stack.Screen name="pack/[id]/edit" options={getPackEditOptions(t)} />
        <Stack.Screen name="pack/new" options={getPackNewOptions(t)} />
        <Stack.Screen name="trip/location-search" options={getTripLocationSearchOptions(t)} />

        <Stack.Screen
          name="trip/[id]/index"
          options={({ route }) => getTripDetailOptions((route.params as { id: string })?.id)}
        />
        <Stack.Screen name="trip/[id]/edit" options={getTripEditOptions(t)} />
        <Stack.Screen name="trip/new" options={getTripNewOptions(t)} />

        <Stack.Screen
          name="item/[id]/index"
          options={({ route }) => getPackItemDetailOptions({ route })}
        />
        <Stack.Screen name="item/[id]/edit" options={getItemEditOptions(t)} />
        <Stack.Screen name="item/new" options={getItemNewOptions(t)} />
        <Stack.Screen name="catalog/add-to-pack/index" options={getPackSelectionOptions(t)} />
        <Stack.Screen
          name="catalog/add-to-pack/details"
          options={getCatalogAddToPackItemDetailsOptions(t)}
        />
        <Stack.Screen name="ai-chat" />
        <Stack.Screen name="catalog/index" options={getCatalogListOptions(t)} />
        <Stack.Screen name="catalog/[id]" options={getCatalogItemDetailOptions(t)} />
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
          options={({ route }) =>
            getPackTemplateDetailOptions((route.params as { id: string })?.id)
          }
        />
        <Stack.Screen
          name="pack-templates/[id]/edit"
          options={{
            headerTitle: 'Edit Pack Template',
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="templateItem/new"
          options={{
            headerTitle: 'Create Template Item',
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
          options={({ route }) =>
            getPackTemplateItemDetailOptions((route.params as { id: string })?.id)
          }
        />
      </Stack>
    </>
  );
}

const SCREEN_OPTIONS = {
  animation: 'ios_from_right', // for android
} as const;

const TABS_OPTIONS = {
  title: '',
  headerShown: false,
} as const;

// MODALS - These functions accept translation function t
const getModalOptions = (t: TranslationFunction) =>
  ({
    presentation: 'modal',
    animation: 'fade_from_bottom', // for android
    title: t('profile.settings'),
    headerRight: () => <ThemeToggle />,
  }) as const;

const getTripNewOptions = (t: TranslationFunction) =>
  ({
    title: t('trips.createTrip'),
    presentation: 'modal',
    animation: 'slide_from_bottom',
  }) as const;

const getTripEditOptions = (t: TranslationFunction) =>
  ({
    title: t('packs.editPack'),
    presentation: 'modal',
    animation: 'slide_from_bottom',
  }) as const;

const getTripLocationSearchOptions = (t: TranslationFunction) =>
  ({
    title: t('location.searchLocation'),
    presentation: 'modal',
    animation: 'slide_from_bottom',
  }) as const;

const CONSENT_MODAL_OPTIONS = {
  presentation: 'modal',
  animation: 'fade_from_bottom', // for android
} as const;

const getPackNewOptions = (t: TranslationFunction) =>
  ({
    title: t('packs.createPack'),
    presentation: 'modal',
    animation: 'fade_from_bottom', // for android
  }) as const;

const getItemNewOptions = (t: TranslationFunction) =>
  ({
    title: t('items.itemName'),
    presentation: 'modal',
    animation: 'fade_from_bottom', // for android
  }) as const;

const getPackSelectionOptions = (t: TranslationFunction) =>
  ({
    title: t('packs.packName'),
    presentation: 'modal',
    animation: 'fade_from_bottom', // for android
  }) as const;

const getCatalogAddToPackItemDetailsOptions = (t: TranslationFunction) =>
  ({
    title: t('items.itemDetails'),
    animation: 'fade_from_bottom', // for android
  }) as const;

const getPackEditOptions = (t: TranslationFunction) =>
  ({
    title: t('packs.editPack'),
    presentation: 'modal',
    animation: 'slide_from_bottom',
  }) as const;

const getItemEditOptions = (t: TranslationFunction) =>
  ({
    title: t('common.edit'),
  }) as const;

const getCatalogListOptions = (t: TranslationFunction) =>
  ({
    title: t('catalog.itemsCatalog'),
    headerLargeTitle: true,
  }) as const;

const getCatalogItemDetailOptions = (t: TranslationFunction) =>
  ({
    title: t('items.itemDetails'),
  }) as const;

import { use$ } from '@legendapp/state/react';
import { ActivityIndicator } from '@packrat/ui/nativewindui';
import { ThemeToggle } from 'expo-app/components/ThemeToggle';
import {
  isLoadingAtom,
  isSignOutRedirectingAtom,
  needsReauthAtom,
  suppressSignOutNavAtom,
} from 'expo-app/features/auth/atoms/authAtoms';
import { useAuthInit } from 'expo-app/features/auth/hooks/useAuthInit';
import { isAuthed } from 'expo-app/features/auth/store';
import { getPackTemplateDetailOptions } from 'expo-app/features/pack-templates/utils/getPackTemplateDetailOptions';
import { getPackTemplateItemDetailOptions } from 'expo-app/features/pack-templates/utils/getPackTemplateItemDetailOptions';
import SyncBanner from 'expo-app/features/packs/components/SyncBanner';
import { getPackDetailOptions } from 'expo-app/features/packs/utils/getPackDetailOptions';
import { getPackItemDetailOptions } from 'expo-app/features/packs/utils/getPackItemDetailOptions';
import { useRevenueCatUser } from 'expo-app/features/purchases';
import { getTripDetailOptions } from 'expo-app/features/trips/utils/getTripDetailOptions';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import type { TranslationFunction } from 'expo-app/lib/i18n/types';
import 'expo-app/lib/devClient';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { type Href, router, Stack } from 'expo-router';
import { useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export default function AppLayout() {
  const isLoading = useAuthInit();
  const isAuthedValue = use$(isAuthed);
  useRevenueCatUser();
  const { t } = useTranslation();
  const needsReauth = useAtomValue(needsReauthAtom);
  const isLoadingGlobal = useAtomValue(isLoadingAtom);
  const isSignOutRedirecting = useAtomValue(isSignOutRedirectingAtom);
  const suppressSignOutNav = useAtomValue(suppressSignOutNavAtom);
  const insets = useSafeAreaInsets();
  // Latches true once we dispatch router.replace('/auth') on sign-out.
  // Keeps the spinner rendered until AppLayout unmounts so that
  // auth/index.tsx resetting isLoadingAtom=false never causes AppLayout
  // to re-render its Stack mid-transition. If the Stack re-initialized
  // while the root navigator was still committing the replace, it would
  // re-register with React Navigation and override the in-flight navigation,
  // landing the user back on the Trips/Profile screen instead of auth.
  const hasNavigatedToAuthRef = useRef(false);

  useEffect(() => {
    // suppressSignOutNav is true while profile/handleSignOut is showing the
    // post-sign-out prompt; skip auto-navigation until the user picks an option.
    if (isSignOutRedirecting && isLoadingGlobal && !isAuthedValue && !suppressSignOutNav) {
      hasNavigatedToAuthRef.current = true;
      // safe-cast: '/auth' is a compile-time string literal recognised by expo-router
      router.replace('/auth' as Href);
    }
  }, [isSignOutRedirecting, isLoadingGlobal, isAuthedValue, suppressSignOutNav]);

  // If the user has re-authenticated while AppLayout stayed mounted (Expo Router
  // keeps the (app) screen in the stack during the auth transition), clear the
  // sign-out latch so the spinner doesn't stay on indefinitely.
  if (isAuthedValue && hasNavigatedToAuthRef.current) {
    hasNavigatedToAuthRef.current = false;
  }

  // Show spinner when: (a) auth initialising on cold start, OR (b) a sign-out
  // redirect is in progress and the user is no longer authenticated.
  // Generic isLoadingAtom also covers sign-in/profile updates; do not use it to
  // unmount this Stack or React Navigation's linking container can resolve after
  // unmount and warn about state updates on unmounted components.
  // hasNavigatedToAuthRef keeps the spinner until AppLayout actually unmounts
  // after the router.replace('/auth') transition completes.
  if (
    isLoading ||
    (isSignOutRedirecting && isLoadingGlobal && !isAuthedValue) ||
    hasNavigatedToAuthRef.current
  ) {
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
        <Stack.Screen name="settings/index" options={getSettingsOptions(t)} />
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
        <Stack.Screen name="catalog/[id]" options={getCatalogItemDetailOptions(t)} />
        <Stack.Screen
          name="weather/search"
          options={{
            title: t('weather.addLocation'),
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="weather/preview" />
        <Stack.Screen
          name="weather/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="weather/geo"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          name="current-pack/[id]"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="upcoming-trips" />
        <Stack.Screen
          name="recent-packs"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="pack-stats/[id]"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="weight-analysis/[id]"
          options={{
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="pack-categories/[id]"
          options={{
            presentation: 'card',
          }}
        />
        <Stack.Screen
          name="weather-alerts"
          options={{
            ...getAppBarOptions(),
            // Navigator-level header default so early loading states still show
            // the proper large-title header. The screen's own <Stack.Screen>
            // overrides this with the translated title once content mounts.
            title: 'Weather Alerts',
            presentation: 'card',
            animation: 'default',
          }}
        />
        <Stack.Screen
          name="weather-alert-preferences"
          options={{
            ...getAppBarOptions(),
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="trail-conditions"
          options={{
            presentation: 'card',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="gear-inventory"
          options={{
            presentation: 'card',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="shopping-list"
          options={{
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="shared-packs"
          options={{
            ...getAppBarOptions(),
            // Navigator-level header default so early loading states still show
            // the proper large-title header. The screen's own <Stack.Screen>
            // overrides this with the translated title once content mounts.
            title: 'Shared Packs',
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="guides/index"
          options={{
            ...getAppBarOptions(),
            title: 'Guides',
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
            ...getAppBarOptions(),
            title: 'Pack Templates',
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
        <Stack.Screen
          name="paywall"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
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

const getSettingsOptions = (t: TranslationFunction) =>
  ({
    title: t('profile.settings'),
    headerLargeTitle: true,
    headerRight: () => <ThemeToggle />,
  }) as const;

const getTripNewOptions = (t: TranslationFunction) => ({
  title: t('trips.createTrip'),
  presentation: 'modal' as const,
  animation: 'slide_from_bottom' as const,
});

const getTripEditOptions = (t: TranslationFunction) =>
  ({
    title: t('trips.editTrip'),
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

const getPackNewOptions = (t: TranslationFunction) => ({
  title: t('packs.createPack'),
  presentation: 'modal' as const,
  animation: 'fade_from_bottom' as const,
});

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

const getCatalogItemDetailOptions = (t: TranslationFunction) =>
  ({
    title: t('items.itemDetails'),
  }) as const;

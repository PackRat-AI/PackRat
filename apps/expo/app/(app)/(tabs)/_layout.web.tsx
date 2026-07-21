import { useFeatureFlags } from 'expo-app/hooks/useFeatureFlags';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Tabs } from 'expo-router';

/**
 * Web version of the tabs layout.
 * Replaces NativeTabs (expo-router/unstable-native-tabs) with standard Expo Router Tabs.
 * NativeTabs uses native UITabBarController and cannot run on web.
 * Metro automatically picks this file over _layout.tsx for web builds.
 */
export default function TabLayout() {
  const { t } = useTranslation();
  const featureFlags = useFeatureFlags();

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="(home)" options={{ title: t('navigation.dashboard') }} />
      <Tabs.Screen name="packs" options={{ title: t('navigation.packs') }} />
      <Tabs.Screen
        name="feed"
        options={{ title: t('navigation.feed'), href: featureFlags.enableFeed ? undefined : null }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: t('navigation.trips'),
          href: featureFlags.enableTrips ? undefined : null,
        }}
      />
      <Tabs.Screen name="catalog" options={{ title: t('navigation.catalog') }} />
      <Tabs.Screen name="profile" options={{ title: t('navigation.profile') }} />
    </Tabs>
  );
}

import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { ErrorState } from 'expo-app/components/ErrorState';
import { Icon } from 'expo-app/components/Icon';
import { useAuthState } from 'expo-app/features/auth/hooks/useAuthState';
import { TrailConditionReportRow } from 'expo-app/features/trail-conditions/components/TrailConditionReportRow';
import { useTrailConditions } from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useHeaderSearchBar } from 'expo-app/lib/hooks/useHeaderSearchBar';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

/**
 * The trail conditions list — `TrailConditionsListView` in `TrailConditionsView.swift`.
 *
 * Follows the Swift screen's shape: a searchable list of community reports, pull to refresh,
 * tap a row for detail, and a `+` in the app bar to submit one — the same toolbar placement the
 * Swift screen uses, and the convention the weather and feed screens already follow here. The previous Expo screen filtered by
 * trail surface instead of searching; search matches iOS and is the more useful filter, since it
 * spans trail name, region and notes.
 */
export default function TrailConditionsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { isAuthenticated } = useAuthState();
  const enableTrailConditions = useFeatureFlag('enableTrailConditions');

  const {
    filteredReports,
    reports,
    searchText,
    setSearchText,
    isLoading,
    isRefreshing,
    isSignedOut,
    error,
    refetch,
  } = useTrailConditions();

  // Native Material search bar in the app bar — the Android counterpart of SwiftUI's
  // `.searchable`. react-native-screens installs a real `CustomSearchView` as the toolbar's
  // action view on Android, so this is the platform control, not a styled TextInput.
  const search = useHeaderSearchBar({ placeholder: t('trailConditions.searchPlaceholder') });
  useEffect(() => {
    setSearchText(search);
  }, [search, setSearchText]);

  if (!enableTrailConditions) return null;

  const hasReports = reports.length > 0;
  const isSearching = searchText.trim().length > 0;

  const renderContent = () => {
    // Trail reports are a server-backed, community feature, so there is nothing to show a
    // signed-out user. Say so and offer sign-in rather than spinning on a query that is disabled
    // and will never resolve. Mirrors `GuestLimitedView` on the Swift screen.
    if (isSignedOut) {
      return (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="hiking" size={40} color={colors.grey} />
          <Text variant="heading" className="text-center font-semibold">
            {t('trailConditions.signedOutTitle')}
          </Text>
          <Text variant="subhead" className="text-center text-muted-foreground" wrap>
            {t('trailConditions.signedOutMessage')}
          </Text>
          <Pressable
            onPress={() => router.push('/auth')}
            accessibilityRole="button"
            className="mt-2 rounded-xl bg-primary px-5 py-3 active:opacity-90"
          >
            <Text variant="body" className="font-semibold text-white">
              {t('auth.signIn')}
            </Text>
          </Pressable>
        </View>
      );
    }

    if (isLoading && !hasReports) {
      return (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator />
        </View>
      );
    }

    if (error && !hasReports) {
      return (
        <ErrorState
          title={t('trailConditions.loadErrorTitle')}
          text={t('trailConditions.loadError')}
          onRetry={() => refetch()}
          className="py-12"
        />
      );
    }

    return (
      <FlatList
        data={filteredReports}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TrailConditionReportRow
            report={item}
            onPress={() => router.push(`/trail-conditions/${item.id}`)}
          />
        )}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="pb-6"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={refetch}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            isSearching={isSearching}
            onSubmit={() => router.push('/trail-conditions/submit')}
          />
        }
      />
    );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: t('trailConditions.title'),
          headerRight: isAuthenticated
            ? () => (
                <Pressable
                  onPress={() => router.push('/trail-conditions/submit')}
                  testID={testIds.trailConditions.submitReportBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('trailConditions.reportConditionsTitle')}
                  style={{ padding: 14 }}
                >
                  <Icon name="plus" size={28} color={colors.foreground} />
                </Pressable>
              )
            : undefined,
        }}
      />

      {renderContent()}
    </View>
  );
}

/**
 * Mirrors the Swift screen's two empty states: nothing reported yet (with the submit action), and
 * a search that matched nothing (no action — the fix is to change the query).
 */
function EmptyState({ isSearching, onSubmit }: { isSearching: boolean; onSubmit: () => void }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();

  return (
    <View className="items-center gap-3 px-8 py-16">
      <Icon name={isSearching ? 'magnify' : 'hiking'} size={40} color={colors.grey} />
      <Text variant="heading" className="text-center font-semibold">
        {isSearching ? t('trailConditions.noResultsTitle') : t('trailConditions.noReportsTitle')}
      </Text>
      <Text variant="subhead" className="text-center text-muted-foreground" wrap>
        {isSearching ? t('trailConditions.noResults') : t('trailConditions.noReports')}
      </Text>
      {isSearching ? null : (
        <Pressable
          onPress={onSubmit}
          testID={testIds.trailConditions.emptyStateSubmitBtn}
          accessibilityRole="button"
          className="mt-2 rounded-xl bg-primary px-5 py-3 active:opacity-90"
        >
          <Text variant="body" className="font-semibold text-white">
            {t('trailConditions.submitReport')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useAuthState } from 'expo-app/features/auth/hooks/useAuthState';
import type { Trip } from 'expo-app/features/trips/types';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTripConditions } from '../hooks/useTrailConditions';
import { TrailConditionReportRow } from './TrailConditionReportRow';

/**
 * What hikers are finding on the trip's trail, or on trails near its destination when the trip
 * names none — `TripTrailConditionsSection` in the Swift app. Part of the trip, never an alert.
 * Shows nothing for a trip with no destination: there's no place to have conditions about.
 */
export function TripTrailConditionsSection({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { isAuthenticated } = useAuthState();
  const enabled = useFeatureFlag('enableTrailConditions');
  const hasPlace = trip.trailId != null || trip.location != null;
  const query = useTripConditions({ tripId: trip.id, enabled: enabled && hasPlace });

  if (!enabled || !isAuthenticated || !hasPlace) return null;

  const subtitle = trip.trailId
    ? trip.trailName
    : trip.location?.name
      ? t('trailConditions.tripNearbySubtitle', { place: trip.location.name.split(',')[0] })
      : null;

  const writeReport = () =>
    router.push({
      pathname: '/trail-conditions/submit',
      params: {
        tripId: trip.id,
        ...(trip.trailId ? { trailId: trip.trailId, trailName: trip.trailName ?? '' } : {}),
      },
    });

  const renderContent = () => {
    const data = query.data;
    if (data) {
      if (data.reports.length === 0) {
        return (
          <View className="flex-row items-start gap-3 rounded-xl bg-card p-4">
            <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon name="hiking" size={18} color={colors.primary} />
            </View>
            <View className="flex-1 items-start gap-1">
              <Text variant="callout" className="font-semibold">
                {t('trailConditions.noReportsOnTrailTitle')}
              </Text>
              <Text variant="caption1" className="text-muted-foreground" wrap>
                {trip.trailId
                  ? t('trailConditions.tripNoReportsTrail')
                  : t('trailConditions.tripNoReportsNearby')}
              </Text>
              <Button
                variant="outlined"
                onPress={writeReport}
                testID={testIds.trailConditions.tripSectionWriteReportBtn}
                className="mt-1 h-10 px-6"
              >
                {t('trailConditions.writeReport')}
              </Button>
            </View>
          </View>
        );
      }
      return (
        <View className="overflow-hidden rounded-xl">
          {data.reports.map((report) => (
            <TrailConditionReportRow
              key={report.id}
              report={report}
              showsTrail={data.scope === 'nearby'}
              onPress={() => router.push(`/trail-conditions/${report.id}`)}
            />
          ))}
        </View>
      );
    }
    if (query.isError) {
      return (
        <View className="flex-row items-center justify-between rounded-xl bg-card p-4">
          <Text variant="callout" className="flex-1 text-muted-foreground">
            {t('trailConditions.tripSectionLoadError')}
          </Text>
          <Button variant="outlined" className="h-10 px-6" onPress={() => query.refetch()}>
            {t('trailConditions.tryAgain')}
          </Button>
        </View>
      );
    }
    return (
      <View className="flex-row items-center gap-3 rounded-xl bg-card p-4">
        <ActivityIndicator />
        <Text variant="callout" className="text-muted-foreground">
          {t('trailConditions.tripSectionLoading')}
        </Text>
      </View>
    );
  };

  return (
    <View className="mb-6 gap-2" testID={testIds.trailConditions.tripSection}>
      <View className="flex-row items-end justify-between">
        <View className="flex-1 gap-0.5">
          <Text variant="caption1" className="font-semibold uppercase text-muted-foreground">
            {t('trailConditions.tripSectionTitle')}
          </Text>
          {subtitle ? (
            <Text variant="caption1" className="text-muted-foreground" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {/* Always there: reporting never waits on, or depends on, loading others' reports. */}
        <Pressable
          onPress={writeReport}
          accessibilityRole="button"
          hitSlop={8}
          className="flex-row items-center gap-1"
        >
          <Icon name="plus" size={14} color={colors.primary} />
          <Text variant="caption1" className="font-semibold text-primary">
            {t('trailConditions.report')}
          </Text>
        </Pressable>
      </View>
      {renderContent()}
    </View>
  );
}

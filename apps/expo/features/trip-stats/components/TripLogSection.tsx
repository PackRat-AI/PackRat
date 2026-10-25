import { Button } from '@packrat/ui/src/button';
import { Card } from '@packrat/ui/src/card';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { startOfDay } from 'date-fns';
import { useUpdateTrip } from 'expo-app/features/trips/hooks/useUpdateTrip';
import type { Trip } from 'expo-app/features/trips/types';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import { dayFromString } from '../utils/tripStats';
import { formatDistance, formatElevation } from '../utils/units';

/** A trip is finished once its last day, or its only day, is before today. */
export function isTripFinished(trip: Pick<Trip, 'startDate' | 'endDate'>): boolean {
  const last = dayFromString(trip.endDate) ?? dayFromString(trip.startDate);
  return last != null && last < startOfDay(new Date());
}

/**
 * The trip log on a finished trip: what was done and how far, or an invitation to record it,
 * and the switch that leaves the trip out of Trip Stats.
 */
export function TripLogSection({ trip }: { trip: Trip }) {
  const { t } = useTranslation();
  const router = useRouter();
  const unit = useDistanceUnit();
  const updateTrip = useUpdateTrip();
  const enableTripStats = useFeatureFlag('enableTripStats');
  if (!enableTripStats || !isTripFinished(trip)) return null;

  const log = trip.log;
  const hasLog =
    !!log &&
    (log.activities.length > 0 ||
      log.distanceMeters != null ||
      log.elevationGainMeters != null ||
      !!log.route ||
      (log.summits?.length ?? 0) > 0 ||
      (log.trails?.length ?? 0) > 0);
  const summary = log
    ? [
        log.activities.map((activity) => t(`tripStats.activities.names.${activity}`)).join(', '),
        log.distanceMeters != null ? formatDistance({ metres: log.distanceMeters, unit }) : null,
        log.elevationGainMeters != null
          ? `↑ ${formatElevation({ metres: log.elevationGainMeters, unit })}`
          : null,
        log.trails?.length ? t('tripStats.countTrails', { count: log.trails.length }) : null,
        log.summits?.length ? t('tripStats.countPeaks', { count: log.summits.length }) : null,
      ].filter(Boolean)
    : [];

  return (
    <View className="mb-6" testID={testIds.tripStats.logSection}>
      <Text className="mb-2 text-lg font-semibold text-foreground">
        {t('tripStats.log.sectionTitle')}
      </Text>
      <Card className="gap-3 p-4">
        <Text variant="body" className={hasLog ? undefined : 'text-muted-foreground'}>
          {hasLog ? summary.join(' · ') : t('tripStats.log.prompt')}
        </Text>
        <Button
          variant={hasLog ? 'tonal' : 'primary'}
          className="self-start"
          onPress={() => router.push(`/trip/${trip.id}/log`)}
          testID={testIds.tripStats.logTripBtn}
        >
          <Text>{hasLog ? t('tripStats.log.editLog') : t('tripStats.log.logTrip')}</Text>
        </Button>
        <View className="min-h-14 flex-row items-center gap-4">
          <View className="flex-1 gap-0.5">
            <Text variant="body">{t('tripStats.log.countInStats')}</Text>
            <Text variant="subhead" className="text-muted-foreground">
              {t('tripStats.log.countInStatsHint')}
            </Text>
          </View>
          <Toggle
            value={!trip.excludedFromStats}
            onValueChange={(value) => updateTrip({ ...trip, excludedFromStats: !value })}
            testID={testIds.tripStats.countInStatsToggle}
          />
        </View>
      </Card>
    </View>
  );
}

import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { ScrollView, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLongTrailSummary } from '../components/LongTrailCards';
import { ProgressBar, StatsRow } from '../components/StatsParts';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import {
  useFollowGoals,
  useGoalProgress,
  useLongTrailProgress,
  useParksAndPeaks,
  useTripStatsRecord,
} from '../hooks/useTripStats';
import { formatDay } from '../lib/useStatsFormat';
import { tripGoalsStore } from '../store/goals';
import { type LongTrail, walkedLines } from '../utils/longTrails';
import { formatDistance } from '../utils/units';

const MAP_HEIGHT = 300;

/** Frames the whole trail, with a little room either side. */
function regionFor(trail: LongTrail) {
  return {
    latitude: (trail.minLatitude + trail.maxLatitude) / 2,
    longitude: (trail.minLongitude + trail.maxLongitude) / 2,
    latitudeDelta: (trail.maxLatitude - trail.minLatitude) * 1.16,
    longitudeDelta: (trail.maxLongitude - trail.minLongitude) * 1.3,
  };
}

/**
 * One trail: how much is done, the walked stretches drawn over the whole line, and the trips that
 * walked them. Following it makes it a goal; the overflow menu sets a finish date or stops
 * following, as Material 3 puts secondary actions in the top app bar's overflow menu.
 */
export function LongTrailDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const summary = useLongTrailSummary(unit);
  const { code } = useLocalSearchParams<{ code: string }>();
  const record = useTripStatsRecord();
  const parksAndPeaks = useParksAndPeaks(record);
  const longTrails = useLongTrailProgress(record);
  const goals = useGoalProgress({ record, parksAndPeaks, longTrails });
  const followGoals = useFollowGoals();
  const alertRef = useRef<AlertMethods>(null);

  const progress = longTrails.find((item) => item.trail.code === code);
  const goal = code ? followGoals.get(code) : undefined;
  const goalProgress = goal ? goals.find((item) => item.goal.id === goal.id) : undefined;
  const walked = useMemo(() => (progress ? walkedLines(progress) : []), [progress]);

  if (!progress) return null;
  const { trail } = progress;

  let finishLine: string | null = null;
  if (goalProgress) {
    if (!goalProgress.end) {
      finishLine = t('tripStats.longTrails.followingSince', {
        date: formatDay(goalProgress.start),
      });
    } else {
      const by = t('tripStats.longTrails.finishBy', { date: formatDay(goalProgress.end) });
      const pace = goalProgress.pace;
      finishLine =
        pace?.kind === 'ahead'
          ? `${by} · ${t('tripStats.goals.ahead', { amount: formatDistance({ metres: pace.by, unit }) })}`
          : pace?.kind === 'behind'
            ? `${by} · ${t('tripStats.goals.behind', { amount: formatDistance({ metres: pace.by, unit }) })}`
            : pace?.kind === 'onPace'
              ? `${by} · ${t('tripStats.goals.onPace')}`
              : by;
    }
  }

  const follow = () =>
    router.push({
      pathname: '/trip-stats/goal',
      params: { kind: 'longTrail', trailCode: trail.code },
    });

  const confirmUnfollow = () => {
    if (!goal) return;
    alertRef.current?.alert({
      title: t('tripStats.longTrails.stopTitle'),
      message: t('tripStats.longTrails.stopBody'),
      buttons: [
        { text: t('tripStats.dialog.cancel'), style: 'cancel' },
        {
          text: t('tripStats.longTrails.stopFollowing'),
          style: 'destructive',
          onPress: () =>
            obs({ store: tripGoalsStore, id: goal.id }).assign({
              deleted: true,
              localUpdatedAt: new Date().toISOString(),
            }),
        },
      ],
    });
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: trail.name,
          headerRight: goal
            ? () => (
                <DropdownMenu
                  items={[
                    createDropdownItem({
                      actionKey: 'finish',
                      title: t('tripStats.longTrails.setFinishDate'),
                    }),
                    createDropdownItem({
                      actionKey: 'stop',
                      title: t('tripStats.longTrails.stopFollowing'),
                      destructive: true,
                    }),
                  ]}
                  onItemPress={(item) => {
                    if (item.actionKey === 'finish') {
                      router.push({ pathname: '/trip-stats/goal', params: { goalId: goal.id } });
                    } else if (item.actionKey === 'stop') {
                      confirmUnfollow();
                    }
                  }}
                >
                  <View
                    className="p-3"
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={t('tripStats.longTrails.moreOptions')}
                    testID={testIds.tripStats.longTrailMenu}
                  >
                    <Icon name="dots-vertical" size={24} color={colors.foreground} />
                  </View>
                </DropdownMenu>
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerClassName="pb-8">
        {/* Pinch to zoom on a trail thousands of miles long; dragging still scrolls the page. */}
        <View
          style={{ height: MAP_HEIGHT }}
          testID={testIds.tripStats.longTrailMap}
          accessibilityLabel={t('tripStats.longTrails.mapLabel', { trail: trail.name })}
        >
          <MapView
            style={{ flex: 1 }}
            initialRegion={regionFor(trail)}
            scrollEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          >
            {trail.lines.map((line, index) => (
              <Polyline
                key={`line-${index}`}
                coordinates={[...line]}
                strokeColor={colors.grey}
                strokeWidth={3}
              />
            ))}
            {walked.map((line, index) => (
              <Polyline
                key={`walked-${index}`}
                coordinates={line}
                strokeColor={colors.primary}
                strokeWidth={6}
                zIndex={1}
              />
            ))}
          </MapView>
        </View>

        <View className="gap-2 px-4 pt-4" accessible>
          <Text
            variant="title3"
            className="font-semibold"
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {summary(progress)}
          </Text>
          <ProgressBar progress={progress.fraction} />
          {finishLine ? (
            <Text variant="footnote" className="text-muted-foreground">
              {finishLine}
            </Text>
          ) : null}
        </View>
        {goal ? null : (
          <Button
            className="mx-4 mt-4 self-start"
            onPress={follow}
            testID={testIds.tripStats.longTrailFollowBtn}
          >
            <Text>{t('tripStats.longTrails.followThis')}</Text>
          </Button>
        )}

        <Text variant="subhead" className="px-4 pt-6 pb-1 font-medium text-primary">
          {t('tripStats.longTrails.trips')}
        </Text>
        {progress.trips.length === 0 ? (
          <Text variant="body" className="px-4 py-2 text-muted-foreground">
            {t('tripStats.longTrails.noTrips')}
          </Text>
        ) : (
          [...progress.trips].reverse().map((section) => {
            const repeat = section.newMeters + 1 < section.meters;
            return (
              <StatsRow
                key={section.trip.trip.id}
                icon="map-marker-path"
                title={section.trip.trip.name}
                subtitle={[
                  formatDay(section.trip.start),
                  repeat
                    ? section.newMeters < 1
                      ? t('tripStats.longTrails.walkedBefore')
                      : t('tripStats.longTrails.newStretch', {
                          amount: formatDistance({ metres: section.newMeters, unit }),
                        })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <View className="flex-row items-center gap-2">
                    <Text variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
                      {formatDistance({ metres: section.meters, unit })}
                    </Text>
                    <Icon name="chevron-right" size={24} color={colors.grey} />
                  </View>
                }
                onPress={() => router.push(`/trip/${section.trip.trip.id}`)}
                testID={testIds.tripStats.longTrailTripRow(section.trip.trip.id)}
              />
            );
          })
        )}
        <Text variant="footnote" className="px-4 pt-2 text-muted-foreground">
          {t('tripStats.longTrails.footer')}
        </Text>
      </ScrollView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}

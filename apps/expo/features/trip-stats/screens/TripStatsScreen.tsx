import { use$ } from '@legendapp/state/react';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { Fragment, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CollectionCards } from '../components/CollectionCards';
import { ComebackCard, GoalsCard } from '../components/GoalCards';
import { IdleGearCard } from '../components/PlacesAndGearCards';
import {
  ActivitiesCard,
  BaseWeightCard,
  HighlightsCard,
  MonthsCard,
  ThisYearCard,
  TopGearCard,
  TotalsCard,
} from '../components/RecordCards';
import { ScopeBar } from '../components/ScopeBar';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import {
  useFollowGoals,
  useGoalProgress,
  useIdleGear,
  useLongTrailProgress,
  useParksAndPeaks,
  useTripPlaces,
  useTripStatsRecord,
  useTripTrails,
} from '../hooks/useTripStats';
import { useScopeTitle } from '../lib/useStatsFormat';
import { tripStatsSettingsStore } from '../store/settings';
import { ALL_SCOPE, isAllScope, type Scope } from '../utils/tripStats';

export function TripStatsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const [scope, setScopeState] = useState<Scope>(ALL_SCOPE);
  const scrollRef = useRef<ScrollView>(null);
  // Back to the top on every change: the cards above the reader change with the filter, so the
  // top of the narrowed record is the only stable place to land.
  const setScope = (next: Scope) => {
    setScopeState(next);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };
  const record = useTripStatsRecord(scope);
  const parksAndPeaks = useParksAndPeaks(record);
  const longTrails = useLongTrailProgress(record);
  const trails = useTripTrails(record);
  const followGoals = useFollowGoals();
  const goals = useGoalProgress({ record, parksAndPeaks, longTrails });
  const places = useTripPlaces(record);
  const idleGear = useIdleGear(record);
  const settings = use$(tripStatsSettingsStore);

  const addGoal = () => router.push('/trip-stats/goal');
  const comeback = record.comeback;
  // A reason belongs to the comeback it was given for, not to the next one.
  const reason =
    comeback && settings.breakReasonTripId === comeback.trip.trip.id
      ? (settings.breakReason ?? null)
      : null;
  const isAll = isAllScope(scope);
  const scopeTitle = useScopeTitle(scope);
  const showScopeBar = record.availableYears.length > 1 || record.availableActivities.length > 0;

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} testID={testIds.tripStats.screen}>
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: t('tripStats.title'),
          headerRight: record.hasTrips
            ? () => (
                <Pressable
                  onPress={addGoal}
                  hitSlop={8}
                  className="p-3"
                  accessibilityRole="button"
                  accessibilityLabel={t('tripStats.addGoal')}
                  android_ripple={{ borderless: true, color: colors.grey5 }}
                >
                  <Icon name="flag-plus-outline" size={24} color={colors.foreground} />
                </Pressable>
              )
            : undefined,
        }}
      />
      {record.hasTrips ? (
        <>
          {/* The filters stay pinned under the app bar, so the active filter is in view wherever
              the record is scrolled to, as Google Play and Gmail pin their filter rows. Outside the
              ScrollView rather than a sticky header: a sticky header slides over the map and the
              Compose cards, and those native views take its taps on Android. */}
          {showScopeBar ? (
            <View className="px-4 pt-4 pb-2" style={{ backgroundColor: colors.background }}>
              <ScopeBar
                scope={scope}
                years={record.availableYears}
                activities={record.availableActivities}
                onChange={setScope}
              />
            </View>
          ) : null}
          <ScrollView
            ref={scrollRef}
            contentContainerClassName={showScopeBar ? 'gap-4 px-4 pt-2 pb-4' : 'gap-4 p-4'}
            contentInsetAdjustmentBehavior="automatic"
          >
            {record.finished.length === 0 ? (
              <View className="items-center gap-3 px-4 py-12" testID={testIds.tripStats.scopeEmpty}>
                <Icon name="filter-variant-remove" size={48} color={colors.grey} />
                <Text variant="title3" className="text-center font-medium">
                  {t('tripStats.scope.emptyTitle')}
                </Text>
                <Text variant="body" className="text-center text-muted-foreground">
                  {t('tripStats.scope.emptyBody', { scope: scopeTitle })}
                </Text>
                <Button
                  variant="tonal"
                  className="mt-2"
                  onPress={() => setScope(ALL_SCOPE)}
                  testID={testIds.tripStats.scopeEmptyShowAllBtn}
                >
                  <Text>{t('tripStats.scope.showAllTrips')}</Text>
                </Button>
              </View>
            ) : (
              // Keyed by the scope so the cards remount: a Compose card sizes to its content once,
              // and one that grows in place (a cleared filter's longer list) stays clipped.
              <Fragment key={`${scope.year ?? 'all'}-${scope.activity ?? 'all'}`}>
                <TotalsCard title={scopeTitle} totals={record.totals} unit={unit} />
                {isAll && comeback ? (
                  <ComebackCard
                    comeback={comeback}
                    reason={reason}
                    unit={unit}
                    onReasonChange={(next) =>
                      tripStatsSettingsStore.set({
                        ...tripStatsSettingsStore.peek(),
                        breakReason: next,
                        breakReasonTripId: next ? comeback.trip.trip.id : null,
                      })
                    }
                  />
                ) : null}
                {isAll ? (
                  <GoalsCard
                    progress={goals}
                    onAdd={addGoal}
                    onEdit={(goalId) =>
                      router.push({ pathname: '/trip-stats/goal', params: { goalId } })
                    }
                  />
                ) : null}
                {isAll ? <ThisYearCard record={record} /> : null}
                <MonthsCard record={record} />
                <ActivitiesCard
                  record={record}
                  unit={unit}
                  onSelect={(activity) =>
                    setScope({
                      ...scope,
                      activity: scope.activity === activity ? null : activity,
                    })
                  }
                />
                <HighlightsCard record={record} unit={unit} />
                <CollectionCards
                  record={record}
                  places={places}
                  parksAndPeaks={parksAndPeaks}
                  trails={trails}
                  longTrails={longTrails}
                  followGoals={followGoals}
                  unit={unit}
                  showLifetime={isAll}
                />
                <TopGearCard record={record} />
                {isAll ? (
                  <IdleGearCard
                    gear={idleGear}
                    onPress={() => router.push('/trip-stats/idle-gear')}
                  />
                ) : null}
                <BaseWeightCard record={record} />
                {isAll ? null : (
                  <Text variant="footnote" className="text-center text-muted-foreground">
                    {t('tripStats.scope.lifetimeNote')}
                  </Text>
                )}
              </Fragment>
            )}
          </ScrollView>
        </>
      ) : (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Icon name="chart-box-outline" size={48} color={colors.grey} />
          <Text variant="title3" className="text-center font-medium">
            {t('tripStats.emptyTitle')}
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            {t('tripStats.emptyBody')}
          </Text>
          <Button
            className="mt-2"
            onPress={() => router.push('/trip/new')}
            testID={testIds.tripStats.emptyPlanTripBtn}
          >
            <Text>{t('tripStats.planTrip')}</Text>
          </Button>
        </View>
      )}
    </SafeAreaView>
  );
}

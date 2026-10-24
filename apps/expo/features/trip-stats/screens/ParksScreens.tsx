import DateTimePicker from '@expo/ui/community/datetime-picker';
import { use$ } from '@legendapp/state/react';
import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { nanoid } from 'nanoid';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProgressBar, SearchField, StatsRow } from '../components/StatsParts';
import { useParksAndPeaks, useTripStatsRecord } from '../hooks/useTripStats';
import { goalParkSelection$ } from '../lib/parkSelection';
import { formatDay } from '../lib/useStatsFormat';
import { tripStatsEntriesStore } from '../store/entries';
import { NATIONAL_PARK_COUNT, type ParkStatus, visitedParks } from '../utils/parksAndPeaks';
import { dayToString } from '../utils/tripStats';

function firstVisit(status: ParkStatus): Date | null {
  return status.visits.find((visit) => visit.date)?.date ?? null;
}

/**
 * Every National Park, visited ones ticked. A trip inside a park ticks it; parks from before
 * PackRat are added on the park's page. Search matches a name or a state code.
 */
export function ParksScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const record = useTripStatsRecord();
  const parksAndPeaks = useParksAndPeaks(record);
  const [query, setQuery] = useState('');
  const visited = visitedParks(parksAndPeaks).length;
  const parks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return parksAndPeaks.parks;
    return parksAndPeaks.parks.filter(
      (status) =>
        status.park.name.toLowerCase().includes(needle) ||
        status.park.states.some((state) => state.toLowerCase() === needle),
    );
  }, [parksAndPeaks.parks, query]);

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('tripStats.parks.title') }} />
      <FlatList
        data={parks}
        keyExtractor={(status) => status.park.code}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View className="gap-2 px-4 pb-2">
              <Text variant="title3" className="font-semibold">
                {t('tripStats.parks.progress', { count: visited, total: NATIONAL_PARK_COUNT })}
              </Text>
              <ProgressBar progress={visited / NATIONAL_PARK_COUNT} />
            </View>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder={t('tripStats.parks.search')}
              testID={testIds.tripStats.parkSearchInput}
            />
          </View>
        }
        renderItem={({ item: status }) => {
          const isVisited = status.visits.length > 0;
          const first = firstVisit(status);
          return (
            <StatsRow
              title={status.park.name}
              subtitle={[
                status.park.states.join(', '),
                isVisited
                  ? first
                    ? `${t('tripStats.parks.visited')} ${formatDay(first)}`
                    : t('tripStats.parks.visited')
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={
                <Icon
                  name={isVisited ? 'check-circle' : 'circle-outline'}
                  size={24}
                  color={isVisited ? colors.primary : colors.grey3}
                />
              }
              onPress={() =>
                router.push({
                  pathname: '/trip-stats/park/[code]',
                  params: { code: status.park.code },
                })
              }
              testID={testIds.tripStats.parkRow(status.park.code)}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

/** One park: its visits, newest trips linked, and a way to add a visit from before PackRat. */
export function ParkDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { code } = useLocalSearchParams<{ code: string }>();
  const record = useTripStatsRecord();
  const parksAndPeaks = useParksAndPeaks(record);
  const status = parksAndPeaks.parks.find((item) => item.park.code === code);
  const [picking, setPicking] = useState(false);
  if (!status) return null;

  const addVisit = (date: Date) => {
    const now = new Date().toISOString();
    const id = nanoid();
    obs({ store: tripStatsEntriesStore, id }).set({
      id,
      kind: 'park',
      parkCode: status.park.code,
      date: dayToString(date),
      deleted: false,
      localCreatedAt: now,
      localUpdatedAt: now,
    });
  };

  const removeVisit = (id: string) =>
    obs({ store: tripStatsEntriesStore, id }).assign({
      deleted: true,
      localUpdatedAt: new Date().toISOString(),
    });

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen options={{ ...getAppBarOptions(), title: status.park.name }} />
      <ScrollView contentContainerClassName="pb-8">
        <Text variant="subhead" className="px-4 pb-2 text-muted-foreground">
          {status.park.states.join(', ')}
        </Text>
        <Text variant="subhead" className="px-4 pt-4 pb-1 font-medium text-primary">
          {t('tripStats.parks.visits')}
        </Text>
        {status.visits.length === 0 ? (
          <Text variant="body" className="px-4 py-3 text-muted-foreground">
            {t('tripStats.parks.noVisits')}
          </Text>
        ) : (
          status.visits.map((visit) =>
            visit.tripId ? (
              <StatsRow
                key={visit.id}
                icon="map-marker-path"
                title={visit.tripName ?? ''}
                subtitle={visit.date ? formatDay(visit.date) : null}
                onPress={() => router.push(`/trip/${visit.tripId}`)}
              />
            ) : (
              <StatsRow
                key={visit.id}
                icon="calendar-check-outline"
                title={visit.date ? formatDay(visit.date) : t('tripStats.parks.visited')}
                subtitle={t('tripStats.parks.handAdded')}
                trailing={
                  <Pressable
                    onPress={() => removeVisit(visit.id)}
                    hitSlop={8}
                    className="p-2"
                    accessibilityRole="button"
                    accessibilityLabel={t('tripStats.parks.removeVisit')}
                    android_ripple={{ borderless: true, color: colors.grey5 }}
                    testID={testIds.tripStats.removeVisitBtn(visit.id)}
                  >
                    <Icon name="delete-outline" size={24} color={colors.grey} />
                  </Pressable>
                }
              />
            ),
          )
        )}
        <Button
          variant="tonal"
          className="mx-4 mt-4 self-start"
          onPress={() => setPicking(true)}
          testID={testIds.tripStats.addPastVisitBtn}
        >
          <Icon name="plus" size={18} color={colors.foreground} />
          <Text>{t('tripStats.parks.addPastVisit')}</Text>
        </Button>
      </ScrollView>
      {picking ? (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display="default"
          maximumDate={new Date()}
          onChange={(_event, date) => {
            setPicking(false);
            if (date) addVisit(new Date(date.getFullYear(), date.getMonth(), date.getDate()));
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Picks the parks on a park-list goal: a Material 3 list with a checkbox per row, visited parks
 * marked, and a clear action in the app bar while anything is chosen. Search matches a name or a
 * state code.
 */
export function ChooseParksScreen() {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const record = useTripStatsRecord();
  const parksAndPeaks = useParksAndPeaks(record);
  const selection = use$(goalParkSelection$);
  const [query, setQuery] = useState('');
  const chosen = useMemo(() => new Set(selection), [selection]);
  const parks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return parksAndPeaks.parks;
    return parksAndPeaks.parks.filter(
      (status) =>
        status.park.name.toLowerCase().includes(needle) ||
        status.park.states.some((state) => state.toLowerCase() === needle),
    );
  }, [parksAndPeaks.parks, query]);
  const toggle = (code: string) =>
    goalParkSelection$.set(
      chosen.has(code) ? selection.filter((item) => item !== code) : [...selection, code],
    );

  return (
    <SafeAreaView className="flex-1" edges={['bottom']}>
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title:
            selection.length > 0
              ? t('tripStats.goals.parksSelected', { count: selection.length })
              : t('tripStats.goals.chooseParks'),
          headerRight:
            selection.length > 0
              ? () => (
                  <Button
                    variant="plain"
                    onPress={() => goalParkSelection$.set([])}
                    testID={testIds.tripStats.parkSelectClearBtn}
                  >
                    <Text className="text-primary">{t('tripStats.goals.clearParks')}</Text>
                  </Button>
                )
              : undefined,
        }}
      />
      <FlatList
        data={parks}
        keyExtractor={(status) => status.park.code}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={t('tripStats.parks.search')}
            testID={testIds.tripStats.parkSearchInput}
          />
        }
        renderItem={({ item: status }) => (
          <StatsRow
            title={status.park.name}
            subtitle={[
              status.park.states.join(', '),
              status.visits.length > 0 ? t('tripStats.goals.visited') : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            trailing={
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                pointerEvents="none"
              >
                <Icon
                  name={chosen.has(status.park.code) ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24}
                  color={chosen.has(status.park.code) ? colors.primary : colors.grey}
                />
              </View>
            }
            onPress={() => toggle(status.park.code)}
            testID={testIds.tripStats.parkSelectRow(status.park.code)}
          />
        )}
      />
    </SafeAreaView>
  );
}

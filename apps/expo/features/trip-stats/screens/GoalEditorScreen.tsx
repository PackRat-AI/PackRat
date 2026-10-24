import { use$ } from '@legendapp/state/react';
import type { TripGoal, TripGoalMetric } from '@packrat/schemas/tripStats';
import type { TripSummit } from '@packrat/schemas/trips';
import { Alert, type AlertMethods } from '@packrat/ui/src/alert';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import { addMonths, addYears, startOfDay } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { obs } from 'expo-app/lib/store';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { nanoid } from 'nanoid';
import { useCallback, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DateField,
  FullScreenDialogHeader,
  OutlinedField,
  SectionLabel,
} from '../components/DialogParts';
import { MenuField } from '../components/MenuField';
import { StatsRow, ValueRow } from '../components/StatsParts';
import { useFollowGoals, useParksAndPeaks, useTripStatsRecord } from '../hooks/useTripStats';
import { findLongTrail, getLongTrails } from '../lib/longTrails';
import { getNationalParks } from '../lib/nationalParks';
import { goalParkSelection$ } from '../lib/parkSelection';
import { consumePickedPeak, pickedPeak$ } from '../lib/peakPicker';
import { formatDay, formatList, useStatsFormat } from '../lib/useStatsFormat';
import { tripGoalsStore } from '../store/goals';
import { isMeasuredMetric, peaksClimbed } from '../utils/goalProgress';
import {
  NATIONAL_PARK_COUNT,
  parksVisitedBetween,
  peakKey,
  peaksSummitedBetween,
} from '../utils/parksAndPeaks';
import { clipTrips, computeTotals, dayFromString, dayToString } from '../utils/tripStats';
import {
  distanceSymbol,
  distanceValue,
  elevationSymbol,
  elevationValue,
  formatElevation,
  metresFromDistance,
  metresFromElevation,
} from '../utils/units';

type TripGoalKind = TripGoal['kind'];

const KINDS = Object.freeze([
  'annual',
  'custom',
  'longTrail',
  'peakList',
  'parkList',
] as const satisfies readonly TripGoalKind[]);
/** A list goal measures one thing, fixed by what it lists. */
const LIST_METRIC = Object.freeze({
  longTrail: 'distance',
  peakList: 'summits',
  parkList: 'parks',
} as const satisfies Record<string, TripGoalMetric>);
const PEAK_LIST_LIMIT = 500;

function isListKind(kind: TripGoalKind): kind is keyof typeof LIST_METRIC {
  return kind in LIST_METRIC;
}
const METRICS = Object.freeze([
  'nights',
  'trips',
  'days',
  'distance',
  'elevation',
  'summits',
  'parks',
] as const satisfies readonly TripGoalMetric[]);

/**
 * New and edit goal, as a Material 3 full-screen dialog. A dated goal covers this calendar year or
 * custom dates, and measures nights, trips, days, distance, climbing, summits or parks. A list goal
 * follows a long trail, or ticks off a list of peaks or National Parks across the user's whole
 * history, with an optional finish date for pace. The type is an exposed dropdown menu, M3's
 * single-select field for more options than segmented buttons hold
 * (m3.material.io/components/menus/guidelines).
 */
export function GoalEditorScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const params = useLocalSearchParams<{ goalId?: string; kind?: string; trailCode?: string }>();
  const { goalId } = params;
  const existing = use$(() => (goalId ? tripGoalsStore.get()[goalId] : undefined));
  const { unit, formatMetric } = useStatsFormat();
  const record = useTripStatsRecord();
  const parksAndPeaks = useParksAndPeaks(record);

  const today = startOfDay(new Date());
  const followGoals = useFollowGoals();
  const [kind, setKind] = useState<TripGoalKind>(
    existing?.kind ?? KINDS.find((item) => item === params.kind) ?? 'annual',
  );
  const trails = getLongTrails();
  const [trailCode, setTrailCode] = useState(
    existing?.trailCode ??
      findLongTrail(params.trailCode)?.code ??
      (trails.find((item) => !followGoals.has(item.code)) ?? trails[0])?.code ??
      '',
  );
  const trail = findLongTrail(trailCode);
  const [peaks, setPeaks] = useState<TripSummit[]>(existing?.peaks ?? []);
  const [everyPark, setEveryPark] = useState(existing ? existing.parkCodes == null : true);
  // The park chooser reads and writes the shared selection; seed it with this goal's parks
  // before the first render reads it.
  useState(() => goalParkSelection$.set(existing?.parkCodes ?? []));
  const parkCodes = use$(goalParkSelection$);
  const listStart =
    (existing && isListKind(existing.kind) ? dayFromString(existing.startDate) : null) ?? today;
  const [hasFinishDate, setHasFinishDate] = useState(
    existing != null && isListKind(existing.kind) && existing.endDate != null,
  );
  const [metric, setMetric] = useState<TripGoalMetric>(existing?.metric ?? 'nights');
  const [name, setName] = useState(existing?.name ?? '');
  const [startDate, setStartDate] = useState(dayFromString(existing?.startDate) ?? today);
  const [endDate, setEndDate] = useState(dayFromString(existing?.endDate) ?? addMonths(today, 3));
  const [targetText, setTargetText] = useState(() => {
    if (!existing) return '';
    const shown =
      existing.metric === 'distance'
        ? distanceValue({ metres: existing.target, unit })
        : existing.metric === 'elevation'
          ? elevationValue({ metres: existing.target, unit })
          : existing.target;
    return String(Math.round(shown * 10) / 10);
  });
  const year = existing?.year ?? today.getFullYear();
  const alertRef = useRef<AlertMethods>(null);
  const climbed = useMemo(
    () => peaksClimbed({ peaks, record: parksAndPeaks }),
    [peaks, parksAndPeaks],
  );

  useFocusEffect(
    useCallback(() => {
      const picked = consumePickedPeak();
      if (picked) {
        setPeaks((current) =>
          current.some((peak) => peakKey(peak) === peakKey(picked))
            ? current
            : [...current, picked].slice(0, PEAK_LIST_LIMIT),
        );
      }
    }, []),
  );

  /** In the metric's base unit, or null while the field can't be saved. */
  const target = useMemo(() => {
    const value = Number(targetText.trim().replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return null;
    if (metric === 'distance') return metresFromDistance({ value, unit });
    if (metric === 'elevation') return metresFromElevation({ value, unit });
    return Math.round(value) >= 1 ? Math.round(value) : null;
  }, [targetText, metric, unit]);

  /** The same stretch last year, so the target starts from something real. */
  const hint = useMemo(() => {
    const window =
      kind === 'annual'
        ? { start: new Date(year - 1, 0, 1), end: new Date(year - 1, 11, 31) }
        : { start: addYears(startDate, -1), end: addYears(endDate, -1) };
    const totals = computeTotals(clipTrips({ trips: record.allFinished, window }));
    const byMetric: Record<TripGoalMetric, number | null> = {
      trips: totals.trips,
      nights: totals.nights,
      days: totals.days,
      distance: totals.distance,
      elevation: totals.elevationGain,
      summits: peaksSummitedBetween({ record: parksAndPeaks, window }),
      parks: parksVisitedBetween({ record: parksAndPeaks, window }),
    };
    const value = byMetric[metric];
    // Hand-added summits and parks count without a trip; everything else needs one.
    const handAdded = (metric === 'summits' || metric === 'parks') && (value ?? 0) > 0;
    if (value == null || (totals.trips === 0 && !handAdded)) return null;
    return kind === 'annual'
      ? t('tripStats.goals.hintLastYear', { year: year - 1, value: formatMetric(metric, value) })
      : t('tripStats.goals.hintSameDates', { value: formatMetric(metric, value) });
  }, [kind, year, startDate, endDate, metric, record.allFinished, parksAndPeaks, formatMetric, t]);

  const targetUnit =
    metric === 'distance'
      ? distanceSymbol(unit)
      : metric === 'elevation'
        ? elevationSymbol(unit)
        : t(`tripStats.goals.units.${metric}`);

  const canSave = (() => {
    switch (kind) {
      case 'longTrail':
        return trail != null;
      case 'peakList':
        return peaks.length > 0;
      case 'parkList':
        return everyPark || parkCodes.length > 0;
      default:
        return target != null;
    }
  })();

  const save = () => {
    if (!canSave) return;
    const now = new Date().toISOString();
    const trimmed = name.trim() || null;
    const base = {
      id: existing?.id ?? nanoid(),
      deleted: false,
      localCreatedAt: existing?.localCreatedAt ?? now,
      localUpdatedAt: now,
    };
    let goal: TripGoal;
    if (isListKind(kind)) {
      // Parks keep the dataset's order, so the same choice always saves the same list.
      const codes = everyPark
        ? null
        : getNationalParks()
            .map((park) => park.code)
            .filter((code) => parkCodes.includes(code));
      const listTarget =
        kind === 'longTrail'
          ? (trail?.officialMeters ?? 0)
          : kind === 'peakList'
            ? peaks.length
            : (codes?.length ?? NATIONAL_PARK_COUNT);
      if (listTarget <= 0) return;
      goal = {
        ...base,
        kind,
        metric: LIST_METRIC[kind],
        target: listTarget,
        year: null,
        name: kind === 'longTrail' ? null : trimmed,
        // A list goal is paced from the day it was set, which an edit keeps.
        startDate: dayToString(listStart),
        endDate: hasFinishDate ? dayToString(endDate < listStart ? listStart : endDate) : null,
        trailCode: kind === 'longTrail' ? (trail?.code ?? null) : null,
        peaks: kind === 'peakList' ? peaks : null,
        parkCodes: kind === 'parkList' ? codes : null,
      };
    } else {
      if (target == null) return;
      goal = {
        ...base,
        kind,
        metric,
        target,
        year: kind === 'annual' ? year : null,
        name: kind === 'custom' ? trimmed : null,
        startDate: kind === 'custom' ? dayToString(startDate) : null,
        endDate: kind === 'custom' ? dayToString(endDate < startDate ? startDate : endDate) : null,
        trailCode: null,
        peaks: null,
        parkCodes: null,
      };
    }
    obs({ store: tripGoalsStore, id: goal.id }).set(goal);
    router.back();
  };

  const addPeak = () => {
    pickedPeak$.set(null);
    // Peaks are looked up around the latest trip; the picker falls back to typing one in.
    const location = record.allFinished.at(-1)?.trip.location;
    router.push({
      pathname: '/trip-stats/peak-picker',
      params: {
        ...(location ? { lat: String(location.latitude), lng: String(location.longitude) } : {}),
        exclude: peaks.map(peakKey).join(','),
      },
    });
  };

  /** The trail picker offers every trail but those already followed by another goal. */
  const trailOptions = trails
    .filter(
      (item) =>
        item.code === trailCode ||
        !followGoals.has(item.code) ||
        followGoals.get(item.code)?.id === existing?.id,
    )
    .map((item) => item.code);

  const confirmDelete = () => {
    if (!existing) return;
    // Material 3 AlertDialog (Compose), not the legacy platform dialog `Alert.alert` draws.
    alertRef.current?.alert({
      title: t('tripStats.goals.deleteTitle'),
      message: t('tripStats.goals.deleteBody'),
      buttons: [
        { text: t('tripStats.dialog.cancel'), style: 'cancel' },
        {
          text: t('tripStats.dialog.delete'),
          style: 'destructive',
          onPress: () => {
            obs({ store: tripGoalsStore, id: existing.id }).assign({
              deleted: true,
              localUpdatedAt: new Date().toISOString(),
            });
            router.back();
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <FullScreenDialogHeader
              title={existing ? t('tripStats.goals.editGoal') : t('tripStats.goals.newGoal')}
              onClose={() => router.back()}
              onSave={save}
              canSave={canSave}
            />
          ),
        }}
      />
      <KeyboardAvoidingView behavior="height" className="flex-1">
        <ScrollView contentContainerClassName="gap-2 py-4" keyboardShouldPersistTaps="handled">
          <MenuField
            label={t('tripStats.goals.goal')}
            options={KINDS}
            value={kind}
            onChange={setKind}
            optionLabel={(value) => t(`tripStats.goals.kinds.${value}`)}
            testIDFor={testIds.tripStats.goalKind}
          />
          {kind === 'annual' || kind === 'custom' ? (
            <>
              {kind === 'custom' ? (
                <>
                  <OutlinedField
                    label={t('tripStats.goals.name')}
                    placeholder={t('tripStats.goals.namePlaceholder')}
                    value={name}
                    onChangeText={setName}
                    maxLength={120}
                    testID={testIds.tripStats.goalNameInput}
                  />
                  <DateField
                    label={t('tripStats.goals.starts')}
                    value={startDate}
                    onChange={(date) => {
                      setStartDate(date);
                      if (endDate < date) setEndDate(date);
                    }}
                    testID={testIds.tripStats.goalStartDate}
                  />
                  <DateField
                    label={t('tripStats.goals.ends')}
                    value={endDate}
                    minimumDate={startDate}
                    onChange={setEndDate}
                    testID={testIds.tripStats.goalEndDate}
                  />
                </>
              ) : null}
              <MenuField
                label={t('tripStats.goals.measure')}
                options={METRICS}
                value={metric}
                onChange={setMetric}
                optionLabel={(value) => t(`tripStats.goals.metrics.${value}`)}
                testIDFor={testIds.tripStats.goalMetric}
              />
              <OutlinedField
                label={`${t('tripStats.goals.target')} (${targetUnit})`}
                value={targetText}
                onChangeText={setTargetText}
                keyboardType={isMeasuredMetric(metric) ? 'decimal-pad' : 'number-pad'}
                placeholder="0"
                testID={testIds.tripStats.goalTargetInput}
              />
              {hint ? <Footnote>{hint}</Footnote> : null}
            </>
          ) : null}

          {kind === 'longTrail' ? (
            <>
              <MenuField
                label={t('tripStats.goals.trail')}
                options={trailOptions}
                value={trailCode}
                onChange={setTrailCode}
                optionLabel={(code) => findLongTrail(code)?.name ?? code}
                testIDFor={testIds.tripStats.goalTrail}
              />
              {trail ? (
                <View className="px-4">
                  <ValueRow
                    label={t('tripStats.goals.trailLength')}
                    value={formatMetric('distance', trail.officialMeters)}
                  />
                  <ValueRow
                    label={t('tripStats.goals.trailStates')}
                    value={formatList(trail.states)}
                  />
                </View>
              ) : null}
              <Footnote>{t('tripStats.goals.trailFooter')}</Footnote>
            </>
          ) : null}

          {kind === 'peakList' ? (
            <>
              <OutlinedField
                label={t('tripStats.goals.name')}
                placeholder={t('tripStats.goals.peakListPlaceholder')}
                value={name}
                onChangeText={setName}
                maxLength={120}
                testID={testIds.tripStats.goalNameInput}
              />
              <SectionLabel>
                {peaks.length > 0
                  ? t('tripStats.goals.peaksCount', { count: peaks.length })
                  : t('tripStats.goals.peaks')}
              </SectionLabel>
              {peaks.map((peak) => (
                <StatsRow
                  key={peakKey(peak)}
                  icon={climbed.has(peakKey(peak)) ? 'check-circle' : 'flag-variant-outline'}
                  title={peak.name}
                  subtitle={[
                    peak.elevationMeters != null
                      ? formatElevation({ metres: peak.elevationMeters, unit })
                      : null,
                    climbed.has(peakKey(peak)) ? t('tripStats.goals.climbed') : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  trailing={
                    <Pressable
                      onPress={() =>
                        setPeaks((current) =>
                          current.filter((item) => peakKey(item) !== peakKey(peak)),
                        )
                      }
                      hitSlop={8}
                      className="p-2"
                      accessibilityRole="button"
                      accessibilityLabel={t('tripStats.goals.removePeak', { name: peak.name })}
                      android_ripple={{ borderless: true, color: colors.grey5 }}
                      testID={testIds.tripStats.goalRemovePeak(peakKey(peak))}
                    >
                      <Icon name="close" size={24} color={colors.grey} />
                    </Pressable>
                  }
                />
              ))}
              {peaks.length < PEAK_LIST_LIMIT ? (
                <Button
                  variant="plain"
                  className="mx-2 self-start"
                  onPress={addPeak}
                  testID={testIds.tripStats.goalAddPeakBtn}
                >
                  <Icon name="plus" size={18} color={colors.primary} />
                  <Text className="text-primary">{t('tripStats.goals.addPeak')}</Text>
                </Button>
              ) : null}
              <Footnote>{t('tripStats.goals.peaksFooter')}</Footnote>
            </>
          ) : null}

          {kind === 'parkList' ? (
            <>
              <OutlinedField
                label={t('tripStats.goals.name')}
                placeholder={t('tripStats.goals.parkListPlaceholder')}
                value={name}
                onChangeText={setName}
                maxLength={120}
                testID={testIds.tripStats.goalNameInput}
              />
              <SwitchRow
                label={t('tripStats.goals.everyPark')}
                value={everyPark}
                onChange={setEveryPark}
                testID={testIds.tripStats.goalEveryParkToggle}
              />
              {everyPark ? null : (
                <StatsRow
                  icon="pine-tree"
                  title={t('tripStats.goals.chooseParks')}
                  subtitle={
                    parkCodes.length > 0
                      ? t('tripStats.countParks', { count: parkCodes.length })
                      : t('tripStats.goals.parksNone')
                  }
                  onPress={() => router.push('/trip-stats/choose-parks')}
                  testID={testIds.tripStats.goalChooseParksBtn}
                />
              )}
              <Footnote>
                {everyPark
                  ? t('tripStats.goals.everyParkFooter', { count: NATIONAL_PARK_COUNT })
                  : t('tripStats.goals.someParksFooter')}
              </Footnote>
            </>
          ) : null}

          {isListKind(kind) ? (
            <>
              <SwitchRow
                label={t('tripStats.goals.finishBy')}
                value={hasFinishDate}
                onChange={setHasFinishDate}
                testID={testIds.tripStats.goalFinishToggle}
              />
              {hasFinishDate ? (
                <DateField
                  label={t('tripStats.goals.finishDate')}
                  value={endDate < listStart ? listStart : endDate}
                  minimumDate={listStart}
                  onChange={setEndDate}
                  testID={testIds.tripStats.goalFinishDate}
                />
              ) : null}
              <Footnote>
                {hasFinishDate
                  ? t('tripStats.goals.finishFooterOn', { date: formatDay(listStart) })
                  : t('tripStats.goals.finishFooterOff')}
              </Footnote>
            </>
          ) : null}
          {existing ? (
            <Button
              variant="plain"
              className="mx-2 mt-4 self-start"
              onPress={confirmDelete}
              testID={testIds.tripStats.deleteGoalBtn}
            >
              <Text style={{ color: colors.destructive }}>{t('tripStats.goals.deleteGoal')}</Text>
            </Button>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Alert title="" buttons={[]} ref={alertRef} />
    </SafeAreaView>
  );
}

/** Supporting text under a group of fields. */
function Footnote({ children }: { children: string }) {
  return (
    <Text variant="footnote" className="px-8 text-muted-foreground">
      {children}
    </Text>
  );
}

/** A Material 3 list item with a trailing switch, the whole row toggling it. */
function SwitchRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-4 px-4">
      <Text variant="body" className="flex-1">
        {label}
      </Text>
      <Toggle value={value} onValueChange={onChange} testID={testID} />
    </View>
  );
}

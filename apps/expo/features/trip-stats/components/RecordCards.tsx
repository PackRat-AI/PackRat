import type { TripActivity } from '@packrat/schemas/trips';
import { Text } from '@packrat/ui/src/text';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';
import {
  formatDecimal,
  formatMonthDay,
  formatMonthName,
  formatNumber,
} from '../lib/useStatsFormat';
import { activitiesSummary, monthsSummary, weightSummary } from '../utils/chartSummaries';
import type { Totals, TripStatsRecord } from '../utils/tripStats';
import { formatDistance, formatElevation, type TripDistanceUnit } from '../utils/units';
import { SegmentedButtons, StackedValueRow, StatsCard, StatTile, ValueRow } from './StatsParts';

export function TotalsCard({
  title,
  totals,
  unit,
  action,
}: {
  title: string;
  totals: Totals;
  unit: TripDistanceUnit;
  action?: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <StatsCard title={title} action={action}>
      <View className="flex-row flex-wrap gap-x-4 gap-y-3">
        <StatTile label={t('tripStats.totals.trips')} value={formatNumber(totals.trips)} />
        {totals.distance != null ? (
          <StatTile
            label={t('tripStats.totals.distance')}
            value={formatDistance({ metres: totals.distance, unit })}
          />
        ) : null}
        {totals.elevationGain != null ? (
          <StatTile
            label={t('tripStats.totals.elevation')}
            value={formatElevation({ metres: totals.elevationGain, unit })}
          />
        ) : null}
        <StatTile label={t('tripStats.totals.nights')} value={formatNumber(totals.nights)} />
        <StatTile label={t('tripStats.totals.days')} value={formatNumber(totals.days)} />
        <StatTile label={t('tripStats.totals.places')} value={formatNumber(totals.places)} />
      </View>
    </StatsCard>
  );
}

/** A neutral difference, or null when the same: nothing is coloured as a win or a loss. */
function delta({ now, before }: { now: number; before: number }): string | null {
  const difference = now - before;
  if (difference === 0) return null;
  return `${difference > 0 ? '+' : '−'}${formatNumber(Math.abs(difference))}`;
}

export function ThisYearCard({ record, action }: { record: TripStatsRecord; action?: ReactNode }) {
  const { t } = useTranslation();
  const { thisYear, lastYearToDate } = record;
  if (thisYear.trips === 0 && !lastYearToDate) return null;
  const rows = [
    { key: 'trips', label: t('tripStats.thisYear.trips'), now: thisYear.trips },
    { key: 'nights', label: t('tripStats.thisYear.nights'), now: thisYear.nights },
    { key: 'days', label: t('tripStats.thisYear.days'), now: thisYear.days },
  ] as const;
  return (
    <StatsCard
      title={t('tripStats.thisYear.title')}
      action={action}
      subtitle={
        lastYearToDate ? t('tripStats.thisYear.compared') : t('tripStats.thisYear.firstYear')
      }
    >
      <View>
        {rows.map((row) => (
          <View key={row.key} className="min-h-10 flex-row items-center gap-4">
            <Text variant="body" className="flex-1 text-muted-foreground">
              {row.label}
            </Text>
            <Text variant="body" className="font-medium" style={{ fontVariant: ['tabular-nums'] }}>
              {formatNumber(row.now)}
            </Text>
            {lastYearToDate ? (
              <Text
                variant="subhead"
                className="w-12 text-right text-muted-foreground"
                style={{ fontVariant: ['tabular-nums'] }}
              >
                {delta({ now: row.now, before: lastYearToDate[row.key] }) ??
                  t('tripStats.thisYear.same')}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </StatsCard>
  );
}

type MonthMetric = 'nights' | 'trips';
const MONTH_METRICS = Object.freeze(['nights', 'trips'] as const);
const CHART_HEIGHT = 120;

/**
 * Twelve monthly bars with a Material 3 segmented button to switch what they count — Strava's
 * Progress chart pattern. The bars are drawn in React Native; neither Compose nor `@expo/ui` ships
 * a chart.
 */
export function MonthsCard({ record }: { record: TripStatsRecord }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [metric, setMetric] = useState<MonthMetric>('nights');
  const values = record.months.map((month) => month[metric]);
  const max = Math.max(...values, 1);
  const title =
    record.scope.year != null ? String(record.scope.year) : t('tripStats.months.last12');
  const { total, peak } = monthsSummary({ months: record.months, metric });
  const countKey = metric === 'nights' ? 'tripStats.countNights' : 'tripStats.countTrips';
  const summary = [
    t('tripStats.months.summary', {
      amount: t(countKey, { count: total }),
      period: record.scope.year != null ? title : t('tripStats.months.summaryLast12'),
    }),
    peak
      ? t('tripStats.months.summaryPeak', {
          month: peak.month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
          count: peak.value,
        })
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <StatsCard title={title} summary={summary}>
      <SegmentedButtons
        options={MONTH_METRICS}
        value={metric}
        onChange={setMetric}
        label={(value) => t(`tripStats.months.${value}`)}
        testIDFor={testIds.tripStats.monthsMetric}
      />
      <View
        className="flex-row items-end gap-1"
        style={{ height: CHART_HEIGHT + 20 }}
        accessible
        accessibilityLabel={record.months
          .map(
            (month) =>
              `${month.month.toLocaleDateString(undefined, { month: 'long' })}: ${month[metric]}`,
          )
          .join(', ')}
      >
        {record.months.map((month) => {
          const value = month[metric];
          return (
            <View key={month.month.getTime()} className="flex-1 items-center gap-1">
              <View
                className="w-full rounded-t-md"
                style={{
                  height: Math.max((value / max) * CHART_HEIGHT, value > 0 ? 4 : 2),
                  backgroundColor: value > 0 ? colors.primary : colors.grey5,
                }}
              />
              <Text variant="caption2" className="text-muted-foreground">
                {month.month.toLocaleDateString(undefined, { month: 'narrow' })}
              </Text>
            </View>
          );
        })}
      </View>
    </StatsCard>
  );
}

export function ActivitiesCard({
  record,
  unit,
  onSelect,
}: {
  record: TripStatsRecord;
  unit: TripDistanceUnit;
  /** Tapping a row narrows the screen to that activity; tapping it again clears it. */
  onSelect: (activity: TripActivity) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  if (record.activities.length === 0) return null;
  const max = Math.max(...record.activities.map((bucket) => bucket.trips), 1);
  const { count, top } = activitiesSummary(record.activities);
  const summary = [
    t('tripStats.activities.summary', { count }),
    top
      ? t('tripStats.activities.summaryTop', {
          activity: t(`tripStats.activities.names.${top.activity}`),
          trips: t('tripStats.countTrips', { count: top.trips }),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <StatsCard
      title={t('tripStats.activities.title')}
      subtitle={t('tripStats.activities.subtitle')}
      summary={summary}
    >
      <View>
        {record.activities.map((bucket) => (
          <Pressable
            key={bucket.activity}
            onPress={() => onSelect(bucket.activity)}
            accessibilityRole="button"
            accessibilityState={{ selected: record.scope.activity === bucket.activity }}
            android_ripple={{ color: colors.grey5 }}
            testID={testIds.tripStats.activityRow(bucket.activity)}
            className="min-h-12 justify-center gap-1 py-1.5"
          >
            <View className="flex-row items-baseline justify-between gap-2">
              <Text variant="body">{t(`tripStats.activities.names.${bucket.activity}`)}</Text>
              <Text variant="subhead" className="text-muted-foreground">
                {[
                  t('tripStats.countTrips', { count: bucket.trips }),
                  bucket.distance > 0 ? formatDistance({ metres: bucket.distance, unit }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: colors.grey5 }}
            >
              <View
                className="h-2 rounded-full"
                style={{ width: `${(bucket.trips / max) * 100}%`, backgroundColor: colors.primary }}
              />
            </View>
          </Pressable>
        ))}
      </View>
    </StatsCard>
  );
}

export function HighlightsCard({
  record,
  unit,
}: {
  record: TripStatsRecord;
  unit: TripDistanceUnit;
}) {
  const { t } = useTranslation();
  const rows: { key: string; label: string; value: string }[] = [];
  if (record.longestByNights) {
    rows.push({
      key: 'longest',
      label: t('tripStats.highlights.longest'),
      value: `${record.longestByNights.trip.name} · ${t('tripStats.countNights', { count: record.longestByNights.nights })}`,
    });
  }
  if (record.longestByDistance) {
    rows.push({
      key: 'farthest',
      label: t('tripStats.highlights.farthest'),
      value: `${record.longestByDistance.trip.name} · ${formatDistance({ metres: record.longestByDistance.trip.log?.distanceMeters ?? 0, unit })}`,
    });
  }
  if (record.averageNights != null) {
    rows.push({
      key: 'average',
      label: t('tripStats.highlights.average'),
      value: t('tripStats.highlights.averageNights', {
        value: formatDecimal(record.averageNights),
      }),
    });
  }
  if (record.averageDistance != null) {
    rows.push({
      key: 'averageDistance',
      label: t('tripStats.highlights.averageDistance'),
      value: formatDistance({ metres: record.averageDistance, unit }),
    });
  }
  if (record.busiestMonth != null) {
    rows.push({
      key: 'busiestMonth',
      label: t('tripStats.highlights.busiestMonth'),
      value: formatMonthName(record.busiestMonth),
    });
  }
  if (record.busiestSeason) {
    rows.push({
      key: 'busiestSeason',
      label: t('tripStats.highlights.busiestSeason'),
      value: t(`tripStats.highlights.seasons.${record.busiestSeason}`),
    });
  }
  if (rows.length === 0) return null;
  return (
    <StatsCard title={t('tripStats.highlights.title')}>
      <View>
        {rows.map((row) => (
          <StackedValueRow key={row.key} label={row.label} value={row.value} />
        ))}
      </View>
    </StatsCard>
  );
}

export function TopGearCard({ record }: { record: TripStatsRecord }) {
  const { t } = useTranslation();
  if (record.topGear.length === 0) return null;
  return (
    <StatsCard title={t('tripStats.gear.title')} subtitle={t('tripStats.gear.subtitle')}>
      <View>
        {record.topGear.map((gear) => (
          <ValueRow
            key={gear.id}
            label={gear.name}
            value={t('tripStats.gear.trips', { count: gear.trips })}
          />
        ))}
      </View>
    </StatsCard>
  );
}

export function BaseWeightCard({ record }: { record: TripStatsRecord }) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { unit, convertWeight } = useWeightUnit();
  if (record.packWeights.length < 2) return null;
  const max = Math.max(...record.packWeights.map((point) => point.grams), 1);
  const formatWeight = (grams: number) =>
    `${formatDecimal(convertWeight({ weight: grams, fromUnit: 'g' }))} ${unit}`;
  const { count, first, last } = weightSummary(record.packWeights);
  const summary = [
    t('tripStats.weight.summary', { trips: t('tripStats.countTrips', { count }) }),
    first && last
      ? t('tripStats.weight.summaryRange', {
          from: formatWeight(first.grams),
          to: formatWeight(last.grams),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <StatsCard
      title={t('tripStats.weight.title')}
      subtitle={t('tripStats.weight.subtitle')}
      summary={summary}
    >
      <View className="gap-2">
        {record.packWeights.map((point) => (
          <View key={point.id} className="gap-1">
            <View className="flex-row justify-between gap-2">
              <Text variant="subhead" className="flex-1 text-muted-foreground" numberOfLines={1}>
                {`${formatMonthDay(point.date)} · ${point.packName}`}
              </Text>
              <Text variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
                {formatWeight(point.grams)}
              </Text>
            </View>
            <View
              className="h-2 overflow-hidden rounded-full"
              style={{ backgroundColor: colors.grey5 }}
            >
              <View
                className="h-2 rounded-full"
                style={{ width: `${(point.grams / max) * 100}%`, backgroundColor: colors.primary }}
              />
            </View>
          </View>
        ))}
      </View>
    </StatsCard>
  );
}

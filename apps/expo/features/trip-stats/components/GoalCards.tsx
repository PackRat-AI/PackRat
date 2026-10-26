import type { TripBreakReasonSchema } from '@packrat/schemas/tripStats';
import { Button } from '@packrat/ui/src/button';
import { createDropdownItem, DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { Text } from '@packrat/ui/src/text';
import { differenceInCalendarDays, startOfDay } from 'date-fns';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { z } from 'zod';
import { findLongTrail } from '../lib/longTrails';
import { formatDecimal, formatMonthDay, useStatsFormat } from '../lib/useStatsFormat';
import {
  type GoalProgress,
  goalFraction,
  goalRemaining,
  isGoalComplete,
} from '../utils/goalProgress';
import type { Comeback } from '../utils/tripStats';
import { formatDistance, type TripDistanceUnit } from '../utils/units';
import { ProgressBar, StatsCard } from './StatsParts';

type BreakReason = z.infer<typeof TripBreakReasonSchema>;
const BREAK_REASONS = Object.freeze(['injury', 'illness', 'life', 'season'] as const);
const NO_REASON = 'none';

/**
 * "Back after 5 months": the return measured against the user's own pace before the break. The
 * reason is optional, picked from a Material 3 menu anchored to a text button.
 */
export function ComebackCard({
  comeback,
  reason,
  onReasonChange,
  unit,
}: {
  comeback: Comeback;
  reason: BreakReason | null;
  onReasonChange: (reason: BreakReason | null) => void;
  unit: TripDistanceUnit;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const rate = formatDecimal;
  const rows = [
    {
      key: 'trips',
      label: t('tripStats.comeback.trips'),
      now: rate(comeback.now.trips),
      before: rate(comeback.before.trips),
    },
    {
      key: 'nights',
      label: t('tripStats.comeback.nights'),
      now: rate(comeback.now.nights),
      before: rate(comeback.before.nights),
    },
    ...(comeback.now.distance != null && comeback.before.distance != null
      ? [
          {
            key: 'distance',
            label: t('tripStats.comeback.distance'),
            now: formatDistance({ metres: comeback.now.distance, unit }),
            before: formatDistance({ metres: comeback.before.distance, unit }),
          },
        ]
      : []),
  ];
  return (
    <StatsCard
      title={t('tripStats.comeback.title', { count: comeback.monthsAway })}
      subtitle={
        reason
          ? t(`tripStats.comeback.lines.${reason}`)
          : t('tripStats.comeback.since', {
              trip: comeback.trip.trip.name,
              date: formatMonthDay(comeback.trip.start),
            })
      }
    >
      <View>
        <View className="flex-row gap-4 pb-1">
          <Text variant="footnote" className="flex-1 text-muted-foreground">
            {t('tripStats.comeback.perMonth')}
          </Text>
          <Text variant="footnote" className="w-16 text-right text-muted-foreground">
            {t('tripStats.comeback.now')}
          </Text>
          <Text variant="footnote" className="w-16 text-right text-muted-foreground">
            {t('tripStats.comeback.before')}
          </Text>
        </View>
        {rows.map((row) => (
          <View key={row.key} className="min-h-9 flex-row items-center gap-4">
            <Text variant="body" className="flex-1">
              {row.label}
            </Text>
            <Text
              variant="body"
              className="w-16 text-right font-semibold"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {row.now}
            </Text>
            <Text
              variant="body"
              className="w-16 text-right text-muted-foreground"
              style={{ fontVariant: ['tabular-nums'] }}
            >
              {row.before}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="footnote" className="text-muted-foreground">
        {comeback.daysBack < 30 ? t('tripStats.comeback.underway') : t('tripStats.comeback.footer')}
      </Text>
      <DropdownMenu
        items={[
          ...BREAK_REASONS.map((value) =>
            createDropdownItem({
              actionKey: value,
              title: t(`tripStats.comeback.reasons.${value}`),
            }),
          ),
          createDropdownItem({ actionKey: NO_REASON, title: t('tripStats.comeback.ratherNotSay') }),
        ]}
        onItemPress={(item) => {
          const picked = BREAK_REASONS.find((value) => value === item.actionKey);
          onReasonChange(picked ?? null);
        }}
      >
        <Button variant="plain" className="self-start" testID={testIds.tripStats.whyAwayBtn}>
          <Icon name="message-text-outline" size={18} color={colors.primary} />
          <Text className="text-primary">
            {reason
              ? t('tripStats.comeback.awayFor', {
                  reason: t(`tripStats.comeback.reasons.${reason}`),
                })
              : t('tripStats.comeback.whyAway')}
          </Text>
        </Button>
      </DropdownMenu>
    </StatsCard>
  );
}

function useGoalStatus() {
  const { t } = useTranslation();
  const { formatMetric } = useStatsFormat();
  return (progress: GoalProgress): string => {
    const { metric } = progress.goal;
    if (isGoalComplete(progress)) return t('tripStats.goals.complete');
    if (progress.phase === 'upcoming') {
      return t('tripStats.goals.startsOn', { date: formatMonthDay(progress.start) });
    }
    if (progress.phase === 'ended') return t('tripStats.goals.ended');
    if (!progress.end) {
      return t('tripStats.goals.toGo', { amount: formatMetric(metric, goalRemaining(progress)) });
    }
    const pace =
      progress.pace?.kind === 'ahead'
        ? t('tripStats.goals.ahead', { amount: formatMetric(metric, progress.pace.by) })
        : progress.pace?.kind === 'behind'
          ? t('tripStats.goals.behind', { amount: formatMetric(metric, progress.pace.by) })
          : t('tripStats.goals.onPace');
    const days = differenceInCalendarDays(progress.end, startOfDay(new Date())) + 1;
    const left =
      days === 1 ? t('tripStats.goals.lastDay') : t('tripStats.goals.daysLeft', { count: days });
    return `${pace} · ${left}`;
  };
}

/** A goal's own name, else what it lists or measures. */
export function useGoalTitle() {
  const { t } = useTranslation();
  return (goal: GoalProgress['goal']): string => {
    const named = goal.name?.trim() || null;
    switch (goal.kind) {
      case 'longTrail':
        return findLongTrail(goal.trailCode)?.name ?? t('tripStats.goals.titles.longTrail');
      case 'peakList':
        return named ?? t('tripStats.goals.titles.peakList');
      case 'parkList':
        return (
          named ??
          (goal.parkCodes
            ? t('tripStats.goals.titles.parkList')
            : t('tripStats.goals.titles.everyPark'))
        );
      case 'custom':
        return named ?? t(`tripStats.goals.metrics.${goal.metric}`);
      default:
        return t(`tripStats.goals.metrics.${goal.metric}`);
    }
  };
}

function GoalRow({
  progress,
  onPress,
  onShare,
}: {
  progress: GoalProgress;
  onPress?: () => void;
  /** A long press shares the goal as a card, as the iOS context menu does. */
  onShare?: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { formatMetric, formatMetricValue } = useStatsFormat();
  const status = useGoalStatus();
  const title = useGoalTitle();
  const complete = isGoalComplete(progress);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onShare}
      disabled={!onPress}
      testID={testIds.tripStats.goalRow(progress.goal.id)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityActions={
        onShare ? [{ name: 'share', label: t('tripStats.share.shareGoal') }] : undefined
      }
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'share') onShare?.();
      }}
      android_ripple={onPress ? { color: colors.grey5 } : undefined}
      className="gap-2 py-3"
    >
      <View className="flex-row items-baseline justify-between gap-3">
        <Text variant="body" className="flex-1 font-medium" numberOfLines={1}>
          {title(progress.goal)}
        </Text>
        <Text variant="subhead" style={{ fontVariant: ['tabular-nums'] }}>
          {t('tripStats.goals.valueOf', {
            value: formatMetricValue(progress.goal.metric, progress.value),
            target: formatMetric(progress.goal.metric, progress.goal.target),
          })}
        </Text>
      </View>
      <ProgressBar progress={goalFraction(progress)} />
      <View className="flex-row items-center gap-1">
        {complete ? <Icon name="check-circle" size={16} color={colors.primary} /> : null}
        <Text variant="footnote" className={complete ? 'text-primary' : 'text-muted-foreground'}>
          {status(progress)}
        </Text>
      </View>
    </Pressable>
  );
}

export function GoalsCard({
  progress,
  onAdd,
  onEdit,
  onShare,
}: {
  progress: GoalProgress[];
  onAdd: () => void;
  onEdit: (goalId: string) => void;
  onShare: (progress: GoalProgress) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { formatMetric, formatMetricValue } = useStatsFormat();
  const title = useGoalTitle();
  const [showPast, setShowPast] = useState(false);
  const current = progress.filter((item) => item.phase !== 'ended');
  const past = progress.filter((item) => item.phase === 'ended');
  return (
    <StatsCard title={t('tripStats.goals.title')}>
      {current.length === 0 ? (
        <View className="gap-3">
          <Text variant="subhead" className="text-muted-foreground">
            {t('tripStats.goals.emptyBody')}
          </Text>
          <Button
            variant="tonal"
            className="self-start"
            onPress={onAdd}
            testID={testIds.tripStats.setGoalBtn}
          >
            <Text>{t('tripStats.goals.setGoal')}</Text>
          </Button>
        </View>
      ) : (
        <View>
          {current.map((item) => (
            <GoalRow
              key={item.goal.id}
              progress={item}
              onPress={() => onEdit(item.goal.id)}
              onShare={() => onShare(item)}
            />
          ))}
          <Button
            variant="plain"
            className="self-start"
            onPress={onAdd}
            testID={testIds.tripStats.addGoalBtn}
          >
            <Icon name="plus" size={18} color={colors.primary} />
            <Text className="text-primary">{t('tripStats.addGoal')}</Text>
          </Button>
        </View>
      )}
      {past.length > 0 ? (
        <View>
          <Pressable
            onPress={() => setShowPast((value) => !value)}
            testID={testIds.tripStats.pastGoalsToggle}
            accessibilityRole="button"
            accessibilityState={{ expanded: showPast }}
            android_ripple={{ color: colors.grey5 }}
            className="min-h-12 flex-row items-center justify-between"
          >
            <Text variant="body">{`${t('tripStats.goals.pastGoals')} (${past.length})`}</Text>
            <Icon name={showPast ? 'chevron-up' : 'chevron-down'} size={24} color={colors.grey} />
          </Pressable>
          {showPast
            ? past.map((item) => (
                <Pressable
                  key={item.goal.id}
                  onPress={() => onEdit(item.goal.id)}
                  testID={testIds.tripStats.goalRow(item.goal.id)}
                  android_ripple={{ color: colors.grey5 }}
                  className="min-h-12 flex-row items-center gap-3"
                >
                  <Icon
                    name={isGoalComplete(item) ? 'check-circle' : 'circle-outline'}
                    size={20}
                    color={isGoalComplete(item) ? colors.primary : colors.grey}
                  />
                  <Text variant="body" className="flex-1" numberOfLines={1}>
                    {title(item.goal)}
                  </Text>
                  <Text variant="subhead" className="text-muted-foreground">
                    {t('tripStats.goals.valueOf', {
                      value: formatMetricValue(item.goal.metric, item.value),
                      target: formatMetric(item.goal.metric, item.goal.target),
                    })}
                  </Text>
                </Pressable>
              ))
            : null}
        </View>
      ) : null}
    </StatsCard>
  );
}

import type { TripGoal } from '@packrat/schemas/tripStats';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Pressable, View } from 'react-native';
import { formatList } from '../lib/useStatsFormat';
import type { LongTrailProgress } from '../utils/longTrails';
import { formatDistance, type TripDistanceUnit } from '../utils/units';
import { ProgressBar, StatsCard } from './StatsParts';

/** "212 of 2,650 mi · 8%". A sliver under 1% reads "<1%", never "0%". */
export function useLongTrailSummary(unit: TripDistanceUnit) {
  const { t } = useTranslation();
  return (progress: LongTrailProgress): string => {
    const percent = progress.fraction * 100;
    const share = percent > 0 && percent < 1 ? '<1%' : `${Math.floor(percent)}%`;
    const value = formatDistance({ metres: progress.meters, unit });
    const space = value.lastIndexOf(' ');
    return t('tripStats.longTrails.summary', {
      value: space > 0 ? value.slice(0, space) : value,
      total: formatDistance({ metres: progress.trail.officialMeters, unit }),
      share,
    });
  };
}

function LongTrailRow({
  progress,
  isFollowed,
  unit,
  onPress,
}: {
  progress: LongTrailProgress;
  isFollowed: boolean;
  unit: TripDistanceUnit;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const summary = useLongTrailSummary(unit);
  return (
    <Pressable
      onPress={onPress}
      testID={testIds.tripStats.longTrailRow(progress.trail.code)}
      accessibilityRole="button"
      android_ripple={{ color: colors.grey5 }}
      className="flex-row items-center gap-3 py-3"
    >
      <View className="flex-1 gap-2">
        <View className="flex-row items-center gap-2">
          <Text variant="body" className="shrink font-medium" numberOfLines={1}>
            {progress.trail.name}
          </Text>
          {isFollowed ? null : (
            <View className="rounded-lg px-2 py-0.5" style={{ backgroundColor: colors.grey5 }}>
              <Text variant="caption1" className="text-muted-foreground">
                {t('tripStats.longTrails.notFollowed')}
              </Text>
            </View>
          )}
        </View>
        <ProgressBar progress={progress.fraction} />
        <Text
          variant="footnote"
          className="text-muted-foreground"
          style={{ fontVariant: ['tabular-nums'] }}
        >
          {summary(progress)}
        </Text>
      </View>
      <Icon name="chevron-right" size={24} color={colors.grey} />
    </Pressable>
  );
}

/**
 * The trails a user follows, then any they've walked part of without following, each with a bar
 * of distance done. With neither, the card invites them to follow one.
 */
export function LongTrailsCard({
  progress,
  followGoals,
  unit,
  onOpen,
  onFollow,
}: {
  progress: readonly LongTrailProgress[];
  followGoals: ReadonlyMap<string, TripGoal>;
  unit: TripDistanceUnit;
  onOpen: (code: string) => void;
  onFollow: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const shown = progress
    .filter((item) => followGoals.has(item.trail.code) || item.walked.size > 0)
    .sort(
      (a, b) =>
        Number(followGoals.has(b.trail.code)) - Number(followGoals.has(a.trail.code)) ||
        b.fraction - a.fraction,
    );
  return (
    <StatsCard title={t('tripStats.longTrails.title')} testID={testIds.tripStats.longTrailsCard}>
      {shown.length === 0 ? (
        <View className="gap-3">
          <Text variant="subhead" className="text-muted-foreground">
            {t('tripStats.longTrails.followBody', {
              trails: formatList(progress.map((item) => item.trail.name)),
            })}
          </Text>
          <Button
            variant="tonal"
            className="self-start"
            onPress={onFollow}
            testID={testIds.tripStats.followTrailBtn}
          >
            <Text>{t('tripStats.longTrails.followTitle')}</Text>
          </Button>
        </View>
      ) : (
        <View>
          {shown.map((item) => (
            <LongTrailRow
              key={item.trail.code}
              progress={item}
              isFollowed={followGoals.has(item.trail.code)}
              unit={unit}
              onPress={() => onOpen(item.trail.code)}
            />
          ))}
          {followGoals.size < progress.length ? (
            <Button
              variant="plain"
              className="self-start"
              onPress={onFollow}
              testID={testIds.tripStats.followTrailBtn}
            >
              <Icon name="plus" size={18} color={colors.primary} />
              <Text className="text-primary">{t('tripStats.longTrails.followTrail')}</Text>
            </Button>
          ) : null}
        </View>
      )}
    </StatsCard>
  );
}

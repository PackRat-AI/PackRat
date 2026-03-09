import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { View } from 'react-native';
import type { TrailConditionReport, TrailSurface, WaterCrossingDifficulty } from '../types';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionReportCardProps {
  report: TrailConditionReport;
}

// Translation key maps for domain values
const SURFACE_KEYS: Record<TrailSurface, string> = {
  paved: 'trailConditions.surfacePaved',
  gravel: 'trailConditions.surfaceGravel',
  dirt: 'trailConditions.surfaceDirt',
  rocky: 'trailConditions.surfaceRocky',
  snow: 'trailConditions.surfaceSnow',
  mud: 'trailConditions.surfaceMud',
};

const WATER_DIFFICULTY_KEYS: Record<WaterCrossingDifficulty, string> = {
  easy: 'trailConditions.difficultyEasy',
  moderate: 'trailConditions.difficultyModerate',
  difficult: 'trailConditions.difficultyDifficult',
};

const HAZARD_KEYS: Record<string, string> = {
  'fallen trees': 'trailConditions.hazardFallenTrees',
  wildlife: 'trailConditions.hazardWildlife',
  erosion: 'trailConditions.hazardErosion',
  closure: 'trailConditions.hazardClosure',
  ice: 'trailConditions.hazardIce',
  flooding: 'trailConditions.hazardFlooding',
  'loose rock': 'trailConditions.hazardLooseRock',
};

export function TrailConditionReportCard({ report }: TrailConditionReportCardProps) {
  const { t } = useTranslation();

  function formatRelativeTime(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Math.max(0, Date.now() - date.getTime());
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return t('trailConditions.today');
    if (diffDays === 1) return t('trailConditions.oneDayAgo');
    if (diffDays < 7) return t('trailConditions.nDaysAgo', { count: diffDays });
    if (diffDays < 14) return t('trailConditions.oneWeekAgo');
    if (diffDays < 30) return t('trailConditions.nWeeksAgo', { count: Math.floor(diffDays / 7) });
    return date.toLocaleDateString();
  }

  const surfaceLabel = SURFACE_KEYS[report.surface as TrailSurface]
    ? t(SURFACE_KEYS[report.surface as TrailSurface])
    : report.surface;

  const difficultyLabel = report.waterCrossingDifficulty
    ? WATER_DIFFICULTY_KEYS[report.waterCrossingDifficulty as WaterCrossingDifficulty]
      ? t(WATER_DIFFICULTY_KEYS[report.waterCrossingDifficulty as WaterCrossingDifficulty])
      : report.waterCrossingDifficulty
    : null;

  const hazardLabels = (report.hazards ?? []).map((h) =>
    HAZARD_KEYS[h.toLowerCase()] ? t(HAZARD_KEYS[h.toLowerCase()]) : h,
  );

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
      <View className="border-b border-border p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="heading" className="flex-1 font-semibold">
            {report.trailName}
          </Text>
          <ConditionBadge condition={report.overallCondition} />
        </View>
        {report.trailRegion ? (
          <Text variant="subhead" className="mt-1 text-muted-foreground">
            {report.trailRegion} • {formatRelativeTime(report.createdAt ?? report.localCreatedAt)}
          </Text>
        ) : (
          <Text variant="subhead" className="mt-1 text-muted-foreground">
            {formatRelativeTime(report.createdAt ?? report.localCreatedAt)}
          </Text>
        )}
      </View>

      <View className="p-4">
        <View className="mb-3 flex-row flex-wrap gap-2">
          <View className="rounded-md bg-muted px-2 py-1 dark:bg-gray-50/10">
            <Text variant="footnote">
              {t('trailConditions.surface')}: {surfaceLabel}
            </Text>
          </View>
          {report.waterCrossings > 0 && (
            <View className="rounded-md bg-muted px-2 py-1 dark:bg-gray-50/10">
              <Text variant="footnote">
                {t('trailConditions.waterCrossings')}: {report.waterCrossings}
                {difficultyLabel ? ` (${difficultyLabel})` : ''}
              </Text>
            </View>
          )}
        </View>

        {hazardLabels.length > 0 && (
          <View className="mb-3">
            <Text
              variant="footnote"
              className="mb-1 font-medium text-amber-600 dark:text-amber-400"
            >
              ⚠ {t('trailConditions.hazards')}: {hazardLabels.join(', ')}
            </Text>
          </View>
        )}

        {report.notes ? (
          <Text variant="body" className="text-foreground">
            {report.notes}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

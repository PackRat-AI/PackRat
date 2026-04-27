import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { View } from 'react-native';
import type { TrailConditionReport, TrailSurface, WaterCrossingDifficulty } from '../types';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionReportCardProps {
  report: TrailConditionReport;
}

// Display label maps for domain values. These are plain English strings
// rather than i18n keys because the trail-condition taxonomy is not yet
// localized in the translation catalog.
const SURFACE_LABELS: Record<TrailSurface, string> = {
  paved: 'Paved',
  gravel: 'Gravel',
  dirt: 'Dirt',
  rocky: 'Rocky',
  snow: 'Snow',
  mud: 'Mud',
};

const WATER_DIFFICULTY_LABELS: Record<WaterCrossingDifficulty, string> = {
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
};

const HAZARD_LABELS: Record<string, string> = {
  'fallen trees': 'Fallen trees',
  wildlife: 'Wildlife',
  erosion: 'Erosion',
  closure: 'Closure',
  ice: 'Ice',
  flooding: 'Flooding',
  'loose rock': 'Loose rock',
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
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  const surfaceLabel = SURFACE_LABELS[report.surface] ?? report.surface;

  const difficultyLabel = report.waterCrossingDifficulty
    ? (WATER_DIFFICULTY_LABELS[report.waterCrossingDifficulty] ?? report.waterCrossingDifficulty)
    : null;

  const hazardLabels = (report.hazards ?? []).map((h) => HAZARD_LABELS[h.toLowerCase()] ?? h);

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

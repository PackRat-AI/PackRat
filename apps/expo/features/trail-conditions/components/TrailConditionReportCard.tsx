import { Text } from '@packrat/ui/nativewindui';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { View } from 'react-native';
import type { TrailConditionReport } from '../types';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionReportCardProps {
  report: TrailConditionReport;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString();
}

export function TrailConditionReportCard({ report }: TrailConditionReportCardProps) {
  const { t } = useTranslation();

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
              {t('trailConditions.surface')}: {report.surface}
            </Text>
          </View>
          {report.waterCrossings > 0 && (
            <View className="rounded-md bg-muted px-2 py-1 dark:bg-gray-50/10">
              <Text variant="footnote">
                {t('trailConditions.waterCrossings')}: {report.waterCrossings}
                {report.waterCrossingDifficulty ? ` (${report.waterCrossingDifficulty})` : ''}
              </Text>
            </View>
          )}
        </View>

        {report.hazards && report.hazards.length > 0 && (
          <View className="mb-3">
            <Text
              variant="footnote"
              className="mb-1 font-medium text-amber-600 dark:text-amber-400"
            >
              ⚠ {t('trailConditions.hazards')}: {report.hazards.join(', ')}
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

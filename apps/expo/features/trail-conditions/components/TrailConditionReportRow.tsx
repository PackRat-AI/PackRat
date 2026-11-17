import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { getRelativeTime } from 'expo-app/lib/utils/getRelativeTime';
import { Pressable, View } from 'react-native';
import { formatTrailDistance, isPinnedReport, type SignedReport } from '../utils/trails';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionReportRowProps {
  report: SignedReport;
  /** The report is still in the outbox. */
  isPending?: boolean;
  /** Off on a trail page, where every row is the same trail. */
  showsTrail?: boolean;
  onPress: () => void;
}

/**
 * One report in a list — `TrailReportRow` / `TripConditionRow` in the Swift app: the trail (or
 * pin) with the condition badge trailing, then who wrote it and when, the hazards, and how far
 * from a trip's destination when the list is of nearby trails.
 *
 * Deliberately a React Native row rather than a native Compose `ListItem`. A per-row `Host`
 * inside a virtualized scroller claims the vertical drag and stops the list scrolling on Android
 * (verified on-device; see `docs/migrations/nativewindui-to-expo-ui.md`).
 */
export function TrailConditionReportRow({
  report,
  isPending = false,
  showsTrail = true,
  onPress,
}: TrailConditionReportRowProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { unit } = useSpeedUnit();
  const pinned = isPinnedReport(report);
  const when = getRelativeTime({ dateValue: report.localCreatedAt ?? report.createdAt, t });
  const meta = [
    report.authorName,
    isPending ? t('trailConditions.waitingToSend') : when,
    report.distanceM != null
      ? t('trailConditions.distanceAway', {
          distance: formatTrailDistance({ meters: report.distanceM, imperial: unit === 'mph' }),
        })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const title = showsTrail ? report.trailName : report.notes || when;

  return (
    <Pressable
      onPress={onPress}
      testID={testIds.trailConditions.reportRow(report.id)}
      accessibilityRole="button"
      accessibilityLabel={`${report.trailName}, ${report.overallCondition}`}
      className="flex-row items-center gap-3 border-b border-border bg-background px-4 py-3 active:bg-muted"
    >
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          {showsTrail && pinned ? (
            <View accessible accessibilityLabel={t('trailConditions.droppedPin')}>
              <Icon name="map-marker" size={14} color={colors.grey} />
            </View>
          ) : null}
          {report.unread ? <View className="h-2 w-2 rounded-full bg-primary" /> : null}
          <Text variant="body" className="flex-1 font-semibold" numberOfLines={1}>
            {title}
          </Text>
          <ConditionBadge condition={report.overallCondition} />
        </View>
        {report.hazards.length > 0 ? (
          <Text variant="footnote" className="text-amber-600 dark:text-amber-400" numberOfLines={1}>
            {report.hazards.join(', ')}
          </Text>
        ) : null}
        <View className="flex-row items-center gap-1">
          {isPending ? <Icon name="cloud-upload-outline" size={12} color={colors.grey} /> : null}
          <Text variant="caption1" className="flex-1 text-muted-foreground" numberOfLines={1}>
            {meta}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color={colors.grey} />
    </Pressable>
  );
}

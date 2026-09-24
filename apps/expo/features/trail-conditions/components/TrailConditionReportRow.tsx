import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { testIds } from 'expo-app/lib/testIds';
import { Pressable, View } from 'react-native';
import { timeAgo } from '../lib/timeAgo';
import type { TrailConditionReport } from '../types';
import { ConditionBadge } from './ConditionBadge';

interface TrailConditionReportRowProps {
  report: TrailConditionReport;
  onPress: () => void;
}

/**
 * One row in the reports list — `TrailReportRow` in `TrailConditionsView.swift`: trail name with
 * the condition badge trailing, region and relative time beneath.
 *
 * Deliberately a React Native row rather than a native Compose `ListItem`. A per-row `Host`
 * inside a virtualized scroller claims the vertical drag and stops the list scrolling on Android
 * (verified on-device; see `docs/migrations/nativewindui-to-expo-ui.md`). Native controls are
 * used for the *leaf controls* in the submit form, where that constraint does not apply.
 */
export function TrailConditionReportRow({ report, onPress }: TrailConditionReportRowProps) {
  const { colors } = useColorScheme();

  return (
    <Pressable
      onPress={onPress}
      testID={testIds.trailConditions.reportRow(report.id)}
      accessibilityRole="button"
      accessibilityLabel={report.trailName}
      className="flex-row items-center gap-3 border-b border-border bg-background px-4 py-3 active:bg-muted"
    >
      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <Text variant="body" className="flex-1 font-semibold" numberOfLines={1}>
            {report.trailName}
          </Text>
          <ConditionBadge condition={report.overallCondition} />
        </View>
        <View className="flex-row items-center gap-2">
          {report.trailRegion ? (
            <View className="flex-row items-center gap-1">
              <Icon name="map-marker" size={12} color={colors.grey} />
              <Text variant="caption1" className="text-muted-foreground" numberOfLines={1}>
                {report.trailRegion}
              </Text>
            </View>
          ) : null}
          <Text variant="caption1" className="text-muted-foreground">
            {timeAgo(report.createdAt ?? report.localCreatedAt)}
          </Text>
        </View>
      </View>
      <Icon name="chevron-right" size={18} color={colors.grey} />
    </Pressable>
  );
}

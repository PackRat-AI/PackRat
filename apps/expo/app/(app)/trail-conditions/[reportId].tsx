import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { DropdownMenu } from '@packrat/ui/src/dropdown-menu';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { TrailConditionDetail } from 'expo-app/features/trail-conditions/components/TrailConditionDetail';
import { useReportActions } from 'expo-app/features/trail-conditions/hooks/useReportActions';
import {
  useCachedReport,
  usePendingReportIds,
  useTrailConditions,
} from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

/**
 * A single report — `TrailConditionDetailView` in `TrailConditionsView.swift`. Reached from the
 * feed, a trail page or a trip, all of which have the report loaded already.
 */
export default function TrailConditionDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { isLoading } = useTrailConditions();
  const report = useCachedReport(reportId);
  const pendingIds = usePendingReportIds();
  const actions = useReportActions({ report, onHidden: () => router.back() });

  if (!report) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-8">
        <Stack.Screen options={{ ...getAppBarOptions(), title: '' }} />
        {isLoading ? (
          <ActivityIndicator />
        ) : (
          <Text variant="body" className="text-center text-muted-foreground" wrap>
            {t('trailConditions.reportNotFound')}
          </Text>
        )}
      </View>
    );
  }

  const trailId = report.trailId;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: report.trailName,
          headerRight: () =>
            actions.isOwn ? (
              <Pressable
                onPress={actions.confirmDelete}
                disabled={actions.isBusy}
                testID={testIds.trailConditions.deleteReportBtn(report.id)}
                accessibilityRole="button"
                accessibilityLabel={t('common.delete')}
                className="mr-2 p-2"
              >
                <Icon name="trash-can-outline" size={22} color={colors.destructive} />
              </Pressable>
            ) : (
              <DropdownMenu items={actions.menuItems} onItemPress={actions.onMenuItemPress}>
                <Pressable
                  disabled={actions.isBusy}
                  testID={testIds.trailConditions.reportMenuBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.more')}
                  className="mr-2 p-2"
                >
                  <Icon name="dots-vertical" size={22} color={colors.foreground} />
                </Pressable>
              </DropdownMenu>
            ),
        }}
      />
      {actions.dialogs}
      <TrailConditionDetail
        report={report}
        isPending={pendingIds.has(report.id)}
        onOpenTrail={
          trailId
            ? () =>
                router.push({
                  pathname: '/trail-conditions/trail/[trailId]',
                  params: { trailId, name: report.trailName },
                })
            : undefined
        }
      />
    </View>
  );
}

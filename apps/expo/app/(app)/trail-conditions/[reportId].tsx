import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useAuthState } from 'expo-app/features/auth/hooks/useAuthState';
import { TrailConditionDetail } from 'expo-app/features/trail-conditions/components/TrailConditionDetail';
import {
  useDeleteTrailConditionReport,
  useTrailConditions,
} from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, View } from 'react-native';

/**
 * A single report — `TrailConditionDetailView` in `TrailConditionsView.swift`.
 *
 * Reads from the list cache rather than fetching by id: the API has no single-report GET, and
 * the user always arrives here from the list, so the report is already loaded. Matches the Swift
 * detail view, which is handed a `TrailConditionReport` value rather than an id.
 */
export default function TrailConditionDetailScreen() {
  const { reportId } = useLocalSearchParams<{ reportId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { user } = useAuthState();
  const { reports, isLoading } = useTrailConditions();
  const { mutate: deleteReport, isPending: isDeleting } = useDeleteTrailConditionReport();

  const report = reports.find((item) => item.id === reportId);

  // Only the author may delete: the API scopes DELETE to the owner and 403s otherwise, so
  // showing the action to anyone else would offer a button that cannot work.
  const canDelete = report != null && user?.id != null && String(user.id) === report.userId;

  const confirmDelete = () => {
    Alert.alert(t('trailConditions.deleteReportTitle'), t('trailConditions.deleteReportMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () =>
          deleteReport(reportId, {
            onSuccess: () => router.back(),
            onError: (error) =>
              Alert.alert(
                t('common.error'),
                error instanceof Error ? error.message : String(error),
              ),
          }),
      },
    ]);
  };

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

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          ...getAppBarOptions(),
          title: report.trailName,
          headerRight: canDelete
            ? () => (
                <Pressable
                  onPress={confirmDelete}
                  disabled={isDeleting}
                  testID={testIds.trailConditions.deleteReportBtn(report.id)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  className="mr-2 p-2"
                >
                  <Icon name="trash-can-outline" size={22} color={colors.destructive} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <TrailConditionDetail report={report} />
    </View>
  );
}

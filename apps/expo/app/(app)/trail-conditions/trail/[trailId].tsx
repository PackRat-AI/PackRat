import { getAppBarOptions } from '@packrat/ui/src/app-bar';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { TrailConditionReportRow } from 'expo-app/features/trail-conditions/components/TrailConditionReportRow';
import {
  usePendingReportIds,
  useTrail,
  useTrailReports,
} from 'expo-app/features/trail-conditions/hooks/useTrailConditions';
import {
  formatTrailDistance,
  type TrailLine,
} from 'expo-app/features/trail-conditions/utils/trails';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';

/** The region that fits every point of the trail, with a margin. */
function regionFor(lines: TrailLine[]) {
  const points = lines.flat();
  const lats = points.map(([, lat]) => lat);
  const lons = points.map(([lon]) => lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.3, 0.005),
    longitudeDelta: Math.max((maxLon - minLon) * 1.3, 0.005),
  };
}

/**
 * Everything known about one trail's conditions — `TrailPageView` in the Swift app: the trail's
 * line, what it's like now first, the history underneath. Reports that disagree are both shown;
 * nothing is averaged into one verdict. A trail nobody has reported on still has a page, inviting
 * the first report.
 */
export default function TrailPageScreen() {
  const { trailId, name } = useLocalSearchParams<{ trailId: string; name?: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { unit } = useSpeedUnit();
  const trail = useTrail(trailId);
  const reports = useTrailReports(trailId);
  const pendingIds = usePendingReportIds();
  const enableTrips = useFeatureFlag('enableTrips');

  const lines = trail.data?.lines ?? [];
  const region = useMemo(() => (lines.length > 0 ? regionFor(lines) : null), [lines]);
  const trailName = trail.data?.summary.name ?? name ?? '';
  const lengthM = trail.data?.summary.lengthM ?? 0;
  const count = reports.reports.length;
  const subtitle = [
    lengthM > 0 ? formatTrailDistance(lengthM, unit === 'mph') : null,
    count > 0 ? t('trailConditions.reportCount', { count }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const [latest, ...earlier] = reports.reports;
  const openReport = (id: string) => router.push(`/trail-conditions/${id}`);

  const renderReports = () => {
    if (reports.isError && count === 0) {
      return (
        <View className="items-start gap-2">
          <Text variant="callout" className="text-muted-foreground">
            {t('trailConditions.trailReportsLoadError')}
          </Text>
          <Button variant="outlined" className="h-10 px-6" onPress={() => reports.refetch()}>
            {t('trailConditions.tryAgain')}
          </Button>
        </View>
      );
    }
    if (reports.isLoading && count === 0) {
      return (
        <View className="flex-row items-center gap-3">
          <ActivityIndicator />
          <Text variant="callout" className="text-muted-foreground">
            {t('trailConditions.loadingReports')}
          </Text>
        </View>
      );
    }
    if (!latest) {
      return (
        <View className="items-center gap-2 rounded-xl bg-card px-6 py-8">
          <Icon name="hiking" size={32} color={colors.grey} />
          <Text variant="heading">{t('trailConditions.noReportsOnTrailTitle')}</Text>
          <Text variant="callout" className="text-center text-muted-foreground" wrap>
            {t('trailConditions.noReportsOnTrail')}
          </Text>
        </View>
      );
    }
    return (
      <View className="gap-2">
        <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
          {t('trailConditions.latest')}
        </Text>
        <View className="overflow-hidden rounded-xl">
          <TrailConditionReportRow
            report={latest}
            isPending={pendingIds.has(latest.id)}
            showsTrail={false}
            onPress={() => openReport(latest.id)}
          />
        </View>
        {earlier.length > 0 ? (
          <>
            <Text variant="caption1" className="mt-4 uppercase tracking-wide text-muted-foreground">
              {t('trailConditions.earlier')}
            </Text>
            <View className="overflow-hidden rounded-xl">
              {earlier.map((report) => (
                <TrailConditionReportRow
                  key={report.id}
                  report={report}
                  isPending={pendingIds.has(report.id)}
                  showsTrail={false}
                  onPress={() => openReport(report.id)}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ ...getAppBarOptions(), title: t('trailConditions.trail') }} />
      <ScrollView
        contentContainerClassName="gap-5 p-4 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={reports.isRefetching}
            onRefresh={() => {
              reports.refetch();
              trail.refetch();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {region ? (
          <View
            className="h-52 overflow-hidden rounded-2xl"
            accessible
            accessibilityLabel={trailName}
          >
            <MapView style={{ flex: 1 }} initialRegion={region} pointerEvents="none">
              {lines.map((line) => (
                <Polyline
                  key={`${line[0]?.[0]},${line[0]?.[1]},${line.length}`}
                  coordinates={line.map(([longitude, latitude]) => ({ latitude, longitude }))}
                  strokeColor={colors.primary}
                  strokeWidth={4}
                />
              ))}
            </MapView>
          </View>
        ) : null}

        <View className="gap-1">
          <Text variant="title1" className="font-bold" accessibilityRole="header">
            {trailName}
          </Text>
          {subtitle ? (
            <Text variant="callout" className="text-muted-foreground">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="flex-row gap-3">
          <Button
            className="h-10 flex-1 gap-2 pl-4 pr-6"
            onPress={() =>
              router.push({
                pathname: '/trail-conditions/submit',
                params: { trailId, trailName },
              })
            }
            testID={testIds.trailConditions.trailPageWriteReportBtn}
          >
            <Icon name="pencil-outline" size={18} color="white" />
            <Text className="font-medium text-primary-foreground">
              {t('trailConditions.writeReport')}
            </Text>
          </Button>
          {enableTrips ? (
            <Button
              className="h-10 flex-1 gap-2 pl-4 pr-6"
              variant="outlined"
              onPress={() => {
                const center = trail.data?.summary.center;
                router.push({
                  pathname: '/trip/new',
                  params: {
                    trailId,
                    trailName,
                    ...(center
                      ? { lat: String(center.latitude), lon: String(center.longitude) }
                      : {}),
                  },
                });
              }}
              testID={testIds.trailConditions.trailPagePlanTripBtn}
            >
              <Icon name="map-outline" size={18} color={colors.primary} />
              <Text className="font-medium text-primary">{t('trailConditions.planTrip')}</Text>
            </Button>
          ) : null}
        </View>

        {renderReports()}
      </ScrollView>
    </View>
  );
}

import { ActivityIndicator, LargeTitleHeader, Text } from '@packrat/ui/nativewindui';
import { Icon, type MaterialIconName } from '@roninoss/icons';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useTripAnalytics } from '../hooks/useTripAnalytics';

function StatCard({
  label,
  value,
  subValue,
  iconName,
  iconColor,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  iconName: MaterialIconName;
  iconColor: string;
}) {
  return (
    <View className="flex-1 min-w-[44%] rounded-xl bg-card p-4 m-1">
      <View
        className="mb-2 h-8 w-8 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${iconColor}22` }}
      >
        <Icon name={iconName} size={18} color={iconColor} />
      </View>
      <Text variant="largeTitle" className="font-bold text-foreground">
        {value}
      </Text>
      <Text variant="footnote" className="text-muted-foreground mt-0.5">
        {label}
      </Text>
      {subValue ? (
        <Text variant="caption2" className="text-muted-foreground mt-1 italic">
          {subValue}
        </Text>
      ) : null}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text variant="headline" className="font-semibold text-foreground mt-6 mb-2 px-1">
      {title}
    </Text>
  );
}

export function TripAnalyticsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: analytics, isLoading, error, refetch } = useTripAnalytics();

  if (isLoading) {
    return (
      <View className="flex-1">
        <LargeTitleHeader title={t('analytics.title')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" />
        </View>
      </View>
    );
  }

  if (error || !analytics) {
    return (
      <View className="flex-1">
        <LargeTitleHeader title={t('analytics.title')} />
        <View className="flex-1 items-center justify-center p-8">
          <Icon name="alert-circle-outline" size={48} color="#9ca3af" />
          <Text variant="heading" className="mt-4 text-center text-muted-foreground">
            {t('analytics.errorLoading')}
          </Text>
          <Pressable className="mt-4 rounded-lg bg-primary px-6 py-2" onPress={() => refetch()}>
            <Text className="font-medium text-primary-foreground">{t('common.retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const yearDiff = analytics.currentYearTrips - analytics.lastYearTrips;
  const yearDiffLabel =
    yearDiff > 0
      ? `+${yearDiff} ${t('analytics.vsLastYear')}`
      : yearDiff < 0
        ? `${yearDiff} ${t('analytics.vsLastYear')}`
        : t('analytics.sameAsLastYear');

  const maxMonthCount = Math.max(
    analytics.tripsByMonth.reduce((max, m) => Math.max(max, m.count), 0),
    1,
  );

  // Minimum bar height percentage for months with trips, to ensure visibility
  const MIN_BAR_HEIGHT_PCT = 5;

  return (
    <View className="flex-1">
      <LargeTitleHeader title={t('analytics.title')} />
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-12">
        {/* Core stats */}
        <SectionHeader title={t('analytics.coreStats')} />
        <View className="flex-row flex-wrap -m-1">
          <StatCard
            label={t('analytics.totalTrips')}
            value={analytics.totalTrips}
            iconName="map-outline"
            iconColor="#3b82f6"
          />
          <StatCard
            label={t('analytics.completedTrips')}
            value={analytics.completedTrips}
            iconName="check-circle-outline"
            iconColor="#22c55e"
          />
          <StatCard
            label={t('analytics.upcomingTrips')}
            value={analytics.upcomingTrips}
            iconName="calendar-outline"
            iconColor="#f97316"
          />
          <StatCard
            label={t('analytics.totalNights')}
            value={analytics.totalNightsOutdoors}
            iconName="weather-night"
            iconColor="#8b5cf6"
          />
        </View>

        {/* Duration stats */}
        <SectionHeader title={t('analytics.durationStats')} />
        <View className="flex-row flex-wrap -m-1">
          <StatCard
            label={t('analytics.avgDuration')}
            value={
              analytics.averageTripDurationDays !== null
                ? `${analytics.averageTripDurationDays}d`
                : '—'
            }
            iconName="timer-outline"
            iconColor="#06b6d4"
          />
          <StatCard
            label={t('analytics.longestTrip')}
            value={analytics.longestTripDays !== null ? `${analytics.longestTripDays}d` : '—'}
            subValue={analytics.longestTripName ?? undefined}
            iconName="trophy-outline"
            iconColor="#eab308"
          />
        </View>

        {/* Year-over-year */}
        <SectionHeader title={t('analytics.yearOverYear')} />
        <View className="rounded-xl bg-card p-4">
          <View className="flex-row justify-between mb-3">
            <View className="items-center flex-1">
              <Text variant="largeTitle" className="font-bold text-foreground">
                {analytics.currentYearTrips}
              </Text>
              <Text variant="footnote" className="text-muted-foreground">
                {t('analytics.thisYear')}
              </Text>
            </View>
            <View className="items-center flex-1">
              <Text variant="largeTitle" className="font-bold text-foreground">
                {analytics.lastYearTrips}
              </Text>
              <Text variant="footnote" className="text-muted-foreground">
                {t('analytics.lastYear')}
              </Text>
            </View>
          </View>
          <View
            className={`rounded-full px-3 py-1 self-center ${
              yearDiff > 0 ? 'bg-green-500/15' : yearDiff < 0 ? 'bg-red-500/15' : 'bg-muted'
            }`}
          >
            <Text
              variant="caption1"
              className={
                yearDiff > 0
                  ? 'text-green-600'
                  : yearDiff < 0
                    ? 'text-red-600'
                    : 'text-muted-foreground'
              }
            >
              {yearDiffLabel}
            </Text>
          </View>
        </View>

        {/* Monthly activity chart */}
        <SectionHeader title={t('analytics.monthlyActivity')} />
        <View className="rounded-xl bg-card p-4">
          {analytics.tripsByMonth.length > 0 ? (
            <>
              <View className="h-32 flex-row items-end justify-between gap-0.5">
                {analytics.tripsByMonth.map((item) => {
                  const heightPct = maxMonthCount > 0 ? (item.count / maxMonthCount) * 100 : 0;
                  return (
                    <View key={item.month} className="flex-1 items-center">
                      <View
                        className="w-full rounded-t-sm bg-primary"
                        style={{
                          height: `${Math.max(heightPct, item.count > 0 ? MIN_BAR_HEIGHT_PCT : 0)}%`,
                        }}
                      />
                    </View>
                  );
                })}
              </View>
              <View className="mt-2 flex-row justify-between">
                {analytics.tripsByMonth
                  .filter((_, i) => i % 3 === 0)
                  .map((item) => (
                    <Text key={item.month} variant="caption2" className="text-muted-foreground">
                      {item.month.split(' ')[0]}
                    </Text>
                  ))}
              </View>
              {analytics.mostActiveMonth ? (
                <Text variant="footnote" className="mt-3 text-center text-muted-foreground">
                  {t('analytics.mostActiveMonthLabel', {
                    month: analytics.mostActiveMonth,
                    count: analytics.mostActiveMonthCount ?? 0,
                  })}
                </Text>
              ) : null}
            </>
          ) : (
            <Text variant="footnote" className="text-center text-muted-foreground py-6">
              {t('analytics.noActivityData')}
            </Text>
          )}
        </View>

        {/* Geographic stats */}
        <SectionHeader title={t('analytics.geographic')} />
        <View className="flex-row flex-wrap -m-1">
          <StatCard
            label={t('analytics.locationsVisited')}
            value={analytics.locationsVisited}
            iconName="map-marker-outline"
            iconColor="#ec4899"
          />
          <StatCard
            label={t('analytics.uniqueRegions')}
            value={analytics.uniqueRegions.length}
            iconName="earth"
            iconColor="#14b8a6"
          />
        </View>
        {analytics.uniqueRegions.length > 0 && (
          <View className="mt-2 rounded-xl bg-card p-4">
            <Text variant="subhead" className="font-medium text-foreground mb-2">
              {t('analytics.regionsVisited')}
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {analytics.uniqueRegions.map((region) => (
                <View key={region} className="rounded-full bg-primary/10 px-3 py-1">
                  <Text variant="caption1" className="text-primary">
                    {region}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* CTA to add more trips */}
        {analytics.totalTrips === 0 && (
          <View className="mt-6 rounded-xl bg-card p-6 items-center">
            <Icon name="map-outline" size={40} color="#9ca3af" />
            <Text variant="heading" className="mt-3 font-semibold text-foreground text-center">
              {t('analytics.noTripsTitle')}
            </Text>
            <Text variant="subhead" className="mt-1 text-muted-foreground text-center">
              {t('analytics.noTripsSubtitle')}
            </Text>
            <Pressable
              className="mt-4 rounded-lg bg-primary px-6 py-2"
              onPress={() => router.push('/trip/new')}
            >
              <Text className="font-medium text-primary-foreground">
                {t('trips.createNewTrip')}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

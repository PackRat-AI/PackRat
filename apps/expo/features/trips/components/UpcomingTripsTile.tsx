import { ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { featureFlags } from 'expo-app/config';
import { useTrips } from 'expo-app/features/trips/hooks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { parseLocalDate } from 'expo-app/lib/utils/dateUtils';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

export function UpcomingTripsTile() {
  const { t } = useTranslation();
  const router = useRouter();

  const trips = useTrips();

  const upcomingTrips = useMemo(
    () =>
      trips.filter((trip) => {
        if (!trip.startDate) return false;
        const parsed = parseLocalDate(trip.startDate);
        if (parsed == null) return false;
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        return parsed >= startOfToday;
      }),
    [trips],
  );

  if (!featureFlags.enableTrips) return null;

  return (
    <ListItem
      className="ios:pl-0 pl-2"
      titleClassName="text-lg"
      leftView={
        <View className="px-3">
          <View className="h-6 w-6 items-center justify-center rounded-md bg-red-500">
            <Icon name="map" size={15} color="white" />
          </View>
        </View>
      }
      rightView={
        <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
          <View
            className={`h-5 w-5 items-center justify-center rounded-full ${
              upcomingTrips.length > 0 ? 'bg-blue-500' : 'bg-blue-100 dark:bg-blue-950'
            }`}
          >
            <Text
              variant="footnote"
              className={`font-bold leading-4 ${
                upcomingTrips.length > 0 ? 'text-white' : 'text-blue-500 dark:text-blue-400'
              }`}
            >
              {upcomingTrips.length}
            </Text>
          </View>
          <ChevronRight />
        </View>
      }
      item={{ title: t('trips.upcomingTrips') }}
      onPress={() => router.push('/upcoming-trips')}
      target="Cell"
      index={0}
    />
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}

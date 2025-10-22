import type { AlertRef } from '@packrat/ui/nativewindui';
import { Alert, ListItem, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { featureFlags } from 'expo-app/config';
import { useTrips } from 'expo-app/features/trips/hooks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import { View } from 'react-native';

export function UpcomingTripsTile() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const alertRef = useRef<AlertRef>(null);

  // ✅ get all trips
  const trips = useTrips();

  // ✅ derive upcoming trips (in future)
  const upcomingTrips = useMemo(
    () => trips.filter((t) => new Date(t.startDate) > new Date()),
    [trips],
  );

  // ✅ when tapped
  const handlePress = () => {
    if (upcomingTrips.length === 0) {
      alertRef.current?.show();
      return;
    }
    router.push('/upcoming-trips');
  };

  // ✅ feature flag — hide completely if disabled
  if (!featureFlags.enableTrips) return null;

  return (
    <>
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
            {/* ✅ dynamically show upcoming trip count */}
            <View
              className={`h-5 w-5 items-center justify-center rounded-full ${
                upcomingTrips.length > 0 ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Text
                variant="footnote"
                className={`font-bold leading-4 ${
                  upcomingTrips.length > 0 ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {upcomingTrips.length}
              </Text>
            </View>
            <ChevronRight />
          </View>
        }
        item={{ title: 'Upcoming Trips' }}
        onPress={handlePress}
        target="Cell"
        index={0}
      />

      {/* ✅ Alert for when no trips exist */}
      <Alert
        title="No Trips Yet"
        message="Create trips to start seeing your upcoming adventures!"
        materialIcon={{ name: 'information-outline' }}
        materialWidth={370}
        buttons={[
          {
            text: 'Got it',
            style: 'default',
          },
        ]}
        ref={alertRef}
      />
    </>
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}

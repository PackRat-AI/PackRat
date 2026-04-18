import { List, ListItem, Text } from '@packrat/ui/nativewindui';
import { format } from 'date-fns';
import { featureFlags } from 'expo-app/config';
import { useDetailedPacks } from 'expo-app/features/packs/hooks/useDetailedPacks';
import { useTrips } from 'expo-app/features/trips/hooks';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import type { TranslationFunction } from 'expo-app/lib/i18n/types';
import { Redirect } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  return format(new Date(dateString), 'yyyy-MM-dd');
}

// Calculate trip status based on dates
function getTripStatus(trip: { startDate?: string; endDate?: string }, t: TranslationFunction) {
  if (!trip.startDate || !trip.endDate) return { status: t('trips.notStarted'), completion: 0 };

  const start = new Date(trip.startDate).getTime();
  const end = new Date(trip.endDate).getTime();
  const now = Date.now();

  if (now < start) return { status: t('trips.notStarted'), completion: 0 };
  if (now > end) return { status: t('trips.complete'), completion: 100 };
  const totalDuration = end - start;
  const elapsed = now - start;
  const completion = Math.round((elapsed / totalDuration) * 100);
  return { status: t('trips.inProgress'), completion };
}

function PackStatus({ status, completion }: { status: string; completion: number }) {
  const { t } = useTranslation();
  let statusColor = 'bg-amber-500';
  const statusText = status;

  if (status === t('trips.complete')) {
    statusColor = 'bg-green-500';
  } else if (status === t('trips.notStarted')) {
    statusColor = 'bg-red-500';
  }

  return (
    <View>
      <View className="flex-row items-center">
        <View className={cn('mr-1 h-2 w-2 rounded-full', statusColor)} />
        <Text variant="footnote" className="text-muted-foreground">
          {statusText}
        </Text>
      </View>
      {status === t('trips.inProgress') && (
        <View className="mt-1 h-1 w-16 rounded-full bg-muted">
          <View className="h-1 rounded-full bg-primary" style={{ width: `${completion}%` }} />
        </View>
      )}
    </View>
  );
}

// function MemberAvatars({
//   members,
// }: {
//   members: { id: string; name: string; avatar?: string }[];
// }) {
//   return (
//     <View className="flex-row">
//       {members.map((member, index) => (
//         <Avatar
//           alt={member.name}
//           key={member.id}
//           className={cn('h-6 w-6 border border-background', index > 0 && '-ml-2')}
//         >
//           {member.avatar ? (
//             <AvatarImage source={{ uri: member.avatar }} />
//           ) : (
//             <AvatarFallback>
//               <Text>{member.name.substring(0, 1)}</Text>
//             </AvatarFallback>
//           )}
//         </Avatar>
//       ))}
//     </View>
//   );
// }

// function TripImage({ uri }: { uri?: string }) {
//   return (
//     <View className="px-3">
//       <View className="h-12 w-12 overflow-hidden rounded-md">
//         <Avatar alt="trip image" className="h-12 w-12">
//           {uri ? (
//             <AvatarImage source={{ uri }} />
//           ) : (
//             <AvatarFallback>
//               <Icon name="map" size={20} color="white" />
//             </AvatarFallback>
//           )}
//         </Avatar>
//       </View>
//     </View>
//   );
// }

export default function UpcomingTripsScreen() {
  // Gate deep links behind the trips feature flag. `featureFlags` is a build-
  // time constant, so this branch is stable across renders and does not break
  // the rules of hooks.
  if (!featureFlags.enableTrips) return <Redirect href="/" />;
  return <UpcomingTripsScreenInner />;
}

function UpcomingTripsScreenInner() {
  const { t } = useTranslation();
  const trips = useTrips();
  const packs = useDetailedPacks();

  // Memoised so the reference is stable across renders and the selection effect
  // only fires when the underlying trips array actually changes.
  const upcomingTrips = useMemo(
    () => trips.filter((t) => !!t.startDate && new Date(t.startDate).getTime() > Date.now()),
    [trips],
  );

  const [selectedTripId, setSelectedTripId] = useState<string | undefined>(upcomingTrips[0]?.id);

  useEffect(() => {
    if (!upcomingTrips.length) {
      setSelectedTripId(undefined);
      return;
    }

    const stillSelected = selectedTripId
      ? upcomingTrips.some((trip) => trip.id === selectedTripId)
      : false;

    if (!stillSelected) {
      setSelectedTripId(upcomingTrips[0]?.id);
    }
  }, [upcomingTrips, selectedTripId]);

  if (!upcomingTrips.length) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>{t('trips.noUpcomingTrips')}</Text>
      </View>
    );
  }

  const selectedTrip = upcomingTrips.find((t) => t.id === selectedTripId);
  const selectedPack = selectedTrip ? packs.find((p) => p.id === selectedTrip.packId) : undefined;

  return (
    <ScrollView className="flex-1">
      <View className="p-4">
        <Text variant="subhead" className="mb-2 text-muted-foreground">
          {t('trips.plannedAdventures')}
        </Text>
      </View>

      {/* Trip List */}
      <List
        data={upcomingTrips.map((trip) => ({
          id: trip.id,
          trip,
          title: trip.name,
          subTitle: `${trip.location?.name ?? t('trips.unknown')} • ${formatDate(
            trip.startDate,
          )} to ${formatDate(trip.endDate)}`,
        }))}
        extraData={selectedTripId}
        keyExtractor={(item) => item.id}
        renderItem={(info) => {
          const { trip } = info.item;
          const { status, completion } = getTripStatus(trip, t);

          return (
            <ListItem
              {...info}
              // leftView={<TripImage uri={trip.imageUrl} />}
              rightView={
                <View className="flex-row items-center">
                  <PackStatus status={status} completion={completion} />
                </View>
              }
              onPress={() => setSelectedTripId(trip.id)}
              className={
                selectedTripId === trip.id ? 'bg-muted/50 dark:bg-slate-950' : 'dark:bg-transparent'
              }
            />
          );
        }}
      />

      {/* Trip Summary */}
      {selectedTrip && (
        <View className="mx-4 my-4 rounded-lg bg-card">
          <View className="border-border/25 dark:border-border/80 border-b p-4">
            <Text variant="heading" className="font-semibold">
              {selectedTrip.name}
            </Text>
            <Text variant="subhead" className="mt-1 text-muted-foreground">
              {selectedTrip.location?.name ?? 'No location'}
            </Text>
          </View>

          <View className="flex-row justify-between p-4">
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                DATES
              </Text>
              <Text variant="subhead" className="mt-1">
                {formatDate(selectedTrip.startDate)} - {formatDate(selectedTrip.endDate)}
              </Text>
            </View>
            <View className="flex-1">
              <Text variant="footnote" className="text-muted-foreground">
                PACK
              </Text>
              <Text variant="subhead" className="mt-1">
                {selectedPack ? `${selectedPack.items.length} items` : 'No pack assigned'}
              </Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

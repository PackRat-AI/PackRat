import { LargeTitleHeader, List, ListItem, Text } from '@packrat/ui/nativewindui';
import { format } from 'date-fns';
import { useTrips } from 'expo-app/features/trips/hooks';
import { cn } from 'expo-app/lib/cn';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useDetailedPacks } from '../../features/packs/hooks/useDetailedPacks';

function formatDate(dateString?: string) {
  if (!dateString) return '—';
  return format(new Date(dateString), 'yyyy-MM-dd');
}

// Calculate trip status based on dates
function getTripStatus(trip: { startDate?: string; endDate?: string }, t: any) {
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
  const { t } = useTranslation();
  const trips = useTrips();
  const packs = useDetailedPacks();

  const upcomingTrips = trips.filter(
    (t) => !!t.startDate && new Date(t.startDate).getTime() > Date.now(),
  );

  const [selectedTrip, setSelectedTrip] = useState(upcomingTrips[0]);

  useEffect(() => {
    if (!selectedTrip && upcomingTrips.length > 0) {
      setSelectedTrip(upcomingTrips[0]);
    }
  }, [upcomingTrips, selectedTrip]);

  if (!upcomingTrips.length) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>{t('trips.noUpcomingTrips')}</Text>
      </View>
    );
  }

  const selectedPack = selectedTrip ? packs.find((p) => p.id === selectedTrip.packId) : undefined;

  return (
    <>
      <LargeTitleHeader title={t('trips.upcomingTrips')} />
      <ScrollView className="flex-1">
        <View className="p-4">
          <Text variant="subhead" className="mb-2 text-muted-foreground">
            {t('trips.plannedAdventures')}
          </Text>
        </View>

        {/* Trip List */}
        <List
          data={upcomingTrips.map((trip) => ({
            title: trip.name,
            subTitle: `${trip.location?.name ?? t('trips.unknown')} • ${formatDate(
              trip.startDate,
            )} to ${formatDate(trip.endDate)}`,
          }))}
          keyExtractor={(_, index) => index.toString()}
          renderItem={(info) => {
            const trip = upcomingTrips[info.index];
            assertDefined(trip);

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
                onPress={() => setSelectedTrip(trip)}
                className={
                  selectedTrip?.id === trip.id
                    ? 'bg-muted/50 dark:bg-slate-950'
                    : 'dark:bg-transparent'
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
    </>
  );
}

import { useCallback, useRef } from 'react';
import {
  FlatList,
  Pressable,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Icon } from '@roninoss/icons';
import { LargeTitleHeader, ActivityIndicator } from '@packrat/ui/nativewindui';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';

import { useAllTrips } from '../hooks/useAllTrips'; // React Query hook
import { TripCard } from '../components/TripCard';
import type { Trip } from '../types';

function CreateTripIconButton() {
  const { colors } = useColorScheme();
  return (
    <Link href="/trip/new" asChild>
      <Pressable>
        <Icon name="plus" color={colors.foreground} />
      </Pressable>
    </Link>
  );
}

export function TripsListScreen() {
  const router = useRouter();
  const { data: trips, isLoading, isError, error, refetch } = useAllTrips(true);
  const searchBarRef = useRef<any>(null);
  const { colors } = useColorScheme();

  console.log('Fetched trips:', trips);
  const handleTripPress = useCallback(
    (trip: Trip) => {
      router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
    },
    [router],
  );

  const handleCreateTrip = () => {
    router.push({ pathname: '/trip/new' });
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <ActivityIndicator />
        </View>
      );
    }

    if (isError) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <View className="bg-destructive/10 mb-4 rounded-full p-4">
            <Icon name="exclamation" size={32} color="text-destructive" />
          </View>
          <Text className="mb-2 text-lg font-medium text-foreground">Failed to load trips</Text>
          <Text className="mb-6 text-center text-muted-foreground">
            {(error as Error)?.message || 'Something went wrong. Please try again.'}
          </Text>
          <TouchableOpacity
            className="rounded-lg bg-primary px-4 py-2"
            onPress={() => refetch()}
          >
            <Text className="font-medium text-primary-foreground">Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View className="flex-1 items-center justify-center p-8">
        <View className="mb-4 rounded-full bg-muted p-4">
          <Icon name="map-outline" size={32} color="text-muted-foreground" />
        </View>
        <Text className="mb-1 text-lg font-medium text-foreground">No trips found</Text>
        <Text className="mb-6 text-center text-muted-foreground">
          You haven't created any trips yet.
        </Text>
        <TouchableOpacity
          className="rounded-lg bg-primary px-4 py-2"
          onPress={handleCreateTrip}
        >
          <Text className="font-medium text-primary-foreground">Create New Trip</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1">
      <LargeTitleHeader
        title="Trips"
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: true,
          ref: asNonNullableRef(searchBarRef),
          onChangeText() {}, // no search filtering
          content: (
            <View className="flex-1 items-center justify-center">
              <Text>Search trips</Text>
            </View>
          ),
        }}
        rightView={() => (
          <View className="flex-row items-center">
            <CreateTripIconButton />
          </View>
        )}
      />

      <FlatList
        data={trips || []}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item: trip }) => (
          <View className="px-4 pt-4">
            <TripCard trip={trip} onPress={handleTripPress} />
          </View>
        )}
        ListEmptyComponent={renderEmptyState()}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </SafeAreaView>
  );
}

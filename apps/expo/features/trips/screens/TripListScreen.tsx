import { LargeTitleHeader, type LargeTitleSearchBarMethods } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import TabScreen from 'expo-app/components/TabScreen';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TestIds } from 'expo-app/lib/testIds';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { TripCard } from '../components/TripCard';
import { useTrips } from '../hooks';
import type { Trip } from '../types';

function CreateTripIconButton() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  return (
    <Link href="/trip/new" asChild>
      <Pressable testID={TestIds.CreateTripButton} accessibilityLabel={t('trips.createNewTrip')}>
        <Icon name="plus" color={colors.foreground} />
      </Pressable>
    </Link>
  );
}

export function TripsListScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const trips = useTrips();
  const searchBarRef = useRef<LargeTitleSearchBarMethods>(null);
  const [searchValue, setSearchValue] = useState('');

  const filteredTrips = useMemo(() => {
    const trimmed = searchValue.trim();
    if (!trimmed) return trips;
    const lower = trimmed.toLowerCase();
    return trips.filter(
      (trip) =>
        trip.name.toLowerCase().includes(lower) ||
        (trip.description ?? '').toLowerCase().includes(lower) ||
        (trip.location?.name ?? '').toLowerCase().includes(lower),
    );
  }, [trips, searchValue]);

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
    if (searchValue.trim() && trips.length > 0) {
      return (
        <View className="flex-1 items-center justify-center p-8">
          <Text className="text-center text-muted-foreground">{t('trips.noSearchResults')}</Text>
        </View>
      );
    }
    return (
      <View className="flex-1 items-center justify-center p-8">
        <View className="mb-4 rounded-full bg-muted p-4">
          <Icon name="map-outline" size={32} color="text-muted-foreground" />
        </View>
        <Text className="mb-1 text-lg font-medium text-foreground">{t('trips.noTripsFound')}</Text>
        <Text className="mb-6 text-center text-muted-foreground">{t('trips.noTripsYet')}</Text>
        <TouchableOpacity className="rounded-lg bg-primary px-4 py-2" onPress={handleCreateTrip}>
          <Text className="font-medium text-primary-foreground">{t('trips.createNewTrip')}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TabScreen>
      <LargeTitleHeader
        title={t('trips.trips')}
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: true,
          ref: asNonNullableRef(searchBarRef),
          onChangeText: setSearchValue,
          content: (
            <View className="flex-1 items-center justify-center">
              <Text>{t('trips.searchTrips')}</Text>
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
        data={filteredTrips}
        keyExtractor={(trip) => trip.id}
        renderItem={({ item: trip }) => (
          <View className="px-4 pt-4">
            <TripCard trip={trip} onPress={handleTripPress} />
          </View>
        )}
        ListEmptyComponent={renderEmptyState()}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </TabScreen>
  );
}

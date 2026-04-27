import { LargeTitleHeader, type LargeTitleSearchBarMethods } from '@packrat/ui/nativewindui';
import { AndroidTabBarInsetFix } from 'expo-app/components/AndroidTabBarInsetFix';
import { Icon } from 'expo-app/components/Icon';
import { LargeTitleHeaderSearchContentContainer } from 'expo-app/components/LargeTitleHeaderSearchContentContainer';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TestIds } from 'expo-app/lib/testIds';
import { asNonNullableRef } from 'expo-app/lib/utils/asNonNullableRef';
import { Link, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { TripCard } from '../components/TripCard';
import { useTrips } from '../hooks';
import type { Trip } from '../types';

function TrailConditionsBanner() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  return (
    <Link href="/trail-conditions" asChild>
      <Pressable>
        <View className="mx-4 mb-2 mt-3 flex-row items-center justify-between rounded-xl bg-violet-500/10 px-4 py-3">
          <View className="flex-row items-center">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-violet-500">
              <Icon name="map" size={18} color="white" />
            </View>
            <View className="ml-3">
              <Text className="font-semibold text-foreground">{t('trips.trailConditions')}</Text>
              <Text className="text-xs text-muted-foreground">{t('trailConditions.subtitle')}</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={18} color={colors.grey} />
        </View>
      </Pressable>
    </Link>
  );
}

function CreateTripIconButton() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  return (
    <Link href="/trip/new" asChild>
      <Pressable
        testID={TestIds.CreateTripButton}
        accessibilityLabel={t('trips.createNewTrip')}
        className="mx-2"
      >
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

  const renderSearchContent = () => {
    const isSearching = searchValue.trim().length > 0;

    if (!isSearching) {
      return (
        <View className="flex-1 items-center justify-center p-4">
          <Text className="text-muted-foreground">{t('trips.searchTrips')}</Text>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 pt-2">
          {filteredTrips.length > 0 && (
            <Text className="text-xs text-muted-foreground">
              {filteredTrips.length}{' '}
              {filteredTrips.length === 1 ? t('trips.result') : t('trips.results')}
            </Text>
          )}
        </View>

        {filteredTrips.map((trip: Trip) => (
          <View className="px-4 pt-4" key={trip.id}>
            <TripCard trip={trip} onPress={handleTripPress} />
          </View>
        ))}

        {filteredTrips.length === 0 && (
          <View className="flex-1 items-center justify-center p-8">
            <View className="mb-4 rounded-full bg-muted p-4">
              <Icon name="magnify" size={32} color="text-muted-foreground" />
            </View>
            <Text className="mb-1 text-lg font-medium text-foreground">
              {t('trips.noTripsFound')}
            </Text>
            <Text className="text-center text-muted-foreground">{t('trips.noSearchResults')}</Text>
          </View>
        )}
      </ScrollView>
    );
  };

  return (
    <>
      <LargeTitleHeader
        title={t('trips.trips')}
        backVisible={false}
        searchBar={{
          iosHideWhenScrolling: false,
          ref: asNonNullableRef(searchBarRef),
          onChangeText: setSearchValue,
          placeholder: t('trips.searchPlaceholder'),
          content: (
            <LargeTitleHeaderSearchContentContainer>
              {renderSearchContent()}
            </LargeTitleHeaderSearchContentContainer>
          ),
        }}
        rightView={() => <CreateTripIconButton />}
      />

      <FlatList
        data={filteredTrips}
        keyExtractor={(trip) => trip.id}
        ListHeaderComponent={<TrailConditionsBanner />}
        renderItem={({ item: trip }) => (
          <View className="px-4 pt-4">
            <TripCard trip={trip} onPress={handleTripPress} />
          </View>
        )}
        ListEmptyComponent={renderEmptyState()}
        ListFooterComponent={<AndroidTabBarInsetFix />}
        contentContainerStyle={{ flexGrow: 1 }}
      />
    </>
  );
}

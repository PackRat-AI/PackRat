import { use$ } from '@legendapp/state/react';
import { ActivityIndicator, Text } from '@packrat/ui/nativewindui';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, SafeAreaView, View } from 'react-native';
import { TripForm } from '../components/TripForm';
import { tripLocationStore } from '../store/tripLocationStore';
import { tripsSyncState } from '../store/trips';

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { t } = useTranslation();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);
  const isLoaded = use$(() => tripsSyncState.isLoaded.get());

  // biome-ignore lint/correctness/useExhaustiveDependencies: initialize tripLocationStore only when the trip identity changes, not on every location sync update
  useEffect(() => {
    if (trip) {
      tripLocationStore.set(trip.location ?? null);
    }
  }, [trip?.id]);

  useEffect(() => {
    return () => {
      tripLocationStore.set(null);
    };
  }, []);

  if (!trip && !isLoaded) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <View className="items-center gap-4">
          <Text className="text-lg font-medium text-foreground">{t('errors.notFound')}</Text>
          <Pressable onPress={() => router.back()}>
            <Text className="font-semibold text-primary">{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <TripForm trip={trip} />;
}

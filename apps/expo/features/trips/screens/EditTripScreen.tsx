import { assertDefined } from '@packrat/guards';
import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { useTripDetailsFromStore } from 'expo-app/features/trips/hooks/useTripDetailsFromStore';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, Text } from 'react-native';
import { TripForm } from '../components/TripForm';

const TRIP_LOAD_TIMEOUT_MS = 10_000;

export function EditTripScreen() {
  const { id } = useLocalSearchParams();
  const { t } = useTranslation();
  const router = useRouter();
  const effectiveId = Array.isArray(id) ? id[0] : id;
  assertDefined(effectiveId);

  const trip = useTripDetailsFromStore(effectiveId);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (trip) return;
    const timer = setTimeout(() => setTimedOut(true), TRIP_LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [trip]);

  if (!trip) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4">
        {timedOut ? (
          <>
            <Text className="text-foreground text-base">{t('errors.notFound')}</Text>
            <Button onPress={() => router.back()} label={t('common.back')} />
          </>
        ) : (
          <ActivityIndicator />
        )}
      </SafeAreaView>
    );
  }

  return <TripForm trip={trip} />;
}

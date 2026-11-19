import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { Text } from '@packrat/ui/src/text';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { PermissionNotice } from 'expo-app/components/PermissionNotice';
import {
  FullScreenDialogHeader,
  OutlinedField,
} from 'expo-app/features/trip-stats/components/DialogParts';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { usePermissionGranted } from 'expo-app/lib/permissions/usePermissionGranted';
import { testIds } from 'expo-app/lib/testIds';
import * as Location from 'expo-location';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { currentFix, LocatorError } from '../lib/locationTracking';
import { recordSafetyCheckIn } from '../lib/safetyActions';

/** Records a check-in where the user is standing, with an optional note. */
export function CheckInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [note, setNote] = useState('');
  const [locating, setLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const { colors } = useColorScheme();
  // Back from Settings with location on: the notice has done its job.
  const location = usePermissionGranted({
    check: async () => (await Location.getForegroundPermissionsAsync()).granted,
    enabled: locationDenied,
    name: 'location',
  });
  const showsLocationDenied = locationDenied && location.granted !== true;

  const checkIn = async () => {
    setLocating(true);
    setErrorMessage(null);
    setLocationDenied(false);
    try {
      const fix = await currentFix();
      recordSafetyCheckIn({ tripId: id, fix, note });
      router.back();
    } catch (error) {
      if (error instanceof LocatorError) {
        setLocationDenied(error.reason === 'denied');
        setErrorMessage(
          error.reason === 'denied'
            ? t('safetyCheckIn.checkIn.locationDenied')
            : t('safetyCheckIn.checkIn.noFix'),
        );
      } else {
        Sentry.captureException(error, {
          tags: { feature: 'safetyCheckIn', action: 'checkIn' },
          extra: { tripId: id },
        });
        setErrorMessage(t('safetyCheckIn.checkIn.noFix'));
      }
    } finally {
      setLocating(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen
        options={{
          headerShown: true,
          header: () => (
            <FullScreenDialogHeader
              title={t('safetyCheckIn.checkIn.title')}
              onClose={() => router.back()}
            />
          ),
        }}
      />
      <KeyboardAvoidingView behavior="height" className="flex-1">
        <SafeAreaView edges={['bottom']} className="flex-1 justify-between">
          <View className="gap-2 pt-2">
            <Text variant="callout" className="px-4 text-muted-foreground" wrap>
              {t('safetyCheckIn.checkIn.explainer')}
            </Text>
            <OutlinedField
              label={t('safetyCheckIn.checkIn.note')}
              value={note}
              onChangeText={setNote}
              maxLength={280}
              multiline
              testID={testIds.safetyCheckIn.checkInNote}
            />
            {errorMessage && showsLocationDenied ? (
              <PermissionNotice
                message={errorMessage}
                tone="destructive"
                variant="callout"
                className="px-4"
                testID={testIds.safetyCheckIn.checkInOpenSettingsBtn}
              />
            ) : errorMessage && !locationDenied ? (
              <Text variant="callout" className="px-4 text-destructive" wrap>
                {errorMessage}
              </Text>
            ) : null}
          </View>
          <View className="p-4">
            <Button
              variant="filled"
              size="lg"
              className="gap-2"
              disabled={locating}
              onPress={checkIn}
              testID={testIds.safetyCheckIn.checkInSendBtn}
            >
              {locating ? (
                <>
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                  <Text className="font-medium text-primary-foreground">
                    {t('safetyCheckIn.checkIn.locating')}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="map-marker-check" size={18} color={colors.primaryForeground} />
                  <Text className="font-medium text-primary-foreground">
                    {t('safetyCheckIn.checkIn.send')}
                  </Text>
                </>
              )}
            </Button>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

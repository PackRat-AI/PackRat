import { isString } from '@packrat/guards';
import { Button } from '@packrat/ui/src/button';
import { Form, FormItem, FormSection } from '@packrat/ui/src/form';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import * as Sentry from '@sentry/react-native';
import { useForm } from '@tanstack/react-form';
import * as Burnt from 'burnt';
import { registerForPushIfNeeded } from 'expo-app/features/notifications/lib/pushRegistration';
import { useDetailedPacks } from 'expo-app/features/packs/hooks/useDetailedPacks';
import { TrailPicker } from 'expo-app/features/trail-conditions/components/TrailPicker';
import { useFeatureFlag } from 'expo-app/hooks/useFeatureFlags';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useCreateTrip, useUpdateTrip } from '../hooks';
import { splitPlaceName } from '../lib/places';
import { requestTripReminderPermission } from '../lib/tripReminderScheduler';
import { tripLocationStore, useTripLocation } from '../store/tripLocationStore';
import type { Trip } from '../types';
import { TripDatesField } from './TripDatesField';
import { TripFormHeading, TripFormRow } from './TripFormRow';
import { TripPackPicker, usePackSummary } from './TripPackPicker';

const tripFormSchema = z
  .object({
    name: z.string().min(1, 'Trip name is required'),
    description: z.string().optional(),
    notes: z.string().optional(),
    location: z
      .object({
        latitude: z.number(),
        longitude: z.number(),
        name: z.string().optional(),
      })
      .optional(),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    packId: z.string().nullable().optional(),
  })
  .refine(
    ({ startDate, endDate }) => !startDate || !endDate || new Date(endDate) >= new Date(startDate),
    {
      message: 'End date must be after start date',
      path: ['endDate'],
    },
  );

type TripFormValues = z.infer<typeof tripFormSchema>;

/** A trail a new trip starts on, when planned from a trail's page. */
export interface StartingTrail {
  id: string;
  name: string;
  center?: { latitude: number; longitude: number } | null;
}

export const TripForm = ({
  trip,
  startingTrail,
}: {
  trip?: Trip;
  startingTrail?: StartingTrail;
}) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const insets = useSafeAreaInsets();
  const isEditingExistingTrip = !!trip;

  const { location, setLocation } = useTripLocation();
  const detailedPacks = useDetailedPacks();
  const packSummary = usePackSummary();
  /** Pack ids before New pack opened, so the pack it creates gets linked on return. */
  const packIdsBeforeNew = useRef<Set<string> | null>(null);
  const [locationCleared, setLocationCleared] = useState(false);

  // Initialize location store with trip's location when component mounts or
  // trip ID changes. We intentionally depend only on trip?.id (not trip?.location)
  // so that after the user picks a new location via location-search, a
  // re-render of the same trip object does not overwrite their selection in
  // the store.
  useEffect(() => {
    // Set location from trip, or null if trip has no location
    setLocation(trip?.location ?? null);

    // Cleanup: clear location when component unmounts
    return () => {
      setLocation(null);
    };
  }, [trip?.id, setLocation]);

  const enableTrailConditions = useFeatureFlag('enableTrailConditions');
  const [trail, setTrail] = useState<{ id: string; name: string } | null>(() => {
    if (trip?.trailId) return { id: trip.trailId, name: trip.trailName ?? '' };
    return startingTrail ? { id: startingTrail.id, name: startingTrail.name } : null;
  });
  const [showTrailPicker, setShowTrailPicker] = useState(false);

  const [showPackModal, setShowPackModal] = useState(false);

  // Reset the shared location store on mount (to clear stale state from any
  // previous edit session) and on unmount (to clean up for future forms), so
  // that a location selected in one edit session never leaks into the next.
  useEffect(() => {
    // Planned from a trail's page: the trail is the destination until the hiker picks another.
    const center = startingTrail?.center;
    tripLocationStore.set(
      !trip && startingTrail && center ? { ...center, name: startingTrail.name } : null,
    );
    return () => {
      tripLocationStore.set(null);
    };
  }, []);

  const formatDate = (value?: unknown) => {
    if (!value) return '';
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    if (isString(value)) {
      return value.split('T')[0];
    }
    return '';
  };

  const enableTripReminders = useFeatureFlag('enableTripReminders');
  const enableTripWeather = useFeatureFlag('enableTripWeather');

  const form = useForm({
    defaultValues: {
      name: trip?.name || startingTrail?.name || '',
      description: trip?.description || '',
      notes: trip?.notes || '',
      // Use the trip's own location as the form default, not the global location
      // store. The store is only updated when the user explicitly picks a new
      // location via the location-search screen.
      location: trip?.location ?? undefined,
      startDate: formatDate(trip?.startDate || ''),
      endDate: formatDate(trip?.endDate || ''),
      packId: trip?.packId,
      // safe-cast: defaultValues object matches TripFormValues shape; useForm generic infers
      // narrower literal types from the object literal without the cast.
    } as TripFormValues,
    validators: { onChange: tripFormSchema },
    onSubmit: async ({ value }) => {
      const submitData = {
        ...value,
        location: location ?? value.location,
        packId: value.packId === '' ? undefined : (value.packId ?? undefined),
        trailId: trail?.id ?? null,
        trailName: trail?.name ?? null,
      };
      try {
        if (isEditingExistingTrip) {
          Sentry.addBreadcrumb({
            category: 'trips',
            message: 'Updating trip',
            level: 'info',
            data: { tripId: trip?.id },
          });
          await updateTrip({ ...trip, ...submitData });
          Burnt.toast({
            title: t('trips.tripUpdatedSuccess'),
            preset: 'done',
          });
        } else {
          Sentry.addBreadcrumb({
            category: 'trips',
            message: 'Creating trip',
            level: 'info',
          });
          await createTrip(submitData);
          Burnt.toast({
            title: t('trips.tripCreatedSuccess'),
            preset: 'done',
          });
        }
        router.back();
        // A dated trip with a destination watches it for weather alerts, pushed by the server.
        if (enableTripWeather && submitData.startDate && submitData.location) {
          registerForPushIfNeeded();
        } else if (enableTripReminders) {
          // The trip now has a date: the moment a reminder permission prompt makes sense.
          requestTripReminderPermission();
        }
      } catch (_e) {
        Sentry.captureException(_e, {
          tags: { feature: 'trips', action: isEditingExistingTrip ? 'updateTrip' : 'createTrip' },
          extra: { tripId: trip?.id },
        });
        Burnt.toast({
          title: t('errors.tryAgain'),
          preset: 'error',
        });
      }
    },
  });

  const shownLocation = location ?? (locationCleared ? null : (trip?.location ?? null));
  const pickedLocation = shownLocation
    ? shownLocation.name
      ? splitPlaceName(shownLocation.name)
      : {
          title: `${shownLocation.latitude.toFixed(4)}, ${shownLocation.longitude.toFixed(4)}`,
          region: undefined,
        }
    : null;

  // Back from New pack: link the pack it created.
  useEffect(() => {
    const before = packIdsBeforeNew.current;
    if (!before) return;
    const created = detailedPacks.find((p) => !before.has(p.id));
    if (!created) return;
    packIdsBeforeNew.current = null;
    form.setFieldValue('packId', created.id);
  }, [detailedPacks, form]);

  const contentContainerStyle = useMemo(
    () => ({ padding: 32, paddingBottom: insets.bottom + 32 }),
    [insets.bottom],
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditingExistingTrip ? t('trips.editTrip') : t('trips.newTrip'),
        }}
      />

      <KeyboardAwareScrollView
        bottomOffset={8}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={contentContainerStyle}
      >
        <Form>
          <FormSection>
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    testID={testIds.trips.nameInput}
                    containerTestID={testIds.trips.nameInputContainer}
                    placeholder={t('trips.tripName')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    errorMessage={field.state.meta.errors[0]?.message}
                  />
                </FormItem>
              )}
            </form.Field>
            <form.Field name="description">
              {(field) => (
                <FormItem>
                  <TextField
                    testID={testIds.trips.descriptionInput}
                    containerTestID={testIds.trips.descriptionInputContainer}
                    placeholder={t('trips.description')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    multiline
                  />
                </FormItem>
              )}
            </form.Field>
          </FormSection>

          {/* Where */}
          <View className="gap-3">
            <TripFormHeading title={t('trips.form.where')} />
            <TripFormRow
              icon="map-marker"
              iconColor={colors.destructive}
              title={pickedLocation ? pickedLocation.title : t('trips.form.addLocation')}
              supporting={pickedLocation?.region}
              isSet={!!pickedLocation}
              onPress={() => router.push('/trip/location-search')}
              onClear={() => {
                setLocation(null);
                setLocationCleared(true);
                form.setFieldValue('location', undefined);
              }}
              clearLabel={t('common.clear')}
              testID={testIds.trips.locationButton}
            />
            {enableTrailConditions ? (
              <>
                <TripFormRow
                  icon="hiking"
                  title={trail?.name || t('trips.form.addTrail')}
                  isSet={!!trail}
                  onPress={() => setShowTrailPicker(true)}
                  onClear={() => setTrail(null)}
                  clearLabel={t('common.clear')}
                  testID={testIds.trips.trailButton}
                />
                <Text variant="footnote" className="px-4 text-muted-foreground">
                  {trail ? t('trips.trailFooterChosen') : t('trips.form.trailFooter')}
                </Text>
                <TrailPicker
                  visible={showTrailPicker}
                  selectedTrailId={trail?.id ?? null}
                  origin={location ?? trip?.location ?? null}
                  allowsPin={false}
                  onPick={(picked) => {
                    if (picked.kind === 'trail') setTrail(picked.trail);
                    setShowTrailPicker(false);
                  }}
                  onClose={() => setShowTrailPicker(false)}
                />
              </>
            ) : null}
          </View>

          {/* When */}
          <View className="gap-3">
            <TripFormHeading title={t('trips.form.when')} />
            <form.Subscribe selector={(s) => [s.values.startDate, s.values.endDate] as const}>
              {([startDate, endDate]) => (
                <form.Field name="endDate">
                  {(endField) => (
                    <TripDatesField
                      startDate={startDate}
                      endDate={endDate}
                      error={endField.state.meta.errors[0]?.message}
                      onChange={(dates) => {
                        form.setFieldValue('startDate', dates.startDate);
                        form.setFieldValue('endDate', dates.endDate);
                      }}
                    />
                  )}
                </form.Field>
              )}
            </form.Subscribe>
          </View>

          {/* Pack */}
          <form.Field name="packId">
            {(field) => {
              const pack = detailedPacks.find((p) => p.id === field.state.value);
              return (
                <View className="gap-3">
                  <TripFormHeading title={t('trips.form.pack')} />
                  <TripFormRow
                    icon="bag-personal"
                    title={pack ? pack.name : t('trips.form.addPack')}
                    supporting={pack ? packSummary(pack) : undefined}
                    isSet={!!pack}
                    onPress={() => setShowPackModal(true)}
                    onClear={() => field.handleChange(null)}
                    clearLabel={t('common.clear')}
                    testID={testIds.trips.packButton}
                  />
                  <TripPackPicker
                    visible={showPackModal}
                    packs={detailedPacks}
                    selectedId={field.state.value ?? null}
                    onSelect={(id) => field.handleChange(id)}
                    onNewPack={() => {
                      packIdsBeforeNew.current = new Set(detailedPacks.map((p) => p.id));
                      setShowPackModal(false);
                      router.push('/pack/new');
                    }}
                    onClose={() => setShowPackModal(false)}
                  />
                </View>
              );
            }}
          </form.Field>

          {/* Notes */}
          <View className="gap-3">
            <TripFormHeading title={t('trips.form.notes')} />
            <form.Field name="notes">
              {(field) => (
                <TextField
                  placeholder={t('trips.notes')}
                  value={field.state.value}
                  onChangeText={field.handleChange}
                  onBlur={field.handleBlur}
                  multiline
                />
              )}
            </form.Field>
          </View>
        </Form>

        {/* Submit Button */}
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button
              testID={testIds.trips.submitBtn}
              onPress={() => form.handleSubmit()}
              disabled={!canSubmit || isSubmitting}
              className="mt-6 w-full"
              label={
                isSubmitting
                  ? isEditingExistingTrip
                    ? t('trips.updating')
                    : t('trips.creating')
                  : isEditingExistingTrip
                    ? t('trips.updateTrip')
                    : t('trips.createTrip')
              }
            />
          )}
        </form.Subscribe>
      </KeyboardAwareScrollView>
    </>
  );
};

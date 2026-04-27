import { assertDefined, isString } from '@packrat/guards';
import { Form, FormItem, FormSection, TextField } from '@packrat/ui/nativewindui';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useForm } from '@tanstack/react-form';
import * as Burnt from 'burnt';
import { Icon } from 'expo-app/components/Icon';
import { usePacks } from 'expo-app/features/packs/hooks/usePacks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { TestIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useCreateTrip, useUpdateTrip } from '../hooks';
import { tripLocationStore, useTripLocation } from '../store/tripLocationStore';
import type { Trip } from '../types';

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

export const TripForm = ({ trip }: { trip?: Trip }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const insets = useSafeAreaInsets();
  const isEditingExistingTrip = !!trip;

  const { location, setLocation } = useTripLocation();
  const packs = usePacks();

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

  const [showPackModal, setShowPackModal] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);

  // Reset the shared location store on mount (to clear stale state from any
  // previous edit session) and on unmount (to clean up for future forms), so
  // that a location selected in one edit session never leaks into the next.
  useEffect(() => {
    tripLocationStore.set(null);
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

  const form = useForm({
    defaultValues: {
      name: trip?.name || '',
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
      };
      try {
        if (isEditingExistingTrip) {
          await updateTrip({ ...trip, ...submitData });
          Burnt.toast({
            title: t('trips.tripUpdatedSuccess'),
            preset: 'done',
          });
        } else {
          await createTrip(submitData);
          Burnt.toast({
            title: t('trips.tripCreatedSuccess'),
            preset: 'done',
          });
        }
        router.back();
      } catch (_e) {
        Burnt.toast({
          title: t('errors.tryAgain'),
          preset: 'error',
        });
      }
    },
  });

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
          <FormSection ios={{ title: t('trips.tripDetails') }}>
            {/* Trip Name */}
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('trips.tripName')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    errorMessage={field.state.meta.errors[0]?.message}
                    leftView={
                      <View className="pl-2 justify-center">
                        <Icon name="map" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

            {/* Description */}
            <form.Field name="description">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('trips.description')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    multiline
                  />
                </FormItem>
              )}
            </form.Field>

            {/* Notes */}
            <form.Field name="notes">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('trips.notes')}
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
                    multiline
                  />
                </FormItem>
              )}
            </form.Field>

            {/* Location */}
            <FormItem>
              <View className="flex-row justify-between items-center">
                <Pressable
                  onPress={() => router.push('/trip/location-search')}
                  className="flex-1 p-3 border border-border rounded-lg mr-2 bg-card"
                >
                  <Text
                    className={
                      location || trip?.location
                        ? 'text-foreground'
                        : 'text-muted-foreground font-medium'
                    }
                  >
                    {location
                      ? location.name
                        ? location.name.split(',')[0]
                        : `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
                      : trip?.location
                        ? trip.location.name?.split(',')[0]
                        : t('trips.addLocation')}
                  </Text>
                </Pressable>
                {(location || trip?.location) && (
                  <Pressable
                    onPress={() => {
                      setLocation(null);
                      form.setFieldValue('location', undefined);
                    }}
                  >
                    <Text className="text-red-500 font-semibold px-2">{t('common.clear')}</Text>
                  </Pressable>
                )}
              </View>
            </FormItem>

            {/* Pack Picker */}
            <form.Field name="packId">
              {(field) => (
                <FormItem>
                  <Pressable
                    onPress={() => setShowPackModal(true)}
                    className="border border-border rounded-lg p-3 bg-card flex-row items-center justify-between"
                  >
                    <View className="flex-row items-center">
                      <Icon name="archive" size={16} color={colors.grey3} />
                      <Text className="ml-2 text-foreground">
                        {field.state.value
                          ? packs.find((p) => p.id === field.state.value)?.name
                          : t('trips.selectPack')}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.grey3} />
                  </Pressable>

                  <Modal visible={showPackModal} animationType="slide" transparent>
                    <SafeAreaView className="flex-1 justify-end bg-black/40">
                      <View className="bg-background rounded-t-2xl p-4">
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-lg font-semibold">{t('trips.selectPack')}</Text>
                          <Pressable onPress={() => setShowPackModal(false)}>
                            <Text className="text-primary font-semibold">{t('common.close')}</Text>
                          </Pressable>
                        </View>

                        <Picker
                          selectedValue={field.state.value || ''}
                          onValueChange={(value) => field.handleChange(value)}
                        >
                          <Picker.Item label={t('trips.noPackSelected')} value="" />
                          {packs.map((pack) => (
                            <Picker.Item key={pack.id} label={pack.name} value={pack.id} />
                          ))}
                        </Picker>
                      </View>
                    </SafeAreaView>
                  </Modal>
                </FormItem>
              )}
            </form.Field>

            {/* Start Date */}
            <form.Field name="startDate">
              {(field) => {
                return (
                  <FormItem>
                    <Pressable
                      onPress={() => setShowStartPicker(true)}
                      className={`flex-row items-center justify-between border rounded-lg p-3 bg-card ${
                        field.state.meta.errors.length > 0 ? 'border-destructive' : 'border-border'
                      }`}
                    >
                      <Text className="text-foreground font-medium">{t('trips.startDate')}</Text>
                      <Text className="text-muted-foreground">
                        {field.state.value || t('trips.selectDate')}
                      </Text>
                    </Pressable>
                    {field.state.meta.errors[0]?.message && (
                      <Text className="text-destructive text-sm mt-1">
                        {field.state.meta.errors[0].message}
                      </Text>
                    )}

                    {showStartPicker && (
                      <DateTimePicker
                        value={field.state.value ? new Date(field.state.value) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(_event, date) => {
                          setShowStartPicker(false);
                          if (date) {
                            const dateStr = date.toISOString().split('T')[0];
                            assertDefined(dateStr);
                            field.handleChange(dateStr);
                          }
                        }}
                      />
                    )}
                  </FormItem>
                );
              }}
            </form.Field>

            {/* End Date */}
            <form.Field name="endDate">
              {(field) => {
                return (
                  <FormItem>
                    <Pressable
                      onPress={() => setShowEndPicker(true)}
                      className={`flex-row items-center justify-between border rounded-lg p-3 bg-card ${
                        field.state.meta.errors.length > 0 ? 'border-destructive' : 'border-border'
                      }`}
                    >
                      <Text className="text-foreground font-medium">{t('trips.endDate')}</Text>
                      <Text className="text-muted-foreground">
                        {field.state.value || t('trips.selectDate')}
                      </Text>
                    </Pressable>
                    {field.state.meta.errors[0]?.message && (
                      <Text className="text-destructive text-sm mt-1">
                        {field.state.meta.errors[0].message}
                      </Text>
                    )}

                    {showEndPicker && (
                      <DateTimePicker
                        value={field.state.value ? new Date(field.state.value) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(_event, date) => {
                          setShowEndPicker(false);
                          if (date) {
                            const dateStr = date.toISOString().split('T')[0];
                            assertDefined(dateStr);
                            field.handleChange(dateStr);
                          }
                        }}
                      />
                    )}
                  </FormItem>
                );
              }}
            </form.Field>
          </FormSection>
        </Form>

        {/* Submit Button */}
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Pressable
              testID={TestIds.SubmitTripButton}
              onPress={() => form.handleSubmit()}
              disabled={!canSubmit || isSubmitting}
              className={`mt-6 rounded-lg px-4 py-3.5 ${
                !canSubmit || isSubmitting ? 'bg-primary/70' : 'bg-primary'
              }`}
            >
              <Text className="text-center text-base font-semibold text-primary-foreground">
                {isSubmitting
                  ? isEditingExistingTrip
                    ? t('trips.updating')
                    : t('trips.creating')
                  : isEditingExistingTrip
                    ? t('trips.updateTrip')
                    : t('trips.createTrip')}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </KeyboardAwareScrollView>
    </>
  );
};

import { Form, FormItem, FormSection, TextField } from '@packrat/ui/nativewindui';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { usePacks } from 'expo-app/features/packs/hooks/usePacks';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { useCreateTrip, useUpdateTrip } from '../hooks';
import { useTripLocation } from '../store/tripLocationStore';
import type { Trip } from '../types';

const tripFormSchema = z.object({
  name: z.string().min(1, 'Trip name is required'),
  description: z.string().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string().optional(),
    })
    .optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  packId: z.string().optional(),
});

type TripFormValues = z.infer<typeof tripFormSchema>;

export const TripForm = ({ trip }: { trip?: Trip }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const isEditingExistingTrip = !!trip;

  const { location, setLocation } = useTripLocation();
  const packs = usePacks();

  const [showPackModal, setShowPackModal] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);

  const formatDate = (isoString?: string) => isoString?.split('T')[0] || '';

  const form = useForm({
    defaultValues: {
      name: trip?.name || '',
      description: trip?.description || '',
      location: location ?? undefined,
      startDate: formatDate(trip?.startDate || ''),
      endDate: formatDate(trip?.endDate || ''),
      packId: trip?.packId,
    } as TripFormValues,
    validators: { onChange: tripFormSchema },
    onSubmit: async ({ value }) => {
      const submitData = { ...value, location: location ?? value.location };
      try {
        if (isEditingExistingTrip) {
          await updateTrip({ ...trip, ...submitData });
          Alert.alert('Success', 'Trip updated successfully');
        } else {
          await createTrip(submitData);
          Alert.alert('Success', 'Trip created successfully');
        }
        router.back();
      } catch (_e) {
        Alert.alert('Error', 'Something went wrong. Please try again.');
      }
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <Stack.Screen
        options={{
          title: isEditingExistingTrip ? 'Edit Trip' : 'New Trip',
        }}
      />

      <ScrollView contentContainerClassName="p-8">
        <Form>
          <FormSection ios={{ title: 'Trip Details' }}>
            {/* Trip Name */}
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Trip Name"
                    value={field.state.value}
                    onChangeText={field.handleChange}
                    onBlur={field.handleBlur}
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
                    placeholder="Description"
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
                        : 'Add Location'}
                  </Text>
                </Pressable>
                {location && (
                  <Pressable onPress={() => setLocation(null)}>
                    <Text className="text-red-500 font-semibold px-2">Clear</Text>
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
                          : 'Select Pack'}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.grey3} />
                  </Pressable>

                  <Modal visible={showPackModal} animationType="slide" transparent>
                    <View className="flex-1 justify-end bg-black/40">
                      <View className="bg-background rounded-t-2xl p-4">
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-lg font-semibold">Select Pack</Text>
                          <Pressable onPress={() => setShowPackModal(false)}>
                            <Text className="text-primary font-semibold">Close</Text>
                          </Pressable>
                        </View>

                        <Picker
                          selectedValue={field.state.value || ''}
                          onValueChange={(value) => field.handleChange(value)}
                        >
                          <Picker.Item label="No pack selected" value="" />
                          {packs.map((pack) => (
                            <Picker.Item key={pack.id} label={pack.name} value={pack.id} />
                          ))}
                        </Picker>
                      </View>
                    </View>
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
                      className="flex-row items-center justify-between border border-border rounded-lg p-3 bg-card"
                    >
                      <Text className="text-foreground font-medium">Start Date</Text>
                      <Text className="text-muted-foreground">
                        {field.state.value || 'Select date'}
                      </Text>
                    </Pressable>

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
                      className="flex-row items-center justify-between border border-border rounded-lg p-3 bg-card"
                    >
                      <Text className="text-foreground font-medium">End Date</Text>
                      <Text className="text-muted-foreground">
                        {field.state.value || 'Select date'}
                      </Text>
                    </Pressable>

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
              onPress={() => form.handleSubmit()}
              disabled={!canSubmit || isSubmitting}
              className={`mt-6 rounded-lg px-4 py-3.5 ${
                !canSubmit || isSubmitting ? 'bg-primary/70' : 'bg-primary'
              }`}
            >
              <Text className="text-center text-base font-semibold text-primary-foreground">
                {isSubmitting
                  ? isEditingExistingTrip
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditingExistingTrip
                    ? 'Update Trip'
                    : 'Create Trip'}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

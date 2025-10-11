import {
  Button,
  Form,
  FormItem,
  FormSection,
  TextField,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack, useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  Modal,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { z } from 'zod';
import { useState } from 'react';
import { useCreateTrip, useUpdateTrip } from '../hooks';
import type { Trip } from '../types';
import { usePacks } from 'expo-app/features/packs/hooks/usePacks';
import { useAllPacks } from 'expo-app/features/packs/hooks/useAllPacks';
import { useTripLocation } from '../store/tripLocationStore';

const tripFormSchema = z.object({
  name: z.string().min(1, 'Trip name is required'),
  description: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().optional(),
  }).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  packId: z.string().nullable().optional(),
});

export const TripForm = ({ trip }: { trip?: Trip }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const isEditingExistingTrip = !!trip;

  // Trip location using reactive store
  const { location, setLocation } = useTripLocation();

  // Packs
  const localPacks = usePacks();
  const { data: allPacks = [], isLoading } = useAllPacks(true);
  const availablePacks = [...localPacks, ...allPacks].filter(
    (pack, index, self) => index === self.findIndex((p) => p.id === pack.id)
  );

  const [showPackModal, setShowPackModal] = useState(false);

  const form = useForm({
    defaultValues: {
      name: trip?.name || '',
      description: trip?.description || '',
      location: location || null,
      startDate: trip?.startDate || '',
      endDate: trip?.endDate || '',
      packId: trip?.packId || '',
    },
    validators: { onChange: tripFormSchema },
    onSubmit: async ({ value }) => {
      if (location) value.location = location;

      if (isEditingExistingTrip) {
        await updateTrip({ ...trip, ...value });
      } else {
        await createTrip(value);
      }

      router.back();
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
                  <Text>
                    {location
                      ? location.name
                        ? location.name
                        : `${location.latitude.toFixed(3)}, ${location.longitude.toFixed(3)}`
                      : 'Add Location'}
                  </Text>
                </Pressable>

                {location && (
                  <Pressable onPress={() => setLocation(null)}>
                    <Text className="text-red-500 font-semibold px-2">
                      Clear
                    </Text>
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
                          ? availablePacks.find((p) => p.id === field.state.value)?.name
                          : 'Select Pack'}
                      </Text>
                    </View>
                    <Icon name="chevron-right" size={16} color={colors.grey3} />
                  </Pressable>

                  <Modal
                    visible={showPackModal}
                    animationType="slide"
                    transparent
                  >
                    <View className="flex-1 justify-end bg-black/40">
                      <View className="bg-background rounded-t-2xl p-4">
                        <View className="flex-row justify-between items-center mb-2">
                          <Text className="text-lg font-semibold">Select Pack</Text>
                          <Pressable onPress={() => setShowPackModal(false)}>
                            <Text className="text-primary font-semibold">Close</Text>
                          </Pressable>
                        </View>

                        {isLoading ? (
                          <Text className="text-muted-foreground px-3 py-2">
                            Loading packs...
                          </Text>
                        ) : (
                          <Picker
                            selectedValue={field.state.value || ''}
                            onValueChange={(value) => field.handleChange(value)}
                          >
                            <Picker.Item label="No pack selected" value="" />
                            {availablePacks.map((pack) => (
                              <Picker.Item key={pack.id} label={pack.name} value={pack.id} />
                            ))}
                          </Picker>
                        )}
                      </View>
                    </View>
                  </Modal>
                </FormItem>
              )}
            </form.Field>

            {/* Start Date */}
            <form.Field name="startDate">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Start Date (YYYY-MM-DD)"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    leftView={
                      <View className="pl-2 justify-center">
                        <Icon name="calendar-plus" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

            {/* End Date */}
            <form.Field name="endDate">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="End Date (YYYY-MM-DD)"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    leftView={
                      <View className="pl-2 justify-center">
                        <Icon name="calendar-minus" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

          </FormSection>
        </Form>

        {/* Submit Button */}
        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Pressable
              onPress={() => form.handleSubmit()}
              disabled={!canSubmit || isSubmitting}
              className={`mt-6 rounded-lg px-4 py-3.5 ${!canSubmit || isSubmitting ? 'bg-primary/70' : 'bg-primary'}`}
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

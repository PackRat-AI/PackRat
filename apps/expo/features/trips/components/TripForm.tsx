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
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { z } from 'zod';
import { useCreateTrip, useUpdateTrip } from '../hooks';
import type { Trip } from '../types';

const tripFormSchema = z.object({
  name: z.string().min(1, 'Trip name is required'),
  description: z.string(),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export const TripForm = ({ trip }: { trip?: Trip }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const createTrip = useCreateTrip();
  const updateTrip = useUpdateTrip();
  const isEditingExistingTrip = !!trip;

  const form = useForm({
    defaultValues: {
      name: trip?.name || '',
      description: trip?.description || '',
      location: trip?.location || '',
      startDate: trip?.startDate || '',
      endDate: trip?.endDate || '',
    },
    validators: {
      onChange: (values) => {
        const result = tripFormSchema.safeParse(values);
        if (!result.success) {
          return result.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          }));
        }
        return [];
      },
    },
    onSubmit: async ({ value }) => {
      if (isEditingExistingTrip) {
        await updateTrip({ ...trip, ...value });
      } else {
        await createTrip(value);
      }
      router.back();
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <Stack.Screen options={{ title: isEditingExistingTrip ? 'Edit Trip' : 'New Trip' }} />

      <ScrollView contentContainerClassName="p-8">
        <Form>
          <FormSection ios={{ title: 'Trip Details' }} footnote="Enter trip information">
            {/* Name */}
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Trip Name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    errorMessage={field.state.meta.errors.map((err) => err?.message).join(', ')}
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
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
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
                        <Icon name="newspaper" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

            {/* Location */}
            <form.Field name="location">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Location"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
                        <Icon name="pin" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

            {/* Dates */}
            <form.Field name="startDate">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Start Date (YYYY-MM-DD)"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
                        <Icon name="calendar-plus" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

            <form.Field name="endDate">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="End Date (YYYY-MM-DD)"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
                        <Icon name="calendar-minus" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>
          </FormSection>
        </Form>

        {/* Submit button */}
        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
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



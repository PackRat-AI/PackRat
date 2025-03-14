'use client';

import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { z } from 'zod';
import { DropdownMenu } from '~/components/nativewindui/DropdownMenu';
import { createDropdownItem } from '~/components/nativewindui/DropdownMenu/utils';
import { Form, FormItem, FormSection } from '~/components/nativewindui/Form';
import { TextField } from '~/components/nativewindui/TextField';
import { useCreatePack } from '~/hooks/usePacks';
import { useColorScheme } from '~/lib/useColorScheme';
import type { Pack } from '~/types';
import { Button } from '../nativewindui/Button';
// Define Zod schema
const packFormSchema = z.object({
  name: z.string().min(1, 'Pack name is required'),
  description: z.string(),
  category: z.enum([
    'hiking',
    'backpacking',
    'camping',
    'climbing',
    'winter',
    'desert',
    'custom',
    'water sports',
    'skiing',
  ]),
  isPublic: z.boolean(),
  tags: z.array(z.string()),
});

// Type inference
type PackFormValues = z.infer<typeof packFormSchema>;

// Categories with icons and labels
const CATEGORIES = [
  { value: 'hiking', label: 'Hiking' },
  { value: 'backpacking', label: 'Backpacking' },
  { value: 'camping', label: 'Camping' },
  { value: 'climbing', label: 'Climbing' },
  { value: 'winter', label: 'Winter' },
  { value: 'desert', label: 'Desert' },
  { value: 'custom', label: 'Custom' },
  { value: 'water sports', label: 'Water Sports' },
  { value: 'skiing', label: 'Skiing' },
];

export const PackForm = ({ pack }: { pack?: Pack }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { mutateAsync: createPack, isPending } = useCreatePack();

  const form = useForm({
    defaultValues: {
      name: pack?.name || '',
      description: pack?.description || '',
      category: pack?.category || 'hiking',
      isPublic: pack?.isPublic || false,
      tags: pack?.tags || ['hiking'],
    },
    validators: {
      onChange: packFormSchema,
    },
    onSubmit: async ({ value }) => {
      console.log('Form Submitted:', value);
      await createPack(
        {
          ...value,
          userId: 'default',
          items: [],
          baseWeight: 0,
          category: value.category as
            | 'hiking'
            | 'backpacking'
            | 'camping'
            | 'climbing'
            | 'winter'
            | 'desert'
            | 'custom'
            | 'water sports'
            | 'skiing',
        },
        {
          onSuccess: (pack) => {
            console.log('Pack Created:', pack);

            // We are inside a modal, so we need to pop the current screen and then push the new one
            router.back();
            router.push(`/pack/${pack.id}`);
          },
          onError: (error) => {
            console.error('Error Creating Pack:', error);
          },
        }
      );
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1">
      <ScrollView contentContainerClassName="p-8">
        <Form>
          <FormSection
            ios={{ title: 'Pack Details' }}
            footnote="Enter the basic information about your pack">
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Pack Name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    errorMessage={field.state.meta.errors.map((err: any) => err.message).join(', ')}
                    leftView={
                      <View className="ios:pl-2 justify-center pl-2">
                        <Icon name="folder" size={16} color={colors.grey3} />
                      </View>
                    }
                  />
                </FormItem>
              )}
            </form.Field>

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

            <form.Field name="category">
              {(field) => (
                <FormItem iosSeparatorClassName="hidden">
                  <DropdownMenu
                    items={CATEGORIES.map((category) =>
                      createDropdownItem({
                        actionKey: category.value,
                        title: category.label,
                      })
                    )}
                    onItemPress={(item) => {
                      field.handleChange(item.actionKey);
                    }}>
                    <Button className="my-2 w-full" variant="plain">
                      <View className="w-full flex-row items-center justify-between">
                        <Text>{field.state.value || 'Select Category'}</Text>
                        <Icon name="chevron-down" size={16} color={colors.grey3} />
                      </View>
                    </Button>
                  </DropdownMenu>
                </FormItem>
              )}
            </form.Field>
          </FormSection>

          <FormSection
            ios={{ title: 'Visibility' }}
            footnote="Public packs can be viewed by other users">
            <form.Field name="isPublic">
              {(field) => (
                <FormItem>
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      {field.state.value ? (
                        <Icon name="eye" size={18} color={colors.foreground} />
                      ) : (
                        <Icon name="eye-off" size={18} color={colors.foreground} />
                      )}
                      <Text className="ml-2 font-medium text-foreground">Make Pack Public</Text>
                    </View>
                    <Switch
                      value={field.state.value}
                      onValueChange={field.handleChange}
                      trackColor={{ false: 'hsl(var(--muted))', true: 'hsl(var(--primary))' }}
                      ios_backgroundColor="hsl(var(--muted))"
                    />
                  </View>
                </FormItem>
              )}
            </form.Field>
          </FormSection>
        </Form>

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Pressable
              onPress={() => form.handleSubmit()}
              disabled={!canSubmit || isSubmitting}
              className={`mt-6 rounded-lg px-4 py-3.5 ${!canSubmit || isSubmitting ? 'bg-primary/70' : 'bg-primary'}`}>
              <Text className="text-center text-base font-semibold text-primary-foreground">
                {isSubmitting ? 'Creating...' : 'Create Pack'}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

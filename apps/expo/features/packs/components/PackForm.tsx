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
import { DropdownMenu } from 'nativewindui/DropdownMenu';
import { createDropdownItem } from 'nativewindui/DropdownMenu/utils';
import { Form, FormItem, FormSection } from 'nativewindui/Form';
import { TextField } from 'nativewindui/TextField';
import { useCreatePack, useUpdatePack } from '../hooks';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import type { Pack, PackCategory } from '../types';
import { Button } from 'nativewindui/Button';
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
  const createPack = useCreatePack(); // TODO show feedback for error
  const updatePack = useUpdatePack();
  const isEditingExistingPack = !!pack;

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
      if (isEditingExistingPack) {
        updatePack({
          ...pack,
          ...value,
        });
      } else
        createPack({
          ...value,
          category: value.category as PackCategory,
        });

      router.back();
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
                      field.handleChange(item.actionKey as PackCategory);
                    }}>
                    <Button className="my-2 w-full" variant="plain">
                      <View className="w-full flex-row items-center justify-between capitalize">
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
                {isSubmitting
                  ? isEditingExistingPack
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditingExistingPack
                    ? 'Update Pack'
                    : 'Create Pack'}
                {/* TODO use activity indicator */}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

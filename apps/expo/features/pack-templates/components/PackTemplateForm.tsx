import { Button } from '@packrat/ui/nativewindui/Button';
import { DropdownMenu } from '@packrat/ui/nativewindui/DropdownMenu';
import { createDropdownItem } from '@packrat/ui/nativewindui/DropdownMenu/utils';
import { Form, FormItem, FormSection } from '@packrat/ui/nativewindui/Form';
import { TextField } from '@packrat/ui/nativewindui/TextField';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import type { PackCategory } from 'expo-app/types';
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
import { useCreatePackTemplate } from '../hooks/useCreatePackTemplate';
import { useUpdatePackTemplate } from '../hooks/useUpdatePacktemplate';
import type { PackTemplate } from '../types';

// Schema
const templateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
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
  isAppTemplate: z.boolean(),
  tags: z.array(z.string()),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

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

export const PackTemplateForm = ({ template }: { template?: PackTemplate }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const createTemplate = useCreatePackTemplate();
  const updateTemplate = useUpdatePackTemplate();
  const user = useUser();
  const isEditing = !!template;

  const form = useForm({
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      category: template?.category || 'hiking',
      isAppTemplate: template?.isAppTemplate || false,
      tags: template?.tags || ['hiking'],
    },
    validators: {
      onChange: templateFormSchema,
    },
    onSubmit: async ({ value }) => {
      if (isEditing) {
        updateTemplate({ ...template, ...value });
      } else {
        createTemplate({
          ...value,
          category: value.category as PackCategory,
        });
      }
      router.back();
    },
  });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView contentContainerClassName="p-8">
        <Form>
          <FormSection
            ios={{ title: 'Template Details' }}
            footnote="Enter the basic information for this template"
          >
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Template Name"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    errorMessage={field.state.meta.errors.map((e) => e.message).join(', ')}
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
                    items={CATEGORIES.map((cat) =>
                      createDropdownItem({
                        actionKey: cat.value,
                        title: cat.label,
                      }),
                    )}
                    onItemPress={(item) => {
                      field.handleChange(item.actionKey as PackCategory);
                    }}
                  >
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
          {user?.role === 'ADMIN' && (
            <FormSection
              ios={{ title: 'Type' }}
              footnote="App templates are shown to all users. Option is only available to admins."
            >
              <form.Field name="isAppTemplate">
                {(field) => (
                  <FormItem>
                    <View className="flex-row items-center justify-between p-4">
                      <View className="flex-row items-center">
                        <Text className="ml-2 font-medium text-foreground">
                          Mark as App Template
                        </Text>
                      </View>
                      <Switch
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        trackColor={{
                          false: 'hsl(var(--muted))',
                          true: 'hsl(var(--primary))',
                        }}
                        ios_backgroundColor="hsl(var(--muted))"
                      />
                    </View>
                  </FormItem>
                )}
              </form.Field>
            </FormSection>
          )}
        </Form>

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
                  ? isEditing
                    ? 'Updating...'
                    : 'Creating...'
                  : isEditing
                    ? 'Update Template'
                    : 'Create Template'}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

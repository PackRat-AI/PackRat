import {
  Button,
  createDropdownItem,
  DropdownMenu,
  Form,
  FormItem,
  FormSection,
  TextField,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { useUser } from 'expo-app/features/auth/hooks/useUser';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
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

export const PackTemplateForm = ({ template }: { template?: PackTemplate }) => {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const createTemplate = useCreatePackTemplate();
  const updateTemplate = useUpdatePackTemplate();
  const user = useUser();
  const isEditing = !!template;

  // Schema
  const templateFormSchema = z.object({
    name: z.string().min(1, t('packTemplates.templateNameRequired')),
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

  // Categories with translations
  const CATEGORIES = [
    { value: 'hiking', label: t('packTemplates.hiking') },
    { value: 'backpacking', label: t('packTemplates.backpacking') },
    { value: 'camping', label: t('packTemplates.camping') },
    { value: 'climbing', label: t('packTemplates.climbing') },
    { value: 'winter', label: t('packTemplates.winter') },
    { value: 'desert', label: t('packTemplates.desert') },
    { value: 'custom', label: t('packTemplates.custom') },
    { value: 'water sports', label: t('packTemplates.waterSports') },
    { value: 'skiing', label: t('packTemplates.skiing') },
  ];

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
            ios={{ title: t('packTemplates.templateDetails') }}
            footnote={t('packTemplates.enterBasicInfo')}
          >
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('packTemplates.templateName')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    errorMessage={field.state.meta.errors.map((e) => e?.message).join(', ')}
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
                    placeholder={t('packTemplates.description')}
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
                        <Text className="text-zinc-800 dark:text-zinc-200">
                          {field.state.value || t('packTemplates.selectCategory')}
                        </Text>

                        <Icon name="chevron-down" size={16} color={colors.grey2} />
                      </View>
                    </Button>
                  </DropdownMenu>
                </FormItem>
              )}
            </form.Field>
          </FormSection>
          {user?.role === 'ADMIN' && (
            <FormSection
              ios={{ title: t('packTemplates.type') }}
              footnote={t('packTemplates.appTemplateFootnote')}
            >
              <form.Field name="isAppTemplate">
                {(field) => (
                  <FormItem>
                    <View className="flex-row items-center justify-between p-4">
                      <View className="flex-row items-center">
                        <Text className="ml-2 font-medium text-foreground">
                          {t('packTemplates.markAsAppTemplate')}
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
                    ? t('packTemplates.updating')
                    : t('packTemplates.creating')
                  : isEditing
                    ? t('packTemplates.updateTemplate')
                    : t('packTemplates.createTemplate')}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

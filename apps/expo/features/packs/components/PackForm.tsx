import { FilterChip, FlowRow, Text as JCText } from '@expo/ui/jetpack-compose';
import { testID as testIDModifier } from '@expo/ui/jetpack-compose/modifiers';
import { PackCategorySchema } from '@packrat/schemas/constants';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import { ThemedHost as Host } from '@packrat/ui/src/themed-host';
import { Toggle } from '@packrat/ui/src/toggle';
import { useForm } from '@tanstack/react-form';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useCreatePack, useUpdatePack } from '../hooks';
import type { Pack } from '../types';

const PACK_CATEGORIES = Object.freeze([
  { value: 'hiking', labelKey: 'packs.categories.hiking' },
  { value: 'backpacking', labelKey: 'packs.categories.backpacking' },
  { value: 'camping', labelKey: 'packs.categories.camping' },
  { value: 'climbing', labelKey: 'packs.categories.climbing' },
  { value: 'winter', labelKey: 'packs.categories.winter' },
  { value: 'desert', labelKey: 'packs.categories.desert' },
  { value: 'water sports', labelKey: 'packs.categories.waterSports' },
  { value: 'skiing', labelKey: 'packs.categories.skiing' },
  { value: 'custom', labelKey: 'packs.categories.custom' },
] as const);

const packFormSchema = z.object({
  name: z.string().trim().min(1, 'Give your pack a name.'),
  description: z.string(),
  category: PackCategorySchema,
  isPublic: z.boolean(),
  tags: z.array(z.string()),
});

/** A small, quiet section label: it names the group without competing with the fields. */
function Heading({ title }: { title: string }) {
  const { colors } = useColorScheme();
  return (
    <Text variant="footnote" textColor={colors.grey3} className="px-1 font-medium">
      {title}
    </Text>
  );
}

/**
 * Creates or edits a pack: name and description, the activity it's for as Material 3 filter
 * chips, and visibility as a switch row. Saving is in the top app bar.
 */
export const PackForm = ({ pack }: { pack?: Pack }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useColorScheme();
  const createPack = useCreatePack();
  const updatePack = useUpdatePack();

  const form = useForm({
    defaultValues: {
      name: pack?.name || '',
      description: pack?.description || '',
      category: pack?.category || 'hiking',
      isPublic: pack?.isPublic || false,
      tags: pack?.tags || [],
    },
    validators: { onChange: packFormSchema },
    onSubmit: async ({ value }) => {
      const values = { ...value, name: value.name.trim() };
      if (pack) updatePack({ ...pack, ...values });
      else createPack(values);
      router.back();
    },
  });

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting, s.values.name] as const}>
              {([canSubmit, isSubmitting, name]) => (
                <Button
                  variant="text"
                  testID={testIds.packs.submitBtn}
                  onPress={() => form.handleSubmit()}
                  disabled={!canSubmit || isSubmitting || !name.trim()}
                  label={t('common.save')}
                />
              )}
            </form.Subscribe>
          ),
        }}
      />
      <KeyboardAwareScrollView
        className="flex-1 bg-background"
        bottomOffset={8}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 32 }}
      >
        <View className="gap-4">
          <form.Field name="name">
            {(field) => (
              <TextField
                testID={testIds.packs.nameInput}
                containerTestID={testIds.packs.nameInputContainer}
                placeholder={t('packs.form.name')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                errorMessage={
                  field.state.meta.isTouched ? field.state.meta.errors[0]?.message : undefined
                }
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <TextField
                testID={testIds.packs.descriptionInput}
                containerTestID={testIds.packs.descriptionInputContainer}
                placeholder={t('packs.description')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                multiline
                textAlignVertical="top"
              />
            )}
          </form.Field>
        </View>

        <View className="gap-3">
          <Heading title={t('packs.form.activity')} />
          <form.Field name="category">
            {(field) => (
              <Host matchContents={{ vertical: true, horizontal: false }} style={{ width: '100%' }}>
                <FlowRow
                  horizontalArrangement={{ spacedBy: 8 }}
                  verticalArrangement={{ spacedBy: 8 }}
                >
                  {PACK_CATEGORIES.map((category) => (
                    <FilterChip
                      key={category.value}
                      selected={field.state.value === category.value}
                      onClick={() => field.handleChange(category.value)}
                      modifiers={[testIDModifier(testIds.packs.categoryChip(category.value))]}
                    >
                      <FilterChip.Label>
                        <JCText>{t(category.labelKey)}</JCText>
                      </FilterChip.Label>
                    </FilterChip>
                  ))}
                </FlowRow>
              </Host>
            )}
          </form.Field>
        </View>

        <View className="gap-3">
          <Heading title={t('packs.visibility')} />
          <form.Field name="isPublic">
            {(field) => (
              <Pressable
                onPress={() => field.handleChange(!field.state.value)}
                accessibilityRole="switch"
                accessibilityState={{ checked: field.state.value }}
                android_ripple={{ color: colors.grey4 }}
                className="min-h-16 flex-row items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card px-4 py-3"
              >
                <View className="flex-1">
                  <Text variant="body">{t('packs.form.public')}</Text>
                  <Text variant="subhead" className="text-muted-foreground">
                    {t('packs.publicPacksVisible')}
                  </Text>
                </View>
                <Toggle
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  testID={testIds.packs.publicToggle}
                />
              </Pressable>
            )}
          </form.Field>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
};

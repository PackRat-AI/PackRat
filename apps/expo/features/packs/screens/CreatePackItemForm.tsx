import type { WeightUnit } from '@packrat/constants';
import { safeIndexOf } from '@packrat/guards';
import { showAlert } from '@packrat/ui/src/alert-host';
import { Button } from '@packrat/ui/src/button';
import { SegmentedControl } from '@packrat/ui/src/segmented-control';
import { Text } from '@packrat/ui/src/text';
import { TextField } from '@packrat/ui/src/text-field';
import { Toggle } from '@packrat/ui/src/toggle';
import * as Sentry from '@sentry/react-native';
import { useForm } from '@tanstack/react-form';
import { Icon } from 'expo-app/components/Icon';
import { useWeightUnit } from 'expo-app/features/auth/hooks/useWeightUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { handlePermissionDenied } from 'expo-app/lib/permissions/permissionDeniedAlert';
import { testIds } from 'expo-app/lib/testIds';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { Stack, useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useCreatePackItem, useUpdatePackItem } from '../hooks';
import { useImagePicker } from '../hooks/useImagePicker';
import type { PackItem } from '../types';

const itemFormSchema = z.object({
  name: z.string().trim().min(1, 'Give your item a name.'),
  description: z.string(),
  weight: z.number().min(0, "Weight can't be negative."),
  weightUnit: z.enum(['g', 'oz', 'kg', 'lb']),
  quantity: z.number().int().min(1, 'Bring at least one.'),
  category: z.string(),
  consumable: z.boolean(),
  worn: z.boolean(),
  notes: z.string(),
  image: z.string().nullable(),
});

const WEIGHT_UNITS: WeightUnit[] = ['g', 'oz', 'kg', 'lb'];

function Heading({ title }: { title: string }) {
  return (
    <Text variant="subhead" className="mb-1 px-1 font-medium text-primary">
      {title}
    </Text>
  );
}

/** A tappable row with a title, supporting text and a switch, like Material 3 list items. */
function SwitchRow({
  title,
  supporting,
  value,
  onValueChange,
  testID,
}: {
  title: string;
  supporting: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  testID: string;
}) {
  const { colors } = useColorScheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      android_ripple={{ color: colors.grey4 }}
      className="min-h-16 flex-row items-center gap-4 px-4 py-3"
    >
      <View className="flex-1">
        <Text variant="body">{title}</Text>
        <Text variant="subhead" className="text-muted-foreground">
          {supporting}
        </Text>
      </View>
      <Toggle value={value} onValueChange={onValueChange} testID={testID} />
    </Pressable>
  );
}

/** Rows grouped in one outlined card, separated by dividers. */
function Group({ children }: { children: ReactNode }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card">{children}</View>
  );
}

/**
 * Adds or edits a pack item: name, category and description; weight with its unit and a quantity
 * stepper; consumable and worn as switch rows; a photo; notes. Saving is in the top app bar.
 */
export const CreatePackItemForm = ({
  packId,
  existingItem,
}: {
  packId: string;
  existingItem?: PackItem;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { unit: preferredWeightUnit } = useWeightUnit();
  const createPackItem = useCreatePackItem();
  const updatePackItem = useUpdatePackItem();
  const insets = useSafeAreaInsets();
  const {
    selectedImage,
    pickImage,
    takePhoto,
    permanentlyPersistImageLocally,
    deleteImage,
    clearSelectedImage,
  } = useImagePicker();

  // Keep track of the initial image URL for comparison during updates
  const initialImageUrl = useRef(existingItem?.image || null);
  const isEditing = !!existingItem;

  // Track if the image has been changed
  const [imageChanged, setImageChanged] = useState(false);
  const [weightText, setWeightText] = useState(
    existingItem?.weight != null ? String(existingItem.weight) : '0',
  );

  const form = useForm({
    defaultValues: existingItem
      ? {
          name: existingItem.name,
          description: existingItem.description || '',
          weight: existingItem.weight,
          weightUnit: existingItem.weightUnit,
          quantity: existingItem.quantity,
          category: existingItem.category || '',
          consumable: existingItem.consumable,
          worn: existingItem.worn,
          notes: existingItem.notes || '',
          image: existingItem.image || null,
        }
      : {
          name: '',
          description: '',
          weight: 0,
          weightUnit: preferredWeightUnit,
          quantity: 1,
          category: '',
          consumable: false,
          worn: false,
          notes: '',
          image: null,
        },
    validators: {
      onChange: itemFormSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        const validatedData = itemFormSchema.parse({ ...value, name: value.name.trim() });

        let imageUrl = validatedData.image;
        const oldImageUrl = initialImageUrl.current;

        // Permanently save the new image on users' device if one is selected - because selectedImage is currrently in temporary cache
        if (selectedImage) {
          imageUrl = await permanentlyPersistImageLocally();
          if (!imageUrl) {
            showAlert({
              title: t('items.form.errorTitle'),
              message: t('items.form.photoSaveFailed'),
            });
            return;
          }
          validatedData.image = imageUrl;
        }

        // Submit the form with the image URL
        if (isEditing) {
          updatePackItem({ ...existingItem, ...validatedData });
          router.back();
        } else {
          createPackItem({ packId, itemData: validatedData });
          router.back();
        }

        // Check if we need to delete the old image
        if (isEditing && oldImageUrl && imageChanged) {
          deleteImage(oldImageUrl); // delete old image from local storage
        }
      } catch (err) {
        Sentry.captureException(err, {
          tags: { feature: 'packs', action: 'createPackItem' },
          extra: { packId, isEditing },
        });
        showAlert({ title: t('items.form.errorTitle'), message: t('items.form.saveFailed') });
      }
    },
  });

  const addPhoto = async (source: 'camera' | 'library') => {
    try {
      if (source === 'camera') await takePhoto();
      else await pickImage();
      setImageChanged(true);
    } catch (err) {
      if (handlePermissionDenied(err)) return;
      Sentry.captureException(err, {
        tags: { feature: 'packs', action: 'addItemPhoto' },
        extra: { source },
      });
      showAlert({ title: t('items.form.errorTitle'), message: t('items.form.photoFailed') });
    }
  };

  const handleRemoveImage = () => {
    // If we have a selected image, clear it
    if (selectedImage) {
      clearSelectedImage();
    }

    // If we have an existing image URL in the form, clear it
    if (form.getFieldValue('image')) {
      form.setFieldValue('image', null);
      setImageChanged(true);
    }
  };

  // Determine what image to show in the UI
  const imageFieldValue = form.getFieldValue('image') as string | null;
  const displayImage = selectedImage
    ? { uri: selectedImage.uri }
    : imageFieldValue
      ? { uri: ImageCacheManager.cacheDirectory + imageFieldValue }
      : null;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting, s.values.name] as const}>
              {([canSubmit, isSubmitting, name]) => (
                <Button
                  variant="text"
                  testID={testIds.items.submitBtn}
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
        keyboardDismissMode="interactive"
        contentContainerStyle={{ padding: 24, paddingBottom: insets.bottom + 32, gap: 32 }}
      >
        <View className="gap-4">
          <form.Field name="name">
            {(field) => (
              <TextField
                testID={testIds.items.nameInput}
                containerTestID={testIds.items.nameInputContainer}
                placeholder={t('items.form.name')}
                autoFocus={!isEditing}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                errorMessage={
                  field.state.meta.isTouched ? field.state.meta.errors[0]?.message : undefined
                }
              />
            )}
          </form.Field>
          <form.Field name="category">
            {(field) => (
              <TextField
                testID={testIds.items.categoryInput}
                placeholder={t('items.form.category')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
              />
            )}
          </form.Field>
          <form.Field name="description">
            {(field) => (
              <TextField
                testID={testIds.items.descriptionInput}
                containerTestID={testIds.items.descriptionInputContainer}
                placeholder={t('items.form.description')}
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
          <Heading title={t('items.form.weightHeading')} />
          <form.Field name="weight">
            {(field) => (
              <TextField
                testID={testIds.items.weightInput}
                containerTestID={testIds.items.weightInputContainer}
                placeholder={t('items.form.weight')}
                value={weightText}
                onBlur={field.handleBlur}
                onChangeText={(text) => {
                  setWeightText(text);
                  const parsed = parseFloat(text);
                  field.handleChange(Number.isFinite(parsed) ? parsed : 0);
                }}
                keyboardType="decimal-pad"
                errorMessage={field.state.meta.errors[0]?.message}
              />
            )}
          </form.Field>
          <form.Field name="weightUnit">
            {(field) => (
              <View testID={testIds.items.weightUnitControl}>
                <SegmentedControl
                  values={WEIGHT_UNITS}
                  selectedIndex={safeIndexOf({ array: WEIGHT_UNITS, value: field.state.value })}
                  onIndexChange={(index) => {
                    const selectedUnit = WEIGHT_UNITS[index];
                    if (selectedUnit) field.handleChange(selectedUnit);
                  }}
                />
              </View>
            )}
          </form.Field>
          <form.Field name="quantity">
            {(field) => (
              <Group>
                <View className="min-h-16 flex-row items-center gap-2 px-4 py-2">
                  <Text variant="body" className="flex-1">
                    {t('items.form.quantity')}
                  </Text>
                  <Button
                    variant="outlined"
                    size="icon"
                    icon="minus"
                    accessibilityLabel={t('items.form.decrease')}
                    disabled={field.state.value <= 1}
                    onPress={() => field.handleChange(Math.max(1, field.state.value - 1))}
                  />
                  <Text
                    variant="heading"
                    className="min-w-10 text-center"
                    testID={testIds.items.quantityInput}
                  >
                    {field.state.value}
                  </Text>
                  <Button
                    variant="outlined"
                    size="icon"
                    icon="plus"
                    accessibilityLabel={t('items.form.increase')}
                    onPress={() => field.handleChange(field.state.value + 1)}
                  />
                </View>
              </Group>
            )}
          </form.Field>
        </View>

        <View className="gap-3">
          <Heading title={t('items.form.tripHeading')} />
          <Group>
            <form.Field name="consumable">
              {(field) => (
                <SwitchRow
                  title={t('items.form.consumable')}
                  supporting={t('items.form.consumableHint')}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  testID={testIds.items.consumableToggle}
                />
              )}
            </form.Field>
            <View className="mx-4 h-px bg-border" />
            <form.Field name="worn">
              {(field) => (
                <SwitchRow
                  title={t('items.form.worn')}
                  supporting={t('items.form.wornHint')}
                  value={field.state.value}
                  onValueChange={field.handleChange}
                  testID={testIds.items.wornToggle}
                />
              )}
            </form.Field>
          </Group>
        </View>

        <View className="gap-3">
          <Heading title={t('items.form.photoHeading')} />
          {displayImage ? (
            <View>
              <Image source={displayImage} className="h-48 w-full rounded-2xl" resizeMode="cover" />
              <Pressable
                onPress={handleRemoveImage}
                accessibilityRole="button"
                accessibilityLabel={t('items.form.removePhoto')}
                testID={testIds.items.removePhotoBtn}
                className="absolute right-2 top-2 h-10 w-10 items-center justify-center rounded-full bg-black/60"
              >
                <Icon name="close" size={20} color="#ffffff" />
              </Pressable>
            </View>
          ) : (
            <View className="flex-row gap-2">
              <Button
                variant="outlined"
                icon="camera-outline"
                className="flex-1"
                label={t('items.form.takePhoto')}
                testID={testIds.items.takePhotoBtn}
                onPress={() => addPhoto('camera')}
              />
              <Button
                variant="outlined"
                icon="image-outline"
                className="flex-1"
                label={t('items.form.choosePhoto')}
                testID={testIds.items.choosePhotoBtn}
                onPress={() => addPhoto('library')}
              />
            </View>
          )}
        </View>

        <View className="gap-3">
          <Heading title={t('items.form.notesHeading')} />
          <form.Field name="notes">
            {(field) => (
              <TextField
                placeholder={t('items.form.notes')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          </form.Field>
        </View>
      </KeyboardAwareScrollView>
    </>
  );
};

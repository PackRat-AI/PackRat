import { useActionSheet } from '@expo/react-native-action-sheet';
import { Form, FormItem, FormSection, SegmentedControl, TextField } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import { useForm } from '@tanstack/react-form';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import type { WeightUnit } from 'expo-app/types';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Pressable, Switch, Text, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { useCreatePackItem, useUpdatePackItem } from '../hooks';
import { useImagePicker } from '../hooks/useImagePicker';
import type { PackItem, PackItemInput } from '../types';

// Define Zod schema
const itemFormSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string(),
  weight: z.number().min(0, 'Weight cannot be negative'),
  weightUnit: z.enum(['g', 'oz', 'kg', 'lb']),
  quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  category: z.string(),
  consumable: z.boolean(),
  worn: z.boolean(),
  notes: z.string(),
  image: z.string().nullable(),
});

// Weight units
const WEIGHT_UNITS: WeightUnit[] = ['g', 'oz', 'kg', 'lb'];

export const CreatePackItemForm = ({
  packId,
  existingItem,
}: {
  packId: string;
  existingItem?: PackItem;
}) => {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();
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
  const [descriptionHeight, setDescriptionHeight] = useState(40);
  const [weightText, setWeightText] = useState(
    existingItem?.weight != null ? String(existingItem.weight) : '0',
  );

  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
    return () => {
      hasMounted.current = false;
    };
  }, []);

  const form = useForm({
    defaultValues: existingItem
      ? {
          name: existingItem.name,
          description: existingItem.description || '',
          weight: existingItem.weight,
          weightUnit: existingItem.weightUnit as WeightUnit,
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
          weightUnit: 'g' as WeightUnit,
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
        // Validate the form data before processing
        const validatedData = itemFormSchema.parse(value);

        let imageUrl = validatedData.image;
        const oldImageUrl = initialImageUrl.current;

        // Permanently save the new image on users' device if one is selected - because selectedImage is currrently in temporary cache
        if (selectedImage) {
          imageUrl = await permanentlyPersistImageLocally();
          if (!imageUrl) {
            Alert.alert('Error', 'Failed to save item image. Please try again.');
            return;
          }
          validatedData.image = imageUrl;
        }

        // Submit the form with the image URL
        if (isEditing) {
          updatePackItem({ ...existingItem, ...(validatedData as PackItemInput) });
          router.back();
        } else {
          createPackItem({ packId, itemData: validatedData as PackItemInput });
          router.back();
        }

        // Check if we need to delete the old image
        if (isEditing && oldImageUrl && imageChanged) {
          deleteImage(oldImageUrl); // delete old image from local storage
        }
      } catch (err) {
        console.error('Error submitting form:', err);
        Alert.alert('Error', 'Failed to save item. Please try again.');
      }
    },
  });

  const handleAddImage = async () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: {
          backgroundColor: colors.card,
          paddingBottom: insets.bottom,
        },
        textStyle: {
          color: colors.foreground,
        },
      },
      async (selectedIndex) => {
        try {
          switch (selectedIndex) {
            case 0: // Take Photo
              await takePhoto();
              setImageChanged(true);
              break;
            case 1: // Choose from Library
              await pickImage();
              setImageChanged(true);
              break;
            case cancelButtonIndex:
              // Canceled
              return;
          }
        } catch (err) {
          console.error('Error handling image:', err);
          Alert.alert('Error', 'Failed to process image. Please try again.');
        }
      },
    );
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

  const contentContainerStyle = useMemo(
    () => ({ padding: 32, paddingBottom: insets.bottom + 32 }),
    [insets.bottom],
  );

  return (
    <KeyboardAwareScrollView
      bottomOffset={8}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={contentContainerStyle}
    >
      <Form>
        <FormSection
          ios={{ title: t('items.itemDetails') }}
          footnote="Enter the basic information about your item"
        >
          <form.Field name="name">
            {(field) => (
              <FormItem>
                <TextField
                  placeholder={t('packs.itemName')}
                  autoFocus
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  errorMessage={field.state.meta.errors[0]?.message}
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="backpack" size={16} color={colors.grey3} />
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
                  placeholder={t('packs.description')}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  multiline
                  onLayout={(e) => {
                    const h = e.nativeEvent.layout.height;
                    if (hasMounted.current && h !== descriptionHeight) {
                      setDescriptionHeight(h);
                    }
                  }}
                  numberOfLines={3}
                  textAlignVertical="top"
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="information" size={16} color={colors.grey3} />
                    </View>
                  }
                />
              </FormItem>
            )}
          </form.Field>

          <form.Field name="category">
            {(field) => (
              <FormItem>
                <TextField
                  placeholder={t('packs.categoryExample')}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="tag" size={16} color={colors.grey3} />
                    </View>
                  }
                />
              </FormItem>
            )}
          </form.Field>
        </FormSection>

        <FormSection
          ios={{ title: t('packs.weightAndQuantity') }}
          footnote="Specify the weight details"
        >
          <form.Field name="weight">
            {(field) => (
              <FormItem>
                <TextField
                  placeholder={t('packs.weight')}
                  value={weightText}
                  onBlur={field.handleBlur}
                  onChangeText={(text) => {
                    setWeightText(text);
                    const parsed = parseFloat(text);
                    field.handleChange(Number.isFinite(parsed) ? parsed : 0);
                  }}
                  keyboardType="decimal-pad"
                  errorMessage={field.state.meta.errors[0]?.message}
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="dumbbell" size={16} color={colors.grey3} />
                    </View>
                  }
                />
              </FormItem>
            )}
          </form.Field>

          <form.Field name="weightUnit">
            {(field) => (
              <FormItem>
                <View className="px-2 py-2">
                  <Text className="text-foreground/70 mb-2 text-sm">{t('packs.unit')}</Text>
                  <SegmentedControl
                    values={WEIGHT_UNITS}
                    selectedIndex={WEIGHT_UNITS.indexOf(field.state.value as WeightUnit)}
                    onIndexChange={(index) => {
                      const selectedUnit = WEIGHT_UNITS[index];
                      if (selectedUnit) {
                        field.handleChange(selectedUnit);
                      }
                    }}
                  />
                </View>
              </FormItem>
            )}
          </form.Field>

          <form.Field name="quantity">
            {(field) => (
              <FormItem>
                <TextField
                  placeholder={t('packs.quantity')}
                  value={field.state.value === 0 ? '' : field.state.value.toString()}
                  onBlur={field.handleBlur}
                  onChangeText={(text) => {
                    const intValue = text === '' ? 0 : parseInt(text, 10);
                    field.handleChange(intValue);
                  }}
                  keyboardType="numeric"
                  errorMessage={field.state.meta.errors[0]?.message}
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="circle-outline" size={16} color={colors.grey3} />
                    </View>
                  }
                />
              </FormItem>
            )}
          </form.Field>
        </FormSection>

        <FormSection ios={{ title: t('packs.properties') }} footnote="Special item properties">
          <form.Field name="consumable">
            {(field) => (
              <FormItem>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <Icon name="silverware-fork-knife" size={18} color={colors.foreground} />
                    <Text className="ml-2 font-medium text-foreground">
                      {t('packs.consumable')}
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

          <form.Field name="worn">
            {(field) => (
              <FormItem>
                <View className="flex-row items-center justify-between p-4">
                  <View className="flex-row items-center">
                    <Icon name="account-circle" size={18} color={colors.foreground} />
                    <Text className="ml-2 font-medium text-foreground">
                      {t('packs.wornNotCarried')}
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

        <FormSection
          ios={{ title: t('packs.image') }}
          footnote="Add an image of your item (optional)"
        >
          <form.Field name="image">
            {(_field) => (
              <FormItem>
                {displayImage ? (
                  <View className="relative">
                    <Image
                      source={displayImage}
                      className="h-48 w-full rounded-lg"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      className="absolute right-2 top-2 rounded-full bg-black bg-opacity-50 p-1"
                      onPress={handleRemoveImage}
                    >
                      <Icon name="close" size={20} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity
                    className="h-48 items-center justify-center rounded-lg border border-dashed border-input bg-background p-4"
                    onPress={handleAddImage}
                  >
                    <Icon name="camera" size={32} color={colors.foreground} />
                    <Text className="mt-2 text-muted-foreground">{t('packs.tapToAddImage')}</Text>
                  </TouchableOpacity>
                )}
              </FormItem>
            )}
          </form.Field>
        </FormSection>

        <FormSection ios={{ title: t('packs.notes') }} footnote="Additional information">
          <form.Field name="notes">
            {(field) => (
              <FormItem>
                <TextField
                  placeholder={t('packs.additionalNotes')}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  leftView={
                    <View className="ios:pl-2 justify-center pl-2">
                      <Icon name="note-text-outline" size={16} color={colors.grey3} />
                    </View>
                  }
                />
              </FormItem>
            )}
          </form.Field>
        </FormSection>
      </Form>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <Pressable
            onPress={form.handleSubmit}
            disabled={!canSubmit || isSubmitting}
            className={`mt-6 rounded-lg px-4 py-3.5 ${
              !canSubmit || isSubmitting ? 'bg-primary/70' : 'bg-primary'
            }`}
          >
            <Text className="text-center text-base font-semibold text-primary-foreground">
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Item' : 'Add Item'}
            </Text>
          </Pressable>
        )}
      </form.Subscribe>
    </KeyboardAwareScrollView>
  );
};

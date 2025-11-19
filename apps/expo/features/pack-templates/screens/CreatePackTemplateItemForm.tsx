// CreatePackTemplateItemForm.tsx

import { useActionSheet } from '@expo/react-native-action-sheet';
import { Form, FormItem, FormSection, SegmentedControl, TextField } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { useImagePicker } from 'expo-app/features/packs/hooks/useImagePicker';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import type { WeightUnit } from 'expo-app/types';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { z } from 'zod';
import { useCreatePackTemplateItem } from '../hooks/useCreatePackTemplateItem';
import { useUpdatePackTemplateItem } from '../hooks/useUpdatePackTemplateItem';
import type { PackTemplateItem, PackTemplateItemInput } from '../types';

const itemFormSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string(),
  weight: z.preprocess((val) => (val === '' ? 0 : Number(val)), z.number().min(0)),
  weightUnit: z.enum(['g', 'oz', 'kg', 'lb']),
  quantity: z.preprocess((val) => (val === '' ? 1 : Number(val)), z.number().int().min(1)),
  category: z.string(),
  consumable: z.boolean(),
  worn: z.boolean(),
  notes: z.string(),
  image: z.string().nullable(),
});

// type ItemFormValues = z.infer<typeof itemFormSchema>;

const WEIGHT_UNITS: WeightUnit[] = ['g', 'oz', 'kg', 'lb'];

export const CreatePackTemplateItemForm = ({
  packTemplateId,
  existingItem,
}: {
  packTemplateId: string;
  existingItem?: PackTemplateItem;
}) => {
  const router = useRouter();
  const { colorScheme, colors } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();
  const createItem = useCreatePackTemplateItem();
  const updateItem = useUpdatePackTemplateItem();
  const {
    selectedImage,
    pickImage,
    takePhoto,
    permanentlyPersistImageLocally,
    deleteImage,
    clearSelectedImage,
  } = useImagePicker();

  const initialImageUrl = useRef(existingItem?.image || null);
  const isEditing = !!existingItem;
  const [imageChanged, setImageChanged] = useState(false);

  const form = useForm({
    defaultValues: existingItem || {
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
    onSubmit: async ({ value }) => {
      try {
        // Validate the form data before processing
        const validatedData = itemFormSchema.parse(value);

        let imageUrl = validatedData.image;
        const oldImageUrl = initialImageUrl.current;

        if (selectedImage) {
          imageUrl = await permanentlyPersistImageLocally();
          if (!imageUrl) {
            Alert.alert(t('packTemplates.error'), t('packTemplates.failedToSaveImage'));
            return;
          }
          validatedData.image = imageUrl;
        }

        if (isEditing) {
          updateItem({
            id: existingItem.id,
            packTemplateId: existingItem.packTemplateId,
            deleted: existingItem.deleted,
            ...(validatedData as PackTemplateItemInput),
          });
        } else {
          createItem({ packTemplateId, itemData: validatedData as PackTemplateItemInput });
        }

        if (isEditing && oldImageUrl && imageChanged) {
          deleteImage(oldImageUrl);
        }

        router.back();
      } catch (err) {
        console.error('Error submitting form:', err);
        Alert.alert(t('packTemplates.error'), t('packTemplates.failedToSaveItem'));
      }
    },
  });

  const handleAddImage = async () => {
    const options = [
      t('packTemplates.takePhoto'),
      t('packTemplates.chooseFromLibrary'),
      t('common.cancel'),
    ];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: {
          backgroundColor: colorScheme === 'dark' ? 'black' : 'white',
        },
        textStyle: { color: colors.foreground },
      },
      async (selectedIndex) => {
        try {
          if (selectedIndex === 0) await takePhoto();
          else if (selectedIndex === 1) await pickImage();
          if (selectedIndex === 0 || selectedIndex === 1) setImageChanged(true);
        } catch (err) {
          console.error('Image error:', err);
          Alert.alert(t('packTemplates.error'), t('packTemplates.failedToProcessImage'));
        }
      },
    );
  };

  const handleRemoveImage = () => {
    if (selectedImage) clearSelectedImage();
    if (form.getFieldValue('image')) {
      form.setFieldValue('image', null);
      setImageChanged(true);
    }
  };

  const displayImage = selectedImage
    ? { uri: selectedImage.uri }
    : form.getFieldValue('image')
      ? { uri: ImageCacheManager.cacheDirectory + form.getFieldValue('image') }
      : null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <ScrollView contentContainerClassName="p-8">
        <Form>
          <FormSection
            ios={{ title: t('packTemplates.itemDetails') }}
            footnote={t('packTemplates.enterBasicInfo')}
          >
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('items.itemName')}
                    autoFocus
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
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
                    placeholder={t('packTemplates.description')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    multiline
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
                    placeholder={t('packTemplates.category')}
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
            ios={{ title: t('items.itemWeight') }}
            footnote={t('packTemplates.enterBasicInfo')}
          >
            <form.Field name="weight">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('items.itemWeight')}
                    value={field.state.value.toString()}
                    onBlur={field.handleBlur}
                    onChangeText={(text) => field.handleChange(Number(text) || 0)}
                    keyboardType="numeric"
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
                    <Text className="text-foreground/70 mb-2 text-sm">Unit</Text>
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
                    placeholder={t('items.itemQuantity')}
                    value={field.state.value === 0 ? '' : field.state.value.toString()}
                    onBlur={field.handleBlur}
                    onChangeText={(text) => {
                      const intValue = text === '' ? 0 : parseInt(text, 10);
                      field.handleChange(intValue);
                    }}
                    keyboardType="numeric"
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

          <FormSection
            ios={{ title: t('packTemplates.type') }}
            footnote={t('packTemplates.enterBasicInfo')}
          >
            <form.Field name="consumable">
              {(field) => (
                <FormItem>
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <Icon name="silverware-fork-knife" size={18} color={colors.foreground} />
                      <Text className="ml-2 font-medium text-foreground">
                        {t('packTemplates.consumable')}
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
                        {t('packTemplates.worn')}
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
            ios={{ title: t('common.name') }}
            footnote={t('packTemplates.enterBasicInfo')}
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
                      <Text className="mt-2 text-muted-foreground">
                        {t('packTemplates.addManually')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </FormItem>
              )}
            </form.Field>
          </FormSection>

          <FormSection
            ios={{ title: t('packTemplates.notes') }}
            footnote={t('packTemplates.enterBasicInfo')}
          >
            <form.Field name="notes">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder={t('packTemplates.notes')}
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
                {isSubmitting
                  ? t('common.loading')
                  : isEditing
                    ? t('packTemplates.updateTemplate')
                    : t('packTemplates.addItem')}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

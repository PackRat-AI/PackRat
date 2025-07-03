// CreatePackTemplateItemForm.tsx

import { useActionSheet } from '@expo/react-native-action-sheet';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { Form, FormItem, FormSection } from 'expo-app/components/nativewindui/Form';
import { SegmentedControl } from 'expo-app/components/nativewindui/SegmentedControl';
import { TextField } from 'expo-app/components/nativewindui/TextField';
import { useImageUpload } from 'expo-app/features/packs/hooks/useImageUpload';
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

type ItemFormValues = z.infer<typeof itemFormSchema>;

const WEIGHT_UNITS: WeightUnit[] = ['g', 'oz', 'kg', 'lb'];

export const CreatePackTemplateItemForm = ({
  packTemplateId,
  existingItem,
}: {
  packTemplateId: string;
  existingItem?: any;
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
  } = useImageUpload();

  const initialImageUrl = useRef(existingItem?.image || null);
  const isEditing = !!existingItem;
  const [imageChanged, setImageChanged] = useState(false);

  const form = useForm({
    defaultValues: existingItem || {
      name: '',
      description: '',
      weight: 0,
      weightUnit: 'g',
      quantity: 0,
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
        let imageUrl = value.image;
        const oldImageUrl = initialImageUrl.current;

        if (selectedImage) {
          imageUrl = await permanentlyPersistImageLocally();
          if (!imageUrl) {
            Alert.alert('Error', 'Failed to save item image. Please try again.');
            return;
          }
          value.image = imageUrl;
        }

        if (isEditing) {
          updateItem({ id: existingItem.id, ...value });
        } else {
          createItem({ packTemplateId, itemData: value });
        }

        if (isEditing && oldImageUrl && imageChanged) {
          deleteImage(oldImageUrl);
        }

        router.back();
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
          Alert.alert('Error', 'Failed to process image.');
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
            ios={{ title: 'Item Details' }}
            footnote="Enter the basic information about your item"
          >
            <form.Field name="name">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Item Name"
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
                    placeholder="Description"
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
                    placeholder="Category (e.g., Shelter, Cooking)"
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

          <FormSection ios={{ title: 'Weight & Quantity' }} footnote="Specify the weight details">
            <form.Field name="weight">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Weight"
                    value={field.state.value.toString()}
                    onBlur={field.handleBlur}
                    onChangeText={field.handleChange}
                    keyboardType="numeric"
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
                    <Text className="text-foreground/70 mb-2 text-sm">Unit</Text>
                    <SegmentedControl
                      values={WEIGHT_UNITS}
                      selectedIndex={WEIGHT_UNITS.indexOf(field.state.value)}
                      onIndexChange={(index) => {
                        field.handleChange(WEIGHT_UNITS[index]);
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
                    placeholder="Quantity"
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

          <FormSection ios={{ title: 'Properties' }} footnote="Special item properties">
            <form.Field name="consumable">
              {(field) => (
                <FormItem>
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center">
                      <Icon name="silverware-fork-knife" size={18} color={colors.foreground} />
                      <Text className="ml-2 font-medium text-foreground">Consumable</Text>
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
                      <Text className="ml-2 font-medium text-foreground">Worn (not carried)</Text>
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

          <FormSection ios={{ title: 'Image' }} footnote="Add an image of your item (optional)">
            <form.Field name="image">
              {(field) => (
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
                      <Text className="mt-2 text-muted-foreground">Tap to add an image</Text>
                    </TouchableOpacity>
                  )}
                </FormItem>
              )}
            </form.Field>
          </FormSection>

          <FormSection ios={{ title: 'Notes' }} footnote="Additional information">
            <form.Field name="notes">
              {(field) => (
                <FormItem>
                  <TextField
                    placeholder="Additional notes about this item"
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
                  ? 'Saving...'
                  : isEditing
                    ? 'Update Template Item'
                    : 'Add Template Item'}
              </Text>
            </Pressable>
          )}
        </form.Subscribe>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

import {
  ActivityIndicator,
  Button,
  Form,
  FormItem,
  FormSection,
  TextField,
} from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useForm } from '@tanstack/react-form';
import { useImageUpload } from 'expo-app/features/packs/hooks/useImageUpload';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import ImageCacheManager from 'expo-app/lib/utils/ImageCacheManager';
import { assertDefined } from 'expo-app/utils/typeAssertions';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { z } from 'zod';
import { useCreatePackItem } from '../hooks/useCreatePackItem';
import { useCreatePack } from '../hooks/useCreatePack';
import type { DetectedItemWithMatches } from '../hooks/useImageDetection';
import { useAnalyzeImage, useCreatePackFromImage } from '../hooks/useImageDetection';
import { uploadImage } from '../utils';
import type { CatalogItem } from '../../catalog/types';
import { HorizontalCatalogItemCard } from '../components/HorizontalCatalogItemCard';

const packFromImageSchema = z.object({
  packName: z.string().optional(),
  packDescription: z.string().optional(),
  isPublic: z.boolean().optional(),
  minConfidence: z.number().min(0).max(1),
});

type PackFromImageFormValues = z.infer<typeof packFromImageSchema>;

export function CreatePackFromImageScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { packId } = useLocalSearchParams();
  const { selectedImage, pickImage, takePhoto, deleteImage } = useImageUpload();
  const [analysisResult, setAnalysisResult] = useState<DetectedItemWithMatches[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<number>>(new Set());
  const [currentStep, setCurrentStep] = useState<'selection' | 'review'>('selection');

  const analyzeImageMutation = useAnalyzeImage();
  const createPackMutation = useCreatePackFromImage();
  const createPackItem = useCreatePackItem();
  const createPack = useCreatePack();

  const isAddingToExistingPack = Boolean(packId);

  const form = useForm<PackFromImageFormValues>({
    defaultValues: {
      packName: isAddingToExistingPack ? undefined : '',
      packDescription: isAddingToExistingPack ? undefined : '',
      isPublic: isAddingToExistingPack ? undefined : false,
      minConfidence: 0.5,
    },
    onSubmit: async ({ value }) => {
      if (!selectedImage) {
        Alert.alert('Error', 'Please select an image first');
        return;
      }

      if (!analysisResult || analysisResult.length === 0) {
        Alert.alert('Error', 'Please scan the image first to detect items');
        return;
      }

      if (selectedCatalogItems.size === 0) {
        Alert.alert(
          'No Items Selected',
          'Please select at least one item to add to your pack.',
        );
        return;
      }

      try {
        if (isAddingToExistingPack) {
          // Add selected catalog items to existing pack
          for (const catalogItem of selectedCatalogItemsList) {
            createPackItem({
              packId: packId as string,
              itemData: {
                name: catalogItem.name,
                description: catalogItem.description,
                weight: catalogItem.weight || 100,
                weightUnit: catalogItem.weightUnit || 'g',
                quantity: 1, // Default quantity
                category: catalogItem.categories?.[0] || 'general',
                consumable: false,
                worn: false,
                image: catalogItem.images?.[0],
                notes: `Added from photo scanning (${Math.round(catalogItem.similarity * 100)}% match)`,
                catalogItemId: catalogItem.id,
              },
            });
          }

          Alert.alert(
            'Success!',
            `Added ${selectedCatalogItems.size} items to your pack from the image.`,
            [
              {
                text: 'View Pack',
                onPress: () => router.replace(`/pack/${packId}`),
              },
            ],
          );
        } else {
          // Create new pack with selected catalog items
          if (!value.packName) {
            Alert.alert('Error', 'Pack name is required when creating a new pack');
            return;
          }

          // Create the pack
          const newPackId = createPack({
            name: value.packName,
            description: value.packDescription || '',
            category: 'mixed',
            isPublic: value.isPublic || false,
            tags: [],
          });

          // Add selected catalog items to the new pack
          for (const catalogItem of selectedCatalogItemsList) {
            createPackItem({
              packId: newPackId,
              itemData: {
                name: catalogItem.name,
                description: catalogItem.description,
                weight: catalogItem.weight || 100,
                weightUnit: catalogItem.weightUnit || 'g',
                quantity: 1, // Default quantity
                category: catalogItem.categories?.[0] || 'general',
                consumable: false,
                worn: false,
                image: catalogItem.images?.[0],
                notes: `Added from photo scanning (${Math.round(catalogItem.similarity * 100)}% match)`,
                catalogItemId: catalogItem.id,
              },
            });
          }

          Alert.alert(
            'Success!',
            `Pack "${value.packName}" created with ${selectedCatalogItems.size} items from your image.`,
            [
              {
                text: 'View Pack',
                onPress: () => router.replace(`/pack/${newPackId}`),
              },
            ],
          );
        }
      } catch (error) {
        console.error('Error processing image:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to process image');
      }
    },
  });

  const handleImageUpload = async (): Promise<string | null> => {
    if (!selectedImage) return null;

    try {
      // For now, we'll use a placeholder. In a real implementation, you'd upload to R2
      // and get a public URL. For this demo, we'll assume the image is already accessible.
      return selectedImage.fileName;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    setIsAnalyzing(true);
    try {
      const remoteFileName = await uploadImage(selectedImage.fileName, selectedImage.uri);
      if (!remoteFileName) {
        Toast.show({
          type: 'error',
          text1: "Couldn't Upload Image",
        });
        setIsAnalyzing(false);
        return;
      }
      const result = await analyzeImageMutation.mutateAsync({
        image: remoteFileName,
        matchLimit: 3,
      });

      setAnalysisResult(result.detectedItems);
      setSelectedCatalogItems(new Set()); // Reset selection when analyzing new image

      if (result.detectedItems.length === 0) {
        Alert.alert(
          'No Items Detected',
          'No outdoor gear items were detected in this image. Try taking a clearer photo with better lighting, or ensure your gear is laid out visibly.',
        );
      } else {
        Alert.alert(
          'Scanning Complete',
          `Scanned ${result.detectedItems.length} items in your image. Review the results below and adjust the pack name if needed.`,
        );
      }
    } catch (error) {
      console.error('Error scanning image:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to scan image');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddImage = () => {
    Alert.alert('Add Image', 'Choose how to add your gear photo', [
      { text: 'Camera', onPress: takePhoto },
      { text: 'Gallery', onPress: pickImage },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemoveImage = () => {
    if (selectedImage) {
      deleteImage(selectedImage.uri);
    }
    setAnalysisResult(null);
    setSelectedCatalogItems(new Set());
    setCurrentStep('selection');
  };

  const handleCatalogItemToggle = (item: CatalogItem) => {
    const newSelected = new Set(selectedCatalogItems);
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else {
      newSelected.add(item.id);
    }
    setSelectedCatalogItems(newSelected);
  };

  const handleProceedToReview = () => {
    if (!analysisResult || analysisResult.length === 0) {
      Alert.alert('Error', 'Please scan the image first to detect items');
      return;
    }
    setCurrentStep('review');
  };

  const handleBackToSelection = () => {
    setCurrentStep('selection');
  };

  const displayImage = selectedImage ? { uri: selectedImage.uri } : null;
  const highConfidenceItems =
    analysisResult?.filter(
      (item) => item.detected.confidence >= form.getFieldValue('minConfidence'),
    ) || [];

  // Get all catalog items from analysis results with their similarity scores
  const allCatalogItems: (CatalogItem & { similarity: number })[] = 
    analysisResult?.flatMap(item => 
      item.catalogMatches.map(match => ({
        ...match,
        similarity: match.similarity,
      }))
    ) || [];

  // Get unique catalog items (in case same item matches multiple detections)
  const uniqueCatalogItems = allCatalogItems.reduce((acc, item) => {
    const existing = acc.find(existing => existing.id === item.id);
    if (!existing || item.similarity > existing.similarity) {
      acc = acc.filter(existing => existing.id !== item.id);
      acc.push(item);
    }
    return acc;
  }, [] as (CatalogItem & { similarity: number })[]);

  const selectedCatalogItemsList = uniqueCatalogItems.filter(item => 
    selectedCatalogItems.has(item.id)
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: currentStep === 'selection' 
            ? 'Select Photo'
            : isAddingToExistingPack 
              ? 'Review Items to Add' 
              : 'Review Pack Items',
          headerBackVisible: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-background">
          <View className="p-4">
            {currentStep === 'selection' ? (
              <Form>
              {/* Image Upload Section */}
              <FormSection
                ios={{ title: 'Gear Photo' }}
                footnote="Take or upload a photo of your gear laid out for packing"
              >
                <FormItem>
                  {displayImage ? (
                    <View className="relative">
                      <Image
                        source={displayImage}
                        className="h-64 w-full rounded-lg"
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        className="absolute right-2 top-2 rounded-full bg-black bg-opacity-50 p-2"
                        onPress={handleRemoveImage}
                      >
                        <Icon name="close" size={20} color="#ffffff" />
                      </TouchableOpacity>
                      {!isAnalyzing && !analysisResult && (
                        <TouchableOpacity
                          className="absolute bottom-2 right-2 rounded-full bg-blue-500 px-4 py-2"
                          onPress={handleAnalyzeImage}
                        >
                          <Text className="font-medium text-white">Scan Items</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="h-64 items-center justify-center rounded-lg border border-dashed border-input bg-muted p-4"
                      onPress={handleAddImage}
                    >
                      <Icon name="camera" size={48} color={colors.grey2} />
                      <Text className="mt-2 text-muted-foreground">Tap to add gear photo</Text>
                      <Text className="text-center text-xs text-muted-foreground mt-1">
                        Lay out your gear and take a clear photo for best results
                      </Text>
                    </TouchableOpacity>
                  )}
                </FormItem>
              </FormSection>

              {/* Scanning Progress */}
              {isAnalyzing && (
                <FormSection ios={{ title: 'Items Scanning' }}>
                  <FormItem>
                    <View className="flex-row items-center justify-center py-4">
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text className="ml-2 text-muted-foreground">
                        Scanning your gear photo...
                      </Text>
                    </View>
                  </FormItem>
                </FormSection>
              )}



                {/* Step 1 Action Button */}
                <View className="p-4 pb-8">
                  <Button
                    onPress={handleProceedToReview}
                    disabled={!selectedImage || !analysisResult}
                    className="w-full"
                  >
                    <Text>Continue to Review ({uniqueCatalogItems.length} items found)</Text>
                  </Button>
                </View>
              </Form>
            ) : (
              /* Step 2: Review */
              <Form>
                {/* Step Navigation */}
                <FormSection ios={{ title: 'Review Items' }}>
                  <FormItem>
                    <View className="flex-row items-center justify-between p-4 bg-muted rounded-lg">
                      <View>
                        <Text className="font-medium">Selected Photo</Text>
                        <Text className="text-sm text-muted-foreground">
                          Found {uniqueCatalogItems.length} catalog matches
                        </Text>
                      </View>
                      <Button variant="outline" size="sm" onPress={handleBackToSelection}>
                        <Text>Change Photo</Text>
                      </Button>
                    </View>
                  </FormItem>
                </FormSection>

                {/* Catalog Items Selection */}
                {uniqueCatalogItems.length > 0 && (
                  <FormSection
                    ios={{ title: 'Select Items to Add' }}
                    footnote={`Found ${uniqueCatalogItems.length} catalog matches. Tap to select items for your pack.`}
                  >
                    <FormItem>
                      <View className="gap-2">
                        {uniqueCatalogItems.map((item) => (
                          <HorizontalCatalogItemCard
                            key={item.id}
                            item={item}
                            selected={selectedCatalogItems.has(item.id)}
                            onSelect={handleCatalogItemToggle}
                          />
                        ))}
                      </View>
                    </FormItem>
                  </FormSection>
                )}

                {/* Pack Details Form - only show when creating new pack */}
                {!isAddingToExistingPack && (
                  <FormSection
                    ios={{ title: 'Pack Details' }}
                    footnote="Enter basic information for your new pack"
                  >
                    <form.Field name="packName">
                      {(field) => (
                        <FormItem>
                          <TextField
                            placeholder="Pack Name"
                            value={field.state.value || ''}
                            onBlur={field.handleBlur}
                            onChangeText={field.handleChange}
                            leftView={
                              <View className="ios:pl-2 justify-center pl-2">
                                <Icon name="backpack" size={16} color={colors.grey3} />
                              </View>
                            }
                          />
                          {field.state.meta.errors.length > 0 && (
                            <Text className="text-destructive text-sm mt-1">
                              {field.state.meta.errors[0]}
                            </Text>
                          )}
                        </FormItem>
                      )}
                    </form.Field>

                    <form.Field name="packDescription">
                      {(field) => (
                        <FormItem>
                          <TextField
                            placeholder="Description (optional)"
                            value={field.state.value || ''}
                            onBlur={field.handleBlur}
                            onChangeText={field.handleChange}
                            multiline
                            numberOfLines={3}
                            leftView={
                              <View className="ios:pl-2 justify-center pl-2">
                                <Icon name="file-text" size={16} color={colors.grey3} />
                              </View>
                            }
                          />
                        </FormItem>
                      )}
                    </form.Field>
                  </FormSection>
                )}

                {/* Settings */}
                <FormSection ios={{ title: 'Settings' }}>
                  <form.Field name="minConfidence">
                    {(field) => (
                      <FormItem>
                        <View className="flex-row items-center justify-between">
                          <Text>Confidence Threshold: {Math.round(field.state.value * 100)}%</Text>
                          <Text className="text-sm text-muted-foreground">
                            {selectedCatalogItems.size} items selected
                          </Text>
                        </View>
                      </FormItem>
                    )}
                  </form.Field>

                  {!isAddingToExistingPack && (
                    <form.Field name="isPublic">
                      {(field) => (
                        <FormItem>
                          <View className="flex-row items-center justify-between">
                            <Text>Make Pack Public</Text>
                            <Switch
                              value={field.state.value || false}
                              onValueChange={field.handleChange}
                            />
                          </View>
                        </FormItem>
                      )}
                    </form.Field>
                  )}
                </FormSection>

                {/* Final Action Button */}
                <View className="p-4 pb-8">
                  <Button
                    onPress={form.handleSubmit}
                    disabled={selectedCatalogItems.size === 0 || createPackMutation.isPending}
                    className="w-full"
                  >
                    {createPackMutation.isPending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : isAddingToExistingPack ? (
                      <Text>Add {selectedCatalogItems.size} Items to Pack</Text>
                    ) : (
                      <Text>Create Pack with {selectedCatalogItems.size} Items</Text>
                    )}
                  </Button>
                </View>
              </Form>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

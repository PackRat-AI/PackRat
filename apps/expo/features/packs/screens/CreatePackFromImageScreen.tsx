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
import { Stack, useRouter } from 'expo-router';
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
import { z } from 'zod';
import type { DetectedItemWithMatches } from '../hooks/useImageDetection';
import { useAnalyzeImage, useCreatePackFromImage } from '../hooks/useImageDetection';

const packFromImageSchema = z.object({
  packName: z.string().min(1, 'Pack name is required'),
  packDescription: z.string(),
  isPublic: z.boolean(),
  minConfidence: z.number().min(0).max(1),
});

type PackFromImageFormValues = z.infer<typeof packFromImageSchema>;

export function CreatePackFromImageScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { selectedImage, pickImage, takePhoto, deleteImage } = useImageUpload();
  const [analysisResult, setAnalysisResult] = useState<DetectedItemWithMatches[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeImageMutation = useAnalyzeImage();
  const createPackMutation = useCreatePackFromImage();

  const form = useForm<PackFromImageFormValues>({
    defaultValues: {
      packName: '',
      packDescription: '',
      isPublic: false,
      minConfidence: 0.5,
    },
    onSubmit: async ({ value }) => {
      if (!selectedImage) {
        Alert.alert('Error', 'Please select an image first');
        return;
      }

      if (!analysisResult || analysisResult.length === 0) {
        Alert.alert('Error', 'Please analyze the image first to detect items');
        return;
      }

      try {
        // Upload image to get URL if needed
        const imageFileName = await handleImageUpload();
        if (!imageFileName) {
          Alert.alert('Error', 'Failed to upload image');
          return;
        }

        // Get public URL for the image
        const imageUrl = `${ImageCacheManager.cacheDirectory}${imageFileName}`;

        const result = await createPackMutation.mutateAsync({
          imageUrl,
          packName: value.packName,
          packDescription: value.packDescription,
          isPublic: value.isPublic,
          minConfidence: value.minConfidence,
        });

        Alert.alert(
          'Success!',
          `Pack "${result.pack.name}" created with ${result.pack.itemsCount} items detected from your image.`,
          [
            {
              text: 'View Pack',
              onPress: () => router.replace(`/pack/${result.pack.id}`),
            },
          ],
        );
      } catch (error) {
        console.error('Error creating pack from image:', error);
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create pack');
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
      // For the demo, we'll use the local URI. In production, you'd upload first.
      const result = await analyzeImageMutation.mutateAsync({
        imageUrl: selectedImage.uri,
        matchLimit: 3,
      });

      setAnalysisResult(result.detectedItems);

      if (result.detectedItems.length === 0) {
        Alert.alert(
          'No Items Detected',
          'No outdoor gear items were detected in this image. Try taking a clearer photo with better lighting, or ensure your gear is laid out visibly.',
        );
      } else {
        Alert.alert(
          'Analysis Complete',
          `Detected ${result.detectedItems.length} items in your image. Review the results below and adjust the pack name if needed.`,
        );
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to analyze image');
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
  };

  const displayImage = selectedImage ? { uri: selectedImage.uri } : null;
  const highConfidenceItems =
    analysisResult?.filter(
      (item) => item.detected.confidence >= form.getFieldValue('minConfidence'),
    ) || [];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Create Pack from Photo',
          headerBackVisible: true,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 bg-background">
          <View className="p-4">
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
                          <Text className="font-medium text-white">Analyze Items</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <TouchableOpacity
                      className="h-64 items-center justify-center rounded-lg border border-dashed border-input bg-muted p-4"
                      onPress={handleAddImage}
                    >
                      <Icon name="camera" size={48} color={colors.muted.foreground} />
                      <Text className="mt-2 text-muted-foreground">Tap to add gear photo</Text>
                      <Text className="text-center text-xs text-muted-foreground mt-1">
                        Lay out your gear and take a clear photo for best results
                      </Text>
                    </TouchableOpacity>
                  )}
                </FormItem>
              </FormSection>

              {/* Analysis Progress */}
              {isAnalyzing && (
                <FormSection ios={{ title: 'AI Analysis' }}>
                  <FormItem>
                    <View className="flex-row items-center justify-center py-4">
                      <ActivityIndicator size="large" color={colors.primary} />
                      <Text className="ml-2 text-muted-foreground">
                        Analyzing your gear photo...
                      </Text>
                    </View>
                  </FormItem>
                </FormSection>
              )}

              {/* Analysis Results */}
              {analysisResult && analysisResult.length > 0 && (
                <FormSection
                  ios={{ title: 'Detected Items' }}
                  footnote={`Found ${analysisResult.length} items (${highConfidenceItems.length} above confidence threshold)`}
                >
                  <FormItem>
                    <ScrollView horizontal className="py-2">
                      {analysisResult.map((item, index) => (
                        <View
                          key={`${item.detected.name}-${index}`}
                          className={`mr-3 rounded-lg border p-3 w-48 ${
                            item.detected.confidence >= form.getFieldValue('minConfidence')
                              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                              : 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                          }`}
                        >
                          <Text className="font-semibold text-sm" numberOfLines={1}>
                            {item.detected.name}
                          </Text>
                          <Text className="text-xs text-muted-foreground mt-1" numberOfLines={2}>
                            {item.detected.description}
                          </Text>
                          <Text className="text-xs mt-1">
                            Confidence: {Math.round(item.detected.confidence * 100)}%
                          </Text>
                          <Text className="text-xs">Category: {item.detected.category}</Text>
                          {item.catalogMatches.length > 0 && (
                            <Text className="text-xs text-green-600 dark:text-green-400 mt-1">
                              ✓ Found in catalog
                            </Text>
                          )}
                        </View>
                      ))}
                    </ScrollView>
                  </FormItem>
                </FormSection>
              )}

              {/* Pack Details Form */}
              <FormSection
                ios={{ title: 'Pack Details' }}
                footnote="Enter basic information for your new pack"
              >
                <form.Field name="packName">
                  {(field) => (
                    <FormItem>
                      <TextField
                        placeholder="Pack Name"
                        value={field.state.value}
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
                        value={field.state.value}
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

              {/* Settings */}
              <FormSection ios={{ title: 'Settings' }}>
                <form.Field name="minConfidence">
                  {(field) => (
                    <FormItem>
                      <View className="flex-row items-center justify-between">
                        <Text>Confidence Threshold: {Math.round(field.state.value * 100)}%</Text>
                        <Text className="text-sm text-muted-foreground">
                          {highConfidenceItems.length} items
                        </Text>
                      </View>
                    </FormItem>
                  )}
                </form.Field>

                <form.Field name="isPublic">
                  {(field) => (
                    <FormItem>
                      <View className="flex-row items-center justify-between">
                        <Text>Make Pack Public</Text>
                        <Switch value={field.state.value} onValueChange={field.handleChange} />
                      </View>
                    </FormItem>
                  )}
                </form.Field>
              </FormSection>

              {/* Create Pack Button */}
              <View className="p-4 pb-8">
                <Button
                  onPress={form.handleSubmit}
                  disabled={!selectedImage || !analysisResult || createPackMutation.isPending}
                  className="w-full"
                >
                  {createPackMutation.isPending ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    `Create Pack with ${highConfidenceItems.length} Items`
                  )}
                </Button>
              </View>
            </Form>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

import { useActionSheet } from '@expo/react-native-action-sheet';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { type SelectedImage, useImagePicker } from 'expo-app/features/packs/hooks/useImagePicker';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { assertNonNull } from 'expo-app/utils/typeAssertions';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Image, ScrollView, View } from 'react-native';
import Toast from 'react-native-toast-message';
import type { CatalogItem } from '../../catalog/types';
import { HorizontalCatalogItemCard } from '../components/HorizontalCatalogItemCard';
import { useBulkAddCatalogItems } from '../hooks';
import type { DetectedItemWithMatches } from '../hooks/useImageDetection';
import { useImageDetection } from '../hooks/useImageDetection';
import { uploadImage } from '../utils';

export function ItemsScanScreen() {
  const router = useRouter();
  const { colors } = useColorScheme();
  const { packId, ...fileInfo } = useLocalSearchParams();
  const { selectedImage, pickImage, takePhoto } = useImagePicker(fileInfo as SelectedImage);
  const { showActionSheetWithOptions } = useActionSheet();
  const [analysisResult, setAnalysisResult] = useState<DetectedItemWithMatches[] | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCatalogItems, setSelectedCatalogItems] = useState<Set<number>>(new Set());

  const analyzeImageMutation = useImageDetection();
  const { addItemsToPack } = useBulkAddCatalogItems();

  const handleAnalyzeImage = useCallback(async () => {
    assertNonNull(selectedImage);
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
        matchLimit: 1,
      });

      setAnalysisResult(result.detectedItems);
      setSelectedCatalogItems(new Set()); // Reset selection when analyzing new image

      if (result.detectedItems.length === 0) {
        Alert.alert(
          'No Items Detected',
          'No outdoor gear items were detected in this image. Try taking a clearer photo with better lighting, or ensure your gear is laid out visibly.',
        );
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to analyze image');
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedImage, analyzeImageMutation]);

  useEffect(() => {
    handleAnalyzeImage();
  }, []);

  const handleAddImage = () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: {
          backgroundColor: colors.card,
        },
        textStyle: {
          color: colors.foreground,
        },
      },
      async (selectedIndex) => {
        try {
          switch (selectedIndex) {
            case 0: {
              // Take Photo
              await takePhoto();
              break;
            }
            case 1: {
              // Choose from Library
              await pickImage();
              break;
            }
            case cancelButtonIndex:
              // Canceled
              return;
          }
          handleAnalyzeImage();
        } catch (err) {
          console.error('Error handling image:', err);
          Alert.alert('Error', 'Failed to process image. Please try again.');
        }
      },
    );
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

  // Get all catalog items from analysis results with their similarity scores
  const allCatalogItems: (CatalogItem & { similarity: number })[] =
    analysisResult?.flatMap((item) =>
      item.catalogMatches.map((match) => ({
        ...match,
        similarity: match.similarity * item.detected.confidence,
      })),
    ) || [];

  // Get unique catalog items (in case same item matches multiple detections)
  const uniqueCatalogItems = allCatalogItems.reduce(
    (acc, item) => {
      const existing = acc.find((existing) => existing.id === item.id);
      if (!existing || item.similarity > existing.similarity) {
        acc = acc.filter((existing) => existing.id !== item.id);
        acc.push(item);
      }
      return acc;
    },
    [] as (CatalogItem & { similarity: number })[],
  );

  const selectedCatalogItemsList = uniqueCatalogItems.filter((item) =>
    selectedCatalogItems.has(item.id),
  );

  const handleCatalogItemsSelected = async () => {
    router.back();
    await addItemsToPack(packId as string, selectedCatalogItemsList);
    Toast.show({
      type: 'success',
      text1: `Added ${selectedCatalogItemsList.length} items to your pack`,
    });
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Scan Items from Photo',
          headerBackVisible: true,
        }}
      />

      <View className="flex-row items-center justify-between bg-card px-4 py-2 border border-border rounded-md">
        <Image
          source={{ uri: (selectedImage as SelectedImage).uri }}
          className="h-24 w-24 rounded-lg"
          resizeMode="cover"
        />
        <Button variant="secondary" onPress={handleAddImage}>
          <Text>Change</Text>
        </Button>
      </View>

      <ScrollView className="flex-1 bg-background">
        {/* Analysis Progress */}
        {isAnalyzing && (
          <View className="items-center mt-32 justify-center py-4">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text className="ml-2 text-muted-foreground">Scanning for items...</Text>
          </View>
        )}

        {/* Catalog Items Selection */}
        {uniqueCatalogItems.length > 0 && (
          <View className="gap-2 p-4">
            <Text variant="footnote">Identified {uniqueCatalogItems.length} items</Text>
            {uniqueCatalogItems.map((item) => (
              <HorizontalCatalogItemCard
                key={item.id}
                item={item}
                selected={selectedCatalogItems.has(item.id)}
                onSelect={handleCatalogItemToggle}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {/* Action Button */}
      {uniqueCatalogItems && uniqueCatalogItems.length > 0 && (
        <View className="border-t border-border p-4 pb-8">
          <Button
            onPress={handleCatalogItemsSelected}
            disabled={!analysisResult || selectedCatalogItems.size === 0}
            className="w-full"
            variant="tonal"
          >
            <Text>
              Add {selectedCatalogItems.size} {selectedCatalogItems.size > 1 ? 'Items' : 'Item'}
            </Text>
          </Button>
        </View>
      )}
    </>
  );
}

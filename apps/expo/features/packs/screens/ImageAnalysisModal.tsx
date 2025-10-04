import { useActionSheet } from '@expo/react-native-action-sheet';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ImageAnalysisResults } from '../components/ImageAnalysisResults';
import type { DetectedItem, VectorSearchResult } from '../hooks/useImageAnalysis';
import { useMockImageAnalysis } from '../hooks/useImageAnalysis';
import { useImageUpload } from '../hooks/useImageUpload';

interface ImageAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  onItemSelect: (itemData: Partial<DetectedItem | VectorSearchResult>) => void;
  packId: string;
}

export function ImageAnalysisModal({
  visible,
  onClose,
  onItemSelect,
  packId,
}: ImageAnalysisModalProps) {
  const router = useRouter();
  const { colors, colorScheme } = useColorScheme();
  const { showActionSheetWithOptions } = useActionSheet();
  
  const {
    selectedImage,
    pickImage,
    takePhoto,
    clearSelectedImage,
  } = useImageUpload();

  // Using mock for now - switch to useImageAnalysis when API is ready
  const { isAnalyzing, analysisResult, analyzeImage, clearAnalysis } = useMockImageAnalysis();

  const [step, setStep] = useState<'capture' | 'analysis'>('capture');

  const handleAddImage = useCallback(async () => {
    const options = ['Take Photo', 'Choose from Library', 'Cancel'];
    const cancelButtonIndex = 2;

    showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        containerStyle: {
          backgroundColor: colorScheme === 'dark' ? 'black' : 'white',
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
              break;
            case 1: // Choose from Library
              await pickImage();
              break;
            case cancelButtonIndex:
              return;
          }
        } catch (err) {
          console.error('Error handling image:', err);
          Alert.alert('Error', 'Failed to process image. Please try again.');
        }
      },
    );
  }, [takePhoto, pickImage, showActionSheetWithOptions, colors, colorScheme]);

  const handleAnalyzeImage = useCallback(async () => {
    if (!selectedImage) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    setStep('analysis');
    await analyzeImage(selectedImage.uri);
  }, [selectedImage, analyzeImage]);

  const handleItemSelect = useCallback((item: DetectedItem) => {
    onItemSelect({
      name: item.name,
      description: item.description,
      category: item.category,
      brand: item.brand,
      color: item.color,
      material: item.material,
    });
    onClose();
  }, [onItemSelect, onClose]);

  const handleSimilarItemSelect = useCallback((item: VectorSearchResult, detectedItem: DetectedItem) => {
    onItemSelect({
      name: item.name,
      description: item.description,
      category: item.category,
      brand: item.brand,
      // Keep detected color/material if similar item doesn't have them
      color: detectedItem.color,
      material: detectedItem.material,
    });
    onClose();
  }, [onItemSelect, onClose]);

  const handleRetry = useCallback(() => {
    clearAnalysis();
    setStep('capture');
    clearSelectedImage();
  }, [clearAnalysis, clearSelectedImage]);

  const handleClose = useCallback(() => {
    clearAnalysis();
    clearSelectedImage();
    setStep('capture');
    onClose();
  }, [clearAnalysis, clearSelectedImage, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <TouchableOpacity onPress={handleClose}>
            <Text className="text-primary">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-foreground">
            AI Gear Detection
          </Text>
          <View className="w-12" />
        </View>

        {step === 'capture' ? (
          <View className="flex-1 p-4">
            {/* Image Capture Section */}
            <View className="mb-6">
              <Text className="mb-2 text-lg font-semibold text-foreground">
                Capture Your Gear
              </Text>
              <Text className="text-muted-foreground">
                Take a photo or select an image of your outdoor gear to automatically identify items.
              </Text>
            </View>

            {selectedImage ? (
              <View className="mb-6 flex-1">
                <View className="relative flex-1 rounded-lg overflow-hidden">
                  <Image
                    source={{ uri: selectedImage.uri }}
                    className="h-full w-full"
                    resizeMode="contain"
                  />
                  <TouchableOpacity
                    className="absolute right-2 top-2 rounded-full bg-black bg-opacity-50 p-2"
                    onPress={clearSelectedImage}
                  >
                    <Icon name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>
                </View>
                
                <TouchableOpacity
                  onPress={handleAnalyzeImage}
                  disabled={isAnalyzing}
                  className="mt-4 flex-row items-center justify-center rounded-lg bg-primary px-4 py-4"
                >
                  <Icon name="camera" size={20} color={colors.background} />
                  <Text className="ml-2 text-lg font-medium text-primary-foreground">
                    Analyze Gear with AI
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                className="flex-1 items-center justify-center rounded-lg border border-dashed border-input bg-background"
                onPress={handleAddImage}
              >
                <Icon name="camera" size={48} color={colors.foreground} />
                <Text className="mt-4 text-lg font-medium text-foreground">
                  Add Photo
                </Text>
                <Text className="mt-2 text-center text-muted-foreground">
                  Tap to take a photo or select from library
                </Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View className="flex-1 p-4">
            <ImageAnalysisResults
              isAnalyzing={isAnalyzing}
              detectedItems={analysisResult?.items || []}
              analysisConfidence={analysisResult?.analysisConfidence || 0}
              onItemSelect={handleItemSelect}
              onSimilarItemSelect={handleSimilarItemSelect}
              onRetry={handleRetry}
            />
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}
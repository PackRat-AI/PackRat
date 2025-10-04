import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { DetectedItem, VectorSearchResult } from '../hooks/useImageAnalysis';

interface ImageAnalysisResultsProps {
  isAnalyzing: boolean;
  detectedItems: DetectedItem[];
  analysisConfidence: number;
  onItemSelect: (item: DetectedItem) => void;
  onSimilarItemSelect: (item: VectorSearchResult, detectedItem: DetectedItem) => void;
  onRetry: () => void;
}

export function ImageAnalysisResults({
  isAnalyzing,
  detectedItems,
  analysisConfidence,
  onItemSelect,
  onSimilarItemSelect,
  onRetry,
}: ImageAnalysisResultsProps) {
  const { colors } = useColorScheme();

  if (isAnalyzing) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="mt-4 text-center text-muted-foreground">
          Analyzing image with AI vision...
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          This may take a few seconds
        </Text>
      </View>
    );
  }

  if (detectedItems.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Icon name="backpack" size={48} color={colors.grey3} />
        <Text className="mt-4 text-center text-foreground">
          No outdoor gear detected
        </Text>
        <Text className="mt-2 text-center text-sm text-muted-foreground">
          Make sure the image clearly shows outdoor gear items
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          className="mt-4 rounded-lg bg-primary px-4 py-2"
        >
          <Text className="text-primary-foreground">Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Analysis Summary */}
      <View className="mb-4 rounded-lg bg-card p-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-lg font-semibold text-card-foreground">
            Found {detectedItems.length} items
          </Text>
          <View className="flex-row items-center">
            <Icon name="star" size={16} color={colors.primary} />
            <Text className="ml-1 text-sm text-muted-foreground">
              {Math.round(analysisConfidence * 100)}% confidence
            </Text>
          </View>
        </View>
      </View>

      {/* Detected Items */}
      {detectedItems.map((item, index) => (
        <DetectedItemCard
          key={index}
          item={item}
          onItemSelect={() => onItemSelect(item)}
          onSimilarItemSelect={(similarItem) => onSimilarItemSelect(similarItem, item)}
        />
      ))}
    </ScrollView>
  );
}

interface DetectedItemCardProps {
  item: DetectedItem;
  onItemSelect: () => void;
  onSimilarItemSelect: (item: VectorSearchResult) => void;
}

function DetectedItemCard({ item, onItemSelect, onSimilarItemSelect }: DetectedItemCardProps) {
  const { colors } = useColorScheme();

  return (
    <View className="mb-4 rounded-lg bg-card">
      {/* Main detected item */}
      <Pressable
        onPress={onItemSelect}
        className="p-4 active:opacity-70"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-card-foreground">
              {item.name}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              {item.description}
            </Text>
            
            <View className="mt-2 flex-row flex-wrap gap-2">
              <View className="rounded bg-primary/10 px-2 py-1">
                <Text className="text-xs text-primary">
                  {item.category}
                </Text>
              </View>
              {item.brand && (
                <View className="rounded bg-secondary px-2 py-1">
                  <Text className="text-xs text-secondary-foreground">
                    {item.brand}
                  </Text>
                </View>
              )}
              {item.color && (
                <View className="rounded bg-accent px-2 py-1">
                  <Text className="text-xs text-accent-foreground">
                    {item.color}
                  </Text>
                </View>
              )}
            </View>
          </View>
          
          <View className="ml-4 items-end">
            <View className="flex-row items-center">
              <Icon name="eye" size={14} color={colors.primary} />
              <Text className="ml-1 text-sm text-primary">
                {Math.round(item.confidence * 100)}%
              </Text>
            </View>
            <Icon name="circle-outline" size={20} color={colors.primary} />
          </View>
        </View>
      </Pressable>

      {/* Similar items from vector search */}
      {item.vectorSearchResults && item.vectorSearchResults.length > 0 && (
        <View className="border-t border-border p-4 pt-3">
          <Text className="mb-3 text-sm font-medium text-muted-foreground">
            Similar items in catalog:
          </Text>
          <FlatList
            data={item.vectorSearchResults}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(result) => result.id}
            renderItem={({ item: result }) => (
              <SimilarItemCard
                item={result}
                onPress={() => onSimilarItemSelect(result)}
              />
            )}
            contentContainerStyle={{ gap: 12 }}
          />
        </View>
      )}
    </View>
  );
}

interface SimilarItemCardProps {
  item: VectorSearchResult;
  onPress: () => void;
}

function SimilarItemCard({ item, onPress }: SimilarItemCardProps) {
  const { colors } = useColorScheme();

  return (
    <Pressable
      onPress={onPress}
      className="w-48 rounded-lg bg-muted p-3 active:opacity-70"
    >
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          className="h-20 w-full rounded bg-background"
          resizeMode="cover"
        />
      )}
      <Text className="mt-2 text-sm font-medium text-foreground" numberOfLines={2}>
        {item.name}
      </Text>
      <Text className="mt-1 text-xs text-muted-foreground" numberOfLines={1}>
        {item.brand || item.category}
      </Text>
      <View className="mt-2 flex-row items-center justify-between">
        {item.price && (
          <Text className="text-sm font-semibold text-primary">
            ${item.price}
          </Text>
        )}
        <View className="flex-row items-center">
          <Icon name="information" size={12} color={colors.grey3} />
          <Text className="ml-1 text-xs text-muted-foreground">
            {Math.round(item.similarity * 100)}%
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
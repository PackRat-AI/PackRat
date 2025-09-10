import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useBulkAddCatalogItems } from 'expo-app/features/catalog/hooks';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { cn } from 'expo-app/lib/cn';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import type { GapAnalysisItem, GapAnalysisResponse } from '../hooks/usePackGapAnalysis';
import type { Pack } from '../types';
import { GapItemCatalogSuggestions } from './GapItemCatalogSuggestions';

interface GapAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  pack: Pack;
  analysis: GapAnalysisResponse | null;
  isLoading: boolean;
  onRetry: () => void;
}

export function GapAnalysisModal({
  visible,
  onClose,
  pack,
  analysis,
  isLoading,
  onRetry,
}: GapAnalysisModalProps) {
  const { colors } = useColorScheme();
  const [selectedGapItem, setSelectedGapItem] = useState<GapAnalysisItem | null>(null);
  const { addItemsToPack } = useBulkAddCatalogItems();

  const handleAddItems = async (catalogItems: CatalogItem[]) => {
    if (catalogItems.length > 0) {
      await addItemsToPack(pack.id, catalogItems);
      setSelectedGapItem(null);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600';
      case 'medium':
        return 'text-yellow-600';
      case 'low':
        return 'text-green-600';
      default:
        return 'text-muted-foreground';
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'alert-triangle';
      case 'medium':
        return 'alert-circle';
      case 'low':
        return 'circle';
      default:
        return 'circle';
    }
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          {/* Header */}
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <Text className="text-lg font-semibold">Gap Analysis</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Icon name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="flex-1 p-4">
            {isLoading ? (
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator />
                <Text className="mt-4 text-muted-foreground">
                  Analyzing your pack for missing gear...
                </Text>
              </View>
            ) : analysis ? (
              <View>
                {/* Summary */}
                {analysis.summary && (
                  <View className="mb-6 rounded-lg bg-muted p-4">
                    <Text className="text-sm text-muted-foreground">{analysis.summary}</Text>
                  </View>
                )}

                {/* Gap Items */}
                {analysis.gaps.length > 0 ? (
                  <View>
                    <Text className="mb-4 text-base font-medium">Missing Items</Text>
                    {analysis.gaps.map((gap) => (
                      <TouchableOpacity
                        key={`${gap.suggestion}-${gap.category}`}
                        className="mb-3 rounded-lg border border-border bg-card p-4"
                        onPress={() => setSelectedGapItem(gap)}
                      >
                        <View className="flex-row items-start justify-between">
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text className="font-medium text-foreground">{gap.suggestion}</Text>
                              {gap.priority && (
                                <Icon
                                  name={getPriorityIcon(gap.priority)}
                                  size={14}
                                  className={cn('flex-shrink-0', getPriorityColor(gap.priority))}
                                />
                              )}
                            </View>
                            {gap.category && (
                              <Text className="mt-1 text-xs text-muted-foreground">
                                {gap.category}
                              </Text>
                            )}
                            <Text className="mt-2 text-sm text-muted-foreground">{gap.reason}</Text>
                          </View>
                          <Icon name="chevron-right" size={16} color={colors.foreground} />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View className="items-center py-8">
                    <Icon name="check-circle" size={48} color={colors.primary} />
                    <Text className="mt-4 text-center font-medium text-foreground">
                      Pack Looks Complete!
                    </Text>
                    <Text className="mt-2 text-center text-sm text-muted-foreground">
                      No significant gaps found in your gear setup.
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <View className="flex-1 items-center justify-center py-8">
                <View className="bg-destructive/10 mb-4 rounded-full p-4">
                  <Icon name="exclamation" size={32} color="text-destructive" />
                </View>
                <Text className="mb-2 text-center text-lg font-medium text-foreground">
                  Analysis Failed
                </Text>
                <Text className="mb-6 text-center text-sm text-muted-foreground">
                  Unable to analyze your pack. Please try again.
                </Text>
                <Button onPress={onRetry} variant="secondary">
                  <Icon name="restart" size={16} />
                  <Text>Retry Analysis</Text>
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* Catalog Suggestions Modal */}
      {selectedGapItem && (
        <GapItemCatalogSuggestions
          visible={!!selectedGapItem}
          onClose={() => setSelectedGapItem(null)}
          gapItem={selectedGapItem}
          onItemsSelected={handleAddItems}
        />
      )}
    </>
  );
}

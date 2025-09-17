import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useBulkAddCatalogItems } from 'expo-app/features/catalog/hooks';
import type { CatalogItem } from 'expo-app/features/catalog/types';
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
  const { isDarkColorScheme, colors } = useColorScheme();
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
      case 'must-have':
        return isDarkColorScheme ? '#ef4444' : colors.destructive;
      case 'nice-to-have':
        return colors.yellow;
      case 'optional':
        return colors.primary;
      default:
        return colors.grey2;
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'must-have':
        return {
          ios: { name: 'exclamationmark.triangle.fill' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'alert-circle' as const,
          },
        };
      case 'nice-to-have':
        return {
          ios: { name: 'star.fill' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'star' as const,
          },
        };
      case 'optional':
        return {
          ios: { name: 'circle.fill' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'circle' as const,
          },
        };
      default:
        return {
          ios: { name: 'circle' as const },
          materialIcon: {
            type: 'MaterialCommunityIcons' as const,
            name: 'circle-outline' as const,
          },
        };
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'must-have':
        return 'Must-Have';
      case 'nice-to-have':
        return 'Nice-to-Have';
      case 'optional':
        return 'Optional';
      default:
        throw new Error('Unknown priority level');
    }
  };

  console.log('Gap Analysis:', JSON.stringify(analysis, null, 2));

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <Text>Gap Analysis</Text>
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
                {analysis.gaps.length > 0 ? (
                  <View>
                    {analysis.gaps.map((gap) => (
                      <View
                        key={gap.suggestion}
                        className="mb-4 justify-between rounded-lg border border-border bg-card p-4"
                      >
                        <View className="flex-1">
                          <View className="flex-row items-start gap-2">
                            <Text className="font-medium text-foreground flex-1">
                              {gap.suggestion}
                            </Text>
                            {gap.priority && (
                              <View>
                                <View className="flex-row self-end items-center gap-2 rounded-full border border-border bg-transparent px-2 py-0.5">
                                  <Icon
                                    {...getPriorityIcon(gap.priority)}
                                    size={14}
                                    color={getPriorityColor(gap.priority)}
                                  />
                                  <Text
                                    className="text-xs font-medium"
                                    style={{ color: getPriorityColor(gap.priority) }}
                                  >
                                    {getPriorityLabel(gap.priority)}
                                  </Text>
                                </View>
                              </View>
                            )}
                          </View>
                          <Text className="mt-2 text-sm text-muted-foreground">{gap.reason}</Text>
                        </View>
                        <Button
                          onPress={() => setSelectedGapItem(gap)}
                          className="self-end mr-1 mt-2"
                          variant="secondary"
                        >
                          <Text className="text-base">Find Gear</Text>
                        </Button>
                      </View>
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
                <View className="bg-destructive/10 dark:bg-destructive/90 mb-4 rounded-full p-4">
                  <Icon
                    name="exclamation"
                    size={32}
                    color={isDarkColorScheme ? '#ef4444' : colors.destructive}
                  />
                </View>
                <Text className="mb-2 text-center text-lg font-medium text-foreground">
                  Analysis Failed
                </Text>
                <Text className="mb-6 text-center text-sm text-muted-foreground">
                  Unable to analyze your pack. Please try again.
                </Text>
                <Button onPress={onRetry} variant="secondary">
                  <Icon name="restart" size={20} color={colors.foreground} />
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

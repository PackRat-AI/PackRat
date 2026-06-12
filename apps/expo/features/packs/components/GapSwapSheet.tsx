import { ActivityIndicator, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import type { GapAnalysisItem } from '../hooks/usePackGapAnalysis';
import { HorizontalCatalogItemCard } from './HorizontalCatalogItemCard';

interface GapSwapSheetProps {
  visible: boolean;
  onClose: () => void;
  gap: GapAnalysisItem | null;
  matches: (CatalogItem & { similarity?: number })[];
  isLoading: boolean;
  onSelect: (item: CatalogItem) => void;
}

export function GapSwapSheet({
  visible,
  onClose,
  gap,
  matches,
  isLoading,
  onSelect,
}: GapSwapSheetProps) {
  const { colors } = useColorScheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
          <View className="flex-1">
            <Text className="text-base font-semibold text-foreground">
              {gap?.suggestion ?? 'Choose Gear'}
            </Text>
            {gap?.reason && (
              <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                {gap.reason}
              </Text>
            )}
          </View>
          <TouchableOpacity onPress={onClose} className="p-1">
            <Icon name="close" size={24} color={colors.foreground} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" />
            </View>
          ) : matches.length > 0 ? (
            matches.map((item) => (
              <HorizontalCatalogItemCard
                key={item.id}
                item={item}
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
              />
            ))
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted-foreground">No gear found for this suggestion.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

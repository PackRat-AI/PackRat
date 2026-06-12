import type { BottomSheetModal } from '@gorhom/bottom-sheet';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { ActivityIndicator, Sheet, Text } from '@packrat/ui/nativewindui';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import * as React from 'react';
import { View } from 'react-native';
import type { GapAnalysisItem } from '../hooks/usePackGapAnalysis';
import { HorizontalCatalogItemCard } from './HorizontalCatalogItemCard';

interface GapSwapSheetProps {
  gap: GapAnalysisItem | null;
  matches: (CatalogItem & { similarity?: number })[];
  isLoading: boolean;
  onSelect: (item: CatalogItem) => void;
}

export const GapSwapSheet = React.forwardRef<BottomSheetModal, GapSwapSheetProps>(
  function GapSwapSheet({ gap, matches, isLoading, onSelect }, ref) {
    const { colors } = useColorScheme();

    return (
      <Sheet
        ref={ref}
        snapPoints={['60%']}
        enablePanDownToClose
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.grey2 }}
      >
        <View className="px-4 pb-2 pt-1 border-b border-border">
          <Text className="text-base font-semibold text-foreground">
            {gap?.suggestion ?? 'Choose Gear'}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {gap?.reason}
          </Text>
        </View>

        <BottomSheetScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
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
                  if (ref && 'current' in ref) ref.current?.dismiss();
                }}
              />
            ))
          ) : (
            <View className="items-center py-8">
              <Text className="text-muted-foreground">No gear found for this suggestion.</Text>
            </View>
          )}
        </BottomSheetScrollView>
      </Sheet>
    );
  },
);

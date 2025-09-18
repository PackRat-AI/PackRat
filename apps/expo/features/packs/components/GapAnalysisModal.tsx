import { ActivityIndicator, Button, cn, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import type { GapAnalysisResponse } from '../hooks/usePackGapAnalysis';
import type { Pack } from '../types';
import { GapSuggestion } from './GapSuggestion';

interface GapAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  pack: Pack;
  location?: string;
  analysis: GapAnalysisResponse | null;
  isLoading: boolean;
  onRetry: () => void;
}

export function GapAnalysisModal({
  visible,
  onClose,
  pack,
  analysis,
  location,
  isLoading,
  onRetry,
}: GapAnalysisModalProps) {
  const { isDarkColorScheme, colors } = useColorScheme();

  return (
    <>
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background">
          <View className="flex-row items-center justify-between border-b border-border p-4">
            <View className="flex-1">
              <Text
                variant="footnote"
                className="uppercase text-xs"
                style={{ color: colors.grey2 }}
              >
                Gap Analysis
              </Text>
              <Text numberOfLines={1}>{pack.name}</Text>
              <View className="flex-row items-center gap-2">
                <View className="flex-row items-center gap-1">
                  <Icon
                    materialIcon={{ type: 'MaterialCommunityIcons', name: 'hiking' }}
                    ios={{ name: 'figure.hiking' }}
                    size={16}
                    color={colors.grey}
                  />
                  <Text className="text-sm text-muted-foreground">{pack.category}</Text>
                </View>
                {location && (
                  <>
                    <View className="mx-1 h-1 w-1 rounded-full bg-muted-foreground" />
                    <View className="flex-row items-center gap-1">
                      <Icon
                        materialIcon={{ type: 'MaterialIcons', name: 'location-on' }}
                        ios={{ name: 'mappin' }}
                        size={16}
                        color={colors.grey}
                      />
                      <Text className="text-sm text-muted-foreground">{location}</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} className="p-1">
              <Icon name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView contentContainerClassName={cn('p-4', !analysis && 'flex-1')}>
            {isLoading ? (
              <View className="flex-1 items-center justify-center py-8">
                <ActivityIndicator size="large" />
                <Text className="mt-4 text-muted-foreground">Analyzing...</Text>
              </View>
            ) : analysis ? (
              <View>
                {analysis.gaps.length > 0 ? (
                  analysis.gaps.map((gap) => (
                    <GapSuggestion key={gap.suggestion} packId={pack.id} gap={gap} />
                  ))
                ) : (
                  <View className="items-center py-8 mt-32">
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
                  Unable to Analyze Pack
                </Text>
                <Text className="mb-6 text-center text-sm text-muted-foreground">
                  Please try again.
                </Text>
                <Button onPress={onRetry} variant="secondary">
                  <Text>Retry</Text>
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

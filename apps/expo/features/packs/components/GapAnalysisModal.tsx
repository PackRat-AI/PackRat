import { ActivityIndicator, Button, cn, Text } from '@packrat/ui/nativewindui';
import { Icon } from 'expo-app/components/Icon';
import type { CatalogItem } from 'expo-app/features/catalog/types';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { useState } from 'react';
import { Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { useAddCatalogItem } from '../hooks/useAddCatalogItem';
import { useGapCatalogMatches } from '../hooks/useGapCatalogMatches';
import type { GapAnalysisResponse } from '../hooks/usePackGapAnalysis';
import type { Pack, PackCategory } from '../types';
import { GapSuggestionRow } from './GapSuggestionRow';
import { GapSwapSheet } from './GapSwapSheet';

// ---------------------------------------------------------------------------
// Dev panel — tree-shaken in production builds (__DEV__ = false)
// ---------------------------------------------------------------------------
const DEV_MOCK_ANALYSIS: GapAnalysisResponse = __DEV__
  ? {
      summary:
        'Your pack covers the basics but is missing key safety and navigation gear for a multi-day backcountry trip.',
      gaps: [
        {
          suggestion: 'Headlamp',
          reason:
            'No light source found. Essential for camp setup after dark and emergency navigation.',
          priority: 'must-have',
          consumable: false,
          worn: false,
        },
        {
          suggestion: 'Water Filter',
          reason: 'No water purification method detected. Critical for backcountry water sources.',
          priority: 'must-have',
          consumable: false,
          worn: false,
        },
        {
          suggestion: 'First Aid Kit',
          reason: 'No medical supplies in pack. Required for any overnight trip.',
          priority: 'must-have',
          consumable: true,
          worn: false,
        },
        {
          suggestion: 'Trekking Poles',
          reason: 'Useful for steep terrain and reducing knee strain on descents.',
          priority: 'nice-to-have',
          consumable: false,
          worn: false,
        },
        {
          suggestion: 'Insulated Water Bottle',
          reason: 'Keeps liquids from freezing overnight in cold conditions.',
          priority: 'nice-to-have',
          consumable: false,
          worn: false,
        },
        {
          suggestion: 'Gaiters',
          reason: 'Useful for wet or snowy trail conditions to keep boots dry.',
          priority: 'optional',
          consumable: false,
          worn: true,
        },
      ],
    }
  : { gaps: [], summary: '' };

type DevState = 'results' | 'loading' | 'empty' | 'error' | null;

const DEV_CHIPS: { label: string; state: DevState }[] = __DEV__
  ? [
      { label: 'Results', state: 'results' },
      { label: 'Loading', state: 'loading' },
      { label: 'Empty', state: 'empty' },
      { label: 'Error', state: 'error' },
    ]
  : [];

interface DevGapPanelProps {
  active: DevState;
  onSelect: (state: DevState) => void;
}

function DevGapPanel({ active, onSelect }: DevGapPanelProps) {
  const { colors } = useColorScheme();
  return (
    <View
      className="mb-4 rounded-xl p-3"
      style={{ backgroundColor: colors.grey6, borderWidth: 1, borderColor: colors.grey4 }}
    >
      <Text variant="footnote" className="mb-2 font-semibold text-muted-foreground">
        🧪 Dev — Force state
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {DEV_CHIPS.map((chip) => {
          const isActive = active === chip.state;
          return (
            <TouchableOpacity
              key={chip.label}
              className="rounded-lg px-3 py-1.5"
              style={{ backgroundColor: isActive ? colors.primary : colors.grey5 }}
              onPress={() => onSelect(isActive ? null : chip.state)}
              activeOpacity={0.7}
            >
              <Text
                variant="footnote"
                className="font-semibold"
                style={{ color: isActive ? 'white' : colors.foreground }}
              >
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
// ---------------------------------------------------------------------------

interface GapAnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  pack: Pack;
  location?: string;
  activity?: PackCategory;
  analysis: GapAnalysisResponse | null;
  isLoading: boolean;
  onRetry: () => void;
}

type Selection = { item: CatalogItem; quantity: number };

export function GapAnalysisModal({
  visible,
  onClose,
  pack,
  analysis: analysisProp,
  location,
  activity,
  isLoading: isLoadingProp,
  onRetry,
}: GapAnalysisModalProps) {
  const { t } = useTranslation();
  const { isDarkColorScheme, colors } = useColorScheme();

  const [devState, setDevState] = useState<DevState>(null);

  const isLoading = __DEV__ && devState === 'loading' ? true : isLoadingProp;
  const analysis = __DEV__
    ? devState === 'results'
      ? DEV_MOCK_ANALYSIS
      : devState === 'empty'
        ? { gaps: [], summary: '' }
        : devState === 'error'
          ? null
          : devState === 'loading'
            ? null
            : analysisProp
    : analysisProp;

  const gaps = analysis?.gaps ?? [];
  const matchResults = useGapCatalogMatches(gaps);

  const [selections, setSelections] = useState<Record<number, Selection>>({});
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [swapVisible, setSwapVisible] = useState(false);

  const { addItemToPack, isLoading: isAdding } = useAddCatalogItem();

  const selectedCount = Object.keys(selections).length;

  const handleSelect = (gapIndex: number, item: CatalogItem) => {
    setSelections((prev) => ({ ...prev, [gapIndex]: { item, quantity: 1 } }));
  };

  const handleDeselect = (gapIndex: number) => {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[gapIndex];
      return next;
    });
  };

  const handleQuantityChange = (gapIndex: number, delta: number) => {
    setSelections((prev) => {
      const current = prev[gapIndex];
      if (!current) return prev;
      const newQty = current.quantity + delta;
      if (newQty <= 0) {
        const next = { ...prev };
        delete next[gapIndex];
        return next;
      }
      return { ...prev, [gapIndex]: { ...current, quantity: newQty } };
    });
  };

  const handleSwapItem = (item: CatalogItem) => {
    if (swapIndex === null) return;
    setSelections((prev) => {
      const current = prev[swapIndex];
      return {
        ...prev,
        [swapIndex]: { item, quantity: current?.quantity ?? 1 },
      };
    });
  };

  const handleAddAll = async () => {
    for (const [gapIndexStr, selection] of Object.entries(selections)) {
      const gap = gaps[Number(gapIndexStr)];
      await addItemToPack({
        packId: pack.id,
        opts: {
          catalogItem: selection.item,
          data: {
            quantity: selection.quantity,
            consumable: gap?.consumable,
            worn: gap?.worn,
          },
        },
      });
    }
    setSelections({});
    onClose();
  };

  const swapGap = swapIndex !== null ? (gaps[swapIndex] ?? null) : null;
  const swapMatches: (CatalogItem & { similarity?: number })[] =
    swapIndex !== null ? (matchResults[swapIndex]?.data?.items ?? []) : [];
  const swapLoading = swapIndex !== null ? (matchResults[swapIndex]?.isLoading ?? false) : false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border p-4">
          <View className="flex-1">
            <Text variant="footnote" className="uppercase text-xs" style={{ color: colors.grey2 }}>
              {t('packs.gapAnalysis')}
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
                <Text className="text-sm text-muted-foreground">{activity || pack.category}</Text>
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
          {__DEV__ && <DevGapPanel active={devState} onSelect={setDevState} />}

          {isLoading ? (
            <View className="flex-1 items-center justify-center py-8">
              <ActivityIndicator size="large" />
              <Text className="mt-4 text-muted-foreground">{t('packs.analyzing')}</Text>
            </View>
          ) : analysis ? (
            gaps.length > 0 ? (
              <View>
                {analysis.summary && (
                  <View className="mb-4 rounded-lg bg-muted/30 p-3">
                    <Text className="text-sm text-muted-foreground">{analysis.summary}</Text>
                  </View>
                )}
                {gaps.map((gap, i) => (
                  <GapSuggestionRow
                    key={gap.suggestion}
                    gap={gap}
                    topMatch={matchResults[i]?.data?.items?.[0]}
                    isLoadingMatch={matchResults[i]?.isLoading ?? false}
                    selected={i in selections}
                    selectedItem={selections[i]?.item}
                    quantity={selections[i]?.quantity ?? 1}
                    onSelect={(item) => handleSelect(i, item)}
                    onDeselect={() => handleDeselect(i)}
                    onQuantityChange={(delta) => handleQuantityChange(i, delta)}
                    onSwapPress={() => {
                      setSwapIndex(i);
                      setSwapVisible(true);
                    }}
                  />
                ))}
              </View>
            ) : (
              <View className="items-center py-8 mt-32">
                <Icon name="check-circle" size={48} color={colors.primary} />
                <Text className="mt-4 text-center font-medium text-foreground">
                  {t('packs.packLooksComplete')}
                </Text>
                <Text className="mt-2 text-center text-sm text-muted-foreground">
                  {t('packs.noSignificantGaps')}
                </Text>
              </View>
            )
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
                {t('packs.unableToAnalyzePack')}
              </Text>
              <Text className="mb-6 text-center text-sm text-muted-foreground">
                {t('packs.pleaseTryAgain')}
              </Text>
              <Button onPress={onRetry} variant="secondary">
                <Text>{t('packs.retry')}</Text>
              </Button>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {gaps.length > 0 && (
          <View className="border-t border-border p-4">
            <Button
              onPress={handleAddAll}
              disabled={selectedCount === 0 || isAdding}
              className="w-full"
            >
              {isAdding && <ActivityIndicator size="small" color="#fff" />}
              <Text>
                {isAdding
                  ? 'Adding...'
                  : selectedCount === 0
                    ? 'Select Items to Add'
                    : `Add ${selectedCount} Item${selectedCount !== 1 ? 's' : ''} to Pack`}
              </Text>
            </Button>
          </View>
        )}
      </View>

      <GapSwapSheet
        visible={swapVisible}
        onClose={() => setSwapVisible(false)}
        gap={swapGap}
        matches={swapMatches}
        isLoading={swapLoading}
        onSelect={handleSwapItem}
      />
    </Modal>
  );
}
